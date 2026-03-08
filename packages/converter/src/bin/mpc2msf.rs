//! MPC → MSF v2 batch conversion tool
//!
//! Usage:
//!   mpc2msf <input_dir> <output_dir>
//!
//! Recursively converts all .mpc files to MSF v2 format.
//! MSF v2: Rgba8 (4bpp) + zstd compression.
//! Transparency is decoded from the MPC RLE stream directly (no palette index trick).

use rayon::prelude::*;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use walkdir::WalkDir;

mod msf {
    pub const MSF_MAGIC: &[u8; 4] = b"MSF2";
    pub const MSF_VERSION: u16 = 2;
    pub const CHUNK_END: &[u8; 4] = b"END\0";
    const FRAME_ENTRY_SIZE: usize = 16;

    struct FrameEntry {
        offset_x: i16,
        offset_y: i16,
        width: u16,
        height: u16,
        data_offset: u32,
        data_length: u32,
    }

    #[inline]
    fn get_i32_le(data: &[u8], offset: usize) -> i32 {
        if offset + 4 > data.len() {
            return 0;
        }
        i32::from_le_bytes([
            data[offset],
            data[offset + 1],
            data[offset + 2],
            data[offset + 3],
        ])
    }

    #[inline]
    fn get_u32_le(data: &[u8], offset: usize) -> u32 {
        if offset + 4 > data.len() {
            return 0;
        }
        u32::from_le_bytes([
            data[offset],
            data[offset + 1],
            data[offset + 2],
            data[offset + 3],
        ])
    }

    /// Decode SHD RLE into per-frame shadow canvases (RGBA).
    ///
    /// SHD format (Shd.cs):
    /// - No palette; non-skip pixels are Color.Black * 0.6f = [0,0,0,153]
    /// - Skip (byte > 0x80) = N transparent pixels
    /// - Color run (byte <= 0x80) = N shadow pixels — just the count byte, no palette bytes
    /// - Frame offset table starts at byte 128 (same header layout as MPC, no palette)
    fn decode_shd_frames(shd_data: &[u8], frame_count: usize) -> Vec<Vec<u8>> {
        const SHADOW_COLOR: [u8; 4] = [0, 0, 0, 153];
        let mut result: Vec<Vec<u8>> = Vec::with_capacity(frame_count);
        if shd_data.len() < 132 {
            return result;
        }
        let sig = match std::str::from_utf8(&shd_data[0..12]) {
            Ok(s) => s,
            Err(_) => return result,
        };
        if !sig.starts_with("SHD File Ver") {
            return result;
        }
        let offsets_start = 128usize;
        let mut shd_offsets: Vec<usize> = Vec::with_capacity(frame_count);
        for i in 0..frame_count {
            let o = offsets_start + i * 4;
            if o + 4 > shd_data.len() {
                break;
            }
            shd_offsets.push(u32::from_le_bytes([
                shd_data[o],
                shd_data[o + 1],
                shd_data[o + 2],
                shd_data[o + 3],
            ]) as usize);
        }
        let frame_data_start = offsets_start + frame_count * 4;
        for j in 0..frame_count {
            if j >= shd_offsets.len() {
                result.push(Vec::new());
                continue;
            }
            let ds = frame_data_start + shd_offsets[j];
            if ds + 20 > shd_data.len() {
                result.push(Vec::new());
                continue;
            }
            let data_len = u32::from_le_bytes([
                shd_data[ds],
                shd_data[ds + 1],
                shd_data[ds + 2],
                shd_data[ds + 3],
            ]) as usize;
            let width = u32::from_le_bytes([
                shd_data[ds + 4],
                shd_data[ds + 5],
                shd_data[ds + 6],
                shd_data[ds + 7],
            ]) as usize;
            let height = u32::from_le_bytes([
                shd_data[ds + 8],
                shd_data[ds + 9],
                shd_data[ds + 10],
                shd_data[ds + 11],
            ]) as usize;
            if width == 0 || height == 0 || width > 2048 || height > 2048 {
                result.push(Vec::new());
                continue;
            }
            let rle_start = ds + 20;
            let rle_end = if ds + data_len <= shd_data.len() {
                ds + data_len
            } else {
                shd_data.len()
            };
            let total = width * height;
            let mut buf = vec![0u8; total * 4];
            let mut rle_off = rle_start;
            let mut pixel_idx = 0usize;
            while rle_off < rle_end && pixel_idx < total {
                let byte = shd_data[rle_off];
                rle_off += 1;
                if byte > 0x80 {
                    pixel_idx += (byte - 0x80) as usize;
                } else {
                    let count = byte as usize;
                    for _ in 0..count {
                        if pixel_idx >= total {
                            break;
                        }
                        let dst = pixel_idx * 4;
                        buf[dst] = SHADOW_COLOR[0];
                        buf[dst + 1] = SHADOW_COLOR[1];
                        buf[dst + 2] = SHADOW_COLOR[2];
                        buf[dst + 3] = SHADOW_COLOR[3];
                        pixel_idx += 1;
                    }
                }
            }
            result.push(buf);
        }
        result
    }

    /// Decode MPC RLE directly to RGBA pixels.
    ///
    /// MPC transparency is encoded in the RLE stream itself (byte > 0x80 = skip N pixels).
    /// Skipped pixels are transparent (RGBA = [0,0,0,0]).
    /// Color pixels look up the palette (BGRA stored, converted to RGBA, alpha = 255).
    ///
    /// This avoids all palette-index ambiguity and works correctly even when all 256
    /// palette entries are in use (which happens for ~1879 files in resources-sword2).
    fn decode_mpc_rle_to_rgba(
        data: &[u8],
        rle_start: usize,
        rle_end: usize,
        width: usize,
        height: usize,
        palette: &[[u8; 4]],
        shadow: Option<&[u8]>,
        use_palette_alpha: bool,
    ) -> Vec<u8> {
        let total = width * height;
        let mut buf = if let Some(s) = shadow {
            if s.len() >= total * 4 {
                s[..total * 4].to_vec()
            } else {
                let mut b = vec![0u8; total * 4];
                b[..s.len()].copy_from_slice(s);
                b
            }
        } else {
            vec![0u8; total * 4]
        };
        let mut data_offset = rle_start;
        let mut pixel_idx = 0usize;

        while data_offset < rle_end && data_offset < data.len() && pixel_idx < total {
            let byte = data[data_offset];
            data_offset += 1;

            if byte > 0x80 {
                // RLE skip: transparent pixels — keep whatever is in buf (shadow or transparent)
                pixel_idx += (byte - 0x80) as usize;
            } else {
                let count = byte as usize;
                for _ in 0..count {
                    if pixel_idx >= total || data_offset >= data.len() {
                        break;
                    }
                    let idx = data[data_offset] as usize;
                    data_offset += 1;
                    let dst = pixel_idx * 4;
                    if idx < palette.len() {
                        buf[dst] = palette[idx][0];
                        buf[dst + 1] = palette[idx][1];
                        buf[dst + 2] = palette[idx][2];
                        buf[dst + 3] = if use_palette_alpha {
                            palette[idx][3]
                        } else {
                            255
                        };
                    }
                    // idx out of palette range → leave as-is (shadow or transparent)
                    pixel_idx += 1;
                }
            }
        }
        buf
    }

    /// Convert a single MPC file to MSF v2 (Rgba8 + zstd)
    pub fn convert_mpc_to_msf(
        mpc_data: &[u8],
        shd_data: Option<&[u8]>,
        use_palette_alpha: bool,
    ) -> Option<Vec<u8>> {
        if mpc_data.len() < 160 {
            return None;
        }

        let sig = std::str::from_utf8(&mpc_data[0..12]).ok()?;
        if !sig.starts_with("MPC File Ver") {
            return None;
        }

        let off = 64;
        let global_width = get_u32_le(mpc_data, off + 4) as u16;
        let global_height = get_u32_le(mpc_data, off + 8) as u16;
        let frame_count = get_u32_le(mpc_data, off + 12) as u16;
        let direction = get_u32_le(mpc_data, off + 16) as u8;
        let color_count = get_u32_le(mpc_data, off + 20) as usize;
        let interval = get_u32_le(mpc_data, off + 24) as u16;
        let raw_bottom = get_i32_le(mpc_data, off + 28);

        let left = (global_width / 2) as i16;
        let bottom = if global_height >= 16 {
            (global_height as i32 - 16 - raw_bottom) as i16
        } else {
            (16 - global_height as i32 - raw_bottom) as i16
        };

        let fps = if interval > 0 {
            (1000u32 / interval as u32).min(255) as u8
        } else {
            15
        };

        // Build RGBA palette from BGRA stored in file
        let palette_start = 128;
        let mut palette: Vec<[u8; 4]> = Vec::with_capacity(color_count);
        for i in 0..color_count {
            let po = palette_start + i * 4;
            if po + 4 > mpc_data.len() {
                break;
            }
            let b = mpc_data[po];
            let g = mpc_data[po + 1];
            let r = mpc_data[po + 2];
            let a = mpc_data[po + 3]; // Real alpha, not hardcoded 255
            palette.push([r, g, b, a]);
        }

        // Read frame data offsets
        let offsets_start = palette_start + color_count * 4;
        let mut data_offsets: Vec<usize> = Vec::with_capacity(frame_count as usize);
        for i in 0..frame_count as usize {
            let o = offsets_start + i * 4;
            if o + 4 > mpc_data.len() {
                break;
            }
            data_offsets.push(get_u32_le(mpc_data, o) as usize);
        }

        let frame_data_start = offsets_start + frame_count as usize * 4;

        // Decode SHD shadow frames if provided
        let shd_frames = shd_data
            .map(|sd| decode_shd_frames(sd, frame_count as usize))
            .unwrap_or_default();

        // Process frames: decode to RGBA directly
        let mut frame_entries: Vec<FrameEntry> = Vec::with_capacity(frame_count as usize);
        let mut raw_frame_data: Vec<Vec<u8>> = Vec::with_capacity(frame_count as usize);

        for i in 0..frame_count as usize {
            if i >= data_offsets.len() {
                frame_entries.push(FrameEntry {
                    offset_x: 0,
                    offset_y: 0,
                    width: 0,
                    height: 0,
                    data_offset: 0,
                    data_length: 0,
                });
                raw_frame_data.push(Vec::new());
                continue;
            }

            let ds = frame_data_start + data_offsets[i];
            if ds + 12 > mpc_data.len() {
                frame_entries.push(FrameEntry {
                    offset_x: 0,
                    offset_y: 0,
                    width: 0,
                    height: 0,
                    data_offset: 0,
                    data_length: 0,
                });
                raw_frame_data.push(Vec::new());
                continue;
            }

            let data_len = get_u32_le(mpc_data, ds) as usize;
            let width = get_u32_le(mpc_data, ds + 4) as u16;
            let height = get_u32_le(mpc_data, ds + 8) as u16;

            if width == 0 || height == 0 || width > 2048 || height > 2048 {
                frame_entries.push(FrameEntry {
                    offset_x: 0,
                    offset_y: 0,
                    width: 0,
                    height: 0,
                    data_offset: 0,
                    data_length: 0,
                });
                raw_frame_data.push(Vec::new());
                continue;
            }

            let rle_start = ds + 20;
            let rle_end = ds + data_len;
            let shadow = shd_frames
                .get(i)
                .filter(|s| !s.is_empty())
                .map(|s| s.as_slice());
            let rgba = decode_mpc_rle_to_rgba(
                mpc_data,
                rle_start,
                rle_end,
                width as usize,
                height as usize,
                &palette,
                shadow,
                use_palette_alpha,
            );

            frame_entries.push(FrameEntry {
                offset_x: 0,
                offset_y: 0,
                width,
                height,
                data_offset: 0,
                data_length: 0,
            });
            raw_frame_data.push(rgba);
        }

        // Concatenate frame data
        let mut concat_raw = Vec::new();
        for (i, data) in raw_frame_data.iter().enumerate() {
            frame_entries[i].data_offset = concat_raw.len() as u32;
            frame_entries[i].data_length = data.len() as u32;
            concat_raw.extend_from_slice(data);
        }

        // Canvas dimensions = actual frame content size (may exceed global_width/height).
        // global_width is only for anchor computation; canvas must hold all frame pixels.
        let canvas_width = frame_entries
            .iter()
            .filter(|e| e.width > 0)
            .map(|e| (e.offset_x.max(0) as u16).saturating_add(e.width))
            .max()
            .unwrap_or(global_width);
        let canvas_height = frame_entries
            .iter()
            .filter(|e| e.height > 0)
            .map(|e| (e.offset_y.max(0) as u16).saturating_add(e.height))
            .max()
            .unwrap_or(global_height);

        let flags: u16 = 1; // zstd
        let compressed_blob = zstd::bulk::compress(&concat_raw, 3).ok()?;

        // PixelFormat=0 (Rgba8), no palette in MSF header
        let frame_table_bytes = frame_count as usize * FRAME_ENTRY_SIZE;
        let total = 8 + 16 + 4 + frame_table_bytes + 8 + compressed_blob.len();
        let mut out = Vec::with_capacity(total);

        // Preamble
        out.extend_from_slice(MSF_MAGIC);
        out.extend_from_slice(&MSF_VERSION.to_le_bytes());
        out.extend_from_slice(&flags.to_le_bytes());

        // Header
        out.extend_from_slice(&canvas_width.to_le_bytes());
        out.extend_from_slice(&canvas_height.to_le_bytes());
        out.extend_from_slice(&frame_count.to_le_bytes());
        out.push(direction);
        out.push(fps);
        out.extend_from_slice(&left.to_le_bytes());
        out.extend_from_slice(&bottom.to_le_bytes());
        out.extend_from_slice(&[0u8; 4]);

        // Pixel format: Rgba8 (0), palette_size=0, reserved=0
        out.push(0);
        out.extend_from_slice(&0u16.to_le_bytes());
        out.push(0);

        // No palette entries

        // Frame table
        for entry in &frame_entries {
            out.extend_from_slice(&entry.offset_x.to_le_bytes());
            out.extend_from_slice(&entry.offset_y.to_le_bytes());
            out.extend_from_slice(&entry.width.to_le_bytes());
            out.extend_from_slice(&entry.height.to_le_bytes());
            out.extend_from_slice(&entry.data_offset.to_le_bytes());
            out.extend_from_slice(&entry.data_length.to_le_bytes());
        }

        // End sentinel
        out.extend_from_slice(CHUNK_END);
        out.extend_from_slice(&0u32.to_le_bytes());

        // Compressed blob
        out.extend_from_slice(&compressed_blob);

        Some(out)
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("Usage: mpc2msf <input_dir> <output_dir>");
        std::process::exit(1);
    }

    let input_dir = PathBuf::from(&args[1]);
    let output_dir = PathBuf::from(&args[2]);

    if !input_dir.exists() {
        eprintln!("Error: input directory {:?} does not exist", input_dir);
        std::process::exit(1);
    }

    let mpc_files: Vec<PathBuf> = WalkDir::new(&input_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext.eq_ignore_ascii_case("mpc"))
                .unwrap_or(false)
        })
        .map(|e| e.into_path())
        .collect();

    let total = mpc_files.len();
    println!(
        "Found {} MPC files (MSF v2: Rgba8 + zstd, with SHD shadow merge)",
        total
    );

    let converted = AtomicUsize::new(0);
    let failed = AtomicUsize::new(0);
    let total_mpc_bytes = AtomicUsize::new(0);
    let total_msf_bytes = AtomicUsize::new(0);

    mpc_files.par_iter().for_each(|mpc_path| {
        let relative = mpc_path.strip_prefix(&input_dir).unwrap_or(mpc_path);
        let mut msf_relative = relative.to_path_buf();
        msf_relative.set_extension("msf");
        let msf_path = output_dir.join(&msf_relative);

        if let Some(parent) = msf_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        // Check for adjacent .shd file (same stem, same directory)
        let shd_path = mpc_path.with_extension("shd");
        let shd_bytes = std::fs::read(&shd_path).ok();
        let shd_data = shd_bytes.as_deref();

        let path_str = mpc_path.to_string_lossy();
        // Use palette alpha ONLY for specific types that intentionally use it:
        // - magic/ and effect/: semi-transparent particle/glow effects
        // - ui/column/column2: glass highlight overlay effect
        // All other MPC files force alpha=0xFF, matching original engine behavior
        // (TextureBase.cs LoadPalette: Palette[i].A = 0xFF ignores palette alpha byte).
        let path_lower = path_str.to_lowercase();
        let use_palette_alpha = path_lower.contains("/magic/")
            || path_lower.contains("/effect/")
            || path_lower.ends_with("/ui/column/column2.mpc");
        match std::fs::read(mpc_path) {
            Ok(mpc_data) => {
                let mpc_size = mpc_data.len();
                match msf::convert_mpc_to_msf(&mpc_data, shd_data, use_palette_alpha) {
                    Some(msf_data) => {
                        let msf_size = msf_data.len();
                        if std::fs::write(&msf_path, &msf_data).is_ok() {
                            let n = converted.fetch_add(1, Ordering::Relaxed) + 1;
                            total_mpc_bytes.fetch_add(mpc_size, Ordering::Relaxed);
                            total_msf_bytes.fetch_add(msf_size, Ordering::Relaxed);
                            if n % 100 == 0 || n == total {
                                println!("  [{}/{}]", n, total);
                            }
                        } else {
                            failed.fetch_add(1, Ordering::Relaxed);
                        }
                    }
                    None => {
                        eprintln!("  CONVERT ERROR {:?}", mpc_path);
                        failed.fetch_add(1, Ordering::Relaxed);
                    }
                }
            }
            Err(e) => {
                eprintln!("  READ ERROR {:?}: {}", mpc_path, e);
                failed.fetch_add(1, Ordering::Relaxed);
            }
        }
    });

    let c = converted.load(Ordering::Relaxed);
    let f = failed.load(Ordering::Relaxed);
    let mpc_mb = total_mpc_bytes.load(Ordering::Relaxed) as f64 / (1024.0 * 1024.0);
    let msf_mb = total_msf_bytes.load(Ordering::Relaxed) as f64 / (1024.0 * 1024.0);
    let ratio = if mpc_mb > 0.0 {
        msf_mb / mpc_mb * 100.0
    } else {
        0.0
    };

    println!("\n=== Done ===");
    println!("  Converted: {}/{}", c, total);
    println!("  Failed:    {}", f);
    println!(
        "  MPC: {:.1} MB → MSF: {:.1} MB ({:.1}%)",
        mpc_mb, msf_mb, ratio
    );
}

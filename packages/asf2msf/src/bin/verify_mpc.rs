//! Pixel-perfect verification: compare MPC (original) vs MSF (converted) frames
//! Decodes both formats to RGBA and diffs every pixel.
//!
//! Usage: cargo run --release --bin verify_mpc <mpc_dir>
//!
//! For each .mpc file, finds the corresponding .msf (same dir, same stem) and:
//!   1. Decodes MPC → RGBA via RLE + palette lookup
//!   2. Decodes MSF → RGBA via Indexed8 + palette lookup
//!   3. Compares every pixel per-frame — any difference is a failure

use rayon::prelude::*;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use walkdir::WalkDir;

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

/// Decode MPC file → per-frame RGBA at each frame's own dimensions
/// Returns: Vec of (width, height, rgba_pixels)
fn decode_mpc_to_rgba(data: &[u8]) -> Option<Vec<(u16, u16, Vec<u8>)>> {
    if data.len() < 160 {
        return None;
    }
    let sig = std::str::from_utf8(&data[0..12]).ok()?;
    if !sig.starts_with("MPC File Ver") {
        return None;
    }

    let off = 64;
    let frame_count = get_u32_le(data, off + 12) as usize;
    let color_count = get_u32_le(data, off + 20) as usize;

    // Read palette (BGRA → RGBA)
    let palette_start = 128;
    let mut palette = [[0u8; 4]; 256];
    for i in 0..color_count.min(256) {
        let po = palette_start + i * 4;
        if po + 4 > data.len() {
            break;
        }
        palette[i] = [data[po + 2], data[po + 1], data[po], 255]; // BGRA → RGBA
    }

    // Frame offsets
    let offsets_start = palette_start + color_count * 4;
    let mut data_offsets = Vec::with_capacity(frame_count);
    for i in 0..frame_count {
        let o = offsets_start + i * 4;
        data_offsets.push(get_u32_le(data, o) as usize);
    }

    let frame_data_start = offsets_start + frame_count * 4;

    let mut frames = Vec::with_capacity(frame_count);
    for i in 0..frame_count {
        if i >= data_offsets.len() {
            frames.push((1u16, 1u16, vec![0u8; 4]));
            continue;
        }

        let ds = frame_data_start + data_offsets[i];
        if ds + 12 > data.len() {
            frames.push((1, 1, vec![0u8; 4]));
            continue;
        }

        let data_len = get_u32_le(data, ds) as usize;
        let width = get_u32_le(data, ds + 4) as u16;
        let height = get_u32_le(data, ds + 8) as u16;

        if width == 0 || height == 0 {
            frames.push((1, 1, vec![0u8; 4]));
            continue;
        }

        let w = width as usize;
        let h = height as usize;
        let total = w * h;
        let mut pixels = vec![0u8; total * 4]; // transparent black

        let rle_start = ds + 20; // dataLen(4)+width(4)+height(4)+reserved(8)
        let rle_end = (ds + data_len).min(data.len());
        let mut data_offset = rle_start;
        let mut pixel_idx = 0usize;

        while data_offset < rle_end && pixel_idx < total {
            if data_offset >= data.len() {
                break;
            }
            let byte = data[data_offset];
            data_offset += 1;

            if byte > 0x80 {
                // Transparent pixels
                let count = (byte - 0x80) as usize;
                pixel_idx += count;
            } else {
                // Colored pixels
                let count = byte as usize;
                for _ in 0..count {
                    if pixel_idx >= total || data_offset >= data.len() {
                        break;
                    }
                    let ci = data[data_offset] as usize;
                    data_offset += 1;
                    let dst = pixel_idx * 4;
                    if ci < 256 {
                        pixels[dst] = palette[ci][0];
                        pixels[dst + 1] = palette[ci][1];
                        pixels[dst + 2] = palette[ci][2];
                        pixels[dst + 3] = palette[ci][3];
                    }
                    pixel_idx += 1;
                }
            }
        }

        frames.push((width, height, pixels));
    }

    Some(frames)
}

/// Decode MSF file → per-frame RGBA at each frame's own dimensions (individual frame mode)
fn decode_msf_individual_to_rgba(data: &[u8]) -> Option<Vec<(u16, u16, Vec<u8>)>> {
    if data.len() < 28 || &data[0..4] != b"MSF1" {
        return None;
    }

    let flags = u16::from_le_bytes([data[6], data[7]]);
    let off = 8;
    let frame_count = u16::from_le_bytes([data[off + 4], data[off + 5]]) as usize;

    let pf_off = 24;
    let pixel_format = data[pf_off];
    let palette_size = u16::from_le_bytes([data[pf_off + 1], data[pf_off + 2]]) as usize;

    // Read palette
    let mut palette = [[0u8; 4]; 256];
    let palette_start = 28;
    for i in 0..palette_size.min(256) {
        let po = palette_start + i * 4;
        if po + 4 > data.len() {
            break;
        }
        palette[i] = [data[po], data[po + 1], data[po + 2], data[po + 3]];
    }

    // Frame table
    let frame_table_start = palette_start + palette_size * 4;
    let frame_entry_size = 16;

    struct FE {
        width: u16,
        height: u16,
        data_offset: u32,
        _data_length: u32,
    }
    let mut entries = Vec::with_capacity(frame_count);
    let mut ft_off = frame_table_start;
    for _ in 0..frame_count {
        if ft_off + frame_entry_size > data.len() {
            break;
        }
        entries.push(FE {
            width: u16::from_le_bytes([data[ft_off + 4], data[ft_off + 5]]),
            height: u16::from_le_bytes([data[ft_off + 6], data[ft_off + 7]]),
            data_offset: u32::from_le_bytes([
                data[ft_off + 8],
                data[ft_off + 9],
                data[ft_off + 10],
                data[ft_off + 11],
            ]),
            _data_length: u32::from_le_bytes([
                data[ft_off + 12],
                data[ft_off + 13],
                data[ft_off + 14],
                data[ft_off + 15],
            ]),
        });
        ft_off += frame_entry_size;
    }

    // Skip extensions
    let mut ext_off = ft_off;
    loop {
        if ext_off + 8 > data.len() {
            return None;
        }
        let chunk_id = &data[ext_off..ext_off + 4];
        let chunk_len = u32::from_le_bytes([
            data[ext_off + 4],
            data[ext_off + 5],
            data[ext_off + 6],
            data[ext_off + 7],
        ]) as usize;
        ext_off += 8;
        if chunk_id == b"END\0" {
            break;
        }
        ext_off += chunk_len;
    }

    // Decompress blob
    let is_compressed = (flags & 1) != 0;
    let decompressed_buf: Vec<u8>;
    let blob: &[u8] = if is_compressed {
        decompressed_buf = zstd::bulk::decompress(&data[ext_off..], 256 * 1024 * 1024).ok()?;
        &decompressed_buf
    } else {
        &data[ext_off..]
    };

    let mut frames = Vec::with_capacity(frame_count);
    for entry in &entries {
        let fw = entry.width as usize;
        let fh = entry.height as usize;
        if fw == 0 || fh == 0 {
            frames.push((1u16, 1u16, vec![0u8; 4]));
            continue;
        }

        let total = fw * fh;
        let mut pixels = vec![0u8; total * 4];
        let blob_off = entry.data_offset as usize;

        match pixel_format {
            1 => {
                // Indexed8 — 1 byte per pixel
                for p in 0..total {
                    let src = blob_off + p;
                    if src >= blob.len() {
                        break;
                    }
                    let ci = blob[src] as usize;
                    let dst = p * 4;
                    if palette[ci][3] > 0 {
                        pixels[dst] = palette[ci][0];
                        pixels[dst + 1] = palette[ci][1];
                        pixels[dst + 2] = palette[ci][2];
                        pixels[dst + 3] = palette[ci][3];
                    }
                }
            }
            2 => {
                // Indexed8Alpha8 — 2 bytes per pixel
                for p in 0..total {
                    let src = blob_off + p * 2;
                    if src + 1 >= blob.len() {
                        break;
                    }
                    let ci = blob[src] as usize;
                    let alpha = blob[src + 1];
                    if alpha == 0 {
                        continue;
                    }
                    let dst = p * 4;
                    pixels[dst] = palette[ci][0];
                    pixels[dst + 1] = palette[ci][1];
                    pixels[dst + 2] = palette[ci][2];
                    pixels[dst + 3] = alpha;
                }
            }
            _ => {
                return None;
            }
        }

        frames.push((entry.width, entry.height, pixels));
    }

    Some(frames)
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: verify_mpc <mpc_dir>");
        eprintln!("  Verifies MPC↔MSF pixel-perfect conversion for all .mpc files");
        std::process::exit(1);
    }

    let dir = PathBuf::from(&args[1]);
    if !dir.exists() {
        eprintln!("Error: directory {:?} does not exist", dir);
        std::process::exit(1);
    }

    let mpc_files: Vec<PathBuf> = WalkDir::new(&dir)
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
    println!("Verifying {} MPC↔MSF file pairs...", total);

    let passed = AtomicUsize::new(0);
    let failed = AtomicUsize::new(0);
    let skipped = AtomicUsize::new(0);
    let total_pixels = AtomicU64::new(0);
    let total_diff_pixels = AtomicU64::new(0);

    mpc_files.par_iter().for_each(|mpc_path| {
        let msf_path = mpc_path.with_extension("msf");
        if !msf_path.exists() {
            skipped.fetch_add(1, Ordering::Relaxed);
            return;
        }

        let mpc_data = match std::fs::read(mpc_path) {
            Ok(d) => d,
            Err(_) => {
                eprintln!("  READ ERROR: {:?}", mpc_path);
                failed.fetch_add(1, Ordering::Relaxed);
                return;
            }
        };
        let msf_data = match std::fs::read(&msf_path) {
            Ok(d) => d,
            Err(_) => {
                eprintln!("  READ ERROR: {:?}", msf_path);
                failed.fetch_add(1, Ordering::Relaxed);
                return;
            }
        };

        let mpc_frames = match decode_mpc_to_rgba(&mpc_data) {
            Some(f) => f,
            None => {
                eprintln!("  MPC DECODE ERROR: {:?}", mpc_path);
                failed.fetch_add(1, Ordering::Relaxed);
                return;
            }
        };
        let msf_frames = match decode_msf_individual_to_rgba(&msf_data) {
            Some(f) => f,
            None => {
                eprintln!("  MSF DECODE ERROR: {:?}", msf_path);
                failed.fetch_add(1, Ordering::Relaxed);
                return;
            }
        };

        if mpc_frames.len() != msf_frames.len() {
            eprintln!(
                "  FRAME COUNT MISMATCH: {:?} (MPC={}, MSF={})",
                mpc_path,
                mpc_frames.len(),
                msf_frames.len()
            );
            failed.fetch_add(1, Ordering::Relaxed);
            return;
        }

        let mut file_pixels = 0u64;
        let mut file_diff = 0u64;
        let mut file_ok = true;

        for (fi, (mpc_f, msf_f)) in mpc_frames.iter().zip(msf_frames.iter()).enumerate() {
            let (mw, mh, ref mpc_px) = mpc_f;
            let (sw, sh, ref msf_px) = msf_f;

            if mw != sw || mh != sh {
                eprintln!(
                    "  SIZE MISMATCH frame {}: {:?} MPC={}x{} MSF={}x{}",
                    fi, mpc_path, mw, mh, sw, sh
                );
                file_ok = false;
                break;
            }

            let pixel_count = (*mw as u64) * (*mh as u64);
            file_pixels += pixel_count;

            let min_len = mpc_px.len().min(msf_px.len());
            for byte_idx in (0..min_len).step_by(4) {
                if mpc_px[byte_idx] != msf_px[byte_idx]
                    || mpc_px[byte_idx + 1] != msf_px[byte_idx + 1]
                    || mpc_px[byte_idx + 2] != msf_px[byte_idx + 2]
                    || mpc_px[byte_idx + 3] != msf_px[byte_idx + 3]
                {
                    file_diff += 1;
                    if file_diff <= 3 {
                        let px = byte_idx / 4;
                        eprintln!(
                            "  DIFF {:?} frame {} pixel {}: MPC=[{},{},{},{}] MSF=[{},{},{},{}]",
                            mpc_path,
                            fi,
                            px,
                            mpc_px[byte_idx],
                            mpc_px[byte_idx + 1],
                            mpc_px[byte_idx + 2],
                            mpc_px[byte_idx + 3],
                            msf_px[byte_idx],
                            msf_px[byte_idx + 1],
                            msf_px[byte_idx + 2],
                            msf_px[byte_idx + 3],
                        );
                    }
                }
            }
        }

        total_pixels.fetch_add(file_pixels, Ordering::Relaxed);
        total_diff_pixels.fetch_add(file_diff, Ordering::Relaxed);

        if file_ok && file_diff == 0 {
            let n = passed.fetch_add(1, Ordering::Relaxed) + 1;
            if n % 500 == 0 || n == total {
                println!("  [{}/{}] verified OK", n, total);
            }
        } else {
            if file_diff > 0 {
                eprintln!(
                    "  PIXEL DIFF: {:?} — {} different pixels",
                    mpc_path, file_diff
                );
            }
            failed.fetch_add(1, Ordering::Relaxed);
        }
    });

    let p = passed.load(Ordering::Relaxed);
    let f = failed.load(Ordering::Relaxed);
    let s = skipped.load(Ordering::Relaxed);
    let tp = total_pixels.load(Ordering::Relaxed);
    let td = total_diff_pixels.load(Ordering::Relaxed);

    println!();
    println!("=== Verification Complete ===");
    println!("  Passed:  {}/{}", p, total);
    println!("  Failed:  {}", f);
    println!("  Skipped: {} (no .msf found)", s);
    println!(
        "  Total pixels compared: {:.2}B",
        tp as f64 / 1_000_000_000.0
    );
    println!("  Different pixels:     {}", td);
    if f > 0 || td > 0 {
        std::process::exit(1);
    }
}

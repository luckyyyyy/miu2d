//! Pixel-perfect verification: compare ASF (original) vs MSF (converted) frames
//! Decodes both formats to RGBA and diffs every pixel.
//!
//! Usage: cargo run --release --bin verify <asf_dir>
//!
//! For each .asf file, finds the corresponding .msf (same dir, same stem) and:
//!   1. Decodes ASF → RGBA via RLE
//!   2. Decodes MSF → RGBA via Indexed8Alpha8 + palette lookup
//!   3. Compares every pixel — any difference is a failure

use rayon::prelude::*;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use walkdir::WalkDir;

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

/// Decode ASF file to full RGBA frames (exactly matching the WASM ASF decoder)
fn decode_asf_to_rgba(asf_data: &[u8]) -> Option<(u16, u16, u16, Vec<Vec<u8>>)> {
    if asf_data.len() < 80 {
        return None;
    }
    let sig = std::str::from_utf8(&asf_data[0..7]).ok()?;
    if sig != "ASF 1.0" {
        return None;
    }

    let mut offset = 16;
    let width = get_i32_le(asf_data, offset) as u16;
    offset += 4;
    let height = get_i32_le(asf_data, offset) as u16;
    offset += 4;
    let frame_count = get_i32_le(asf_data, offset) as u16;
    offset += 4;
    offset += 4; // directions
    let color_count = get_i32_le(asf_data, offset) as usize;
    offset += 4;
    offset += 4 + 4 + 4 + 16; // interval, left, bottom, reserved

    // Read palette (BGRA → RGBA, alpha=255)
    let mut palette = [[0u8; 4]; 256];
    for i in 0..color_count.min(256) {
        if offset + 4 > asf_data.len() {
            break;
        }
        let b = asf_data[offset];
        let g = asf_data[offset + 1];
        let r = asf_data[offset + 2];
        offset += 4;
        palette[i] = [r, g, b, 255];
    }

    // Frame offsets + lengths
    let mut frame_offsets = Vec::with_capacity(frame_count as usize);
    let mut frame_lengths = Vec::with_capacity(frame_count as usize);
    for _ in 0..frame_count {
        if offset + 8 > asf_data.len() {
            break;
        }
        frame_offsets.push(get_i32_le(asf_data, offset) as usize);
        offset += 4;
        frame_lengths.push(get_i32_le(asf_data, offset) as usize);
        offset += 4;
    }

    let w = width as usize;
    let h = height as usize;
    let mut frames = Vec::with_capacity(frame_count as usize);

    for i in 0..frame_count as usize {
        let mut pixels = vec![0u8; w * h * 4];
        if i < frame_offsets.len() {
            let data_end = frame_offsets[i] + frame_lengths[i];
            let mut data_offset = frame_offsets[i];
            let max_pixels = w * h * 4;
            let mut pixel_idx = 0usize;

            while data_offset < data_end
                && data_offset + 1 < asf_data.len()
                && pixel_idx < max_pixels
            {
                let pixel_count = asf_data[data_offset] as usize;
                let pixel_alpha = asf_data[data_offset + 1];
                data_offset += 2;

                for _ in 0..pixel_count {
                    if pixel_idx >= max_pixels {
                        break;
                    }
                    if pixel_alpha == 0 {
                        pixel_idx += 4;
                    } else if data_offset < asf_data.len() {
                        let color_index = asf_data[data_offset] as usize;
                        data_offset += 1;
                        if color_index < 256 {
                            pixels[pixel_idx] = palette[color_index][0];
                            pixels[pixel_idx + 1] = palette[color_index][1];
                            pixels[pixel_idx + 2] = palette[color_index][2];
                            pixels[pixel_idx + 3] = pixel_alpha;
                        }
                        pixel_idx += 4;
                    }
                }
            }
        }
        frames.push(pixels);
    }

    Some((width, height, frame_count, frames))
}

/// Decode MSF file to full RGBA frames (exactly matching the WASM MSF decoder)
fn decode_msf_to_rgba(msf_data: &[u8]) -> Option<(u16, u16, u16, Vec<Vec<u8>>)> {
    if msf_data.len() < 28 {
        return None;
    }
    if &msf_data[0..4] != b"MSF1" {
        return None;
    }

    let flags = u16::from_le_bytes([msf_data[6], msf_data[7]]);

    let off = 8;
    let canvas_width = u16::from_le_bytes([msf_data[off], msf_data[off + 1]]);
    let canvas_height = u16::from_le_bytes([msf_data[off + 2], msf_data[off + 3]]);
    let frame_count = u16::from_le_bytes([msf_data[off + 4], msf_data[off + 5]]);

    let pf_off = 24;
    let pixel_format = msf_data[pf_off];
    let palette_size = u16::from_le_bytes([msf_data[pf_off + 1], msf_data[pf_off + 2]]) as usize;

    // Read palette
    let mut palette = [[0u8; 4]; 256];
    let palette_start = 28;
    for i in 0..palette_size.min(256) {
        let po = palette_start + i * 4;
        if po + 4 > msf_data.len() {
            break;
        }
        palette[i] = [
            msf_data[po],
            msf_data[po + 1],
            msf_data[po + 2],
            msf_data[po + 3],
        ];
    }

    // Frame table
    let frame_table_start = palette_start + palette_size * 4;
    let frame_entry_size = 16;
    if frame_table_start + frame_count as usize * frame_entry_size > msf_data.len() {
        return None;
    }

    struct FrameEntry {
        offset_x: i16,
        offset_y: i16,
        width: u16,
        height: u16,
        data_offset: u32,
        data_length: u32,
    }
    let mut entries = Vec::with_capacity(frame_count as usize);
    let mut ft_off = frame_table_start;
    for _ in 0..frame_count {
        entries.push(FrameEntry {
            offset_x: i16::from_le_bytes([msf_data[ft_off], msf_data[ft_off + 1]]),
            offset_y: i16::from_le_bytes([msf_data[ft_off + 2], msf_data[ft_off + 3]]),
            width: u16::from_le_bytes([msf_data[ft_off + 4], msf_data[ft_off + 5]]),
            height: u16::from_le_bytes([msf_data[ft_off + 6], msf_data[ft_off + 7]]),
            data_offset: u32::from_le_bytes([
                msf_data[ft_off + 8],
                msf_data[ft_off + 9],
                msf_data[ft_off + 10],
                msf_data[ft_off + 11],
            ]),
            data_length: u32::from_le_bytes([
                msf_data[ft_off + 12],
                msf_data[ft_off + 13],
                msf_data[ft_off + 14],
                msf_data[ft_off + 15],
            ]),
        });
        ft_off += frame_entry_size;
    }

    // Skip extension chunks until END
    let mut ext_off = ft_off;
    loop {
        if ext_off + 8 > msf_data.len() {
            return None;
        }
        let chunk_id = &msf_data[ext_off..ext_off + 4];
        let chunk_len = u32::from_le_bytes([
            msf_data[ext_off + 4],
            msf_data[ext_off + 5],
            msf_data[ext_off + 6],
            msf_data[ext_off + 7],
        ]) as usize;
        ext_off += 8;
        if chunk_id == b"END\0" {
            break;
        }
        ext_off += chunk_len;
    }

    // Decompress if zstd-compressed (flags bit 0)
    let is_compressed = (flags & 1) != 0;
    let decompressed_buf: Vec<u8>;
    let blob: &[u8] = if is_compressed {
        let compressed = &msf_data[ext_off..];
        decompressed_buf = zstd::bulk::decompress(compressed, 256 * 1024 * 1024).ok()?;
        &decompressed_buf
    } else {
        &msf_data[ext_off..]
    };
    let cw = canvas_width as usize;
    let ch = canvas_height as usize;
    let frame_size = cw * ch * 4;

    let mut frames = Vec::with_capacity(frame_count as usize);
    for entry in &entries {
        let mut pixels = vec![0u8; frame_size];
        if entry.width == 0 || entry.height == 0 {
            frames.push(pixels);
            continue;
        }

        let fw = entry.width as usize;
        let fh = entry.height as usize;
        let ox = entry.offset_x as usize;
        let oy = entry.offset_y as usize;
        let blob_off = entry.data_offset as usize;

        match pixel_format {
            2 => {
                // Indexed8Alpha8 — 2 bytes per pixel (index, alpha)
                for y in 0..fh {
                    for x in 0..fw {
                        let src_idx = blob_off + (y * fw + x) * 2;
                        if src_idx + 1 >= blob.len() {
                            continue;
                        }
                        let color_idx = blob[src_idx] as usize;
                        let alpha = blob[src_idx + 1];
                        if alpha == 0 {
                            continue;
                        }
                        let dst_idx = ((oy + y) * cw + ox + x) * 4;
                        if dst_idx + 4 <= pixels.len() && color_idx < 256 {
                            let c = &palette[color_idx];
                            pixels[dst_idx] = c[0];
                            pixels[dst_idx + 1] = c[1];
                            pixels[dst_idx + 2] = c[2];
                            pixels[dst_idx + 3] = alpha;
                        }
                    }
                }
            }
            1 => {
                // Indexed8 — 1 byte per pixel (index)
                for y in 0..fh {
                    for x in 0..fw {
                        let src_idx = blob_off + y * fw + x;
                        if src_idx >= blob.len() {
                            continue;
                        }
                        let color_idx = blob[src_idx] as usize;
                        let dst_idx = ((oy + y) * cw + ox + x) * 4;
                        if dst_idx + 4 <= pixels.len() && color_idx < 256 {
                            let c = &palette[color_idx];
                            if c[3] > 0 {
                                pixels[dst_idx] = c[0];
                                pixels[dst_idx + 1] = c[1];
                                pixels[dst_idx + 2] = c[2];
                                pixels[dst_idx + 3] = c[3];
                            }
                        }
                    }
                }
            }
            _ => {
                // RGBA8 or unknown
                for y in 0..fh {
                    let src_row = blob_off + y * fw * 4;
                    let dst_row = ((oy + y) * cw + ox) * 4;
                    let len = fw * 4;
                    if src_row + len <= blob.len() && dst_row + len <= pixels.len() {
                        pixels[dst_row..dst_row + len]
                            .copy_from_slice(&blob[src_row..src_row + len]);
                    }
                }
            }
        }
        frames.push(pixels);
    }

    Some((canvas_width, canvas_height, frame_count, frames))
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: verify <asf_dir>");
        eprintln!("  Verifies pixel-perfect match between .asf and .msf files");
        std::process::exit(1);
    }

    let input_dir = PathBuf::from(&args[1]);
    let asf_files: Vec<PathBuf> = WalkDir::new(&input_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext.eq_ignore_ascii_case("asf"))
                .unwrap_or(false)
        })
        .map(|e| e.into_path())
        .collect();

    println!("Verifying {} ASF/MSF pairs...\n", asf_files.len());

    let perfect = AtomicUsize::new(0);
    let failed = AtomicUsize::new(0);
    let skipped = AtomicUsize::new(0);
    let total_pixels = AtomicUsize::new(0);
    let diff_pixels = AtomicUsize::new(0);

    asf_files.par_iter().for_each(|asf_path| {
        let msf_path = asf_path.with_extension("msf");
        if !msf_path.exists() {
            skipped.fetch_add(1, Ordering::Relaxed);
            return;
        }

        let asf_data = match std::fs::read(asf_path) {
            Ok(d) => d,
            Err(_) => {
                skipped.fetch_add(1, Ordering::Relaxed);
                return;
            }
        };
        let msf_data = match std::fs::read(&msf_path) {
            Ok(d) => d,
            Err(_) => {
                skipped.fetch_add(1, Ordering::Relaxed);
                return;
            }
        };

        let asf_decoded = match decode_asf_to_rgba(&asf_data) {
            Some(d) => d,
            None => {
                skipped.fetch_add(1, Ordering::Relaxed);
                return;
            }
        };
        let msf_decoded = match decode_msf_to_rgba(&msf_data) {
            Some(d) => d,
            None => {
                failed.fetch_add(1, Ordering::Relaxed);
                eprintln!("  FAIL decode MSF: {:?}", msf_path);
                return;
            }
        };

        let (asf_w, asf_h, asf_fc, asf_frames) = asf_decoded;
        let (msf_w, msf_h, msf_fc, msf_frames) = msf_decoded;

        // Check dimensions match
        if asf_w != msf_w || asf_h != msf_h || asf_fc != msf_fc {
            eprintln!(
                "  FAIL metadata mismatch: {:?} ASF={}x{}x{} MSF={}x{}x{}",
                asf_path.strip_prefix(&input_dir).unwrap_or(asf_path),
                asf_w,
                asf_h,
                asf_fc,
                msf_w,
                msf_h,
                msf_fc
            );
            failed.fetch_add(1, Ordering::Relaxed);
            return;
        }

        // Compare every pixel in every frame
        let mut file_diff_count = 0usize;
        let mut file_total = 0usize;
        let mut first_diff_frame = None;
        let mut first_diff_pos = (0, 0);

        for f in 0..asf_fc as usize {
            let asf_pixels = &asf_frames[f];
            let msf_pixels = &msf_frames[f];

            let w = asf_w as usize;
            let h = asf_h as usize;
            file_total += w * h;

            for y in 0..h {
                for x in 0..w {
                    let idx = (y * w + x) * 4;
                    if idx + 3 >= asf_pixels.len() || idx + 3 >= msf_pixels.len() {
                        continue;
                    }
                    let ar = asf_pixels[idx];
                    let ag = asf_pixels[idx + 1];
                    let ab = asf_pixels[idx + 2];
                    let aa = asf_pixels[idx + 3];
                    let mr = msf_pixels[idx];
                    let mg = msf_pixels[idx + 1];
                    let mb = msf_pixels[idx + 2];
                    let ma = msf_pixels[idx + 3];
                    if ar != mr || ag != mg || ab != mb || aa != ma {
                        if first_diff_frame.is_none() {
                            first_diff_frame = Some(f);
                            first_diff_pos = (x, y);
                        }
                        file_diff_count += 1;
                    }
                }
            }
        }

        total_pixels.fetch_add(file_total, Ordering::Relaxed);
        diff_pixels.fetch_add(file_diff_count, Ordering::Relaxed);

        if file_diff_count > 0 {
            let rel = asf_path.strip_prefix(&input_dir).unwrap_or(asf_path);
            eprintln!(
                "  DIFF {:60} frames={} diff_pixels={}/{} first=frame{} ({},{})",
                rel.display(),
                asf_fc,
                file_diff_count,
                file_total,
                first_diff_frame.unwrap_or(0),
                first_diff_pos.0,
                first_diff_pos.1
            );
            failed.fetch_add(1, Ordering::Relaxed);
        } else {
            let n = perfect.fetch_add(1, Ordering::Relaxed) + 1;
            if n % 200 == 0 {
                println!("  [{} verified]", n);
            }
        }
    });

    let p = perfect.load(Ordering::Relaxed);
    let f = failed.load(Ordering::Relaxed);
    let s = skipped.load(Ordering::Relaxed);
    let tp = total_pixels.load(Ordering::Relaxed);
    let dp = diff_pixels.load(Ordering::Relaxed);

    println!("\n=== Verification Complete ===");
    println!("  Perfect match: {}", p);
    println!("  Different:     {}", f);
    println!("  Skipped:       {}", s);
    println!("  Total pixels:  {}", tp);
    println!("  Diff pixels:   {}", dp);
    if tp > 0 {
        println!(
            "  Accuracy:      {:.6}%",
            (tp - dp) as f64 / tp as f64 * 100.0
        );
    }
    if f == 0 && s == 0 {
        println!("\n  ✅ ALL {} FILES PIXEL-PERFECT!", p);
    } else if f == 0 {
        println!(
            "\n  ✅ All verified files are pixel-perfect ({} skipped)",
            s
        );
    } else {
        println!("\n  ❌ {} FILES WITH DIFFERENCES", f);
    }
}

//! MSF (Miu Sprite Format) v1 - 高性能精灵动画格式
//!
//! 设计目标：小体积、快解码、可扩展、Web 原生
//!
//! 格式布局：
//! ```text
//! [Magic "MSF1" (4)] [Version u16] [Flags u16]           = 8 bytes
//! [Header: canvas W/H, frameCount, dirs, fps, anchor...]  = 16 bytes
//! [PixelFormat u8] [PaletteSize u16] [Reserved u8]        = 4 bytes
//! [Palette (if indexed): RGBA × paletteSize]              = paletteSize * 4 bytes
//! [Frame Table: frameCount × MsfFrameEntry]               = frameCount * 16 bytes
//! [Extension Chunks: ChunkID(4) + Len(4) + Data...]       = variable
//! [Sentinel "END\0" (4) + 0u32 (4)]                      = 8 bytes
//! [Uncompressed Frame Data Blob]                          = variable
//! ```
//!
//! Per-frame tight bounding box 大幅减少存储量
//! Indexed8Alpha8 格式保留 per-pixel alpha（完整无损还原 ASF RLE）
//! HTTP 传输时由 brotli/gzip 压缩

use js_sys::Uint8Array;
use wasm_bindgen::prelude::*;

// ============================================================================
// Zstd decompression (pure Rust via ruzstd, works in WASM)
// ============================================================================

fn zstd_decompress(data: &[u8]) -> Option<Vec<u8>> {
    use ruzstd::StreamingDecoder;
    use std::io::Read;
    let mut decoder = StreamingDecoder::new(data).ok()?;
    let mut buf = Vec::new();
    decoder.read_to_end(&mut buf).ok()?;
    Some(buf)
}

// ============================================================================
// Constants
// ============================================================================

const MSF_MAGIC: &[u8; 4] = b"MSF1";
const MSF_VERSION: u16 = 1;
const CHUNK_END: &[u8; 4] = b"END\0";

/// 像素格式
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum PixelFormat {
    /// RGBA 8888 - 每像素 4 字节
    Rgba8 = 0,
    /// 索引色 - 每像素 1 字节 + 调色板 (不保留 per-pixel alpha)
    Indexed8 = 1,
    /// 索引色 + Alpha - 每像素 2 字节 (index, alpha) + 调色板
    /// 完整保留 ASF RLE 中的 per-pixel alpha
    Indexed8Alpha8 = 2,
}

impl PixelFormat {
    fn from_u8(v: u8) -> Option<Self> {
        match v {
            0 => Some(Self::Rgba8),
            1 => Some(Self::Indexed8),
            2 => Some(Self::Indexed8Alpha8),
            _ => None,
        }
    }

    pub fn bytes_per_pixel(self) -> usize {
        match self {
            Self::Rgba8 => 4,
            Self::Indexed8 => 1,
            Self::Indexed8Alpha8 => 2,
        }
    }
}

// ============================================================================
// MSF Header (returned to JS)
// ============================================================================

#[wasm_bindgen(getter_with_clone)]
#[derive(Clone, Debug)]
pub struct MsfHeader {
    pub canvas_width: u16,
    pub canvas_height: u16,
    pub frame_count: u16,
    pub directions: u8,
    pub fps: u8,
    pub anchor_x: i16,
    pub anchor_y: i16,
    pub pixel_format: u8,
    pub palette_size: u16,
    pub frames_per_direction: u16,
    /// Total RGBA bytes for all frames when decoded individually
    /// (sum of width*height*4 per frame, with empty frames counted as 1×1)
    pub total_individual_pixel_bytes: u32,
}

// ============================================================================
// Frame entry in the frame table
// ============================================================================

#[derive(Clone, Debug)]
pub struct MsfFrameEntry {
    pub offset_x: i16,
    pub offset_y: i16,
    pub width: u16,
    pub height: u16,
    pub data_offset: u32,
    pub data_length: u32,
}

const FRAME_ENTRY_SIZE: usize = 16; // 2+2+2+2+4+4

// ============================================================================
// Encoding (ASF → MSF) - used by CLI tool, not exported to WASM
// ============================================================================

/// Intermediate representation for encoding
pub struct MsfEncodeInput {
    pub canvas_width: u16,
    pub canvas_height: u16,
    pub frame_count: u16,
    pub directions: u8,
    pub fps: u8,
    pub anchor_x: i16,
    pub anchor_y: i16,
    pub pixel_format: PixelFormat,
    pub palette: Vec<[u8; 4]>, // RGBA
    /// Per-frame RGBA pixel data (canvas_width × canvas_height × 4 each)
    pub frame_pixels: Vec<Vec<u8>>,
}

/// Compute tight bounding box for a frame's non-transparent pixels
fn compute_tight_bbox(pixels: &[u8], width: usize, height: usize) -> (i16, i16, u16, u16) {
    let mut min_x = width;
    let mut min_y = height;
    let mut max_x: usize = 0;
    let mut max_y: usize = 0;
    let mut has_content = false;

    for y in 0..height {
        for x in 0..width {
            let idx = (y * width + x) * 4;
            if idx + 3 < pixels.len() && pixels[idx + 3] > 0 {
                has_content = true;
                if x < min_x {
                    min_x = x;
                }
                if x > max_x {
                    max_x = x;
                }
                if y < min_y {
                    min_y = y;
                }
                if y > max_y {
                    max_y = y;
                }
            }
        }
    }

    if !has_content {
        return (0, 0, 0, 0);
    }

    let w = (max_x - min_x + 1) as u16;
    let h = (max_y - min_y + 1) as u16;
    (min_x as i16, min_y as i16, w, h)
}

/// Extract tight bbox pixels from full-size frame
fn extract_bbox_pixels(
    pixels: &[u8],
    full_width: usize,
    ox: usize,
    oy: usize,
    w: usize,
    h: usize,
) -> Vec<u8> {
    let mut out = Vec::with_capacity(w * h * 4);
    for y in oy..oy + h {
        let start = (y * full_width + ox) * 4;
        let end = start + w * 4;
        if end <= pixels.len() {
            out.extend_from_slice(&pixels[start..end]);
        } else {
            out.resize(out.len() + w * 4, 0);
        }
    }
    out
}

/// Convert RGBA pixels to indexed using the given palette
fn rgba_to_indexed(pixels: &[u8], palette: &[[u8; 4]]) -> Vec<u8> {
    let pixel_count = pixels.len() / 4;
    let mut indexed = Vec::with_capacity(pixel_count);

    for i in 0..pixel_count {
        let r = pixels[i * 4];
        let g = pixels[i * 4 + 1];
        let b = pixels[i * 4 + 2];
        let a = pixels[i * 4 + 3];

        if a == 0 {
            indexed.push(0); // transparent → index 0
        } else {
            // Find closest palette entry
            let mut best_idx = 0u8;
            let mut best_dist = u32::MAX;
            for (j, entry) in palette.iter().enumerate() {
                let dr = (r as i32 - entry[0] as i32).unsigned_abs();
                let dg = (g as i32 - entry[1] as i32).unsigned_abs();
                let db = (b as i32 - entry[2] as i32).unsigned_abs();
                let dist = dr + dg + db;
                if dist < best_dist {
                    best_dist = dist;
                    best_idx = j as u8;
                    if dist == 0 {
                        break;
                    }
                }
            }
            indexed.push(best_idx);
        }
    }
    indexed
}

/// Convert RGBA pixels to indexed+alpha (2 bytes per pixel: index, alpha)
/// Preserves per-pixel alpha from ASF RLE stream — lossless for indexed-color sprites
fn rgba_to_indexed_alpha(pixels: &[u8], palette: &[[u8; 4]]) -> Vec<u8> {
    let pixel_count = pixels.len() / 4;
    let mut data = Vec::with_capacity(pixel_count * 2);

    for i in 0..pixel_count {
        let r = pixels[i * 4];
        let g = pixels[i * 4 + 1];
        let b = pixels[i * 4 + 2];
        let a = pixels[i * 4 + 3];

        if a == 0 {
            data.push(0); // index 0
            data.push(0); // alpha 0
        } else {
            // Find closest palette entry by RGB
            let mut best_idx = 0u8;
            let mut best_dist = u32::MAX;
            for (j, entry) in palette.iter().enumerate() {
                let dr = (r as i32 - entry[0] as i32).unsigned_abs();
                let dg = (g as i32 - entry[1] as i32).unsigned_abs();
                let db = (b as i32 - entry[2] as i32).unsigned_abs();
                let dist = dr + dg + db;
                if dist < best_dist {
                    best_dist = dist;
                    best_idx = j as u8;
                    if dist == 0 {
                        break;
                    }
                }
            }
            data.push(best_idx); // palette index
            data.push(a); // original alpha preserved
        }
    }
    data
}

/// Encode MSF binary data from input
pub fn encode_msf(input: &MsfEncodeInput) -> Vec<u8> {
    let frame_count = input.frame_count as usize;
    let cw = input.canvas_width as usize;
    let ch = input.canvas_height as usize;

    // Phase 1: Compute tight bboxes and extract cropped pixel data
    let mut frame_entries: Vec<MsfFrameEntry> = Vec::with_capacity(frame_count);
    let mut raw_frame_data: Vec<Vec<u8>> = Vec::with_capacity(frame_count);

    for i in 0..frame_count {
        let pixels = &input.frame_pixels[i];
        let (ox, oy, w, h) = compute_tight_bbox(pixels, cw, ch);

        if w == 0 || h == 0 {
            // Empty frame
            frame_entries.push(MsfFrameEntry {
                offset_x: 0,
                offset_y: 0,
                width: 0,
                height: 0,
                data_offset: 0,
                data_length: 0,
            });
            raw_frame_data.push(Vec::new());
        } else {
            let cropped =
                extract_bbox_pixels(pixels, cw, ox as usize, oy as usize, w as usize, h as usize);

            let frame_data = match input.pixel_format {
                PixelFormat::Indexed8 => rgba_to_indexed(&cropped, &input.palette),
                PixelFormat::Indexed8Alpha8 => rgba_to_indexed_alpha(&cropped, &input.palette),
                PixelFormat::Rgba8 => cropped,
            };

            frame_entries.push(MsfFrameEntry {
                offset_x: ox,
                offset_y: oy,
                width: w,
                height: h,
                data_offset: 0,
                data_length: 0,
            });
            raw_frame_data.push(frame_data);
        }
    }

    // Phase 2: Concatenate raw frame data and compute offsets
    let mut concat_raw = Vec::new();
    for (i, data) in raw_frame_data.iter().enumerate() {
        frame_entries[i].data_offset = concat_raw.len() as u32;
        frame_entries[i].data_length = data.len() as u32;
        concat_raw.extend_from_slice(data);
    }

    // Phase 3: Compress with simple deflate (no external dep needed)
    // We'll store uncompressed for now in WASM; CLI tool can use zstd
    // Flag bit 0: 0 = uncompressed blob, 1 = zstd compressed
    let flags: u16 = 0; // uncompressed in the base impl
    let compressed_blob = concat_raw; // identity for base impl

    // Phase 4: Build output buffer
    let palette_bytes = input.palette.len() * 4;
    let frame_table_bytes = frame_count * FRAME_ENTRY_SIZE;
    let end_chunk_bytes = 8; // "END\0" + 0u32
    let total_size =
        8 + 16 + 4 + palette_bytes + frame_table_bytes + end_chunk_bytes + compressed_blob.len();

    let mut out = Vec::with_capacity(total_size);

    // Magic + Version + Flags
    out.extend_from_slice(MSF_MAGIC);
    out.extend_from_slice(&MSF_VERSION.to_le_bytes());
    out.extend_from_slice(&flags.to_le_bytes());

    // Header (16 bytes)
    out.extend_from_slice(&input.canvas_width.to_le_bytes());
    out.extend_from_slice(&input.canvas_height.to_le_bytes());
    out.extend_from_slice(&input.frame_count.to_le_bytes());
    out.push(input.directions);
    out.push(input.fps);
    out.extend_from_slice(&input.anchor_x.to_le_bytes());
    out.extend_from_slice(&input.anchor_y.to_le_bytes());
    out.extend_from_slice(&[0u8; 4]); // reserved

    // Pixel format + palette size + reserved (4 bytes)
    out.push(input.pixel_format as u8);
    out.extend_from_slice(&(input.palette.len() as u16).to_le_bytes());
    out.push(0); // reserved

    // Palette
    for entry in &input.palette {
        out.extend_from_slice(entry);
    }

    // Frame table
    for entry in &frame_entries {
        out.extend_from_slice(&entry.offset_x.to_le_bytes());
        out.extend_from_slice(&entry.offset_y.to_le_bytes());
        out.extend_from_slice(&entry.width.to_le_bytes());
        out.extend_from_slice(&entry.height.to_le_bytes());
        out.extend_from_slice(&entry.data_offset.to_le_bytes());
        out.extend_from_slice(&entry.data_length.to_le_bytes());
    }

    // End sentinel chunk
    out.extend_from_slice(CHUNK_END);
    out.extend_from_slice(&0u32.to_le_bytes());

    // Compressed frame data blob
    out.extend_from_slice(&compressed_blob);

    out
}

// ============================================================================
// Decoding (MSF → RGBA pixels) - exported to WASM
// ============================================================================

/// Parse MSF header from raw data
#[wasm_bindgen]
pub fn parse_msf_header(data: &[u8]) -> Option<MsfHeader> {
    if data.len() < 28 {
        return None;
    }

    // Magic check
    if &data[0..4] != MSF_MAGIC {
        return None;
    }

    let _version = u16::from_le_bytes([data[4], data[5]]);
    let _flags = u16::from_le_bytes([data[6], data[7]]);

    // Header at offset 8, 16 bytes
    let off = 8;
    let canvas_width = u16::from_le_bytes([data[off], data[off + 1]]);
    let canvas_height = u16::from_le_bytes([data[off + 2], data[off + 3]]);
    let frame_count = u16::from_le_bytes([data[off + 4], data[off + 5]]);
    let directions = data[off + 6];
    let fps = data[off + 7];
    let anchor_x = i16::from_le_bytes([data[off + 8], data[off + 9]]);
    let anchor_y = i16::from_le_bytes([data[off + 10], data[off + 11]]);
    // off+12..off+15 reserved

    // Pixel format block at offset 24, 4 bytes
    let pf_off = 24;
    if data.len() < pf_off + 4 {
        return None;
    }
    let pixel_format = data[pf_off];
    let palette_size = u16::from_le_bytes([data[pf_off + 1], data[pf_off + 2]]);

    let frames_per_direction = if directions > 0 {
        (frame_count / directions as u16).max(1)
    } else {
        frame_count.max(1)
    };

    // Compute total individual pixel bytes by scanning frame table
    let palette_start = 28;
    let frame_table_start = palette_start + palette_size as usize * 4;
    let fc = frame_count as usize;
    let mut total_individual_pixel_bytes = 0u32;
    if frame_table_start + fc * FRAME_ENTRY_SIZE <= data.len() {
        for i in 0..fc {
            let ft_off = frame_table_start + i * FRAME_ENTRY_SIZE;
            let w = u16::from_le_bytes([data[ft_off + 4], data[ft_off + 5]]) as u32;
            let h = u16::from_le_bytes([data[ft_off + 6], data[ft_off + 7]]) as u32;
            if w > 0 && h > 0 {
                total_individual_pixel_bytes += w * h * 4;
            } else {
                total_individual_pixel_bytes += 4; // 1×1 placeholder
            }
        }
    }

    Some(MsfHeader {
        canvas_width,
        canvas_height,
        frame_count,
        directions,
        fps,
        anchor_x,
        anchor_y,
        pixel_format,
        palette_size,
        frames_per_direction,
        total_individual_pixel_bytes,
    })
}

/// Decode all MSF frames into RGBA pixel data
///
/// Output buffer: canvas_width * canvas_height * 4 * frame_count bytes
/// Each frame is rendered at its full canvas size with the tight bbox composited in
///
/// Returns: number of frames decoded, or 0 on failure
#[wasm_bindgen]
pub fn decode_msf_frames(data: &[u8], output: &Uint8Array) -> u32 {
    if data.len() < 28 {
        return 0;
    }
    if &data[0..4] != MSF_MAGIC {
        return 0;
    }

    let _version = u16::from_le_bytes([data[4], data[5]]);
    let flags = u16::from_le_bytes([data[6], data[7]]);

    // Header
    let off = 8;
    let canvas_width = u16::from_le_bytes([data[off], data[off + 1]]) as usize;
    let canvas_height = u16::from_le_bytes([data[off + 2], data[off + 3]]) as usize;
    let frame_count = u16::from_le_bytes([data[off + 4], data[off + 5]]) as usize;
    let _directions = data[off + 6];
    let _fps = data[off + 7];

    // Pixel format
    let pf_off = 24;
    let pixel_format_byte = data[pf_off];
    let pixel_format = match PixelFormat::from_u8(pixel_format_byte) {
        Some(pf) => pf,
        None => return 0,
    };
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
    if frame_table_start + frame_count * FRAME_ENTRY_SIZE > data.len() {
        return 0;
    }

    let mut frame_entries = Vec::with_capacity(frame_count);
    let mut ft_off = frame_table_start;
    for _ in 0..frame_count {
        let offset_x = i16::from_le_bytes([data[ft_off], data[ft_off + 1]]);
        let offset_y = i16::from_le_bytes([data[ft_off + 2], data[ft_off + 3]]);
        let width = u16::from_le_bytes([data[ft_off + 4], data[ft_off + 5]]);
        let height = u16::from_le_bytes([data[ft_off + 6], data[ft_off + 7]]);
        let data_offset = u32::from_le_bytes([
            data[ft_off + 8],
            data[ft_off + 9],
            data[ft_off + 10],
            data[ft_off + 11],
        ]);
        let data_length = u32::from_le_bytes([
            data[ft_off + 12],
            data[ft_off + 13],
            data[ft_off + 14],
            data[ft_off + 15],
        ]);
        ft_off += FRAME_ENTRY_SIZE;

        frame_entries.push(MsfFrameEntry {
            offset_x,
            offset_y,
            width,
            height,
            data_offset,
            data_length,
        });
    }

    // Skip extension chunks until "END\0"
    let mut ext_off = ft_off;
    loop {
        if ext_off + 8 > data.len() {
            return 0;
        }
        let chunk_id = &data[ext_off..ext_off + 4];
        let chunk_len = u32::from_le_bytes([
            data[ext_off + 4],
            data[ext_off + 5],
            data[ext_off + 6],
            data[ext_off + 7],
        ]) as usize;
        ext_off += 8;
        if chunk_id == CHUNK_END {
            break;
        }
        ext_off += chunk_len;
    }

    // Blob starts here
    let blob_start = ext_off;
    let is_compressed = (flags & 1) != 0;

    // Decompress if zstd-compressed (flags bit 0)
    let decompressed_buf: Vec<u8>;
    let blob: &[u8] = if is_compressed {
        let compressed = &data[blob_start..];
        decompressed_buf = match zstd_decompress(compressed) {
            Some(buf) => buf,
            None => return 0,
        };
        &decompressed_buf
    } else {
        &data[blob_start..]
    };

    // Decode frames into full canvas-size RGBA
    let frame_size = canvas_width * canvas_height * 4;
    let total_size = frame_size * frame_count;
    let mut all_pixels = vec![0u8; total_size];

    for (i, entry) in frame_entries.iter().enumerate() {
        if entry.width == 0 || entry.height == 0 {
            continue; // empty frame, already zeroed
        }

        let fw = entry.width as usize;
        let fh = entry.height as usize;
        let ox = entry.offset_x as usize;
        let oy = entry.offset_y as usize;
        let blob_off = entry.data_offset as usize;
        let blob_len = entry.data_length as usize;

        if blob_off + blob_len > blob.len() {
            continue;
        }

        let frame_pixel_start = i * frame_size;

        match pixel_format {
            PixelFormat::Rgba8 => {
                // Direct RGBA copy into canvas position
                for y in 0..fh {
                    let src_row_start = blob_off + y * fw * 4;
                    let dst_row_start = frame_pixel_start + ((oy + y) * canvas_width + ox) * 4;
                    let row_bytes = fw * 4;
                    if src_row_start + row_bytes <= blob.len()
                        && dst_row_start + row_bytes <= all_pixels.len()
                    {
                        all_pixels[dst_row_start..dst_row_start + row_bytes]
                            .copy_from_slice(&blob[src_row_start..src_row_start + row_bytes]);
                    }
                }
            }
            PixelFormat::Indexed8 => {
                // Palette lookup
                for y in 0..fh {
                    for x in 0..fw {
                        let src_idx = blob_off + y * fw + x;
                        if src_idx >= blob.len() {
                            continue;
                        }
                        let color_idx = blob[src_idx] as usize;
                        let dst_idx = frame_pixel_start + ((oy + y) * canvas_width + ox + x) * 4;
                        if dst_idx + 4 <= all_pixels.len() && color_idx < 256 {
                            let c = &palette[color_idx];
                            // Index 0 with alpha=0 means transparent (convention from ASF)
                            if c[3] > 0 {
                                all_pixels[dst_idx] = c[0];
                                all_pixels[dst_idx + 1] = c[1];
                                all_pixels[dst_idx + 2] = c[2];
                                all_pixels[dst_idx + 3] = c[3];
                            }
                        }
                    }
                }
            }
            PixelFormat::Indexed8Alpha8 => {
                // Palette lookup with per-pixel alpha (2 bytes: index, alpha)
                for y in 0..fh {
                    for x in 0..fw {
                        let src_idx = blob_off + (y * fw + x) * 2;
                        if src_idx + 1 >= blob.len() {
                            continue;
                        }
                        let color_idx = blob[src_idx] as usize;
                        let alpha = blob[src_idx + 1];
                        if alpha == 0 {
                            continue; // transparent, output already zeroed
                        }
                        let dst_idx = frame_pixel_start + ((oy + y) * canvas_width + ox + x) * 4;
                        if dst_idx + 4 <= all_pixels.len() && color_idx < 256 {
                            let c = &palette[color_idx];
                            all_pixels[dst_idx] = c[0];
                            all_pixels[dst_idx + 1] = c[1];
                            all_pixels[dst_idx + 2] = c[2];
                            all_pixels[dst_idx + 3] = alpha;
                        }
                    }
                }
            }
        }
    }

    output.copy_from(&all_pixels);
    frame_count as u32
}

/// Decode MSF frames as individual images (for MPC-style per-frame varying sizes)
///
/// Unlike decode_msf_frames which composites into a global canvas,
/// this returns each frame at its own dimensions.
///
/// Output buffers (matching decode_mpc_frames signature):
/// - pixel_output: RGBA pixels for all frames concatenated
/// - frame_sizes_output: [width, height] u32 pairs per frame
/// - frame_offsets_output: byte offset of each frame in pixel_output
///
/// Returns: frame count, or 0 on failure
#[wasm_bindgen]
pub fn decode_msf_individual_frames(
    data: &[u8],
    pixel_output: &Uint8Array,
    frame_sizes_output: &Uint8Array,
    frame_offsets_output: &Uint8Array,
) -> u32 {
    if data.len() < 28 {
        return 0;
    }
    if &data[0..4] != MSF_MAGIC {
        return 0;
    }

    let flags = u16::from_le_bytes([data[6], data[7]]);

    // Header
    let off = 8;
    let frame_count = u16::from_le_bytes([data[off + 4], data[off + 5]]) as usize;

    // Pixel format
    let pf_off = 24;
    let pixel_format_byte = data[pf_off];
    let pixel_format = match PixelFormat::from_u8(pixel_format_byte) {
        Some(pf) => pf,
        None => return 0,
    };
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
    if frame_table_start + frame_count * FRAME_ENTRY_SIZE > data.len() {
        return 0;
    }

    let mut frame_entries = Vec::with_capacity(frame_count);
    let mut ft_off = frame_table_start;
    for _ in 0..frame_count {
        let width = u16::from_le_bytes([data[ft_off + 4], data[ft_off + 5]]);
        let height = u16::from_le_bytes([data[ft_off + 6], data[ft_off + 7]]);
        let data_offset = u32::from_le_bytes([
            data[ft_off + 8],
            data[ft_off + 9],
            data[ft_off + 10],
            data[ft_off + 11],
        ]);
        let data_length = u32::from_le_bytes([
            data[ft_off + 12],
            data[ft_off + 13],
            data[ft_off + 14],
            data[ft_off + 15],
        ]);
        ft_off += FRAME_ENTRY_SIZE;
        frame_entries.push((width, height, data_offset, data_length));
    }

    // Skip extension chunks
    let mut ext_off = ft_off;
    loop {
        if ext_off + 8 > data.len() {
            return 0;
        }
        let chunk_id = &data[ext_off..ext_off + 4];
        let chunk_len = u32::from_le_bytes([
            data[ext_off + 4],
            data[ext_off + 5],
            data[ext_off + 6],
            data[ext_off + 7],
        ]) as usize;
        ext_off += 8;
        if chunk_id == CHUNK_END {
            break;
        }
        ext_off += chunk_len;
    }

    // Decompress blob
    let blob_start = ext_off;
    let is_compressed = (flags & 1) != 0;
    let decompressed_buf: Vec<u8>;
    let blob: &[u8] = if is_compressed {
        let compressed = &data[blob_start..];
        decompressed_buf = match zstd_decompress(compressed) {
            Some(buf) => buf,
            None => return 0,
        };
        &decompressed_buf
    } else {
        &data[blob_start..]
    };

    // Calculate total output size
    let mut total_pixel_bytes = 0usize;
    for &(w, h, _, _) in &frame_entries {
        if w > 0 && h > 0 {
            total_pixel_bytes += (w as usize) * (h as usize) * 4;
        } else {
            total_pixel_bytes += 4; // 1×1 placeholder
        }
    }

    let mut all_pixels = vec![0u8; total_pixel_bytes];
    let mut frame_sizes = vec![0u32; frame_count * 2];
    let mut frame_offsets = vec![0u32; frame_count];
    let mut out_offset = 0usize;

    for (i, &(w, h, data_off, _data_len)) in frame_entries.iter().enumerate() {
        let fw = w as usize;
        let fh = h as usize;

        if fw == 0 || fh == 0 {
            frame_sizes[i * 2] = 1;
            frame_sizes[i * 2 + 1] = 1;
            frame_offsets[i] = out_offset as u32;
            out_offset += 4;
            continue;
        }

        frame_sizes[i * 2] = fw as u32;
        frame_sizes[i * 2 + 1] = fh as u32;
        frame_offsets[i] = out_offset as u32;

        let blob_off = data_off as usize;
        let frame_pixel_count = fw * fh;

        match pixel_format {
            PixelFormat::Indexed8 => {
                for p in 0..frame_pixel_count {
                    let src = blob_off + p;
                    if src >= blob.len() {
                        break;
                    }
                    let color_idx = blob[src] as usize;
                    let dst = out_offset + p * 4;
                    if color_idx < 256 {
                        let c = &palette[color_idx];
                        if c[3] > 0 {
                            all_pixels[dst] = c[0];
                            all_pixels[dst + 1] = c[1];
                            all_pixels[dst + 2] = c[2];
                            all_pixels[dst + 3] = c[3];
                        }
                    }
                }
            }
            PixelFormat::Indexed8Alpha8 => {
                for p in 0..frame_pixel_count {
                    let src = blob_off + p * 2;
                    if src + 1 >= blob.len() {
                        break;
                    }
                    let color_idx = blob[src] as usize;
                    let alpha = blob[src + 1];
                    if alpha == 0 {
                        continue;
                    }
                    let dst = out_offset + p * 4;
                    if color_idx < 256 {
                        let c = &palette[color_idx];
                        all_pixels[dst] = c[0];
                        all_pixels[dst + 1] = c[1];
                        all_pixels[dst + 2] = c[2];
                        all_pixels[dst + 3] = alpha;
                    }
                }
            }
            PixelFormat::Rgba8 => {
                let src_start = blob_off;
                let src_end = src_start + frame_pixel_count * 4;
                if src_end <= blob.len() {
                    all_pixels[out_offset..out_offset + frame_pixel_count * 4]
                        .copy_from_slice(&blob[src_start..src_end]);
                }
            }
        }

        out_offset += frame_pixel_count * 4;
    }

    pixel_output.copy_from(&all_pixels);

    let frame_sizes_bytes: Vec<u8> = frame_sizes.iter().flat_map(|v| v.to_le_bytes()).collect();
    frame_sizes_output.copy_from(&frame_sizes_bytes);

    let frame_offsets_bytes: Vec<u8> = frame_offsets.iter().flat_map(|v| v.to_le_bytes()).collect();
    frame_offsets_output.copy_from(&frame_offsets_bytes);

    frame_count as u32
}

// ============================================================================
// ASF → MSF conversion helper (used by CLI tool, not WASM-exported)
// ============================================================================

/// Parse ASF file and convert to MSF encode input
pub fn asf_to_msf_input(asf_data: &[u8]) -> Option<MsfEncodeInput> {
    if asf_data.len() < 80 {
        return None;
    }
    let sig = std::str::from_utf8(&asf_data[0..7]).ok()?;
    if sig != "ASF 1.0" {
        return None;
    }

    let mut offset = 16usize;
    let width = get_i32_le(asf_data, offset) as u16;
    offset += 4;
    let height = get_i32_le(asf_data, offset) as u16;
    offset += 4;
    let frame_count = get_i32_le(asf_data, offset) as u16;
    offset += 4;
    let directions = get_i32_le(asf_data, offset) as u8;
    offset += 4;
    let color_count = get_i32_le(asf_data, offset) as usize;
    offset += 4;
    let interval = get_i32_le(asf_data, offset) as u16;
    offset += 4;
    let left = get_i32_le(asf_data, offset) as i16;
    offset += 4;
    let bottom = get_i32_le(asf_data, offset) as i16;
    offset += 4;
    offset += 16; // reserved

    // Convert interval (ms per frame) to fps
    let fps = if interval > 0 {
        (1000 / interval as u32).min(255) as u8
    } else {
        15 // default
    };

    // Read palette (BGRA → RGBA)
    let mut palette = Vec::with_capacity(color_count);
    for _ in 0..color_count {
        if offset + 4 > asf_data.len() {
            break;
        }
        let b = asf_data[offset];
        let g = asf_data[offset + 1];
        let r = asf_data[offset + 2];
        offset += 4;
        palette.push([r, g, b, 255]);
    }

    // Read frame offsets
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

    // Decode all frames to RGBA
    let w = width as usize;
    let h = height as usize;
    let mut frame_pixels = Vec::with_capacity(frame_count as usize);

    for i in 0..frame_count as usize {
        let mut pixels = vec![0u8; w * h * 4];
        if i < frame_offsets.len() {
            decode_asf_rle_frame(
                asf_data,
                &palette,
                frame_offsets[i],
                frame_lengths[i],
                w,
                h,
                &mut pixels,
            );
        }
        frame_pixels.push(pixels);
    }

    Some(MsfEncodeInput {
        canvas_width: width,
        canvas_height: height,
        frame_count,
        directions,
        fps,
        anchor_x: left,
        anchor_y: bottom,
        pixel_format: PixelFormat::Indexed8Alpha8,
        palette,
        frame_pixels,
    })
}

/// RLE decode a single ASF frame (same as asf_decoder.rs but standalone)
fn decode_asf_rle_frame(
    data: &[u8],
    palette: &[[u8; 4]],
    offset: usize,
    length: usize,
    width: usize,
    height: usize,
    pixels: &mut [u8],
) {
    let data_end = offset + length;
    let max_pixels = width * height * 4;
    let mut data_offset = offset;
    let mut pixel_idx = 0usize;

    while data_offset < data_end && data_offset + 1 < data.len() && pixel_idx < max_pixels {
        let pixel_count = data[data_offset];
        let pixel_alpha = data[data_offset + 1];
        data_offset += 2;

        for _ in 0..pixel_count {
            if pixel_idx >= max_pixels {
                break;
            }
            if pixel_alpha == 0 {
                pixel_idx += 4;
            } else if data_offset < data.len() {
                let color_index = data[data_offset] as usize;
                data_offset += 1;
                if color_index < palette.len() {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pixel_format() {
        assert_eq!(PixelFormat::from_u8(0), Some(PixelFormat::Rgba8));
        assert_eq!(PixelFormat::from_u8(1), Some(PixelFormat::Indexed8));
        assert_eq!(PixelFormat::from_u8(2), Some(PixelFormat::Indexed8Alpha8));
        assert_eq!(PixelFormat::from_u8(99), None);
    }

    #[test]
    fn test_tight_bbox_empty() {
        let pixels = vec![0u8; 4 * 4 * 4]; // 4×4 all transparent
        let (ox, oy, w, h) = compute_tight_bbox(&pixels, 4, 4);
        assert_eq!((ox, oy, w, h), (0, 0, 0, 0));
    }

    #[test]
    fn test_tight_bbox() {
        let mut pixels = vec![0u8; 4 * 4 * 4]; // 4×4
                                               // Set pixel at (1,2) to non-transparent
        let idx = (2 * 4 + 1) * 4;
        pixels[idx] = 255;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 255;
        let (ox, oy, w, h) = compute_tight_bbox(&pixels, 4, 4);
        assert_eq!((ox, oy, w, h), (1, 2, 1, 1));
    }

    #[test]
    fn test_roundtrip_empty() {
        let input = MsfEncodeInput {
            canvas_width: 10,
            canvas_height: 10,
            frame_count: 1,
            directions: 1,
            fps: 15,
            anchor_x: 0,
            anchor_y: 0,
            pixel_format: PixelFormat::Rgba8,
            palette: vec![],
            frame_pixels: vec![vec![0u8; 10 * 10 * 4]],
        };
        let encoded = encode_msf(&input);
        let header = parse_msf_header(&encoded).unwrap();
        assert_eq!(header.canvas_width, 10);
        assert_eq!(header.canvas_height, 10);
        assert_eq!(header.frame_count, 1);
    }
}

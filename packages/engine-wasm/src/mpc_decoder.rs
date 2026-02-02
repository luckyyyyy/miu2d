//! MPC 文件解码器 - 高性能 Rust 实现
//!
//! MPC 文件格式：
//! - Header(64) + HeadData(64) + Palette(colors*4) + FrameOffsets(frames*4) + RLE压缩帧数据
//!
//! 优化策略：与 ASF 相同，JS 端预分配 buffer，WASM 直接写入

use js_sys::Uint8Array;
use wasm_bindgen::prelude::*;

/// MPC 文件头信息
#[wasm_bindgen(getter_with_clone)]
#[derive(Clone, Debug)]
pub struct MpcHeader {
    pub frames_data_length_sum: u32,
    pub global_width: u32,
    pub global_height: u32,
    pub frame_count: u32,
    pub direction: u32,
    pub color_count: u32,
    pub interval: u32,
    pub bottom: i32,
    pub left: i32,
    /// 所有帧解码后的总字节数
    pub total_pixel_bytes: u32,
}

/// 解析 MPC 头信息（包括计算总像素大小）
#[wasm_bindgen]
pub fn parse_mpc_header(data: &[u8]) -> Option<MpcHeader> {
    if data.len() < 160 {
        return None;
    }

    // Check header
    let header_str = std::str::from_utf8(&data[0..12]).ok()?;
    if !header_str.starts_with("MPC File Ver") && !header_str.starts_with("SHD File Ver") {
        return None;
    }

    // Parse header at offset 64
    let offset = 64usize;
    let frames_data_length_sum = get_u32_le(data, offset);
    let global_width = get_u32_le(data, offset + 4);
    let global_height = get_u32_le(data, offset + 8);
    let frame_count = get_u32_le(data, offset + 12);
    let direction = get_u32_le(data, offset + 16);
    let color_count = get_u32_le(data, offset + 20);
    let interval = get_u32_le(data, offset + 24);
    let mut bottom = get_i32_le(data, offset + 28);

    let left = (global_width / 2) as i32;
    if global_height >= 16 {
        bottom = global_height as i32 - 16 - bottom;
    } else {
        bottom = 16 - global_height as i32 - bottom;
    }

    // Calculate total pixel bytes
    let palette_start = 128usize;
    let offsets_start = palette_start + (color_count as usize) * 4;
    let frame_data_start = offsets_start + (frame_count as usize) * 4;

    let mut total_pixel_bytes = 0u32;
    for i in 0..frame_count as usize {
        let off = offsets_start + i * 4;
        if off + 4 > data.len() {
            break;
        }
        let data_offset = get_u32_le(data, off) as usize;
        let ds = frame_data_start + data_offset;
        if ds + 12 > data.len() {
            total_pixel_bytes += 4; // 1x1 invalid frame
            continue;
        }

        let width = get_u32_le(data, ds + 4);
        let height = get_u32_le(data, ds + 8);

        if width == 0 || height == 0 || width > 2048 || height > 2048 {
            total_pixel_bytes += 4;
        } else {
            total_pixel_bytes += width * height * 4;
        }
    }

    Some(MpcHeader {
        frames_data_length_sum,
        global_width,
        global_height,
        frame_count,
        direction,
        color_count,
        interval,
        bottom,
        left,
        total_pixel_bytes,
    })
}

/// 解码 MPC 帧到预分配的 buffer
///
/// 参数:
/// - data: MPC 文件原始数据
/// - pixel_output: 预分配的像素数据 buffer (header.total_pixel_bytes 字节)
/// - frame_sizes_output: 预分配的帧尺寸 buffer (frame_count * 2 个 u32)
/// - frame_offsets_output: 预分配的帧偏移 buffer (frame_count 个 u32)
///
/// 返回: 成功返回帧数，失败返回 0
#[wasm_bindgen]
pub fn decode_mpc_frames(
    data: &[u8],
    pixel_output: &Uint8Array,
    frame_sizes_output: &Uint8Array,
    frame_offsets_output: &Uint8Array,
) -> u32 {
    let header = match parse_mpc_header(data) {
        Some(h) => h,
        None => return 0,
    };

    let color_count = header.color_count as usize;
    let frame_count = header.frame_count as usize;

    // Read palette (BGRA -> RGBA)
    let mut palette = [[0u8; 4]; 256];
    let palette_start = 128usize;
    for i in 0..color_count.min(256) {
        let off = palette_start + i * 4;
        if off + 4 > data.len() {
            break;
        }
        palette[i] = [data[off + 2], data[off + 1], data[off], 255]; // BGR -> RGB
    }

    // Read frame data offsets
    let offsets_start = palette_start + color_count * 4;
    let mut data_offsets = Vec::with_capacity(frame_count);
    for i in 0..frame_count {
        let off = offsets_start + i * 4;
        if off + 4 > data.len() {
            break;
        }
        data_offsets.push(get_u32_le(data, off) as usize);
    }

    let frame_data_start = offsets_start + frame_count * 4;

    // Prepare output buffers
    let mut pixel_data = vec![0u8; header.total_pixel_bytes as usize];
    let mut frame_sizes = vec![0u32; frame_count * 2];
    let mut frame_offsets = vec![0u32; frame_count];

    let mut out_offset = 0usize;

    // Decode all frames
    for i in 0..frame_count {
        if i >= data_offsets.len() {
            break;
        }

        let ds = frame_data_start + data_offsets[i];
        if ds + 12 > data.len() {
            frame_sizes[i * 2] = 1;
            frame_sizes[i * 2 + 1] = 1;
            frame_offsets[i] = out_offset as u32;
            out_offset += 4;
            continue;
        }

        let data_len = get_u32_le(data, ds) as usize;
        let width = get_u32_le(data, ds + 4) as usize;
        let height = get_u32_le(data, ds + 8) as usize;

        if width == 0 || height == 0 || width > 2048 || height > 2048 {
            frame_sizes[i * 2] = 1;
            frame_sizes[i * 2 + 1] = 1;
            frame_offsets[i] = out_offset as u32;
            out_offset += 4;
            continue;
        }

        frame_sizes[i * 2] = width as u32;
        frame_sizes[i * 2 + 1] = height as u32;
        frame_offsets[i] = out_offset as u32;

        let frame_size = width * height * 4;
        let rle_start = ds + 20; // Skip: dataLen(4) + width(4) + height(4) + reserved(8)
        let rle_end = ds + data_len;

        decode_rle_frame(
            data,
            &palette,
            rle_start,
            rle_end,
            width,
            height,
            &mut pixel_data[out_offset..out_offset + frame_size],
        );

        out_offset += frame_size;
    }

    // Copy to JS buffers
    pixel_output.copy_from(&pixel_data);

    // Convert frame_sizes to bytes
    let frame_sizes_bytes: Vec<u8> = frame_sizes.iter().flat_map(|v| v.to_le_bytes()).collect();
    frame_sizes_output.copy_from(&frame_sizes_bytes);

    let frame_offsets_bytes: Vec<u8> = frame_offsets.iter().flat_map(|v| v.to_le_bytes()).collect();
    frame_offsets_output.copy_from(&frame_offsets_bytes);

    frame_count as u32
}

/// RLE 解压缩单帧
#[inline]
fn decode_rle_frame(
    data: &[u8],
    palette: &[[u8; 4]; 256],
    mut data_offset: usize,
    data_end: usize,
    width: usize,
    height: usize,
    pixels: &mut [u8],
) {
    let max_pixels = width * height;
    let mut pixel_idx = 0usize;

    while data_offset < data_end && data_offset < data.len() && pixel_idx < max_pixels {
        let byte = data[data_offset];
        data_offset += 1;

        if byte > 0x80 {
            // Transparent pixels
            let transparent_count = (byte - 0x80) as usize;
            let end = (pixel_idx + transparent_count).min(max_pixels);
            while pixel_idx < end {
                let idx = pixel_idx * 4;
                pixels[idx] = 0;
                pixels[idx + 1] = 0;
                pixels[idx + 2] = 0;
                pixels[idx + 3] = 0;
                pixel_idx += 1;
            }
        } else {
            // Colored pixels
            let color_count = byte as usize;
            for _ in 0..color_count {
                if pixel_idx >= max_pixels || data_offset >= data.len() {
                    break;
                }
                let palette_idx = data[data_offset] as usize;
                data_offset += 1;

                let idx = pixel_idx * 4;
                if palette_idx < 256 {
                    pixels[idx] = palette[palette_idx][0];
                    pixels[idx + 1] = palette[palette_idx][1];
                    pixels[idx + 2] = palette[palette_idx][2];
                    pixels[idx + 3] = palette[palette_idx][3];
                }
                pixel_idx += 1;
            }
        }
    }

    // Fill remaining with transparent
    while pixel_idx < max_pixels {
        let idx = pixel_idx * 4;
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
        pixel_idx += 1;
    }
}

/// 读取小端序 32 位无符号整数
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

/// 读取小端序 32 位有符号整数
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
    fn test_invalid_header() {
        let data = b"INVALID HEADER DATA PADDING TO 200 BYTES................................................................................................................";
        let result = parse_mpc_header(data);
        assert!(result.is_none());
    }

    #[test]
    fn test_too_short_file() {
        let data = b"MPC File Ver";
        let result = parse_mpc_header(data);
        assert!(result.is_none());
    }
}

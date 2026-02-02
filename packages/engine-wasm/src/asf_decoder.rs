//! ASF 精灵帧解码器 - 高性能 Rust 实现
//!
//! ASF 文件格式：
//! - Header(16) + Metadata(64) + Palette(colors*4) + FrameOffsets(frames*8) + RLE压缩帧数据
//!
//! 使用无状态函数实现零拷贝输入，性能比 TypeScript 快 2x+

use js_sys::Uint8Array;
use wasm_bindgen::prelude::*;

/// ASF 文件头信息
#[wasm_bindgen(getter_with_clone)]
#[derive(Clone, Debug)]
pub struct AsfHeader {
    pub width: u32,
    pub height: u32,
    pub frame_count: u32,
    pub directions: u32,
    pub color_count: u32,
    pub interval: u32,
    pub left: i32,
    pub bottom: i32,
    pub frames_per_direction: u32,
}

/// 解析 ASF 头信息（不解码帧数据）
#[wasm_bindgen]
pub fn parse_asf_header(data: &[u8]) -> Option<AsfHeader> {
    if data.len() < 80 {
        return None;
    }

    let signature = std::str::from_utf8(&data[0..7]).ok()?;
    if signature != "ASF 1.0" {
        return None;
    }

    let mut offset = 16usize;

    let width = get_i32_le(data, offset) as u32;
    offset += 4;
    let height = get_i32_le(data, offset) as u32;
    offset += 4;
    let frame_count = get_i32_le(data, offset) as u32;
    offset += 4;
    let directions = get_i32_le(data, offset) as u32;
    offset += 4;
    let color_count = get_i32_le(data, offset) as u32;
    offset += 4;
    let interval = get_i32_le(data, offset) as u32;
    offset += 4;
    let left = get_i32_le(data, offset);
    offset += 4;
    let bottom = get_i32_le(data, offset);

    let frames_per_direction = if directions > 0 {
        (frame_count / directions).max(1)
    } else {
        frame_count.max(1)
    };

    Some(AsfHeader {
        width,
        height,
        frame_count,
        directions,
        color_count,
        interval,
        left,
        bottom,
        frames_per_direction,
    })
}

/// 一次性解码所有帧（无状态，零拷贝输入）
///
/// 参数:
/// - data: ASF 文件原始数据
/// - output: 预分配的输出 buffer (width * height * 4 * frameCount)
///
/// 返回: 成功返回帧数，失败返回 0
#[wasm_bindgen]
pub fn decode_asf_frames(data: &[u8], output: &Uint8Array) -> u32 {
    if data.len() < 80 {
        return 0;
    }

    let signature = match std::str::from_utf8(&data[0..7]) {
        Ok(s) => s,
        Err(_) => return 0,
    };
    if signature != "ASF 1.0" {
        return 0;
    }

    let mut offset = 16usize;

    let width = get_i32_le(data, offset) as usize;
    offset += 4;
    let height = get_i32_le(data, offset) as usize;
    offset += 4;
    let frame_count = get_i32_le(data, offset) as u32;
    offset += 4;
    offset += 4; // directions
    let color_count = get_i32_le(data, offset) as usize;
    offset += 4;
    offset += 28; // 跳过 interval(4), left(4), bottom(4), reserved(16)

    // 读取调色板 (BGRA -> RGBA)
    let mut palette = [0u8; 256 * 4];
    for i in 0..color_count.min(256) {
        if offset + 4 > data.len() {
            break;
        }
        let b = data[offset];
        let g = data[offset + 1];
        let r = data[offset + 2];
        offset += 4;

        palette[i * 4] = r;
        palette[i * 4 + 1] = g;
        palette[i * 4 + 2] = b;
        palette[i * 4 + 3] = 255;
    }

    // 读取帧偏移和长度
    let mut frame_offsets = Vec::with_capacity(frame_count as usize);
    let mut frame_lengths = Vec::with_capacity(frame_count as usize);

    for _ in 0..frame_count {
        if offset + 8 > data.len() {
            break;
        }
        frame_offsets.push(get_i32_le(data, offset) as usize);
        offset += 4;
        frame_lengths.push(get_i32_le(data, offset) as usize);
        offset += 4;
    }

    // 解码所有帧
    let frame_size = width * height * 4;
    let total_size = frame_size * frame_count as usize;
    let mut all_pixels = vec![0u8; total_size];

    for i in 0..frame_count as usize {
        let frame_offset = frame_offsets[i];
        let frame_length = frame_lengths[i];
        let output_offset = i * frame_size;

        decode_rle_frame(
            data,
            &palette,
            frame_offset,
            frame_length,
            width,
            height,
            &mut all_pixels[output_offset..output_offset + frame_size],
        );
    }

    // 单次跨边界复制
    output.copy_from(&all_pixels);

    frame_count
}

/// RLE 解压缩单帧
#[inline]
fn decode_rle_frame(
    data: &[u8],
    palette: &[u8; 256 * 4],
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
        let pixel_count_byte = data[data_offset];
        let pixel_alpha = data[data_offset + 1];
        data_offset += 2;

        for _ in 0..pixel_count_byte {
            if pixel_idx >= max_pixels {
                break;
            }

            if pixel_alpha == 0 {
                // 透明像素 - buffer 已初始化为 0
                pixel_idx += 4;
            } else {
                // 从调色板读取颜色
                if data_offset < data.len() {
                    let color_index = data[data_offset] as usize;
                    data_offset += 1;

                    if color_index < 256 {
                        pixels[pixel_idx] = palette[color_index * 4];
                        pixels[pixel_idx + 1] = palette[color_index * 4 + 1];
                        pixels[pixel_idx + 2] = palette[color_index * 4 + 2];
                        pixels[pixel_idx + 3] = pixel_alpha;
                    } else {
                        // 无效颜色索引，使用品红色
                        pixels[pixel_idx] = 255;
                        pixels[pixel_idx + 1] = 0;
                        pixels[pixel_idx + 2] = 255;
                        pixels[pixel_idx + 3] = 255;
                    }
                }
                pixel_idx += 4;
            }
        }
    }
}

/// 读取小端序 32 位整数
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
    fn test_invalid_signature() {
        let data = b"INVALID HEADER DATA PADDING TO 80 BYTES.................................";
        let result = parse_asf_header(data);
        assert!(result.is_none());
    }

    #[test]
    fn test_too_short_file() {
        let data = b"ASF 1.0";
        let result = parse_asf_header(data);
        assert!(result.is_none());
    }
}

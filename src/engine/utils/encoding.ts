/**
 * Text encoding utilities
 * 文本编码工具
 */

/**
 * Decode GB2312/GBK encoded buffer to string
 * Used ONLY for reading Chinese text from BINARY game resource files (map, MPC)
 * NOTE: Text files (.ini, .txt) in resources/ are now UTF-8, use response.text() instead
 *
 * @param buffer ArrayBuffer containing GBK encoded data
 * @returns Decoded string
 */
export function decodeGb2312(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  try {
    // Try GBK (superset of GB2312, better compatibility)
    const decoder = new TextDecoder("gbk");
    return decoder.decode(bytes);
  } catch {
    try {
      // Fallback to GB2312
      const decoder = new TextDecoder("gb2312");
      return decoder.decode(bytes);
    } catch {
      // Last resort: UTF-8
      const decoder = new TextDecoder("utf-8");
      return decoder.decode(bytes);
    }
  }
}

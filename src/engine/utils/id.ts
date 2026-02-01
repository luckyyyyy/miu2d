/**
 * ID generation utilities
 * ID 生成工具
 */

/**
 * Generate unique ID
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

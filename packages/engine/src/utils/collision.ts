/**
 * Collision detection utilities
 * 碰撞检测工具
 */

/**
 * Rectangle type for collision detection
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Check if two rectangles intersect (AABB collision)
 * / Rectangle.Intersects
 */
export function isBoxCollide(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Coordinate conversion utilities for isometric tile map
 * 坐标转换工具 - 等角瓦片地图
 */
import type { Vector2 } from "../core/types";
import { TILE_HEIGHT, TILE_WIDTH } from "../core/types";

/**
 * Convert tile position to pixel position (isometric)
 * 瓦片坐标转像素坐标
 */
export function tileToPixel(tileX: number, tileY: number): Vector2 {
  const baseX = (tileY % 2) * 32 + TILE_WIDTH * tileX;
  const baseY = 16 * tileY;
  return { x: baseX, y: baseY };
}

/**
 * Convert pixel position to tile position (isometric)
 * 像素坐标转瓦片坐标
 */
export function pixelToTile(pixelX: number, pixelY: number): Vector2 {
  if (pixelX < 0 || pixelY < 0) return { x: 0, y: 0 };

  let nx = Math.floor(pixelX / TILE_WIDTH);
  let ny = 1 + Math.floor(pixelY / TILE_HEIGHT) * 2;

  // Calculate real position (isometric adjustment)
  const dx = pixelX - nx * TILE_WIDTH;
  const dy = pixelY - Math.floor(ny / 2) * TILE_HEIGHT;

  if (dx < 32) {
    if (dy < (32 - dx) / 2) {
      ny--;
    } else if (dy > dx / 2 + 16) {
      ny++;
    }
  }
  if (dx > 32) {
    if (dy < (dx - 32) / 2) {
      nx++;
      ny--;
    } else if (dy > (64 - dx) / 2 + 16) {
      nx++;
      ny++;
    }
  }

  return { x: nx, y: ny };
}

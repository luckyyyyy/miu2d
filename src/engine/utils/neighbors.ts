/**
 * Neighbor tile utilities for isometric pathfinding
 * 邻居瓦片工具 - 用于等角地图寻路
 */
import type { Vector2 } from "../core/types";

/**
 * Get neighboring tiles (8-direction)
 * Matches C# PathFinder.FindAllNeighbors exactly
 *
 * Direction indices:
 * 3  4  5
 * 2     6
 * 1  0  7
 */
export function getNeighbors(tile: Vector2): Vector2[] {
  const x = tile.x;
  const y = tile.y;

  if (Math.floor(y) % 2 === 0) {
    // Even row
    return [
      { x: x, y: y + 2 }, // 0: South
      { x: x - 1, y: y + 1 }, // 1: SouthWest
      { x: x - 1, y: y }, // 2: West
      { x: x - 1, y: y - 1 }, // 3: NorthWest
      { x: x, y: y - 2 }, // 4: North
      { x: x, y: y - 1 }, // 5: NorthEast
      { x: x + 1, y: y }, // 6: East
      { x: x, y: y + 1 }, // 7: SouthEast
    ];
  } else {
    // Odd row
    return [
      { x: x, y: y + 2 }, // 0: South
      { x: x, y: y + 1 }, // 1: SouthWest
      { x: x - 1, y: y }, // 2: West
      { x: x, y: y - 1 }, // 3: NorthWest
      { x: x, y: y - 2 }, // 4: North
      { x: x + 1, y: y - 1 }, // 5: NorthEast
      { x: x + 1, y: y }, // 6: East
      { x: x + 1, y: y + 1 }, // 7: SouthEast
    ];
  }
}

/**
 * Get walkable neighbors with diagonal blocking logic
 * Matches C# PathFinder.FindNeighbors + GetObstacleIndexList
 *
 * Key insight: In isometric maps, when moving "straight" (N/S/E/W which skip 2 tiles),
 * you actually pass through intermediate tiles. If those intermediate tiles are blocked,
 * the straight movement should also be blocked.
 *
 * Direction layout:
 * 3  4  5
 * 2     6
 * 1  0  7
 *
 * - If direction 1 (SouthWest) is obstacle → block 0 (South) and 2 (West)
 * - If direction 3 (NorthWest) is obstacle → block 2 (West) and 4 (North)
 * - If direction 5 (NorthEast) is obstacle → block 4 (North) and 6 (East)
 * - If direction 7 (SouthEast) is obstacle → block 0 (South) and 6 (East)
 */
export function getWalkableNeighbors(
  tile: Vector2,
  isWalkable: (t: Vector2) => boolean,
  isMapObstacle?: (t: Vector2) => boolean
): Vector2[] {
  const allNeighbors = getNeighbors(tile);
  const blockedDirections = new Set<number>();

  // Check each neighbor and apply diagonal blocking rules
  for (let i = 0; i < allNeighbors.length; i++) {
    const neighbor = allNeighbors[i];
    if (!isWalkable(neighbor)) {
      blockedDirections.add(i);

      // Apply diagonal blocking: if a diagonal direction is a "hard" obstacle,
      // also block the adjacent cardinal directions
      // C# checks MapBase.Instance.IsObstacle (not IsObstacleForCharacter)
      // IsObstacle is the raw map barrier, IsObstacleForCharacter also checks NPCs/Objs
      const isHardObstacle = isMapObstacle ? isMapObstacle(neighbor) : !isWalkable(neighbor);

      if (isHardObstacle) {
        switch (i) {
          case 1: // SouthWest → block South(0) and West(2)
            blockedDirections.add(0);
            blockedDirections.add(2);
            break;
          case 3: // NorthWest → block West(2) and North(4)
            blockedDirections.add(2);
            blockedDirections.add(4);
            break;
          case 5: // NorthEast → block North(4) and East(6)
            blockedDirections.add(4);
            blockedDirections.add(6);
            break;
          case 7: // SouthEast → block South(0) and East(6)
            blockedDirections.add(0);
            blockedDirections.add(6);
            break;
        }
      }
    }
  }

  // Return only non-blocked neighbors
  return allNeighbors.filter((_, i) => !blockedDirections.has(i));
}

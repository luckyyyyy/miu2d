/**
 * Character Movement Utilities
 * Pure utility functions for movement calculations
 *
 * C# Reference: Character.cs movement-related calculations
 */

import type { Vector2 } from "../../core/types";
import { BASE_SPEED, MIN_CHANGE_MOVE_SPEED_PERCENT } from "../../core/types";
import { getDirectionFromVector } from "../../utils";

/**
 * Direction vectors for 8-direction movement (normalized)
 * C# uses Vector2.Normalize()
 */
export const DIRECTION_VECTORS: Vector2[] = [
  { x: 0, y: -1 }, // 0 - North
  { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, // 1 - NorthEast (1/√2)
  { x: 1, y: 0 }, // 2 - East
  { x: Math.SQRT1_2, y: Math.SQRT1_2 }, // 3 - SouthEast
  { x: 0, y: 1 }, // 4 - South
  { x: -Math.SQRT1_2, y: Math.SQRT1_2 }, // 5 - SouthWest
  { x: -1, y: 0 }, // 6 - West
  { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, // 7 - NorthWest
];

/**
 * Tile offset vectors for 8 directions
 * Used for finding neighbor tiles
 */
export const TILE_OFFSETS: Vector2[] = [
  { x: 0, y: -1 }, // North
  { x: 1, y: -1 }, // NorthEast
  { x: 1, y: 0 }, // East
  { x: 1, y: 1 }, // SouthEast
  { x: 0, y: 1 }, // South
  { x: -1, y: 1 }, // SouthWest
  { x: -1, y: 0 }, // West
  { x: -1, y: -1 }, // NorthWest
];

/**
 * Calculate move speed multiplier based on addMoveSpeedPercent
 * C#: ChangeMoveSpeedFold = 1 + AddMoveSpeedPercent / 100 (min -90%)
 *
 * @param addMoveSpeedPercent Speed percentage modifier
 * @returns Speed multiplier (minimum 0.1)
 */
export function calculateSpeedMultiplier(addMoveSpeedPercent: number): number {
  const speedPercent = Math.max(MIN_CHANGE_MOVE_SPEED_PERCENT, addMoveSpeedPercent);
  return 1 + speedPercent / 100;
}

/**
 * Calculate movement distance for a time step
 *
 * @param walkSpeed Character's walk speed
 * @param addMoveSpeedPercent Speed percentage modifier
 * @param elapsedSeconds Time elapsed
 * @returns Distance to move in pixels
 */
export function calculateMoveDistance(
  walkSpeed: number,
  addMoveSpeedPercent: number,
  elapsedSeconds: number
): number {
  const speedMultiplier = calculateSpeedMultiplier(addMoveSpeedPercent);
  return BASE_SPEED * walkSpeed * speedMultiplier * elapsedSeconds;
}

/**
 * Get direction vector for a direction index
 *
 * @param direction Direction index (0-7)
 * @returns Normalized direction vector
 */
export function getDirectionVector(direction: number): Vector2 {
  return DIRECTION_VECTORS[direction] || { x: 0, y: 0 };
}

/**
 * Find neighbor tile in a direction
 * C# Reference: PathFinder.FindNeighborInDirection
 *
 * @param tilePos Current tile position
 * @param direction Direction vector
 * @returns Neighbor tile position
 */
export function findNeighborInDirection(tilePos: Vector2, direction: Vector2): Vector2 {
  const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
  if (len === 0) return tilePos;

  const dirIndex = getDirectionFromVector(direction);
  const offset = TILE_OFFSETS[dirIndex] || { x: 0, y: 0 };

  return {
    x: tilePos.x + offset.x,
    y: tilePos.y + offset.y,
  };
}

/**
 * Find tile at a specified distance in a given direction
 * C# Reference: PathFinder.FindDistanceTileInDirection
 *
 * @param fromTile Starting tile position
 * @param direction Direction vector
 * @param distance Distance in tiles
 * @returns Target tile position
 */
export function findDistanceTileInDirection(
  fromTile: Vector2,
  direction: Vector2,
  distance: number
): Vector2 {
  const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
  if (len === 0) return fromTile;

  const normX = direction.x / len;
  const normY = direction.y / len;

  return {
    x: Math.round(fromTile.x + normX * distance),
    y: Math.round(fromTile.y + normY * distance),
  };
}

/**
 * Check if position is at tile center (within threshold)
 *
 * @param pixelPos Current pixel position
 * @param tileCenterPixel Tile center pixel position
 * @param threshold Distance threshold (default 2)
 * @returns true if at tile center
 */
export function isAtTileCenter(
  pixelPos: Vector2,
  tileCenterPixel: Vector2,
  threshold: number = 2
): boolean {
  return (
    Math.abs(pixelPos.x - tileCenterPixel.x) < threshold &&
    Math.abs(pixelPos.y - tileCenterPixel.y) < threshold
  );
}

/**
 * Calculate distance between two points
 *
 * @param from Starting point
 * @param to Ending point
 * @returns Distance in pixels
 */
export function pixelDistance(from: Vector2, to: Vector2): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if reached waypoint (within threshold)
 *
 * @param currentPos Current pixel position
 * @param targetPos Target pixel position
 * @param threshold Distance threshold (default 2)
 * @returns true if reached waypoint
 */
export function reachedWaypoint(
  currentPos: Vector2,
  targetPos: Vector2,
  threshold: number = 2
): boolean {
  return pixelDistance(currentPos, targetPos) < threshold;
}

/**
 * Normalize a direction vector
 *
 * @param direction Vector to normalize
 * @returns Normalized vector (or zero vector if length is 0)
 */
export function normalizeDirection(direction: Vector2): Vector2 {
  const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: direction.x / len, y: direction.y / len };
}

/**
 * Jump speed multiplier (8x faster than walking)
 * C# Reference: Character.JumpAlongPath
 */
export const JUMP_SPEED_FOLD = 8;

/**
 * Distance offset for movement completion check
 * C# Reference: Globals.DistanceOffset
 */
export const DISTANCE_OFFSET = 1;

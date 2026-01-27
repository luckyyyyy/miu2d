/**
 * Camera Controller - Handles camera movement for script commands
 * Extracted from GameManager
 *
 * Based on C#'s Camera.MoveTo functionality
 */
import type { Vector2 } from "../core/types";

/**
 * Direction vectors for 8-way movement
 */
const DIRECTION_VECTORS: Vector2[] = [
  { x: 0, y: -1 },  // 0: North
  { x: 1, y: -1 },  // 1: NorthEast
  { x: 1, y: 0 },   // 2: East
  { x: 1, y: 1 },   // 3: SouthEast
  { x: 0, y: 1 },   // 4: South
  { x: -1, y: 1 },  // 5: SouthWest
  { x: -1, y: 0 },  // 6: West
  { x: -1, y: -1 }, // 7: NorthWest
];

/**
 * Manages camera movement for script-driven camera moves
 */
export class CameraController {
  private isMoving: boolean = false;
  private moveTarget: Vector2 | null = null;
  private moveSpeed: number = 0;
  private moveDirection: number = 0;
  private moveDistance: number = 0;
  private moveStartPos: Vector2 | null = null;

  /**
   * Check if camera is being moved by script
   */
  isMovingByScript(): boolean {
    return this.isMoving;
  }

  /**
   * Move camera in a direction for a given distance
   * Based on C# Camera.MoveTo(direction, distance, speed)
   *
   * @param direction 8-way direction (0=N, 1=NE, 2=E, etc.)
   * @param distance Distance to move in pixels
   * @param speed Speed in pixels per frame at 60fps
   */
  moveTo(direction: number, distance: number, speed: number): void {
    this.isMoving = true;
    this.moveDirection = direction;
    this.moveDistance = distance;
    this.moveSpeed = speed;
    this.moveStartPos = null; // Will be set when camera position is available
  }

  /**
   * Stop camera movement
   */
  stopMovement(): void {
    this.isMoving = false;
    this.moveStartPos = null;
  }

  /**
   * Update camera movement (called from game loop)
   *
   * @param currentX Current camera X position
   * @param currentY Current camera Y position
   * @param deltaTime Delta time in milliseconds
   * @returns New camera position, or null if not moving
   */
  update(currentX: number, currentY: number, deltaTime: number): Vector2 | null {
    if (!this.isMoving) {
      return null;
    }

    // Initialize start position
    if (!this.moveStartPos) {
      this.moveStartPos = { x: currentX, y: currentY };
    }

    // Get direction vector
    const dir = DIRECTION_VECTORS[this.moveDirection] || { x: 0, y: 0 };

    // Calculate movement per frame
    // C#: speed is pixels per frame at 60fps
    const movePerSecond = this.moveSpeed * 60;
    const moveAmount = movePerSecond * (deltaTime / 1000);

    // Calculate new position
    const newX = currentX + dir.x * moveAmount;
    const newY = currentY + dir.y * moveAmount;

    // Calculate distance moved from start
    const dx = newX - this.moveStartPos.x;
    const dy = newY - this.moveStartPos.y;
    const distanceMoved = Math.sqrt(dx * dx + dy * dy);

    // Check if we've moved far enough
    if (distanceMoved >= this.moveDistance) {
      // Move complete - calculate final position
      const startX = this.moveStartPos.x;
      const startY = this.moveStartPos.y;

      this.isMoving = false;
      this.moveStartPos = null;

      // Return final position (exact distance)
      const ratio = this.moveDistance / distanceMoved;
      return {
        x: startX + dx * ratio,
        y: startY + dy * ratio,
      };
    }

    return { x: newX, y: newY };
  }

  /**
   * Get current movement state for debugging
   */
  getState(): {
    isMoving: boolean;
    direction: number;
    distance: number;
    speed: number;
    startPos: Vector2 | null;
  } {
    return {
      isMoving: this.isMoving,
      direction: this.moveDirection,
      distance: this.moveDistance,
      speed: this.moveSpeed,
      startPos: this.moveStartPos,
    };
  }
}

/**
 * Npc class - based on JxqyHD Engine/Npc.cs
 * Extends Character with NPC-specific functionality (AI, patrol, etc.)
 */
import type { Vector2, CharacterConfig } from "../core/types";
import { CharacterState, CharacterKind, Direction } from "../core/types";
import { Character } from "./characterBase";
import { loadNpcConfig } from "./resFile";
import { generateId } from "../core/utils";

/**
 * Npc class - NPC characters with AI behavior
 * Based on C# Engine/Npc.cs
 */
export class Npc extends Character {
  // C#: Unique identifier for this NPC instance
  private _id: string;

  // C#: _actionPathTilePositionList - patrol path
  private _actionPathTilePositions: Vector2[] = [];

  // C#: _idledFrame
  private _idledFrame: number = 0;

  // C#: IsAIDisabled
  private _isAIDisabled: boolean = false;

  // C#: _blindMilliseconds
  private _blindMilliseconds: number = 0;

  // C#: _keepDistanceCharacterWhenFriendDeath
  private _keepDistanceCharacter: Character | null = null;

  // Action type for behavior
  private _actionType: number = 0;

  constructor(id?: string) {
    super();
    this._id = id || generateId();
  }

  // ============= Properties =============

  get id(): string {
    return this._id;
  }

  get actionPathTilePositions(): Vector2[] {
    return this._actionPathTilePositions;
  }

  set actionPathTilePositions(value: Vector2[]) {
    this._actionPathTilePositions = value;
  }

  get idledFrame(): number {
    return this._idledFrame;
  }

  set idledFrame(value: number) {
    this._idledFrame = value;
  }

  get isAIDisabled(): boolean {
    return this._isAIDisabled;
  }

  set isAIDisabled(value: boolean) {
    this._isAIDisabled = value;
  }

  get blindMilliseconds(): number {
    return this._blindMilliseconds;
  }

  set blindMilliseconds(value: number) {
    this._blindMilliseconds = value;
  }

  get actionType(): number {
    return this._actionType;
  }

  set actionType(value: number) {
    this._actionType = value;
  }

  // ============= Static Factory Methods =============

  /**
   * Create NPC from config file path
   * Based on C# Npc(string filePath) constructor
   */
  static async fromFile(configPath: string, tileX: number, tileY: number, direction: number = 4): Promise<Npc | null> {
    const config = await loadNpcConfig(configPath);
    if (!config) {
      return null;
    }
    return Npc.fromConfig(config, tileX, tileY, direction);
  }

  /**
   * Create NPC from config object
   * Based on C# Npc(KeyDataCollection) constructor
   */
  static fromConfig(config: CharacterConfig, tileX: number, tileY: number, direction: number = 4): Npc {
    const npc = new Npc();
    npc.loadFromConfig(config);
    npc.setPosition(tileX, tileY);
    npc._currentDirection = direction;
    return npc;
  }

  // ============= Methods =============

  /**
   * C#: Update(gameTime)
   * Override to add NPC AI behavior and movement
   */
  override update(deltaTime: number): void {
    if (!this._isVisible) return;

    // Update blind time
    if (this._blindMilliseconds > 0) {
      this._blindMilliseconds -= deltaTime * 1000;
    }

    // Update movement (unless in special action)
    if (!this._isInSpecialAction) {
      const isRunning = this._state === CharacterState.Run;
      // C#: Walk uses WalkSpeed as speedFold, Run uses RunSpeedFold
      const speedFold = isRunning ? 8 : this._walkSpeed; // RUN_SPEED_FOLD = 8
      this.moveAlongPath(deltaTime, speedFold);
    }

    // Parent update (animation only)
    super.update(deltaTime);

    // AI behavior (only if not disabled)
    if (!this._isAIDisabled && this._kind === CharacterKind.Fighter) {
      this.performAction(deltaTime);
    }
  }

  /**
   * C#: PerformAction()
   * NPC AI behavior
   */
  private performAction(_deltaTime: number): void {
    // Patrol behavior if has patrol path
    if (this._actionPathTilePositions.length > 0) {
      if (this._path.length === 0) {
        // Get next patrol point
        const nextPoint = this._actionPathTilePositions.shift()!;
        this._actionPathTilePositions.push(nextPoint); // Loop
        this.walkTo(nextPoint);
      }
    }
  }

  /**
   * Start special action animation
   * Based on C# Character.SetSpecialAction
   */
  startSpecialAction(asf: any): void {
    this._isInSpecialAction = true;
    this._specialActionLastDirection = this._currentDirection;
    this._specialActionFrame = 0;

    if (asf) {
      this._texture = asf;
      this._currentFrameIndex = 0;
      const framesPerDir = asf.framesPerDirection || 1;
      this._leftFrameToPlay = framesPerDir;
      this._frameEnd = framesPerDir - 1;
    }
  }

  /**
   * End special action
   * Based on C# Character.EndSpecialAction
   */
  endSpecialAction(): void {
    this._isInSpecialAction = false;
    this._specialActionFrame = 0;
    this._leftFrameToPlay = 0;
    this._currentDirection = this._specialActionLastDirection;
    this.state = CharacterState.Stand;
  }

  /**
   * Check if special action has ended
   */
  isSpecialActionEnd(): boolean {
    return !this._isInSpecialAction || this._leftFrameToPlay <= 0;
  }

  /**
   * Set custom action file for a state
   * Based on C# Character.SetNpcActionFile
   */
  setActionFile(stateType: number, asfFile: string): void {
    this.setCustomActionFile(stateType, asfFile);
    console.log(`[Npc] SetActionFile: ${this._name}, state=${stateType}, file=${asfFile}`);
  }
}

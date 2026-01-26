/**
 * Player Controller - based on JxqyHD Engine/Player.cs
 * Handles player input, movement, and actions
 */
import type { PlayerData, Vector2, InputState, CharacterConfig, NpcData } from "../core/types";
import { CharacterState, Direction, DEFAULT_PLAYER_STATS, CharacterKind, RelationType, RUN_SPEED_FOLD } from "../core/types";
import {
  createPlayerData,
  updateCharacterMovement,
  updateCharacterAnimation,
  walkTo,
  runTo,
} from "./character";
import { pixelToTile, tileToPixel, getDirection, distance } from "../core/utils";
import { getLevelManager, type LevelUpResult } from "../level";
import type { GuiManager } from "../gui/guiManager";
import type { Good, GoodEffectType } from "../goods";

// C#: Thew (体力) cost constants from Player.cs
const THEW_USE_AMOUNT_WHEN_RUN = 1; // C#: Thew -= 1 in CanRunning()
// C#: Globals.IsUseThewWhenNormalRun = false by default
// Thew is only consumed when running in combat, not during normal exploration
const IS_USE_THEW_WHEN_NORMAL_RUN = false;

export interface PlayerAction {
  type: "interact" | "attack" | "use_skill" | "use_item";
  targetNpc?: NpcData;
  skillSlot?: number;
  itemSlot?: number;
}

export class PlayerController {
  private player: PlayerData;
  private isWalkable: (tile: Vector2) => boolean;
  private pendingAction: PlayerAction | null = null;
  private guiManager: GuiManager | null = null;

  // C#: _isRun flag - determined by shift key or WalkIsRun setting
  private isRun: boolean = false;
  // C#: WalkIsRun - script-controlled setting to make walk always run
  private walkIsRun: number = 0;
  // C#: IsRunDisabled - prevents running
  private isRunDisabled: boolean = false;

  // Equipment effect tracking (matches C# Player.cs)
  private isNotUseThewWhenRun: boolean = false;
  private isManaRestore: boolean = false;
  private extraLifeRestorePercent: number = 0;
  private addMoveSpeedPercent: number = 0;
  private addMagicEffectPercent: number = 0;
  private addMagicEffectAmount: number = 0;

  constructor(isWalkable: (tile: Vector2) => boolean) {
    this.isWalkable = isWalkable;

    // Create default player config (based on C# Player.cs)
    const config: CharacterConfig = {
      name: "杨影枫",
      npcIni: "z-杨影枫.ini",
      kind: CharacterKind.Player,
      relation: RelationType.None,
      group: 0,
      noAutoAttackPlayer: 0,
      stats: { ...DEFAULT_PLAYER_STATS },
      pathFinder: 1, // Player uses advanced pathfinding
    };

    this.player = createPlayerData(config, 10, 10, Direction.South);
  }

  /**
   * Set GUI manager for notifications
   */
  setGuiManager(guiManager: GuiManager): void {
    this.guiManager = guiManager;
  }

  /**
   * Show message via GUI (matches C#'s GuiManager.ShowMessage)
   */
  private showMessage(message: string): void {
    if (this.guiManager) {
      this.guiManager.showMessage(message);
    }
  }

  /**
   * Get player data
   */
  getPlayer(): PlayerData {
    return this.player;
  }

  /**
   * Set walkability checker
   */
  setWalkabilityChecker(checker: (tile: Vector2) => boolean): void {
    this.isWalkable = checker;
  }

  /**
   * Set player position
   */
  setPosition(tileX: number, tileY: number): void {
    this.player.tilePosition = { x: tileX, y: tileY };
    // C# uses ToPixelPosition directly (tile top-left corner)
    const pixel = tileToPixel(tileX, tileY);
    this.player.pixelPosition = pixel;
    this.player.path = [];
    this.player.isMoving = false;
    this.player.targetPosition = null;
    this.player.state = CharacterState.Stand;
  }

  /**
   * Set player position in pixels
   */
  setPixelPosition(x: number, y: number): void {
    this.player.pixelPosition = { x, y };
    this.player.tilePosition = pixelToTile(x, y);
  }

  /**
   * Handle input for movement
   * Based on C# Player.cs Update() method
   */
  handleInput(input: InputState, _cameraX: number, _cameraY: number): PlayerAction | null {
    this.pendingAction = null;

    // C#: _isRun = canRun(keyboardState)
    // Determines if player should run based on shift key or WalkIsRun setting
    this.isRun = this.canRun(input.isShiftDown);

    // Handle keyboard movement
    const moveDir = this.getKeyboardMoveDirection(input.keys);
    if (moveDir !== null) {
      this.moveInDirection(moveDir, this.isRun);
      return null;
    }

    // C#: Handle mouse button held down for continuous movement
    // This is the key feature - mouse HELD (not just clicked) = continuous movement
    if (input.isMouseDown && input.clickedTile) {
      const targetTile = input.clickedTile;

      // C#: if (_isRun) { RunTo(mouseTilePosition); } else { WalkTo(mouseTilePosition); }
      if (this.isRun) {
        if (this.canRunCheck()) {
          this.runToTile(targetTile.x, targetTile.y);
        } else {
          // Can't run (no thew), fall back to walk
          this.walkToTile(targetTile.x, targetTile.y);
        }
      } else {
        this.walkToTile(targetTile.x, targetTile.y);
      }
      return null;
    }

    return this.pendingAction;
  }

  /**
   * Check if player can run
   * Matches C# Player.canRun()
   */
  private canRun(isShiftDown: boolean): boolean {
    return (this.walkIsRun > 0 || isShiftDown) && !this.isRunDisabled;
  }

  /**
   * Check if player has enough thew to run
   * Matches C# Player.CanRun() (the private method)
   */
  private canRunCheck(): boolean {
    if (this.isRunDisabled) return false;
    if (this.isNotUseThewWhenRun) return true;
    // C#: Checks if Thew > 0
    return this.player.config.stats.thew > 0;
  }

  /**
   * Consume thew when running
   * Matches C# Player.CanRunning() - called when completing a path step
   *
   * C# logic (Player.cs lines 480-491):
   * - If CanRun() returns true
   * - AND !IsNotUseThewWhenRun
   * - AND (IsInFighting || Globals.IsUseThewWhenNormalRun)
   * - THEN Thew -= 1
   *
   * Default: Globals.IsUseThewWhenNormalRun = false
   * So thew is ONLY consumed when running IN COMBAT
   */
  private consumeRunningThew(): boolean {
    if (!this.canRunCheck()) return false;

    // C#: if (!IsNotUseThewWhenRun && (IsInFighting || Globals.IsUseThewWhenNormalRun)) { Thew -= 1; }
    if (!this.isNotUseThewWhenRun) {
      // TODO: Add IsInFighting check once combat system is implemented
      const isInFighting = false; // Placeholder
      if (isInFighting || IS_USE_THEW_WHEN_NORMAL_RUN) {
        this.player.config.stats.thew = Math.max(0, this.player.config.stats.thew - THEW_USE_AMOUNT_WHEN_RUN);
      }
    }
    return true;
  }

  /**
   * Get movement direction from keyboard input
   */
  private getKeyboardMoveDirection(keys: Set<string>): Direction | null {
    // 只使用方向键和小键盘移动，不使用WASD（WASD用于其他快捷键）
    const up = keys.has("ArrowUp") || keys.has("Numpad8");
    const down = keys.has("ArrowDown") || keys.has("Numpad2");
    const left = keys.has("ArrowLeft") || keys.has("Numpad4");
    const right = keys.has("ArrowRight") || keys.has("Numpad6");

    // Diagonal movement
    if (up && right) return Direction.NorthEast;
    if (up && left) return Direction.NorthWest;
    if (down && right) return Direction.SouthEast;
    if (down && left) return Direction.SouthWest;

    // Cardinal movement
    if (up) return Direction.North;
    if (down) return Direction.South;
    if (left) return Direction.West;
    if (right) return Direction.East;

    // Numpad diagonal
    if (keys.has("Numpad7")) return Direction.NorthWest;
    if (keys.has("Numpad9")) return Direction.NorthEast;
    if (keys.has("Numpad1")) return Direction.SouthWest;
    if (keys.has("Numpad3")) return Direction.SouthEast;

    return null;
  }

  /**
   * Move player in a direction
   * @param isRun Whether to run instead of walk
   */
  private moveInDirection(direction: Direction, isRun: boolean = false): void {
    const dirVectors: Vector2[] = [
      { x: 0, y: -2 },  // North
      { x: 1, y: -1 },  // NorthEast
      { x: 1, y: 0 },   // East
      { x: 1, y: 1 },   // SouthEast
      { x: 0, y: 2 },   // South
      { x: -1, y: 1 },  // SouthWest
      { x: -1, y: 0 },  // West
      { x: -1, y: -1 }, // NorthWest
    ];

    const vec = dirVectors[direction];
    const isOddRow = this.player.tilePosition.y % 2 === 1;

    // Adjust for isometric grid
    let targetX = this.player.tilePosition.x + vec.x;
    let targetY = this.player.tilePosition.y + vec.y;

    // Handle odd/even row offset for diagonal movement
    if (vec.y !== 0 && Math.abs(vec.y) === 1) {
      if (isOddRow && vec.x >= 0) {
        targetX = this.player.tilePosition.x + (vec.x > 0 ? 1 : 0);
      } else if (!isOddRow && vec.x <= 0) {
        targetX = this.player.tilePosition.x + (vec.x < 0 ? -1 : 0);
      }
    }

    const targetTile = { x: targetX, y: targetY };
    if (this.isWalkable(targetTile)) {
      this.player.direction = direction;
      this.player.path = [targetTile];
      this.player.isMoving = true;
      // C#: Set state based on run flag
      this.player.state = isRun && this.canRunCheck() ? CharacterState.Run : CharacterState.Walk;
    } else {
      // Just change direction without moving
      this.player.direction = direction;
    }
  }

  /**
   * Walk to a specific tile
   * Matches C# Character.WalkTo
   */
  walkToTile(tileX: number, tileY: number): boolean {
    return walkTo(this.player, { x: tileX, y: tileY }, this.isWalkable);
  }

  /**
   * Walk in a direction for a number of steps
   * Matches C# Character.WalkToDirection(direction, steps)
   */
  walkToDirection(direction: number, steps: number): void {
    // Direction is 8-way (0-7)
    // Calculate target tile based on direction and steps
    const dirVectors = [
      { x: 0, y: -2 },   // 0: North
      { x: 1, y: -1 },   // 1: NorthEast
      { x: 1, y: 0 },    // 2: East
      { x: 1, y: 1 },    // 3: SouthEast
      { x: 0, y: 2 },    // 4: South
      { x: -1, y: 1 },   // 5: SouthWest
      { x: -1, y: 0 },   // 6: West
      { x: -1, y: -1 },  // 7: NorthWest
    ];

    const dir = dirVectors[direction] || { x: 0, y: 0 };

    // Calculate target position
    const targetX = this.player.tilePosition.x + dir.x * steps;
    const targetY = this.player.tilePosition.y + dir.y * steps;

    // Set direction and walk
    this.player.direction = direction as Direction;
    this.walkToTile(targetX, targetY);
  }

  /**
   * Run to a specific tile
   * Matches C# Character.RunTo
   */
  runToTile(tileX: number, tileY: number): boolean {
    return runTo(this.player, { x: tileX, y: tileY }, this.isWalkable);
  }

  /**
   * Stop player movement
   */
  stopMovement(): void {
    this.player.path = [];
    this.player.isMoving = false;
    this.player.targetPosition = null;
    this.player.state = CharacterState.Stand;
  }

  /**
   * Update player state
   * Based on C# Player.cs Update() and Character.MoveAlongPath()
   */
  update(deltaTime: number): void {
    // C#: Determine speed fold based on state
    // Run uses speedFold = Globals.RunSpeedFold = 8 (8x faster!)
    // Walk uses speedFold = WalkSpeed = 1
    const isRunning = this.player.state === CharacterState.Run;
    const speedFold = isRunning ? RUN_SPEED_FOLD : 1;

    // Update movement with speed multiplier
    // C#: MoveAlongPath consumes thew only when completing a path step
    const result = updateCharacterMovement(this.player, deltaTime, this.isWalkable, speedFold);

    // C#: Consume thew when completing a movement step while running
    // This matches C# Character.MoveAlongPath (line ~1870): CanRunning() check happens after MovedDistance >= distance
    if (isRunning && result.moved && result.reachedDestination === false && this.player.path.length > 0) {
      // We moved but didn't reach final destination - consume thew per step
      if (!this.consumeRunningThew()) {
        // Can't run anymore (no thew), switch to walk
        this.player.state = CharacterState.Walk;
      }
    }

    // Update animation
    updateCharacterAnimation(this.player, deltaTime);

    // Handle state transitions
    if (!this.player.isMoving && this.player.path.length === 0) {
      if (
        this.player.state === CharacterState.Walk ||
        this.player.state === CharacterState.Run
      ) {
        this.player.state = CharacterState.Stand;
      }
    }
  }

  /**
   * Check if player is near a position
   */
  isNear(position: Vector2, threshold: number = 50): boolean {
    return distance(this.player.pixelPosition, position) <= threshold;
  }

  /**
   * Get player tile position
   */
  getTilePosition(): Vector2 {
    return { ...this.player.tilePosition };
  }

  /**
   * Get player pixel position
   */
  getPixelPosition(): Vector2 {
    return { ...this.player.pixelPosition };
  }

  /**
   * Get player direction
   */
  getDirection(): Direction {
    return this.player.direction;
  }

  /**
   * Set player direction
   */
  setDirection(direction: Direction): void {
    this.player.direction = direction;
  }

  /**
   * Set player state
   */
  setState(state: CharacterState): void {
    this.player.state = state;
    // Reset animation frame when changing states
    this.player.currentFrame = 0;
  }

  /**
   * Add experience
   * Matches C#'s Character.Exp setter with auto level-up check
   */
  addExp(amount: number): void {
    this.player.config.stats.exp += amount;
    // Check for level up
    this.checkLevelUp();
  }

  /**
   * Check and perform level up if enough experience
   * Matches C#'s experience system
   */
  private checkLevelUp(): void {
    const stats = this.player.config.stats;
    // Keep leveling up while we have enough exp
    while (stats.exp >= stats.levelUpExp && stats.levelUpExp > 0) {
      stats.exp -= stats.levelUpExp;
      this.levelUp();
    }
  }

  /**
   * Level up by one level
   * Matches C#'s Player.LevelUpTo
   */
  levelUp(): boolean {
    const newLevel = this.player.config.stats.level + 1;
    return this.levelUpTo(newLevel);
  }

  /**
   * Set level directly to a specific value
   * Matches C#'s Character.SetLevelTo implementation
   *
   * This sets all stats from the level config directly (not incrementally)
   */
  setLevelTo(level: number): void {
    const stats = this.player.config.stats;
    const levelManager = getLevelManager();
    const levelConfig = levelManager.getPlayerLevelConfig();

    stats.level = level;
    console.log(`[PlayerController] SetLevelTo: setting level to ${level}`);

    if (!levelConfig) {
      console.log(`[PlayerController] SetLevelTo: no level config loaded`);
      return;
    }

    const detail = levelConfig.get(level);
    if (!detail) {
      console.log(`[PlayerController] SetLevelTo: no detail for level ${level}`);
      return;
    }

    // Set all stats directly from level config (matches C#'s SetLevelTo)
    stats.lifeMax = detail.lifeMax;
    stats.thewMax = detail.thewMax;
    stats.manaMax = detail.manaMax;
    stats.life = stats.lifeMax;
    stats.thew = stats.thewMax;
    stats.mana = stats.manaMax;
    stats.attack = detail.attack;
    stats.defend = detail.defend;
    stats.evade = detail.evade;
    stats.levelUpExp = detail.levelUpExp;

    console.log(`[PlayerController] SetLevelTo: stats updated - life=${stats.lifeMax}, attack=${stats.attack}, defend=${stats.defend}`);
  }

  /**
   * Level up to a specific level
   * Matches C#'s Player.LevelUpTo implementation
   *
   * C# Reference (Character.cs ToLevel()):
   * - Checks if level > LevelIni.Count (max level)
   * - If at max level: sets LevelUpExp=0, Exp=0
   */
  levelUpTo(targetLevel: number): boolean {
    const stats = this.player.config.stats;
    const currentLevel = stats.level;

    if (targetLevel <= currentLevel) return false;

    const levelManager = getLevelManager();
    const levelConfig = levelManager.getPlayerLevelConfig();
    const maxLevel = levelManager.getMaxLevel();

    // Check max level cap (matches C#'s isMaxLevel check)
    if (targetLevel > maxLevel) {
      console.log(`[PlayerController] Cannot level up: target level ${targetLevel} exceeds max level ${maxLevel}`);

      // If not at max level yet, level up to max
      if (currentLevel < maxLevel) {
        return this.levelUpTo(maxLevel);
      }

      // Already at max level, ensure exp is cleared
      stats.exp = 0;
      stats.levelUpExp = 0;
      return false;
    }

    if (!levelConfig) {
      // No level config, just set level
      stats.level = targetLevel;
      // Show level up notification
      this.showMessage(`${this.player.config.name}的等级提升了`);
      return true;
    }

    const currentDetail = levelConfig.get(currentLevel);
    const targetDetail = levelConfig.get(targetLevel);

    if (!currentDetail || !targetDetail) {
      // Level not found in config - at max level
      stats.level = targetLevel;
      stats.exp = 0;
      stats.levelUpExp = 0;
      // Show level up notification
      this.showMessage(`${this.player.config.name}的等级提升了`);
      return true;
    }

    // Apply stat increases (delta between levels)
    stats.lifeMax += targetDetail.lifeMax - currentDetail.lifeMax;
    stats.thewMax += targetDetail.thewMax - currentDetail.thewMax;
    stats.manaMax += targetDetail.manaMax - currentDetail.manaMax;
    stats.attack += targetDetail.attack - currentDetail.attack;
    stats.defend += targetDetail.defend - currentDetail.defend;
    stats.evade += targetDetail.evade - currentDetail.evade;

    // Fill to max after level up
    stats.life = stats.lifeMax;
    stats.thew = stats.thewMax;
    stats.mana = stats.manaMax;

    // Update level up exp for next level
    stats.levelUpExp = targetDetail.levelUpExp;

    // Update level
    stats.level = targetLevel;

    // Check if now at max level (matches C#'s isMaxLevel logic)
    if (targetLevel >= maxLevel) {
      stats.exp = 0;
      stats.levelUpExp = 0;
      console.log(`[PlayerController] Player reached max level ${maxLevel}!`);
    }

    // TODO: Handle newMagic and newGood
    if (targetDetail.newMagic) {
      console.log(`[PlayerController] New magic at level ${targetLevel}: ${targetDetail.newMagic}`);
    }
    if (targetDetail.newGood) {
      console.log(`[PlayerController] New item at level ${targetLevel}: ${targetDetail.newGood}`);
    }

    // Show level up notification (matches C#'s GuiManager.ShowMessage)
    this.showMessage(`${this.player.config.name}的等级提升了`);

    console.log(`[PlayerController] Player leveled up to ${targetLevel}!`);
    return true;
  }

  /**
   * Initialize player stats from level configuration
   * Called when starting a new game
   */
  async initializeFromLevelConfig(level: number = 1): Promise<void> {
    const levelManager = getLevelManager();

    // Ensure level manager is initialized
    await levelManager.initialize();

    const levelConfig = levelManager.getPlayerLevelConfig();
    if (!levelConfig) {
      console.warn('[PlayerController] No level config available');
      return;
    }

    const detail = levelConfig.get(level);
    if (!detail) {
      console.warn(`[PlayerController] Level ${level} not found in config`);
      return;
    }

    const stats = this.player.config.stats;

    // Set stats from level config (matches C#'s initial player loading)
    stats.level = level;
    stats.lifeMax = detail.lifeMax;
    stats.life = detail.lifeMax; // Full life
    stats.thewMax = detail.thewMax;
    stats.thew = detail.thewMax; // Full stamina
    stats.manaMax = detail.manaMax;
    stats.mana = detail.manaMax; // Full mana
    stats.attack = detail.attack;
    stats.defend = detail.defend;
    stats.evade = detail.evade;
    stats.levelUpExp = detail.levelUpExp;
    stats.exp = 0;

    console.log(`[PlayerController] Player initialized at level ${level}:`, stats);
  }

  /**
   * Load player from INI file (e.g. Player0.ini)
   * Matches C#'s Player constructor that reads from save file
   */
  async loadFromFile(filePath: string): Promise<boolean> {
    console.log(`[PlayerController] Loading player from: ${filePath}`);
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        console.error(`[PlayerController] Failed to load player file: ${filePath}`);
        return false;
      }

      // INI files in resources are now UTF-8 encoded
      const content = await response.text();

      // Parse INI
      const lines = content.split(/\r?\n/);
      const data: Record<string, string> = {};

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('[') || trimmed.startsWith('//')) continue;

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          const value = trimmed.substring(eqIndex + 1).trim();
          data[key] = value;
        }
      }

      const stats = this.player.config.stats;

      // Load basic info
      if (data.Name) this.player.config.name = data.Name;
      if (data.NpcIni) this.player.config.npcIni = data.NpcIni;

      // Load stats (matches C# Character.Load)
      if (data.Level) stats.level = parseInt(data.Level, 10) || 1;
      if (data.Life) stats.life = parseInt(data.Life, 10) || stats.life;
      if (data.LifeMax) stats.lifeMax = parseInt(data.LifeMax, 10) || stats.lifeMax;
      if (data.Thew) stats.thew = parseInt(data.Thew, 10) || stats.thew;
      if (data.ThewMax) stats.thewMax = parseInt(data.ThewMax, 10) || stats.thewMax;
      if (data.Mana) stats.mana = parseInt(data.Mana, 10) || stats.mana;
      if (data.ManaMax) stats.manaMax = parseInt(data.ManaMax, 10) || stats.manaMax;
      if (data.Attack) stats.attack = parseInt(data.Attack, 10) || stats.attack;
      if (data.Defend) stats.defend = parseInt(data.Defend, 10) || stats.defend;
      if (data.Evade) stats.evade = parseInt(data.Evade, 10) || stats.evade;
      if (data.Exp) stats.exp = parseInt(data.Exp, 10) || 0;
      if (data.LevelUpExp) stats.levelUpExp = parseInt(data.LevelUpExp, 10) || stats.levelUpExp;
      if (data.Money) this.player.money = parseInt(data.Money, 10) || 0;

      // Load position
      if (data.MapX && data.MapY) {
        const x = parseInt(data.MapX, 10) || 10;
        const y = parseInt(data.MapY, 10) || 10;
        this.setPosition(x, y);
      }

      // Load direction
      if (data.Dir) {
        const dir = parseInt(data.Dir, 10) || 0;
        this.player.direction = dir as Direction;
      }

      console.log(`[PlayerController] Player loaded - Level: ${stats.level}, Life: ${stats.life}/${stats.lifeMax}, Attack: ${stats.attack}, Money: ${this.player.money}`);
      return true;
    } catch (error) {
      console.error(`[PlayerController] Error loading player:`, error);
      return false;
    }
  }

  /**
   * Full restore life (matches C#'s Character.FullLife)
   */
  fullLife(): void {
    this.player.config.stats.life = this.player.config.stats.lifeMax;
  }

  /**
   * Full restore thew/stamina (matches C#'s Character.FullThew)
   */
  fullThew(): void {
    this.player.config.stats.thew = this.player.config.stats.thewMax;
  }

  /**
   * Full restore mana (matches C#'s Character.FullMana)
   */
  fullMana(): void {
    this.player.config.stats.mana = this.player.config.stats.manaMax;
  }

  /**
   * Full restore all (life, thew, mana)
   */
  fullAll(): void {
    this.fullLife();
    this.fullThew();
    this.fullMana();
  }

  /**
   * Add life (can be negative for damage)
   */
  addLife(amount: number): void {
    const stats = this.player.config.stats;
    stats.life = Math.max(0, Math.min(stats.life + amount, stats.lifeMax));
  }

  /**
   * Add thew/stamina (can be negative)
   */
  addThew(amount: number): void {
    const stats = this.player.config.stats;
    stats.thew = Math.max(0, Math.min(stats.thew + amount, stats.thewMax));
  }

  /**
   * Add mana (can be negative)
   */
  addMana(amount: number): void {
    const stats = this.player.config.stats;
    stats.mana = Math.max(0, Math.min(stats.mana + amount, stats.manaMax));
  }

  /**
   * Set specific stat value
   */
  setStat(statName: string, value: number): void {
    const stats = this.player.config.stats;
    switch (statName.toLowerCase()) {
      case 'life':
        stats.life = Math.max(0, Math.min(value, stats.lifeMax));
        break;
      case 'lifemax':
        stats.lifeMax = Math.max(1, value);
        if (stats.life > stats.lifeMax) stats.life = stats.lifeMax;
        break;
      case 'thew':
        stats.thew = Math.max(0, Math.min(value, stats.thewMax));
        break;
      case 'thewmax':
        stats.thewMax = Math.max(1, value);
        if (stats.thew > stats.thewMax) stats.thew = stats.thewMax;
        break;
      case 'mana':
        stats.mana = Math.max(0, Math.min(value, stats.manaMax));
        break;
      case 'manamax':
        stats.manaMax = Math.max(1, value);
        if (stats.mana > stats.manaMax) stats.mana = stats.manaMax;
        break;
      case 'attack':
        stats.attack = value;
        break;
      case 'defend':
        stats.defend = value;
        break;
      case 'evade':
        stats.evade = value;
        break;
      case 'level':
        stats.level = value;
        break;
      case 'exp':
        stats.exp = value;
        break;
      case 'levelupexp':
        stats.levelUpExp = value;
        break;
    }
  }

  /**
   * Get stats object
   */
  getStats(): typeof this.player.config.stats {
    return this.player.config.stats;
  }

  /**
   * Check if player is at full life
   */
  isFullLife(): boolean {
    return this.player.config.stats.life >= this.player.config.stats.lifeMax;
  }

  /**
   * Add money (C#: Player._money)
   */
  addMoney(amount: number): void {
    this.player.money += amount;
  }

  /**
   * Get money
   */
  getMoney(): number {
    return this.player.money;
  }

  /**
   * Set money
   */
  setMoney(amount: number): void {
    this.player.money = Math.max(0, amount);
  }

  /**
   * Heal player (legacy, use addLife)
   */
  heal(amount: number): void {
    this.addLife(amount);
  }

  /**
   * Restore mana (legacy, use addMana)
   */
  restoreMana(amount: number): void {
    this.addMana(amount);
  }

  /**
   * Take damage
   */
  takeDamage(amount: number): boolean {
    this.player.config.stats.life -= amount;
    if (this.player.config.stats.life <= 0) {
      this.player.config.stats.life = 0;
      this.player.state = CharacterState.Death;
      return true; // Dead
    }
    return false;
  }

  /**
   * Is player dead
   */
  isDead(): boolean {
    return this.player.config.stats.life <= 0;
  }

  // ============= Equipment System =============
  // Based on C#'s Character.Equiping and Player.Equiping

  /**
   * Equip an item, optionally replacing current equipment
   * @param equip - The item to equip
   * @param currentEquip - The item being replaced (if any)
   * @param justEffectType - Only apply special effects, not basic stats
   */
  equiping(equip: Good | null, currentEquip: Good | null, justEffectType: boolean = false): void {
    const stats = this.player.config.stats;

    // Save current values for restore
    const oldLife = stats.life;
    const oldThew = stats.thew;
    const oldMana = stats.mana;

    // First unequip current item
    this.unEquiping(currentEquip, justEffectType);

    if (equip) {
      if (!justEffectType) {
        // Apply basic stat bonuses
        stats.attack += equip.attack;
        stats.attack2 += equip.attack2;
        stats.attack3 += equip.attack3;
        stats.defend += equip.defend;
        stats.defend2 += equip.defend2;
        stats.defend3 += equip.defend3;
        stats.evade += equip.evade;
        stats.lifeMax += equip.lifeMax;
        stats.thewMax += equip.thewMax;
        stats.manaMax += equip.manaMax;

        // Handle magic when equipped
        if (equip.magicIniWhenUse) {
          // TODO: Add magic to player's magic list
          this.showMessage(`获得武功：${equip.magicIniWhenUse}`);
        }
      }

      // Apply special effect types (always apply)
      const effectType = equip.theEffectType;
      switch (effectType) {
        case 1: // ThewNotLoseWhenRun (GoodEffectType.ThewNotLoseWhenRun)
          this.isNotUseThewWhenRun = true;
          break;
        case 2: // ManaRestore
          this.isManaRestore = true;
          break;
        // Enemy effects are handled during combat
      }

      // Special effect values
      if (equip.specialEffect === 1) {
        // Extra life restore
        this.extraLifeRestorePercent = equip.specialEffectValue / 100;
      }

      // Movement speed
      this.addMoveSpeedPercent += equip.changeMoveSpeedPercent;

      // Magic effect bonuses
      this.addMagicEffectPercent += equip.addMagicEffectPercent;
      this.addMagicEffectAmount += equip.addMagicEffectAmount;
    }

    // Clamp stats to max values
    if (stats.life > stats.lifeMax) stats.life = stats.lifeMax;
    if (stats.thew > stats.thewMax) stats.thew = stats.thewMax;
    if (stats.mana > stats.manaMax) stats.mana = stats.manaMax;
  }

  /**
   * Unequip an item
   * @param equip - The item to unequip
   * @param justEffectType - Only remove special effects, not basic stats
   */
  unEquiping(equip: Good | null, justEffectType: boolean = false): void {
    if (!equip) return;

    const stats = this.player.config.stats;

    if (!justEffectType) {
      // Remove basic stat bonuses
      stats.attack -= equip.attack;
      stats.attack2 -= equip.attack2;
      stats.attack3 -= equip.attack3;
      stats.defend -= equip.defend;
      stats.defend2 -= equip.defend2;
      stats.defend3 -= equip.defend3;
      stats.evade -= equip.evade;
      stats.lifeMax -= equip.lifeMax;
      stats.thewMax -= equip.thewMax;
      stats.manaMax -= equip.manaMax;

      // Handle magic when unequipped
      if (equip.magicIniWhenUse) {
        // TODO: Hide magic from player's magic list
        this.showMessage(`武功已不可使用`);
      }
    }

    // Remove special effect types
    const effectType = equip.theEffectType;
    switch (effectType) {
      case 1: // ThewNotLoseWhenRun
        this.isNotUseThewWhenRun = false;
        break;
      case 2: // ManaRestore
        this.isManaRestore = false;
        break;
    }

    // Reset special effect values
    if (equip.specialEffect === 1) {
      this.extraLifeRestorePercent = 0;
    }

    // Movement speed
    this.addMoveSpeedPercent -= equip.changeMoveSpeedPercent;

    // Magic effect bonuses
    this.addMagicEffectPercent -= equip.addMagicEffectPercent;
    this.addMagicEffectAmount -= equip.addMagicEffectAmount;

    // Clamp current values to new max values
    if (stats.life > stats.lifeMax) stats.life = stats.lifeMax;
    if (stats.thew > stats.thewMax) stats.thew = stats.thewMax;
    if (stats.mana > stats.manaMax) stats.mana = stats.manaMax;
  }

  /**
   * Use a drug item (heal/restore)
   * @param drug - The drug item to use
   * @returns true if drug was used successfully
   */
  useDrug(drug: Good): boolean {
    if (!drug) return false;

    const stats = this.player.config.stats;

    // Apply drug effects
    if (drug.life !== 0) {
      stats.life = Math.min(stats.lifeMax, Math.max(0, stats.life + drug.life));
    }
    if (drug.thew !== 0) {
      stats.thew = Math.min(stats.thewMax, Math.max(0, stats.thew + drug.thew));
    }
    if (drug.mana !== 0) {
      stats.mana = Math.min(stats.manaMax, Math.max(0, stats.mana + drug.mana));
    }

    // Handle clearing effects
    const effectType = drug.theEffectType;
    switch (effectType) {
      case 4: // ClearFrozen
        // TODO: Clear frozen status
        break;
      case 6: // ClearPoison
        // TODO: Clear poison status
        break;
      case 8: // ClearPetrifaction
        // TODO: Clear petrified status
        break;
    }

    return true;
  }

  /**
   * Get whether thew is not used when running
   */
  getIsNotUseThewWhenRun(): boolean {
    return this.isNotUseThewWhenRun;
  }

  /**
   * Get whether mana restores automatically
   */
  getIsManaRestore(): boolean {
    return this.isManaRestore;
  }
}

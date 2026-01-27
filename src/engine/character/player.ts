/**
 * Player class - based on JxqyHD Engine/Player.cs
 * Extends Character with player-specific functionality
 */
import type { Vector2, InputState, CharacterConfig } from "../core/types";
import {
  CharacterState,
  Direction,
  CharacterKind,
  RelationType,
  DEFAULT_PLAYER_STATS,
  RUN_SPEED_FOLD,
} from "../core/types";
import { Character } from "./characterBase";
import { pixelToTile, tileToPixel, getDirection, distance } from "../core/utils";
import type { LevelManager } from "../level";
import type { GuiManager } from "../gui/guiManager";
import type { Good } from "../goods";
import type { MagicSpriteState } from "../magic/types";
import { MagicMoveKind, MagicSpecialKind } from "../magic/types";

// C#: Thew cost constants from Player.cs
const THEW_USE_AMOUNT_WHEN_RUN = 1;
const IS_USE_THEW_WHEN_NORMAL_RUN = false;

/**
 * Player action type
 */
export interface PlayerAction {
  type: "interact" | "attack" | "use_skill" | "use_item";
  targetNpc?: any;
  skillSlot?: number;
  itemSlot?: number;
}

/**
 * Player class - the player character
 * Based on C# Engine/Player.cs
 */
export class Player extends Character {
  // ============= Player-specific fields (C# Player.cs) =============
  // C#: _money
  private _money: number = 0;
  // C#: _doing
  private _doing: number = 0;
  // C#: _desX, _desY
  private _desX: number = 0;
  private _desY: number = 0;
  // C#: _belong
  private _belong: number = 0;
  // C#: _fight
  private _fight: number = 0;
  // C#: _isRun
  private _isRun: boolean = false;
  // C#: WalkIsRun
  private _walkIsRun: number = 0;
  // C#: IsRunDisabled
  private _isRunDisabled: boolean = false;
  // C#: _standingMilliseconds
  private _standingMilliseconds: number = 0;
  // C#: _sittedMilliseconds
  private _sittedMilliseconds: number = 0;

  // C#: _currentMagicInUse
  private _currentMagicInUse: any = null;
  // C#: _xiuLianMagic
  private _xiuLianMagic: any = null;
  // C#: _autoAttackTarget
  private _autoAttackTarget: Character | null = null;

  // Equipment effect tracking
  private _isNotUseThewWhenRun: boolean = false;
  private _isManaRestore: boolean = false;
  private _extraLifeRestorePercent: number = 0;
  private _addMagicEffectPercent: number = 0;
  private _addMagicEffectAmount: number = 0;

  // Movement state
  private _isMoving: boolean = false;
  private _targetPosition: Vector2 | null = null;

  // GUI reference
  private _guiManager: GuiManager | null = null;

  // Pending action
  private _pendingAction: PlayerAction | null = null;

  // C# Reference: LinkedList<MagicSprite> MagicSpritesInEffect
  // 当前生效的武功精灵列表（如金钟罩等 BUFF）
  private _magicSpritesInEffect: MagicSpriteState[] = [];

  // 等级管理器（通过依赖注入）
  private _levelManager: LevelManager | null = null;

  constructor(
    isWalkable?: (tile: Vector2) => boolean,
    isMapObstacle?: (tile: Vector2) => boolean
  ) {
    super();

    // Set walkability checker if provided
    if (isWalkable) {
      this.setWalkabilityChecker(isWalkable, isMapObstacle);
    }

    // Set default player config
    this._name = "杨影枫";
    this._npcIni = "z-杨影枫.ini";
    this._kind = CharacterKind.Player;
    this._relation = RelationType.None;
    this._pathFinder = 1;

    // Set default stats
    const stats = DEFAULT_PLAYER_STATS;
    this._life = stats.life;
    this._lifeMax = stats.lifeMax;
    this._mana = stats.mana;
    this._manaMax = stats.manaMax;
    this._thew = stats.thew;
    this._thewMax = stats.thewMax;
    this._attack = stats.attack;
    this._defend = stats.defend;
    this._evade = stats.evade;
    this._walkSpeed = stats.walkSpeed;
  }

  // ============= 依赖注入 =============

  /**
   * 设置等级管理器（由 GameManager 注入）
   */
  setLevelManager(levelManager: LevelManager): void {
    this._levelManager = levelManager;
  }

  // ============= Properties =============

  get money(): number {
    return this._money;
  }

  set money(value: number) {
    this._money = Math.max(0, value);
  }

  get doing(): number {
    return this._doing;
  }

  set doing(value: number) {
    this._doing = value;
  }

  get desX(): number {
    return this._desX;
  }

  set desX(value: number) {
    this._desX = value;
  }

  get desY(): number {
    return this._desY;
  }

  set desY(value: number) {
    this._desY = value;
  }

  get belong(): number {
    return this._belong;
  }

  set belong(value: number) {
    this._belong = value;
  }

  get fight(): number {
    return this._fight;
  }

  set fight(value: number) {
    this._fight = value;
  }

  get isRun(): boolean {
    return this._isRun;
  }

  get walkIsRun(): number {
    return this._walkIsRun;
  }

  set walkIsRun(value: number) {
    this._walkIsRun = value;
  }

  get isRunDisabled(): boolean {
    return this._isRunDisabled;
  }

  set isRunDisabled(value: boolean) {
    this._isRunDisabled = value;
  }

  get isMoving(): boolean {
    return this._isMoving;
  }

  get targetPosition(): Vector2 | null {
    return this._targetPosition;
  }

  // ============= GUI =============

  setGuiManager(guiManager: GuiManager): void {
    this._guiManager = guiManager;
  }

  private showMessage(message: string): void {
    if (this._guiManager) {
      this._guiManager.showMessage(message);
    }
  }

  // ============= Input Handling =============

  /**
   * Handle input for movement
   * Based on C# Player.cs Update()
   */
  handleInput(input: InputState, _cameraX: number, _cameraY: number): PlayerAction | null {
    this._pendingAction = null;

    if (this._isInSpecialAction) {
      return null;
    }

    // Determine run mode
    this._isRun = this.canRun(input.isShiftDown);

    // Handle keyboard movement
    const moveDir = this.getKeyboardMoveDirection(input.keys);
    if (moveDir !== null) {
      this.moveInDirection(moveDir, this._isRun);
      return null;
    }

    // Handle mouse movement
    if (input.isMouseDown && input.clickedTile) {
      const targetTile = input.clickedTile;

      if (this._isRun) {
        if (this.canRunCheck()) {
          this.runTo(targetTile);
        } else {
          this.walkTo(targetTile);
        }
      } else {
        this.walkTo(targetTile);
      }
      return null;
    }

    return this._pendingAction;
  }

  /**
   * Check if player can run
   */
  private canRun(isShiftDown: boolean): boolean {
    return (this._walkIsRun > 0 || isShiftDown) && !this._isRunDisabled;
  }

  /**
   * Check if player has enough thew to run
   */
  private canRunCheck(): boolean {
    if (this._isRunDisabled) return false;
    if (this._isNotUseThewWhenRun) return true;
    return this._thew > 0;
  }

  /**
   * Consume thew when running
   */
  private consumeRunningThew(): boolean {
    if (!this.canRunCheck()) return false;

    if (!this._isNotUseThewWhenRun) {
      const isInFighting = false; // TODO: combat system
      if (isInFighting || IS_USE_THEW_WHEN_NORMAL_RUN) {
        this._thew = Math.max(0, this._thew - THEW_USE_AMOUNT_WHEN_RUN);
      }
    }
    return true;
  }

  /**
   * Get movement direction from keyboard
   */
  private getKeyboardMoveDirection(keys: Set<string>): Direction | null {
    const up = keys.has("ArrowUp") || keys.has("Numpad8");
    const down = keys.has("ArrowDown") || keys.has("Numpad2");
    const left = keys.has("ArrowLeft") || keys.has("Numpad4");
    const right = keys.has("ArrowRight") || keys.has("Numpad6");

    if (up && right) return Direction.NorthEast;
    if (up && left) return Direction.NorthWest;
    if (down && right) return Direction.SouthEast;
    if (down && left) return Direction.SouthWest;

    if (up) return Direction.North;
    if (down) return Direction.South;
    if (left) return Direction.West;
    if (right) return Direction.East;

    if (keys.has("Numpad7")) return Direction.NorthWest;
    if (keys.has("Numpad9")) return Direction.NorthEast;
    if (keys.has("Numpad1")) return Direction.SouthWest;
    if (keys.has("Numpad3")) return Direction.SouthEast;

    return null;
  }

  /**
   * Move in a direction
   */
  private moveInDirection(direction: Direction, isRun: boolean = false): void {
    const dirVectors: Vector2[] = [
      { x: 0, y: -2 },
      { x: 1, y: -1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
    ];

    const vec = dirVectors[direction];
    const isOddRow = this._mapY % 2 === 1;

    let targetX = this._mapX + vec.x;
    let targetY = this._mapY + vec.y;

    if (vec.y !== 0 && Math.abs(vec.y) === 1) {
      if (isOddRow && vec.x >= 0) {
        targetX = this._mapX + (vec.x > 0 ? 1 : 0);
      } else if (!isOddRow && vec.x <= 0) {
        targetX = this._mapX + (vec.x < 0 ? -1 : 0);
      }
    }

    const targetTile = { x: targetX, y: targetY };
    if (this._isWalkable && this._isWalkable(targetTile)) {
      this._currentDirection = direction;
      this._path = [targetTile];
      this._isMoving = true;
      this._state = isRun && this.canRunCheck() ? CharacterState.Run : CharacterState.Walk;
    } else {
      this._currentDirection = direction;
    }
  }

  // ============= Movement Methods =============

  /**
   * Walk to a tile
   */
  walkToTile(tileX: number, tileY: number): boolean {
    const result = this.walkTo({ x: tileX, y: tileY });
    if (result) {
      this._isMoving = true;
      this._targetPosition = { x: tileX, y: tileY };
    } else {
      this._isMoving = false;
      this._targetPosition = null;
    }
    return result;
  }

  /**
   * Run to a tile
   */
  runToTile(tileX: number, tileY: number): boolean {
    const result = this.runTo({ x: tileX, y: tileY });
    if (result) {
      this._isMoving = true;
      this._targetPosition = { x: tileX, y: tileY };
    } else {
      this._isMoving = false;
      this._targetPosition = null;
    }
    return result;
  }

  /**
   * Stop movement
   */
  stopMovement(): void {
    this._path = [];
    this._isMoving = false;
    this._targetPosition = null;
    this._state = CharacterState.Stand;
  }

  /**
   * Check if player is standing (not walking/running)
   * C# Reference: Character.IsStanding()
   */
  isStanding(): boolean {
    return this._state === CharacterState.Stand &&
           this._path.length === 0 &&
           !this._isMoving;
  }

  // ============= Update =============

  /**
   * Update player
   */
  override update(deltaTime: number): void {
    if (!this._isVisible) return;

    if (this._isInSpecialAction) {
      // Only update animation during special action
      super.update(deltaTime);
      return;
    }

    const isRunning = this._state === CharacterState.Run;
    // C#: Walk uses WalkSpeed as speedFold, Run uses RunSpeedFold
    const speedFold = isRunning ? RUN_SPEED_FOLD : this._walkSpeed;
    const result = this.moveAlongPath(deltaTime, speedFold);

    if (isRunning && result.moved && !result.reachedDestination && this._path.length > 0) {
      if (!this.consumeRunningThew()) {
        this._state = CharacterState.Walk;
      }
    }

    // Update animation (Character.update only does animation now)
    super.update(deltaTime);

    if (!this._isMoving && this._path.length === 0) {
      if (this._state === CharacterState.Walk || this._state === CharacterState.Run) {
        this._state = CharacterState.Stand;
      }
    }

    // Update movement flag based on path
    if (this._path.length === 0) {
      this._isMoving = false;
      this._targetPosition = null;
    }
  }

  // ============= Position Methods =============

  getTilePosition(): Vector2 {
    return { x: this._mapX, y: this._mapY };
  }

  getPixelPosition(): Vector2 {
    return { ...this._positionInWorld };
  }

  getDirection(): Direction {
    return this._currentDirection as Direction;
  }

  setDirection(direction: Direction): void {
    this._currentDirection = direction;
  }

  setState(state: CharacterState): void {
    this.state = state;
  }

  setPixelPosition(x: number, y: number): void {
    this._positionInWorld = { x, y };
    const tile = pixelToTile(x, y);
    this._mapX = tile.x;
    this._mapY = tile.y;
  }

  isNear(position: Vector2, threshold: number = 50): boolean {
    return distance(this._positionInWorld, position) <= threshold;
  }

  // ============= Level & Experience =============

  addExp(amount: number): void {
    this._exp += amount;
    this.checkLevelUp();
  }

  private checkLevelUp(): void {
    while (this._exp >= this._levelUpExp && this._levelUpExp > 0) {
      this._exp -= this._levelUpExp;
      this.levelUp();
    }
  }

  levelUp(): boolean {
    const newLevel = this._level + 1;
    return this.levelUpTo(newLevel);
  }

  setLevelTo(level: number): void {
    if (!this._levelManager) {
      console.warn("[Player] LevelManager not set");
      this._level = level;
      return;
    }
    const levelConfig = this._levelManager.getPlayerLevelConfig();

    this._level = level;
    console.log(`[Player] SetLevelTo: ${level}`);

    if (!levelConfig) return;

    const detail = levelConfig.get(level);
    if (!detail) return;

    this._lifeMax = detail.lifeMax;
    this._thewMax = detail.thewMax;
    this._manaMax = detail.manaMax;
    this._life = this._lifeMax;
    this._thew = this._thewMax;
    this._mana = this._manaMax;
    this._attack = detail.attack;
    this._defend = detail.defend;
    this._evade = detail.evade;
    this._levelUpExp = detail.levelUpExp;
  }

  levelUpTo(targetLevel: number): boolean {
    const currentLevel = this._level;
    if (targetLevel <= currentLevel) return false;

    if (!this._levelManager) {
      console.warn("[Player] LevelManager not set");
      this._level = targetLevel;
      this.showMessage(`${this._name}的等级提升了`);
      return true;
    }
    const levelConfig = this._levelManager.getPlayerLevelConfig();
    const maxLevel = this._levelManager.getMaxLevel();

    if (targetLevel > maxLevel) {
      if (currentLevel < maxLevel) {
        return this.levelUpTo(maxLevel);
      }
      this._exp = 0;
      this._levelUpExp = 0;
      return false;
    }

    if (!levelConfig) {
      this._level = targetLevel;
      this.showMessage(`${this._name}的等级提升了`);
      return true;
    }

    const currentDetail = levelConfig.get(currentLevel);
    const targetDetail = levelConfig.get(targetLevel);

    if (!currentDetail || !targetDetail) {
      this._level = targetLevel;
      this._exp = 0;
      this._levelUpExp = 0;
      this.showMessage(`${this._name}的等级提升了`);
      return true;
    }

    this._lifeMax += targetDetail.lifeMax - currentDetail.lifeMax;
    this._thewMax += targetDetail.thewMax - currentDetail.thewMax;
    this._manaMax += targetDetail.manaMax - currentDetail.manaMax;
    this._attack += targetDetail.attack - currentDetail.attack;
    this._defend += targetDetail.defend - currentDetail.defend;
    this._evade += targetDetail.evade - currentDetail.evade;

    this._life = this._lifeMax;
    this._thew = this._thewMax;
    this._mana = this._manaMax;
    this._levelUpExp = targetDetail.levelUpExp;
    this._level = targetLevel;

    if (targetLevel >= maxLevel) {
      this._exp = 0;
      this._levelUpExp = 0;
    }

    this.showMessage(`${this._name}的等级提升了`);
    return true;
  }

  async initializeFromLevelConfig(level: number = 1): Promise<void> {
    if (!this._levelManager) {
      console.warn("[Player] LevelManager not set, cannot initialize from level config");
      return;
    }
    await this._levelManager.initialize();

    const levelConfig = this._levelManager.getPlayerLevelConfig();
    if (!levelConfig) return;

    const detail = levelConfig.get(level);
    if (!detail) return;

    this._level = level;
    this._lifeMax = detail.lifeMax;
    this._life = detail.lifeMax;
    this._thewMax = detail.thewMax;
    this._thew = detail.thewMax;
    this._manaMax = detail.manaMax;
    this._mana = detail.manaMax;
    this._attack = detail.attack;
    this._defend = detail.defend;
    this._evade = detail.evade;
    this._levelUpExp = detail.levelUpExp;
    this._exp = 0;
  }

  // ============= Save/Load =============

  async loadFromFile(filePath: string): Promise<boolean> {
    try {
      const response = await fetch(filePath);
      if (!response.ok) return false;

      const content = await response.text();
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

      if (data.Name) this._name = data.Name;
      if (data.NpcIni) this._npcIni = data.NpcIni;
      if (data.Level) this._level = parseInt(data.Level, 10) || 1;
      if (data.Life) this._life = parseInt(data.Life, 10);
      if (data.LifeMax) this._lifeMax = parseInt(data.LifeMax, 10);
      if (data.Thew) this._thew = parseInt(data.Thew, 10);
      if (data.ThewMax) this._thewMax = parseInt(data.ThewMax, 10);
      if (data.Mana) this._mana = parseInt(data.Mana, 10);
      if (data.ManaMax) this._manaMax = parseInt(data.ManaMax, 10);
      if (data.Attack) this._attack = parseInt(data.Attack, 10);
      if (data.Defend) this._defend = parseInt(data.Defend, 10);
      if (data.Evade) this._evade = parseInt(data.Evade, 10);
      if (data.Exp) this._exp = parseInt(data.Exp, 10) || 0;
      if (data.LevelUpExp) this._levelUpExp = parseInt(data.LevelUpExp, 10);
      if (data.Money) this._money = parseInt(data.Money, 10) || 0;

      if (data.MapX && data.MapY) {
        const x = parseInt(data.MapX, 10) || 10;
        const y = parseInt(data.MapY, 10) || 10;
        this.setPosition(x, y);
      }

      if (data.Dir) {
        this._currentDirection = parseInt(data.Dir, 10) || 0;
      }

      return true;
    } catch (error) {
      console.error(`[Player] Error loading:`, error);
      return false;
    }
  }

  // ============= Stats Methods =============

  fullAll(): void {
    this.fullLife();
    this.fullThew();
    this.fullMana();
  }

  setStat(statName: string, value: number): void {
    switch (statName.toLowerCase()) {
      case 'life':
        this.life = value;
        break;
      case 'lifemax':
        this.lifeMax = value;
        break;
      case 'thew':
        this.thew = value;
        break;
      case 'thewmax':
        this.thewMax = value;
        break;
      case 'mana':
        this.mana = value;
        break;
      case 'manamax':
        this.manaMax = value;
        break;
      case 'attack':
        this.attack = value;
        break;
      case 'defend':
        this.defend = value;
        break;
      case 'evade':
        this.evade = value;
        break;
      case 'level':
        this.level = value;
        break;
      case 'exp':
        this.exp = value;
        break;
      case 'levelupexp':
        this.levelUpExp = value;
        break;
    }
  }

  isFullLife(): boolean {
    return this._life >= this._lifeMax;
  }

  /**
   * Add money to player with message display
   * C# Reference: Player.AddMoney - shows message "你得到了 X 两银子。" or "你失去了 X 两银子。"
   */
  addMoney(amount: number): void {
    if (amount > 0) {
      this._money += amount;
      this._guiManager?.showMessage(`你得到了 ${amount} 两银子。`);
    } else if (amount < 0) {
      this._money += amount;
      if (this._money < 0) this._money = 0;
      this._guiManager?.showMessage(`你失去了 ${-amount} 两银子。`);
    }
  }

  /**
   * Add money without showing message
   * C# Reference: Player.AddMoneyValue - just adds amount, no message
   */
  addMoneyValue(amount: number): void {
    this._money += amount;
    if (this._money < 0) this._money = 0;
  }

  getMoney(): number {
    return this._money;
  }

  setMoney(amount: number): void {
    this._money = Math.max(0, amount);
  }

  heal(amount: number): void {
    this.addLife(amount);
  }

  restoreMana(amount: number): void {
    this.addMana(amount);
  }

  takeDamage(amount: number): boolean {
    this._life -= amount;
    if (this._life <= 0) {
      this._life = 0;
      this._state = CharacterState.Death;
      return true;
    }
    return false;
  }

  // ============= Equipment System =============

  equiping(equip: Good | null, currentEquip: Good | null, justEffectType: boolean = false): void {
    this.unEquiping(currentEquip, justEffectType);

    if (equip) {
      if (!justEffectType) {
        this._attack += equip.attack;
        this._attack2 += equip.attack2;
        this._attack3 += equip.attack3;
        this._defend += equip.defend;
        this._defend2 += equip.defend2;
        this._defend3 += equip.defend3;
        this._evade += equip.evade;
        this._lifeMax += equip.lifeMax;
        this._thewMax += equip.thewMax;
        this._manaMax += equip.manaMax;

        if (equip.magicIniWhenUse) {
          this.showMessage(`获得武功：${equip.magicIniWhenUse}`);
        }
      }

      const effectType = equip.theEffectType;
      switch (effectType) {
        case 1:
          this._isNotUseThewWhenRun = true;
          break;
        case 2:
          this._isManaRestore = true;
          break;
      }

      if (equip.specialEffect === 1) {
        this._extraLifeRestorePercent = equip.specialEffectValue / 100;
      }

      this._addMoveSpeedPercent += equip.changeMoveSpeedPercent;
      this._addMagicEffectPercent += equip.addMagicEffectPercent;
      this._addMagicEffectAmount += equip.addMagicEffectAmount;
    }

    if (this._life > this._lifeMax) this._life = this._lifeMax;
    if (this._thew > this._thewMax) this._thew = this._thewMax;
    if (this._mana > this._manaMax) this._mana = this._manaMax;
  }

  unEquiping(equip: Good | null, justEffectType: boolean = false): void {
    if (!equip) return;

    if (!justEffectType) {
      this._attack -= equip.attack;
      this._attack2 -= equip.attack2;
      this._attack3 -= equip.attack3;
      this._defend -= equip.defend;
      this._defend2 -= equip.defend2;
      this._defend3 -= equip.defend3;
      this._evade -= equip.evade;
      this._lifeMax -= equip.lifeMax;
      this._thewMax -= equip.thewMax;
      this._manaMax -= equip.manaMax;

      if (equip.magicIniWhenUse) {
        this.showMessage(`武功已不可使用`);
      }
    }

    const effectType = equip.theEffectType;
    switch (effectType) {
      case 1:
        this._isNotUseThewWhenRun = false;
        break;
      case 2:
        this._isManaRestore = false;
        break;
    }

    if (equip.specialEffect === 1) {
      this._extraLifeRestorePercent = 0;
    }

    this._addMoveSpeedPercent -= equip.changeMoveSpeedPercent;
    this._addMagicEffectPercent -= equip.addMagicEffectPercent;
    this._addMagicEffectAmount -= equip.addMagicEffectAmount;

    if (this._life > this._lifeMax) this._life = this._lifeMax;
    if (this._thew > this._thewMax) this._thew = this._thewMax;
    if (this._mana > this._manaMax) this._mana = this._manaMax;
  }

  useDrug(drug: Good): boolean {
    if (!drug) return false;

    if (drug.life !== 0) {
      this._life = Math.min(this._lifeMax, Math.max(0, this._life + drug.life));
    }
    if (drug.thew !== 0) {
      this._thew = Math.min(this._thewMax, Math.max(0, this._thew + drug.thew));
    }
    if (drug.mana !== 0) {
      this._mana = Math.min(this._manaMax, Math.max(0, this._mana + drug.mana));
    }

    return true;
  }

  getIsNotUseThewWhenRun(): boolean {
    return this._isNotUseThewWhenRun;
  }

  getIsManaRestore(): boolean {
    return this._isManaRestore;
  }

  // ============= Magic System =============

  canUseMagic(magic: { manaCost: number; thewCost: number; lifeCost: number; lifeFullToUse: number; disableUse: number }): { canUse: boolean; reason?: string } {
    if (magic.disableUse !== 0) {
      return { canUse: false, reason: "该武功不能使用" };
    }

    if (magic.lifeFullToUse !== 0 && this._life < this._lifeMax) {
      return { canUse: false, reason: "需要满血才能使用此武功" };
    }

    if (this._mana < magic.manaCost) {
      return { canUse: false, reason: "没有足够的内力使用这种武功" };
    }

    if (this._thew < magic.thewCost) {
      return { canUse: false, reason: "没有足够的体力使用这种武功" };
    }

    return { canUse: true };
  }

  consumeMagicCost(magic: { manaCost: number; thewCost: number; lifeCost: number }): void {
    this._mana = Math.max(0, this._mana - magic.manaCost);
    this._thew = Math.max(0, this._thew - magic.thewCost);
    if (magic.lifeCost !== 0) {
      this.addLife(-magic.lifeCost);
    }
  }

  getPlayerId(): string {
    return "player";
  }

  getAddMagicEffectPercent(): number {
    return this._addMagicEffectPercent;
  }

  getAddMagicEffectAmount(): number {
    return this._addMagicEffectAmount;
  }

  // ============= BUFF System (MagicSpritesInEffect) =============
  // C# Reference: Character.cs - LinkedList<MagicSprite> MagicSpritesInEffect

  /**
   * 添加武功精灵到生效列表（如金钟罩等 BUFF）
   * C# Reference: MagicManager.AddFollowCharacterMagicSprite - case 3,6
   */
  addMagicSpriteInEffect(sprite: MagicSpriteState): void {
    // 检查是否已有同名武功
    const existingIndex = this._magicSpritesInEffect.findIndex(
      s => s.magic.name === sprite.magic.name
    );

    if (existingIndex >= 0) {
      // 已有同名武功，更新为新的（重置持续时间）
      this._magicSpritesInEffect[existingIndex] = sprite;
      console.log(`[Player] BUFF reset: ${sprite.magic.name}`);
    } else {
      // 添加新的武功精灵
      this._magicSpritesInEffect.push(sprite);
      console.log(`[Player] BUFF added: ${sprite.magic.name}, effect=${sprite.currentEffect}`);
    }
  }

  /**
   * 移除武功精灵（当精灵销毁时调用）
   * C# Reference: Character.Update - 清理 IsDestroyed 的精灵
   */
  removeMagicSpriteInEffect(spriteId: number): void {
    const index = this._magicSpritesInEffect.findIndex(s => s.id === spriteId);
    if (index >= 0) {
      const removed = this._magicSpritesInEffect.splice(index, 1)[0];
      console.log(`[Player] BUFF removed: ${removed.magic.name}`);
    }
  }

  /**
   * 清理已销毁的武功精灵
   * C# Reference: Character.Update - for (var node = MagicSpritesInEffect.First; ...)
   */
  cleanupDestroyedMagicSprites(): void {
    this._magicSpritesInEffect = this._magicSpritesInEffect.filter(s => !s.isDestroyed);
  }

  /**
   * 获取当前生效的武功精灵列表
   */
  getMagicSpritesInEffect(): MagicSpriteState[] {
    return this._magicSpritesInEffect;
  }

  /**
   * 计算武功减伤量（金钟罩等）
   * C# Reference: MagicSprite.CharacterHited
   * foreach (var magicSprite in character.MagicSpritesInEffect)
   *   if (magic.MoveKind == 13 && magic.SpecialKind == 3)
   *     effect -= MagicManager.GetEffectAmount(magic, character);
   */
  calculateDamageReduction(): { effect: number; effect2: number; effect3: number } {
    let reductionEffect = 0;
    let reductionEffect2 = 0;
    let reductionEffect3 = 0;

    for (const sprite of this._magicSpritesInEffect) {
      const magic = sprite.magic;

      // MoveKind=13 (FollowCharacter) + SpecialKind=3 (BuffOrPetrify) = 防护类 BUFF
      if (magic.moveKind === MagicMoveKind.FollowCharacter &&
          magic.specialKind === MagicSpecialKind.BuffOrPetrify) {
        // C#: MagicManager.GetEffectAmount(magic, character)
        // = (magic.Effect == 0 ? character.Attack : magic.Effect) + magic.EffectExt
        const effect = (magic.effect === 0 ? this._attack : magic.effect) + magic.effectExt;
        const effect2 = magic.effect2;
        const effect3 = magic.effect3;

        reductionEffect += effect;
        reductionEffect2 += effect2;
        reductionEffect3 += effect3;

        console.log(`[Player] BUFF damage reduction from ${magic.name}: ${effect}/${effect2}/${effect3}`);
      }
    }

    return {
      effect: reductionEffect,
      effect2: reductionEffect2,
      effect3: reductionEffect3,
    };
  }

  /**
   * 检查是否有免疫伤害的 BUFF（SpecialKind=6）
   * C# Reference: Character.DecreaseLifeAddHurt
   */
  hasImmunityBuff(): boolean {
    for (const sprite of this._magicSpritesInEffect) {
      const magic = sprite.magic;
      if (magic.moveKind === MagicMoveKind.FollowCharacter &&
          magic.specialKind === MagicSpecialKind.Buff) {
        return true;
      }
    }
    return false;
  }
}

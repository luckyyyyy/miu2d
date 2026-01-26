/**
 * Cheat Manager - Debug and cheat functionality
 * Based on JxqyHD Helper/cheat.txt and GameEditor/GameEditor.cs
 *
 * Original cheat keys (from C# Helper/cheat.txt):
 * - Shift+A: Full life, thew, mana
 * - Shift+L: Level up by 1
 * - Shift+K: Current magic level up
 * - Shift+M: Add 1000 money
 * - Shift+G: Toggle god mode (invincible)
 * - Shift+U: When god mode is off, reduce 1000 life (can cause death)
 * - Shift+Backspace: Kill all active enemies
 * - Shift+I: Reset magic and items to preset values
 *
 * Activation: Shift+F12 to toggle cheat mode
 */

import type { PlayerController } from "../character/playerController";
import type { NpcManager } from "../character/npcManager";
import type { GuiManager } from "../gui/guiManager";

export interface CheatManagerConfig {
  onMessage?: (message: string) => void;
}

export class CheatManager {
  private enabled: boolean = false;
  private godMode: boolean = false;
  private playerController: PlayerController | null = null;
  private npcManager: NpcManager | null = null;
  private guiManager: GuiManager | null = null;
  private config: CheatManagerConfig;

  constructor(config: CheatManagerConfig = {}) {
    this.config = config;
  }

  /**
   * Set game system references
   */
  setSystems(
    playerController: PlayerController,
    npcManager: NpcManager,
    guiManager: GuiManager
  ): void {
    this.playerController = playerController;
    this.npcManager = npcManager;
    this.guiManager = guiManager;
  }

  /**
   * Show message (via GUI or callback)
   */
  private showMessage(message: string): void {
    console.log(`[CheatManager] ${message}`);
    if (this.guiManager) {
      this.guiManager.showMessage(message);
    }
    if (this.config.onMessage) {
      this.config.onMessage(message);
    }
  }

  /**
   * Check if cheat mode is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check if god mode is active
   */
  isGodMode(): boolean {
    return this.godMode;
  }

  /**
   * Toggle cheat mode (Shift+F12)
   * @param silent - If true, don't show message (for auto-enable on startup)
   */
  toggleCheatMode(silent: boolean = false): void {
    this.enabled = !this.enabled;
    if (!silent) {
      const status = this.enabled ? "开启" : "关闭";
      this.showMessage(`作弊模式已${status}`);
    }
    console.log(`[CheatManager] Cheat mode ${this.enabled ? "ENABLED" : "DISABLED"}`);
  }

  /**
   * Handle cheat key input
   * Returns true if input was handled as a cheat
   */
  handleInput(code: string, shiftKey: boolean): boolean {
    // Check for toggle key (Shift+F12)
    if (code === "F12" && shiftKey) {
      this.toggleCheatMode();
      return true;
    }

    // Only process cheats if enabled
    if (!this.enabled || !shiftKey) {
      return false;
    }

    switch (code) {
      case "KeyA":
        this.cheatFullAll();
        return true;

      case "KeyL":
        this.cheatLevelUp();
        return true;

      case "KeyK":
        this.cheatMagicLevelUp();
        return true;

      case "KeyM":
        this.cheatAddMoney();
        return true;

      case "KeyG":
        this.cheatToggleGodMode();
        return true;

      case "KeyU":
        this.cheatReduceLife();
        return true;

      case "Backspace":
        this.cheatKillAllEnemies();
        return true;

      case "KeyI":
        this.cheatResetItems();
        return true;

      // Additional debug cheats
      case "KeyP":
        this.debugShowPosition();
        return true;

      case "KeyV":
        this.debugShowVariables();
        return true;

      default:
        return false;
    }
  }

  // ============= Cheat Functions =============

  /**
   * Shift+A: Full life, thew, mana
   */
  cheatFullAll(): void {
    if (!this.playerController) return;
    this.playerController.fullAll();
    this.showMessage("生命、体力、内力已满");
  }

  /**
   * Shift+L: Level up by 1
   * Note: The level-up message is now shown by PlayerController.levelUpTo()
   */
  cheatLevelUp(): void {
    if (!this.playerController) return;
    const success = this.playerController.levelUp();
    if (!success) {
      // Only show message on failure (max level reached)
      const level = this.playerController.getStats().level;
      this.showMessage(`已达到最高等级: ${level}`);
    }
    // Success message is handled by PlayerController.levelUpTo()
  }

  /**
   * Shift+K: Current magic level up
   * TODO: Implement when magic system is ready
   */
  cheatMagicLevelUp(): void {
    this.showMessage("当前修炼武功升级 (未实现)");
    // TODO: Implement magic level up
  }

  /**
   * Shift+M: Add 1000 money
   */
  cheatAddMoney(amount: number = 1000): void {
    if (!this.playerController) return;
    this.playerController.addMoney(amount);
    const total = this.playerController.getMoney();
    this.showMessage(`获得 ${amount} 两银子，共 ${total} 两`);
  }

  /**
   * Shift+G: Toggle god mode (invincible)
   */
  cheatToggleGodMode(): void {
    this.godMode = !this.godMode;
    const status = this.godMode ? "开启" : "关闭";
    this.showMessage(`无敌模式已${status}`);
  }

  /**
   * Shift+U: Reduce 1000 life (only when god mode is off)
   */
  cheatReduceLife(amount: number = 1000): void {
    if (!this.playerController) return;

    if (this.godMode) {
      this.showMessage("无敌模式开启中，无法减血");
      return;
    }

    this.playerController.addLife(-amount);
    const stats = this.playerController.getStats();
    this.showMessage(`减血 ${amount}，剩余生命: ${stats.life}`);

    // Check for death
    if (stats.life <= 0) {
      this.showMessage("主角死亡！");
    }
  }

  /**
   * Shift+Backspace: Kill all active enemies
   */
  cheatKillAllEnemies(): void {
    if (!this.npcManager) {
      this.showMessage("秒杀所有敌人 (NPC管理器未就绪)");
      return;
    }

    const killed = this.npcManager.killAllEnemies();
    this.showMessage(`秒杀 ${killed} 个敌人`);
  }

  /**
   * Shift+I: Reset items and magic to preset values
   * TODO: Implement when inventory system is ready
   */
  cheatResetItems(): void {
    this.showMessage("重置物品和武功 (未实现)");
    // TODO: Implement item reset
  }

  // ============= Debug Functions =============

  /**
   * Debug: Show player position
   */
  debugShowPosition(): void {
    if (!this.playerController) return;
    const tile = this.playerController.getTilePosition();
    const pixel = this.playerController.getPixelPosition();
    this.showMessage(`位置: 格(${tile.x}, ${tile.y}) 像素(${Math.round(pixel.x)}, ${Math.round(pixel.y)})`);
  }

  /**
   * Debug: Show game variables
   * TODO: Implement when we have access to variable storage
   */
  debugShowVariables(): void {
    this.showMessage("显示变量 (需要GameManager集成)");
  }

  /**
   * Direct cheat: Set player level
   */
  setPlayerLevel(level: number): void {
    if (!this.playerController) return;
    this.playerController.levelUpTo(level);
    this.showMessage(`设置等级为 ${level}`);
  }

  /**
   * Direct cheat: Set player money
   */
  setPlayerMoney(amount: number): void {
    if (!this.playerController) return;
    this.playerController.setMoney(amount);
    this.showMessage(`设置金钱为 ${amount}`);
  }

  /**
   * Direct cheat: Add experience
   */
  addExp(amount: number): void {
    if (!this.playerController) return;
    this.playerController.addExp(amount);
    const stats = this.playerController.getStats();
    this.showMessage(`获得 ${amount} 经验，当前: ${stats.exp}/${stats.levelUpExp}`);
  }

  /**
   * Direct cheat: Teleport player
   */
  teleport(tileX: number, tileY: number): void {
    if (!this.playerController) return;
    this.playerController.setPosition(tileX, tileY);
    this.showMessage(`传送到 (${tileX}, ${tileY})`);
  }

  /**
   * Check if player should take damage (respects god mode)
   */
  shouldTakeDamage(): boolean {
    return !this.godMode;
  }

  /**
   * Get cheat status for display
   */
  getStatusDisplay(): string {
    const parts: string[] = [];
    if (this.enabled) parts.push("作弊");
    if (this.godMode) parts.push("无敌");
    return parts.length > 0 ? `[${parts.join("/")}]` : "";
  }
}

// Singleton instance
let cheatManagerInstance: CheatManager | null = null;

/**
 * Get cheat manager singleton
 */
export function getCheatManager(): CheatManager {
  if (!cheatManagerInstance) {
    cheatManagerInstance = new CheatManager();
  }
  return cheatManagerInstance;
}

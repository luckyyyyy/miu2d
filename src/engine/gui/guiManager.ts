/**
 * GUI Manager - based on JxqyHD Engine/Gui/GuiManager.cs
 * Central controller for all GUI elements
 */
import type { Vector2 } from "../core/types";
import type {
  GuiManagerState,
  DialogGuiState,
  SelectionGuiState,
  SelectionOptionData,
  HudState,
  HotkeyAction,
} from "./types";
import { createDefaultGuiState } from "./types";
import { getMemoListManager } from "../listManager";

export type GuiEventHandler = (event: string, data?: any) => void;

export class GuiManager {
  private state: GuiManagerState;
  private eventHandler: GuiEventHandler | null = null;
  private typewriterSpeed: number = 50; // ms per character

  constructor() {
    this.state = createDefaultGuiState();
  }


  /**
   * Set event handler
   */
  setEventHandler(handler: GuiEventHandler): void {
    this.eventHandler = handler;
  }

  /**
   * Get current state
   */
  getState(): GuiManagerState {
    return this.state;
  }

  /**
   * Emit event
   */
  private emit(event: string, data?: any): void {
    this.eventHandler?.(event, data);
  }

  // ============= Dialog Methods =============

  /**
   * Show dialog with text and portrait
   */
  showDialog(text: string, portraitIndex: number = 0, name: string = ""): void {
    console.log(`[GuiManager] showDialog: "${text.substring(0, 50)}..." portrait=${portraitIndex}`);
    this.state.dialog = {
      isVisible: true,
      text,
      portraitIndex,
      portraitSide: "left",
      nameText: name,
      textProgress: 0,
      isComplete: false,
      // 选择模式默认值 - 参考 C# DialogGui.cs
      isInSelecting: false,
      selectA: "",
      selectB: "",
      selection: 0,
    };
    this.emit("dialog:show", { text, portraitIndex, name });
  }

  /**
   * Hide dialog
   */
  hideDialog(): void {
    this.state.dialog.isVisible = false;
    this.emit("dialog:hide");
  }

  /**
   * Check if dialog is visible
   */
  isDialogVisible(): boolean {
    return this.state.dialog.isVisible;
  }

  /**
   * Complete dialog text immediately
   */
  completeDialog(): void {
    this.state.dialog.textProgress = this.state.dialog.text.length;
    this.state.dialog.isComplete = true;
  }

  /**
   * Show dialog selection (Choose/Select command)
   * 在对话框面板上显示选择，message 显示在文本区，选项A/B 显示在选择区
   */
  showDialogSelection(message: string, selectA: string, selectB: string): void {
    this.state.dialog = {
      isVisible: true,
      text: message,
      portraitIndex: 0,
      portraitSide: "left",
      nameText: "",
      textProgress: message.length, // 立即显示完整文本
      isComplete: true,
      isInSelecting: true,
      selectA,
      selectB,
      selection: -1,
    };
    this.emit("dialog:show", { text: message, isSelecting: true });
  }

  /**
   * Handle dialog selection made
   */
  onDialogSelectionMade(selection: number): void {
    this.state.dialog.selection = selection;
    this.state.dialog.isInSelecting = false;
    this.hideDialog();
    this.emit("dialog:selection", { selection });
  }

  /**
   * Check if dialog selection is complete
   */
  isDialogSelectionEnd(): boolean {
    return !this.state.dialog.isInSelecting;
  }

  /**
   * Get dialog selection result
   */
  getDialogSelection(): number {
    return this.state.dialog.selection;
  }

  /**
   * Handle dialog click (advance or skip)
   */
  handleDialogClick(): boolean {
    if (!this.state.dialog.isVisible) return false;

    // 如果在选择模式，不处理点击（由选项按钮处理）
    if (this.state.dialog.isInSelecting) {
      return false;
    }

    if (!this.state.dialog.isComplete) {
      // Skip to end of text
      this.completeDialog();
      return true;
    } else {
      // Close dialog
      this.hideDialog();
      this.emit("dialog:closed");
      return true;
    }
  }

  /**
   * Update dialog typewriter effect
   */
  updateDialog(deltaTime: number): void {
    if (!this.state.dialog.isVisible || this.state.dialog.isComplete) return;

    const charsToAdd = (deltaTime * 1000) / this.typewriterSpeed;
    this.state.dialog.textProgress += charsToAdd;

    if (this.state.dialog.textProgress >= this.state.dialog.text.length) {
      this.state.dialog.textProgress = this.state.dialog.text.length;
      this.state.dialog.isComplete = true;
    }
  }

  // ============= Selection Methods =============

  /**
   * Show selection dialog
   * @param options - 选项列表
   * @param message - 可选的消息文本（显示在选项上方）
   */
  showSelection(options: SelectionOptionData[], message: string = ""): void {
    this.state.selection = {
      isVisible: true,
      message,
      options,
      selectedIndex: 0,
      hoveredIndex: -1,
    };
    this.emit("selection:show", { options, message });
  }

  /**
   * Hide selection
   */
  hideSelection(): void {
    this.state.selection.isVisible = false;
    this.emit("selection:hide");
  }

  /**
   * Check if selection is visible
   */
  isSelectionVisible(): boolean {
    return this.state.selection.isVisible;
  }

  /**
   * Move selection up
   */
  moveSelectionUp(): void {
    if (this.state.selection.selectedIndex > 0) {
      this.state.selection.selectedIndex--;
    }
  }

  /**
   * Move selection down
   */
  moveSelectionDown(): void {
    if (this.state.selection.selectedIndex < this.state.selection.options.length - 1) {
      this.state.selection.selectedIndex++;
    }
  }

  /**
   * Set selection hover
   */
  setSelectionHover(index: number): void {
    this.state.selection.hoveredIndex = index;
  }

  /**
   * Confirm selection
   */
  confirmSelection(): SelectionOptionData | null {
    if (!this.state.selection.isVisible) return null;

    const selectedIndex = this.state.selection.selectedIndex;
    const selected = this.state.selection.options[selectedIndex];
    if (selected && selected.enabled) {
      this.hideSelection();
      this.emit("selection:confirmed", { ...selected, index: selectedIndex });
      return selected;
    }
    return null;
  }

  /**
   * Select by index
   */
  selectByIndex(index: number): SelectionOptionData | null {
    if (index >= 0 && index < this.state.selection.options.length) {
      this.state.selection.selectedIndex = index;
      return this.confirmSelection();
    }
    return null;
  }

  // ============= HUD Methods =============

  /**
   * Update HUD values
   */
  updateHud(
    life: number,
    lifeMax: number,
    mana: number,
    manaMax: number,
    thew: number,
    thewMax: number
  ): void {
    this.state.hud.life = life;
    this.state.hud.lifeMax = lifeMax;
    this.state.hud.mana = mana;
    this.state.hud.manaMax = manaMax;
    this.state.hud.thew = thew;
    this.state.hud.thewMax = thewMax;
  }

  /**
   * Show message
   */
  showMessage(text: string, duration: number = 3000): void {
    this.state.hud.messageText = text;
    this.state.hud.messageVisible = true;
    this.state.hud.messageTimer = duration;
    this.emit("message:show", { text, duration });
  }

  /**
   * Hide message
   */
  hideMessage(): void {
    this.state.hud.messageVisible = false;
    this.emit("message:hide");
  }

  /**
   * Update message timer
   */
  updateMessage(deltaTime: number): void {
    if (this.state.hud.messageVisible && this.state.hud.messageTimer > 0) {
      this.state.hud.messageTimer -= deltaTime * 1000;
      if (this.state.hud.messageTimer <= 0) {
        this.hideMessage();
      }
    }
  }

  /**
   * Toggle minimap
   */
  toggleMinimap(): void {
    this.state.hud.minimapVisible = !this.state.hud.minimapVisible;
  }

  // ============= Panel Methods (对应 C# GuiManager 中的面板切换) =============

  /**
   * Toggle state panel (状态面板)
   */
  toggleStateGui(): void {
    this.state.panels.state = !this.state.panels.state;
    // 打开状态面板时关闭其他左侧面板
    if (this.state.panels.state) {
      this.state.panels.equip = false;
      this.state.panels.xiulian = false;
    }
    this.emit("panel:state", this.state.panels.state);
  }

  /**
   * Toggle equip panel (装备面板)
   */
  toggleEquipGui(): void {
    this.state.panels.equip = !this.state.panels.equip;
    // 打开装备面板时关闭其他左侧面板
    if (this.state.panels.equip) {
      this.state.panels.state = false;
      this.state.panels.xiulian = false;
    }
    this.emit("panel:equip", this.state.panels.equip);
  }

  /**
   * Toggle xiulian panel (修炼面板)
   */
  toggleXiuLianGui(): void {
    this.state.panels.xiulian = !this.state.panels.xiulian;
    // 打开修炼面板时关闭其他左侧面板
    if (this.state.panels.xiulian) {
      this.state.panels.state = false;
      this.state.panels.equip = false;
    }
    this.emit("panel:xiulian", this.state.panels.xiulian);
  }

  /**
   * Toggle goods panel (物品面板)
   */
  toggleGoodsGui(): void {
    this.state.panels.goods = !this.state.panels.goods;
    // 打开物品面板时关闭其他右侧面板
    if (this.state.panels.goods) {
      this.state.panels.magic = false;
      this.state.panels.memo = false;
    }
    this.emit("panel:goods", this.state.panels.goods);
  }

  /**
   * Toggle magic panel (武功面板)
   */
  toggleMagicGui(): void {
    this.state.panels.magic = !this.state.panels.magic;
    // 打开武功面板时关闭其他右侧面板
    if (this.state.panels.magic) {
      this.state.panels.goods = false;
      this.state.panels.memo = false;
    }
    this.emit("panel:magic", this.state.panels.magic);
  }

  /**
   * Toggle memo panel (任务面板)
   */
  toggleMemoGui(): void {
    this.state.panels.memo = !this.state.panels.memo;
    // 打开任务面板时关闭其他右侧面板
    if (this.state.panels.memo) {
      this.state.panels.goods = false;
      this.state.panels.magic = false;
    }
    this.emit("panel:memo", this.state.panels.memo);
  }

  /**
   * Show/hide system menu (系统菜单)
   */
  showSystem(show: boolean = true): void {
    this.state.panels.system = show;
    this.emit("panel:system", show);
  }

  /**
   * Toggle system menu
   */
  toggleSystemGui(): void {
    this.showSystem(!this.state.panels.system);
  }

  /**
   * Close all panels
   */
  closeAllPanels(): void {
    this.state.panels.state = false;
    this.state.panels.equip = false;
    this.state.panels.xiulian = false;
    this.state.panels.goods = false;
    this.state.panels.magic = false;
    this.state.panels.memo = false;
    this.state.panels.system = false;
    this.emit("panel:closeAll");
  }

  /**
   * Check if any panel is open
   */
  isAnyPanelOpen(): boolean {
    return (
      this.state.panels.state ||
      this.state.panels.equip ||
      this.state.panels.xiulian ||
      this.state.panels.goods ||
      this.state.panels.magic ||
      this.state.panels.memo ||
      this.state.panels.system
    );
  }

  // ============= Menu Methods =============

  /**
   * Open menu
   */
  openMenu(menu: GuiManagerState["menu"]["currentMenu"]): void {
    this.state.menu.currentMenu = menu;
    this.state.menu.isOpen = true;
    this.emit("menu:open", menu);
  }

  /**
   * Close menu
   */
  closeMenu(): void {
    this.state.menu.isOpen = false;
    this.state.menu.currentMenu = null;
    this.emit("menu:close");
  }

  /**
   * Toggle menu
   */
  toggleMenu(menu: GuiManagerState["menu"]["currentMenu"]): void {
    if (this.state.menu.isOpen && this.state.menu.currentMenu === menu) {
      this.closeMenu();
    } else {
      this.openMenu(menu);
    }
  }

  /**
   * Check if any menu is open
   */
  isMenuOpen(): boolean {
    return this.state.menu.isOpen;
  }

  // ============= Tooltip Methods =============

  /**
   * Show tooltip
   */
  showTooltip(text: string, x: number, y: number): void {
    this.state.tooltipText = text;
    this.state.tooltipPosition = { x, y };
    this.state.tooltipVisible = true;
  }

  /**
   * Hide tooltip
   */
  hideTooltip(): void {
    this.state.tooltipVisible = false;
  }

  // ============= Hotkey Handling =============

  /**
   * Handle hotkey press
   * Based on C# GuiManager.Update - handles ESC, F1-F7, Space etc.
   */
  handleHotkey(code: string): boolean {
    // Check for dialog input first (Space/Enter advances dialog)
    // Note: In dialog mode, clicking anywhere also advances - handled in DialogUI
    if (this.state.dialog.isVisible) {
      // If in selection mode, don't handle Space/Enter here
      // Selection must be made by clicking
      if (this.state.dialog.isInSelecting) {
        // ESC doesn't close selection - must choose
        return true; // Block other input while selecting
      }
      // Space/Enter advances non-selection dialog
      if (code === "Space" || code === "Enter") {
        this.handleDialogClick();
        return true;
      }
      // ESC in edit mode also advances (from C#)
      if (code === "Escape") {
        this.handleDialogClick();
        return true;
      }
      return true; // Block other input while dialog visible
    }

    // Selection interface (ChooseEx) - separate from dialog
    if (this.state.selection.isVisible) {
      if (code === "ArrowUp" || code === "KeyW") {
        this.moveSelectionUp();
        return true;
      }
      if (code === "ArrowDown" || code === "KeyS") {
        this.moveSelectionDown();
        return true;
      }
      if (code === "Space" || code === "Enter") {
        this.confirmSelection();
        return true;
      }
      // Number keys to select directly
      const numMatch = code.match(/^Digit(\d)$/);
      if (numMatch) {
        const index = parseInt(numMatch[1], 10) - 1;
        this.selectByIndex(index);
        return true;
      }
      return true; // Block other input while selecting
    }

    // System menu open - ESC closes it
    if (this.state.panels.system) {
      if (code === "Escape") {
        this.showSystem(false);
        return true;
      }
      return true; // Block other input while system menu open
    }

    // ESC key handling - based on C# GuiManager.Update
    // If any panel is open, close all panels; otherwise show system menu
    if (code === "Escape") {
      if (this.isAnyPanelOpen()) {
        this.closeAllPanels();
      } else {
        this.showSystem(true);
      }
      return true;
    }

    // F1 - State Panel (状态)
    if (code === "F1") {
      this.toggleStateGui();
      return true;
    }

    // F2 - Equip Panel (装备)
    if (code === "F2") {
      this.toggleEquipGui();
      return true;
    }

    // F3 - XiuLian Panel (修炼)
    if (code === "F3") {
      this.toggleXiuLianGui();
      return true;
    }

    // F5 - Goods Panel (物品)
    if (code === "F5") {
      this.toggleGoodsGui();
      return true;
    }

    // F6 - Magic Panel (武功)
    if (code === "F6") {
      this.toggleMagicGui();
      return true;
    }

    // F7 - Memo Panel (任务)
    if (code === "F7") {
      this.toggleMemoGui();
      return true;
    }

    // Tab - Toggle minimap/little map
    if (code === "Tab") {
      this.toggleMinimap();
      return true;
    }

    // Alternative hotkeys (I, M, E, T for common panels)
    if (code === "KeyI") {
      this.toggleGoodsGui();
      return true;
    }
    if (code === "KeyM") {
      this.toggleMagicGui();
      return true;
    }
    if (code === "KeyE") {
      this.toggleEquipGui();
      return true;
    }
    if (code === "KeyT") {
      this.toggleStateGui();
      return true;
    }

    return false;
  }

  // ============= Update =============

  /**
   * Update GUI state
   */
  update(deltaTime: number): void {
    this.updateDialog(deltaTime);
    this.updateMessage(deltaTime);
  }

  /**
   * Check if any UI is blocking game input
   */
  isBlockingInput(): boolean {
    return (
      this.state.dialog.isVisible ||
      this.state.selection.isVisible ||
      this.state.menu.isOpen
    );
  }

  // ============= Memo Methods (任务系统) =============

  /**
   * Add memo text - based on C# GuiManager.AddMemo
   */
  addMemo(text: string): void {
    const memoManager = getMemoListManager();
    memoManager.addMemo(text);
    this.updateMemoView();
    this.emit("memo:added", { text });
  }

  /**
   * Delete memo text - based on C# GuiManager.DelMemo
   */
  delMemo(text: string): void {
    const memoManager = getMemoListManager();
    memoManager.delMemo(text);
    this.updateMemoView();
    this.emit("memo:deleted", { text });
  }

  /**
   * Add memo from TalkTextList ID - based on C# AddToMemo
   */
  async addToMemo(textId: number): Promise<void> {
    const memoManager = getMemoListManager();
    await memoManager.addToMemo(textId);
    this.updateMemoView();
    this.emit("memo:added", { textId });
  }

  /**
   * Get all memos
   */
  getMemoList(): string[] {
    const memoManager = getMemoListManager();
    return memoManager.getAllMemos();
  }

  /**
   * Update memo view - based on C# GuiManager.UpdateMemoView
   * Triggers UI refresh for memo panel
   */
  updateMemoView(): void {
    this.emit("memo:updated");
  }

  /**
   * Reset GUI state
   */
  reset(): void {
    this.state = createDefaultGuiState();
  }
}

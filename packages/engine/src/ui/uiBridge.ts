/**
 * UIBridge - 引擎与 UI 层之间的桥接器
 *
 * 职责：
 * 1. 监听引擎事件，转换为标准化 UI 状态
 * 2. 接收 UI 动作，转发给引擎
 * 3. 管理状态订阅者
 *
 * 这是引擎暴露给 UI 层的唯一接口，UI 层不应直接访问引擎内部。
 */

import type { EventEmitter } from "../core/eventEmitter";
import {
  GameEvents,
  type UIBuyChangeEvent,
  type UIDialogChangeEvent,
  type UIMemoChangeEvent,
  type UIMessageChangeEvent,
  type UIMultiSelectionChangeEvent,
  type UIPanelChangeEvent,
  type UISelectionChangeEvent,
  type UIVideoPlayEvent,
} from "../core/gameEvents";
import { logger } from "../core/logger";
import type { BuyManager, ShopItemInfo } from "../gui/buyManager";
import type { MemoListManager } from "../listManager/memoListManager";
import type { MagicItemInfo } from "../magic/types";
import type { Good } from "../player/goods/good";
import type { GoodsItemInfo, GoodsListManager } from "../player/goods/goodsListManager";
import type { MagicListManager } from "../player/magic/magicListManager";
import type { Player } from "../player/player";
import type { TimerManager } from "../timer/timerManager";
import type {
  IUIBridge,
  UIAction,
  UIDialogState,
  UIEquipSlots,
  UIGoodData,
  UIGoodsSlot,
  UIGoodsState,
  UIMagicSlot,
  UIMagicState,
  UIMemoEntry,
  UIMemoState,
  UIMessageState,
  UIMultiSelectionState,
  UIPanelName,
  UIPanelVisibility,
  UIPlayerState,
  UISelectionOption,
  UISelectionState,
  UIShopItem,
  UIShopState,
  UISnapshot,
  UIStateSubscriber,
  UITimerState,
  UIVideoState,
} from "./contract";

// ============= 数据转换工具 =============

function convertGoodToUIGoodData(good: Good): UIGoodData {
  return {
    fileName: good.fileName,
    name: good.name,
    kind: good.kind,
    intro: good.intro,
    iconPath: good.iconPath,
    part: good.part,
    cost: good.cost,
    sellPrice: good.sellPrice,
    life: good.life,
    lifeMax: good.lifeMax,
    thew: good.thew,
    thewMax: good.thewMax,
    mana: good.mana,
    manaMax: good.manaMax,
    attack: good.attack,
    defend: good.defend,
    evade: good.evade,
  };
}

function convertGoodsItemToSlot(info: GoodsItemInfo | null, index: number): UIGoodsSlot {
  return {
    index,
    good: info?.good ? convertGoodToUIGoodData(info.good) : null,
    count: info?.count ?? 0,
  };
}

function convertMagicInfoToSlot(info: MagicItemInfo | null, index: number): UIMagicSlot | null {
  if (!info?.magic) return null;
  const magic = info.magic;
  return {
    index,
    magic: {
      fileName: magic.fileName,
      name: magic.name,
      intro: magic.intro,
      iconPath: magic.image ?? "",
      level: info.level,
      maxLevel: magic.maxLevel ?? 10,
      currentLevelExp: info.exp,
      levelUpExp: magic.levelupExp ?? 0,
      manaCost: magic.manaCost,
    },
  };
}

// ============= UIBridge 依赖接口 =============

export interface UIBridgeDeps {
  events: EventEmitter;
  getPlayer: () => Player | null;
  getPlayerIndex?: () => number; // C#: Globals.PlayerIndex - 用于切换角色后面板图像更新
  getGoodsListManager: () => GoodsListManager | null;
  getMagicListManager: () => MagicListManager | null;
  getBuyManager: () => BuyManager | null;
  getMemoListManager: () => MemoListManager;
  getTimerManager: () => TimerManager;
  // Panel toggles
  togglePanel: (panel: UIPanelName) => void;
  // Actions
  useItem: (index: number) => void;
  equipItem: (fromIndex: number, toSlot: string) => void;
  unequipItem: (slot: string) => void;
  swapItems: (fromIndex: number, toIndex: number) => void;
  useBottomItem: (slotIndex: number) => void;
  swapEquipSlots: (fromSlot: string, toSlot: string) => void;
  useMagic: (magicIndex: number) => Promise<void>;
  useMagicByBottom: (bottomSlot: number) => Promise<void>;
  setCurrentMagic: (magicIndex: number) => void;
  setCurrentMagicByBottom: (bottomIndex: number) => void;
  swapMagic: (fromIndex: number, toIndex: number) => void;
  assignMagicToBottom: (magicIndex: number, bottomSlot: number) => void;
  setXiuLianMagic: (magicIndex: number) => void;
  buyItem: (shopIndex: number) => Promise<boolean>;
  sellItem: (bagIndex: number) => void;
  closeShop: () => void;
  saveGame: (slotIndex: number) => Promise<boolean>;
  loadGame: (slotIndex: number) => Promise<boolean>;
  showSaveLoad: (visible: boolean) => void;
  minimapClick: (worldX: number, worldY: number) => void;
  dialogClick: () => void;
  dialogSelect: (selection: number) => void;
  selectionChoose: (index: number) => void;
  multiSelectionToggle: (index: number) => void;
  showMessage: (text: string) => void;
  showSystem: (visible: boolean) => void;
  onVideoEnd: () => void;
  // Getters for snapshot
  getPanels: () => UIPanelVisibility;
  getDialogState: () => UIDialogState;
  getSelectionState: () => UISelectionState;
  getMultiSelectionState: () => UIMultiSelectionState;
  canSaveGame: () => boolean;
}

// ============= UIBridge 实现 =============

export class UIBridge implements IUIBridge {
  private subscribers = new Set<Partial<UIStateSubscriber>>();
  private deps: UIBridgeDeps;

  // 缓存的状态版本号
  private goodsVersion = 0;
  private magicVersion = 0;
  private shopVersion = 0;

  constructor(deps: UIBridgeDeps) {
    this.deps = deps;
    this.setupEventListeners();
  }

  // ============= 事件监听 =============

  private setupEventListeners(): void {
    const { events } = this.deps;

    // 面板变化
    events.on(GameEvents.UI_PANEL_CHANGE, (event: UIPanelChangeEvent) => {
      const panels = event.panels as UIPanelVisibility;
      this.notifySubscribers("onPanelsChange", panels);
    });

    // 对话变化
    events.on(GameEvents.UI_DIALOG_CHANGE, (event: UIDialogChangeEvent) => {
      const dialog = this.convertDialogState(event.dialog);
      this.notifySubscribers("onDialogChange", dialog);
    });

    // 选择变化
    events.on(GameEvents.UI_SELECTION_CHANGE, (event: UISelectionChangeEvent) => {
      const selection = this.convertSelectionState(event.selection);
      this.notifySubscribers("onSelectionChange", selection);
    });

    // 多选变化
    events.on(GameEvents.UI_MULTI_SELECTION_CHANGE, (event: UIMultiSelectionChangeEvent) => {
      const multiSelection = this.convertMultiSelectionState(event.selection);
      this.notifySubscribers("onMultiSelectionChange", multiSelection);
    });

    // 消息变化
    events.on(GameEvents.UI_MESSAGE_CHANGE, (event: UIMessageChangeEvent) => {
      const message: UIMessageState = {
        text: event.messageText,
        isVisible: event.messageVisible,
      };
      this.notifySubscribers("onMessageChange", message);
    });

    // 玩家状态变化 (PlayerChange 切换角色后触发)
    events.on(GameEvents.UI_PLAYER_CHANGE, () => {
      const player = this.buildPlayerState();
      this.notifySubscribers("onPlayerChange", player);
    });

    // 物品变化
    events.on(GameEvents.UI_GOODS_CHANGE, () => {
      this.goodsVersion++;
      const goods = this.buildGoodsState();
      this.notifySubscribers("onGoodsChange", goods);
    });

    // 武功变化
    events.on(GameEvents.UI_MAGIC_CHANGE, () => {
      this.magicVersion++;
      const magic = this.buildMagicState();
      this.notifySubscribers("onMagicChange", magic);
    });

    // 商店变化
    events.on(GameEvents.UI_BUY_CHANGE, (_event: UIBuyChangeEvent) => {
      this.shopVersion++;
      const shop = this.buildShopState();
      this.notifySubscribers("onShopChange", shop);
    });

    // 备忘录变化
    events.on(GameEvents.UI_MEMO_CHANGE, (_event: UIMemoChangeEvent) => {
      const memo = this.buildMemoState();
      this.notifySubscribers("onMemoChange", memo);
    });

    // 视频播放
    events.on(GameEvents.UI_VIDEO_PLAY, (event: UIVideoPlayEvent) => {
      const video: UIVideoState = {
        isPlaying: true,
        videoFile: event.file,
      };
      this.notifySubscribers("onVideoChange", video);
    });

    // 视频结束
    events.on(GameEvents.UI_VIDEO_END, () => {
      const video: UIVideoState = {
        isPlaying: false,
        videoFile: null,
      };
      this.notifySubscribers("onVideoChange", video);
    });
  }

  // ============= 状态转换 =============

  private convertDialogState(state: {
    isVisible: boolean;
    text: string;
    portraitIndex: number;
    portraitSide: "left" | "right";
    nameText: string;
    textProgress: number;
    isComplete: boolean;
    isInSelecting: boolean;
    selectA: string;
    selectB: string;
    selection: number;
  }): UIDialogState {
    return {
      isVisible: state.isVisible,
      text: state.text,
      portraitIndex: state.portraitIndex,
      portraitSide: state.portraitSide,
      nameText: state.nameText,
      textProgress: state.textProgress,
      isComplete: state.isComplete,
      isInSelecting: state.isInSelecting,
      selectA: state.selectA,
      selectB: state.selectB,
      selection: state.selection,
    };
  }

  private convertSelectionState(state: {
    isVisible: boolean;
    message: string;
    options: Array<{ text: string; label: string; enabled: boolean }>;
    selectedIndex: number;
    hoveredIndex: number;
  }): UISelectionState {
    return {
      isVisible: state.isVisible,
      message: state.message,
      options: state.options.map(
        (o): UISelectionOption => ({
          text: o.text,
          label: o.label,
          enabled: o.enabled,
        })
      ),
      selectedIndex: state.selectedIndex,
      hoveredIndex: state.hoveredIndex,
    };
  }

  private convertMultiSelectionState(state: {
    isVisible: boolean;
    message: string;
    options: Array<{ text: string; label: string; enabled: boolean }>;
    columns: number;
    selectionCount: number;
    selectedIndices: number[];
  }): UIMultiSelectionState {
    return {
      isVisible: state.isVisible,
      message: state.message,
      options: state.options.map(
        (o): UISelectionOption => ({
          text: o.text,
          label: o.label,
          enabled: o.enabled,
        })
      ),
      columns: state.columns,
      selectionCount: state.selectionCount,
      selectedIndices: [...state.selectedIndices],
    };
  }

  // ============= 状态构建 =============

  private buildPlayerState(): UIPlayerState | null {
    const player = this.deps.getPlayer();
    if (!player) return null;

    // C#: Globals.PlayerIndex - 获取当前角色索引用于面板图像切换
    const playerIndex = this.deps.getPlayerIndex?.() ?? 0;

    return {
      playerIndex,
      playerName: player.name ?? "",
      level: player.level,
      exp: player.exp,
      levelUpExp: player.levelUpExp,
      life: player.life,
      lifeMax: player.lifeMax,
      thew: player.thew,
      thewMax: player.thewMax,
      mana: player.mana,
      manaMax: player.manaMax,
      manaLimit: player.manaLimit ?? false,
      attack: player.attack,
      defend: player.defend,
      evade: player.evade,
      money: player.money,
    };
  }

  private buildGoodsState(): UIGoodsState {
    const goodsManager = this.deps.getGoodsListManager();
    const player = this.deps.getPlayer();

    if (!goodsManager) {
      return {
        items: [],
        equips: {
          head: null,
          neck: null,
          body: null,
          back: null,
          hand: null,
          wrist: null,
          foot: null,
        },
        bottomGoods: [],
        money: player?.money ?? 0,
      };
    }

    // 背包物品 (1-198)
    const items: UIGoodsSlot[] = [];
    for (let i = 1; i <= 198; i++) {
      const info = goodsManager.getItemInfo(i);
      items.push(convertGoodsItemToSlot(info, i));
    }

    // 装备 (201-207)
    const equipSlots: (keyof UIEquipSlots)[] = [
      "head",
      "neck",
      "body",
      "back",
      "hand",
      "wrist",
      "foot",
    ];
    // Use a mutable version during construction, then return readonly
    const equips: {
      head: UIGoodsSlot | null;
      neck: UIGoodsSlot | null;
      body: UIGoodsSlot | null;
      back: UIGoodsSlot | null;
      hand: UIGoodsSlot | null;
      wrist: UIGoodsSlot | null;
      foot: UIGoodsSlot | null;
    } = {
      head: null,
      neck: null,
      body: null,
      back: null,
      hand: null,
      wrist: null,
      foot: null,
    };
    for (let i = 0; i < 7; i++) {
      const info = goodsManager.getItemInfo(201 + i);
      if (info?.good) {
        const slotName = equipSlots[i];
        const slot = convertGoodsItemToSlot(info, 201 + i);
        // Type-safe assignment using switch
        switch (slotName) {
          case "head":
            equips.head = slot;
            break;
          case "neck":
            equips.neck = slot;
            break;
          case "body":
            equips.body = slot;
            break;
          case "back":
            equips.back = slot;
            break;
          case "hand":
            equips.hand = slot;
            break;
          case "wrist":
            equips.wrist = slot;
            break;
          case "foot":
            equips.foot = slot;
            break;
        }
      }
    }

    // 底栏物品 (221-223)
    const bottomGoods: (UIGoodsSlot | null)[] = [];
    for (let i = 221; i <= 223; i++) {
      const info = goodsManager.getItemInfo(i);
      bottomGoods.push(info?.good ? convertGoodsItemToSlot(info, i) : null);
    }

    return {
      items,
      equips,
      bottomGoods,
      money: player?.money ?? 0,
    };
  }

  private buildMagicState(): UIMagicState {
    const magicManager = this.deps.getMagicListManager();

    if (!magicManager) {
      return {
        storeMagics: [],
        bottomMagics: [],
        xiuLianMagic: null,
      };
    }

    // 武功仓库 (1-45)
    const storeMagics: (UIMagicSlot | null)[] = [];
    for (let i = 1; i <= 45; i++) {
      const info = magicManager.getItemInfo(i);
      storeMagics.push(convertMagicInfoToSlot(info, i));
    }

    // 底栏武功 (46-48)
    const bottomMagics: (UIMagicSlot | null)[] = [];
    for (let i = 46; i <= 48; i++) {
      const info = magicManager.getItemInfo(i);
      bottomMagics.push(convertMagicInfoToSlot(info, i));
    }

    // 修炼武功 (49)
    const xiuLianInfo = magicManager.getItemInfo(49);
    const xiuLianMagic = convertMagicInfoToSlot(xiuLianInfo, 49);

    return {
      storeMagics,
      bottomMagics,
      xiuLianMagic,
    };
  }

  private buildShopState(): UIShopState {
    const buyManager = this.deps.getBuyManager();

    if (!buyManager || !buyManager.isOpen()) {
      return {
        isOpen: false,
        items: [],
        buyPercent: 100,
        numberValid: false,
        canSellSelfGoods: true,
      };
    }

    const shopItems = buyManager.getGoodsArray();
    const items: (UIShopItem | null)[] = shopItems.map((item: ShopItemInfo | null) => {
      if (!item?.good) return null;
      // ShopItemInfo has good and count, price is calculated from good.cost * buyPercent
      const price = Math.floor((item.good.cost * buyManager.getBuyPercent()) / 100);
      return {
        good: convertGoodToUIGoodData(item.good),
        price,
        count: item.count,
      };
    });

    return {
      isOpen: true,
      items,
      buyPercent: buyManager.getBuyPercent(),
      numberValid: buyManager.isNumberValid(),
      canSellSelfGoods: buyManager.getCanSellSelfGoods(),
    };
  }

  private buildMemoState(): UIMemoState {
    const memoManager = this.deps.getMemoListManager();
    const memos = memoManager.getAllMemos();

    return {
      // getAllMemos returns string[], we convert to UIMemoEntry with sequential IDs
      memos: memos.map(
        (text, index): UIMemoEntry => ({
          id: index,
          text: text,
        })
      ),
    };
  }

  private buildTimerState(): UITimerState {
    const timerManager = this.deps.getTimerManager();
    const state = timerManager.getState();

    return {
      isRunning: state.isRunning,
      seconds: state.seconds,
      isHidden: state.isHidden,
    };
  }

  // ============= 公共 API =============

  subscribe(subscriber: Partial<UIStateSubscriber>): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  dispatch(action: UIAction): void {
    logger.debug("[UIBridge] dispatch:", action.type);

    switch (action.type) {
      // 面板控制
      case "TOGGLE_PANEL":
        this.deps.togglePanel(action.panel);
        break;
      case "CLOSE_PANEL":
        // 注：togglePanel 已可实现面板开关，此 action 备用
        logger.debug("[UIBridge] CLOSE_PANEL: use TOGGLE_PANEL instead");
        break;
      case "OPEN_PANEL":
        // 注：togglePanel 已可实现面板开关，此 action 备用
        logger.debug("[UIBridge] OPEN_PANEL: use TOGGLE_PANEL instead");
        break;

      // 对话
      case "DIALOG_CLICK":
        this.deps.dialogClick();
        break;
      case "DIALOG_SELECT":
        this.deps.dialogSelect(action.selection);
        break;

      // 选择
      case "SELECTION_CHOOSE":
        this.deps.selectionChoose(action.index);
        break;
      case "MULTI_SELECTION_TOGGLE":
        this.deps.multiSelectionToggle(action.index);
        break;

      // 物品
      case "USE_ITEM":
        this.deps.useItem(action.index);
        break;
      case "EQUIP_ITEM":
        this.deps.equipItem(action.fromIndex, action.toSlot);
        break;
      case "UNEQUIP_ITEM":
        this.deps.unequipItem(action.slot);
        break;
      case "SWAP_ITEMS":
        this.deps.swapItems(action.fromIndex, action.toIndex);
        break;
      case "USE_BOTTOM_ITEM":
        this.deps.useBottomItem(action.slotIndex);
        break;
      case "SWAP_EQUIP_SLOTS":
        this.deps.swapEquipSlots(action.fromSlot, action.toSlot);
        break;

      // 武功
      case "USE_MAGIC":
        this.deps.useMagic(action.magicIndex);
        break;
      case "USE_MAGIC_BY_BOTTOM":
        this.deps.useMagicByBottom(action.bottomSlot);
        break;
      case "SET_CURRENT_MAGIC":
        this.deps.setCurrentMagic(action.magicIndex);
        break;
      case "SET_CURRENT_MAGIC_BY_BOTTOM":
        this.deps.setCurrentMagicByBottom(action.bottomIndex);
        break;
      case "SWAP_MAGIC":
        this.deps.swapMagic(action.fromIndex, action.toIndex);
        break;
      case "ASSIGN_MAGIC_TO_BOTTOM":
        this.deps.assignMagicToBottom(action.magicIndex, action.bottomSlot);
        break;
      case "SET_XIULIAN_MAGIC":
        this.deps.setXiuLianMagic(action.magicIndex);
        break;

      // 商店
      case "BUY_ITEM":
        this.deps.buyItem(action.shopIndex);
        break;
      case "SELL_ITEM":
        this.deps.sellItem(action.bagIndex);
        break;
      case "CLOSE_SHOP":
        this.deps.closeShop();
        break;

      // 存档
      case "SAVE_GAME":
        this.deps.saveGame(action.slotIndex);
        break;
      case "LOAD_GAME":
        this.deps.loadGame(action.slotIndex);
        break;
      case "SHOW_SAVE_LOAD":
        this.deps.showSaveLoad(action.visible);
        break;

      // 小地图
      case "MINIMAP_CLICK":
        this.deps.minimapClick(action.worldX, action.worldY);
        break;

      // 视频
      case "VIDEO_END":
        this.deps.onVideoEnd();
        break;

      // 系统
      case "SHOW_MESSAGE":
        this.deps.showMessage(action.text);
        break;
      case "SHOW_SYSTEM":
        this.deps.showSystem(action.visible);
        break;
      case "EXIT_GAME":
        // Web 应用无法真正退出，仅显示提示
        logger.log("[UIBridge] EXIT_GAME: Web app cannot exit, consider returning to main menu");
        break;

      default:
        logger.warn("[UIBridge] Unknown action:", (action as UIAction).type);
    }
  }

  getSnapshot(): UISnapshot {
    return {
      player: this.buildPlayerState(),
      panels: this.deps.getPanels(),
      dialog: this.deps.getDialogState(),
      selection: this.deps.getSelectionState(),
      multiSelection: this.deps.getMultiSelectionState(),
      message: { text: "", isVisible: false },
      goods: this.buildGoodsState(),
      magic: this.buildMagicState(),
      shop: this.buildShopState(),
      memo: this.buildMemoState(),
      timer: this.buildTimerState(),
      npcLifeBar: { isVisible: false, name: "", life: 0, lifeMax: 0 },
      minimap: {
        isVisible: false,
        mapName: "",
        mapDisplayName: "",
        playerPosition: { x: 0, y: 0 },
        cameraPosition: { x: 0, y: 0 },
        characters: [],
        mapWidth: 0,
        mapHeight: 0,
        mapData: null,
      },
      video: { isPlaying: false, videoFile: null },
      saveLoad: {
        isVisible: false,
        canSave: this.deps.canSaveGame(),
        slots: [],
      },
    };
  }

  requestRefresh(state: "goods" | "magic" | "shop" | "memo" | "all"): void {
    switch (state) {
      case "goods":
        this.notifySubscribers("onGoodsChange", this.buildGoodsState());
        break;
      case "magic":
        this.notifySubscribers("onMagicChange", this.buildMagicState());
        break;
      case "shop":
        this.notifySubscribers("onShopChange", this.buildShopState());
        break;
      case "memo":
        this.notifySubscribers("onMemoChange", this.buildMemoState());
        break;
      case "all":
        this.notifySubscribers("onPlayerChange", this.buildPlayerState());
        this.notifySubscribers("onGoodsChange", this.buildGoodsState());
        this.notifySubscribers("onMagicChange", this.buildMagicState());
        this.notifySubscribers("onShopChange", this.buildShopState());
        this.notifySubscribers("onMemoChange", this.buildMemoState());
        break;
    }
  }

  // ============= 内部方法 =============

  private notifySubscribers<K extends keyof UIStateSubscriber>(method: K, data: unknown): void {
    for (const subscriber of this.subscribers) {
      const handler = subscriber[method];
      if (handler) {
        try {
          (handler as (arg: unknown) => void)(data);
        } catch (error) {
          logger.error(`[UIBridge] Subscriber error in ${method}:`, error);
        }
      }
    }
  }
}

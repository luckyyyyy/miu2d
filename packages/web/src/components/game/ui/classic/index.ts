/**
 * Classic UI components - ASF-based retro style
 * 经典复古风格游戏 UI（基于 ASF 精灵）
 */

// ASF Animated Sprite - 高性能动画精灵组件
export { AsfAnimatedSprite } from "./AsfAnimatedSprite";

// Hooks
export * from "./hooks";

// Top GUI
export { TopGui } from "./TopGui";

// Bottom GUI
export type { BottomSlotDragData } from "./BottomGui";
export { BottomGui } from "./BottomGui";

// Bottom State GUI
export { BottomStateGui } from "./BottomStateGui";

// Dialog UI
export { DialogUI } from "./DialogUI";

// Selection UI
export { SelectionUI } from "./SelectionUI";
export { SelectionMultipleUI } from "./SelectionMultipleUI";

// Message GUI
export { MessageGui } from "./MessageGui";

// State GUI
export type { PlayerStats } from "./StateGui";
export { StateGui } from "./StateGui";

// Equip GUI
export type { DragData, EquipItemData, EquipSlots, EquipSlotType } from "./EquipGui";
export { EquipGui, equipPositionToSlotType, slotTypeToEquipPosition } from "./EquipGui";

// Goods GUI
export type { GoodItemData } from "./GoodsGui";
export { GoodsGui } from "./GoodsGui";

// Magic GUI
export type { MagicDragData, MagicItem } from "./MagicGui";
export { MagicGui } from "./MagicGui";

// Memo GUI
export { MemoGui } from "./MemoGui";

// XiuLian GUI
export type { XiuLianMagic } from "./XiuLianGui";
export { XiuLianGui } from "./XiuLianGui";

// System GUI
export { SystemGui } from "./SystemGui";

// Buy GUI
export type { ShopItemData } from "./BuyGui";
export { BuyGui } from "./BuyGui";

// SaveLoad GUI
export { SaveLoadGui } from "./SaveLoadGui";

// Title GUI
export { TitleGui } from "./TitleGui";
export type { TitleSettingsModalProps } from "./TitleSettingsModal";
export { TitleSettingsModal } from "./TitleSettingsModal";

// Little Map GUI
export type { CharacterMarker } from "./LittleMapGui";
export { LittleMapGui } from "./LittleMapGui";

// Little Head GUI (Partner portraits)
export type { PartnerInfo } from "./LittleHeadGui";
export { LittleHeadGui } from "./LittleHeadGui";

// NPC Equipment GUI
export type { EquipSlots as NpcEquipSlots, DragData as NpcDragData } from "./NpcEquipGui";
export { NpcEquipGui } from "./NpcEquipGui";

// NPC Life Bar
export { NpcLifeBar } from "./NpcLifeBar";

// Timer GUI
export { TimerGui } from "./TimerGui";

// Video Player
export { VideoPlayer } from "./VideoPlayer";

// Game Cursor
export { GameCursor, GameCursorContainer } from "./GameCursor";
export {
  initGameCursor,
  enableGameCursor,
  disableGameCursor,
  destroyGameCursor,
  isGameCursorEnabled,
  isGameCursorInitialized,
} from "./gameCursorManager";

// Item Tooltip
export type { TooltipState } from "./ItemTooltip";
export { defaultTooltipState, ItemTooltip } from "./ItemTooltip";

// Magic Tooltip
export type { MagicTooltipState } from "./MagicTooltip";
export { defaultMagicTooltipState, MagicTooltip } from "./MagicTooltip";

// ScrollBar
export { ScrollBar } from "./ScrollBar";

/**
 * UI components exports
 */
export { DialogUI } from "./DialogUI";
export { SelectionUI } from "./SelectionUI";
export { HUD } from "./HUD";
export { TopGui } from "./TopGui";
export { BottomGui } from "./BottomGui";
export { BottomStateGui } from "./BottomStateGui";
export { TitleGui } from "./TitleGui";
export { MessageGui } from "./MessageGui";

// Panel GUIs - 对应 C# 的各个面板
export { StateGui } from "./StateGui";
export type { PlayerStats } from "./StateGui";
export { EquipGui, equipPositionToSlotType, slotTypeToEquipPosition } from "./EquipGui";
export type { EquipItemData, EquipSlots, EquipSlotType, DragData } from "./EquipGui";
export { GoodsGui } from "./GoodsGui";
export type { GoodItemData } from "./GoodsGui";
export { MagicGui } from "./MagicGui";
export type { MagicItem } from "./MagicGui";
export { MemoGui } from "./MemoGui";
export { SystemGui } from "./SystemGui";
export { XiuLianGui } from "./XiuLianGui";
export type { XiuLianMagic } from "./XiuLianGui";

// Item Tooltip
export { ItemTooltip, defaultTooltipState } from "./ItemTooltip";
export type { TooltipState } from "./ItemTooltip";

// Mission/Quest UI
export { CurrentMissionHint } from "./CurrentMissionHint";

// Debug Panel
export { DebugPanel } from "./DebugPanel";

// Hooks
export * from "./hooks";

// Font configuration
export * from "../../engine/gui/fonts";
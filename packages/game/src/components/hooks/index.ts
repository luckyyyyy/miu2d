/**
 * Game hooks exports
 */

export type {
  BottomMagicDragData,
  BuyData,
  GameUILogic,
  GoodsData,
  MagicData,
  MagicDragData,
  MagicTooltipState,
  MinimapState,
  TooltipState,
} from "./useGameUILogic";
export { equipSlotToUISlot, useGameUILogic } from "./useGameUILogic";
export { useBuildGameUIContextValue } from "./buildGameUIContextValue";
export { useTouchDropHandlers } from "./useTouchDropHandlers";

/**
 * Game Components - 游戏相关的所有组件
 */

// 核心游戏组件
export { Game, type GameHandle, type GameProps } from "./Game";
export { GameCanvas, type GameCanvasHandle, type GameCanvasProps } from "./GameCanvas";
export { GameUI } from "./GameUI";
export { ClassicGameUI } from "./ClassicGameUI";
export { ModernGameUIWrapper } from "./ModernGameUIWrapper";
export { LoadingOverlay } from "./LoadingOverlay";
export { MapViewer } from "./MapViewer";

// UI 组件
export * from "./ui";

// UI 适配器
export * from "./adapters";

// Hooks (避免与 UI 组件的同名类型冲突)
export { useGameUILogic } from "./hooks";
export type { GameUILogic, GoodsData, MagicData, BuyData, MinimapState, BottomMagicDragData } from "./hooks";
// Note: TooltipState, MagicTooltipState, MagicDragData 已经从 ./ui 导出

// 移动端组件
export * from "./mobile";

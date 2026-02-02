/**
 * Modern UI - 导出入口
 * 现代毛玻璃风格游戏 UI
 */

// 主题和样式
export { modernColors, glassEffect, spacing, borderRadius, typography, transitions, shadows, zIndex } from "./theme";
export { panelStyles, buttonStyles, slotStyles, progressStyles, gridStyles, textStyles, listStyles } from "./styles";

// 基础组件
export {
  GlassPanel,
  PanelHeader,
  CloseButton,
  GlassButton,
  ProgressBar,
  ItemSlot,
  Divider,
  StatRow,
  ScrollArea,
} from "./components";

// 面板组件
export { TopBar } from "./TopBar";
export { BottomBar } from "./BottomBar";
export { StatePanel } from "./StatePanel";
export { EquipPanel } from "./EquipPanel";
export { GoodsPanel } from "./GoodsPanel";
export { MagicPanel } from "./MagicPanel";
export { XiuLianPanel } from "./XiuLianPanel";
export { MemoPanel } from "./MemoPanel";
export { SystemPanel } from "./SystemPanel";
export { SettingsPanel } from "./SettingsPanel";

// 对话和选择
export { DialogBox } from "./DialogBox";
export { SelectionUI } from "./SelectionUI";
export { SelectionMultipleUI } from "./SelectionMultipleUI";
export { MessageBox, MessageQueue } from "./MessageBox";

// 商店和存档
export { BuyPanel, type ShopItemData } from "./BuyPanel";
export { SaveLoadPanel } from "./SaveLoadPanel";

// 辅助UI
export { LittleMap, type CharacterMarker } from "./LittleMap";
export { TimerDisplay } from "./TimerDisplay";
export { NpcLifeBar } from "./NpcLifeBar";
export { ItemTooltip, MagicTooltip } from "./Tooltips";

// 主UI组件
export { ModernGameUI } from "./ModernGameUI";

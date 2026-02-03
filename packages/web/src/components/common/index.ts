/**
 * Common components - 通用组件（非游戏专属）
 */

// Debug Panel - 开发调试面板
export { DebugPanel } from "./DebugPanel/index";
export type {
  DebugPanelProps,
  LoadedResources,
  PlayerStats as DebugPlayerStats,
  ScriptHistoryItem,
  ScriptInfo,
} from "./DebugPanel/types";
// Grid Background
export { FloatingOrb, GridBackground, GridLine, GridNode, GridPattern } from "./GridBackground";

// Side Panel - 侧边面板组件（存档/设置等）
export type { SaveLoadPanelProps, SettingsPanelProps } from "./SidePanel";
export {
  loadAudioSettings,
  loadUITheme,
  SaveLoadPanel,
  SettingsPanel,
  saveAudioSettings,
  saveUITheme,
} from "./SidePanel";

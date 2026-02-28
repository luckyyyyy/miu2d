/**
 * GameUIContext - 游戏 UI 共享状态上下文
 *
 * 消除 BottomGui / BottomBar 的 Prop Drilling：
 * - screenWidth / screenHeight
 * - togglePanel (7 个面板回调合并为一个)
 * - playerVitals (life/mana/thew 三对血蓝体数值)
 * - tooltip 回调 (onMagicHover/Leave, onGoodsHover/Leave)
 *
 * 由 ClassicGameUI 和 ModernGameUIWrapper 提供，
 * BottomGui / BottomBar 直接消费，无需逐层传递。
 */

import { createContext, useContext } from "react";
import type { GoodItemData } from "../components/ui/classic/GoodsGui";

/**
 * 跨组件共享的武功 hover 数据，兼容 MagicItemInfo 和 MagicSlotData 两种来源。
 * 仅包含 Tooltip 显示所需的最小字段集。
 */
export interface MagicHoverData {
  magic: {
    name: string;
    icon?: string;
    image?: string;
    iconPath?: string;
  } | null;
  level: number;
}

export interface PlayerVitals {
  life: number;
  lifeMax: number;
  mana: number;
  manaMax: number;
  thew: number;
  thewMax: number;
}

export type PanelType =
  | "state"
  | "equip"
  | "xiulian"
  | "goods"
  | "magic"
  | "memo"
  | "system"
  | "littleMap";

export interface GameUIContextValue {
  screenWidth: number;
  screenHeight: number;
  /** 切换面板开/关 */
  togglePanel: (panel: PanelType) => void;
  /** 玩家生命/法力/体力数值，用于 BottomBar 状态栏 */
  playerVitals: PlayerVitals;
  /** 武功 Tooltip 回调 */
  onMagicHover: (magicInfo: MagicHoverData | null, x: number, y: number) => void;
  onMagicLeave: () => void;
  /** 物品 Tooltip 回调 */
  onGoodsHover: (goodData: GoodItemData | null, x: number, y: number) => void;
  onGoodsLeave: () => void;
}

export const GameUIContext = createContext<GameUIContextValue | null>(null);

/**
 * 从 GameUIContext 读取值，必须在 GameUIContext.Provider 内部使用。
 */
export function useGameUIContext(): GameUIContextValue {
  const ctx = useContext(GameUIContext);
  if (!ctx) {
    throw new Error("useGameUIContext must be used inside <GameUIContext.Provider>");
  }
  return ctx;
}

/**
 * useBuildGameUIContextValue - 构建 GameUIContext 所需数据（Classic / Modern 共享）
 *
 * 将 ClassicGameUI 和 ModernGameUIWrapper 中完全相同的 gameUIContextValue
 * 构建逻辑提取到此 hook，消除重复代码，并用 useMemo/useCallback 稳定引用。
 *
 * - onGoodsHover 用 useCallback 稳定（setTooltip 为 useState setter，永不变）
 * - 整体 useMemo deps：各稳定回调 + playerVitals 实际值 + width/height
 *   只有值真正变化时 context 对象才更新，consumer 才重渲染
 */

import { useCallback, useMemo } from "react";
import type { GameUIContextValue } from "../../contexts";
import type { GoodItemData } from "../ui/classic";
import type { GameUILogic } from "./useGameUILogic";

export function useBuildGameUIContextValue(
  logic: GameUILogic,
  width: number,
  height: number,
): GameUIContextValue {
  const {
    togglePanel,
    playerVitals,
    handleMagicHover,
    handleMagicLeave,
    handleMouseLeave,
    setTooltip,
  } = logic;

  // setTooltip 是 useState setter，永远稳定，onGoodsHover 只需声明一次
  const onGoodsHover = useCallback(
    (goodData: GoodItemData | null, x: number, y: number) => {
      if (goodData?.good) {
        setTooltip({
          isVisible: true,
          good: goodData.good,
          isRecycle: false,
          position: { x, y },
        });
      }
    },
    [setTooltip],
  );

  return useMemo(
    () => ({
      screenWidth: width,
      screenHeight: height,
      togglePanel,
      playerVitals,
      onMagicHover: handleMagicHover,
      onMagicLeave: handleMagicLeave,
      onGoodsHover,
      onGoodsLeave: handleMouseLeave,
    }),
    [
      width,
      height,
      togglePanel,
      playerVitals,
      handleMagicHover,
      handleMagicLeave,
      onGoodsHover,
      handleMouseLeave,
    ],
  );
}

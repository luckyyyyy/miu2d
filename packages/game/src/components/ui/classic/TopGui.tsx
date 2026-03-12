/**
 * TopGui Component - based on JxqyHD Engine/Gui/TopGui.cs
 * Top button bar for accessing game panels using ASF images from resources
 *
 * loads button images from UI_Settings.ini [Top_*_Btn]
 * Resources: asf/ui/top/*.asf
 */
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useGameUIContext } from "../../../contexts";
import { playUiSound, useAsfImage } from "./hooks";
import { useTopGuiConfig } from "./useUISettings";

// Button IDs in order matching C#: State, Equip, XiuLian, Goods, Magic, Memo, System
export const BUTTON_IDS = ["state", "equip", "xiulian", "goods", "magic", "memo", "system"] as const;
export const BUTTON_TITLES = [
  "状态 (F1/T)",
  "装备 (F2/E)",
  "修炼 (F3)",
  "物品 (F5/I)",
  "武功 (F6/M)",
  "任务 (F7)",
  "系统 (ESC)",
];

// Props removed — screenWidth and panel callbacks are read from GameUIContext

/**
 * 单个按钮组件 - 支持 ASF 动画帧（帧0=普通，帧1=按下）
 * Exported for reuse in BottomGui when buttons are part of the bottom panel.
 */
export interface TopButtonProps {
  imagePath: string;
  left: number;
  top: number;
  width: number;
  height: number;
  title: string;
  sound?: string;
  onClick: () => void;
}

export const TopButton: React.FC<TopButtonProps> = ({
  imagePath,
  left,
  top,
  width,
  height,
  title,
  sound,
  onClick,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // 加载普通状态帧
  const normalImage = useAsfImage(imagePath, 0);
  // 加载按下状态帧
  const pressedImage = useAsfImage(imagePath, 1);

  const handleMouseDown = useCallback(() => {
    setIsPressed(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsPressed(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPressed(false);
    setIsHovered(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (sound) playUiSound(sound);
  }, [sound]);

  const handleClick = useCallback(() => {
    onClick();
  }, [onClick]);

  // 决定显示哪个帧
  const currentImage = isPressed && pressedImage.dataUrl ? pressedImage : normalImage;

  return (
    <div
      style={{
        position: "absolute",
        left: left,
        top: top,
        width: width,
        height: height,
        cursor: "pointer",
        opacity: isHovered ? 1 : 0.9,
        filter: isHovered && !isPressed ? "brightness(1.2)" : "none",
        pointerEvents: "auto",
      }}
      title={title}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {currentImage.dataUrl && (
        <img
          src={currentImage.dataUrl}
          alt={title}
          style={{
            width: currentImage.width || width,
            height: currentImage.height || height,
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
          draggable={false}
        />
      )}
    </div>
  );
};

export const TopGui: React.FC = () => {
  const { screenWidth, togglePanel } = useGameUIContext();
  // 从 INI 读取配置
  const config = useTopGuiConfig();

  // 加载面板背景
  const panelImage = useAsfImage(config?.panel.image ?? null);

  // 按钮处理器映射
  const handlers: Record<string, () => void> = useMemo(
    () => ({
      state: () => togglePanel("state"),
      equip: () => togglePanel("equip"),
      xiulian: () => togglePanel("xiulian"),
      goods: () => togglePanel("goods"),
      magic: () => togglePanel("magic"),
      memo: () => togglePanel("memo"),
      system: () => togglePanel("system"),
    }),
    [togglePanel]
  );

  // 计算面板位置
  // Position = new Vector2((Globals.WindowWidth - BaseTexture.Width) / 2f + leftAdjust, topAdjust)
  // Anchor=Bottom: panel anchored to bottom edge of screen
  const panelStyle = useMemo(() => {
    const panelWidth = panelImage.width || 286; // fallback size
    const panelHeight = panelImage.height || 19;
    const leftAdjust = config?.panel.leftAdjust ?? 0;
    const topAdjust = config?.panel.topAdjust ?? 0;
    const isBottomAnchored = config?.panel.anchor === "Bottom";

    const left = (screenWidth - panelWidth) / 2 + leftAdjust;

    return {
      position: "absolute" as const,
      left,
      ...(isBottomAnchored
        ? { bottom: -topAdjust }
        : { top: topAdjust }),
      width: panelWidth,
      height: panelHeight,
      pointerEvents: "none" as const,
    };
  }, [screenWidth, panelImage.width, panelImage.height, config]);

  // 如果配置缺失或面板图片还在加载，不渲染任何内容
  if (!config || panelImage.isLoading) {
    return null;
  }

  return (
    <div style={panelStyle}>
      {/* 背景面板 */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="顶部按钮栏"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: panelImage.width,
            height: panelImage.height,
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
        />
      )}

      {/* 按钮 */}
      {config?.buttons.map((btn, i) => (
        <TopButton
          key={BUTTON_IDS[i]}
          imagePath={btn.image}
          left={btn.left}
          top={btn.top}
          width={btn.width}
          height={btn.height}
          title={BUTTON_TITLES[i]}
          sound={btn.sound}
          onClick={handlers[BUTTON_IDS[i]]}
        />
      ))}
    </div>
  );
};

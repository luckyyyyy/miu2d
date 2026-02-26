/**
 * TopGui Component - based on JxqyHD Engine/Gui/TopGui.cs
 * Top button bar for accessing game panels using ASF images from resources
 *
 * loads button images from UI_Settings.ini [Top_*_Btn]
 * Resources: asf/ui/top/*.asf
 */
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useAsfImage } from "./hooks";
import { useTopGuiConfig } from "./useUISettings";

// Button IDs in order matching C#: State, Equip, XiuLian, Goods, Magic, Memo, System
const BUTTON_IDS = ["state", "equip", "xiulian", "goods", "magic", "memo", "system"] as const;
const BUTTON_TITLES = [
  "状态 (F1/T)",
  "装备 (F2/E)",
  "修炼 (F3)",
  "物品 (F5/I)",
  "武功 (F6/M)",
  "任务 (F7)",
  "系统 (ESC)",
];

interface TopGuiProps {
  screenWidth: number;
  onStateClick: () => void;
  onEquipClick: () => void;
  onXiuLianClick: () => void;
  onGoodsClick: () => void;
  onMagicClick: () => void;
  onMemoClick: () => void;
  onSystemClick: () => void;
}

/**
 * 单个按钮组件 - 支持 ASF 动画帧（帧0=普通，帧1=按下）
 */
interface TopButtonProps {
  imagePath: string;
  left: number;
  top: number;
  width: number;
  height: number;
  title: string;
  onClick: () => void;
}

const TopButton: React.FC<TopButtonProps> = ({
  imagePath,
  left,
  top,
  width,
  height,
  title,
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
  }, []);

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

export const TopGui: React.FC<TopGuiProps> = ({
  screenWidth,
  onStateClick,
  onEquipClick,
  onXiuLianClick,
  onGoodsClick,
  onMagicClick,
  onMemoClick,
  onSystemClick,
}) => {
  // 从 INI 读取配置
  const config = useTopGuiConfig();

  // 加载面板背景
  const panelImage = useAsfImage(config?.panel.image ?? null);

  // 按钮处理器映射
  const handlers: Record<string, () => void> = useMemo(
    () => ({
      state: onStateClick,
      equip: onEquipClick,
      xiulian: onXiuLianClick,
      goods: onGoodsClick,
      magic: onMagicClick,
      memo: onMemoClick,
      system: onSystemClick,
    }),
    [
      onStateClick,
      onEquipClick,
      onXiuLianClick,
      onGoodsClick,
      onMagicClick,
      onMemoClick,
      onSystemClick,
    ]
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
      overflow: "hidden" as const,
      pointerEvents: "auto" as const,
      zIndex: 1000,
    };
  }, [screenWidth, panelImage.width, panelImage.height, config]);

  // 如果面板图片还在加载
  if (panelImage.isLoading) {
    return (
      <div
        style={{
          ...panelStyle,
          background: "rgba(40, 60, 90, 0.9)",
          borderRadius: "0 0 4px 4px",
        }}
      />
    );
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
          onClick={handlers[BUTTON_IDS[i]]}
        />
      ))}
    </div>
  );
};

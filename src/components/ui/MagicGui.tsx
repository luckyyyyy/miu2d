/**
 * MagicGui Component - based on JxqyHD Engine/Gui/MagicGui.cs
 * Displays player magic/skill list
 *
 * C# Reference: MagicGui.cs shows a 3x3 magic grid with scroll bar
 * Resources loaded from UI_Settings.ini
 */
import React, { useMemo, useState, useCallback } from "react";
import { useAsfImage } from "./hooks";
import { useMagicsGuiConfig } from "./useUISettings";

// 武功数据
export interface MagicItem {
  id: string;
  name: string;
  iconPath?: string;
  level: number;
}

interface MagicGuiProps {
  isVisible: boolean;
  magics: (MagicItem | null)[]; // 所有武功
  screenWidth: number;
  onMagicClick?: (index: number) => void;
  onMagicRightClick?: (index: number) => void; // 右键添加到快捷栏
  onClose: () => void;
}

/**
 * 单个武功槽组件
 */
interface MagicSlotProps {
  magic: MagicItem | null;
  config: { left: number; top: number; width: number; height: number };
  onClick?: () => void;
  onRightClick?: (e: React.MouseEvent) => void;
}

const MagicSlot: React.FC<MagicSlotProps> = ({
  magic,
  config,
  onClick,
  onRightClick,
}) => {
  const magicIcon = useAsfImage(magic?.iconPath ?? null, 0);

  return (
    <div
      style={{
        position: "absolute",
        left: config.left,
        top: config.top,
        width: config.width,
        height: config.height,
        cursor: magic ? "pointer" : "default",
        border: "1px solid rgba(100, 100, 100, 0.3)",
        borderRadius: 2,
        background: "rgba(0, 0, 0, 0.1)",
      }}
      title={magic ? `${magic.name} Lv.${magic.level}` : "空"}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onRightClick?.(e);
      }}
    >
      {magic && magicIcon.dataUrl && (
        <img
          src={magicIcon.dataUrl}
          alt={magic.name}
          style={{
            position: "absolute",
            left: (config.width - magicIcon.width) / 2,
            top: (config.height - magicIcon.height) / 2,
            width: magicIcon.width,
            height: magicIcon.height,
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};

export const MagicGui: React.FC<MagicGuiProps> = ({
  isVisible,
  magics,
  screenWidth,
  onMagicClick,
  onMagicRightClick,
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);

  // 从 UI_Settings.ini 加载配置
  const config = useMagicsGuiConfig();

  // 加载面板背景
  const panelImage = useAsfImage(
    config?.panel.image || "asf/ui/common/panel2.asf"
  );

  // 计算面板位置 - C#: Globals.WindowWidth / 2f + leftAdjust
  const panelStyle = useMemo(() => {
    if (!config) return null;
    const panelWidth = panelImage.width || 330;
    const panelHeight = panelImage.height || 400;

    return {
      position: "absolute" as const,
      left: screenWidth / 2 + config.panel.leftAdjust,
      top: config.panel.topAdjust,
      width: panelWidth,
      height: panelHeight,
      pointerEvents: "auto" as const,
    };
  }, [screenWidth, panelImage.width, panelImage.height, config]);

  // 计算当前显示的武功
  const visibleMagics = useMemo(() => {
    if (!config) return [];
    const startIndex = scrollOffset * 3; // 每行3个
    return config.items.map((_, idx) => magics[startIndex + idx] ?? null);
  }, [magics, scrollOffset, config]);

  // 计算最大滚动行数
  const maxScrollRows = Math.max(0, Math.ceil(magics.length / 3) - 3);

  // 滚动处理
  const handleScroll = useCallback(
    (delta: number) => {
      setScrollOffset((prev) =>
        Math.max(0, Math.min(maxScrollRows, prev + delta))
      );
    },
    [maxScrollRows]
  );

  if (!isVisible || !config || !panelStyle) return null;

  return (
    <div
      style={panelStyle}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => handleScroll(e.deltaY > 0 ? 1 : -1)}
    >
      {/* 背景面板 */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="武功面板"
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

      {/* 武功格子 */}
      {config.items.map((itemConfig, idx) => (
        <MagicSlot
          key={idx}
          magic={visibleMagics[idx]}
          config={itemConfig}
          onClick={() => onMagicClick?.(scrollOffset * 3 + idx)}
          onRightClick={() => onMagicRightClick?.(scrollOffset * 3 + idx)}
        />
      ))}

      {/* 简单滚动指示器 */}
      {maxScrollRows > 0 && (
        <div
          style={{
            position: "absolute",
            left: config.scrollBar.left,
            top: config.scrollBar.top,
            width: config.scrollBar.width,
            height: config.scrollBar.height,
            background: "rgba(0, 0, 0, 0.2)",
            borderRadius: 2,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 1,
              top:
                1 +
                (scrollOffset / maxScrollRows) *
                  (config.scrollBar.height - 22),
              width: config.scrollBar.width - 2,
              height: 20,
              background: "rgba(100, 100, 100, 0.5)",
              borderRadius: 2,
            }}
          />
        </div>
      )}
    </div>
  );
};

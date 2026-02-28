/**
 * BottomStateGui Component - based on JxqyHD Engine/Gui/ColumnGui.cs
 * Shows life, thew (stamina), and mana using ASF images from resources
 *
 * uses ColumnView for each stat bar
 * Resources: asf/ui/column/ColLife.asf, ColThew.asf, ColMana.asf, panel9.asf
 */
import type React from "react";
import { useMemo } from "react";
import { useAsfImage, useColumnView } from "./hooks";
import { useBottomStateGuiConfig } from "./useUISettings";

interface BottomStateGuiProps {
  life: number;
  maxLife: number;
  thew: number;
  maxThew: number;
  mana: number;
  maxMana: number;
  screenWidth: number;
  screenHeight: number;
}

/**
 * ColumnView Component - renders a stat orb with fill based on percentage
 * /Gui/Base/ColumnView.cs
 */
interface ColumnViewProps {
  imagePath: string;
  percent: number;
  left: number;
  top: number;
}

const ColumnView: React.FC<ColumnViewProps> = ({ imagePath, percent, left, top }) => {
  const { dataUrl, width, height, isLoading } = useColumnView(imagePath, percent);

  if (isLoading || !dataUrl) {
    return null;
  }

  return (
    <img
      src={dataUrl}
      alt=""
      style={{
        position: "absolute",
        left: left,
        top: top,
        width: width,
        height: height,
        pointerEvents: "none",
        imageRendering: "pixelated",
      }}
    />
  );
};

/**
 * 前景装饰层 — 叠在血条上方（对应 Column.ini / column2.msf）
 */
const OverlayImage: React.FC<{ imagePath: string }> = ({ imagePath }) => {
  const { dataUrl, width, height, isLoading } = useAsfImage(imagePath);
  if (isLoading || !dataUrl) return null;
  return (
    <img
      src={dataUrl}
      alt=""
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: width,
        height: height,
        pointerEvents: "none",
        imageRendering: "pixelated",
      }}
    />
  );
};

export const BottomStateGui: React.FC<BottomStateGuiProps> = ({
  life,
  maxLife,
  thew,
  maxThew,
  mana,
  maxMana,
  screenWidth,
  screenHeight: _screenHeight,
}) => {
  // 从 INI 读取配置
  const config = useBottomStateGuiConfig();

  // 加载面板背景
  const panelImage = useAsfImage(config?.panel.image ?? null);

  // 计算百分比
  const lifePercent = maxLife > 0 ? Math.max(0, Math.min(1, life / maxLife)) : 0;
  const thewPercent = maxThew > 0 ? Math.max(0, Math.min(1, thew / maxThew)) : 0;
  const manaPercent = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;

  // 计算面板位置 - 对应中的 Position 计算
  // C# formula: Position = new Vector2(Globals.WindowWidth/2f + leftAdjust, Globals.WindowHeight - height + topAdjust)
  // When the ini specifies an explicit Width (e.g. demo2 Width=640), use centered formula:
  //   X = (screenWidth - width) / 2 + leftAdjust
  // Otherwise use original C# formula:
  //   X = screenWidth / 2 + leftAdjust
  const panelStyle = useMemo(() => {
    const panelWidth = panelImage.width || config?.panel.width || 172;
    const panelHeight = panelImage.height || config?.panel.height || 68;
    const leftAdjust = config?.panel.leftAdjust ?? -320;
    const topAdjust = config?.panel.topAdjust ?? 0;

    // Use centered formula when explicit Width is declared in ini
    const left = config?.panel.width != null
      ? (screenWidth - (config.panel.width)) / 2 + leftAdjust
      : screenWidth / 2 + leftAdjust;

    return {
      position: "absolute" as const,
      left,
      bottom: -topAdjust,
      width: panelWidth,
      height: panelHeight,
      pointerEvents: "none" as const,
    };
  }, [screenWidth, panelImage.width, panelImage.height, config]);

  // 如果面板图片还在加载，不渲染任何内容
  if (panelImage.isLoading) {
    return null;
  }

  return (
    <div style={panelStyle}>
      {/* 背景面板 */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="状态栏"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: panelImage.width,
            height: panelImage.height,
            imageRendering: "pixelated",
          }}
        />
      )}

      {/* 生命球 - Life */}
      {config && (
        <ColumnView
          imagePath={config.life.image}
          percent={lifePercent}
          left={config.life.left}
          top={config.life.top}
        />
      )}

      {/* 体力球 - Thew */}
      {config && (
        <ColumnView
          imagePath={config.thew.image}
          percent={thewPercent}
          left={config.thew.left}
          top={config.thew.top}
        />
      )}

      {/* 内力球 - Mana */}
      {config && (
        <ColumnView
          imagePath={config.mana.image}
          percent={manaPercent}
          left={config.mana.left}
          top={config.mana.top}
        />
      )}

      {/* 前景装饰层 - 叠在血条上方（如剑侠情缘2 column2.msf） */}
      {config?.overlay && (
        <OverlayImage imagePath={config.overlay} />
      )}
    </div>
  );
};

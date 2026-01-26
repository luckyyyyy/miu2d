/**
 * XiuLianGui Component - based on JxqyHD Engine/Gui/XiuLianGui.cs
 * Displays magic/skill cultivation interface
 *
 * C# Reference: XiuLianGui.cs shows magic info, level, exp, and introduction
 * Resources loaded from UI_Settings.ini
 */
import React, { useMemo } from "react";
import { useAsfImage } from "./hooks";
import { useXiuLianGuiConfig } from "./useUISettings";

// 修炼中的武功数据
export interface XiuLianMagic {
  id: string;
  name: string;
  iconPath?: string;
  level: number;
  exp: number;
  levelUpExp: number;
  intro: string;
}

interface XiuLianGuiProps {
  isVisible: boolean;
  magic: XiuLianMagic | null;
  screenWidth: number;
  onMagicClick?: () => void;
  onMagicDrop?: (magicId: string) => void;
  onClose: () => void;
}

export const XiuLianGui: React.FC<XiuLianGuiProps> = ({
  isVisible,
  magic,
  screenWidth,
  onMagicClick,
}) => {
  // 从 UI_Settings.ini 加载配置
  const config = useXiuLianGuiConfig();

  // 加载面板背景
  const panelImage = useAsfImage(
    config?.panel.image || "asf/ui/common/panel6.asf"
  );
  // 加载武功图标
  const magicIcon = useAsfImage(magic?.iconPath ?? null, 0);

  // 计算面板位置 - C#: Globals.WindowWidth / 2f - Width + leftAdjust
  const panelStyle = useMemo(() => {
    if (!config) return null;
    const panelWidth = panelImage.width || 290;
    const panelHeight = panelImage.height || 400;

    return {
      position: "absolute" as const,
      left: screenWidth / 2 - panelWidth + config.panel.leftAdjust,
      top: config.panel.topAdjust,
      width: panelWidth,
      height: panelHeight,
      pointerEvents: "auto" as const,
    };
  }, [screenWidth, panelImage.width, panelImage.height, config]);

  if (!isVisible || !config || !panelStyle) return null;

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      {/* 背景面板 */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="修炼面板"
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

      {/* 武功图标槽 */}
      <div
        style={{
          position: "absolute",
          left: config.magicImage.left,
          top: config.magicImage.top,
          width: config.magicImage.width,
          height: config.magicImage.height,
          border: "1px solid rgba(100, 100, 100, 0.3)",
          borderRadius: 2,
          background: "rgba(0, 0, 0, 0.1)",
          cursor: magic ? "pointer" : "default",
        }}
        onClick={onMagicClick}
        title={magic?.name || "拖放武功到此处进行修炼"}
      >
        {magic && magicIcon.dataUrl && (
          <img
            src={magicIcon.dataUrl}
            alt={magic.name}
            style={{
              position: "absolute",
              left: (config.magicImage.width - magicIcon.width) / 2,
              top: (config.magicImage.height - magicIcon.height) / 2,
              width: magicIcon.width,
              height: magicIcon.height,
              imageRendering: "pixelated",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      {/* 等级 */}
      <div
        style={{
          position: "absolute",
          left: config.levelText.left,
          top: config.levelText.top,
          fontSize: 12,
          fontFamily: "SimSun, serif",
          color: config.levelText.color,
        }}
      >
        {magic ? `${magic.level}/10` : "1/10"}
      </div>

      {/* 经验 */}
      <div
        style={{
          position: "absolute",
          left: config.expText.left,
          top: config.expText.top,
          fontSize: 12,
          fontFamily: "SimSun, serif",
          color: config.expText.color,
        }}
      >
        {magic ? `${magic.exp}/${magic.levelUpExp}` : "0/0"}
      </div>

      {/* 武功名称 */}
      <div
        style={{
          position: "absolute",
          left: config.nameText.left,
          top: config.nameText.top,
          fontSize: 14,
          fontFamily: "SimSun, serif",
          fontWeight: "bold",
          color: config.nameText.color,
        }}
      >
        {magic?.name || ""}
      </div>

      {/* 武功介绍 */}
      <div
        style={{
          position: "absolute",
          left: config.introText.left,
          top: config.introText.top,
          width: config.introText.width,
          height: config.introText.height,
          fontSize: 12,
          fontFamily: "SimSun, serif",
          color: config.introText.color,
          overflow: "hidden",
          lineHeight: "18px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {magic?.intro || ""}
      </div>
    </div>
  );
};

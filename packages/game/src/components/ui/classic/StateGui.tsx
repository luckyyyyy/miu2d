/**
 * StateGui Component - based on JxqyHD Engine/Gui/StateGui.cs
 * Displays player status information (level, exp, stats)
 *
 * shows level, exp, life, thew, mana, attack, defend, evade
 * Resources loaded from UI_Settings.ini
 */
import type React from "react";
import { useMemo } from "react";
import { useAsfImage } from "./hooks";
import { useStateGuiConfig } from "./useUISettings";

export interface PlayerStats {
  level: number;
  exp: number;
  levelUpExp: number;
  life: number;
  lifeMax: number;
  thew: number;
  thewMax: number;
  mana: number;
  manaMax: number;
  manaLimit?: boolean; // 内力限制标志
  attack: number;
  attack2?: number;
  attack3?: number;
  defend: number;
  defend2?: number;
  defend3?: number;
  evade: number;
}

interface StateGuiProps {
  isVisible: boolean;
  stats: PlayerStats;
  playerIndex?: number; // 用于切换角色头像面板
  screenWidth: number;
  onClose: () => void;
}

/**
 * 根据角色索引获取面板图像路径
 * 如果 config 提供了自定义面板图片（如 sword2 的 state/image.msf），直接使用。
 * 否则使用 xin 的 panel5 + 角色后缀命名规则:
 * index 0: panel5.asf, index 1: panel5b.asf, index 2: panel5c.asf, ...
 */
function getPanelImagePath(configImage: string | undefined, playerIndex: number): string {
  // 如果 config 提供了自定义图片且不是默认的 panel5，直接使用
  if (configImage && !configImage.includes("panel5")) {
    return configImage;
  }
  const base = configImage || "asf/ui/common/panel5.asf";
  if (playerIndex <= 0) {
    return base;
  }
  // (char)('a' + value) -> 'a' + playerIndex
  const suffix = String.fromCharCode("a".charCodeAt(0) + playerIndex);
  // panel5.asf → panel5b.asf / panel5.msf → panel5b.msf
  return base.replace(/panel5(\.[^.]+)$/, `panel5${suffix}$1`);
}

export const StateGui: React.FC<StateGuiProps> = ({
  isVisible,
  stats,
  playerIndex = 0,
  screenWidth,
}) => {
  // 从 UI_Settings.ini 加载配置
  const config = useStateGuiConfig();

  // 根据角色索引动态加载面板背景
  // 优先使用 config.panel.image，支持 sword2 等自定义面板
  const panelPath = useMemo(
    () => getPanelImagePath(config?.panel.image, playerIndex),
    [config?.panel.image, playerIndex]
  );
  const panelImage = useAsfImage(panelPath);

  // 如果 INI 提供了 OverlayImage（装饰性叠加图），额外加载
  const overlayPath = config?.panel.overlayImage ?? "";
  const overlayImage = useAsfImage(overlayPath);

  // 计算面板位置 - Globals.WindowWidth / 2f - Width + leftAdjust
  const panelStyle = useMemo(() => {
    if (!config) return null;
    const panelWidth = panelImage.width || 172;
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

  // 格式化攻击力显示
  const attackText = useMemo(() => {
    let text = stats.attack.toString();
    if (stats.attack2 || stats.attack3) {
      text += `(${stats.attack2 || 0})(${stats.attack3 || 0})`;
    }
    return text;
  }, [stats.attack, stats.attack2, stats.attack3]);

  // 格式化防御力显示
  const defendText = useMemo(() => {
    let text = stats.defend.toString();
    if (stats.defend2 || stats.defend3) {
      text += `(${stats.defend2 || 0})(${stats.defend3 || 0})`;
    }
    return text;
  }, [stats.defend, stats.defend2, stats.defend3]);

  // 格式化内力显示
  const manaText = stats.manaLimit ? "1/1" : `${stats.mana}/${stats.manaMax}`;

  if (!isVisible || !config || !panelStyle) return null;

  // 文本样式生成器
  const getTextStyle = (textConfig: {
    left: number;
    top: number;
    width: number;
    height: number;
    color: string;
  }): React.CSSProperties => ({
    position: "absolute",
    left: textConfig.left,
    top: textConfig.top,
    width: textConfig.width,
    fontSize: 12,
    fontFamily: "SimSun, serif",
    color: textConfig.color,
    textAlign: "left",
  });

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      {/* 背景面板 */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="状态面板"
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

      {/* 装饰性叠加图（如 sword2 的 state/image.msf） */}
      {overlayImage.dataUrl && (
        <img
          src={overlayImage.dataUrl}
          alt=""
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: overlayImage.width,
            height: overlayImage.height,
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
        />
      )}

      {/* 等级 */}
      <div style={getTextStyle(config.level)}>{stats.level}</div>

      {/* 经验 */}
      <div style={getTextStyle(config.exp)}>{stats.exp}</div>

      {/* 升级经验 */}
      <div style={getTextStyle(config.levelUp)}>{stats.levelUpExp}</div>

      {/* 生命 */}
      <div style={getTextStyle(config.life)}>
        {stats.life}/{stats.lifeMax}
      </div>

      {/* 体力 */}
      <div style={getTextStyle(config.thew)}>
        {stats.thew}/{stats.thewMax}
      </div>

      {/* 内力 */}
      <div style={getTextStyle(config.mana)}>{manaText}</div>

      {/* 攻击 */}
      <div style={getTextStyle(config.attack)}>{attackText}</div>

      {/* 防御 */}
      <div style={getTextStyle(config.defend)}>{defendText}</div>

      {/* 身法 */}
      <div style={getTextStyle(config.evade)}>{stats.evade}</div>
    </div>
  );
};

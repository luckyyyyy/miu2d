/**
 * Modern SystemPanel - 系统面板
 * 位置与经典UI一致
 */
import type React from "react";
import { useMemo, useState } from "react";
import { useGameUIContext } from "../../../contexts";
import { Divider, PanelHeader } from "./components";
import { borderRadius, glassEffect, modernColors, spacing, typography } from "./theme";

interface SystemPanelProps {
  isVisible: boolean;
  onSaveLoad: () => void;
  onOption: () => void;
  onExit: () => void;
  onReturn: () => void;
}

interface MenuButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  color?: string;
}

const MenuButton: React.FC<MenuButtonProps> = ({ icon, label, onClick, color }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{
        width: "100%",
        padding: `${spacing.md}px ${spacing.lg}px`,
        background: isPressed
          ? "rgba(255, 255, 255, 0.2)"
          : isHovered
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.2)",
        border: `1px solid ${isHovered ? modernColors.border.glassLight : modernColors.border.glass}`,
        borderRadius: borderRadius.md,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: spacing.md,
        transition: "all 0.15s ease",
        transform: isPressed ? "scale(0.98)" : "scale(1)",
      }}
    >
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span
        style={{
          fontSize: typography.fontSize.md,
          fontWeight: typography.fontWeight.medium,
          color: color || modernColors.text.primary,
        }}
      >
        {label}
      </span>
    </button>
  );
};

export const SystemPanel: React.FC<SystemPanelProps> = ({
  isVisible,
  onSaveLoad,
  onOption,
  onExit,
  onReturn,
}) => {
  const { screenWidth, screenHeight } = useGameUIContext();
  const panelWidth = 280;
  const panelHeight = 320;

  // 位置: 屏幕中央
  const panelStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: (screenWidth - panelWidth) / 2,
      top: (screenHeight - panelHeight) / 2,
      width: panelWidth,
      height: panelHeight,
      display: "flex",
      flexDirection: "column",
      ...glassEffect.dark,
      borderRadius: borderRadius.lg,
      pointerEvents: "auto",
    }),
    [screenWidth, screenHeight]
  );

  if (!isVisible) return null;

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      <PanelHeader title="系统菜单" onClose={onReturn} />

      <div
        style={{
          flex: 1,
          padding: spacing.lg,
          display: "flex",
          flexDirection: "column",
          gap: spacing.md,
        }}
      >
        <MenuButton icon="💾" label="存档/读档" onClick={onSaveLoad} />
        <MenuButton icon="⚙️" label="游戏设置" onClick={onOption} />

        <div style={{ flex: 1 }} />

        <Divider />

        <MenuButton icon="🚪" label="退出游戏" onClick={onExit} color={modernColors.stats.hp} />
      </div>
    </div>
  );
};

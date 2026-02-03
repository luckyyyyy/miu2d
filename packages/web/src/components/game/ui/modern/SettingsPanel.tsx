/**
 * Modern SettingsPanel - 游戏设置面板
 * 支持 UI 主题切换等设置
 */
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import type { UITheme } from "../index";
import { Divider, GlassButton, PanelHeader } from "./components";
import { borderRadius, glassEffect, modernColors, spacing, typography } from "./theme";

interface SettingsPanelProps {
  isVisible: boolean;
  screenWidth: number;
  screenHeight: number;
  currentTheme: UITheme;
  musicVolume: number;
  soundVolume: number;
  onThemeChange: (theme: UITheme) => void;
  onMusicVolumeChange: (volume: number) => void;
  onSoundVolumeChange: (volume: number) => void;
  onClose: () => void;
}

interface SettingRowProps {
  label: string;
  children: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, children }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: `${spacing.sm}px 0`,
    }}
  >
    <span
      style={{
        fontSize: typography.fontSize.sm,
        color: modernColors.text.secondary,
      }}
    >
      {label}
    </span>
    <div>{children}</div>
  </div>
);

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

const Slider: React.FC<SliderProps> = ({ value, min = 0, max = 100, onChange }) => {
  const [_isDragging, _setIsDragging] = useState(false);
  const percent = ((value - min) / (max - min)) * 100;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    },
    [onChange]
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={handleChange}
        style={{
          width: 120,
          height: 4,
          appearance: "none",
          background: `linear-gradient(to right, ${modernColors.primary} 0%, ${modernColors.primary} ${percent}%, rgba(255,255,255,0.2) ${percent}%, rgba(255,255,255,0.2) 100%)`,
          borderRadius: 2,
          cursor: "pointer",
        }}
      />
      <span
        style={{
          fontSize: typography.fontSize.xs,
          color: modernColors.text.muted,
          width: 32,
          textAlign: "right",
        }}
      >
        {value}%
      </span>
    </div>
  );
};

interface ThemeButtonProps {
  theme: UITheme;
  label: string;
  icon: string;
  isActive: boolean;
  onClick: () => void;
}

const ThemeButton: React.FC<ThemeButtonProps> = ({ theme, label, icon, isActive, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        flex: 1,
        padding: spacing.md,
        background: isActive
          ? "rgba(100, 200, 255, 0.3)"
          : isHovered
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.2)",
        border: `2px solid ${isActive ? modernColors.primary : modernColors.border.glass}`,
        borderRadius: borderRadius.md,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: spacing.sm,
        transition: "all 0.15s ease",
      }}
    >
      <span style={{ fontSize: 32 }}>{icon}</span>
      <span
        style={{
          fontSize: typography.fontSize.sm,
          fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.normal,
          color: isActive ? modernColors.text.primary : modernColors.text.secondary,
        }}
      >
        {label}
      </span>
    </button>
  );
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isVisible,
  screenWidth,
  screenHeight,
  currentTheme,
  musicVolume,
  soundVolume,
  onThemeChange,
  onMusicVolumeChange,
  onSoundVolumeChange,
  onClose,
}) => {
  const panelWidth = 400;
  const panelHeight = 420;

  const panelStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: (screenWidth - panelWidth) / 2,
      top: (screenHeight - panelHeight) / 2,
      width: panelWidth,
      height: panelHeight,
      display: "flex",
      flexDirection: "column",
      ...glassEffect.standard,
      borderRadius: borderRadius.lg,
      pointerEvents: "auto",
    }),
    [screenWidth, screenHeight]
  );

  if (!isVisible) return null;

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      <PanelHeader title="游戏设置" onClose={onClose} />

      <div style={{ flex: 1, padding: spacing.lg, overflowY: "auto" }}>
        {/* UI 主题 */}
        <div style={{ marginBottom: spacing.lg }}>
          <div
            style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              color: modernColors.text.primary,
              marginBottom: spacing.md,
            }}
          >
            🎨 界面主题
          </div>
          <div style={{ display: "flex", gap: spacing.md }}>
            <ThemeButton
              theme="classic"
              label="经典风格"
              icon="🏯"
              isActive={currentTheme === "classic"}
              onClick={() => onThemeChange("classic")}
            />
            <ThemeButton
              theme="modern"
              label="现代风格"
              icon="✨"
              isActive={currentTheme === "modern"}
              onClick={() => onThemeChange("modern")}
            />
          </div>
          <div
            style={{
              marginTop: spacing.sm,
              fontSize: typography.fontSize.xs,
              color: modernColors.text.muted,
            }}
          >
            {currentTheme === "classic"
              ? "复古像素风格，还原经典游戏体验"
              : "现代毛玻璃效果，清新简洁的视觉设计"}
          </div>
        </div>

        <Divider />

        {/* 音量设置 */}
        <div style={{ marginTop: spacing.lg }}>
          <div
            style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              color: modernColors.text.primary,
              marginBottom: spacing.md,
            }}
          >
            🔊 音量设置
          </div>

          <SettingRow label="🎵 背景音乐">
            <Slider value={musicVolume} onChange={onMusicVolumeChange} />
          </SettingRow>

          <SettingRow label="🔔 游戏音效">
            <Slider value={soundVolume} onChange={onSoundVolumeChange} />
          </SettingRow>
        </div>

        <Divider />

        {/* 其他设置 */}
        <div style={{ marginTop: spacing.lg }}>
          <div
            style={{
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.semibold,
              color: modernColors.text.primary,
              marginBottom: spacing.md,
            }}
          >
            ⚙️ 其他设置
          </div>

          <SettingRow label="显示 FPS">
            <ToggleSwitch value={false} onChange={() => {}} />
          </SettingRow>

          <SettingRow label="显示小地图">
            <ToggleSwitch value={true} onChange={() => {}} />
          </SettingRow>
        </div>
      </div>

      {/* 底部按钮 */}
      <div
        style={{
          padding: spacing.md,
          borderTop: `1px solid ${modernColors.border.glass}`,
          background: "rgba(0, 0, 0, 0.2)",
          display: "flex",
          justifyContent: "flex-end",
          gap: spacing.md,
          borderBottomLeftRadius: borderRadius.lg,
          borderBottomRightRadius: borderRadius.lg,
        }}
      >
        <GlassButton onClick={onClose} primary>
          确定
        </GlassButton>
      </div>
    </div>
  );
};

// 开关组件
interface ToggleSwitchProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ value, onChange }) => {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: "none",
        background: value ? modernColors.primary : "rgba(255, 255, 255, 0.2)",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.2s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: value ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s ease",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
};

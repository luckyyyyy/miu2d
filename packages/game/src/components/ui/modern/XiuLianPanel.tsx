/**
 * Modern XiuLianPanel - 武侠风格修炼面板
 * 使用毛玻璃效果 + 武侠配色，参考MagicPanel/StatePanel设计
 */

import type { MagicItemInfo } from "@miu2d/engine/magic";
import { MAGIC_LIST_CONFIG } from "@miu2d/engine/player/magic/magic-list-config";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useGameUIContext } from "../../../contexts";
import type { TouchDragData } from "../../../contexts";
import { AsfAnimatedSprite } from "../classic/AsfAnimatedSprite";
import type { MagicDragData } from "../classic/MagicGui";
import type { XiuLianMagic } from "../classic/XiuLianGui";
import { borderRadius, glassEffect, modernColors, spacing, transitions, typography } from "./theme";

// BottomGui 的拖拽数据类型
interface BottomMagicDragData {
  bottomSlot: number;
  listIndex: number;
}

// 武侠风格配色
const wuxiaAccent = {
  gold: "#D4AF37",
  goldBright: "#FFD700",
  goldDark: "#8B7355",
  crimson: "#C41E3A",
  azure: "#4A90D9",
  jade: "#50C878",
  purple: "#9B59B6",
};

interface XiuLianPanelProps {
  isVisible: boolean;
  // 旧接口
  magic?: XiuLianMagic | null;
  // 新接口：直接传入 MagicItemInfo
  magicInfo?: MagicItemInfo | null;
  onMagicClick?: () => void;
  onClose: () => void;
  // 拖放支持
  onDrop?: (sourceIndex: number) => void; // 接收从其他地方拖来的武功
  onDragStart?: (data: MagicDragData) => void; // 可以把修炼武功拖出去
  onDragEnd?: () => void;
  // 外部拖拽数据（用于判断是否可以放下）
  dragData?: MagicDragData | null;
  // BottomGui 的拖拽数据
  bottomDragData?: BottomMagicDragData | null;
  // Tooltip 支持
  onMagicHover?: (magicInfo: MagicItemInfo | null, x: number, y: number) => void;
  onMagicLeave?: () => void;
  /** 移动端触摸拖拽 drop 回调 */
  onTouchDrop?: (data: TouchDragData) => void;
}

// 关闭按钮
const CloseBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      position: "absolute",
      top: spacing.sm,
      right: spacing.sm,
      width: 28,
      height: 28,
      background: modernColors.bg.hover,
      border: `1px solid ${modernColors.border.glass}`,
      borderRadius: borderRadius.round,
      color: modernColors.text.secondary,
      fontSize: typography.fontSize.md,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: transitions.fast,
      zIndex: 10,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "rgba(255,100,100,0.3)";
      e.currentTarget.style.color = modernColors.text.primary;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = modernColors.bg.hover;
      e.currentTarget.style.color = modernColors.text.secondary;
    }}
  >
    ✕
  </button>
);

// 分区标题组件
const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <div
    style={{
      fontSize: typography.fontSize.sm,
      color: modernColors.text.secondary,
      marginBottom: spacing.sm,
      display: "flex",
      alignItems: "center",
      gap: spacing.sm,
    }}
  >
    <span
      style={{
        width: 16,
        height: 1,
        background: `linear-gradient(90deg, ${wuxiaAccent.gold}, transparent)`,
      }}
    />
    {title}
    <span
      style={{
        flex: 1,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${modernColors.border.glass})`,
      }}
    />
  </div>
);

// 属性项组件
const StatItem: React.FC<{ label: string; value: string; color?: string }> = ({
  label,
  value,
  color,
}) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      flex: 1,
      padding: spacing.sm,
      background: modernColors.bg.glassDark,
      borderRadius: borderRadius.sm,
      border: `1px solid ${modernColors.border.glass}`,
    }}
  >
    <span style={{ fontSize: typography.fontSize.xs, color: modernColors.text.muted }}>
      {label}
    </span>
    <span
      style={{
        fontSize: typography.fontSize.md,
        fontWeight: typography.fontWeight.semibold,
        color: color ?? modernColors.text.primary,
        marginTop: 2,
      }}
    >
      {value}
    </span>
  </div>
);

// 修炼武功展示组件
interface MagicDisplayProps {
  magic: XiuLianMagic | null;
  magicInfo: MagicItemInfo | null;
  isHovered: boolean;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}

const MagicDisplay: React.FC<MagicDisplayProps> = ({
  magic,
  magicInfo,
  isHovered,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}) => {
  // 获取图标路径
  const iconPath = magicInfo?.magic?.icon ?? magicInfo?.magic?.image ?? magic?.iconPath ?? null;

  // 确定要显示的数据
  const displayMagic = magicInfo?.magic ?? magic;
  if (!displayMagic) return null;

  const name = displayMagic.name;
  const level = magicInfo?.level ?? (magic as XiuLianMagic | null)?.level ?? 0;
  const maxLevel = 10;
  const currentLevelExp = magicInfo?.exp ?? magic?.exp ?? 0;
  const levelUpExp = magicInfo?.magic?.levelupExp ?? magic?.levelUpExp ?? 100;
  const manaCost = magicInfo?.magic?.manaCost ?? 0;
  const intro = magicInfo?.magic?.intro ?? magic?.intro ?? "";
  const expProgress = levelUpExp > 0 ? (currentLevelExp / levelUpExp) * 100 : 0;
  // 是否可升级（有等级数据）
  const canUpgrade = !!(magicInfo?.magic?.levels && magicInfo.magic.levels.size > 0);

  // 八角形裁剪路径
  const octagonClip =
    "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing.md,
      }}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {/* 武功图标和名称 */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
        {/* 八角形图标框 */}
        <div
          style={{
            width: 64,
            height: 64,
            position: "relative",
            flexShrink: 0,
          }}
        >
          {/* 图标容器 */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(135deg, ${wuxiaAccent.purple}44, ${wuxiaAccent.azure}44)`,
              clipPath: octagonClip,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {/* ASF 动画图标 */}
            {iconPath && (
              <AsfAnimatedSprite
                key={iconPath}
                path={iconPath}
                autoPlay={true}
                loop={true}
                style={{
                  maxWidth: 48,
                  maxHeight: 48,
                  pointerEvents: "none",
                  filter: isHovered ? "brightness(1.2)" : "brightness(1)",
                }}
                alt={name}
              />
            )}
          </div>
        </div>

        {/* 名称和等级 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: typography.fontSize.lg,
              fontWeight: typography.fontWeight.bold,
              color: modernColors.text.primary,
              textShadow: "0 2px 4px rgba(0,0,0,0.5)",
              marginBottom: spacing.xs,
            }}
          >
            {name}
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: spacing.xs,
            }}
          >
            <span style={{ fontSize: typography.fontSize.sm, color: modernColors.text.muted }}>
              境界
            </span>
            <span
              style={{
                fontSize: typography.fontSize.xl,
                fontWeight: typography.fontWeight.bold,
                color: wuxiaAccent.gold,
                fontFamily: "Georgia, serif",
                textShadow: `0 0 10px ${wuxiaAccent.gold}66`,
              }}
            >
              {level}
            </span>
            {canUpgrade ? (
              <span style={{ fontSize: typography.fontSize.sm, color: modernColors.text.muted }}>
                / {maxLevel}
              </span>
            ) : (
              <span style={{ fontSize: typography.fontSize.xs, color: modernColors.text.muted }}>
                （不可升级）
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 修炼进度 */}
      {canUpgrade && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: spacing.xs,
            }}
          >
            <span style={{ fontSize: typography.fontSize.xs, color: modernColors.text.secondary }}>
              修炼进度
            </span>
            <span
              style={{
                fontSize: typography.fontSize.xs,
                color: wuxiaAccent.gold,
                fontFamily: "monospace",
              }}
            >
              {currentLevelExp} / {levelUpExp}
            </span>
          </div>
          <div
            style={{
              width: "100%",
              height: 10,
              background: modernColors.bg.glassDark,
              borderRadius: borderRadius.sm,
              overflow: "hidden",
              border: `1px solid ${modernColors.border.glass}`,
            }}
          >
            <div
              style={{
                width: `${expProgress}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${wuxiaAccent.purple}, ${wuxiaAccent.azure})`,
                borderRadius: borderRadius.sm,
                boxShadow: `0 0 12px ${wuxiaAccent.purple}66`,
                transition: transitions.normal,
              }}
            />
          </div>
        </div>
      )}

      {/* 属性信息 */}
      <div style={{ display: "flex", gap: spacing.sm }}>
        <StatItem label="内力消耗" value={manaCost.toString()} color={wuxiaAccent.azure} />
        <StatItem label="当前层数" value={`${level} 层`} color={wuxiaAccent.gold} />
      </div>

      {/* 武功介绍 */}
      {intro && (
        <div
          style={{
            fontSize: typography.fontSize.xs,
            color: modernColors.text.secondary,
            lineHeight: 1.6,
            padding: spacing.sm,
            background: modernColors.bg.glassDark,
            borderRadius: borderRadius.sm,
            border: `1px solid ${modernColors.border.glass}`,
            fontStyle: "italic",
          }}
        >
          「{intro}」
        </div>
      )}
    </div>
  );
};

export const XiuLianPanel: React.FC<XiuLianPanelProps> = ({
  isVisible,
  magic,
  magicInfo,
  onMagicClick,
  onClose,
  onDrop,
  onDragStart,
  onDragEnd,
  dragData,
  bottomDragData,
  onMagicHover,
  onMagicLeave,
  onTouchDrop,
}) => {
  const { screenWidth } = useGameUIContext();
  const [isSlotHovered, setIsSlotHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const panelWidth = 300;

  // 位置: 屏幕中央偏左
  const panelStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: screenWidth / 2 - panelWidth - 20,
      top: 46,
      width: panelWidth,
      display: "flex",
      flexDirection: "column",
      // 毛玻璃效果
      ...glassEffect.standard,
      borderRadius: borderRadius.xl,
      // 金色边框装饰
      border: `1px solid ${wuxiaAccent.goldDark}66`,
      boxShadow: `
        0 8px 32px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255,255,255,0.1),
        0 0 40px rgba(212,175,55,0.08)
      `,
      pointerEvents: "auto",
    }),
    [screenWidth]
  );

  // 是否有修炼武功
  const hasMagic = magic || magicInfo;

  // 处理拖放
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      // 支持从 MagicGui 或 BottomGui 拖拽到此处
      if (dragData && dragData.storeIndex > 0) {
        onDrop?.(dragData.storeIndex);
      } else if (bottomDragData) {
        // 从 BottomGui 拖拽（由 handleMagicDropOnXiuLian 通过 bottomMagicDragData 处理）
        onDrop?.(0);
      }
      onDragEnd?.();
    },
    [dragData, bottomDragData, onDrop, onDragEnd]
  );

  const handleSlotDragStart = useCallback(
    (e: React.DragEvent) => {
      if (hasMagic) {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.({ type: "magic", storeIndex: MAGIC_LIST_CONFIG.xiuLianIndex });
      }
    },
    [hasMagic, onDragStart]
  );

  // Tooltip 处理
  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      if (magicInfo) {
        onMagicHover?.(magicInfo, e.clientX, e.clientY);
      }
    },
    [magicInfo, onMagicHover]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (magicInfo) {
        onMagicHover?.(magicInfo, e.clientX, e.clientY);
      }
    },
    [magicInfo, onMagicHover]
  );

  if (!isVisible) return null;

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      {/* 装饰性顶部边框 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${wuxiaAccent.gold}88, transparent)`,
          borderRadius: `${borderRadius.xl}px ${borderRadius.xl}px 0 0`,
        }}
      />

      <CloseBtn onClick={onClose} />

      {/* 标题区域 */}
      <div
        style={{
          padding: `${spacing.lg}px ${spacing.lg}px ${spacing.md}px`,
          background: modernColors.bg.hover,
          borderBottom: `1px solid ${modernColors.border.glass}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing.md }}>
          {/* 修炼图标 - 八角形 */}
          <div
            style={{
              width: 48,
              height: 48,
              position: "relative",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: -2,
                background: `linear-gradient(135deg, ${wuxiaAccent.gold}, ${wuxiaAccent.goldDark})`,
                clipPath:
                  "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(135deg, ${wuxiaAccent.crimson}44, ${wuxiaAccent.purple}44)`,
                clipPath:
                  "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 22, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>
                🧘
              </span>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.bold,
                color: modernColors.text.primary,
                textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                marginBottom: spacing.xs,
              }}
            >
              内功修炼
            </div>
            <div
              style={{
                fontSize: typography.fontSize.sm,
                color: modernColors.text.secondary,
              }}
            >
              {hasMagic ? "正在修炼中..." : "尚未选择修炼武功"}
            </div>
          </div>
        </div>
      </div>

      {/* 修炼内容区域 */}
      <div style={{ padding: spacing.lg }}>
        <SectionTitle title="修炼武功" />

        {/* 修炼武功槽位 - 支持拖放 */}
        <div
          style={{
            width: "100%",
            minHeight: hasMagic ? "auto" : 100,
            padding: spacing.md,
            background:
              isSlotHovered && hasMagic
                ? "rgba(255, 255, 255, 0.05)"
                : modernColors.bg.glassDark,
            border: `2px ${hasMagic ? "solid" : "dashed"} ${
              hasMagic ? `${wuxiaAccent.goldDark}66` : modernColors.border.glass
            }`,
            borderRadius: borderRadius.lg,
            display: "flex",
            alignItems: hasMagic ? "stretch" : "center",
            justifyContent: "center",
            cursor: hasMagic ? "grab" : "default",
            transition: transitions.fast,
          }}
          draggable={!!hasMagic}
          onDragStart={handleSlotDragStart}
          onDragEnd={() => onDragEnd?.()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={onMagicClick}
          onMouseEnter={() => setIsSlotHovered(true)}
          onMouseLeave={() => {
            setIsSlotHovered(false);
            onMagicLeave?.();
          }}
        >
          {hasMagic ? (
            <MagicDisplay
              magic={magic ?? null}
              magicInfo={magicInfo ?? null}
              isHovered={isSlotHovered}
              onMouseEnter={handleMouseEnter}
              onMouseMove={handleMouseMove}
              onMouseLeave={onMagicLeave}
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: spacing.sm,
                color: modernColors.text.muted,
                padding: spacing.md,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  border: `2px dashed ${modernColors.border.glass}`,
                  borderRadius: borderRadius.lg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: 0.5,
                }}
              >
                <span style={{ fontSize: 24 }}>✨</span>
              </div>
              <span style={{ fontSize: typography.fontSize.sm, textAlign: "center" }}>
                拖放武功到此处修炼
              </span>
            </div>
          )}
        </div>

        {/* 修炼说明 */}
        {!hasMagic && (
          <div
            style={{
              marginTop: spacing.md,
              padding: spacing.md,
              background: modernColors.bg.glassDark,
              borderRadius: borderRadius.md,
              border: `1px solid ${modernColors.border.glass}`,
            }}
          >
            <div
              style={{
                fontSize: typography.fontSize.xs,
                color: modernColors.text.muted,
                textAlign: "center",
                lineHeight: 1.8,
              }}
            >
              <p style={{ margin: 0 }}>
                <span style={{ color: wuxiaAccent.azure }}>拖拽</span> 武功面板中的武功到上方槽位
              </p>
              <p style={{ margin: `${spacing.xs}px 0 0` }}>
                或在武功面板 <span style={{ color: wuxiaAccent.azure }}>右键</span> 点击设为修炼目标
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 底部装饰 */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${wuxiaAccent.goldDark}, transparent)`,
        }}
      />
    </div>
  );
};

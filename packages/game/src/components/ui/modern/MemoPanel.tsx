/**
 * Modern MemoPanel - 任务面板
 * 重新设计为与其他面板一致的武侠毛玻璃样式
 */
import type React from "react";
import { useMemo, useState } from "react";
import { useGameUIContext } from "../../../contexts";
import { borderRadius, glassEffect, modernColors, spacing, transitions, typography } from "./theme";

// 武侠风格配色
const wuxiaAccent = {
  gold: "#D4AF37",
  goldBright: "#FFD700",
  goldDark: "#8B7355",
};

interface MemoPanelProps {
  isVisible: boolean;
  memos: string[];
  onClose: () => void;
}

// 关闭按钮（与其他面板一致）
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

// 单条任务项
const MemoItem: React.FC<{ text: string; index: number; isLast: boolean }> = ({
  text,
  index: _index,
  isLast,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: spacing.sm,
        padding: `${spacing.sm}px ${spacing.lg}px`,
        borderBottom: !isLast ? `1px solid ${modernColors.border.glass}40` : "none",
        background: isHovered ? modernColors.bg.hover : "transparent",
        transition: transitions.fast,
        cursor: "default",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 金色圆点装饰 */}
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: wuxiaAccent.gold,
          marginTop: 7,
          flexShrink: 0,
          boxShadow: `0 0 5px ${wuxiaAccent.gold}99`,
          opacity: isHovered ? 1 : 0.7,
          transition: transitions.fast,
        }}
      />
      {/* 任务文字 */}
      <span
        style={{
          fontSize: typography.fontSize.sm,
          color: isHovered ? modernColors.text.primary : modernColors.text.secondary,
          lineHeight: 1.7,
          transition: transitions.fast,
        }}
      >
        {text}
      </span>
    </div>
  );
};

export const MemoPanel: React.FC<MemoPanelProps> = ({ isVisible, memos, onClose }) => {
  const { screenWidth } = useGameUIContext();
  const panelWidth = 310;

  // 位置: 屏幕中央偏右（与经典UI一致），顶部留出TopBar空间
  const panelStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: screenWidth / 2,
      top: 46,
      width: panelWidth,
      display: "flex",
      flexDirection: "column",
      maxHeight: "calc(100vh - 120px)",
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

  if (!isVisible) return null;

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      {/* 顶部金色装饰线 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${wuxiaAccent.gold}88, transparent)`,
          borderRadius: `${borderRadius.xl}px ${borderRadius.xl}px 0 0`,
          pointerEvents: "none",
        }}
      />

      <CloseBtn onClick={onClose} />

      {/* 面板标题 */}
      <div
        style={{
          padding: `${spacing.md}px ${spacing.lg}px`,
          paddingRight: 44, // 为关闭按钮留空间
          background: modernColors.bg.hover,
          borderBottom: `1px solid ${modernColors.border.glass}`,
          display: "flex",
          alignItems: "center",
          gap: spacing.sm,
        }}
      >
        <span style={{ fontSize: 18 }}>📜</span>
        <h3
          style={{
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.semibold,
            color: modernColors.text.primary,
            margin: 0,
            letterSpacing: "0.05em",
          }}
        >
          任务记录
        </h3>
        {memos.length > 0 && (
          <span
            style={{
              marginLeft: "auto",
              marginRight: spacing.xs,
              fontSize: typography.fontSize.xs,
              color: modernColors.text.muted,
              background: modernColors.bg.glassDark,
              padding: `2px 8px`,
              borderRadius: borderRadius.round,
              border: `1px solid ${modernColors.border.glass}`,
            }}
          >
            {memos.length} 条
          </span>
        )}
      </div>

      {/* 内容区 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: `${spacing.xs}px 0`,
        }}
      >
        {memos.length === 0 ? (
          /* 空状态 */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: `${spacing.xl}px`,
              gap: spacing.md,
            }}
          >
            <span style={{ fontSize: 42, opacity: 0.3 }}>📋</span>
            <span
              style={{
                fontSize: typography.fontSize.sm,
                color: modernColors.text.muted,
              }}
            >
              暂无任务记录
            </span>
          </div>
        ) : (
          memos.map((memo, idx) => (
            <MemoItem
              key={`memo-${idx}-${memo.slice(0, 16)}`}
              text={memo}
              index={idx}
              isLast={idx === memos.length - 1}
            />
          ))
        )}
      </div>

      {/* 底部装饰线 */}
      <div
        style={{
          height: 2,
          background: `linear-gradient(90deg, transparent, ${wuxiaAccent.goldDark}, transparent)`,
          borderRadius: `0 0 ${borderRadius.xl}px ${borderRadius.xl}px`,
          flexShrink: 0,
        }}
      />
    </div>
  );
};

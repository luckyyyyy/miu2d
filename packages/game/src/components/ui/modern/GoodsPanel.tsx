/**
 * Modern GoodsPanel - 武侠风格物品背包面板
 * 参考 StatePanel 的设计风格
 */

import type { Good } from "@miu2d/engine/player/goods";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useGameUIContext } from "../../../contexts";
import type { TouchDragData } from "../../../contexts";
import type { DragData, GoodItemData } from "../classic";
import { useAsfImage } from "../classic/hooks";
import { getItemBorderColor, getItemGlowColor, getItemQuality, ItemQuality } from "./Tooltips";
import { borderRadius, glassEffect, modernColors, spacing, transitions, typography } from "./theme";

// 武侠风格配色
const wuxiaAccent = {
  gold: "#D4AF37",
  goldBright: "#FFD700",
  goldDark: "#8B7355",
  crimson: "#C41E3A",
  azure: "#4A90D9",
  jade: "#50C878",
};

interface GoodsPanelProps {
  isVisible: boolean;
  items: (GoodItemData | null)[];
  money: number;
  onItemClick?: (index: number) => void;
  onItemRightClick?: (index: number) => void;
  onItemDrop?: (targetIndex: number, dragData: DragData) => void;
  onItemDragStart?: (index: number, good: Good) => void;
  /** @deprecated 使用 onItemHover 替代 */
  onItemMouseEnter?: (index: number, good: Good | null, rect: DOMRect) => void;
  onItemMouseLeave?: () => void;
  onClose: () => void;
  dragData?: DragData | null;
  onTouchDrop?: (targetIndex: number, data: TouchDragData) => void;
  onItemHover?: (good: Good | null, x: number, y: number) => void;
}

interface ItemSlotProps {
  item: GoodItemData | null;
  index: number;
  actualIndex: number;
  slotSize: number;
  onClick?: () => void;
  onRightClick?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
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

// 物品槽位组件
const GoodsSlot: React.FC<ItemSlotProps> = ({
  item,
  actualIndex,
  slotSize,
  onClick,
  onRightClick,
  onDrop,
  onDragStart,
  onDragOver,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const itemImage = useAsfImage(item?.good?.imagePath ?? null, 0);

  // 获取物品品级颜色
  const qualityBorderColor = getItemBorderColor(item?.good);
  const qualityGlowColor = getItemGlowColor(item?.good);
  const _itemQuality = item?.good ? getItemQuality(item.good.cost) : ItemQuality.Normal;

  // 计算边框颜色：有品级时始终显示品级颜色，hover 时更亮
  const borderColor = qualityBorderColor
    ? qualityBorderColor // 品级颜色始终显示
    : isHovered
      ? modernColors.border.glassLight
      : modernColors.border.glass;

  // 计算边框渐变的第二颜色（稍暗）
  const borderColorSecondary = qualityBorderColor
    ? isHovered
      ? qualityBorderColor // hover 时更亮
      : `${qualityBorderColor}cc` // 非 hover 时稍暗但仍清晰
    : isHovered
      ? `${modernColors.border.glassLight}88`
      : `${modernColors.border.glass}88`;

  // 计算发光效果：有品级时始终有轻微发光，hover 时更强
  const boxShadow = qualityGlowColor
    ? isHovered
      ? `0 0 12px ${qualityGlowColor}, inset 0 0 8px ${qualityGlowColor}`
      : `0 0 6px ${qualityGlowColor}` // 非 hover 时也有轻微发光
    : item && isHovered
      ? `inset 0 0 15px ${wuxiaAccent.gold}22`
      : "none";

  const iconSize = slotSize - 8;

  return (
    <div
      style={{
        width: slotSize,
        height: slotSize,
        position: "relative",
        cursor: item ? "grab" : "default",
        transition: transitions.fast,
        transform: isHovered && item ? "scale(1.05)" : "scale(1)",
      }}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRightClick?.();
      }}
      onMouseEnter={(e) => {
        setIsHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseMove={(e) => {
        if (item) onMouseMove?.(e);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onMouseLeave?.();
      }}
      draggable={!!item}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* 外边框 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${borderColor}, ${borderColorSecondary})`,
          borderRadius: borderRadius.md,
          transition: transitions.fast,
          boxShadow,
        }}
      />

      {/* 内部容器 */}
      <div
        style={{
          position: "absolute",
          inset: 2,
          background: item
            ? isHovered
              ? "rgba(40, 45, 60, 0.95)"
              : "rgba(25, 30, 45, 0.9)"
            : "rgba(15, 20, 30, 0.6)",
          borderRadius: borderRadius.sm,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          transition: transitions.fast,
        }}
      >
        {item && itemImage.dataUrl ? (
          <img
            src={itemImage.dataUrl}
            alt={item.good.name}
            style={{
              maxWidth: iconSize,
              maxHeight: iconSize,
              imageRendering: "pixelated",
              pointerEvents: "none",
              filter: isHovered ? "brightness(1.15)" : "brightness(1)",
              transition: transitions.fast,
            }}
            draggable={false}
          />
        ) : (
          // 空槽位装饰
          <div
            style={{
              width: "60%",
              height: "60%",
              border: `1px dashed ${modernColors.border.glass}`,
              borderRadius: borderRadius.sm,
              opacity: 0.3,
            }}
          />
        )}
      </div>

      {/* 数量显示 */}
      {item && item.count > 1 && (
        <span
          style={{
            position: "absolute",
            bottom: 4,
            right: 6,
            fontSize: 10,
            fontWeight: typography.fontWeight.bold,
            color: modernColors.text.primary,
            textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.8)",
            zIndex: 2,
          }}
        >
          {item.count}
        </span>
      )}
    </div>
  );
};

export const GoodsPanel: React.FC<GoodsPanelProps> = ({
  isVisible,
  items,
  money,
  onItemClick,
  onItemRightClick,
  onItemDrop,
  onItemDragStart,
  onItemMouseEnter,
  onItemMouseLeave,
  onClose,
  dragData,
  onTouchDrop,
  onItemHover,
}) => {
  const { screenWidth } = useGameUIContext();
  const [scrollOffset, setScrollOffset] = useState(0);

  // 面板配置
  const panelWidth = 300;
  const columns = 5;
  const rows = 7;
  const slotSize = 44;
  const gap = 6;
  const itemsPerPage = columns * rows; // 35个物品

  // 位置: 屏幕中央偏右
  const panelStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: screenWidth / 2 + 20,
      top: 46,
      width: panelWidth,
      display: "flex",
      flexDirection: "column",
      ...glassEffect.standard,
      borderRadius: borderRadius.xl,
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

  // 当前显示的物品
  const visibleItems = useMemo(() => {
    const startIndex = scrollOffset * columns;
    return items.slice(startIndex, startIndex + itemsPerPage);
  }, [items, scrollOffset, itemsPerPage]);

  // 最大滚动行数
  const maxScrollRows = Math.max(0, Math.ceil(items.length / columns) - rows);

  // 滚动处理
  const handleScroll = useCallback(
    (e: React.WheelEvent) => {
      const delta = e.deltaY > 0 ? 1 : -1;
      setScrollOffset((prev) => Math.max(0, Math.min(maxScrollRows, prev + delta)));
    },
    [maxScrollRows]
  );

  // 拖放处理
  const handleDragOver = useCallback(
    (_index: number) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    []
  );

  const handleDrop = useCallback(
    (index: number) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (dragData) {
        const bagIndex = scrollOffset * columns + index + 1;
        onItemDrop?.(bagIndex, dragData);
      }
    },
    [dragData, scrollOffset, onItemDrop]
  );

  const handleDragStart = useCallback(
    (index: number) => (e: React.DragEvent) => {
      const bagIndex = scrollOffset * columns + index + 1;
      const item = items[scrollOffset * columns + index];
      if (item) {
        onItemDragStart?.(bagIndex, item.good);
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
        }
      }
    },
    [items, scrollOffset, onItemDragStart]
  );

  const handleMouseEnter = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      const item = items[scrollOffset * columns + index];
      if (onItemHover) {
        onItemHover(item?.good ?? null, e.clientX, e.clientY);
      } else if (onItemMouseEnter) {
        const bagIndex = scrollOffset * columns + index + 1;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onItemMouseEnter(bagIndex, item?.good ?? null, rect);
      }
    },
    [items, scrollOffset, onItemMouseEnter, onItemHover]
  );

  const handleMouseMove = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      const item = items[scrollOffset * columns + index];
      onItemHover?.(item?.good ?? null, e.clientX, e.clientY);
    },
    [items, scrollOffset, onItemHover]
  );

  // 统计物品数量
  const itemCount = useMemo(() => items.filter((i) => i !== null).length, [items]);

  if (!isVisible) return null;

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()} onWheel={handleScroll}>
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
          {/* 背包图标 - 八角形 */}
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
                background: `linear-gradient(135deg, ${wuxiaAccent.jade}44, ${wuxiaAccent.azure}44)`,
                clipPath:
                  "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: 22, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>
                🎒
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
              随身包裹
            </div>
            <div
              style={{
                fontSize: typography.fontSize.sm,
                color: modernColors.text.secondary,
              }}
            >
              物品{" "}
              <span style={{ color: wuxiaAccent.gold, fontWeight: typography.fontWeight.semibold }}>
                {itemCount}
              </span>{" "}
              / {items.length} 件
            </div>
          </div>
        </div>
      </div>

      {/* 物品网格区域 */}
      <div
        style={{
          padding: spacing.md,
          flex: 1,
          position: "relative",
        }}
      >
        {/* 网格 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, ${slotSize}px)`,
            gap: gap,
            justifyContent: "center",
          }}
        >
          {visibleItems.map((item, idx) => {
            const actualIndex = scrollOffset * columns + idx + 1;
            const contentKey = item?.good?.name ?? "empty";
            return (
              <GoodsSlot
                key={`goods-slot-${idx}-${scrollOffset}-${contentKey}`}
                item={item}
                index={idx}
                actualIndex={actualIndex}
                slotSize={slotSize}
                onClick={() => onItemClick?.(actualIndex)}
                onRightClick={() => onItemRightClick?.(actualIndex)}
                onDrop={handleDrop(idx)}
                onDragOver={handleDragOver(idx)}
                onDragStart={handleDragStart(idx)}
                onMouseEnter={handleMouseEnter(idx)}
                onMouseMove={handleMouseMove(idx)}
                onMouseLeave={onItemMouseLeave}
              />
            );
          })}
        </div>

        {/* 滚动指示器 */}
        {maxScrollRows > 0 && (
          <div
            style={{
              position: "absolute",
              right: 4,
              top: spacing.md,
              bottom: spacing.md,
              width: 4,
              background: "rgba(0, 0, 0, 0.3)",
              borderRadius: 2,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: `${(scrollOffset / maxScrollRows) * 80}%`,
                width: "100%",
                height: "20%",
                background: wuxiaAccent.gold,
                borderRadius: 2,
                boxShadow: `0 0 4px ${wuxiaAccent.gold}`,
              }}
            />
          </div>
        )}
      </div>

      {/* 底部金钱显示 */}
      <div
        style={{
          padding: `${spacing.sm}px ${spacing.lg}px ${spacing.md}px`,
          borderTop: `1px solid ${modernColors.border.glass}`,
          background: modernColors.bg.glassDark,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
          <span style={{ fontSize: 18 }}>💰</span>
          <span
            style={{
              fontSize: typography.fontSize.sm,
              color: modernColors.text.secondary,
            }}
          >
            银两
          </span>
        </div>
        <span
          style={{
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.bold,
            color: wuxiaAccent.gold,
            fontFamily: "Georgia, serif",
            textShadow: `0 0 10px ${wuxiaAccent.gold}44`,
          }}
        >
          {money.toLocaleString()}
        </span>
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

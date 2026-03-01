/**
 * GoodsGui Component - based on JxqyHD Engine/Gui/GoodsGui.cs
 * Displays player inventory with item grid and full drag-drop support
 *
 * shows a 3x3 item grid with scroll bar and money display
 * Resources loaded from UI_Settings.ini
 */

import type { UIGoodData } from "@miu2d/engine/gui/ui-types";
import { useDevice } from "@miu2d/shared";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import type { TouchDragData } from "../../../contexts";
import { useTouchDragSource, useTouchDropTarget } from "../../../hooks";
import type { DragData } from "./EquipGui";
import { useAsfImage } from "./hooks";
import { ScrollBar } from "./ScrollBar";
import { useGoodsGuiConfig } from "./useUISettings";

// Item data with Good reference
export interface GoodItemData {
  good: UIGoodData;
  count: number;
}

interface GoodsGuiProps {
  isVisible: boolean;
  items: (GoodItemData | null)[]; // All items in inventory
  money: number;
  screenWidth: number;
  onItemClick?: (index: number) => void;
  onItemRightClick?: (index: number) => void;
  onItemDrop?: (targetIndex: number, dragData: DragData) => void;
  onItemDragStart?: (index: number, good: UIGoodData) => void;
  onItemMouseEnter?: (index: number, good: UIGoodData | null, rect: DOMRect) => void;
  onItemMouseLeave?: () => void;
  onClose: () => void;
  dragData?: DragData | null;
  /** 移动端触摸拖拽 drop 回调 */
  onTouchDrop?: (targetIndex: number, data: TouchDragData) => void;
}

/**
 * Single item slot component with drag-drop support
 */
interface ItemSlotProps {
  item: GoodItemData | null;
  index: number;
  /** 实际的背包索引（用于拖拽数据） */
  actualIndex: number;
  config: { left: number; top: number; width: number; height: number };
  onClick?: () => void;
  onRightClick?: (e: React.MouseEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  onTouchDragStart?: () => void;
  /** 触摸拖拽 drop 回调 */
  onTouchDrop?: (data: TouchDragData) => void;
}

const ItemSlot: React.FC<ItemSlotProps> = ({
  item,
  index,
  actualIndex,
  config,
  onClick,
  onRightClick,
  onDrop,
  onDragStart,
  onDragOver,
  onMouseEnter,
  onMouseLeave,
  onTouchDragStart,
  onTouchDrop,
}) => {
  // Use slot icon (iconPath) for goods grid; fall back to imagePath if no icon defined.
  // Scale DOWN if icon is larger than slot, never UP.
  const itemImage = useAsfImage(item?.good?.iconPath || item?.good?.imagePath || null, 0);
  const { isMobile } = useDevice();

  // 触摸拖拽支持（仅移动端）
  const touchHandlers = useTouchDragSource({
    hasContent: !!item,
    getDragData: () =>
      item
        ? {
            type: "goods",
            bagIndex: actualIndex,
            source: "goodsGui",
            goodsInfo: item.good,
            displayName: item.good.name,
            iconPath: item.good.iconPath || item.good.imagePath,
          }
        : null,
    onClick,
    enabled: isMobile,
  });

  // 触摸拖拽目标（仅移动端）- 接受物品和装备拖拽
  const dropRef = useTouchDropTarget({
    id: `goods-slot-${index}`,
    onDrop: (data) => {
      console.log(
        "[GoodsGui] ItemSlot onDrop:",
        data.type,
        "bagIndex:",
        data.bagIndex,
        "equipSlot:",
        data.equipSlot,
        "target actualIndex:",
        actualIndex
      );
      onTouchDrop?.(data);
    },
    canDrop: (data) => data.type === "goods" || data.type === "equip",
    enabled: isMobile,
  });

  return (
    <div
      ref={dropRef}
      style={{
        position: "absolute",
        left: config.left,
        top: config.top,
        width: config.width,
        height: config.height,
        cursor: item ? "grab" : "default",
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: "inset 0 0 0 1px rgba(100,80,30,0.4)",
        touchAction: isMobile ? "none" : undefined,
      }}
      title={item?.good?.name || "空"}
      draggable={!isMobile && !!item}
      onClick={onClick}
      onContextMenu={
        !isMobile
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onRightClick?.(e);
            }
          : undefined
      }
      // PC 端拖放事件
      onDragStart={!isMobile && !!item ? onDragStart : undefined}
      onDrop={!isMobile ? onDrop : undefined}
      onDragOver={!isMobile ? onDragOver : undefined}
      // PC 端鼠标事件
      onMouseEnter={!isMobile ? onMouseEnter : undefined}
      onMouseLeave={!isMobile ? onMouseLeave : undefined}
      // 移动端触摸事件
      {...touchHandlers}
    >
      {item && itemImage.dataUrl && (
        <>
          {(() => {
            const scale =
              itemImage.width > 0 && itemImage.height > 0
                ? Math.min(1, Math.min(config.width / itemImage.width, config.height / itemImage.height))
                : 1;
            const displayW = itemImage.width * scale;
            const displayH = itemImage.height * scale;
            return (
              <img
                src={itemImage.dataUrl}
                alt={item.good.name}
                draggable={false}
                style={{
                  position: "absolute",
                  left: (config.width - displayW) / 2,
                  top: (config.height - displayH) / 2,
                  width: displayW,
                  height: displayH,
                  imageRendering: "pixelated",
                  cursor: "grab",
                }}
              />
            );
          })()}
          {/* Count display - always show count like TopLeftText */}
          <span
            style={{
              position: "absolute",
              left: 2,
              top: 1,
              fontSize: 10,
              color: "rgba(167, 157, 255, 0.9)",
              textShadow: "0 1px 2px #000",
              pointerEvents: "none",
            }}
          >
            {item.count}
          </span>
        </>
      )}
    </div>
  );
};

export const GoodsGui: React.FC<GoodsGuiProps> = ({
  isVisible,
  items,
  money,
  screenWidth,
  onItemClick,
  onItemRightClick,
  onItemDrop,
  onItemDragStart,
  onItemMouseEnter,
  onItemMouseLeave,
  dragData,
  onTouchDrop,
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);

  // Load config from UI_Settings.ini
  const config = useGoodsGuiConfig();

  // Load panel background
  const panelImage = useAsfImage(config?.panel.image || "asf/ui/common/panel3.asf");
  // 装饰性叠加图（如 sword2 的 goods/dragbox.msf 格子边框）
  const overlayImage = useAsfImage(config?.panel.overlayImage ?? "");
  // 金币图标
  const goldIconImage = useAsfImage(config?.goldIcon?.image ?? "");

  // Calculate panel position - Globals.WindowWidth / 2f + leftAdjust
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

  // Calculate currently visible items
  const visibleItems = useMemo(() => {
    if (!config) return [];
    const cols = config.cols ?? 3;
    const startIndex = scrollOffset * cols;
    return config.items.map((_, idx) => items[startIndex + idx] ?? null);
  }, [items, scrollOffset, config]);

  // Calculate max scroll rows
  const cols = config?.cols ?? 3;
  const rows = config?.rows ?? 3;
  const maxScrollRows = Math.max(0, Math.ceil(items.length / cols) - rows);

  // Scroll handler
  const handleScroll = useCallback(
    (delta: number) => {
      setScrollOffset((prev) => Math.max(0, Math.min(maxScrollRows, prev + delta)));
    },
    [maxScrollRows]
  );

  // Handle drag over
  const handleDragOver = useCallback(
    (_index: number) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    []
  );

  // Handle drop
  const handleDrop = useCallback(
    (index: number) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (dragData) {
        // 统一输出 1-based 背包索引
        const bagIndex = scrollOffset * cols + index + 1;
        onItemDrop?.(bagIndex, dragData);
      }
    },
    [dragData, scrollOffset, onItemDrop, cols]
  );

  // Handle drag start
  const handleDragStart = useCallback(
    (index: number) => (e: React.DragEvent) => {
      // 统一输出 1-based 背包索引
      const bagIndex = scrollOffset * cols + index + 1;
      // items 数组是 0-based
      const item = items[scrollOffset * cols + index];
      if (item) {
        onItemDragStart?.(bagIndex, item.good);
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          const img = e.currentTarget.querySelector("img");
          if (img) {
            e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
          }
        }
      }
    },
    [items, scrollOffset, onItemDragStart, cols]
  );

  // Handle mouse enter for tooltip
  const handleMouseEnter = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      // 统一输出 1-based 背包索引
      const bagIndex = scrollOffset * cols + index + 1;
      // items 数组是 0-based
      const item = items[scrollOffset * cols + index];
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onItemMouseEnter?.(bagIndex, item?.good ?? null, rect);
    },
    [items, scrollOffset, onItemMouseEnter, cols]
  );

  if (!isVisible || !config || !panelStyle) return null;

  return (
    <div
      style={panelStyle}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => handleScroll(e.deltaY > 0 ? 1 : -1)}
    >
      {/* Background panel */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="物品面板"
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

      {/* 装饰性叠加图（物品格子边框 dragbox） */}
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

      {/* Item slots */}
      {config.items.map((itemConfig, idx) => {
        const item = visibleItems[idx];
        // 背包索引从 1 开始 (STORE_INDEX_BEGIN = 1)
        const actualIdx = scrollOffset * cols + idx + 1;
        // 使用物品名称作为 key 的一部分，确保交换物品时组件正确重新渲染
        const contentKey = item?.good?.name ?? "empty";
        return (
          <ItemSlot
            key={`goods-slot-${idx}-${scrollOffset}-${contentKey}`}
            item={item}
            index={idx}
            actualIndex={actualIdx}
            config={itemConfig}
            onClick={() => onItemClick?.(actualIdx)}
            onRightClick={() => onItemRightClick?.(actualIdx)}
            onDrop={handleDrop(idx)}
            onDragOver={handleDragOver(idx)}
            onDragStart={handleDragStart(idx)}
            onMouseEnter={handleMouseEnter(idx)}
            onMouseLeave={onItemMouseLeave}
            onTouchDrop={(data) => onTouchDrop?.(actualIdx, data)}
          />
        );
      })}

      {/* Money display */}
      <div
        style={{
          position: "absolute",
          left: config.money.left,
          top: config.money.top,
          width: config.money.width,
          height: config.money.height,
          fontSize: 12,
          fontFamily: "SimSun, serif",
          color: config.money.color,
        }}
      >
        {money}
      </div>

      {/* Gold icon */}
      {config.goldIcon && goldIconImage.dataUrl && (
        <img
          src={goldIconImage.dataUrl}
          alt=""
          style={{
            position: "absolute",
            left: config.goldIcon.left,
            top: config.goldIcon.top,
            width: goldIconImage.width,
            height: goldIconImage.height,
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Scroll bar with ASF texture */}
      <ScrollBar
        value={scrollOffset}
        minValue={0}
        maxValue={maxScrollRows}
        left={config.scrollBar.left}
        top={config.scrollBar.top}
        width={config.scrollBar.width}
        height={config.scrollBar.height}
        buttonImage={config.scrollBar.button}
        onChange={setScrollOffset}
        visible={maxScrollRows > 0}
      />
    </div>
  );
};

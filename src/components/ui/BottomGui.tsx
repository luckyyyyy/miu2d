/**
 * BottomGui Component - based on JxqyHD Engine/Gui/BottomGui.cs
 * Bottom hotbar for items and skills using ASF images from resources
 *
 * C# Reference: BottomGui.cs handles item slots and magic slots
 * Resources: asf/ui/bottom/window.asf
 */
import React, { useState, useMemo, useCallback } from "react";
import type { HotbarItem } from "../../engine/gui/types";
import { useAsfImage } from "./hooks";

// UI配置 - 对应 UI_Settings.ini 中的 [Bottom] 和 [Bottom_Items] 部分
const UI_CONFIG = {
  panel: {
    image: "asf/ui/bottom/window.asf",
    leftAdjust: 102,  // 相对于屏幕中心的偏移
    topAdjust: 0,
  },
  // 各个图标位置：1-3 物品，4-8 武功
  items: [
    { left: 7, top: 20, width: 30, height: 40 },    // 物品槽 1
    { left: 44, top: 20, width: 30, height: 40 },   // 物品槽 2
    { left: 82, top: 20, width: 30, height: 40 },   // 物品槽 3
    { left: 199, top: 20, width: 30, height: 40 },  // 武功槽 1
    { left: 238, top: 20, width: 30, height: 40 },  // 武功槽 2
    { left: 277, top: 20, width: 30, height: 40 },  // 武功槽 3
    { left: 316, top: 20, width: 30, height: 40 },  // 武功槽 4
    { left: 354, top: 20, width: 30, height: 40 },  // 武功槽 5
  ],
};

// 快捷键
const SLOT_KEYS = ["Z", "X", "C", "1", "2", "3", "4", "5"];

interface BottomGuiProps {
  items: (HotbarItem | null)[];
  screenWidth: number;
  screenHeight: number;
  onItemClick: (index: number) => void;
  onItemRightClick: (index: number) => void;
}

/**
 * 单个槽位组件
 */
interface SlotProps {
  index: number;
  item: HotbarItem | null;
  config: { left: number; top: number; width: number; height: number };
  hotkey: string;
  isHovered: boolean;
  onClick: () => void;
  onRightClick: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const Slot: React.FC<SlotProps> = ({
  index,
  item,
  config,
  hotkey,
  isHovered,
  onClick,
  onRightClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  const isItemSlot = index < 3;

  // 加载物品/武功图标（如果有）
  const itemIcon = useAsfImage(item?.iconPath ?? null, 0);

  return (
    <div
      style={{
        position: "absolute",
        left: config.left,
        top: config.top,
        width: config.width,
        height: config.height,
        cursor: "pointer",
        background: isHovered ? "rgba(255, 255, 255, 0.1)" : "transparent",
        borderRadius: 2,
      }}
      title={item?.name || (isItemSlot ? `物品槽 ${index + 1}` : `武功槽 ${index - 2}`) + ` (${hotkey})`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onContextMenu={onRightClick}
    >
      {/* 物品图标 */}
      {item && itemIcon.dataUrl && (
        <img
          src={itemIcon.dataUrl}
          alt={item.name}
          style={{
            position: "absolute",
            left: (config.width - itemIcon.width) / 2,
            top: (config.height - itemIcon.height) / 2,
            width: itemIcon.width,
            height: itemIcon.height,
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
        />
      )}

      {/* 物品数量（仅物品槽） */}
      {item && item.count !== undefined && item.count > 1 && (
        <span
          style={{
            position: "absolute",
            bottom: 1,
            right: 2,
            fontSize: 9,
            color: "#fff",
            fontWeight: "bold",
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            pointerEvents: "none",
          }}
        >
          {item.count}
        </span>
      )}

      {/* 冷却显示 */}
      {item && item.cooldown > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "rgba(0, 0, 0, 0.7)",
            color: "#fff",
            fontSize: 9,
            textAlign: "center",
            padding: "1px 0",
            pointerEvents: "none",
          }}
        >
          {(item.cooldown / 1000).toFixed(1)}
        </div>
      )}

      {/* 空槽指示 */}
      {!item && (
        <div
          style={{
            position: "absolute",
            left: 4,
            top: 8,
            right: 4,
            bottom: 4,
            border: "1px dashed rgba(255, 255, 255, 0.2)",
            borderRadius: 2,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};

export const BottomGui: React.FC<BottomGuiProps> = ({
  items,
  screenWidth,
  screenHeight: _screenHeight,
  onItemClick,
  onItemRightClick,
}) => {
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);

  // 加载面板背景
  const panelImage = useAsfImage(UI_CONFIG.panel.image);

  // 计算面板位置
  // C#: Position = new Vector2((Globals.WindowWidth - BaseTexture.Width)/2f + leftAdjust,
  //                            Globals.WindowHeight - BaseTexture.Height + topAdjust)
  const panelStyle = useMemo(() => {
    const panelWidth = panelImage.width || 390;  // fallback size
    const panelHeight = panelImage.height || 68;

    return {
      position: "absolute" as const,
      left: (screenWidth - panelWidth) / 2 + UI_CONFIG.panel.leftAdjust,
      bottom: 0 - UI_CONFIG.panel.topAdjust,
      width: panelWidth,
      height: panelHeight,
      pointerEvents: "auto" as const,
    };
  }, [screenWidth, panelImage.width, panelImage.height]);

  const handleRightClick = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    onItemRightClick(index);
  }, [onItemRightClick]);

  // 如果面板图片还在加载
  if (panelImage.isLoading) {
    return (
      <div style={{
        ...panelStyle,
        background: "rgba(30, 50, 80, 0.9)",
        borderRadius: 4,
      }} />
    );
  }

  return (
    <div style={panelStyle}>
      {/* 背景面板 */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="快捷栏"
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

      {/* 槽位 */}
      {UI_CONFIG.items.map((cfg, index) => (
        <Slot
          key={index}
          index={index}
          item={items[index] ?? null}
          config={cfg}
          hotkey={SLOT_KEYS[index]}
          isHovered={hoveredSlot === index}
          onClick={() => onItemClick(index)}
          onRightClick={(e) => handleRightClick(e, index)}
          onMouseEnter={() => setHoveredSlot(index)}
          onMouseLeave={() => setHoveredSlot(null)}
        />
      ))}
    </div>
  );
};

/**
 * Modern SaveLoadPanel - 存档/读档面板
 * Props 与经典 SaveLoadGui 完全一致
 */

import { logger } from "@miu2d/engine/core/logger";
import { type SaveSlotInfo, getSaveSlots } from "@miu2d/engine/runtime/storage";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GlassButton, PanelHeader } from "./components";
import { borderRadius, glassEffect, modernColors, spacing, typography } from "./theme";

interface SaveLoadPanelProps {
  isVisible: boolean;
  screenWidth: number;
  screenHeight: number;
  /** 是否允许存档 (战斗中或禁存时为 false) */
  canSave: boolean;
  /** 存档回调 */
  onSave: (index: number) => Promise<boolean>;
  /** 读档回调 */
  onLoad: (index: number) => Promise<boolean>;
  /** 关闭回调 */
  onClose: () => void;
}

interface SaveSlotRowProps {
  slot: SaveSlotInfo;
  isSelected: boolean;
  onClick: () => void;
}

const SaveSlotRow: React.FC<SaveSlotRowProps> = ({ slot, isSelected, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  // 显示文本：进度一 ~ 进度七（与经典 UI 一致）
  const slotLabels = ["进度一", "进度二", "进度三", "进度四", "进度五", "进度六", "进度七"];
  const displayText = slotLabels[slot.index - 1] || `存档 ${slot.index}`;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        padding: spacing.sm,
        gap: spacing.md,
        background: isSelected
          ? "rgba(100, 200, 255, 0.2)"
          : isHovered
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.2)",
        border: `1px solid ${
          isSelected
            ? modernColors.primary
            : isHovered
              ? modernColors.border.glassLight
              : modernColors.border.glass
        }`,
        borderRadius: borderRadius.md,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      {/* 缩略图预览 */}
      <div
        style={{
          width: 64,
          height: 48,
          borderRadius: borderRadius.sm,
          overflow: "hidden",
          background: "rgba(0, 0, 0, 0.4)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {slot.screenshot ? (
          <img
            src={slot.screenshot}
            alt="存档截图"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <span style={{ fontSize: typography.fontSize.xs, color: modernColors.text.muted }}>
            空
          </span>
        )}
      </div>

      {/* 存档信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: typography.fontSize.sm,
              fontWeight: isSelected
                ? typography.fontWeight.semibold
                : typography.fontWeight.normal,
              color: isSelected ? modernColors.primary : modernColors.text.primary,
            }}
          >
            {displayText}
          </span>
        </div>

        {!slot.exists ? (
          <div
            style={{
              fontSize: typography.fontSize.xs,
              color: modernColors.text.muted,
            }}
          >
            空存档位
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              gap: spacing.md,
              fontSize: typography.fontSize.xs,
              color: modernColors.text.muted,
            }}
          >
            {slot.mapName && <span>{slot.mapName}</span>}
            {slot.level !== undefined && <span>Lv.{slot.level}</span>}
            {slot.time && <span>{slot.time}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export const SaveLoadPanel: React.FC<SaveLoadPanelProps> = ({
  isVisible,
  screenWidth,
  screenHeight,
  canSave,
  onSave,
  onLoad,
  onClose,
}) => {
  // 存档槽位列表（组件内部管理，与经典 UI 一致）
  const [slots, setSlots] = useState<SaveSlotInfo[]>([]);
  // 当前选中的槽位索引 (0-6 对应 进度一~进度七)
  const [selectedIndex, setSelectedIndex] = useState(0);
  // 操作中的槽位
  const [operatingSlot, setOperatingSlot] = useState<number | null>(null);
  // 提示消息
  const [message, setMessage] = useState("");

  const panelWidth = 440;
  const panelHeight = 480;

  // 加载存档列表
  const loadSlots = useCallback(() => {
    try {
      const slotInfos = getSaveSlots();
      setSlots(slotInfos);
    } catch (error) {
      logger.error("[SaveLoadPanel] Failed to load save slots:", error);
    }
  }, []);

  // 显示时加载存档列表
  useEffect(() => {
    if (isVisible) {
      loadSlots();
      setMessage("");
    }
  }, [isVisible, loadSlots]);

  // 获取当前选中的槽位信息
  const selectedSlot = useMemo(() => {
    return slots.find((s) => s.index === selectedIndex + 1);
  }, [slots, selectedIndex]);

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
      ...glassEffect.standard,
      borderRadius: borderRadius.lg,
      pointerEvents: "auto",
    }),
    [screenWidth, screenHeight]
  );

  // 存档操作
  const handleSave = useCallback(async () => {
    if (!canSave) {
      setMessage("当前无法存档");
      return;
    }

    const slotIndex = selectedIndex + 1;
    setOperatingSlot(slotIndex);
    setMessage("");

    try {
      const success = await onSave(slotIndex);
      if (success) {
        setMessage("存档成功");
        loadSlots();
      } else {
        setMessage("存档失败");
      }
    } catch (error) {
      logger.error("[SaveLoadPanel] Save error:", error);
      setMessage("存档失败");
    } finally {
      setOperatingSlot(null);
    }
  }, [canSave, selectedIndex, onSave, loadSlots]);

  // 读档操作
  const handleLoad = useCallback(async () => {
    const slotIndex = selectedIndex + 1;
    const slot = slots.find((s) => s.index === slotIndex);

    if (!slot?.exists) {
      setMessage("该存档位为空");
      return;
    }

    setOperatingSlot(slotIndex);
    setMessage("");

    try {
      const success = await onLoad(slotIndex);
      if (success) {
        // 读档成功后关闭界面
        onClose();
      } else {
        setMessage("读档失败");
      }
    } catch (error) {
      logger.error("[SaveLoadPanel] Load error:", error);
      setMessage("读档失败");
    } finally {
      setOperatingSlot(null);
    }
  }, [selectedIndex, slots, onLoad, onClose]);

  // 选择槽位
  const handleSelectSlot = useCallback((index: number) => {
    setSelectedIndex(index);
    setMessage("");
  }, []);

  if (!isVisible) return null;

  const isOperating = operatingSlot !== null;

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      <PanelHeader title="存档/读档" onClose={onClose} />

      {/* 存档列表 */}
      <div
        style={{
          flex: 1,
          padding: spacing.md,
          display: "flex",
          flexDirection: "column",
          gap: spacing.sm,
          overflowY: "auto",
        }}
      >
        {slots.map((slot, index) => (
          <SaveSlotRow
            key={`slot-${slot.index}`}
            slot={slot}
            isSelected={selectedIndex === index}
            onClick={() => handleSelectSlot(index)}
          />
        ))}
      </div>

      {/* 提示消息 */}
      {message && (
        <div
          style={{
            padding: `${spacing.sm} ${spacing.md}`,
            textAlign: "center",
            fontSize: typography.fontSize.sm,
            color: message.includes("成功") ? modernColors.success : modernColors.warning,
          }}
        >
          {message}
        </div>
      )}

      {/* 底部操作区 - 同时显示存档和读档按钮（与经典 UI 一致） */}
      <div
        style={{
          padding: spacing.md,
          borderTop: `1px solid ${modernColors.border.glass}`,
          background: "rgba(0, 0, 0, 0.2)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: spacing.md,
          borderBottomLeftRadius: borderRadius.lg,
          borderBottomRightRadius: borderRadius.lg,
        }}
      >
        <GlassButton onClick={handleSave} primary disabled={!canSave || isOperating}>
          存档
        </GlassButton>
        <GlassButton onClick={handleLoad} primary disabled={!selectedSlot?.exists || isOperating}>
          读档
        </GlassButton>
        <GlassButton onClick={onClose} disabled={isOperating}>
          取消
        </GlassButton>
      </div>
    </div>
  );
};

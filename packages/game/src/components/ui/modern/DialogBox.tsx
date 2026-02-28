/**
 * Modern DialogBox - NPC对话框
 * 位置与经典UI一致，使用引擎的 textProgress 控制打字机效果
 */

import type { DialogGuiState } from "@miu2d/engine/gui/ui-types";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useAsfImage } from "../classic/hooks";
import { getPortraitPathByIndex } from "../portraitUtils";
import { borderRadius, glassEffect, modernColors, spacing, typography } from "./theme";

interface DialogBoxProps {
  state: DialogGuiState;
  screenWidth?: number;
  screenHeight?: number;
  onClose: () => void;
  onSelectionMade?: (selection: number) => void;
}

function getPortraitPath(portraitIndex: number): string | null {
  return getPortraitPathByIndex(portraitIndex);
}

// Color mapping for <color=X> tags
// "Default" and "Black" are special - they restore the default color
// (In original game scripts, <color=Black> was used to reset to default color on dark backgrounds)
const colorMap: Record<string, string> = {
  red: "#ff6b6b",
  Red: "#ff6b6b",
  RED: "#ff6b6b",
  blue: "#74b9ff",
  Blue: "#74b9ff",
  BLUE: "#74b9ff",
  green: "#55efc4",
  Green: "#55efc4",
  GREEN: "#55efc4",
  yellow: "#ffeaa7",
  Yellow: "#ffeaa7",
  YELLOW: "#ffeaa7",
  // Note: "black" maps to a special marker, handled in parseColoredText to restore default
  white: "#ffffff",
  White: "#ffffff",
  WHITE: "#ffffff",
  purple: "#a29bfe",
  Purple: "#a29bfe",
  orange: "#fdcb6e",
  Orange: "#fdcb6e",
};

// Colors that should restore to default (used in scripts to reset color)
const RESTORE_DEFAULT_COLORS = new Set([
  "black",
  "Black",
  "BLACK",
  "Default",
  "default",
  "DEFAULT",
]);

// 文本段落类型
interface TextSegment {
  text: string;
  color: string;
  isUrl?: boolean;
}

// Regex for splitting text by URLs (capturing group so split keeps the URLs)
const URL_SPLIT_REGEX = /(https?:\/\/[^\s<>"]+)/g;

// 解析带颜色标签的文本
// 支持 <color=Red>红色文字<color=Default> 格式
// 注意: <color=Black> 在原版脚本中用于恢复默认颜色
function parseColoredText(text: string, defaultColor: string): TextSegment[] {
  // Step 1: parse <color=X> tags into color segments
  const colorSegments: { text: string; color: string }[] = [];
  const regex = /<color=([^>]+)>/gi;
  let lastIndex = 0;
  let currentColor = defaultColor;
  let match: RegExpExecArray | null = regex.exec(text);

  while (match !== null) {
    if (match.index > lastIndex) {
      const segment = text.substring(lastIndex, match.index);
      if (segment) {
        colorSegments.push({ text: segment, color: currentColor });
      }
    }
    // Handle colors that restore to default (Black, Default, etc.)
    const colorName = match[1];
    if (RESTORE_DEFAULT_COLORS.has(colorName)) {
      currentColor = defaultColor;
    } else {
      currentColor = colorMap[colorName] || colorName || defaultColor;
    }
    lastIndex = match.index + match[0].length;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) {
    colorSegments.push({ text: text.substring(lastIndex), color: currentColor });
  }

  // Step 2: split each color segment further by URLs
  const segments: TextSegment[] = [];
  for (const seg of colorSegments) {
    const parts = seg.text.split(URL_SPLIT_REGEX);
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      // Odd indices are the captured URL matches
      segments.push({ text: parts[i], color: seg.color, isUrl: i % 2 === 1 });
    }
  }

  return segments;
}

// 渲染带颜色的文本（含可点击 URL）
const ColoredText: React.FC<{ text: string; defaultColor?: string }> = ({
  text,
  defaultColor = "#ffffff",
}) => {
  const segments = useMemo(() => parseColoredText(text, defaultColor), [text, defaultColor]);

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.isUrl) {
          return (
            <a
              key={`url-${index}`}
              href={segment.text}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#74b9ff",
                textDecoration: "underline",
                cursor: "pointer",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {segment.text}
            </a>
          );
        }
        const isHighlight = segment.color !== defaultColor;
        return (
          <span
            key={`${segment.color}-${index}`}
            style={{
              color: segment.color,
              ...(isHighlight && {
                paddingLeft: 2,
                paddingRight: 2,
              }),
            }}
          >
            {segment.text}
          </span>
        );
      })}
    </>
  );
};

// 根据 textProgress 从带颜色标签的文本中提取要显示的部分
function getDisplayedText(text: string, textProgress: number): string {
  const targetLength = Math.floor(textProgress);

  // 找出所有 color 标签的位置
  const tagRegex = /<color=[^>]+>/gi;
  let tagMatch: RegExpExecArray | null = tagRegex.exec(text);
  const tagPositions: { start: number; end: number }[] = [];

  while (tagMatch !== null) {
    tagPositions.push({ start: tagMatch.index, end: tagMatch.index + tagMatch[0].length });
    tagMatch = tagRegex.exec(text);
  }

  // 计算要显示的原始文本长度
  let plainIndex = 0;
  let originalIndex = 0;
  let tagIdx = 0;

  while (plainIndex < targetLength && originalIndex < text.length) {
    // 跳过标签
    while (tagIdx < tagPositions.length && originalIndex === tagPositions[tagIdx].start) {
      originalIndex = tagPositions[tagIdx].end;
      tagIdx++;
    }
    if (originalIndex < text.length) {
      plainIndex++;
      originalIndex++;
    }
  }

  // 包含尾随标签
  while (tagIdx < tagPositions.length && originalIndex === tagPositions[tagIdx].start) {
    originalIndex = tagPositions[tagIdx].end;
    tagIdx++;
  }

  return text.substring(0, originalIndex);
}

export const DialogBox: React.FC<DialogBoxProps> = ({
  state,
  screenWidth = 800,
  screenHeight = 600,
  onClose,
  onSelectionMade,
}) => {
  const {
    isVisible,
    text,
    textProgress,
    isComplete,
    portraitIndex,
    nameText,
    isInSelecting,
    selectA,
    selectB,
  } = state;
  const portraitPath = getPortraitPath(portraitIndex);
  const portraitImage = useAsfImage(portraitPath, 0);

  // 选择悬停状态
  const [hoveredSelection, setHoveredSelection] = useState<number>(-1);

  const panelWidth = Math.min(600, screenWidth - 40);
  const panelHeight = 150;

  // 使用引擎的 textProgress 计算显示文本
  const displayedText = useMemo(() => {
    if (!text) return "";
    return getDisplayedText(text, textProgress);
  }, [text, textProgress]);

  // 位置: 屏幕底部中央，往上移一些
  const panelStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: (screenWidth - panelWidth) / 2,
      bottom: 100, // 往上移：40 -> 100
      width: panelWidth,
      display: "flex",
      ...glassEffect.standard,
      borderRadius: borderRadius.lg,
      pointerEvents: "auto",
      cursor: isInSelecting ? "default" : "pointer",
    }),
    [screenWidth, panelWidth, isInSelecting]
  );

  // 点击处理：非选择模式下点击继续对话
  const handleClick = useCallback(() => {
    if (!isInSelecting) {
      onClose();
    }
  }, [isInSelecting, onClose]);

  // 处理选择点击
  const handleSelectionClick = useCallback(
    (selection: number) => {
      if (isInSelecting && onSelectionMade) {
        onSelectionMade(selection);
      }
    },
    [isInSelecting, onSelectionMade]
  );

  if (!isVisible) return null;

  return (
    <>
      {/* 全屏透明遮罩 - 对话模式下点击任意位置可以下一步 */}
      {!isInSelecting && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100,
            background: "transparent",
            cursor: "pointer",
            pointerEvents: "auto",
          }}
          onClick={handleClick}
        />
      )}

      <div style={{ ...panelStyle, zIndex: 101 }} onClick={handleClick}>
        {/* 头像区域 */}
        {portraitImage.dataUrl && (
          <div
            style={{
              width: 120,
              minHeight: panelHeight,
              background: "rgba(0, 0, 0, 0.2)",
              borderRight: `1px solid ${modernColors.border.glass}`,
              borderTopLeftRadius: borderRadius.lg,
              borderBottomLeftRadius: borderRadius.lg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: spacing.sm,
            }}
          >
            <img
              src={portraitImage.dataUrl}
              alt="portrait"
              style={{
                maxWidth: 100,
                maxHeight: 130,
                imageRendering: "pixelated",
              }}
            />
          </div>
        )}

        {/* 对话内容 */}
        <div
          style={{
            flex: 1,
            padding: spacing.lg,
            display: "flex",
            flexDirection: "column",
            minHeight: panelHeight,
          }}
        >
          {/* 说话者名字 */}
          {nameText && (
            <div
              style={{
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.semibold,
                color: modernColors.primary,
                marginBottom: spacing.sm,
                display: "flex",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <span>💬</span>
              {nameText}
            </div>
          )}

          {/* 对话文本 */}
          <div
            style={{
              flex: 1,
              fontSize: typography.fontSize.md,
              color: modernColors.text.primary,
              lineHeight: 1.8,
              whiteSpace: "pre-wrap",
            }}
          >
            <ColoredText text={displayedText} defaultColor={modernColors.text.primary} />
            {!isComplete && !isInSelecting && (
              <span
                style={{
                  display: "inline",
                  color: modernColors.text.primary,
                  animation: "blink 0.5s infinite",
                }}
              >
                |
              </span>
            )}
          </div>

          {/* 点击提示 */}
          {isComplete && !isInSelecting && (
            <div
              style={{
                alignSelf: "flex-end",
                fontSize: typography.fontSize.xs,
                color: modernColors.text.muted,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              点击继续
              <span style={{ animation: "bounce 1s infinite" }}>▼</span>
            </div>
          )}

          {/* 选择模式 - 选项按钮 */}
          {isInSelecting && (selectA || selectB) && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: spacing.sm,
                marginTop: spacing.md,
              }}
            >
              {selectA && (
                <button
                  type="button"
                  style={{
                    padding: `${spacing.sm}px ${spacing.lg}px`,
                    background:
                      hoveredSelection === 0 ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.3)",
                    border: `1px solid ${hoveredSelection === 0 ? modernColors.border.glassLight : modernColors.border.glass}`,
                    borderRadius: borderRadius.md,
                    color:
                      hoveredSelection === 0
                        ? modernColors.text.primary
                        : modernColors.text.secondary,
                    fontSize: typography.fontSize.md,
                    fontWeight:
                      hoveredSelection === 0
                        ? typography.fontWeight.semibold
                        : typography.fontWeight.normal,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    textAlign: "left",
                    transform: hoveredSelection === 0 ? "translateX(4px)" : "none",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectionClick(0);
                  }}
                  onMouseEnter={() => setHoveredSelection(0)}
                  onMouseLeave={() => setHoveredSelection(-1)}
                >
                  {selectA}
                </button>
              )}
              {selectB && (
                <button
                  type="button"
                  style={{
                    padding: `${spacing.sm}px ${spacing.lg}px`,
                    background:
                      hoveredSelection === 1 ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.3)",
                    border: `1px solid ${hoveredSelection === 1 ? modernColors.border.glassLight : modernColors.border.glass}`,
                    borderRadius: borderRadius.md,
                    color:
                      hoveredSelection === 1
                        ? modernColors.text.primary
                        : modernColors.text.secondary,
                    fontSize: typography.fontSize.md,
                    fontWeight:
                      hoveredSelection === 1
                        ? typography.fontWeight.semibold
                        : typography.fontWeight.normal,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    textAlign: "left",
                    transform: hoveredSelection === 1 ? "translateX(4px)" : "none",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectionClick(1);
                  }}
                  onMouseEnter={() => setHoveredSelection(1)}
                  onMouseLeave={() => setHoveredSelection(-1)}
                >
                  {selectB}
                </button>
              )}
            </div>
          )}
        </div>

        {/* 动画样式 */}
        <style>
          {`
            @keyframes blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(3px); }
            }
          `}
        </style>
      </div>
    </>
  );
};

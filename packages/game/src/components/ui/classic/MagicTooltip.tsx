/**
 * MagicTooltip Component
 * Supports two tooltip types based on [ToolTip_Use_Type].UseType from UI_Settings.ini:
 * - Type1: Image-based (tipbox.asf background) - JxqyHD Engine/Gui/ToolTipGuiType1.cs
 * - Type2: Text-based (semi-transparent dark bg, colored text rows)
 */

import { colorToCSS, type UiColorRGBA } from "@miu2d/engine/gui/ui-settings";

/** 强制 alpha=255，让文字完全不透明 */
function solidColor(c: UiColorRGBA): string {
  return `rgb(${c.r},${c.g},${c.b})`;
}
import type { MagicItemInfo } from "@miu2d/engine/magic";
import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useToolTipType1Config, useToolTipType2Config, useToolTipUseTypeConfig } from "./useUISettings";
import { useAsfAnimation, useAsfImage } from "./hooks";

interface MagicTooltipProps {
  magicInfo: MagicItemInfo | null;
  position: { x: number; y: number };
  isVisible: boolean;
}

// ============= Type1 Magic Tooltip (image-based, tipbox.asf) =============

const MagicTooltipType1: React.FC<MagicTooltipProps> = ({ magicInfo, position, isVisible }) => {
  const cfg = useToolTipType1Config();
  const bgImage = useAsfImage(cfg.image, 0);
  const [bgSize, setBgSize] = useState({ width: 265, height: 270 });

  useEffect(() => {
    if (bgImage.dataUrl) {
      const img = new Image();
      img.onload = () => {
        setBgSize({ width: img.width, height: img.height });
      };
      img.src = bgImage.dataUrl;
    }
  }, [bgImage.dataUrl]);

  const magic = magicInfo?.magic;
  const magicImage = useAsfAnimation(magic?.image ?? null, true, true);

  if (!isVisible || !magicInfo) return null;

  const tooltipWidth = bgSize.width;
  const tooltipHeight = bgSize.height;
  const adjustedX = Math.min(position.x + 10, window.innerWidth - tooltipWidth - 20);
  const adjustedY = Math.min(position.y + 27, window.innerHeight - tooltipHeight - 20);

  const name = magic?.name || "无名称";
  const level = `等级： ${magicInfo.level}`;
  const intro = magic?.intro || "无简介";

  return (
    <div
      style={{
        position: "fixed",
        left: adjustedX,
        top: adjustedY,
        width: tooltipWidth,
        height: tooltipHeight,
        zIndex: 10000,
        pointerEvents: "none",
      }}
    >
      {bgImage.dataUrl ? (
        <img
          src={bgImage.dataUrl}
          alt=""
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            imageRendering: "pixelated",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: tooltipWidth,
            height: tooltipHeight,
            background: "linear-gradient(to bottom, #4a3a2a 0%, #2a1a0a 100%)",
            border: "2px solid #8B7355",
            borderRadius: 4,
          }}
        />
      )}

      {/* Magic Image */}
      <div
        style={{
          position: "absolute",
          left: cfg.itemImage.left,
          top: cfg.itemImage.top,
          width: cfg.itemImage.width,
          height: cfg.itemImage.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {magicImage.dataUrl ? (
          <img
            src={magicImage.dataUrl}
            alt={name}
            style={{
              maxWidth: cfg.itemImage.width,
              maxHeight: cfg.itemImage.height,
              imageRendering: "pixelated",
            }}
          />
        ) : (
          <span
            style={{
              fontSize: 16,
              fontWeight: "bold",
              color: "rgba(255,255,255,0.85)",
              textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              textAlign: "center",
              letterSpacing: 1,
            }}
          >
            {name.slice(0, 2)}
          </span>
        )}
      </div>

      {/* Magic Name */}
      <div
        style={{
          position: "absolute",
          left: cfg.name.left,
          top: cfg.name.top,
          width: cfg.name.width,
          height: cfg.name.height,
          color: cfg.name.color,
          fontSize: 12,
          fontFamily: "SimSun, serif",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {name}
      </div>

      {/* Level */}
      <div
        style={{
          position: "absolute",
          left: cfg.priceOrLevel.left,
          top: cfg.priceOrLevel.top,
          width: cfg.priceOrLevel.width,
          height: cfg.priceOrLevel.height,
          color: cfg.priceOrLevel.color,
          fontSize: 12,
          fontFamily: "SimSun, serif",
          whiteSpace: "nowrap",
        }}
      >
        {level}
      </div>

      {/* Magic Intro */}
      <div
        style={{
          position: "absolute",
          left: cfg.magicIntro.left,
          top: cfg.magicIntro.top,
          width: cfg.magicIntro.width,
          height: cfg.magicIntro.height,
          color: cfg.magicIntro.color,
          fontSize: 12,
          fontFamily: "SimSun, serif",
          lineHeight: 1.3,
          overflow: "hidden",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {intro}
      </div>
    </div>
  );
};

// ============= Type2 Magic Tooltip (text-based, semi-transparent bg) =============

const MagicTooltipType2: React.FC<MagicTooltipProps> = ({ magicInfo, position, isVisible }) => {
  const cfg = useToolTipType2Config();
  const magic = magicInfo?.magic;
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Measure actual tooltip height and adjust position to stay within viewport
  // biome-ignore lint/correctness/useExhaustiveDependencies: isVisible is a trigger dep (re-measure when tooltip appears)
  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let x = position.x + 10;
    let y = position.y + 27;
    if (x + rect.width > window.innerWidth - 10) {
      x = window.innerWidth - rect.width - 10;
    }
    x = Math.max(10, x);
    if (y + rect.height > window.innerHeight - 10) {
      y = position.y - rect.height - 10;
    }
    y = Math.max(10, y);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, [position, isVisible]);

  if (!isVisible || !magicInfo) return null;

  const hPad = Math.max(cfg.textHorizontalPadding, 12);
  const vPad = Math.max(cfg.textVerticalPadding, 10);
  const lineHeight = 20;
  const introLineH = 17;

  const name = magic?.name || "无名称";
  const levelText = `等级： ${magicInfo.level}`;
  const intro = magic?.intro || "";

  const tooltipWidth = cfg.width;

  return (
    <div
      ref={tooltipRef}
      style={{
        position: "fixed",
        left: position.x + 10,
        top: position.y + 27,
        width: tooltipWidth,
        zIndex: 10000,
        pointerEvents: "none",
        backgroundColor: colorToCSS(cfg.backgroundColor),
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 6,
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        padding: `${vPad}px ${hPad}px`,
        boxSizing: "border-box",
        fontFamily: "SimSun, serif",
        fontSize: 13,
      }}
    >
      {/* Magic Name */}
      <div
        style={{
          color: solidColor(cfg.magicNameColor),
          lineHeight: `${lineHeight}px`,
          fontWeight: 600,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {name}
      </div>

      {/* Divider */}
      <div style={{ margin: `${Math.round(vPad * 0.6)}px 0`, height: 1, background: "rgba(255,255,255,0.12)" }} />

      {/* Level */}
      <div
        style={{
          color: solidColor(cfg.magicLevelColor),
          lineHeight: `${lineHeight}px`,
          whiteSpace: "nowrap",
        }}
      >
        {levelText}
      </div>

      {/* Intro */}
      {intro && (
        <div
          style={{
            marginTop: Math.round(vPad * 0.5),
            color: solidColor(cfg.magicIntroColor),
            fontSize: 11,
            lineHeight: `${introLineH}px`,
            opacity: 0.85,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {intro}
        </div>
      )}
    </div>
  );
};

// ============= Main MagicTooltip (routes to Type1 or Type2) =============

export const MagicTooltip: React.FC<MagicTooltipProps> = (props) => {
  const { useType } = useToolTipUseTypeConfig();

  if (useType === 2) {
    return <MagicTooltipType2 {...props} />;
  }
  return <MagicTooltipType1 {...props} />;
};

// ============= Magic Tooltip Manager State =============

export interface MagicTooltipState {
  magicInfo: MagicItemInfo | null;
  position: { x: number; y: number };
  isVisible: boolean;
}

export const defaultMagicTooltipState: MagicTooltipState = {
  magicInfo: null,
  position: { x: 0, y: 0 },
  isVisible: false,
};

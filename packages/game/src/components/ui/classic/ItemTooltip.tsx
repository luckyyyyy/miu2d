/**
 * ItemTooltip Component
 * Supports two tooltip types based on [ToolTip_Use_Type].UseType from UI_Settings.ini:
 * - Type1: Image-based (tipbox.asf background) - JxqyHD Engine/Gui/ToolTipGuiType1.cs
 * - Type2: Text-based (semi-transparent dark bg, colored text rows)
 */

import { colorToCSS, type UiColorRGBA } from "@miu2d/engine/gui/ui-settings";

/** 强制 alpha=255，让文字完全不透明 */
function solidColor(c: UiColorRGBA): string {
  return `rgb(${c.r},${c.g},${c.b})`;
}
import type { UIGoodData } from "@miu2d/engine/gui/ui-types";
import type React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useToolTipType1Config, useToolTipType2Config, useToolTipUseTypeConfig } from "./useUISettings";
import { useAsfImage } from "./hooks";

interface ItemTooltipProps {
  good: UIGoodData | null;
  isRecycle?: boolean;
  shopPrice?: number;
  position: { x: number; y: number };
  isVisible: boolean;
}

// ============= Type1 Item Tooltip (image-based, tipbox.asf) =============

const ItemTooltipType1: React.FC<ItemTooltipProps> = ({
  good,
  isRecycle = false,
  shopPrice,
  position,
  isVisible,
}) => {
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

  const itemImage = useAsfImage(good?.imagePath ?? null, 0);

  const effectText = useMemo(() => {
    if (!good) return "";
    return good.getEffectString();
  }, [good]);

  const priceText = useMemo(() => {
    if (!good) return "价格： 0";
    const price = isRecycle ? good.sellPrice : shopPrice != null ? shopPrice : good.cost;
    return (isRecycle ? "回收价格： " : "价格： ") + price;
  }, [good, isRecycle, shopPrice]);

  if (!isVisible || !good) return null;

  const tooltipWidth = bgSize.width;
  const tooltipHeight = bgSize.height;
  const adjustedX = Math.min(position.x + 10, window.innerWidth - tooltipWidth - 20);
  const adjustedY = Math.min(position.y + 27, window.innerHeight - tooltipHeight - 20);

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

      {/* Item Image */}
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
        {itemImage.dataUrl && (
          <img
            src={itemImage.dataUrl}
            alt={good.name}
            style={{
              maxWidth: cfg.itemImage.width,
              maxHeight: cfg.itemImage.height,
              imageRendering: "pixelated",
            }}
          />
        )}
      </div>

      {/* Item Name */}
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
        {good.name || "无名称"}
      </div>

      {/* Price */}
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
        {priceText}
      </div>

      {/* Effect Text */}
      {effectText && (
        <div
          style={{
            position: "absolute",
            left: cfg.effect.left,
            top: cfg.effect.top,
            width: cfg.effect.width,
            height: cfg.effect.height,
            color: cfg.effect.color,
            fontSize: 12,
            fontFamily: "SimSun, serif",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {effectText}
        </div>
      )}

      {/* Intro/Description */}
      <div
        style={{
          position: "absolute",
          left: cfg.goodIntro.left,
          top: cfg.goodIntro.top,
          width: cfg.goodIntro.width,
          height: cfg.goodIntro.height,
          color: cfg.goodIntro.color,
          fontSize: 11,
          fontFamily: "SimSun, serif",
          lineHeight: 1.3,
          overflow: "hidden",
        }}
      >
        {good.intro || "无简介"}
      </div>
    </div>
  );
};

// ============= Type2 Item Tooltip (text-based, semi-transparent bg) =============

const ItemTooltipType2: React.FC<ItemTooltipProps> = ({
  good,
  isRecycle = false,
  shopPrice,
  position,
  isVisible,
}) => {
  const cfg = useToolTipType2Config();
  const tooltipRef = useRef<HTMLDivElement>(null);

  const effectText = useMemo(() => {
    if (!good) return "";
    return good.getEffectString();
  }, [good]);

  const priceText = useMemo(() => {
    if (!good) return "价格： 0";
    const price = isRecycle ? good.sellPrice : shopPrice != null ? shopPrice : good.cost;
    return (isRecycle ? "回收价格： " : "价格： ") + price;
  }, [good, isRecycle, shopPrice]);

  // Measure actual tooltip height and adjust position to stay within viewport
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

  if (!isVisible || !good) return null;

  const hPad = Math.max(cfg.textHorizontalPadding, 12);
  const vPad = Math.max(cfg.textVerticalPadding, 10);
  const lineH = 20;

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
      {/* Item Name */}
      <div
        style={{
          color: solidColor(cfg.goodNameColor),
          lineHeight: `${lineH}px`,
          fontWeight: 600,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {good.name || "无名称"}
      </div>

      {/* Divider */}
      <div style={{ margin: `${Math.round(vPad * 0.6)}px 0`, height: 1, background: "rgba(255,255,255,0.12)" }} />

      {/* Price */}
      <div
        style={{
          color: solidColor(cfg.goodPriceColor),
          lineHeight: `${lineH}px`,
          whiteSpace: "nowrap",
        }}
      >
        {priceText}
      </div>

      {/* Effect / property */}
      {effectText && (
        <div
          style={{
            marginTop: Math.round(vPad * 0.5),
            color: solidColor(cfg.goodPropertyColor),
            lineHeight: `${lineH}px`,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {effectText}
        </div>
      )}

      {/* Intro */}
      {good.intro && (
        <div
          style={{
            marginTop: Math.round(vPad * 0.5),
            color: solidColor(cfg.goodIntroColor),
            fontSize: 11,
            lineHeight: "17px",
            opacity: 0.85,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {good.intro}
        </div>
      )}
    </div>
  );
};

// ============= Main ItemTooltip (routes to Type1 or Type2) =============

export const ItemTooltip: React.FC<ItemTooltipProps> = (props) => {
  const { useType } = useToolTipUseTypeConfig();

  if (useType === 2) {
    return <ItemTooltipType2 {...props} />;
  }
  return <ItemTooltipType1 {...props} />;
};

// ============= Tooltip Manager State =============

export interface TooltipState {
  good: UIGoodData | null;
  isRecycle: boolean;
  position: { x: number; y: number };
  isVisible: boolean;
}

export const defaultTooltipState: TooltipState = {
  good: null,
  isRecycle: false,
  position: { x: 0, y: 0 },
  isVisible: false,
};

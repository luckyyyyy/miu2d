/**
 * ItemTooltip Component
 * Supports two tooltip types based on [ToolTip_Use_Type].UseType from UI_Settings.ini:
 * - Type1: Image-based (tipbox.asf background) - JxqyHD Engine/Gui/ToolTipGuiType1.cs
 * - Type2: Text-based (semi-transparent dark bg, colored text rows)
 */

import { colorToCSS } from "@miu2d/engine/gui/ui-settings";
import type { Good } from "@miu2d/engine/player/goods";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useToolTipType2Config, useToolTipUseTypeConfig } from "./useUISettings";
import { useAsfImage } from "./hooks";

interface ItemTooltipProps {
  good: Good | null;
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
  const bgImage = useAsfImage("asf/ui/common/tipbox.asf", 0);
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

      {/* Item Image - config: Left=132, Top=47, Width=60, Height=75 */}
      <div
        style={{
          position: "absolute",
          left: 132,
          top: 47,
          width: 60,
          height: 75,
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
              maxWidth: 60,
              maxHeight: 75,
              imageRendering: "pixelated",
            }}
          />
        )}
      </div>

      {/* Item Name - config: Left=67, Top=191, Color=102,73,212,204 (purple) */}
      <div
        style={{
          position: "absolute",
          left: 67,
          top: 191,
          width: 90,
          height: 20,
          color: "rgb(102, 73, 212)",
          fontSize: 12,
          fontFamily: "SimSun, serif",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {good.name || "无名称"}
      </div>

      {/* Price - config: Left=160, Top=191, Color=91,31,27,204 (dark red) */}
      <div
        style={{
          position: "absolute",
          left: 160,
          top: 191,
          width: 88,
          height: 20,
          color: "rgb(91, 31, 27)",
          fontSize: 12,
          fontFamily: "SimSun, serif",
          whiteSpace: "nowrap",
        }}
      >
        {priceText}
      </div>

      {/* Effect Text - config: Left=67, Top=215, Color=0,0,255,204 (blue) */}
      <div
        style={{
          position: "absolute",
          left: 67,
          top: 215,
          width: 188,
          height: 20,
          color: "rgb(0, 0, 255)",
          fontSize: 12,
          fontFamily: "SimSun, serif",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {effectText}
      </div>

      {/* Intro/Description - positioned below effect */}
      <div
        style={{
          position: "absolute",
          left: 67,
          top: 238,
          width: 188,
          height: 28,
          color: "rgb(91, 31, 27)",
          fontSize: 11,
          fontFamily: "SimSun, serif",
          lineHeight: 1.3,
          overflow: "hidden",
          textOverflow: "ellipsis",
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

  const hPad = cfg.textHorizontalPadding;
  const vPad = cfg.textVerticalPadding;
  const lineH = 18;

  const tooltipWidth = cfg.width;
  const adjustedX = Math.min(position.x + 10, window.innerWidth - tooltipWidth - 20);
  const adjustedY = Math.min(position.y + 27, window.innerHeight - 20);

  return (
    <div
      style={{
        position: "fixed",
        left: adjustedX,
        top: adjustedY,
        width: tooltipWidth,
        zIndex: 10000,
        pointerEvents: "none",
        backgroundColor: colorToCSS(cfg.backgroundColor),
        padding: `${vPad}px ${hPad}px`,
        boxSizing: "border-box",
        fontFamily: "SimSun, serif",
        fontSize: 12,
      }}
    >
      {/* Item Name */}
      <div
        style={{
          color: colorToCSS(cfg.goodNameColor),
          lineHeight: `${lineH}px`,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {good.name || "无名称"}
      </div>

      {/* Price */}
      <div
        style={{
          marginTop: vPad,
          color: colorToCSS(cfg.goodPriceColor),
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
            marginTop: vPad,
            color: colorToCSS(cfg.goodPropertyColor),
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
            marginTop: vPad,
            color: colorToCSS(cfg.goodIntroColor),
            fontSize: 11,
            lineHeight: "16px",
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
  good: Good | null;
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

/**
 * React Hooks for UI Settings
 * 从 UiTheme（紧凑格式）→ resolveTheme() → ResolvedUiConfigs 提供各面板配置
 */

import {
  type BottomGuiConfig,
  type BottomStateGuiConfig,
  type BuySellGuiConfig,
  type DialogGuiConfig,
  type EquipGuiConfig,
  getResolvedConfigs,
  getUiTheme,
  type GoodsGuiConfig,
  type LittleMapGuiConfig,
  type MagicsGuiConfig,
  type MemoGuiConfig,
  type MessageGuiConfig,
  type NpcEquipGuiConfig,
  type NpcInfoShowConfig,
  type ResolvedUiConfigs,
  type SaveLoadGuiConfig,
  setUiTheme,
  type StateGuiConfig,
  type SystemGuiConfig,
  type TitleGuiConfig,
  type ToolTipType1Config,
  type ToolTipType2Config,
  type ToolTipUseTypeConfig,
  type TopGuiConfig,
  type XiuLianGuiConfig,
} from "@miu2d/engine/gui/ui-settings";
import { useEffect, useRef, useState } from "react";

// Cached resolved configs
let cachedConfigs: ResolvedUiConfigs | null = null;
let isLoaded = false;

// Subscribers notified when UI configs are reloaded
const uiConfigListeners = new Set<() => void>();

/**
 * 重置 UI 配置缓存（切换游戏时调用）
 */
export function resetCachedUIConfigs(): void {
  cachedConfigs = null;
  isLoaded = false;
}

/**
 * 重载 UI 布局配置并通知所有 hook 消费者重新渲染
 */
export function reloadUIConfigs(): void {
  // 重新设置当前 theme，使引擎层的 cachedResolved 失效，强制 resolveTheme() 重跑
  const currentTheme = getUiTheme();
  if (currentTheme) {
    setUiTheme(currentTheme);
  }
  cachedConfigs = null;
  isLoaded = false;
  ensureLoaded();
  for (const notify of uiConfigListeners) notify();
}

function ensureLoaded(): void {
  if (isLoaded) return;
  cachedConfigs = getResolvedConfigs();
  isLoaded = true;
}

// ---------- 通用 hook 工厂 ----------

function useConfig<T>(accessor: (c: ResolvedUiConfigs) => T): T | null {
  const accessorRef = useRef(accessor);
  accessorRef.current = accessor;

  const [config, setConfig] = useState<T | null>(() => {
    ensureLoaded();
    return cachedConfigs ? accessor(cachedConfigs) : null;
  });

  useEffect(() => {
    ensureLoaded();
    if (cachedConfigs) setConfig(accessorRef.current(cachedConfigs));

    const listener = () => {
      if (cachedConfigs) setConfig(accessorRef.current(cachedConfigs));
    };
    uiConfigListeners.add(listener);
    return () => {
      uiConfigListeners.delete(listener);
    };
  }, []);

  return config;
}

function useConfigWithDefault<T>(accessor: (c: ResolvedUiConfigs) => T, defaultValue: T): T {
  const accessorRef = useRef(accessor);
  accessorRef.current = accessor;

  const [config, setConfig] = useState<T>(() => {
    ensureLoaded();
    return cachedConfigs ? accessor(cachedConfigs) : defaultValue;
  });

  useEffect(() => {
    ensureLoaded();
    if (cachedConfigs) setConfig(accessorRef.current(cachedConfigs));

    const listener = () => {
      if (cachedConfigs) setConfig(accessorRef.current(cachedConfigs));
    };
    uiConfigListeners.add(listener);
    return () => {
      uiConfigListeners.delete(listener);
    };
  }, []);

  return config;
}

// ---------- 各面板 hooks ----------

export function useSystemGuiConfig(): SystemGuiConfig | null {
  return useConfig((c) => c.system);
}

export function useStateGuiConfig(): StateGuiConfig | null {
  return useConfig((c) => c.state);
}

export function useEquipGuiConfig(): EquipGuiConfig | null {
  return useConfig((c) => c.equip);
}

export function useNpcEquipGuiConfig(): NpcEquipGuiConfig | null {
  return useConfig((c) => c.npcEquip);
}

export function useXiuLianGuiConfig(): XiuLianGuiConfig | null {
  return useConfig((c) => c.xiuLian);
}

export function useGoodsGuiConfig(): GoodsGuiConfig | null {
  return useConfig((c) => c.goods);
}

export function useMagicsGuiConfig(): MagicsGuiConfig | null {
  return useConfig((c) => c.magics);
}

export function useMemoGuiConfig(): MemoGuiConfig | null {
  return useConfig((c) => c.memo);
}

export function useDialogGuiConfig(): DialogGuiConfig | null {
  return useConfig((c) => c.dialog);
}

export function useMessageGuiConfig(): MessageGuiConfig | null {
  return useConfig((c) => c.message);
}

export function useNpcInfoShowConfig(): NpcInfoShowConfig | null {
  return useConfig((c) => c.npcInfoShow);
}

export function useLittleMapGuiConfig(): LittleMapGuiConfig | null {
  return useConfig((c) => c.littleMap);
}

export function useAllUIConfigs(): ResolvedUiConfigs | null {
  const [configs, setConfigs] = useState<ResolvedUiConfigs | null>(() => {
    ensureLoaded();
    return cachedConfigs;
  });

  useEffect(() => {
    ensureLoaded();
    if (cachedConfigs) {
      setConfigs(cachedConfigs);
    }
  }, []);

  return configs;
}

export function useBuySellGuiConfig(): BuySellGuiConfig | null {
  return useConfig((c) => c.buySell);
}

export function useBottomGuiConfig(): BottomGuiConfig | null {
  return useConfig((c) => c.bottom);
}

export function useBottomStateGuiConfig(): BottomStateGuiConfig | null {
  return useConfig((c) => c.bottomState);
}

export function useTopGuiConfig(): TopGuiConfig | null {
  return useConfig((c) => c.top);
}

export function useToolTipUseTypeConfig(): ToolTipUseTypeConfig {
  return useConfigWithDefault((c) => c.toolTipUseType, { useType: 1 });
}

export function useToolTipType2Config(): ToolTipType2Config {
  const defaultType2: ToolTipType2Config = {
    width: 288,
    textHorizontalPadding: 6,
    textVerticalPadding: 4,
    backgroundColor: { r: 0, g: 0, b: 0, a: 160 },
    magicNameColor: { r: 225, g: 225, b: 110, a: 160 },
    magicLevelColor: { r: 255, g: 255, b: 255, a: 160 },
    magicIntroColor: { r: 255, g: 255, b: 255, a: 160 },
    goodNameColor: { r: 245, g: 233, b: 171, a: 160 },
    goodPriceColor: { r: 255, g: 255, b: 255, a: 160 },
    goodUserColor: { r: 255, g: 255, b: 255, a: 160 },
    goodPropertyColor: { r: 255, g: 255, b: 255, a: 160 },
    goodIntroColor: { r: 255, g: 255, b: 255, a: 160 },
  };
  return useConfigWithDefault((c) => c.toolTipType2, defaultType2);
}

export function useToolTipType1Config(): ToolTipType1Config {
  const defaultType1: ToolTipType1Config = {
    image: "asf/ui/common/tipbox.asf",
    itemImage: { left: 132, top: 47, width: 60, height: 75 },
    name: { left: 67, top: 191, width: 90, height: 20, charSpace: 0, lineSpace: 0, color: "rgb(102,73,212)" },
    priceOrLevel: { left: 160, top: 191, width: 88, height: 20, charSpace: 0, lineSpace: 0, color: "rgb(91,31,27)" },
    effect: { left: 67, top: 210, width: 196, height: 40, charSpace: 0, lineSpace: 0, color: "rgb(52,21,14)" },
    magicIntro: { left: 67, top: 255, width: 196, height: 80, charSpace: 0, lineSpace: 0, color: "rgb(52,21,14)" },
    goodIntro: { left: 67, top: 255, width: 196, height: 80, charSpace: 0, lineSpace: 0, color: "rgb(52,21,14)" },
  };
  return useConfigWithDefault((c) => c.toolTipType1, defaultType1);
}

export function useTitleGuiConfig(): TitleGuiConfig | null {
  return useConfig((c) => c.title);
}

export function useSaveLoadGuiConfig(): SaveLoadGuiConfig | null {
  return useConfig((c) => c.saveLoad);
}

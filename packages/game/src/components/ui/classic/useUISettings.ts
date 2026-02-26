/**
 * React Hook for loading UI Settings
 * Provides async loading of UI_Settings.ini with caching
 */

import {
  type BottomGuiConfig,
  type BottomStateGuiConfig,
  type BuySellGuiConfig,
  type DialogGuiConfig,
  type EquipGuiConfig,
  type GoodsGuiConfig,
  type LittleMapGuiConfig,
  loadUISettings,
  type MagicsGuiConfig,
  type MemoGuiConfig,
  type MessageGuiConfig,
  type NpcEquipGuiConfig,
  type NpcInfoShowConfig,
  parseBottomGuiConfig,
  parseBottomStateGuiConfig,
  parseBuySellGuiConfig,
  parseDialogGuiConfig,
  parseEquipGuiConfig,
  parseGoodsGuiConfig,
  parseLittleMapGuiConfig,
  parseMagicsGuiConfig,
  parseMemoGuiConfig,
  parseMessageGuiConfig,
  parseNpcEquipGuiConfig,
  parseNpcInfoShowConfig,
  parseStateGuiConfig,
  parseSystemGuiConfig,
  parseToolTipType2Config,
  parseToolTipUseTypeConfig,
  parseTopGuiConfig,
  parseXiuLianGuiConfig,
  type StateGuiConfig,
  type SystemGuiConfig,
  type ToolTipType2Config,
  type ToolTipUseTypeConfig,
  type TopGuiConfig,
  type XiuLianGuiConfig,
} from "@miu2d/engine/gui/ui-settings";
import { useEffect, useState } from "react";

// Cached parsed configs
let cachedConfigs: {
  system?: SystemGuiConfig;
  state?: StateGuiConfig;
  equip?: EquipGuiConfig;
  npcEquip?: NpcEquipGuiConfig;
  xiuLian?: XiuLianGuiConfig;
  goods?: GoodsGuiConfig;
  magics?: MagicsGuiConfig;
  memo?: MemoGuiConfig;
  dialog?: DialogGuiConfig;
  message?: MessageGuiConfig;
  npcInfoShow?: NpcInfoShowConfig;
  littleMap?: LittleMapGuiConfig;
  buySell?: BuySellGuiConfig;
  bottom?: BottomGuiConfig;
  bottomState?: BottomStateGuiConfig;
  top?: TopGuiConfig;
  toolTipUseType?: ToolTipUseTypeConfig;
  toolTipType2?: ToolTipType2Config;
} = {};

let isLoaded = false;
let loadPromise: Promise<void> | null = null;

/**
 * 重置 UI 配置缓存（切换游戏时调用）
 */
export function resetCachedUIConfigs(): void {
  cachedConfigs = {};
  isLoaded = false;
  loadPromise = null;
}

async function ensureLoaded(): Promise<void> {
  if (isLoaded) return;

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const settings = await loadUISettings();
    cachedConfigs = {
      system: parseSystemGuiConfig(settings),
      state: parseStateGuiConfig(settings),
      equip: parseEquipGuiConfig(settings),
      npcEquip: parseNpcEquipGuiConfig(settings),
      xiuLian: parseXiuLianGuiConfig(settings),
      goods: parseGoodsGuiConfig(settings),
      magics: parseMagicsGuiConfig(settings),
      memo: parseMemoGuiConfig(settings),
      dialog: parseDialogGuiConfig(settings),
      message: parseMessageGuiConfig(settings),
      npcInfoShow: parseNpcInfoShowConfig(settings),
      littleMap: parseLittleMapGuiConfig(settings),
      buySell: parseBuySellGuiConfig(settings),
      bottom: parseBottomGuiConfig(settings),
      bottomState: parseBottomStateGuiConfig(settings),
      top: parseTopGuiConfig(settings),
      toolTipUseType: parseToolTipUseTypeConfig(settings),
      toolTipType2: parseToolTipType2Config(settings),
    };
    isLoaded = true;
  })();

  return loadPromise;
}

/**
 * Hook to get System GUI config
 */
export function useSystemGuiConfig(): SystemGuiConfig | null {
  const [config, setConfig] = useState<SystemGuiConfig | null>(cachedConfigs.system || null);

  useEffect(() => {
    if (cachedConfigs.system) {
      setConfig(cachedConfigs.system);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.system || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get State GUI config
 */
export function useStateGuiConfig(): StateGuiConfig | null {
  const [config, setConfig] = useState<StateGuiConfig | null>(cachedConfigs.state || null);

  useEffect(() => {
    if (cachedConfigs.state) {
      setConfig(cachedConfigs.state);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.state || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get Equip GUI config
 */
export function useEquipGuiConfig(): EquipGuiConfig | null {
  const [config, setConfig] = useState<EquipGuiConfig | null>(cachedConfigs.equip || null);

  useEffect(() => {
    if (cachedConfigs.equip) {
      setConfig(cachedConfigs.equip);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.equip || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get NPC Equip GUI config
 * Used for displaying NPC equipment slots
 */
export function useNpcEquipGuiConfig(): NpcEquipGuiConfig | null {
  const [config, setConfig] = useState<NpcEquipGuiConfig | null>(cachedConfigs.npcEquip || null);

  useEffect(() => {
    if (cachedConfigs.npcEquip) {
      setConfig(cachedConfigs.npcEquip);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.npcEquip || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get XiuLian GUI config
 */
export function useXiuLianGuiConfig(): XiuLianGuiConfig | null {
  const [config, setConfig] = useState<XiuLianGuiConfig | null>(cachedConfigs.xiuLian || null);

  useEffect(() => {
    if (cachedConfigs.xiuLian) {
      setConfig(cachedConfigs.xiuLian);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.xiuLian || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get Good GUI config
 */
export function useGoodsGuiConfig(): GoodsGuiConfig | null {
  const [config, setConfig] = useState<GoodsGuiConfig | null>(cachedConfigs.goods || null);

  useEffect(() => {
    if (cachedConfigs.goods) {
      setConfig(cachedConfigs.goods);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.goods || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get Magics GUI config
 */
export function useMagicsGuiConfig(): MagicsGuiConfig | null {
  const [config, setConfig] = useState<MagicsGuiConfig | null>(cachedConfigs.magics || null);

  useEffect(() => {
    if (cachedConfigs.magics) {
      setConfig(cachedConfigs.magics);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.magics || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get Memo GUI config
 */
export function useMemoGuiConfig(): MemoGuiConfig | null {
  const [config, setConfig] = useState<MemoGuiConfig | null>(cachedConfigs.memo || null);

  useEffect(() => {
    if (cachedConfigs.memo) {
      setConfig(cachedConfigs.memo);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.memo || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get Dialog GUI config
 */
export function useDialogGuiConfig(): DialogGuiConfig | null {
  const [config, setConfig] = useState<DialogGuiConfig | null>(cachedConfigs.dialog || null);

  useEffect(() => {
    if (cachedConfigs.dialog) {
      setConfig(cachedConfigs.dialog);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.dialog || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get Message GUI config
 */
export function useMessageGuiConfig(): MessageGuiConfig | null {
  const [config, setConfig] = useState<MessageGuiConfig | null>(cachedConfigs.message || null);

  useEffect(() => {
    if (cachedConfigs.message) {
      setConfig(cachedConfigs.message);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.message || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get NPC Info Show config
 * Used for NPC life bar display at top of screen
 */
export function useNpcInfoShowConfig(): NpcInfoShowConfig | null {
  const [config, setConfig] = useState<NpcInfoShowConfig | null>(cachedConfigs.npcInfoShow || null);

  useEffect(() => {
    if (cachedConfigs.npcInfoShow) {
      setConfig(cachedConfigs.npcInfoShow);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.npcInfoShow || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get LittleMap (小地图) GUI config
 * Used for minimap display
 */
export function useLittleMapGuiConfig(): LittleMapGuiConfig | null {
  const [config, setConfig] = useState<LittleMapGuiConfig | null>(cachedConfigs.littleMap || null);

  useEffect(() => {
    if (cachedConfigs.littleMap) {
      setConfig(cachedConfigs.littleMap);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.littleMap || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get all UI configs at once
 */
export function useAllUIConfigs(): typeof cachedConfigs | null {
  const [configs, setConfigs] = useState<typeof cachedConfigs | null>(
    isLoaded ? cachedConfigs : null
  );

  useEffect(() => {
    if (isLoaded) {
      setConfigs(cachedConfigs);
      return;
    }
    ensureLoaded().then(() => {
      setConfigs({ ...cachedConfigs });
    });
  }, []);

  return configs;
}

/**
 * Hook to get BuySell (商店) GUI config
 * Used for shop/buy interface display
 */
export function useBuySellGuiConfig(): BuySellGuiConfig | null {
  const [config, setConfig] = useState<BuySellGuiConfig | null>(cachedConfigs.buySell || null);

  useEffect(() => {
    if (cachedConfigs.buySell) {
      setConfig(cachedConfigs.buySell);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.buySell || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get Bottom (底部快捷栏) GUI config
 */
export function useBottomGuiConfig(): BottomGuiConfig | null {
  const [config, setConfig] = useState<BottomGuiConfig | null>(cachedConfigs.bottom || null);

  useEffect(() => {
    if (cachedConfigs.bottom) {
      setConfig(cachedConfigs.bottom);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.bottom || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get BottomState (血蓝条) GUI config
 */
export function useBottomStateGuiConfig(): BottomStateGuiConfig | null {
  const [config, setConfig] = useState<BottomStateGuiConfig | null>(cachedConfigs.bottomState || null);

  useEffect(() => {
    if (cachedConfigs.bottomState) {
      setConfig(cachedConfigs.bottomState);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.bottomState || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get Top (功能按钮栏) GUI config
 */
export function useTopGuiConfig(): TopGuiConfig | null {
  const [config, setConfig] = useState<TopGuiConfig | null>(cachedConfigs.top || null);

  useEffect(() => {
    if (cachedConfigs.top) {
      setConfig(cachedConfigs.top);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.top || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get ToolTip use type (1=image-based/tipbox.asf, 2=text-based)
 */
export function useToolTipUseTypeConfig(): ToolTipUseTypeConfig {
  const [config, setConfig] = useState<ToolTipUseTypeConfig>(cachedConfigs.toolTipUseType ?? { useType: 1 });

  useEffect(() => {
    if (cachedConfigs.toolTipUseType) {
      setConfig(cachedConfigs.toolTipUseType);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.toolTipUseType ?? { useType: 1 });
    });
  }, []);

  return config;
}

/**
 * Hook to get ToolTip Type2 config (text-based tooltip colors and dimensions)
 */
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
  const [config, setConfig] = useState<ToolTipType2Config>(cachedConfigs.toolTipType2 ?? defaultType2);

  useEffect(() => {
    if (cachedConfigs.toolTipType2) {
      setConfig(cachedConfigs.toolTipType2);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.toolTipType2 ?? defaultType2);
    });
  }, []);

  return config;
}

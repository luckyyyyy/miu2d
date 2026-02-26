/**
 * UI Settings Loader - loads and parses UI_Settings.ini
 *
 *
 * INI files in resources/ are now UTF-8 encoded.
 */

import { logger } from "../core/logger";
import { parseIni } from "../utils";

// ===== Types from ui-config (merged) =====

export interface UiColorRGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * 解析 INI 颜色字符串 "r,g,b,a" 或 "r,g,b" 为 UiColorRGBA (0-255 整数)
 */
export function parseIniColor(colorStr: string): UiColorRGBA {
  const parts = colorStr.split(",").map((s) => parseInt(s.trim(), 10));
  return {
    r: parts[0] || 0,
    g: parts[1] || 0,
    b: parts[2] || 0,
    a: parts[3] !== undefined ? parts[3] : 255,
  };
}

/**
 * 颜色转CSS
 */
export function colorToCSS(color: UiColorRGBA): string {
  return `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;
}

// Cache for loaded settings
let cachedSettings: Record<string, Record<string, string>> | null = null;
let loadingPromise: Promise<Record<string, Record<string, string>>> | null = null;

/** 通过 GameConfig API 传入的 UI Settings INI 内容 */
let customUiSettingsIniContent = "";

/**
 * 设置 UI Settings INI 内容（从 GameConfig.uiSettingsIni 获取）
 * 调用后会清除已缓存的设置，下次 loadUISettings 将直接使用该内容
 */
export function setUiSettingsIniContent(content: string): void {
  if (content !== customUiSettingsIniContent) {
    customUiSettingsIniContent = content;
    resetUISettingsCache();
  }
}

/**
 * 重置 UI Settings 缓存（切换游戏时调用）
 */
export function resetUISettingsCache(): void {
  cachedSettings = null;
  loadingPromise = null;
}

/**
 * Load and parse UI Settings from GameConfig.uiSettingsIni content.
 * Must be set via setUiSettingsIniContent() before calling.
 */
export async function loadUISettings(): Promise<Record<string, Record<string, string>>> {
  if (cachedSettings) {
    return cachedSettings;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      if (!customUiSettingsIniContent) {
        logger.error("[UISettings] uiSettingsIni not configured in GameConfig. Please set it in the dashboard.");
        cachedSettings = {};
        return cachedSettings;
      }

      cachedSettings = parseIni(customUiSettingsIniContent);
      logger.debug("[UISettings] Parsed INI content from GameConfig");
      return cachedSettings;
    } catch (error) {
      logger.error("Error parsing UI_Settings.ini content:", error);
      return {};
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/**
 * Get a section from UI settings
 */
export function getSection(
  settings: Record<string, Record<string, string>>,
  sectionName: string
): Record<string, string> {
  return settings[sectionName] || {};
}

/**
 * Parse a color string "r,g,b,a" to CSS rgba
 */
export function parseColor(colorStr: string, defaultColor = "rgba(0,0,0,1)"): string {
  if (!colorStr) return defaultColor;
  const parts = colorStr.split(",");
  if (parts.length < 3) return defaultColor;
  return colorToCSS(parseIniColor(colorStr));
}

/**
 * Parse an integer with fallback
 */
export function parseInt2(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Normalize image path (convert backslashes to forward slashes)
 */
export function normalizeImagePath(path: string): string {
  if (!path) return "";
  // Remove leading slash or backslash
  let normalized = path.replace(/\\/g, "/");
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }
  return normalized;
}

// ============================================
// Type definitions for UI configurations
// ============================================

export interface ButtonConfig {
  left: number;
  top: number;
  width: number;
  height: number;
  image: string;
  sound?: string;
}

export interface TextConfig {
  left: number;
  top: number;
  width: number;
  height: number;
  charSpace: number;
  lineSpace: number;
  color: string;
}

export interface PanelConfig {
  image: string;
  leftAdjust: number;
  topAdjust: number;
  /** Optional explicit panel dimensions from ini (override image size) */
  width?: number;
  height?: number;
  /**
   * Panel anchor - controls which screen edge the panel is positioned relative to.
   * "Top" (default): top=topAdjust; "Bottom": bottom edge anchored
   */
  anchor?: "Top" | "Bottom";
}

// ============================================
// Parsed UI configurations
// ============================================

export interface SystemGuiConfig {
  panel: PanelConfig;
  saveLoadBtn: ButtonConfig;
  optionBtn: ButtonConfig;
  exitBtn: ButtonConfig;
  returnBtn: ButtonConfig;
}

export interface StateGuiConfig {
  panel: PanelConfig;
  level: TextConfig;
  exp: TextConfig;
  levelUp: TextConfig;
  life: TextConfig;
  thew: TextConfig;
  mana: TextConfig;
  attack: TextConfig;
  defend: TextConfig;
  evade: TextConfig;
}

export interface EquipGuiConfig {
  panel: PanelConfig;
  head: { left: number; top: number; width: number; height: number };
  neck: { left: number; top: number; width: number; height: number };
  body: { left: number; top: number; width: number; height: number };
  back: { left: number; top: number; width: number; height: number };
  hand: { left: number; top: number; width: number; height: number };
  wrist: { left: number; top: number; width: number; height: number };
  foot: { left: number; top: number; width: number; height: number };
}

// NPC 装备界面配置 - 与 EquipGuiConfig 结构相同但读取不同配置节
export interface NpcEquipGuiConfig {
  panel: PanelConfig;
  head: { left: number; top: number; width: number; height: number };
  neck: { left: number; top: number; width: number; height: number };
  body: { left: number; top: number; width: number; height: number };
  back: { left: number; top: number; width: number; height: number };
  hand: { left: number; top: number; width: number; height: number };
  wrist: { left: number; top: number; width: number; height: number };
  foot: { left: number; top: number; width: number; height: number };
}

export interface XiuLianGuiConfig {
  panel: PanelConfig;
  magicImage: { left: number; top: number; width: number; height: number };
  levelText: TextConfig;
  expText: TextConfig;
  nameText: TextConfig;
  introText: TextConfig;
}

export interface GoodsGuiConfig {
  panel: PanelConfig;
  scrollBar: {
    left: number;
    top: number;
    width: number;
    height: number;
    button: string;
  };
  items: { left: number; top: number; width: number; height: number }[];
  money: TextConfig;
}

export interface MagicsGuiConfig {
  panel: PanelConfig;
  scrollBar: {
    left: number;
    top: number;
    width: number;
    height: number;
    button: string;
  };
  items: { left: number; top: number; width: number; height: number }[];
}

export interface MemoGuiConfig {
  panel: PanelConfig;
  text: TextConfig;
  slider: {
    left: number;
    top: number;
    width: number;
    height: number;
    imageBtn: string;
  };
  // NOTE: scrollBar 用于滚动条显示，参考MemoGui.cs
  scrollBar: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface DialogGuiConfig {
  panel: PanelConfig;
  text: TextConfig;
  selectA: TextConfig;
  selectB: TextConfig;
  portrait: { left: number; top: number; width: number; height: number };
}

// ============= SaveLoad GUI Config =============
//  - shows save/load interface

export interface SaveLoadGuiConfig {
  panel: PanelConfig;
  snapshot: { left: number; top: number; width: number; height: number };
  textList: {
    text: string[];
    left: number;
    top: number;
    width: number;
    height: number;
    charSpace: number;
    lineSpace: number;
    itemHeight: number;
    color: string;
    selectedColor: string;
    sound: string;
  };
  loadBtn: ButtonConfig;
  saveBtn: ButtonConfig;
  exitBtn: ButtonConfig;
  saveTimeText: TextConfig;
  messageLine: TextConfig & { align: number };
}

// ============================================
// Internal shape parsers — DRY helpers for
// recurring INI → config patterns
// ============================================

type IniSection = Record<string, string>;

/** Parse a panel config from an INI section */
function panelFrom(
  s: IniSection,
  defaults: { image: string; leftAdjust?: number; topAdjust?: number }
): PanelConfig {
  const rawWidth = parseInt2(s.Width, 0);
  const rawHeight = parseInt2(s.Height, 0);
  const rawAnchor = s.Anchor?.trim();
  return {
    image: normalizeImagePath(s.Image || defaults.image),
    leftAdjust: parseInt2(s.LeftAdjust, defaults.leftAdjust ?? 0),
    topAdjust: parseInt2(s.TopAdjust, defaults.topAdjust ?? 0),
    ...(rawWidth > 0 ? { width: rawWidth } : {}),
    ...(rawHeight > 0 ? { height: rawHeight } : {}),
    ...(rawAnchor === "Bottom" ? { anchor: "Bottom" as const } : {}),
  };
}

/** Parse a button config ({left,top,width,height,image,sound?}) */
function buttonFrom(
  s: IniSection,
  d: { left: number; top: number; width: number; height: number; image: string; sound?: string }
): ButtonConfig {
  return {
    left: parseInt2(s.Left, d.left),
    top: parseInt2(s.Top, d.top),
    width: parseInt2(s.Width, d.width),
    height: parseInt2(s.Height, d.height),
    image: normalizeImagePath(s.Image || d.image),
    sound: s.Sound || d.sound,
  };
}

/** Parse a text config ({left,top,width,height,charSpace,lineSpace,color}) */
function textFrom(
  s: IniSection,
  d: {
    left: number;
    top: number;
    width: number;
    height: number;
    charSpace?: number;
    lineSpace?: number;
    color: string;
  }
): TextConfig {
  return {
    left: parseInt2(s.Left, d.left),
    top: parseInt2(s.Top, d.top),
    width: parseInt2(s.Width, d.width),
    height: parseInt2(s.Height, d.height),
    charSpace: parseInt2(s.CharSpace, d.charSpace ?? 0),
    lineSpace: parseInt2(s.LineSpace, d.lineSpace ?? 0),
    color: parseColor(s.Color, d.color),
  };
}

/** Parse a rect ({left,top,width,height}) */
function rectFrom(
  s: IniSection,
  d: { left: number; top: number; width: number; height: number }
): { left: number; top: number; width: number; height: number } {
  return {
    left: parseInt2(s.Left, d.left),
    top: parseInt2(s.Top, d.top),
    width: parseInt2(s.Width, d.width),
    height: parseInt2(s.Height, d.height),
  };
}

/** Parse a scroll bar from a section using ScrollBarXxx keys */
function scrollBarFrom(
  s: IniSection,
  d: { left: number; top: number; width: number; height: number; button: string }
): { left: number; top: number; width: number; height: number; button: string } {
  return {
    left: parseInt2(s.ScrollBarLeft, d.left),
    top: parseInt2(s.ScrollBarRight, d.top), // Note: config uses "ScrollBarRight" for top position
    width: parseInt2(s.ScrollBarWidth, d.width),
    height: parseInt2(s.ScrollBarHeight, d.height),
    button: normalizeImagePath(s.ScrollBarButton || d.button),
  };
}

/** Parse 7 equipment slots (head/neck/body/back/hand/wrist/foot) */
function equipSlotsFrom(
  settings: Record<string, IniSection>,
  prefix: string
): {
  head: { left: number; top: number; width: number; height: number };
  neck: { left: number; top: number; width: number; height: number };
  body: { left: number; top: number; width: number; height: number };
  back: { left: number; top: number; width: number; height: number };
  hand: { left: number; top: number; width: number; height: number };
  wrist: { left: number; top: number; width: number; height: number };
  foot: { left: number; top: number; width: number; height: number };
} {
  const slot = (name: string, l: number, t: number) =>
    rectFrom(getSection(settings, `${prefix}_${name}`), { left: l, top: t, width: 60, height: 75 });
  return {
    head: slot("Head", 47, 66),
    neck: slot("Neck", 193, 66),
    body: slot("Body", 121, 168),
    back: slot("Back", 193, 267),
    hand: slot("Hand", 193, 168),
    wrist: slot("Wrist", 47, 168),
    foot: slot("Foot", 47, 267),
  };
}

/** Parse a LittleMap direction button ({left,top,image,sound}) */
function mapBtnFrom(
  s: IniSection,
  d: { left: number; top: number; image: string; sound: string }
): LittleMapButtonConfig {
  return {
    left: parseInt2(s.Left, d.left),
    top: parseInt2(s.Top, d.top),
    image: normalizeImagePath(s.Image || d.image),
    sound: s.Sound || d.sound,
  };
}

/** Parse a LittleMap text ({left,top,width,height,color,align}) */
function mapTextFrom(
  s: IniSection,
  d: { left: number; top: number; width: number; height: number; color: string; align: number }
): LittleMapTextConfig {
  return {
    left: parseInt2(s.Left, d.left),
    top: parseInt2(s.Top, d.top),
    width: parseInt2(s.Width, d.width),
    height: parseInt2(s.Height, d.height),
    color: parseColor(s.Color, d.color),
    align: parseInt2(s.Align, d.align),
  };
}

// ============================================
// Config parsers
// ============================================

export function parseSystemGuiConfig(settings: Record<string, IniSection>): SystemGuiConfig {
  return {
    panel: panelFrom(getSection(settings, "System"), {
      image: "asf/ui/common/panel.asf",
      topAdjust: 26,
    }),
    saveLoadBtn: buttonFrom(getSection(settings, "System_SaveLoad_Btn"), {
      left: 58,
      top: 86,
      width: 69,
      height: 64,
      image: "asf/ui/system/saveload.asf",
    }),
    optionBtn: buttonFrom(getSection(settings, "System_Option_Btn"), {
      left: 58,
      top: 150,
      width: 69,
      height: 54,
      image: "asf/ui/system/option.asf",
    }),
    exitBtn: buttonFrom(getSection(settings, "System_Exit_Btn"), {
      left: 58,
      top: 213,
      width: 69,
      height: 54,
      image: "asf/ui/system/quit.asf",
    }),
    returnBtn: buttonFrom(getSection(settings, "System_Return_Btn"), {
      left: 58,
      top: 276,
      width: 69,
      height: 54,
      image: "asf/ui/system/return.asf",
    }),
  };
}

export function parseStateGuiConfig(settings: Record<string, IniSection>): StateGuiConfig {
  const d = { left: 144, width: 100, height: 12, color: "rgba(0,0,0,0.7)" } as const;
  return {
    panel: panelFrom(getSection(settings, "State"), { image: "asf/ui/common/panel5.asf" }),
    level: textFrom(getSection(settings, "State_Level"), { ...d, top: 219 }),
    exp: textFrom(getSection(settings, "State_Exp"), { ...d, top: 234 }),
    levelUp: textFrom(getSection(settings, "State_LevelUp"), { ...d, top: 249 }),
    life: textFrom(getSection(settings, "State_Life"), { ...d, top: 264 }),
    thew: textFrom(getSection(settings, "State_Thew"), { ...d, top: 279 }),
    mana: textFrom(getSection(settings, "State_Mana"), { ...d, top: 294 }),
    attack: textFrom(getSection(settings, "State_Attack"), { ...d, top: 309 }),
    defend: textFrom(getSection(settings, "State_Defend"), { ...d, top: 324 }),
    evade: textFrom(getSection(settings, "State_Evade"), { ...d, top: 339 }),
  };
}

export function parseEquipGuiConfig(settings: Record<string, IniSection>): EquipGuiConfig {
  return {
    panel: panelFrom(getSection(settings, "Equip"), { image: "asf/ui/common/panel7.asf" }),
    ...equipSlotsFrom(settings, "Equip"),
  };
}

export function parseNpcEquipGuiConfig(settings: Record<string, IniSection>): NpcEquipGuiConfig {
  return {
    panel: panelFrom(getSection(settings, "NpcEquip"), { image: "asf/ui/common/panel7.asf" }),
    ...equipSlotsFrom(settings, "NpcEquip"),
  };
}

export function parseXiuLianGuiConfig(settings: Record<string, IniSection>): XiuLianGuiConfig {
  return {
    panel: panelFrom(getSection(settings, "XiuLian"), { image: "asf/ui/common/panel6.asf" }),
    magicImage: rectFrom(getSection(settings, "XiuLian_Magic_Image"), {
      left: 115,
      top: 75,
      width: 60,
      height: 75,
    }),
    levelText: textFrom(getSection(settings, "XiuLian_Level_Text"), {
      left: 126,
      top: 224,
      width: 80,
      height: 12,
      color: "rgba(0,0,0,0.8)",
    }),
    expText: textFrom(getSection(settings, "XiuLian_Exp_Text"), {
      left: 126,
      top: 243,
      width: 80,
      height: 12,
      color: "rgba(0,0,0,0.8)",
    }),
    nameText: textFrom(getSection(settings, "XiuLian_Name_Text"), {
      left: 105,
      top: 256,
      width: 200,
      height: 20,
      color: "rgba(88,32,32,0.9)",
    }),
    introText: textFrom(getSection(settings, "XiuLian_Intro_Text"), {
      left: 75,
      top: 275,
      width: 145,
      height: 120,
      color: "rgba(47,32,88,0.9)",
    }),
  };
}

export function parseGoodsGuiConfig(settings: Record<string, IniSection>): GoodsGuiConfig {
  const goods = getSection(settings, "Goods");
  const listItems = getSection(settings, "Goods_List_Items");

  // Parse 9 item slots (3x3 grid) — computed defaults per slot
  const items = Array.from({ length: 9 }, (_, i) => ({
    left: parseInt2(listItems[`Item_Left_${i + 1}`], 71 + (i % 3) * 65),
    top: parseInt2(listItems[`Item_Top_${i + 1}`], 91 + Math.floor(i / 3) * 79),
    width: parseInt2(listItems[`Item_Width_${i + 1}`], 60),
    height: parseInt2(listItems[`Item_Height_${i + 1}`], 75),
  }));

  return {
    panel: panelFrom(goods, { image: "asf/ui/common/panel3.asf" }),
    scrollBar: scrollBarFrom(goods, {
      left: 294,
      top: 108,
      width: 28,
      height: 190,
      button: "asf/ui/option/slidebtn.asf",
    }),
    items,
    money: textFrom(getSection(settings, "Goods_Money"), {
      left: 137,
      top: 363,
      width: 100,
      height: 12,
      color: "rgba(255,255,255,0.8)",
    }),
  };
}

export function parseMagicsGuiConfig(settings: Record<string, IniSection>): MagicsGuiConfig {
  const magics = getSection(settings, "Magics");
  const listItems = getSection(settings, "Magics_List_Items");

  // Parse 9 item slots (3x3 grid) — computed defaults per slot
  const items = Array.from({ length: 9 }, (_, i) => ({
    left: parseInt2(listItems[`Item_Left_${i + 1}`], 71 + (i % 3) * 65),
    top: parseInt2(listItems[`Item_Top_${i + 1}`], 91 + Math.floor(i / 3) * 79),
    width: parseInt2(listItems[`Item_Width_${i + 1}`], 60),
    height: parseInt2(listItems[`Item_Height_${i + 1}`], 75),
  }));

  return {
    panel: panelFrom(magics, { image: "asf/ui/common/panel2.asf" }),
    scrollBar: scrollBarFrom(magics, {
      left: 294,
      top: 108,
      width: 28,
      height: 190,
      button: "asf/ui/option/slidebtn.asf",
    }),
    items,
  };
}

export function parseMemoGuiConfig(settings: Record<string, IniSection>): MemoGuiConfig {
  const slider = getSection(settings, "Memo_Slider");
  return {
    panel: panelFrom(getSection(settings, "Memo"), { image: "asf/ui/common/panel4.asf" }),
    text: textFrom(getSection(settings, "Memo_Text"), {
      left: 90,
      top: 155,
      width: 150,
      height: 180,
      charSpace: 1,
      lineSpace: 1,
      color: "rgba(40,25,15,0.8)",
    }),
    slider: {
      ...rectFrom(slider, { left: 295, top: 108, width: 28, height: 190 }),
      imageBtn: normalizeImagePath(slider.Image_Btn || "asf/ui/option/slidebtn.asf"),
    },
    // NOTE: scrollBar 默认值，参考MemoGui.cs 的滚动条位置 (width default 10, different from slider's 28)
    scrollBar: rectFrom(slider, { left: 295, top: 108, width: 10, height: 190 }),
  };
}

export function parseDialogGuiConfig(settings: Record<string, IniSection>): DialogGuiConfig {
  return {
    panel: panelFrom(getSection(settings, "Dialog"), {
      image: "asf/ui/dialog/panel.asf",
      topAdjust: -208,
    }),
    text: {
      ...textFrom(getSection(settings, "Dialog_Txt"), {
        left: 65,
        top: 30,
        width: 310,
        height: 70,
        charSpace: -1,
        color: "rgba(0,0,0,0.8)",
      }),
      charSpace: -1,
    },
    selectA: textFrom(getSection(settings, "Dialog_SelA"), {
      left: 65,
      top: 52,
      width: 310,
      height: 20,
      charSpace: 1,
      color: "rgba(0,0,255,0.8)",
    }),
    selectB: textFrom(getSection(settings, "Dialog_SelB"), {
      left: 65,
      top: 74,
      width: 310,
      height: 20,
      charSpace: 1,
      color: "rgba(0,0,255,0.8)",
    }),
    portrait: rectFrom(getSection(settings, "Dialog_Portrait"), {
      left: 5,
      top: -143,
      width: 200,
      height: 160,
    }),
  };
}

// ============= SaveLoad GUI Config Parser =============

export function parseSaveLoadGuiConfig(settings: Record<string, IniSection>): SaveLoadGuiConfig {
  const textList = getSection(settings, "SaveLoad_Text_List");
  const messageLine = getSection(settings, "SaveLoad_Message_Line_Text");

  // 解析文本列表项 (进度一/进度二/...)
  const textItems = textList.Text?.split("/") ?? [
    "进度一",
    "进度二",
    "进度三",
    "进度四",
    "进度五",
    "进度六",
    "进度七",
  ];

  return {
    panel: panelFrom(getSection(settings, "SaveLoad"), { image: "asf/ui/saveload/panel.asf" }),
    snapshot: rectFrom(getSection(settings, "Save_Snapshot"), {
      left: 256,
      top: 94,
      width: 267,
      height: 200,
    }),
    textList: {
      text: textItems,
      ...textFrom(textList, {
        left: 135,
        top: 118,
        width: 80,
        height: 189,
        charSpace: 3,
        color: "rgba(91,31,27,0.8)",
      }),
      itemHeight: parseInt2(textList.ItemHeight, 25),
      selectedColor: parseColor(textList.SelectedColor, "rgba(102,73,212,0.8)"),
      sound: textList.Sound || "界-浏览.wav",
    },
    loadBtn: buttonFrom(getSection(settings, "SaveLoad_Load_Btn"), {
      left: 248,
      top: 355,
      width: 64,
      height: 72,
      image: "asf/ui/saveload/btnLoad.asf",
      sound: "界-大按钮.wav",
    }),
    saveBtn: buttonFrom(getSection(settings, "SaveLoad_Save_Btn"), {
      left: 366,
      top: 355,
      width: 64,
      height: 72,
      image: "asf/ui/saveload/btnSave.asf",
      sound: "界-大按钮.wav",
    }),
    exitBtn: buttonFrom(getSection(settings, "SaveLoad_Exit_Btn"), {
      left: 464,
      top: 355,
      width: 64,
      height: 72,
      image: "asf/ui/saveload/btnExit.asf",
      sound: "界-大按钮.wav",
    }),
    saveTimeText: textFrom(getSection(settings, "SaveLoad_Save_Time_Text"), {
      left: 254,
      top: 310,
      width: 350,
      height: 30,
      charSpace: 1,
      color: "rgba(182,219,189,0.7)",
    }),
    messageLine: {
      ...textFrom(messageLine, {
        left: 0,
        top: 440,
        width: 640,
        height: 40,
        color: "rgba(255,215,0,0.8)",
      }),
      align: parseInt2(messageLine.Align, 1),
    },
  };
}

// ============= Message GUI Config =============
//  - shows system messages like level up notifications

export interface MessageGuiConfig {
  panel: {
    image: string;
    leftAdjust: number;
    topAdjust: number;
  };
  text: {
    left: number;
    top: number;
    width: number;
    height: number;
    charSpace: number;
    lineSpace: number;
    color: string;
  };
}

export function parseMessageGuiConfig(settings: Record<string, IniSection>): MessageGuiConfig {
  return {
    panel: panelFrom(getSection(settings, "Message"), {
      image: "asf/ui/message/msgbox.asf",
      leftAdjust: -10,
      topAdjust: -47,
    }),
    text: textFrom(getSection(settings, "Message_Text"), {
      left: 46,
      top: 32,
      width: 148,
      height: 50,
      color: "rgba(155,34,22,0.8)",
    }),
  };
}

// ============= NPC Info Show Config =============
//  - displays NPC life bar at top of screen
// Reference: InfoDrawer.DrawLife() reads [NpcInfoShow] section

export interface NpcInfoShowConfig {
  width: number;
  height: number;
  leftAdjust: number;
  topAdjust: number;
}

export function parseNpcInfoShowConfig(settings: Record<string, IniSection>): NpcInfoShowConfig {
  const s = getSection(settings, "NpcInfoShow");
  return {
    width: parseInt2(s.Width, 300),
    height: parseInt2(s.Height, 25),
    leftAdjust: parseInt2(s.LeftAdjust, 0),
    topAdjust: parseInt2(s.TopAdjust, 50),
  };
}

// ============= LittleMap (小地图) Config =============
//  - shows a mini map for navigation

export interface LittleMapButtonConfig {
  left: number;
  top: number;
  image: string;
  sound: string;
}

export interface LittleMapTextConfig {
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  align: number; // 0=left, 1=center, 2=right
}

export interface LittleMapGuiConfig {
  panel: {
    image: string;
    leftAdjust: number;
    topAdjust: number;
  };
  leftBtn: LittleMapButtonConfig;
  rightBtn: LittleMapButtonConfig;
  upBtn: LittleMapButtonConfig;
  downBtn: LittleMapButtonConfig;
  closeBtn: LittleMapButtonConfig;
  mapNameText: LittleMapTextConfig;
  bottomTipText: LittleMapTextConfig;
  messageTipText: LittleMapTextConfig;
}

export function parseLittleMapGuiConfig(settings: Record<string, IniSection>): LittleMapGuiConfig {
  const snd = "界-浏览.wav";
  return {
    panel: panelFrom(getSection(settings, "LittleMap"), { image: "asf/ui/littlemap/panel.asf" }),
    leftBtn: mapBtnFrom(getSection(settings, "LittleMap_Left_Btn"), {
      left: 437,
      top: 379,
      image: "asf/ui/littlemap/btnleft.asf",
      sound: snd,
    }),
    rightBtn: mapBtnFrom(getSection(settings, "LittleMap_Right_Btn"), {
      left: 464,
      top: 379,
      image: "asf/ui/littlemap/btnright.asf",
      sound: snd,
    }),
    upBtn: mapBtnFrom(getSection(settings, "LittleMap_Up_Btn"), {
      left: 448,
      top: 368,
      image: "asf/ui/littlemap/btnup.asf",
      sound: snd,
    }),
    downBtn: mapBtnFrom(getSection(settings, "LittleMap_Down_Btn"), {
      left: 448,
      top: 395,
      image: "asf/ui/littlemap/btndown.asf",
      sound: snd,
    }),
    closeBtn: mapBtnFrom(getSection(settings, "LittleMap_Close_Btn"), {
      left: 448,
      top: 379,
      image: "asf/ui/littlemap/btnclose.asf",
      sound: snd,
    }),
    mapNameText: mapTextFrom(getSection(settings, "LittleMap_Map_Name_Line_Text"), {
      left: 210,
      top: 92,
      width: 220,
      height: 30,
      color: "rgba(76,56,48,0.8)",
      align: 1,
    }),
    bottomTipText: mapTextFrom(getSection(settings, "LittleMap_Bottom_Tip_Line_Text"), {
      left: 160,
      top: 370,
      width: 260,
      height: 30,
      color: "rgba(76,56,48,0.8)",
      align: 0,
    }),
    messageTipText: mapTextFrom(getSection(settings, "LittleMap_Message_Tip_Line_Text"), {
      left: 160,
      top: 370,
      width: 260,
      height: 30,
      color: "rgba(200,0,0,0.8)",
      align: 2,
    }),
  };
}

// ============= BuySell (商店) Config =============
//  - shows shop interface for buying/selling items

export interface BuySellGuiConfig {
  panel: {
    image: string;
    leftAdjust: number;
    topAdjust: number;
  };
  scrollBar: {
    left: number;
    top: number;
    width: number;
    height: number;
    button: string;
  };
  items: { left: number; top: number; width: number; height: number }[];
  closeBtn: {
    left: number;
    top: number;
    image: string;
    sound: string;
  };
}

export function parseBuySellGuiConfig(settings: Record<string, IniSection>): BuySellGuiConfig {
  const buySell = getSection(settings, "BuySell");
  const listItems = getSection(settings, "BuySell_List_Items");

  // Parse 9 item slots (3x3 grid) — computed defaults per slot
  const items = Array.from({ length: 9 }, (_, i) => ({
    left: parseInt2(listItems[`Item_Left_${i + 1}`], 55 + (i % 3) * 65),
    top: parseInt2(listItems[`Item_Top_${i + 1}`], 91 + Math.floor(i / 3) * 79),
    width: parseInt2(listItems[`Item_Width_${i + 1}`], 60),
    height: parseInt2(listItems[`Item_Height_${i + 1}`], 75),
  }));

  return {
    panel: panelFrom(buySell, { image: "asf/ui/common/panel8.asf" }),
    scrollBar: scrollBarFrom(buySell, {
      left: 271,
      top: 108,
      width: 28,
      height: 190,
      button: "asf/ui/option/slidebtn.asf",
    }),
    items,
    closeBtn: {
      left: parseInt2(buySell.CloseLeft, 117),
      top: parseInt2(buySell.CloseTop, 354),
      image: normalizeImagePath(buySell.CloseImage || "asf/ui/buysell/CloseBtn.asf"),
      sound: buySell.CloseSound || "界-大按钮.wav",
    },
  };
}

// ============= Bottom (底部快捷栏) Config =============

export interface BottomSlotConfig {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BottomGuiConfig {
  panel: PanelConfig;
  items: BottomSlotConfig[];
}

export function parseBottomGuiConfig(settings: Record<string, IniSection>): BottomGuiConfig {
  const bottomItems = getSection(settings, "Bottom_Items");

  // 8 slots: 1-3 items, 4-8 magic (matching C# BottomGui)
  const defaultSlots: BottomSlotConfig[] = [
    { left: 7, top: 20, width: 30, height: 40 },
    { left: 44, top: 20, width: 30, height: 40 },
    { left: 82, top: 20, width: 30, height: 40 },
    { left: 199, top: 20, width: 30, height: 40 },
    { left: 238, top: 20, width: 30, height: 40 },
    { left: 277, top: 20, width: 30, height: 40 },
    { left: 316, top: 20, width: 30, height: 40 },
    { left: 354, top: 20, width: 30, height: 40 },
  ];

  const items = Array.from({ length: 8 }, (_, i) => ({
    left: parseInt2(bottomItems[`Item_Left_${i + 1}`], defaultSlots[i].left),
    top: parseInt2(bottomItems[`Item_Top_${i + 1}`], defaultSlots[i].top),
    width: parseInt2(bottomItems[`Item_Width_${i + 1}`], defaultSlots[i].width),
    height: parseInt2(bottomItems[`Item_Height_${i + 1}`], defaultSlots[i].height),
  }));

  return {
    panel: panelFrom(getSection(settings, "Bottom"), {
      image: "asf/ui/bottom/window.asf",
      leftAdjust: 102,
    }),
    items,
  };
}

// ============= BottomState (血蓝条) Config =============

export interface BottomStateBarConfig {
  image: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BottomStateGuiConfig {
  panel: PanelConfig;
  life: BottomStateBarConfig;
  thew: BottomStateBarConfig;
  mana: BottomStateBarConfig;
}

export function parseBottomStateGuiConfig(settings: Record<string, IniSection>): BottomStateGuiConfig {
  const barFrom = (s: IniSection, d: BottomStateBarConfig): BottomStateBarConfig => ({
    image: normalizeImagePath(s.Image || d.image),
    left: parseInt2(s.Left, d.left),
    top: parseInt2(s.Top, d.top),
    width: parseInt2(s.Width, d.width),
    height: parseInt2(s.Height, d.height),
  });

  return {
    panel: panelFrom(getSection(settings, "BottomState"), {
      image: "asf/ui/column/panel9.asf",
      leftAdjust: -320,
    }),
    life: barFrom(getSection(settings, "BottomState_Life"), {
      image: "asf/ui/column/ColLife.asf",
      left: 11,
      top: 22,
      width: 48,
      height: 46,
    }),
    thew: barFrom(getSection(settings, "BottomState_Thew"), {
      image: "asf/ui/column/ColThew.asf",
      left: 59,
      top: 22,
      width: 48,
      height: 46,
    }),
    mana: barFrom(getSection(settings, "BottomState_Mana"), {
      image: "asf/ui/column/ColMana.asf",
      left: 113,
      top: 22,
      width: 48,
      height: 46,
    }),
  };
}

// ============= Top (顶部/侧边功能按钮栏) Config =============

export interface TopGuiConfig {
  panel: PanelConfig;
  buttons: ButtonConfig[];
}

/** Button section names in C# order: State, Equip, XiuLian, Goods, Magic, Memo, System */
const TOP_BUTTON_SECTIONS = [
  "Top_State_Btn",
  "Top_Equip_Btn",
  "Top_XiuLian_Btn",
  "Top_Goods_Btn",
  "Top_Magic_Btn",
  "Top_Memo_Btn",
  "Top_System_Btn",
] as const;

const TOP_BUTTON_DEFAULTS: {
  left: number;
  top: number;
  width: number;
  height: number;
  image: string;
  sound: string;
}[] = [
  { left: 52, top: 0, width: 19, height: 19, image: "asf/ui/top/BtnState.asf", sound: "界-大按钮.wav" },
  { left: 80, top: 0, width: 19, height: 19, image: "asf/ui/top/BtnEquip.asf", sound: "界-大按钮.wav" },
  { left: 107, top: 0, width: 19, height: 19, image: "asf/ui/top/BtnXiuLian.asf", sound: "界-大按钮.wav" },
  { left: 135, top: 0, width: 19, height: 19, image: "asf/ui/top/BtnGoods.asf", sound: "界-大按钮.wav" },
  { left: 162, top: 0, width: 19, height: 19, image: "asf/ui/top/BtnMagic.asf", sound: "界-大按钮.wav" },
  { left: 189, top: 0, width: 19, height: 19, image: "asf/ui/top/BtnNotes.asf", sound: "界-大按钮.wav" },
  { left: 216, top: 0, width: 19, height: 19, image: "asf/ui/top/BtnOption.asf", sound: "界-大按钮.wav" },
];

export function parseTopGuiConfig(settings: Record<string, IniSection>): TopGuiConfig {
  const buttons = TOP_BUTTON_SECTIONS.map((sec, i) =>
    buttonFrom(getSection(settings, sec), TOP_BUTTON_DEFAULTS[i])
  );

  return {
    panel: panelFrom(getSection(settings, "Top"), {
      image: "asf/ui/top/window.asf",
    }),
    buttons,
  };
}

// ============= ToolTip Config =============

export interface ToolTipUseTypeConfig {
  useType: 1 | 2;
}

export interface ToolTipType2Config {
  width: number;
  textHorizontalPadding: number;
  textVerticalPadding: number;
  backgroundColor: UiColorRGBA;
  magicNameColor: UiColorRGBA;
  magicLevelColor: UiColorRGBA;
  magicIntroColor: UiColorRGBA;
  goodNameColor: UiColorRGBA;
  goodPriceColor: UiColorRGBA;
  goodUserColor: UiColorRGBA;
  goodPropertyColor: UiColorRGBA;
  goodIntroColor: UiColorRGBA;
}

export function parseToolTipUseTypeConfig(settings: Record<string, IniSection>): ToolTipUseTypeConfig {
  const sec = getSection(settings, "ToolTip_Use_Type");
  const useType = parseInt2(sec["UseType"], 1);
  return { useType: useType === 2 ? 2 : 1 };
}

export function parseToolTipType2Config(settings: Record<string, IniSection>): ToolTipType2Config {
  const sec = getSection(settings, "ToolTip_Type2");
  return {
    width: parseInt2(sec["Width"], 288),
    textHorizontalPadding: parseInt2(sec["TextHorizontalPadding"], 6),
    textVerticalPadding: parseInt2(sec["TextVerticalPadding"], 4),
    backgroundColor: parseIniColor(sec["BackgroundColor"] ?? "0,0,0,160"),
    magicNameColor: parseIniColor(sec["MagicNameColor"] ?? "225,225,110,160"),
    magicLevelColor: parseIniColor(sec["MagicLevelColor"] ?? "255,255,255,160"),
    magicIntroColor: parseIniColor(sec["MagicIntroColor"] ?? "255,255,255,160"),
    goodNameColor: parseIniColor(sec["GoodNameColor"] ?? "245,233,171,160"),
    goodPriceColor: parseIniColor(sec["GoodPriceColor"] ?? "255,255,255,160"),
    goodUserColor: parseIniColor(sec["GoodUserColor"] ?? "255,255,255,160"),
    goodPropertyColor: parseIniColor(sec["GoodPropertyColor"] ?? "255,255,255,160"),
    goodIntroColor: parseIniColor(sec["GoodIntroColor"] ?? "255,255,255,160"),
  };
}

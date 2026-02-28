/**
 * UI Settings — 紧凑 JSON 主题格式 + 解析器
 *
 * 存储格式（UiTheme）：使用网格定义、坐标元组、省略默认值
 * 渲染格式（Resolved*Config）：展开为绝对坐标，渲染组件直接使用
 *
 * 数据流: DB JSONB → UiTheme → resolveTheme() → Resolved*Config → React hooks → 渲染
 */

import { logger } from "../core/logger";

// ============================================
// 颜色工具
// ============================================

export interface UiColorRGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** 解析 "r,g,b,a" 或 "r,g,b" 为 UiColorRGBA */
export function parseIniColor(colorStr: string): UiColorRGBA {
  const parts = colorStr.split(",").map((s) => Number.parseInt(s.trim(), 10));
  return {
    r: parts[0] || 0,
    g: parts[1] || 0,
    b: parts[2] || 0,
    a: parts[3] !== undefined ? parts[3] : 255,
  };
}

/** UiColorRGBA → CSS rgba() */
export function colorToCSS(color: UiColorRGBA): string {
  return `rgba(${color.r},${color.g},${color.b},${color.a / 255})`;
}

/** Normalize image path (backslash → forward slash, strip leading /) */
export function normalizeImagePath(path: string): string {
  if (!path) return "";
  let normalized = path.replace(/\\/g, "/");
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }
  return normalized;
}

// ============================================
// 紧凑 UiTheme 格式 — 存入 DB JSONB
// ============================================

/** 2D 坐标 [left, top] */
type Pos = [number, number];
/** 2D 尺寸 [width, height] */
type Size = [number, number];

/** 面板：纯字符串 = 仅图片路径；对象 = 带偏移/叠加层 */
export type ThemePanel =
  | string
  | {
      image: string;
      offset?: Pos;
      overlay?: string;
      overlayOffset?: Pos;
      size?: Size;
      anchor?: "bottom";
    };

/** 按钮 */
export interface ThemeButton {
  pos: Pos;
  size: Size;
  image: string;
  sound?: string;
}

/** 文本区域 */
export interface ThemeText {
  pos: Pos;
  size: Size;
  color?: string;
  charSpace?: number;
  lineSpace?: number;
}

/** 网格布局（替代 N 个独立 item） */
export interface ThemeGrid {
  origin: Pos;
  cell: Size;
  gap: Pos;
  cols: number;
  rows: number;
}

/** 滚动条 */
export interface ThemeScrollBar {
  pos: Pos;
  size: Size;
  button: string;
}

/** 矩形区域 */
export interface ThemeRect {
  pos: Pos;
  size: Size;
}

/** 状态条 */
export interface ThemeBar {
  pos: Pos;
  size: Size;
  image: string;
}

/** 小地图按钮 */
export interface ThemeMapButton {
  pos: Pos;
  image: string;
  sound?: string;
}

/** 小地图文本 */
export interface ThemeMapText {
  pos: Pos;
  size: Size;
  color?: string;
  align?: number;
}

// ---------- 各面板的紧凑定义 ----------

export interface ThemeTitle {
  background: string;
  offset?: Pos;
  buttons: {
    begin: ThemeButton;
    load: ThemeButton;
    team: ThemeButton;
    exit: ThemeButton;
  };
}

export interface ThemeSaveLoad {
  panel: ThemePanel;
  snapshot: ThemeRect;
  textList: {
    text: string[];
    pos: Pos;
    size: Size;
    charSpace?: number;
    lineSpace?: number;
    itemHeight: number;
    color?: string;
    selectedColor?: string;
    sound?: string;
  };
  loadBtn: ThemeButton;
  saveBtn: ThemeButton;
  exitBtn: ThemeButton;
  saveTimeText: ThemeText;
  messageLine: ThemeText & { align?: number };
}

export interface ThemeSystem {
  panel: ThemePanel;
  saveLoadBtn: ThemeButton;
  optionBtn: ThemeButton;
  exitBtn: ThemeButton;
  returnBtn: ThemeButton;
}

export interface ThemeState {
  panel: ThemePanel;
  color?: string;
  level: ThemeText;
  exp: ThemeText;
  levelUp: ThemeText;
  life: ThemeText;
  thew: ThemeText;
  mana: ThemeText;
  attack: ThemeText;
  defend: ThemeText;
  evade: ThemeText;
}

export interface ThemeEquip {
  panel: ThemePanel;
  slotSize: Size;
  slots: {
    head: Pos;
    neck: Pos;
    body: Pos;
    back: Pos;
    hand: Pos;
    wrist: Pos;
    foot: Pos;
  };
}

export interface ThemeXiuLian {
  panel: ThemePanel;
  magicImage: ThemeRect;
  levelText: ThemeText;
  expText: ThemeText;
  nameText: ThemeText;
  introText: ThemeText;
}

export interface ThemeGoods {
  panel: ThemePanel;
  grid: ThemeGrid;
  scrollBar: ThemeScrollBar;
  money: ThemeText;
  goldIcon?: { pos: Pos; size: Size; image: string };
}

export interface ThemeMagics {
  panel: ThemePanel;
  grid: ThemeGrid;
  scrollBar: ThemeScrollBar;
}

export interface ThemeMemo {
  panel: ThemePanel;
  text: ThemeText;
  slider: ThemeRect & { imageBtn: string };
  scrollBar?: ThemeRect;
}

export interface ThemeDialog {
  panel: ThemePanel;
  text: ThemeText;
  selectA: ThemeText;
  selectB: ThemeText;
  portrait: ThemeRect;
}

export interface ThemeMessage {
  panel: ThemePanel;
  text: ThemeText;
}

export interface ThemeNpcInfoShow {
  size: Size;
  offset?: Pos;
}

export interface ThemeLittleMap {
  panel: ThemePanel;
  leftBtn: ThemeMapButton;
  rightBtn: ThemeMapButton;
  upBtn: ThemeMapButton;
  downBtn: ThemeMapButton;
  closeBtn: ThemeMapButton;
  mapNameText: ThemeMapText;
  bottomTipText: ThemeMapText;
  messageTipText: ThemeMapText;
}

export interface ThemeBuySell {
  panel: ThemePanel;
  grid: ThemeGrid;
  scrollBar: ThemeScrollBar;
  closeBtn: ThemeMapButton;
}

export interface ThemeBottom {
  panel: ThemePanel;
  /** 快捷栏槽位（逐项定义，不是网格——因为物品槽/武功槽间距不同） */
  items: ThemeButton[];
  buttons: ThemeButton[];
}

export interface ThemeBottomState {
  panel: ThemePanel;
  life: ThemeBar;
  thew: ThemeBar;
  mana: ThemeBar;
}

export interface ThemeTop {
  panel: ThemePanel;
  buttons: ThemeButton[];
}

export interface ThemeTooltip2 {
  width?: number;
  textHorizontalPadding?: number;
  textVerticalPadding?: number;
  backgroundColor?: string;
  magicNameColor?: string;
  magicLevelColor?: string;
  magicIntroColor?: string;
  goodNameColor?: string;
  goodPriceColor?: string;
  goodUserColor?: string;
  goodPropertyColor?: string;
  goodIntroColor?: string;
}

export interface ThemeTooltip1 {
  image?: string;
  itemImage: ThemeRect;
  name: ThemeText;
  priceOrLevel: ThemeText;
  effect: ThemeText;
  magicIntro: ThemeText;
  goodIntro: ThemeText;
}

/**
 * 紧凑 UI 主题配置 — 存入 DB JSONB
 *
 * 特性：
 * - 网格定义替代逐项坐标（9 items → 1 grid）
 * - 位置/尺寸用 [x,y] 元组
 * - 零值默认省略（charSpace=0, lineSpace=0 等）
 * - 面板仅图片时用字符串简写
 */
export interface UiTheme {
  title?: ThemeTitle;
  saveLoad: ThemeSaveLoad;
  system: ThemeSystem;
  state: ThemeState;
  equip: ThemeEquip;
  npcEquip: ThemeEquip;
  xiuLian: ThemeXiuLian;
  goods: ThemeGoods;
  magics: ThemeMagics;
  memo: ThemeMemo;
  dialog: ThemeDialog;
  message: ThemeMessage;
  npcInfoShow: ThemeNpcInfoShow;
  littleMap: ThemeLittleMap;
  buySell: ThemeBuySell;
  bottom: ThemeBottom;
  bottomState: ThemeBottomState;
  top: ThemeTop;
  tooltipMode: 1 | 2;
  tooltip1: ThemeTooltip1;
  tooltip2: ThemeTooltip2;
}

// ============================================
// 展开后的渲染格式（React 组件直接使用）
// 命名保持与旧版一致，渲染代码无需修改
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
  overlayImage?: string;
  overlayLeft?: number;
  overlayTop?: number;
  leftAdjust: number;
  topAdjust: number;
  width?: number;
  height?: number;
  anchor?: "Top" | "Bottom";
}

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

export type NpcEquipGuiConfig = EquipGuiConfig;

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
  scrollBar: { left: number; top: number; width: number; height: number; button: string };
  /** 展开后的所有可见槽位（单页 = cols\*rows） */
  items: { left: number; top: number; width: number; height: number }[];
  /** 列数（用于滚动计算） */
  cols: number;
  /** 行数（可见页的行数） */
  rows: number;
  money: TextConfig;
  goldIcon?: { left: number; top: number; width: number; height: number; image: string };
}

export interface MagicsGuiConfig {
  panel: PanelConfig;
  scrollBar: { left: number; top: number; width: number; height: number; button: string };
  /** 展开后的所有可见槽位（单页 = cols\*rows） */
  items: { left: number; top: number; width: number; height: number }[];
  /** 列数（用于滚动计算） */
  cols: number;
  /** 行数（可见页的行数） */
  rows: number;
}

export interface MemoGuiConfig {
  panel: PanelConfig;
  text: TextConfig;
  slider: { left: number; top: number; width: number; height: number; imageBtn: string };
  scrollBar: { left: number; top: number; width: number; height: number };
}

export interface DialogGuiConfig {
  panel: PanelConfig;
  text: TextConfig;
  selectA: TextConfig;
  selectB: TextConfig;
  portrait: { left: number; top: number; width: number; height: number };
}

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

export interface MessageGuiConfig {
  panel: { image: string; leftAdjust: number; topAdjust: number };
  text: TextConfig;
}

export interface NpcInfoShowConfig {
  width: number;
  height: number;
  leftAdjust: number;
  topAdjust: number;
}

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
  align: number;
}

export interface LittleMapGuiConfig {
  panel: { image: string; leftAdjust: number; topAdjust: number };
  leftBtn: LittleMapButtonConfig;
  rightBtn: LittleMapButtonConfig;
  upBtn: LittleMapButtonConfig;
  downBtn: LittleMapButtonConfig;
  closeBtn: LittleMapButtonConfig;
  mapNameText: LittleMapTextConfig;
  bottomTipText: LittleMapTextConfig;
  messageTipText: LittleMapTextConfig;
}

export interface BuySellGuiConfig {
  panel: { image: string; leftAdjust: number; topAdjust: number };
  scrollBar: { left: number; top: number; width: number; height: number; button: string };
  items: { left: number; top: number; width: number; height: number }[];
  closeBtn: { left: number; top: number; image: string; sound: string };
}

export interface BottomSlotConfig {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BottomGuiConfig {
  panel: PanelConfig;
  items: BottomSlotConfig[];
  buttons: ButtonConfig[];
}

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

export interface TopGuiConfig {
  panel: PanelConfig;
  buttons: ButtonConfig[];
}

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

export interface ToolTipType1Config {
  image: string;
  itemImage: { left: number; top: number; width: number; height: number };
  name: TextConfig;
  priceOrLevel: TextConfig;
  effect: TextConfig;
  magicIntro: TextConfig;
  goodIntro: TextConfig;
}

export interface TitleGuiConfig {
  backgroundImage: string;
  topAdjust: number;
  leftAdjust: number;
  beginBtn: ButtonConfig;
  loadBtn: ButtonConfig;
  teamBtn: ButtonConfig;
  exitBtn: ButtonConfig;
}

// ============================================
// 解析器：UiTheme → 展开的渲染配置
// ============================================

/** 所有展开后的 UI 配置 */
export interface ResolvedUiConfigs {
  title: TitleGuiConfig | null;
  saveLoad: SaveLoadGuiConfig;
  system: SystemGuiConfig;
  state: StateGuiConfig;
  equip: EquipGuiConfig;
  npcEquip: NpcEquipGuiConfig;
  xiuLian: XiuLianGuiConfig;
  goods: GoodsGuiConfig;
  magics: MagicsGuiConfig;
  memo: MemoGuiConfig;
  dialog: DialogGuiConfig;
  message: MessageGuiConfig;
  npcInfoShow: NpcInfoShowConfig;
  littleMap: LittleMapGuiConfig;
  buySell: BuySellGuiConfig;
  bottom: BottomGuiConfig;
  bottomState: BottomStateGuiConfig;
  top: TopGuiConfig;
  toolTipUseType: ToolTipUseTypeConfig;
  toolTipType1: ToolTipType1Config;
  toolTipType2: ToolTipType2Config;
}

// ---------- 内部展开工具 ----------

function resolvePanel(p: ThemePanel): PanelConfig {
  if (typeof p === "string") {
    return { image: p, leftAdjust: 0, topAdjust: 0 };
  }
  return {
    image: p.image,
    leftAdjust: p.offset?.[0] ?? 0,
    topAdjust: p.offset?.[1] ?? 0,
    ...(p.overlay ? { overlayImage: p.overlay } : {}),
    ...(p.overlayOffset
      ? { overlayLeft: p.overlayOffset[0], overlayTop: p.overlayOffset[1] }
      : {}),
    ...(p.size ? { width: p.size[0], height: p.size[1] } : {}),
    ...(p.anchor === "bottom" ? { anchor: "Bottom" as const } : {}),
  };
}

function resolveButton(b: ThemeButton): ButtonConfig {
  return {
    left: b.pos[0],
    top: b.pos[1],
    width: b.size[0],
    height: b.size[1],
    image: b.image,
    sound: b.sound,
  };
}

function resolveText(t: ThemeText, defaultColor = "rgba(0,0,0,0.8)"): TextConfig {
  return {
    left: t.pos[0],
    top: t.pos[1],
    width: t.size[0],
    height: t.size[1],
    charSpace: t.charSpace ?? 0,
    lineSpace: t.lineSpace ?? 0,
    color: t.color ?? defaultColor,
  };
}

function resolveRect(r: ThemeRect): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  return { left: r.pos[0], top: r.pos[1], width: r.size[0], height: r.size[1] };
}

/** 网格 → 逐项坐标数组 */
function resolveGrid(g: ThemeGrid): {
  left: number;
  top: number;
  width: number;
  height: number;
}[] {
  const items: { left: number; top: number; width: number; height: number }[] =
    [];
  for (let row = 0; row < g.rows; row++) {
    for (let col = 0; col < g.cols; col++) {
      items.push({
        left: g.origin[0] + col * (g.cell[0] + g.gap[0]),
        top: g.origin[1] + row * (g.cell[1] + g.gap[1]),
        width: g.cell[0],
        height: g.cell[1],
      });
    }
  }
  return items;
}

function resolveMapBtn(b: ThemeMapButton): LittleMapButtonConfig {
  return {
    left: b.pos[0],
    top: b.pos[1],
    image: b.image,
    sound: b.sound ?? "界-浏览.wav",
  };
}

function resolveMapText(
  t: ThemeMapText,
  defaultColor = "rgba(76,56,48,0.8)",
): LittleMapTextConfig {
  return {
    left: t.pos[0],
    top: t.pos[1],
    width: t.size[0],
    height: t.size[1],
    color: t.color ?? defaultColor,
    align: t.align ?? 0,
  };
}

function resolveBar(b: ThemeBar): BottomStateBarConfig {
  return {
    image: b.image,
    left: b.pos[0],
    top: b.pos[1],
    width: b.size[0],
    height: b.size[1],
  };
}

function resolveScrollBar(sb: ThemeScrollBar): {
  left: number;
  top: number;
  width: number;
  height: number;
  button: string;
} {
  return {
    left: sb.pos[0],
    top: sb.pos[1],
    width: sb.size[0],
    height: sb.size[1],
    button: sb.button,
  };
}

function resolveEquip(e: ThemeEquip): EquipGuiConfig {
  const [sw, sh] = e.slotSize;
  const slot = (p: Pos) => ({ left: p[0], top: p[1], width: sw, height: sh });
  return {
    panel: resolvePanel(e.panel),
    head: slot(e.slots.head),
    neck: slot(e.slots.neck),
    body: slot(e.slots.body),
    back: slot(e.slots.back),
    hand: slot(e.slots.hand),
    wrist: slot(e.slots.wrist),
    foot: slot(e.slots.foot),
  };
}

/** 支持 "rgba(r,g,b,a)" 和 "r,g,b,a" 两种颜色格式 */
function parseColorStr(s: string): UiColorRGBA {
  const rgbaMatch = s.match(/rgba?\(([^)]+)\)/);
  if (rgbaMatch) {
    const parts = rgbaMatch[1]
      .split(",")
      .map((p) => Number.parseFloat(p.trim()));
    return {
      r: Math.round(parts[0] ?? 0),
      g: Math.round(parts[1] ?? 0),
      b: Math.round(parts[2] ?? 0),
      a: parts[3] !== undefined ? Math.round(parts[3] * 255) : 255,
    };
  }
  return parseIniColor(s);
}

/**
 * 将 UiTheme 展开为所有渲染配置
 */
export function resolveTheme(theme: UiTheme): ResolvedUiConfigs {
  // --- title ---
  const title: TitleGuiConfig | null = theme.title
    ? {
        backgroundImage: theme.title.background,
        topAdjust: theme.title.offset?.[1] ?? 0,
        leftAdjust: theme.title.offset?.[0] ?? 0,
        beginBtn: resolveButton(theme.title.buttons.begin),
        loadBtn: resolveButton(theme.title.buttons.load),
        teamBtn: resolveButton(theme.title.buttons.team),
        exitBtn: resolveButton(theme.title.buttons.exit),
      }
    : null;

  // --- system ---
  const system: SystemGuiConfig = {
    panel: resolvePanel(theme.system.panel),
    saveLoadBtn: resolveButton(theme.system.saveLoadBtn),
    optionBtn: resolveButton(theme.system.optionBtn),
    exitBtn: resolveButton(theme.system.exitBtn),
    returnBtn: resolveButton(theme.system.returnBtn),
  };

  // --- state ---
  const stateDefaultColor = theme.state.color ?? "rgba(0,0,0,0.7)";
  const state: StateGuiConfig = {
    panel: resolvePanel(theme.state.panel),
    level: resolveText(theme.state.level, stateDefaultColor),
    exp: resolveText(theme.state.exp, stateDefaultColor),
    levelUp: resolveText(theme.state.levelUp, stateDefaultColor),
    life: resolveText(theme.state.life, stateDefaultColor),
    thew: resolveText(theme.state.thew, stateDefaultColor),
    mana: resolveText(theme.state.mana, stateDefaultColor),
    attack: resolveText(theme.state.attack, stateDefaultColor),
    defend: resolveText(theme.state.defend, stateDefaultColor),
    evade: resolveText(theme.state.evade, stateDefaultColor),
  };

  // --- goods ---
  const goods: GoodsGuiConfig = {
    panel: resolvePanel(theme.goods.panel),
    scrollBar: resolveScrollBar(theme.goods.scrollBar),
    items: resolveGrid(theme.goods.grid),
    cols: theme.goods.grid.cols,
    rows: theme.goods.grid.rows,
    money: resolveText(theme.goods.money, "rgba(255,255,255,0.8)"),
    ...(theme.goods.goldIcon
      ? {
          goldIcon: {
            left: theme.goods.goldIcon.pos[0],
            top: theme.goods.goldIcon.pos[1],
            width: theme.goods.goldIcon.size[0],
            height: theme.goods.goldIcon.size[1],
            image: theme.goods.goldIcon.image,
          },
        }
      : {}),
  };

  // --- magics ---
  const magics: MagicsGuiConfig = {
    panel: resolvePanel(theme.magics.panel),
    scrollBar: resolveScrollBar(theme.magics.scrollBar),
    items: resolveGrid(theme.magics.grid),
    cols: theme.magics.grid.cols,
    rows: theme.magics.grid.rows,
  };

  // --- memo ---
  const memoSlider = resolveRect(theme.memo.slider);
  const memo: MemoGuiConfig = {
    panel: resolvePanel(theme.memo.panel),
    text: resolveText(theme.memo.text, "rgba(40,25,15,0.8)"),
    slider: { ...memoSlider, imageBtn: theme.memo.slider.imageBtn },
    scrollBar: theme.memo.scrollBar
      ? resolveRect(theme.memo.scrollBar)
      : { ...memoSlider, width: 10 },
  };

  // --- dialog ---
  const dialog: DialogGuiConfig = {
    panel: resolvePanel(theme.dialog.panel),
    text: resolveText(theme.dialog.text, "rgba(0,0,0,0.8)"),
    selectA: resolveText(theme.dialog.selectA, "rgba(0,0,255,0.8)"),
    selectB: resolveText(theme.dialog.selectB, "rgba(0,0,255,0.8)"),
    portrait: resolveRect(theme.dialog.portrait),
  };

  // --- saveLoad ---
  const sl = theme.saveLoad;
  const saveLoad: SaveLoadGuiConfig = {
    panel: resolvePanel(sl.panel),
    snapshot: resolveRect(sl.snapshot),
    textList: {
      text: sl.textList.text,
      left: sl.textList.pos[0],
      top: sl.textList.pos[1],
      width: sl.textList.size[0],
      height: sl.textList.size[1],
      charSpace: sl.textList.charSpace ?? 0,
      lineSpace: sl.textList.lineSpace ?? 0,
      itemHeight: sl.textList.itemHeight,
      color: sl.textList.color ?? "rgba(91,31,27,0.8)",
      selectedColor: sl.textList.selectedColor ?? "rgba(102,73,212,0.8)",
      sound: sl.textList.sound ?? "界-浏览.wav",
    },
    loadBtn: resolveButton(sl.loadBtn),
    saveBtn: resolveButton(sl.saveBtn),
    exitBtn: resolveButton(sl.exitBtn),
    saveTimeText: resolveText(sl.saveTimeText, "rgba(182,219,189,0.7)"),
    messageLine: {
      ...resolveText(sl.messageLine, "rgba(255,215,0,0.8)"),
      align: sl.messageLine.align ?? 1,
    },
  };

  // --- message ---
  const message: MessageGuiConfig = {
    panel: resolvePanel(theme.message.panel),
    text: resolveText(theme.message.text, "rgba(155,34,22,0.8)"),
  };

  // --- npcInfoShow ---
  const npcInfoShow: NpcInfoShowConfig = {
    width: theme.npcInfoShow.size[0],
    height: theme.npcInfoShow.size[1],
    leftAdjust: theme.npcInfoShow.offset?.[0] ?? 0,
    topAdjust: theme.npcInfoShow.offset?.[1] ?? 0,
  };

  // --- littleMap ---
  const littleMap: LittleMapGuiConfig = {
    panel: resolvePanel(theme.littleMap.panel),
    leftBtn: resolveMapBtn(theme.littleMap.leftBtn),
    rightBtn: resolveMapBtn(theme.littleMap.rightBtn),
    upBtn: resolveMapBtn(theme.littleMap.upBtn),
    downBtn: resolveMapBtn(theme.littleMap.downBtn),
    closeBtn: resolveMapBtn(theme.littleMap.closeBtn),
    mapNameText: resolveMapText(theme.littleMap.mapNameText),
    bottomTipText: resolveMapText(theme.littleMap.bottomTipText),
    messageTipText: resolveMapText(
      theme.littleMap.messageTipText,
      "rgba(200,0,0,0.8)",
    ),
  };

  // --- buySell ---
  const buySell: BuySellGuiConfig = {
    panel: resolvePanel(theme.buySell.panel),
    scrollBar: resolveScrollBar(theme.buySell.scrollBar),
    items: resolveGrid(theme.buySell.grid),
    closeBtn: resolveMapBtn(theme.buySell.closeBtn),
  };

  // --- bottom ---
  const bottom: BottomGuiConfig = {
    panel: resolvePanel(theme.bottom.panel),
    items: theme.bottom.items.map((item) => ({
      left: item.pos[0],
      top: item.pos[1],
      width: item.size[0],
      height: item.size[1],
    })),
    buttons: theme.bottom.buttons.map(resolveButton),
  };

  // --- bottomState ---
  const bottomState: BottomStateGuiConfig = {
    panel: resolvePanel(theme.bottomState.panel),
    life: resolveBar(theme.bottomState.life),
    thew: resolveBar(theme.bottomState.thew),
    mana: resolveBar(theme.bottomState.mana),
  };

  // --- top ---
  const top: TopGuiConfig = {
    panel: resolvePanel(theme.top.panel),
    buttons: theme.top.buttons.map(resolveButton),
  };

  // --- tooltips ---
  const toolTipUseType: ToolTipUseTypeConfig = { useType: theme.tooltipMode };

  const t2 = theme.tooltip2;
  const toolTipType2: ToolTipType2Config = {
    width: t2.width ?? 288,
    textHorizontalPadding: t2.textHorizontalPadding ?? 6,
    textVerticalPadding: t2.textVerticalPadding ?? 4,
    backgroundColor: parseColorStr(t2.backgroundColor ?? "rgba(0,0,0,0.63)"),
    magicNameColor: parseColorStr(t2.magicNameColor ?? "rgba(225,225,110,0.63)"),
    magicLevelColor: parseColorStr(
      t2.magicLevelColor ?? "rgba(255,255,255,0.63)",
    ),
    magicIntroColor: parseColorStr(
      t2.magicIntroColor ?? "rgba(255,255,255,0.63)",
    ),
    goodNameColor: parseColorStr(t2.goodNameColor ?? "rgba(245,233,171,0.63)"),
    goodPriceColor: parseColorStr(
      t2.goodPriceColor ?? "rgba(255,255,255,0.63)",
    ),
    goodUserColor: parseColorStr(t2.goodUserColor ?? "rgba(255,255,255,0.63)"),
    goodPropertyColor: parseColorStr(
      t2.goodPropertyColor ?? "rgba(255,255,255,0.63)",
    ),
    goodIntroColor: parseColorStr(
      t2.goodIntroColor ?? "rgba(255,255,255,0.63)",
    ),
  };

  const t1 = theme.tooltip1;
  const toolTipType1: ToolTipType1Config = {
    image: t1.image ?? "asf/ui/common/tipbox.asf",
    itemImage: resolveRect(t1.itemImage),
    name: resolveText(t1.name, "rgb(102,73,212)"),
    priceOrLevel: resolveText(t1.priceOrLevel, "rgb(91,31,27)"),
    effect: resolveText(t1.effect, "rgb(52,21,14)"),
    magicIntro: resolveText(t1.magicIntro, "rgb(52,21,14)"),
    goodIntro: resolveText(t1.goodIntro, "rgb(52,21,14)"),
  };

  return {
    title,
    saveLoad,
    system,
    state,
    equip: resolveEquip(theme.equip),
    npcEquip: resolveEquip(theme.npcEquip),
    xiuLian: {
      panel: resolvePanel(theme.xiuLian.panel),
      magicImage: resolveRect(theme.xiuLian.magicImage),
      levelText: resolveText(theme.xiuLian.levelText, "rgba(0,0,0,0.8)"),
      expText: resolveText(theme.xiuLian.expText, "rgba(0,0,0,0.8)"),
      nameText: resolveText(theme.xiuLian.nameText, "rgba(88,32,32,0.9)"),
      introText: resolveText(theme.xiuLian.introText, "rgba(47,32,88,0.9)"),
    },
    goods,
    magics,
    memo,
    dialog,
    message,
    npcInfoShow,
    littleMap,
    buySell,
    bottom,
    bottomState,
    top,
    toolTipUseType,
    toolTipType1,
    toolTipType2,
  };
}

// ============================================
// 主题缓存管理
// ============================================

let cachedTheme: UiTheme | null = null;
let cachedResolved: ResolvedUiConfigs | null = null;

/**
 * 设置 UI 主题（从 GameConfig.uiTheme 加载）
 */
export function setUiTheme(theme: UiTheme): void {
  cachedTheme = theme;
  cachedResolved = null;
}

/**
 * 获取已设置的 UiTheme
 */
export function getUiTheme(): UiTheme | null {
  return cachedTheme;
}

/**
 * 获取展开后的渲染配置（懒解析，首次调用时展开）
 */
export function getResolvedConfigs(): ResolvedUiConfigs | null {
  if (!cachedTheme) return null;
  if (!cachedResolved) {
    cachedResolved = resolveTheme(cachedTheme);
    logger.debug("[UISettings] Theme resolved");
  }
  return cachedResolved;
}

/**
 * 重置缓存（切换游戏时调用）
 */
export function resetUISettingsCache(): void {
  cachedTheme = null;
  cachedResolved = null;
}

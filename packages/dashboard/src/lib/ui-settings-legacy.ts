/**
 * Legacy INI → UiTheme 转换器（迁移自 @miu2d/engine）
 *
 * 仅用于：
 * - 批量导入 (ImportAllModal) 从 ZIP 中读取 INI 并转换
 * - 转换脚本 (scripts/convert-ini-to-theme.ts)
 *
 * 运行时不使用此文件，游戏仅使用 ui-settings.ts 中的 UiTheme + resolveTheme()
 */

import { parseIni } from "@miu2d/engine/utils";
import { colorToCSS, normalizeImagePath, parseIniColor } from "@miu2d/engine/gui/ui-settings";
import type {
  ThemeBar,
  ThemeBottom,
  ThemeBottomState,
  ThemeButton,
  ThemeBuySell,
  ThemeDialog,
  ThemeEquip,
  ThemeGoods,
  ThemeGrid,
  ThemeLittleMap,
  ThemeMagics,
  ThemeMapButton,
  ThemeMapText,
  ThemeMemo,
  ThemeMessage,
  ThemeNpcInfoShow,
  ThemePanel,
  ThemeRect,
  ThemeSaveLoad,
  ThemeScrollBar,
  ThemeState,
  ThemeSystem,
  ThemeText,
  ThemeTitle,
  ThemeTooltip1,
  ThemeTooltip2,
  ThemeTop,
  ThemeXiuLian,
  UiTheme,
} from "@miu2d/engine/gui/ui-settings";

// ============================================
// INI 解析工具函数
// ============================================

type IniSection = Record<string, string>;
type IniSettings = Record<string, IniSection>;

function getSection(settings: IniSettings, name: string): IniSection {
  return settings[name] || {};
}

function int2(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function parseColor(colorStr: string, defaultColor = "rgba(0,0,0,1)"): string {
  if (!colorStr) return defaultColor;
  const parts = colorStr.split(",");
  if (parts.length < 3) return defaultColor;
  return colorToCSS(parseIniColor(colorStr));
}

// ============================================
// INI → 紧凑 Theme 子类型转换器
// ============================================

function panelToTheme(s: IniSection, defaultImage: string): ThemePanel {
  const image = normalizeImagePath(s.Image || defaultImage);
  const leftAdj = int2(s.LeftAdjust, 0);
  const topAdj = int2(s.TopAdjust, 0);
  const rawWidth = int2(s.Width, 0);
  const rawHeight = int2(s.Height, 0);
  const rawAnchor = s.Anchor?.trim();
  const rawOverlay = s.OverlayImage?.trim();
  const rawOverlayLeft = int2(s.OverlayLeft, 0);
  const rawOverlayTop = int2(s.OverlayTop, 0);

  // 如果全部都是默认值，直接用字符串简写
  const hasExtras =
    leftAdj !== 0 ||
    topAdj !== 0 ||
    rawWidth > 0 ||
    rawHeight > 0 ||
    rawAnchor === "Bottom" ||
    rawOverlay;

  if (!hasExtras) return image;

  const result: Exclude<ThemePanel, string> = { image };
  if (leftAdj !== 0 || topAdj !== 0) result.offset = [leftAdj, topAdj];
  if (rawOverlay) {
    result.overlay = normalizeImagePath(rawOverlay);
    if (rawOverlayLeft !== 0 || rawOverlayTop !== 0) {
      result.overlayOffset = [rawOverlayLeft, rawOverlayTop];
    }
  }
  if (rawWidth > 0 || rawHeight > 0) result.size = [rawWidth, rawHeight];
  if (rawAnchor === "Bottom") result.anchor = "bottom";
  return result;
}

function buttonToTheme(
  s: IniSection,
  d: { left: number; top: number; width: number; height: number; image: string; sound?: string },
): ThemeButton {
  const result: ThemeButton = {
    pos: [int2(s.Left, d.left), int2(s.Top, d.top)],
    size: [int2(s.Width, d.width), int2(s.Height, d.height)],
    image: normalizeImagePath(s.Image || d.image),
  };
  const sound = s.Sound || d.sound;
  if (sound) result.sound = sound;
  return result;
}

function textToTheme(
  s: IniSection,
  d: { left: number; top: number; width: number; height: number; charSpace?: number; lineSpace?: number; color: string },
): ThemeText {
  const result: ThemeText = {
    pos: [int2(s.Left, d.left), int2(s.Top, d.top)],
    size: [int2(s.Width, d.width), int2(s.Height, d.height)],
  };
  const color = parseColor(s.Color, d.color);
  if (color !== "rgba(0,0,0,0.8)") result.color = color;
  const cs = int2(s.CharSpace, d.charSpace ?? 0);
  if (cs !== 0) result.charSpace = cs;
  const ls = int2(s.LineSpace, d.lineSpace ?? 0);
  if (ls !== 0) result.lineSpace = ls;
  return result;
}

function rectToTheme(
  s: IniSection,
  d: { left: number; top: number; width: number; height: number },
): ThemeRect {
  return {
    pos: [int2(s.Left, d.left), int2(s.Top, d.top)],
    size: [int2(s.Width, d.width), int2(s.Height, d.height)],
  };
}

function scrollBarToTheme(
  s: IniSection,
  d: { left: number; top: number; width: number; height: number; button: string },
): ThemeScrollBar {
  return {
    pos: [int2(s.ScrollBarLeft, d.left), int2(s.ScrollBarRight, d.top)],
    size: [int2(s.ScrollBarWidth, d.width), int2(s.ScrollBarHeight, d.height)],
    button: normalizeImagePath(s.ScrollBarButton || d.button),
  };
}

/** 从 9 个逐项坐标检测网格参数 */
function detectGrid(
  s: IniSection,
  prefix: string,
  defaults: { originX: number; originY: number; cellW: number; cellH: number; gapX: number; gapY: number },
  count = 9,
  cols = 3,
): ThemeGrid {
  const rows = Math.ceil(count / cols);

  // 读 item 1 作为 origin
  const originX = int2(s[`${prefix}_Left_1`], defaults.originX);
  const originY = int2(s[`${prefix}_Top_1`], defaults.originY);
  const cellW = int2(s[`${prefix}_Width_1`], defaults.cellW);
  const cellH = int2(s[`${prefix}_Height_1`], defaults.cellH);

  // 用 item 2 推断列间距
  let gapX = defaults.gapX;
  if (count >= 2) {
    const x2 = int2(s[`${prefix}_Left_2`], originX + defaults.cellW + defaults.gapX);
    gapX = x2 - originX - cellW;
  }

  // 用 item (cols+1) 推断行间距
  let gapY = defaults.gapY;
  if (count > cols) {
    const y2 = int2(s[`${prefix}_Top_${cols + 1}`], originY + defaults.cellH + defaults.gapY);
    gapY = y2 - originY - cellH;
  }

  return {
    origin: [originX, originY],
    cell: [cellW, cellH],
    gap: [gapX, gapY],
    cols,
    rows,
  };
}

/**
 * 从 INI 逆向推断列数：比较 item1 和 item2 的 Top，如果相同则同行，否则 1列
 * @param s INI section
 * @param prefix key prefix (e.g. "Item")
 * @param count total items
 * @param defaultCols fallback columns
 */
function detectCols(
  s: IniSection,
  prefix: string,
  count: number,
  defaultCols = 3,
): number {
  if (count < 2) return defaultCols;
  const top1 = s[`${prefix}_Top_1`];
  const top2 = s[`${prefix}_Top_2`];
  if (top1 && top2) {
    if (top1 === top2) {
      // item1 和 item2 在同一行，查找后续项确定列数
      // 寻找第一个 top 不同于 top1 的项就是第二行开始
      for (let i = 2; i <= count; i++) {
        const topN = s[`${prefix}_Top_${i}`];
        if (topN && topN !== top1) return i - 1;
      }
    } else {
      // item1 和 item2 不在同行 — 1列
      return 1;
    }
  }
  return defaultCols;
}

function mapBtnToTheme(
  s: IniSection,
  d: { left: number; top: number; image: string; sound: string },
): ThemeMapButton {
  const result: ThemeMapButton = {
    pos: [int2(s.Left, d.left), int2(s.Top, d.top)],
    image: normalizeImagePath(s.Image || d.image),
  };
  const sound = s.Sound || d.sound;
  if (sound !== "界-浏览.wav") result.sound = sound;
  return result;
}

function mapTextToTheme(
  s: IniSection,
  d: { left: number; top: number; width: number; height: number; color: string; align: number },
): ThemeMapText {
  const result: ThemeMapText = {
    pos: [int2(s.Left, d.left), int2(s.Top, d.top)],
    size: [int2(s.Width, d.width), int2(s.Height, d.height)],
  };
  const color = parseColor(s.Color, d.color);
  if (color !== "rgba(76,56,48,0.8)") result.color = color;
  const align = int2(s.Align, d.align);
  if (align !== 0) result.align = align;
  return result;
}

function barToTheme(
  s: IniSection,
  d: { image: string; left: number; top: number; width: number; height: number },
): ThemeBar {
  return {
    pos: [int2(s.Left, d.left), int2(s.Top, d.top)],
    size: [int2(s.Width, d.width), int2(s.Height, d.height)],
    image: normalizeImagePath(s.Image || d.image),
  };
}

// ============================================
// 各面板 INI → 紧凑 Theme
// ============================================

function convertTitle(settings: IniSettings): ThemeTitle | undefined {
  const sec = getSection(settings, "Title");
  const bg = normalizeImagePath(sec.BackgroundImage || "");
  if (!bg) return undefined;

  const btnD = { left: 0, top: 0, width: 80, height: 60, image: "" };
  const result: ThemeTitle = {
    background: bg,
    buttons: {
      begin: buttonToTheme(getSection(settings, "Title_Btn_Begin"), btnD),
      load: buttonToTheme(getSection(settings, "Title_Btn_Load"), btnD),
      team: buttonToTheme(getSection(settings, "Title_Btn_Team"), btnD),
      exit: buttonToTheme(getSection(settings, "Title_Btn_Exit"), btnD),
    },
  };
  const la = int2(sec.LeftAdjust, 0);
  const ta = int2(sec.TopAdjust, 0);
  if (la !== 0 || ta !== 0) result.offset = [la, ta];
  return result;
}

function convertSystem(settings: IniSettings): ThemeSystem {
  return {
    panel: panelToTheme(getSection(settings, "System"), "asf/ui/common/panel.asf"),
    saveLoadBtn: buttonToTheme(getSection(settings, "System_SaveLoad_Btn"), {
      left: 58, top: 86, width: 69, height: 64, image: "asf/ui/system/saveload.asf",
    }),
    optionBtn: buttonToTheme(getSection(settings, "System_Option_Btn"), {
      left: 58, top: 150, width: 69, height: 54, image: "asf/ui/system/option.asf",
    }),
    exitBtn: buttonToTheme(getSection(settings, "System_Exit_Btn"), {
      left: 58, top: 213, width: 69, height: 54, image: "asf/ui/system/quit.asf",
    }),
    returnBtn: buttonToTheme(getSection(settings, "System_Return_Btn"), {
      left: 58, top: 276, width: 69, height: 54, image: "asf/ui/system/return.asf",
    }),
  };
}

function convertState(settings: IniSettings): ThemeState {
  const d = { left: 144, width: 100, height: 12, color: "rgba(0,0,0,0.7)" } as const;
  return {
    panel: panelToTheme(getSection(settings, "State"), "asf/ui/common/panel5.asf"),
    level: textToTheme(getSection(settings, "State_Level"), { ...d, top: 219 }),
    exp: textToTheme(getSection(settings, "State_Exp"), { ...d, top: 234 }),
    levelUp: textToTheme(getSection(settings, "State_LevelUp"), { ...d, top: 249 }),
    life: textToTheme(getSection(settings, "State_Life"), { ...d, top: 264 }),
    thew: textToTheme(getSection(settings, "State_Thew"), { ...d, top: 279 }),
    mana: textToTheme(getSection(settings, "State_Mana"), { ...d, top: 294 }),
    attack: textToTheme(getSection(settings, "State_Attack"), { ...d, top: 309 }),
    defend: textToTheme(getSection(settings, "State_Defend"), { ...d, top: 324 }),
    evade: textToTheme(getSection(settings, "State_Evade"), { ...d, top: 339 }),
  };
}

function convertEquip(settings: IniSettings, prefix: string): ThemeEquip {
  const slotD = { width: 60, height: 75 };
  const slot = (name: string, dl: number, dt: number): [number, number] => {
    const s = getSection(settings, `${prefix}_${name}`);
    return [int2(s.Left, dl), int2(s.Top, dt)];
  };
  return {
    panel: panelToTheme(getSection(settings, prefix), "asf/ui/common/panel7.asf"),
    slotSize: [slotD.width, slotD.height],
    slots: {
      head: slot("Head", 47, 66),
      neck: slot("Neck", 193, 66),
      body: slot("Body", 121, 168),
      back: slot("Back", 193, 267),
      hand: slot("Hand", 193, 168),
      wrist: slot("Wrist", 47, 168),
      foot: slot("Foot", 47, 267),
    },
  };
}

function convertXiuLian(settings: IniSettings): ThemeXiuLian {
  return {
    panel: panelToTheme(getSection(settings, "XiuLian"), "asf/ui/common/panel6.asf"),
    magicImage: rectToTheme(getSection(settings, "XiuLian_Magic_Image"), {
      left: 52, top: 53, width: 30, height: 38,
    }),
    levelText: textToTheme(getSection(settings, "XiuLian_Level_Text"), {
      left: 126, top: 224, width: 80, height: 12, color: "rgba(0,0,0,0.8)",
    }),
    expText: textToTheme(getSection(settings, "XiuLian_Exp_Text"), {
      left: 126, top: 243, width: 80, height: 12, color: "rgba(0,0,0,0.8)",
    }),
    nameText: textToTheme(getSection(settings, "XiuLian_Name_Text"), {
      left: 105, top: 256, width: 200, height: 20, color: "rgba(88,32,32,0.9)",
    }),
    introText: textToTheme(getSection(settings, "XiuLian_Intro_Text"), {
      left: 75, top: 275, width: 145, height: 120, color: "rgba(47,32,88,0.9)",
    }),
  };
}

function convertGoods(settings: IniSettings): ThemeGoods {
  const sec = getSection(settings, "Goods");
  const listItems = getSection(settings, "Goods_List_Items");

  const result: ThemeGoods = {
    panel: panelToTheme(sec, "asf/ui/common/panel3.asf"),
    grid: detectGrid(listItems, "Item", {
      originX: 71, originY: 91, cellW: 60, cellH: 75, gapX: 5, gapY: 4,
    }),
    scrollBar: scrollBarToTheme(sec, {
      left: 294, top: 108, width: 28, height: 190, button: "asf/ui/option/slidebtn.asf",
    }),
    money: textToTheme(getSection(settings, "Goods_Money"), {
      left: 137, top: 363, width: 100, height: 12, color: "rgba(255,255,255,0.8)",
    }),
  };

  const gi = getSection(settings, "Goods_GoldIcon");
  if (gi.Image || gi.Left) {
    result.goldIcon = {
      pos: [int2(gi.Left, 65), int2(gi.Top, 230)],
      size: [int2(gi.Width, 26), int2(gi.Height, 13)],
      image: normalizeImagePath(gi.Image || "asf/ui/goods/gold.asf"),
    };
  }

  return result;
}

function convertMagics(settings: IniSettings): ThemeMagics {
  const sec = getSection(settings, "Magics");
  const listItems = getSection(settings, "Magics_List_Items");

  // 计算实际项数，验证到 count
  let count = 9;
  while (listItems[`Item_Left_${count + 1}`] !== undefined) count++;

  // 自动推断列数（新剑侠情缘 = 2列，月影传说/剑侠情缘 2 = 3列）
  const cols = detectCols(listItems, "Item", count, 3);

  return {
    panel: panelToTheme(sec, "asf/ui/common/panel2.asf"),
    grid: detectGrid(listItems, "Item", {
      originX: 71, originY: 91, cellW: 60, cellH: 75, gapX: 5, gapY: 4,
    }, count, cols),
    scrollBar: scrollBarToTheme(sec, {
      left: 294, top: 108, width: 28, height: 190, button: "asf/ui/option/slidebtn.asf",
    }),
  };
}

function convertMemo(settings: IniSettings): ThemeMemo {
  const slider = getSection(settings, "Memo_Slider");
  return {
    panel: panelToTheme(getSection(settings, "Memo"), "asf/ui/common/panel4.asf"),
    text: textToTheme(getSection(settings, "Memo_Text"), {
      left: 90, top: 155, width: 150, height: 180, charSpace: 1, lineSpace: 1, color: "rgba(40,25,15,0.8)",
    }),
    slider: {
      ...rectToTheme(slider, { left: 295, top: 108, width: 28, height: 190 }),
      imageBtn: normalizeImagePath(slider.Image_Btn || "asf/ui/option/slidebtn.asf"),
    },
  };
}

function convertDialog(settings: IniSettings): ThemeDialog {
  return {
    panel: panelToTheme(getSection(settings, "Dialog"), "asf/ui/dialog/panel.asf"),
    text: {
      ...textToTheme(getSection(settings, "Dialog_Txt"), {
        left: 65, top: 30, width: 310, height: 70, charSpace: -1, color: "rgba(0,0,0,0.8)",
      }),
      charSpace: -1,
    },
    selectA: textToTheme(getSection(settings, "Dialog_SelA"), {
      left: 65, top: 52, width: 310, height: 20, charSpace: 1, color: "rgba(0,0,255,0.8)",
    }),
    selectB: textToTheme(getSection(settings, "Dialog_SelB"), {
      left: 65, top: 74, width: 310, height: 20, charSpace: 1, color: "rgba(0,0,255,0.8)",
    }),
    portrait: rectToTheme(getSection(settings, "Dialog_Portrait"), {
      left: 5, top: -143, width: 200, height: 160,
    }),
  };
}

function convertSaveLoad(settings: IniSettings): ThemeSaveLoad {
  const textList = getSection(settings, "SaveLoad_Text_List");
  const messageLine = getSection(settings, "SaveLoad_Message_Line_Text");
  const textItems = textList.Text?.split("/") ?? [
    "进度一", "进度二", "进度三", "进度四", "进度五", "进度六", "进度七",
  ];

  const tlTheme = textToTheme(textList, {
    left: 135, top: 118, width: 80, height: 189, charSpace: 3, color: "rgba(91,31,27,0.8)",
  });

  const mlTheme = textToTheme(messageLine, {
    left: 0, top: 440, width: 640, height: 40, color: "rgba(255,215,0,0.8)",
  });

  return {
    panel: panelToTheme(getSection(settings, "SaveLoad"), "asf/ui/saveload/panel.asf"),
    snapshot: rectToTheme(getSection(settings, "Save_Snapshot"), {
      left: 256, top: 94, width: 267, height: 200,
    }),
    textList: {
      text: textItems,
      pos: tlTheme.pos,
      size: tlTheme.size,
      ...(tlTheme.charSpace ? { charSpace: tlTheme.charSpace } : {}),
      ...(tlTheme.lineSpace ? { lineSpace: tlTheme.lineSpace } : {}),
      itemHeight: int2(textList.ItemHeight, 25),
      ...(tlTheme.color && tlTheme.color !== "rgba(91,31,27,0.8)" ? { color: tlTheme.color } : {}),
      selectedColor: parseColor(textList.SelectedColor, "rgba(102,73,212,0.8)"),
      sound: textList.Sound || "界-浏览.wav",
    },
    loadBtn: buttonToTheme(getSection(settings, "SaveLoad_Load_Btn"), {
      left: 248, top: 355, width: 64, height: 72, image: "asf/ui/saveload/btnLoad.asf", sound: "界-大按钮.wav",
    }),
    saveBtn: buttonToTheme(getSection(settings, "SaveLoad_Save_Btn"), {
      left: 366, top: 355, width: 64, height: 72, image: "asf/ui/saveload/btnSave.asf", sound: "界-大按钮.wav",
    }),
    exitBtn: buttonToTheme(getSection(settings, "SaveLoad_Exit_Btn"), {
      left: 464, top: 355, width: 64, height: 72, image: "asf/ui/saveload/btnExit.asf", sound: "界-大按钮.wav",
    }),
    saveTimeText: textToTheme(getSection(settings, "SaveLoad_Save_Time_Text"), {
      left: 254, top: 310, width: 350, height: 30, charSpace: 1, color: "rgba(182,219,189,0.7)",
    }),
    messageLine: {
      ...mlTheme,
      align: int2(messageLine.Align, 1),
    },
  };
}

function convertMessage(settings: IniSettings): ThemeMessage {
  return {
    panel: panelToTheme(getSection(settings, "Message"), "asf/ui/message/msgbox.asf"),
    text: textToTheme(getSection(settings, "Message_Text"), {
      left: 46, top: 32, width: 148, height: 50, color: "rgba(155,34,22,0.8)",
    }),
  };
}

function convertNpcInfoShow(settings: IniSettings): ThemeNpcInfoShow {
  const s = getSection(settings, "NpcInfoShow");
  const result: ThemeNpcInfoShow = {
    size: [int2(s.Width, 300), int2(s.Height, 25)],
  };
  const la = int2(s.LeftAdjust, 0);
  const ta = int2(s.TopAdjust, 50);
  if (la !== 0 || ta !== 0) result.offset = [la, ta];
  return result;
}

function convertLittleMap(settings: IniSettings): ThemeLittleMap {
  const snd = "界-浏览.wav";
  return {
    panel: panelToTheme(getSection(settings, "LittleMap"), "asf/ui/littlemap/panel.asf"),
    leftBtn: mapBtnToTheme(getSection(settings, "LittleMap_Left_Btn"), {
      left: 437, top: 379, image: "asf/ui/littlemap/btnleft.asf", sound: snd,
    }),
    rightBtn: mapBtnToTheme(getSection(settings, "LittleMap_Right_Btn"), {
      left: 464, top: 379, image: "asf/ui/littlemap/btnright.asf", sound: snd,
    }),
    upBtn: mapBtnToTheme(getSection(settings, "LittleMap_Up_Btn"), {
      left: 448, top: 368, image: "asf/ui/littlemap/btnup.asf", sound: snd,
    }),
    downBtn: mapBtnToTheme(getSection(settings, "LittleMap_Down_Btn"), {
      left: 448, top: 395, image: "asf/ui/littlemap/btndown.asf", sound: snd,
    }),
    closeBtn: mapBtnToTheme(getSection(settings, "LittleMap_Close_Btn"), {
      left: 448, top: 379, image: "asf/ui/littlemap/btnclose.asf", sound: snd,
    }),
    mapNameText: mapTextToTheme(getSection(settings, "LittleMap_Map_Name_Line_Text"), {
      left: 210, top: 92, width: 220, height: 30, color: "rgba(76,56,48,0.8)", align: 1,
    }),
    bottomTipText: mapTextToTheme(getSection(settings, "LittleMap_Bottom_Tip_Line_Text"), {
      left: 160, top: 370, width: 260, height: 30, color: "rgba(76,56,48,0.8)", align: 0,
    }),
    messageTipText: mapTextToTheme(getSection(settings, "LittleMap_Message_Tip_Line_Text"), {
      left: 160, top: 370, width: 260, height: 30, color: "rgba(200,0,0,0.8)", align: 2,
    }),
  };
}

function convertBuySell(settings: IniSettings): ThemeBuySell {
  const sec = getSection(settings, "BuySell");
  const listItems = getSection(settings, "BuySell_List_Items");
  return {
    panel: panelToTheme(sec, "asf/ui/common/panel8.asf"),
    grid: detectGrid(listItems, "Item", {
      originX: 55, originY: 91, cellW: 60, cellH: 75, gapX: 5, gapY: 4,
    }),
    scrollBar: scrollBarToTheme(sec, {
      left: 271, top: 108, width: 28, height: 190, button: "asf/ui/option/slidebtn.asf",
    }),
    closeBtn: {
      pos: [int2(sec.CloseLeft, 117), int2(sec.CloseTop, 354)],
      image: normalizeImagePath(sec.CloseImage || "asf/ui/buysell/CloseBtn.asf"),
      ...(sec.CloseSound && sec.CloseSound !== "界-大按钮.wav" ? { sound: sec.CloseSound } : {}),
    },
  };
}

const BOTTOM_BUTTON_SECTIONS = [
  "Bottom_State_Btn", "Bottom_Equip_Btn", "Bottom_XiuLian_Btn",
  "Bottom_Goods_Btn", "Bottom_Magic_Btn", "Bottom_Memo_Btn", "Bottom_System_Btn",
] as const;

/** 面板中没有按钮定义时，不输出该按钮（避免展示错误游戏的按钮） */
function convertBottom(settings: IniSettings): ThemeBottom {
  const bottomItems = getSection(settings, "Bottom_Items");

  // 快捷栏: 读全部 8 个 slot 的独立坐标（物品槽 1-3 / 武功槽 4-8 跨跳不规则间距，不能用单一网格）
  const items: ThemeButton[] = [];
  for (let i = 1; i <= 8; i++) {
    const l = bottomItems[`Item_Left_${i}`];
    const t = bottomItems[`Item_Top_${i}`];
    const w = bottomItems[`Item_Width_${i}`];
    const h = bottomItems[`Item_Height_${i}`];
    const img = bottomItems[`Item_Image_${i}`] ?? "";
    if (l !== undefined) {
      items.push({
        pos: [int2(l, 7 + (i - 1) * 37), int2(t, 20)],
        size: [int2(w, 30), int2(h, 40)],
        image: normalizeImagePath(img),
      });
    }
  }
  // 如果没有任何 item，用月影传说后备布局
  if (items.length === 0) {
    for (let i = 0; i < 8; i++) {
      items.push({ pos: [7 + i * 37, 20], size: [30, 40], image: "" });
    }
  }

  // 按钮：只读实际有定义的按钮节
  const buttons: ThemeButton[] = [];
  for (let i = 0; i < BOTTOM_BUTTON_SECTIONS.length; i++) {
    const sec = getSection(settings, BOTTOM_BUTTON_SECTIONS[i]);
    // 只有当该游戏实际有 Image 项时才输出按钮
    if (sec.Image) {
      buttons.push({
        pos: [int2(sec.Left, 0), int2(sec.Top, 0)],
        size: [int2(sec.Width, 30), int2(sec.Height, 30)],
        image: normalizeImagePath(sec.Image),
        ...(sec.Sound ? { sound: sec.Sound } : {}),
      });
    }
  }

  return {
    panel: panelToTheme(getSection(settings, "Bottom"), "asf/ui/bottom/window.asf"),
    items,
    buttons,
  };
}

function convertBottomState(settings: IniSettings): ThemeBottomState {
  return {
    panel: panelToTheme(getSection(settings, "BottomState"), "asf/ui/column/panel9.asf"),
    life: barToTheme(getSection(settings, "BottomState_Life"), {
      image: "asf/ui/column/ColLife.asf", left: 11, top: 22, width: 48, height: 46,
    }),
    thew: barToTheme(getSection(settings, "BottomState_Thew"), {
      image: "asf/ui/column/ColThew.asf", left: 59, top: 22, width: 48, height: 46,
    }),
    mana: barToTheme(getSection(settings, "BottomState_Mana"), {
      image: "asf/ui/column/ColMana.asf", left: 113, top: 22, width: 48, height: 46,
    }),
  };
}

const TOP_BUTTON_SECTIONS = [
  "Top_State_Btn", "Top_Equip_Btn", "Top_XiuLian_Btn",
  "Top_Goods_Btn", "Top_Magic_Btn", "Top_Memo_Btn", "Top_System_Btn",
] as const;

const TOP_BUTTON_DEFAULTS: {
  left: number; top: number; width: number; height: number; image: string; sound: string;
}[] = [
  { left: 52, top: 0, width: 19, height: 19, image: "asf/ui/top/BtnState.asf", sound: "界-大按钮.wav" },
  { left: 80, top: 0, width: 19, height: 19, image: "asf/ui/top/BtnEquip.asf", sound: "界-大按钮.wav" },
  { left: 107, top: 0, width: 19, height: 19, image: "asf/ui/top/BtnXiuLian.asf", sound: "界-大按钮.wav" },
  { left: 135, top: 0, width: 19, height: 19, image: "asf/ui/top/BtnGoods.asf", sound: "界-大按钮.wav" },
  { left: 162, top: 0, width: 19, height: 19, image: "asf/ui/top/BtnMagic.asf", sound: "界-大按钮.wav" },
  { left: 189, top: 0, width: 19, height: 19, image: "asf/ui/top/BtnNotes.asf", sound: "界-大按钮.wav" },
  { left: 216, top: 0, width: 19, height: 19, image: "asf/ui/top/BtnOption.asf", sound: "界-大按钮.wav" },
];

function convertTop(settings: IniSettings): ThemeTop {
  const buttons = TOP_BUTTON_SECTIONS.map((sec, i) =>
    buttonToTheme(getSection(settings, sec), TOP_BUTTON_DEFAULTS[i]),
  );
  return {
    panel: panelToTheme(getSection(settings, "Top"), "asf/ui/top/window.asf"),
    buttons,
  };
}

function convertTooltip2(settings: IniSettings): ThemeTooltip2 {
  const sec = getSection(settings, "ToolTip_Type2");
  const result: ThemeTooltip2 = {};
  const w = int2(sec.Width, 288);
  if (w !== 288) result.width = w;
  const hp = int2(sec.TextHorizontalPadding, 6);
  if (hp !== 6) result.textHorizontalPadding = hp;
  const vp = int2(sec.TextVerticalPadding, 4);
  if (vp !== 4) result.textVerticalPadding = vp;

  // 颜色：仅在非默认时存储
  const colors: [keyof ThemeTooltip2, string, string][] = [
    ["backgroundColor", sec.BackgroundColor, "0,0,0,160"],
    ["magicNameColor", sec.MagicNameColor, "225,225,110,160"],
    ["magicLevelColor", sec.MagicLevelColor, "255,255,255,160"],
    ["magicIntroColor", sec.MagicIntroColor, "255,255,255,160"],
    ["goodNameColor", sec.GoodNameColor, "245,233,171,160"],
    ["goodPriceColor", sec.GoodPriceColor, "255,255,255,160"],
    ["goodUserColor", sec.GoodUserColor, "255,255,255,160"],
    ["goodPropertyColor", sec.GoodPropertyColor, "255,255,255,160"],
    ["goodIntroColor", sec.GoodIntroColor, "255,255,255,160"],
  ];
  for (const [key, val, def] of colors) {
    if (val && val !== def) {
      (result as Record<string, string>)[key] = colorToCSS(parseIniColor(val));
    }
  }
  return result;
}

function convertTooltip1(settings: IniSettings): ThemeTooltip1 {
  const sec = getSection(settings, "ToolTip_Type1");
  const result: ThemeTooltip1 = {
    itemImage: rectToTheme(getSection(settings, "ToolTip_Type1_Item_Image"), {
      left: 132, top: 47, width: 60, height: 75,
    }),
    name: textToTheme(getSection(settings, "ToolTip_Type1_Item_Name"), {
      left: 67, top: 191, width: 90, height: 20, color: "rgb(102,73,212)",
    }),
    priceOrLevel: textToTheme(getSection(settings, "ToolTip_Type1_Item_PriceOrLevel"), {
      left: 160, top: 191, width: 88, height: 20, color: "rgb(91,31,27)",
    }),
    effect: textToTheme(getSection(settings, "ToolTip_Type1_Item_Effect"), {
      left: 67, top: 210, width: 196, height: 40, color: "rgb(52,21,14)",
    }),
    magicIntro: textToTheme(getSection(settings, "ToolTip_Type1_Item_Magic_Intro"), {
      left: 67, top: 255, width: 196, height: 80, color: "rgb(52,21,14)",
    }),
    goodIntro: textToTheme(getSection(settings, "ToolTip_Type1_Item_Good_Intro"), {
      left: 67, top: 255, width: 196, height: 80, color: "rgb(52,21,14)",
    }),
  };
  const img = normalizeImagePath(sec.Image ?? "asf/ui/common/tipbox.asf");
  if (img !== "asf/ui/common/tipbox.asf") result.image = img;
  return result;
}

// ============================================
// 主入口
// ============================================

/**
 * 将 INI 文本内容转换为紧凑 UiTheme JSON
 */
export function convertIniToTheme(iniContent: string): UiTheme {
  const settings = parseIni(iniContent);

  const toolTipSec = getSection(settings, "ToolTip_Use_Type");
  const useType = int2(toolTipSec.UseType, 1);

  return {
    title: convertTitle(settings),
    saveLoad: convertSaveLoad(settings),
    system: convertSystem(settings),
    state: convertState(settings),
    equip: convertEquip(settings, "Equip"),
    npcEquip: convertEquip(settings, "NpcEquip"),
    xiuLian: convertXiuLian(settings),
    goods: convertGoods(settings),
    magics: convertMagics(settings),
    memo: convertMemo(settings),
    dialog: convertDialog(settings),
    message: convertMessage(settings),
    npcInfoShow: convertNpcInfoShow(settings),
    littleMap: convertLittleMap(settings),
    buySell: convertBuySell(settings),
    bottom: convertBottom(settings),
    bottomState: convertBottomState(settings),
    top: convertTop(settings),
    tooltipMode: useType === 2 ? 2 : 1,
    tooltip1: convertTooltip1(settings),
    tooltip2: convertTooltip2(settings),
  };
}

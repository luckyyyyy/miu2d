/**
 * 统一资源导入弹窗
 *
 * 拖拽整个 resources 文件夹，一次性导入所有数据：
 * NPC、NPC资源、Object、Object资源、武功、物品、商店、玩家、等级、对话、头像映射、场景
 *
 * 支持勾选要导入的模块，导入前先清空选中模块的现有数据。
 */

import { trpc } from "@miu2d/shared";
import type { SceneData } from "@miu2d/types";
import {
  classifyScriptFile,
  parseIniContent,
  parseMapFileName,
  parseNpcEntries,
  parseObjEntries,
} from "@miu2d/types";
import { useCallback, useMemo, useState } from "react";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";

// ============= 类型定义 =============

/** 导入模块 key */
type ImportModuleKey =
  | "magic"
  | "npc"
  | "obj"
  | "goods"
  | "shop"
  | "player"
  | "level"
  | "talk"
  | "talkPortrait"
  | "scene";

interface ImportModuleMeta {
  key: ImportModuleKey;
  label: string;
  icon: string;
  description: string;
}

const ALL_MODULES: ImportModuleMeta[] = [
  { key: "magic", label: "武功", icon: "⚔️", description: "ini/magic/ 目录下的武功配置" },
  { key: "npc", label: "NPC", icon: "🧙", description: "ini/npc/ 和 ini/npcres/ 目录" },
  { key: "obj", label: "物体", icon: "📦", description: "ini/obj/ 和 ini/objres/ 目录" },
  { key: "goods", label: "物品", icon: "🎒", description: "ini/goods/ 目录下的物品配置" },
  { key: "shop", label: "商店", icon: "🏪", description: "ini/buy/ 目录下的商店配置" },
  { key: "player", label: "玩家", icon: "🎮", description: "save/game/PlayerX.ini 等玩家存档" },
  { key: "level", label: "等级", icon: "📊", description: "ini/level/ 或 save/game/ 下等级配置" },
  { key: "talk", label: "对话", icon: "💬", description: "content/TalkIndex.txt 对话数据" },
  {
    key: "talkPortrait",
    label: "头像",
    icon: "🖼️",
    description: "ini/ui/dialog/HeadFile.ini 头像映射",
  },
  { key: "scene", label: "场景", icon: "🗺️", description: "map/*.mmf + script/ + save/ 场景数据" },
];

/** 每个模块解析出的文件数据 */
interface ParsedModuleData {
  magic: { fileName: string; iniContent: string; attackFileContent?: string; userType?: "player" | "npc" }[];
  npc: { fileName: string; type: "npc" | "resource"; iniContent?: string; npcResContent?: string }[];
  obj: { fileName: string; type?: "obj" | "resource"; iniContent?: string; objResContent?: string }[];
  goods: { fileName: string; iniContent: string }[];
  shop: { fileName: string; iniContent: string }[];
  player: { fileName: string; iniContent: string; magicIniContent?: string; goodsIniContent?: string }[];
  level: { fileName: string; userType: "player" | "npc"; iniContent: string }[];
  talk: string | null;
  talkPortrait: string | null;
  scene: ParsedScene[];
}

interface ParsedScene {
  key: string;
  name: string;
  mapFileName: string;
  mmfBase64: string;
  data: SceneData;
  trapOverrides?: Record<string, string>;
}

/** 每个模块导入的结果 */
interface ModuleImportResult {
  module: ImportModuleKey;
  success: number;
  failed: number;
  errors: string[];
}

// ============= 文件读取工具 =============

interface DroppedFileEntry {
  relativePath: string;
  file: File;
}

async function readDroppedDirectory(
  entry: FileSystemEntry,
  basePath: string
): Promise<DroppedFileEntry[]> {
  const results: DroppedFileEntry[] = [];
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve) => fileEntry.file(resolve));
    results.push({ relativePath: basePath + file.name, file });
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    let allEntries: FileSystemEntry[] = [];
    let batch: FileSystemEntry[];
    do {
      batch = await new Promise<FileSystemEntry[]>((resolve) => reader.readEntries(resolve));
      allEntries = allEntries.concat(batch);
    } while (batch.length > 0);
    for (const sub of allEntries) {
      const subResults = await readDroppedDirectory(sub, `${basePath}${entry.name}/`);
      results.push(...subResults);
    }
  }
  return results;
}

/**
 * 规范化路径：剥离用户拖入的根文件夹名
 */
function normalize(path: string): string {
  let p = path.replace(/^\//, "");
  const firstSlash = p.indexOf("/");
  if (firstSlash > 0) {
    const rest = p.substring(firstSlash + 1);
    const secondDir = rest.split("/")[0]?.toLowerCase();
    const knownSubDirs = new Set([
      "map",
      "script",
      "save",
      "ini",
      "mpc",
      "asf",
      "content",
      "music",
      "sound",
    ]);
    if (knownSubDirs.has(secondDir)) {
      p = rest;
    }
  }
  return p;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ============= 解析逻辑 =============

/** 从 npc ini 内容中解析 NpcIni 字段值 */
function parseNpcIniField(content: string): string | null {
  const match = content.match(/^\s*NpcIni\s*=\s*(.+?)\s*$/im);
  return match ? match[1].toLowerCase() : null;
}

/** 从 obj ini 内容中解析 ObjFile 字段值 */
function parseObjFileField(content: string): string | null {
  const match = content.match(/^\s*ObjFile\s*=\s*(.+?)\s*$/im);
  return match ? match[1].toLowerCase() : null;
}

/** 从 magic ini 查找 AttackFile 引用 */
function parseAttackFileField(content: string): string | null {
  const match = content.match(/^\s*AttackFile\s*=\s*(.+?)\s*$/im);
  return match ? match[1].trim() : null;
}

/** 检测武功类型：player 或 npc */
function detectMagicUserType(
  content: string,
  filePath: string
): "player" | "npc" {
  if (filePath.toLowerCase().includes("player")) return "player";
  if (/^\[Level\d+\]/im.test(content)) return "player";
  return "npc";
}

/**
 * 解析 Traps.ini 内容
 */
function parseTrapsIni(content: string): Map<string, Map<number, string>> {
  const result = new Map<string, Map<number, string>>();
  let section: string | null = null;
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      section = trimmed.slice(1, -1).toLowerCase();
      continue;
    }
    if (section) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const idx = parseInt(trimmed.slice(0, eqIdx).trim(), 10);
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!Number.isNaN(idx)) {
          if (!result.has(section)) result.set(section, new Map());
          result.get(section)!.set(idx, val);
        }
      }
    }
  }
  return result;
}

/**
 * 解析整个 resources 文件夹，提取所有模块的数据
 */
async function parseResourcesFolder(
  files: DroppedFileEntry[],
  onProgress: (text: string) => void
): Promise<ParsedModuleData> {
  const data: ParsedModuleData = {
    magic: [],
    npc: [],
    obj: [],
    goods: [],
    shop: [],
    player: [],
    level: [],
    talk: null,
    talkPortrait: null,
    scene: [],
  };

  // 按路径分类文件
  const byNorm = files.map((f) => ({
    ...f,
    norm: normalize(f.relativePath).toLowerCase(),
    normOrigCase: normalize(f.relativePath),
  }));

  onProgress("分类文件...");

  // ===== 1. 武功 (ini/magic/) =====
  const magicFiles = new Map<string, { file: File; norm: string }>();
  for (const f of byNorm) {
    if (f.norm.startsWith("ini/magic/") && f.file.name.toLowerCase().endsWith(".ini")) {
      magicFiles.set(f.file.name.toLowerCase(), { file: f.file, norm: f.normOrigCase });
    }
  }

  if (magicFiles.size > 0) {
    onProgress(`解析武功... (${magicFiles.size} 个文件)`);
    // 读取所有内容
    const contentMap = new Map<string, string>();
    for (const [key, { file }] of magicFiles) {
      contentMap.set(key, await file.text());
    }
    // 识别 AttackFile 引用
    const attackFileKeys = new Set<string>();
    for (const [, content] of contentMap) {
      const ref = parseAttackFileField(content);
      if (ref) attackFileKeys.add(ref.toLowerCase());
    }
    // 构建导入项
    for (const [key, { norm }] of magicFiles) {
      const content = contentMap.get(key)!;
      const attackRef = parseAttackFileField(content);
      const attackContent = attackRef ? contentMap.get(attackRef.toLowerCase()) : undefined;
      // 跳过纯 AttackFile（被其他武功引用的飞行文件）
      if (attackFileKeys.has(key)) continue;
      data.magic.push({
        fileName: key,
        iniContent: content,
        attackFileContent: attackContent,
        userType: detectMagicUserType(content, norm),
      });
    }
  }

  // ===== 2. NPC (ini/npc/ + ini/npcres/) =====
  const npcFiles = new Map<string, { content: string; fileName: string }>();
  const npcResFiles = new Map<string, { content: string; fileName: string }>();

  for (const f of byNorm) {
    if (!f.file.name.toLowerCase().endsWith(".ini")) continue;
    if (f.norm.startsWith("ini/npcres/")) {
      const content = await f.file.text();
      npcResFiles.set(f.file.name.toLowerCase(), { content, fileName: f.file.name });
    } else if (f.norm.startsWith("ini/npc/")) {
      const content = await f.file.text();
      npcFiles.set(f.file.name.toLowerCase(), { content, fileName: f.file.name });
    }
  }

  if (npcFiles.size > 0 || npcResFiles.size > 0) {
    onProgress(`解析 NPC... (${npcFiles.size} NPC + ${npcResFiles.size} 资源)`);
    // NPC 文件 — 自动关联同名外观
    for (const [, info] of npcFiles) {
      const ref = parseNpcIniField(info.content);
      const resInfo = ref ? npcResFiles.get(ref) : null;
      data.npc.push({
        fileName: info.fileName,
        type: "npc",
        iniContent: info.content,
        npcResContent: resInfo?.content,
      });
    }
    // 所有 npcres 文件也作为独立资源导入
    for (const [, info] of npcResFiles) {
      data.npc.push({ fileName: info.fileName, type: "resource", npcResContent: info.content });
    }
  }

  // ===== 3. Object (ini/obj/ + ini/objres/) =====
  const objFiles = new Map<string, { content: string; fileName: string }>();
  const objResFiles = new Map<string, { content: string; fileName: string }>();

  for (const f of byNorm) {
    if (!f.file.name.toLowerCase().endsWith(".ini")) continue;
    if (f.norm.startsWith("ini/objres/")) {
      const content = await f.file.text();
      objResFiles.set(f.file.name.toLowerCase(), { content, fileName: f.file.name });
    } else if (f.norm.startsWith("ini/obj/")) {
      const content = await f.file.text();
      objFiles.set(f.file.name.toLowerCase(), { content, fileName: f.file.name });
    }
  }

  if (objFiles.size > 0 || objResFiles.size > 0) {
    onProgress(`解析 Object... (${objFiles.size} OBJ + ${objResFiles.size} 资源)`);
    const usedObjResKeys = new Set<string>();
    for (const [, info] of objFiles) {
      const ref = parseObjFileField(info.content);
      const resInfo = ref ? objResFiles.get(ref) : null;
      if (ref && resInfo) usedObjResKeys.add(ref);
      data.obj.push({
        fileName: info.fileName,
        iniContent: info.content,
        objResContent: resInfo?.content,
      });
    }
    // 添加独立的 objres 文件（没有被任何 obj 的 ObjFile= 引用的）
    for (const [key, info] of objResFiles) {
      if (!usedObjResKeys.has(key)) {
        data.obj.push({ fileName: info.fileName, type: "resource", objResContent: info.content });
      }
    }
  }

  // ===== 4. 物品 (ini/goods/) =====
  for (const f of byNorm) {
    if (f.norm.startsWith("ini/goods/") && f.file.name.toLowerCase().endsWith(".ini")) {
      const content = await f.file.text();
      data.goods.push({ fileName: f.file.name, iniContent: content });
    }
  }
  if (data.goods.length > 0) {
    onProgress(`解析物品... (${data.goods.length} 个文件)`);
  }

  // ===== 5. 商店 (ini/buy/) =====
  for (const f of byNorm) {
    if (f.norm.startsWith("ini/buy/") && f.file.name.toLowerCase().endsWith(".ini")) {
      const content = await f.file.text();
      data.shop.push({ fileName: f.file.name, iniContent: content });
    }
  }
  if (data.shop.length > 0) {
    onProgress(`解析商店... (${data.shop.length} 个文件)`);
  }

  // ===== 6. 玩家 (save/game/PlayerX.ini + MagicX.ini + GoodsX.ini 或 ini/save/) =====
  const playerMap = new Map<
    number,
    { player?: string; magic?: string; goods?: string; fileName?: string }
  >();

  for (const f of byNorm) {
    if (!f.file.name.toLowerCase().endsWith(".ini")) continue;
    const inSaveGame = f.norm.startsWith("save/game/") || f.norm.startsWith("ini/save/");
    if (!inSaveGame) continue;

    const fileName = f.file.name;
    const playerMatch = fileName.match(/^Player(\d+)\.ini$/i);
    const magicMatch = fileName.match(/^Magic(\d+)\.ini$/i);
    const goodsMatch = fileName.match(/^Goods(\d+)\.ini$/i);

    if (playerMatch) {
      const idx = parseInt(playerMatch[1], 10);
      const content = await f.file.text();
      const existing = playerMap.get(idx) ?? {};
      existing.player = content;
      existing.fileName = fileName;
      playerMap.set(idx, existing);
    } else if (magicMatch) {
      const idx = parseInt(magicMatch[1], 10);
      const content = await f.file.text();
      const existing = playerMap.get(idx) ?? {};
      existing.magic = content;
      playerMap.set(idx, existing);
    } else if (goodsMatch) {
      const idx = parseInt(goodsMatch[1], 10);
      const content = await f.file.text();
      const existing = playerMap.get(idx) ?? {};
      existing.goods = content;
      playerMap.set(idx, existing);
    }
  }

  // 按玩家索引排序
  const sortedPlayerEntries = Array.from(playerMap.entries()).sort((a, b) => a[0] - b[0]);
  for (const [, entry] of sortedPlayerEntries) {
    if (entry.player && entry.fileName) {
      data.player.push({
        fileName: entry.fileName,
        iniContent: entry.player,
        magicIniContent: entry.magic,
        goodsIniContent: entry.goods,
      });
    }
  }
  if (data.player.length > 0) {
    onProgress(`解析玩家... (${data.player.length} 个角色)`);
  }

  // ===== 7. 等级配置 =====
  // 先从 ini/level/ 读取，回退到 save/game/ 中的 Level-*.ini 或其他目录
  for (const f of byNorm) {
    if (!f.file.name.toLowerCase().endsWith(".ini")) continue;
    const isLevel =
      f.norm.startsWith("ini/level/") ||
      (f.norm.startsWith("save/game/") && f.file.name.toLowerCase().includes("level"));
    if (!isLevel) continue;
    // 跳过 MagicExp.ini
    if (f.file.name.toLowerCase().includes("magicexp")) continue;

    const content = await f.file.text();
    const isNpc =
      f.file.name.toLowerCase().includes("npc") || f.file.name.toLowerCase().includes("hard");
    data.level.push({
      fileName: f.file.name,
      userType: isNpc ? "npc" : "player",
      iniContent: content,
    });
  }
  if (data.level.length > 0) {
    onProgress(`解析等级配置... (${data.level.length} 个文件)`);
  }

  // ===== 8. 对话 TalkIndex.txt =====
  for (const f of byNorm) {
    if (f.norm === "content/talkindex.txt" || f.file.name.toLowerCase() === "talkindex.txt") {
      data.talk = await f.file.text();
      onProgress("找到对话数据 TalkIndex.txt");
      break;
    }
  }

  // ===== 9. 头像映射 HeadFile.ini =====
  for (const f of byNorm) {
    if (
      f.norm === "ini/ui/dialog/headfile.ini" ||
      f.file.name.toLowerCase() === "headfile.ini"
    ) {
      data.talkPortrait = await f.file.text();
      onProgress("找到头像映射 HeadFile.ini");
      break;
    }
  }

  // ===== 10. 场景 (map/*.mmf + script/map/ + save/game/*.npc/*.obj + Traps.ini) =====
  // 先读取 Traps.ini
  let allTraps = new Map<string, Map<number, string>>();
  const trapsFile = byNorm.find(
    (f) => f.norm === "save/game/traps.ini" || f.norm === "ini/save/traps.ini"
  );
  if (trapsFile) {
    const content = await trapsFile.file.text();
    allTraps = parseTrapsIni(content);
  }

  const sceneMap = new Map<string, ParsedScene>();

  // MMF 文件
  const mmfFiles = byNorm.filter(
    (f) => f.norm.startsWith("map/") && f.file.name.toLowerCase().endsWith(".mmf")
  );

  for (const mmfFile of mmfFiles) {
    const { key, name } = parseMapFileName(mmfFile.file.name);
    const mmfBase64 = await fileToBase64(mmfFile.file);

    const trapsForScene = allTraps.get(key.toLowerCase());
    const trapOverrides: Record<string, string> | undefined =
      trapsForScene && trapsForScene.size > 0
        ? Object.fromEntries(
            Array.from(trapsForScene.entries()).map(([idx, path]) => [String(idx), path])
          )
        : undefined;

    sceneMap.set(key.toLowerCase(), {
      key,
      name,
      mapFileName: mmfFile.file.name,
      mmfBase64,
      data: {},
      trapOverrides,
    });
  }

  // 脚本文件
  const scriptFiles = byNorm.filter(
    (f) => f.norm.startsWith("script/map/") && f.file.name.toLowerCase().endsWith(".txt")
  );
  for (const sf of scriptFiles) {
    const parts = sf.normOrigCase.split("/");
    if (parts.length < 4) continue;
    const sceneKey = parts[2].toLowerCase();
    const fileName = parts[parts.length - 1];
    const scene = sceneMap.get(sceneKey);
    if (!scene) continue;
    const content = await sf.file.text();
    const kind = classifyScriptFile(fileName);
    if (kind === "trap") {
      if (!scene.data.traps) scene.data.traps = {};
      scene.data.traps[fileName] = content;
    } else {
      if (!scene.data.scripts) scene.data.scripts = {};
      scene.data.scripts[fileName] = content;
    }
  }

  // NPC/OBJ 存档文件
  // 引擎只从 ini/save/ 读取设计时数据，save/game/ 是运行时存档状态。
  // 优先使用 ini/save/ 的文件；仅当 ini/save/ 中不存在时才回退到 save/game/。
  const saveFiles = byNorm.filter((f) => {
    const inSaveDir = f.norm.startsWith("save/game/") || f.norm.startsWith("ini/save/");
    return (
      inSaveDir &&
      (f.file.name.toLowerCase().endsWith(".npc") || f.file.name.toLowerCase().endsWith(".obj"))
    );
  });

  const saveFileSourceMap = new Map<string, "ini/save" | "save/game">();

  for (const sf of saveFiles) {
    const fromIniSave = /^ini\/save\//i.test(sf.norm);
    const content = await sf.file.text();
    const sections = parseIniContent(content);

    const headSection = sections.Head || sections.head;
    if (!headSection) continue;
    const mapValue = headSection.Map || headSection.map;
    if (!mapValue) continue;

    const mapKey = mapValue.replace(/\.(map|mmf)$/i, "");
    const scene = sceneMap.get(mapKey.toLowerCase());
    if (!scene) continue;

    const fileName = sf.file.name;
    const dedupeKey = `${mapKey.toLowerCase()}::${fileName.toLowerCase()}`;
    const prevSource = saveFileSourceMap.get(dedupeKey);

    // 如果已有 ini/save 版本，跳过 save/game 的同名文件
    if (prevSource === "ini/save" && !fromIniSave) continue;
    saveFileSourceMap.set(dedupeKey, fromIniSave ? "ini/save" : "save/game");

    if (fileName.toLowerCase().endsWith(".npc")) {
      const entries = parseNpcEntries(sections);
      if (!scene.data.npc) scene.data.npc = {};
      scene.data.npc[fileName] = { key: fileName, entries };
    } else if (fileName.toLowerCase().endsWith(".obj")) {
      const entries = parseObjEntries(sections);
      if (!scene.data.obj) scene.data.obj = {};
      scene.data.obj[fileName] = { key: fileName, entries };
    }
  }

  data.scene = Array.from(sceneMap.values());
  if (data.scene.length > 0) {
    onProgress(`解析场景... (${data.scene.length} 个地图)`);
  }

  onProgress("解析完成");
  return data;
}

// ============= 组件 =============

export function ImportAllModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id;

  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedModuleData | null>(null);
  const [parseProgress, setParseProgress] = useState("");

  // 勾选要导入的模块
  const [selectedModules, setSelectedModules] = useState<Set<ImportModuleKey>>(
    new Set(ALL_MODULES.map((m) => m.key))
  );

  // 导入状态
  const [isImporting, setIsImporting] = useState(false);
  const [importStep, setImportStep] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [results, setResults] = useState<ModuleImportResult[] | null>(null);

  // tRPC mutations
  const clearNpc = trpc.npc.clearAll.useMutation();
  const clearObj = trpc.obj.clearAll.useMutation();
  const clearGoods = trpc.goods.clearAll.useMutation();
  const clearShop = trpc.shop.clearAll.useMutation();
  const clearMagic = trpc.magic.clearAll.useMutation();
  const clearPlayer = trpc.player.clearAll.useMutation();
  const clearLevel = trpc.level.clearAll.useMutation();
  const clearTalk = trpc.talk.clearAll.useMutation();
  const clearTalkPortrait = trpc.talkPortrait.clearAll.useMutation();
  const clearScene = trpc.scene.clearAll.useMutation();

  const importNpc = trpc.npc.batchImportFromIni.useMutation();
  const importObj = trpc.obj.batchImportFromIni.useMutation();
  const importGoods = trpc.goods.batchImportFromIni.useMutation();
  const importShop = trpc.shop.batchImportFromIni.useMutation();
  const importMagic = trpc.magic.batchImportFromIni.useMutation();
  const importPlayer = trpc.player.batchImportFromIni.useMutation();
  const importLevel = trpc.level.importFromIni.useMutation();
  const importTalk = trpc.talk.importFromTxt.useMutation();
  const importPortrait = trpc.talkPortrait.importFromIni.useMutation();
  const importScene = trpc.scene.importScene.useMutation();

  const toggleModule = useCallback((key: ImportModuleKey) => {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedModules((prev) => {
      if (prev.size === ALL_MODULES.length) return new Set();
      return new Set(ALL_MODULES.map((m) => m.key));
    });
  }, []);

  /** 计算各模块数据量 */
  const moduleCounts = useMemo(() => {
    if (!parsedData) return null;
    return {
      magic: parsedData.magic.length,
      npc: parsedData.npc.length,
      obj: parsedData.obj.length,
      goods: parsedData.goods.length,
      shop: parsedData.shop.length,
      player: parsedData.player.length,
      level: parsedData.level.length,
      talk: parsedData.talk ? 1 : 0,
      talkPortrait: parsedData.talkPortrait ? 1 : 0,
      scene: parsedData.scene.length,
    } as Record<ImportModuleKey, number>;
  }, [parsedData]);

  // 根据有无数据自动过滤可选模块
  const availableModules = useMemo(() => {
    if (!moduleCounts) return ALL_MODULES;
    return ALL_MODULES.filter((m) => moduleCounts[m.key] > 0);
  }, [moduleCounts]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (!items) return;

    setIsAnalyzing(true);
    setParseProgress("读取文件...");
    const allFiles: DroppedFileEntry[] = [];
    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }
    for (const entry of entries) {
      const results = await readDroppedDirectory(entry, "");
      allFiles.push(...results);
    }

    setParseProgress(`读取到 ${allFiles.length} 个文件，解析中...`);
    const data = await parseResourcesFolder(allFiles, setParseProgress);
    setParsedData(data);

    // 自动选中有数据的模块
    const available = new Set<ImportModuleKey>();
    if (data.magic.length > 0) available.add("magic");
    if (data.npc.length > 0) available.add("npc");
    if (data.obj.length > 0) available.add("obj");
    if (data.goods.length > 0) available.add("goods");
    if (data.shop.length > 0) available.add("shop");
    if (data.player.length > 0) available.add("player");
    if (data.level.length > 0) available.add("level");
    if (data.talk) available.add("talk");
    if (data.talkPortrait) available.add("talkPortrait");
    if (data.scene.length > 0) available.add("scene");
    setSelectedModules(available);
    setParseProgress("");
    setIsAnalyzing(false);
  }, []);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsAnalyzing(true);
    setParseProgress("读取文件...");
    const allFiles: DroppedFileEntry[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      allFiles.push({ relativePath: path, file });
    }

    setParseProgress(`读取到 ${allFiles.length} 个文件，解析中...`);
    const data = await parseResourcesFolder(allFiles, setParseProgress);
    setParsedData(data);

    const available = new Set<ImportModuleKey>();
    if (data.magic.length > 0) available.add("magic");
    if (data.npc.length > 0) available.add("npc");
    if (data.obj.length > 0) available.add("obj");
    if (data.goods.length > 0) available.add("goods");
    if (data.shop.length > 0) available.add("shop");
    if (data.player.length > 0) available.add("player");
    if (data.level.length > 0) available.add("level");
    if (data.talk) available.add("talk");
    if (data.talkPortrait) available.add("talkPortrait");
    if (data.scene.length > 0) available.add("scene");
    setSelectedModules(available);
    setParseProgress("");
    setIsAnalyzing(false);
  }, []);

  /** 执行导入 */
  const handleImport = useCallback(async () => {
    if (!gameId || !parsedData) return;
    setIsImporting(true);
    const allResults: ModuleImportResult[] = [];
    const selected = Array.from(selectedModules);

    // 计算总步骤数
    let totalSteps = selected.length; // 清空步骤
    for (const key of selected) {
      if (key === "scene") totalSteps += parsedData.scene.length;
      else if (key === "level") totalSteps += parsedData.level.length;
      else totalSteps += 1; // 批量导入一步
    }
    setImportTotal(totalSteps);
    let currentStep = 0;

    // Phase 1: 清空所有选中模块
    for (const key of selected) {
      currentStep++;
      setImportProgress(currentStep);
      setImportStep(`清空 ${ALL_MODULES.find((m) => m.key === key)?.label ?? key}...`);

      try {
        switch (key) {
          case "magic":
            await clearMagic.mutateAsync({ gameId });
            break;
          case "npc":
            await clearNpc.mutateAsync({ gameId });
            break;
          case "obj":
            await clearObj.mutateAsync({ gameId });
            break;
          case "goods":
            await clearGoods.mutateAsync({ gameId });
            break;
          case "shop":
            await clearShop.mutateAsync({ gameId });
            break;
          case "player":
            await clearPlayer.mutateAsync({ gameId });
            break;
          case "level":
            await clearLevel.mutateAsync({ gameId });
            break;
          case "talk":
            await clearTalk.mutateAsync({ gameId });
            break;
          case "talkPortrait":
            await clearTalkPortrait.mutateAsync({ gameId });
            break;
          case "scene":
            await clearScene.mutateAsync({ gameId });
            break;
        }
      } catch (e) {
        allResults.push({
          module: key,
          success: 0,
          failed: 1,
          errors: [`清空失败: ${e instanceof Error ? e.message : String(e)}`],
        });
      }
    }

    // Phase 2: 批量导入
    const CHUNK_SIZE = 100;

    for (const key of selected) {
      // Skip if clear already failed
      if (allResults.some((r) => r.module === key && r.failed > 0)) continue;

      const label = ALL_MODULES.find((m) => m.key === key)?.label ?? key;

      try {
        switch (key) {
          case "magic": {
            setImportStep(`导入武功 (${parsedData.magic.length})...`);
            let success = 0;
            let failed = 0;
            const errors: string[] = [];
            // chunk
            for (let i = 0; i < parsedData.magic.length; i += CHUNK_SIZE) {
              const chunk = parsedData.magic.slice(i, i + CHUNK_SIZE);
              const res = await importMagic.mutateAsync({ gameId, items: chunk });
              success += res.success.length;
              failed += res.failed.length;
              errors.push(...res.failed.map((f: { fileName: string; error: string }) => `${f.fileName}: ${f.error}`));
            }
            currentStep++;
            setImportProgress(currentStep);
            allResults.push({ module: key, success, failed, errors });
            break;
          }
          case "npc": {
            setImportStep(`导入 NPC (${parsedData.npc.length})...`);
            const res = await importNpc.mutateAsync({ gameId, items: parsedData.npc });
            currentStep++;
            setImportProgress(currentStep);
            allResults.push({
              module: key,
              success: res.success.length,
              failed: res.failed.length,
              errors: res.failed.map((f: { fileName: string; error: string }) => `${f.fileName}: ${f.error}`),
            });
            break;
          }
          case "obj": {
            setImportStep(`导入 Object (${parsedData.obj.length})...`);
            const res = await importObj.mutateAsync({ gameId, items: parsedData.obj });
            currentStep++;
            setImportProgress(currentStep);
            allResults.push({
              module: key,
              success: res.success.length,
              failed: res.failed.length,
              errors: res.failed.map((f: { fileName: string; error: string }) => `${f.fileName}: ${f.error}`),
            });
            break;
          }
          case "goods": {
            setImportStep(`导入物品 (${parsedData.goods.length})...`);
            let success = 0;
            let failed = 0;
            const errors: string[] = [];
            for (let i = 0; i < parsedData.goods.length; i += CHUNK_SIZE) {
              const chunk = parsedData.goods.slice(i, i + CHUNK_SIZE);
              const res = await importGoods.mutateAsync({ gameId, items: chunk });
              success += res.success.length;
              failed += res.failed.length;
              errors.push(...res.failed.map((f: { fileName: string; error: string }) => `${f.fileName}: ${f.error}`));
            }
            currentStep++;
            setImportProgress(currentStep);
            allResults.push({ module: key, success, failed, errors });
            break;
          }
          case "shop": {
            setImportStep(`导入商店 (${parsedData.shop.length})...`);
            let success = 0;
            let failed = 0;
            const errors: string[] = [];
            for (let i = 0; i < parsedData.shop.length; i += CHUNK_SIZE) {
              const chunk = parsedData.shop.slice(i, i + CHUNK_SIZE);
              const res = await importShop.mutateAsync({ gameId, items: chunk });
              success += res.success.length;
              failed += res.failed.length;
              errors.push(...res.failed.map((f: { fileName: string; error: string }) => `${f.fileName}: ${f.error}`));
            }
            currentStep++;
            setImportProgress(currentStep);
            allResults.push({ module: key, success, failed, errors });
            break;
          }
          case "player": {
            setImportStep(`导入玩家 (${parsedData.player.length})...`);
            const res = await importPlayer.mutateAsync({
              gameId,
              items: parsedData.player,
              clearBeforeImport: false, // 已经清空过了
            });
            currentStep++;
            setImportProgress(currentStep);
            allResults.push({
              module: key,
              success: res.success.length,
              failed: res.failed.length,
              errors: res.failed.map((f: { fileName: string; error: string }) => `${f.fileName}: ${f.error}`),
            });
            break;
          }
          case "level": {
            let success = 0;
            const errors: string[] = [];
            for (const lvl of parsedData.level) {
              setImportStep(`导入等级配置: ${lvl.fileName}...`);
              try {
                await importLevel.mutateAsync({
                  gameId,
                  fileName: lvl.fileName,
                  userType: lvl.userType,
                  iniContent: lvl.iniContent,
                });
                success++;
              } catch (e) {
                errors.push(`${lvl.fileName}: ${e instanceof Error ? e.message : String(e)}`);
              }
              currentStep++;
              setImportProgress(currentStep);
            }
            allResults.push({
              module: key,
              success,
              failed: errors.length,
              errors,
            });
            break;
          }
          case "talk": {
            setImportStep("导入对话数据...");
            if (parsedData.talk) {
              await importTalk.mutateAsync({ gameId, content: parsedData.talk });
            }
            currentStep++;
            setImportProgress(currentStep);
            allResults.push({ module: key, success: 1, failed: 0, errors: [] });
            break;
          }
          case "talkPortrait": {
            setImportStep("导入头像映射...");
            if (parsedData.talkPortrait) {
              await importPortrait.mutateAsync({
                gameId,
                iniContent: parsedData.talkPortrait,
              });
            }
            currentStep++;
            setImportProgress(currentStep);
            allResults.push({ module: key, success: 1, failed: 0, errors: [] });
            break;
          }
          case "scene": {
            let success = 0;
            const errors: string[] = [];
            for (let i = 0; i < parsedData.scene.length; i++) {
              const scene = parsedData.scene[i];
              setImportStep(`导入场景 (${i + 1}/${parsedData.scene.length}): ${scene.name}...`);
              try {
                const res = await importScene.mutateAsync({
                  gameId,
                  scene: {
                    key: scene.key,
                    name: scene.name,
                    mapFileName: scene.mapFileName,
                    mmfData: scene.mmfBase64,
                    data: scene.data as Record<string, unknown>,
                    trapOverrides: scene.trapOverrides,
                  },
                });
                if (res.action === "error") {
                  errors.push(`${scene.name}: ${res.error ?? "未知错误"}`);
                } else {
                  success++;
                }
              } catch (e) {
                errors.push(
                  `${scene.name}: ${e instanceof Error ? e.message : String(e)}`
                );
              }
              currentStep++;
              setImportProgress(currentStep);
            }
            allResults.push({ module: key, success, failed: errors.length, errors });
            break;
          }
        }
      } catch (e) {
        allResults.push({
          module: key,
          success: 0,
          failed: 1,
          errors: [`${label}导入失败: ${e instanceof Error ? e.message : String(e)}`],
        });
        currentStep++;
        setImportProgress(currentStep);
      }
    }

    setResults(allResults);
    setIsImporting(false);
    onSuccess();
  }, [
    gameId,
    parsedData,
    selectedModules,
    clearMagic,
    clearNpc,
    clearObj,
    clearGoods,
    clearShop,
    clearPlayer,
    clearLevel,
    clearTalk,
    clearTalkPortrait,
    clearScene,
    importMagic,
    importNpc,
    importObj,
    importGoods,
    importShop,
    importPlayer,
    importLevel,
    importTalk,
    importPortrait,
    importScene,
    onSuccess,
  ]);

  const totalSelected = useMemo(() => {
    if (!moduleCounts) return 0;
    let total = 0;
    for (const key of selectedModules) {
      total += moduleCounts[key] ?? 0;
    }
    return total;
  }, [selectedModules, moduleCounts]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#1e1e1e] border border-widget-border rounded-lg w-[900px] max-h-[85vh] flex flex-col shadow-2xl">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-panel-border">
          <div className="flex items-center gap-3">
            <span className="text-xl">📂</span>
            <h2 className="text-lg font-medium text-white">批量导入资源</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors"
          >
            {DashboardIcons.close}
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-6">
          {results ? (
            // ===== 导入结果 =====
            <div className="space-y-4">
              <h3 className="text-white font-medium mb-3">导入结果</h3>
              <div className="space-y-2">
                {results.map((r) => {
                  const meta = ALL_MODULES.find((m) => m.key === r.module);
                  return (
                    <div
                      key={r.module}
                      className="bg-[#252526] rounded px-4 py-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span>{meta?.icon}</span>
                        <span className="text-white text-sm">{meta?.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        {r.success > 0 && (
                          <span className="text-green-400">✓ {r.success} 成功</span>
                        )}
                        {r.failed > 0 && (
                          <span className="text-red-400">✗ {r.failed} 失败</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* 错误详情 */}
              {results.some((r) => r.errors.length > 0) && (
                <div className="mt-4">
                  <h4 className="text-yellow-400 text-sm mb-2">错误详情:</h4>
                  <div className="bg-[#1a1a1a] p-3 rounded max-h-40 overflow-auto text-xs">
                    {results
                      .filter((r) => r.errors.length > 0)
                      .map((r) =>
                        r.errors.map((err, i) => (
                          <div key={`${r.module}-${i}`} className="text-red-400 mb-0.5">
                            [{ALL_MODULES.find((m) => m.key === r.module)?.label}] {err}
                          </div>
                        ))
                      )}
                  </div>
                </div>
              )}
            </div>
          ) : isImporting ? (
            // ===== 导入进行中 =====
            <div className="space-y-4">
              <div className="text-sm text-[#cccccc]">{importStep}</div>
              <div className="w-full bg-[#1a1a1a] rounded-full h-2.5">
                <div
                  className="bg-[#0e639c] h-2.5 rounded-full transition-all duration-200"
                  style={{
                    width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="text-xs text-[#858585]">
                {importTotal > 0 ? Math.round((importProgress / importTotal) * 100) : 0}%
                ({importProgress}/{importTotal})
              </div>
            </div>
          ) : parsedData ? (
            // ===== 解析完成，选择模块 =====
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-medium">解析完成，选择要导入的模块</h3>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-[#569cd6] hover:text-[#7eb6e6] transition-colors"
                >
                  {selectedModules.size === availableModules.length ? "取消全选" : "全选"}
                </button>
              </div>

              <p className="text-sm text-yellow-400">
                ⚠️ 导入将先清空选中模块的现有数据，然后重新导入。
              </p>

              {/* 模块选择列表 */}
              <div className="grid grid-cols-2 gap-2">
                {ALL_MODULES.map((mod) => {
                  const count = moduleCounts?.[mod.key] ?? 0;
                  const hasData = count > 0;
                  const isSelected = selectedModules.has(mod.key);
                  return (
                    <button
                      key={mod.key}
                      type="button"
                      onClick={() => hasData && toggleModule(mod.key)}
                      disabled={!hasData}
                      className={`flex items-center gap-3 px-4 py-3 rounded border transition-all text-left ${
                        !hasData
                          ? "border-[#333] bg-[#1a1a1a] opacity-40 cursor-not-allowed"
                          : isSelected
                            ? "border-[#0e639c] bg-[#0e639c]/20"
                            : "border-widget-border bg-[#252526] hover:bg-[#2a2d2e]"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-none ${
                          isSelected && hasData
                            ? "bg-[#0e639c] border-[#0e639c]"
                            : "border-[#555]"
                        }`}
                      >
                        {isSelected && hasData && (
                          <svg
                            viewBox="0 0 16 16"
                            fill="white"
                            className="w-3 h-3"
                          >
                            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                          </svg>
                        )}
                      </div>
                      <span className="text-lg flex-none">{mod.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium">{mod.label}</span>
                          {hasData && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-[#333] text-[#858585]">
                              {count}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[#858585] truncate block">
                          {hasData ? mod.description : "未找到数据"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            // ===== 拖拽区域 =====
            <div className="space-y-4">
              <p className="text-sm text-[#858585] mb-4">
                拖拽整个{" "}
                <code className="text-[#cccccc] bg-[#252526] px-1 rounded">resources</code>{" "}
                文件夹到下方区域，将自动识别并导入所有数据。
              </p>

              <div className="bg-[#252526] rounded p-3 text-xs text-[#858585]">
                <p className="mb-2 text-[#cccccc]">支持的目录结构：</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span>
                    <code className="text-[#ce9178]">ini/magic/</code> → 武功
                  </span>
                  <span>
                    <code className="text-[#ce9178]">ini/npc/</code> → NPC
                  </span>
                  <span>
                    <code className="text-[#ce9178]">ini/npcres/</code> → NPC 资源
                  </span>
                  <span>
                    <code className="text-[#ce9178]">ini/obj/</code> → 物体
                  </span>
                  <span>
                    <code className="text-[#ce9178]">ini/objres/</code> → 物体资源
                  </span>
                  <span>
                    <code className="text-[#ce9178]">ini/goods/</code> → 物品
                  </span>
                  <span>
                    <code className="text-[#ce9178]">ini/buy/</code> → 商店
                  </span>
                  <span>
                    <code className="text-[#ce9178]">ini/level/</code> → 等级配置
                  </span>
                  <span>
                    <code className="text-[#ce9178]">save/game/</code> → 玩家存档
                  </span>
                  <span>
                    <code className="text-[#ce9178]">content/</code> → 对话数据
                  </span>
                  <span>
                    <code className="text-[#ce9178]">map/*.mmf</code> → 场景
                  </span>
                  <span>
                    <code className="text-[#ce9178]">script/map/</code> → 脚本
                  </span>
                </div>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isAnalyzing) setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-lg transition-colors min-h-[200px] flex items-center justify-center ${
                  isDragging
                    ? "border-[#0098ff] bg-[#0098ff]/10"
                    : isAnalyzing
                      ? "border-[#0098ff]/50 bg-[#1e1e1e]"
                      : "border-widget-border hover:border-[#666]"
                }`}
              >
                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-4">
                    {/* Spinner */}
                    <div className="relative w-10 h-10">
                      <div className="absolute inset-0 border-3 border-[#3c3c3c] rounded-full" />
                      <div className="absolute inset-0 border-3 border-transparent border-t-[#0098ff] rounded-full animate-spin" />
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-sm text-[#cccccc] font-medium">正在分析文件...</span>
                      {parseProgress && (
                        <span className="text-xs text-[#858585] max-w-xs text-center">
                          {parseProgress}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center py-10 cursor-pointer">
                    <span className="text-[#858585] text-4xl mb-3">{DashboardIcons.upload}</span>
                    <span className="text-sm text-[#cccccc] mb-1">
                      拖拽 resources 文件夹到此处
                    </span>
                    <span className="text-xs text-[#858585]">或点击选择文件夹</span>
                    <input
                      type="file"
                      {...({ webkitdirectory: "" } as Record<string, string>)}
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {parseProgress && !isAnalyzing && (
                <div className="text-sm text-[#858585] bg-[#252526] px-4 py-2 rounded">
                  {parseProgress}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-panel-border">
          <span className="text-xs text-[#858585]">
            {results
              ? "导入完成"
              : isAnalyzing
                ? "正在分析文件..."
                : parsedData
                  ? `已选 ${selectedModules.size} 个模块，共 ${totalSelected} 项数据`
                  : "请拖入 resources 文件夹"}
          </span>
          <div className="flex items-center gap-3">
            {parsedData && !isImporting && !results && (
              <button
                type="button"
                onClick={() => {
                  setParsedData(null);
                  setParseProgress("");
                }}
                className="px-4 py-1.5 text-sm text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
              >
                重新选择
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting || isAnalyzing}
              className="px-4 py-1.5 text-sm text-[#cccccc] hover:bg-[#3c3c3c] disabled:opacity-50 rounded transition-colors"
            >
              {results ? "关闭" : "取消"}
            </button>
            {parsedData && !results && (
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting || selectedModules.size === 0}
                className="px-4 py-1.5 text-sm bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                {isImporting ? "导入中..." : "清空并导入"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

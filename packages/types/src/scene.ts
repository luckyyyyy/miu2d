/**
 * 场景类型定义
 *
 * 场景 = 一张地图 + 关联的脚本、陷阱、NPC、物件
 * 地图文件 (*.mmf) 存储在文件系统 (S3)
 * 其他数据（脚本/陷阱/NPC/OBJ）解析为 JSON 存储在 scene.data 字段
 */
import { z } from "zod";

// ============= 场景子项类型枚举 =============

export const SceneItemKindEnum = z.enum(["script", "trap", "npc", "obj"]);
export type SceneItemKind = z.infer<typeof SceneItemKindEnum>;

export const SceneItemKindLabels: Record<SceneItemKind, string> = {
	script: "脚本",
	trap: "陷阱",
	npc: "NPC",
	obj: "物件",
};

// ============= 场景数据结构（存储在 scene.data JSONB） =============

/** NPC 条目 */
export interface SceneNpcEntry {
	name: string;
	kind: number;
	npcIni: string;
	dir: number;
	mapX: number;
	mapY: number;
	action: number;
	walkSpeed: number;
	dialogRadius: number;
	scriptFile: string;
	visionRadius: number;
	relation: number;
	group: number;
	fixedPos: string;
}

/** OBJ 条目 */
export interface SceneObjEntry {
	objName: string;
	objFile: string;
	wavFile: string;
	scriptFile: string;
	kind: number;
	dir: number;
	lum: number;
	mapX: number;
	mapY: number;
	offX: number;
	offY: number;
	damage: number;
	frame: number;
}

/** NPC 数据（一个场景一份） */
export interface SceneNpcData {
	key: string;
	entries: SceneNpcEntry[];
}

/** OBJ 数据（一个场景一份） */
export interface SceneObjData {
	key: string;
	entries: SceneObjEntry[];
}

/** 场景数据：存储在 scene.data JSONB 字段 */
export interface SceneData {
	/** 脚本文件: { fileName: content } */
	scripts?: Record<string, string>;
	/** 陷阱文件: { fileName: content } */
	traps?: Record<string, string>;
	/** NPC 配置：{ fileName: SceneNpcData }，一个场景可有多个 NPC 文件 */
	npc?: Record<string, SceneNpcData>;
	/** OBJ 配置：{ fileName: SceneObjData }，一个场景可有多个 OBJ 文件 */
	obj?: Record<string, SceneObjData>;
}

// ============= 场景 Schema =============

export const SceneSchema = z.object({
	id: z.string().uuid(),
	gameId: z.string().uuid(),
	key: z.string(),
	name: z.string(),
	mapFileName: z.string(),
	data: z.record(z.string(), z.unknown()).nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});
export type Scene = z.infer<typeof SceneSchema>;

export const SceneListItemSchema = z.object({
	id: z.string().uuid(),
	key: z.string(),
	name: z.string(),
	mapFileName: z.string(),
	scriptCount: z.number(),
	trapCount: z.number(),
	npcCount: z.number(),
	objCount: z.number(),
	/** 脚本文件名列表（侧栏展开用） */
	scriptKeys: z.array(z.string()),
	/** 陷阱文件名列表 */
	trapKeys: z.array(z.string()),
	/** NPC 文件名列表 */
	npcKeys: z.array(z.string()),
	/** OBJ 文件名列表 */
	objKeys: z.array(z.string()),
	updatedAt: z.string(),
});
export type SceneListItem = z.infer<typeof SceneListItemSchema>;

// ============= API 输入 Schema =============

export const ListSceneInputSchema = z.object({
	gameId: z.string().uuid(),
});
export type ListSceneInput = z.infer<typeof ListSceneInputSchema>;

export const GetSceneInputSchema = z.object({
	gameId: z.string().uuid(),
	id: z.string().uuid(),
});
export type GetSceneInput = z.infer<typeof GetSceneInputSchema>;

export const CreateSceneInputSchema = z.object({
	gameId: z.string().uuid(),
	key: z.string(),
	name: z.string(),
	mapFileName: z.string(),
	data: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type CreateSceneInput = z.infer<typeof CreateSceneInputSchema>;

export const UpdateSceneInputSchema = z.object({
	gameId: z.string().uuid(),
	id: z.string().uuid(),
	name: z.string().optional(),
	data: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type UpdateSceneInput = z.infer<typeof UpdateSceneInputSchema>;

export const DeleteSceneInputSchema = z.object({
	gameId: z.string().uuid(),
	id: z.string().uuid(),
});
export type DeleteSceneInput = z.infer<typeof DeleteSceneInputSchema>;

// ============= 单文件导入 =============

/** 导入区域（对应 3 个拖拽区域） */
export const ImportZoneEnum = z.enum(["map", "script", "save"]);
export type ImportZone = z.infer<typeof ImportZoneEnum>;

/**
 * 单文件导入请求
 * 前端逐个文件调用，后端逐个处理
 */
export const ImportSceneFileInputSchema = z.object({
	gameId: z.string().uuid(),
	zone: ImportZoneEnum,
	fileName: z.string(),
	/** 脚本文件所在的目录名（仅 zone=script 时需要，如 "map_003_武当山下"） */
	dirName: z.string().optional(),
	/** 文件内容：map 为 base64, script/save 为 UTF-8 文本 */
	content: z.string(),
});
export type ImportSceneFileInput = z.infer<typeof ImportSceneFileInputSchema>;

export const ImportSceneFileResultSchema = z.object({
	ok: z.boolean(),
	/** 创建/更新/跳过/错误 */
	action: z.enum(["created", "updated", "skipped", "error"]),
	/** 若创建了场景，返回场景名 */
	sceneName: z.string().optional(),
	/** 若处理了子项，返回类型 */
	itemKind: SceneItemKindEnum.optional(),
	/** 错误信息 */
	error: z.string().optional(),
});
export type ImportSceneFileResult = z.infer<typeof ImportSceneFileResultSchema>;

// ============= 辅助函数 =============

/**
 * 从地图文件名解析 key 和显示名
 * e.g. "map_003_武当山下.mmf" → { key: "map_003_武当山下", name: "003_武当山下" }
 * e.g. "MAP_041_通天塔一层.mmf" → { key: "MAP_041_通天塔一层", name: "041_通天塔一层" }
 */
export function parseMapFileName(fileName: string): { key: string; name: string } {
	const base = fileName.replace(/\.(mmf|map)$/i, "");
	const match = base.match(/^(?:map|MAP)_(\d+_(.+))$/);
	if (match) {
		return { key: base, name: match[1] };
	}
	return { key: base, name: base };
}

/**
 * 从脚本文件名判断类型（陷阱 vs 对话/事件脚本）
 * Trap*.txt → trap
 * 其他 → script
 */
export function classifyScriptFile(fileName: string): SceneItemKind {
	if (/^Trap\d*/i.test(fileName)) {
		return "trap";
	}
	return "script";
}

/**
 * 从 save 文件名判断类型
 * *.npc → npc
 * *.obj → obj
 */
export function classifySaveFile(fileName: string): SceneItemKind | null {
	if (fileName.endsWith(".npc")) return "npc";
	if (fileName.endsWith(".obj")) return "obj";
	return null;
}

/**
 * 从文件名提取显示名
 */
export function extractDisplayName(fileName: string): string {
	return fileName.replace(/\.(txt|npc|obj|ini)$/i, "");
}

// ============= INI 解析函数（前后端共用） =============

/** 解析 INI 文件内容为 sections */
export function parseIniContent(content: string): Record<string, Record<string, string>> {
	const result: Record<string, Record<string, string>> = {};
	let currentSection = "";
	for (const rawLine of content.split(/\r?\n/)) {
		let line = rawLine;
		const sc = line.indexOf(";");
		if (sc >= 0) line = line.substring(0, sc);
		const cc = line.indexOf("//");
		if (cc >= 0) line = line.substring(0, cc);
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
			currentSection = trimmed.slice(1, -1).trim();
			if (!result[currentSection]) result[currentSection] = {};
			continue;
		}
		const eq = trimmed.indexOf("=");
		if (eq > 0 && currentSection) {
			result[currentSection][trimmed.substring(0, eq).trim()] = trimmed.substring(eq + 1).trim();
		}
	}
	return result;
}

/** 从 INI sections 提取 NPC 条目数组 */
export function parseNpcEntries(sections: Record<string, Record<string, string>>): SceneNpcEntry[] {
	const entries: SceneNpcEntry[] = [];
	for (const key of Object.keys(sections)) {
		if (!/^NPC\d+$/i.test(key)) continue;
		const s = sections[key];
		entries.push({
			name: s.Name ?? "",
			kind: Number(s.Kind ?? 0),
			npcIni: s.NpcIni ?? "",
			dir: Number(s.Dir ?? 0),
			mapX: Number(s.MapX ?? 0),
			mapY: Number(s.MapY ?? 0),
			action: Number(s.Action ?? 0),
			walkSpeed: Number(s.WalkSpeed ?? 1),
			dialogRadius: Number(s.DialogRadius ?? 0),
			scriptFile: s.ScriptFile ?? "",
			visionRadius: Number(s.VisionRadius ?? 0),
			relation: Number(s.Relation ?? 0),
			group: Number(s.Group ?? 0),
			fixedPos: s.FixedPos ?? "",
		});
	}
	return entries;
}

/** 从 INI sections 提取 OBJ 条目数组 */
export function parseObjEntries(sections: Record<string, Record<string, string>>): SceneObjEntry[] {
	const entries: SceneObjEntry[] = [];
	for (const key of Object.keys(sections)) {
		if (!/^OBJ\d+$/i.test(key)) continue;
		const s = sections[key];
		entries.push({
			objName: s.ObjName ?? "",
			objFile: s.ObjFile ?? "",
			wavFile: s.WavFile ?? "",
			scriptFile: s.ScriptFile ?? "",
			kind: Number(s.Kind ?? 0),
			dir: Number(s.Dir ?? 0),
			lum: Number(s.Lum ?? 0),
			mapX: Number(s.MapX ?? 0),
			mapY: Number(s.MapY ?? 0),
			offX: Number(s.OffX ?? 0),
			offY: Number(s.OffY ?? 0),
			damage: Number(s.Damage ?? 0),
			frame: Number(s.Frame ?? 0),
		});
	}
	return entries;
}

/** 从 scene.data 计算子项统计（NPC/OBJ 统计总 entries 数） */
export function getSceneDataCounts(data: SceneData | null | undefined): {
	scriptCount: number;
	trapCount: number;
	npcCount: number;
	objCount: number;
} {
	let npcCount = 0;
	if (data?.npc) {
		for (const v of Object.values(data.npc)) {
			npcCount += v.entries?.length ?? 0;
		}
	}
	let objCount = 0;
	if (data?.obj) {
		for (const v of Object.values(data.obj)) {
			objCount += v.entries?.length ?? 0;
		}
	}
	return {
		scriptCount: data?.scripts ? Object.keys(data.scripts).length : 0,
		trapCount: data?.traps ? Object.keys(data.traps).length : 0,
		npcCount,
		objCount,
	};
}

/**
 * 场景服务
 *
 * 地图文件 (*.mmf) 存储在文件系统 (S3)
 * 其他数据（脚本/陷阱/NPC/OBJ）解析为 JSON 存储在 scene.data 字段
 */
import { TRPCError } from "@trpc/server";
import type {
	Scene,
	SceneListItem,
	CreateSceneInput,
	UpdateSceneInput,
	ListSceneInput,
	ImportSceneFileInput,
	ImportSceneFileResult,
	SceneData,
} from "@miu2d/types";
import {
	parseMapFileName,
	classifyScriptFile,
	classifySaveFile,
	extractDisplayName,
	parseIniContent,
	parseNpcEntries,
	parseObjEntries,
	getSceneDataCounts,
} from "@miu2d/types";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { scenes, files } from "../../db/schema";
import type { Language } from "../../i18n";
import { verifyGameAccess } from "../../utils/gameAccess";
import { getMessage } from "../../i18n";
import { fileService } from "../file/file.service";
import * as s3 from "../../storage/s3";

export class SceneService {

	/**
	 * 将数据库记录转换为 Scene 类型
	 */
	private toScene(row: typeof scenes.$inferSelect): Scene {
		return {
			id: row.id,
			gameId: row.gameId,
			key: row.key,
			name: row.name,
			mapFileName: row.mapFileName,
			data: (row.data as Record<string, unknown>) ?? null,
			createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
			updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
		};
	}

	// ============= 场景 CRUD =============

	/**
	 * 列出场景（从 scene.data 计算子项统计）
	 */
	async list(
		input: ListSceneInput,
		userId: string,
		language: Language
	): Promise<SceneListItem[]> {
		await verifyGameAccess(input.gameId, userId, language);

		const rows = await db
			.select()
			.from(scenes)
			.where(eq(scenes.gameId, input.gameId))
			.orderBy(scenes.key);

		return rows.map(row => {
			const data = ((row.data ?? {}) as SceneData);
			const counts = getSceneDataCounts(data);
			return {
				id: row.id,
				key: row.key,
				name: row.name,
				mapFileName: row.mapFileName,
				...counts,
				scriptKeys: data.scripts ? Object.keys(data.scripts) : [],
				trapKeys: data.traps ? Object.keys(data.traps) : [],
				npcKeys: data.npc ? Object.keys(data.npc) : [],
				objKeys: data.obj ? Object.keys(data.obj) : [],
				updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
			};
		});
	}

	/**
	 * 获取单个场景
	 */
	async get(
		gameId: string,
		sceneId: string,
		userId: string,
		language: Language
	): Promise<Scene | null> {
		await verifyGameAccess(gameId, userId, language);

		const [row] = await db
			.select()
			.from(scenes)
			.where(and(eq(scenes.id, sceneId), eq(scenes.gameId, gameId)))
			.limit(1);

		if (!row) return null;
		return this.toScene(row);
	}

	/**
	 * 创建场景
	 */
	async create(
		input: CreateSceneInput,
		userId: string,
		language: Language
	): Promise<Scene> {
		await verifyGameAccess(input.gameId, userId, language);

		const [row] = await db
			.insert(scenes)
			.values({
				gameId: input.gameId,
				key: input.key,
				name: input.name,
				mapFileName: input.mapFileName,
				data: input.data ?? null,
			})
			.returning();

		return this.toScene(row);
	}

	/**
	 * 更新场景
	 */
	async update(
		input: UpdateSceneInput,
		userId: string,
		language: Language
	): Promise<Scene> {
		await verifyGameAccess(input.gameId, userId, language);

		const existing = await this.get(input.gameId, input.id, userId, language);
		if (!existing) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: getMessage(language, "errors.scene.notFound")
			});
		}

		const updates: Record<string, unknown> = { updatedAt: new Date() };
		if (input.name !== undefined) updates.name = input.name;
		if (input.data !== undefined) updates.data = input.data;

		const [row] = await db
			.update(scenes)
			.set(updates)
			.where(and(eq(scenes.id, input.id), eq(scenes.gameId, input.gameId)))
			.returning();

		return this.toScene(row);
	}

	/**
	 * 删除场景
	 */
	async delete(
		gameId: string,
		sceneId: string,
		userId: string,
		language: Language
	): Promise<{ id: string }> {
		await verifyGameAccess(gameId, userId, language);

		const [row] = await db
			.delete(scenes)
			.where(and(eq(scenes.id, sceneId), eq(scenes.gameId, gameId)))
			.returning({ id: scenes.id });

		if (!row) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: getMessage(language, "errors.scene.notFound")
			});
		}

		return row;
	}

	// ============= 单文件导入 =============

	/**
	 * 导入单个文件
	 * 前端逐个文件调用，每次只处理 1 个文件
	 */
	async importFile(
		input: ImportSceneFileInput,
		userId: string,
		language: Language
	): Promise<ImportSceneFileResult> {
		await verifyGameAccess(input.gameId, userId, language);

		try {
			switch (input.zone) {
				case "map":
					return await this.importMapFile(input, userId, language);
				case "script":
					return await this.importScriptFile(input, userId, language);
				case "save":
					return await this.importSaveFile(input, userId, language);
				default:
					return { ok: false, action: "error", error: `不支持的区域: ${input.zone}` };
			}
		} catch (e) {
			return {
				ok: false,
				action: "error",
				error: e instanceof Error ? e.message : String(e),
			};
		}
	}

	/** 导入地图文件 → 创建场景 + 上传到资源管理器 map/ */
	private async importMapFile(
		input: ImportSceneFileInput,
		userId: string,
		language: Language
	): Promise<ImportSceneFileResult> {
		if (!input.fileName.toLowerCase().endsWith(".mmf")) {
			return { ok: false, action: "error", error: `不支持的地图文件类型: ${input.fileName}（仅支持 .mmf）` };
		}
		const { key, name } = parseMapFileName(input.fileName);

		// 检查是否已存在
		const [existing] = await db
			.select({ id: scenes.id })
			.from(scenes)
			.where(and(eq(scenes.gameId, input.gameId), eq(scenes.key, key)))
			.limit(1);

		if (existing) {
			return { ok: true, action: "skipped", sceneName: name };
		}

		// 创建场景记录
		await db.insert(scenes).values({
			gameId: input.gameId,
			key,
			name,
			mapFileName: input.fileName,
		});

		// 上传到资源管理器 map/
		const mapFolderId = await fileService.ensureFolderPath(
			input.gameId, null, ["map"], userId, language
		);
		await this.uploadFileToResources(
			input.gameId,
			mapFolderId,
			input.fileName,
			Buffer.from(input.content, "base64"),
			"application/octet-stream",
			userId,
			language
		);

		return { ok: true, action: "created", sceneName: name };
	}

	/**
	 * 导入脚本文件 → 匹配场景 → 解析内容存入 scene.data.scripts / scene.data.traps
	 */
	private async importScriptFile(
		input: ImportSceneFileInput,
		_userId: string,
		_language: Language
	): Promise<ImportSceneFileResult> {
		if (!input.fileName.toLowerCase().endsWith(".txt")) {
			return { ok: false, action: "error", error: `不支持的脚本文件类型: ${input.fileName}（仅支持 .txt）` };
		}
		const dirName = input.dirName;
		if (!dirName) {
			return { ok: false, action: "error", error: "脚本文件缺少 dirName" };
		}

		// 统一 key 大小写匹配场景
		const allScenes = await db
			.select()
			.from(scenes)
			.where(eq(scenes.gameId, input.gameId));

		const scene = allScenes.find(s => s.key.toLowerCase() === dirName.toLowerCase());
		if (!scene) {
			return { ok: false, action: "error", error: `未找到目录 ${dirName} 对应的场景` };
		}

		const kind = classifyScriptFile(input.fileName);
		const dataKey = kind === "trap" ? "traps" : "scripts";

		// 读取当前 scene.data，合并新内容
		const data: SceneData = ((scene.data ?? {}) as SceneData);
		if (!data[dataKey]) {
			(data as Record<string, unknown>)[dataKey] = {};
		}

		// 检查是否已存在
		if (data[dataKey]![input.fileName]) {
			return { ok: true, action: "skipped", itemKind: kind };
		}

		data[dataKey]![input.fileName] = input.content;

		// 更新场景
		await db
			.update(scenes)
			.set({ data: data as Record<string, unknown>, updatedAt: new Date() })
			.where(and(eq(scenes.id, scene.id), eq(scenes.gameId, input.gameId)));

		return { ok: true, action: "updated", itemKind: kind };
	}

	/**
	 * 导入存档文件 → 解析 INI → 匹配场景 → 解析 NPC/OBJ 条目存入 scene.data
	 */
	private async importSaveFile(
		input: ImportSceneFileInput,
		_userId: string,
		_language: Language
	): Promise<ImportSceneFileResult> {
		const lower = input.fileName.toLowerCase();
		if (!lower.endsWith(".npc") && !lower.endsWith(".obj")) {
			return { ok: false, action: "error", error: `不支持的存档文件类型: ${input.fileName}（仅支持 .npc/.obj）` };
		}
		const kind = classifySaveFile(input.fileName);
		if (!kind) {
			return { ok: false, action: "error", error: `不支持的文件类型: ${input.fileName}` };
		}

		const displayName = extractDisplayName(input.fileName);

		// 从文件内容的 [Head] Map= 字段匹配场景
		const sceneId = await this.matchSaveFileToScene(input.gameId, input.content, displayName);
		if (!sceneId) {
			return { ok: false, action: "error", error: `未找到 ${input.fileName} 对应的场景（Map= 不匹配）` };
		}

		// 获取当前场景
		const [scene] = await db
			.select()
			.from(scenes)
			.where(and(eq(scenes.id, sceneId), eq(scenes.gameId, input.gameId)))
			.limit(1);

		if (!scene) {
			return { ok: false, action: "error", error: "场景不存在" };
		}

		// 解析 INI 内容
		const sections = parseIniContent(input.content);
		const data: SceneData = ((scene.data ?? {}) as SceneData);

		if (kind === "npc") {
			const entries = parseNpcEntries(sections);
			if (!data.npc) data.npc = {};
			data.npc[input.fileName] = { key: input.fileName, entries };
		} else if (kind === "obj") {
			const entries = parseObjEntries(sections);
			if (!data.obj) data.obj = {};
			data.obj[input.fileName] = { key: input.fileName, entries };
		}

		// 更新场景
		await db
			.update(scenes)
			.set({ data: data as Record<string, unknown>, updatedAt: new Date() })
			.where(and(eq(scenes.id, sceneId), eq(scenes.gameId, input.gameId)));

		return { ok: true, action: "updated", itemKind: kind };
	}

	/**
	 * 从 NPC/OBJ 文件内容中解析 [Head] Map= 字段，匹配到对应场景
	 * 例如 Map=map_009_山洞内部.map → 匹配 scene key "map_009_山洞内部"
	 * 如果头部没有 Map= 字段，回退到文件名模式匹配
	 */
	private async matchSaveFileToScene(
		gameId: string,
		content: string,
		displayName: string
	): Promise<string | null> {
		// 1. 优先从文件内容解析 Map= 字段
		const mapMatch = content.match(/^Map\s*=\s*(.+)/im);
		if (mapMatch) {
			const mapFileName = mapMatch[1].trim();
			// 提取 key（去掉 .map/.mmf 后缀）
			const mapKey = mapFileName.replace(/\.(map|mmf)$/i, "");
			if (mapKey) {
				const rows = await db
					.select({ id: scenes.id })
					.from(scenes)
					.where(and(
						eq(scenes.gameId, gameId),
						eq(scenes.key, mapKey)
					))
					.limit(1);
				if (rows.length > 0) return rows[0].id;

				// Map= 中的 key 可能大小写不同，用 LOWER 兜底
				const rows2 = await db
					.select({ id: scenes.id })
					.from(scenes)
					.where(and(
						eq(scenes.gameId, gameId),
						sql`LOWER(${scenes.key}) = LOWER(${mapKey})`
					))
					.limit(1);
				if (rows2.length > 0) return rows2[0].id;
			}
		}

		// 2. 回退：从文件名模式匹配（map003 → map_003_*）
		const numMatch = displayName.match(/^map(\d{3})/i);
		if (numMatch) {
			const mapNum = numMatch[1];
			const rows = await db
				.select({ id: scenes.id })
				.from(scenes)
				.where(and(
					eq(scenes.gameId, gameId),
					sql`(${scenes.key} LIKE ${`map_${mapNum}_%`} OR ${scenes.key} LIKE ${`MAP_${mapNum}_%`})`
				))
				.limit(1);

			if (rows.length > 0) return rows[0].id;
		}

		return null;
	}

	/**
	 * 上传文件到资源管理器
	 * 如果同名文件已存在则跳过
	 * 仅用于地图文件 (MMF) 上传
	 */
	private async uploadFileToResources(
		gameId: string,
		parentId: string,
		fileName: string,
		content: Buffer,
		mimeType: string,
		_userId: string,
		_language: Language
	): Promise<string> {
		// 检查是否已存在同名文件
		const [existing] = await db
			.select({ id: files.id })
			.from(files)
			.where(and(
				eq(files.gameId, gameId),
				eq(files.parentId, parentId),
				eq(files.name, fileName),
				isNull(files.deletedAt)
			))
			.limit(1);

		if (existing) {
			return existing.id;
		}

		// 生成 storageKey 并上传到 S3
		const storageKey = `${gameId}/${crypto.randomUUID()}/${fileName}`;
		await s3.uploadFile(storageKey, content, mimeType);

		// 创建文件记录
		const [file] = await db
			.insert(files)
			.values({
				gameId,
				parentId,
				name: fileName,
				type: "file",
				storageKey,
				size: String(content.length),
				mimeType,
			})
			.returning();

		return file.id;
	}
}

export const sceneService = new SceneService();

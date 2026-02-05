/**
 * Object 服务
 * 使用 PostgreSQL 数据库存储，数据以 JSON 形式存储在 data 字段中
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */
import { TRPCError } from "@trpc/server";
import type {
	Obj,
	ObjKind,
	CreateObjInput,
	UpdateObjInput,
	ListObjInput,
	ImportObjInput,
	BatchImportObjInput,
	BatchImportObjResult,
	ObjListItem,
	ObjResource,
} from "@miu2d/types";
import {
	ObjKindFromValue,
	createDefaultObj,
	createDefaultObjResource,
	normalizeObjImagePath,
	normalizeObjSoundPath,
} from "@miu2d/types";
import { and, eq, desc } from "drizzle-orm";
import { db } from "../../db/client";
import { gameMembers, games, objs } from "../../db/schema";
import type { Language } from "../../i18n";
import { getMessage } from "../../i18n";

export class ObjService {
	/**
	 * 验证用户是否有权访问游戏
	 */
	async verifyGameAccess(gameId: string, userId: string, language: Language): Promise<void> {
		const [member] = await db
			.select()
			.from(gameMembers)
			.where(
				and(
					eq(gameMembers.gameId, gameId),
					eq(gameMembers.userId, userId)
				)
			)
			.limit(1);

		if (!member) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: getMessage(language, "errors.file.noAccess")
			});
		}
	}

	/**
	 * 将数据库记录转换为 Obj 类型
	 */
	private toObj(row: typeof objs.$inferSelect): Obj {
		const data = row.data as Omit<Obj, "id" | "gameId" | "key" | "name" | "kind" | "createdAt" | "updatedAt">;
		return {
			...data,
			id: row.id,
			gameId: row.gameId,
			key: row.key,
			name: row.name,
			kind: row.kind as Obj["kind"],
			createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
			updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
		};
	}

	/**
	 * 公开接口：通过 slug 列出游戏的所有 Object（无需认证）
	 * 用于游戏客户端加载 Object 数据
	 */
	async listPublicBySlug(gameSlug: string): Promise<Obj[]> {
		// 通过 slug 查找游戏
		const [game] = await db
			.select({ id: games.id })
			.from(games)
			.where(eq(games.slug, gameSlug))
			.limit(1);

		if (!game) {
			throw new Error("Game not found");
		}

		const rows = await db
			.select()
			.from(objs)
			.where(eq(objs.gameId, game.id))
			.orderBy(desc(objs.updatedAt));

		return rows.map(row => this.toObj(row));
	}

	/**
	 * 获取单个 Object
	 */
	async get(
		gameId: string,
		objId: string,
		userId: string,
		language: Language
	): Promise<Obj | null> {
		await this.verifyGameAccess(gameId, userId, language);

		const [row] = await db
			.select()
			.from(objs)
			.where(and(eq(objs.id, objId), eq(objs.gameId, gameId)))
			.limit(1);

		if (!row) return null;
		return this.toObj(row);
	}

	/**
	 * 列出 Object
	 */
	async list(
		input: ListObjInput,
		userId: string,
		language: Language
	): Promise<ObjListItem[]> {
		await this.verifyGameAccess(input.gameId, userId, language);

		const conditions = [eq(objs.gameId, input.gameId)];
		if (input.kind) {
			conditions.push(eq(objs.kind, input.kind));
		}

		const rows = await db
			.select()
			.from(objs)
			.where(and(...conditions))
			.orderBy(desc(objs.updatedAt));

		return rows.map(row => {
			const data = row.data as Record<string, unknown>;
			const resources = data.resources as ObjResource | undefined;
			return {
				id: row.id,
				key: row.key,
				name: row.name,
				kind: row.kind as ObjKind,
				icon: resources?.common?.image ?? null,
				updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
			};
		});
	}

	/**
	 * 创建 Object
	 */
	async create(
		input: CreateObjInput,
		userId: string,
		language: Language
	): Promise<Obj> {
		await this.verifyGameAccess(input.gameId, userId, language);

		const defaultObj = createDefaultObj(input.gameId, input.key);
		const fullObj = {
			...defaultObj,
			...input,
		};

		// 分离索引字段和 data 字段
		const { gameId, key, name, kind, ...data } = fullObj;

		const [row] = await db
			.insert(objs)
			.values({
				gameId,
				key,
				name: name ?? "未命名物体",
				kind: kind ?? "Static",
				data,
			})
			.returning();

		return this.toObj(row);
	}

	/**
	 * 更新 Object
	 */
	async update(
		input: UpdateObjInput,
		userId: string,
		language: Language
	): Promise<Obj> {
		await this.verifyGameAccess(input.gameId, userId, language);

		// 检查是否存在
		const existing = await this.get(input.gameId, input.id, userId, language);
		if (!existing) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: getMessage(language, "errors.obj.notFound")
			});
		}

		// 合并更新
		const { id, gameId, ...inputData } = input;
		const merged = { ...existing, ...inputData };

		// 分离索引字段和 data 字段
		const {
			id: _id,
			gameId: _gameId,
			key,
			name,
			kind,
			createdAt: _createdAt,
			updatedAt: _updatedAt,
			...data
		} = merged;

		const [row] = await db
			.update(objs)
			.set({
				key,
				name,
				kind,
				data,
				updatedAt: new Date(),
			})
			.where(and(eq(objs.id, id), eq(objs.gameId, gameId)))
			.returning();

		return this.toObj(row);
	}

	/**
	 * 删除 Object
	 */
	async delete(
		gameId: string,
		objId: string,
		userId: string,
		language: Language
	): Promise<{ id: string }> {
		await this.verifyGameAccess(gameId, userId, language);

		await db
			.delete(objs)
			.where(and(eq(objs.id, objId), eq(objs.gameId, gameId)));

		return { id: objId };
	}

	/**
	 * 从 INI 导入 Object
	 */
	async importFromIni(
		input: ImportObjInput,
		userId: string,
		language: Language
	): Promise<Obj> {
		await this.verifyGameAccess(input.gameId, userId, language);

		const parsed = this.parseObjIni(input.iniContent);

		// 如果有资源配置 INI，解析并合并
		if (input.objResContent) {
			parsed.resources = this.parseObjResIni(input.objResContent);
		}

		// 使用文件名作为 key
		const key = input.fileName;

		return this.create({
			gameId: input.gameId,
			key,
			name: parsed.name ?? key.replace(/\.ini$/i, ""),
			kind: parsed.kind,
			...parsed,
		}, userId, language);
	}

	/**
	 * 批量导入 Object
	 * 支持自动关联 objres 配置
	 */
	async batchImportFromIni(
		input: BatchImportObjInput,
		userId: string,
		language: Language
	): Promise<BatchImportObjResult> {
		await this.verifyGameAccess(input.gameId, userId, language);

		const success: BatchImportObjResult["success"] = [];
		const failed: BatchImportObjResult["failed"] = [];

		for (const item of input.items) {
			try {
				const parsed = this.parseObjIni(item.iniContent);
				const hasResources = !!item.objResContent;

				// 如果有资源配置 INI，解析并合并
				if (item.objResContent) {
					parsed.resources = this.parseObjResIni(item.objResContent);
				}

				// 使用文件名作为 key
				const key = item.fileName;

				const obj = await this.create({
					gameId: input.gameId,
					key,
					name: parsed.name ?? item.fileName.replace(/\.ini$/i, ""),
					kind: parsed.kind,
					...parsed,
				}, userId, language);

				success.push({
					fileName: item.fileName,
					id: obj.id,
					name: obj.name,
					hasResources,
				});
			} catch (error) {
				failed.push({
					fileName: item.fileName,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return { success, failed };
	}

	/**
	 * 解析 Object INI 内容（obj/*.ini）
	 */
	private parseObjIni(content: string): Partial<Obj> {
		const result: Partial<Obj> = {};
		const lines = content.split(/\r?\n/);
		let currentSection = "";
		let objFileName: string | null = null;

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith(";")) {
				continue;
			}

			const sectionMatch = trimmed.match(/^\[(.+)\]$/);
			if (sectionMatch) {
				currentSection = sectionMatch[1].toUpperCase();
				continue;
			}

			const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
			if (!kvMatch || currentSection !== "INIT") continue;

			const key = kvMatch[1].trim();
			const value = kvMatch[2].trim();

			switch (key) {
				case "ObjName":
					result.name = value;
					break;
				case "ObjFile":
					// 存储原始的 objres 文件名，用于自动关联
					objFileName = value;
					break;
				case "Kind":
					result.kind = ObjKindFromValue[parseInt(value, 10)] ?? "Static";
					break;
				case "Dir":
					result.dir = parseInt(value, 10) || 0;
					break;
				case "Lum":
					result.lum = parseInt(value, 10) || 0;
					break;
				case "Damage":
					result.damage = parseInt(value, 10) || 0;
					break;
				case "Frame":
					result.frame = parseInt(value, 10) || 0;
					break;
				case "Height":
					result.height = parseInt(value, 10) || 0;
					break;
				case "OffX":
					result.offX = parseInt(value, 10) || 0;
					break;
				case "OffY":
					result.offY = parseInt(value, 10) || 0;
					break;
				case "ScriptFile":
					result.scriptFile = value || null;
					break;
				case "ScriptFileRight":
					result.scriptFileRight = value || null;
					break;
				case "CanInteractDirectly":
					result.canInteractDirectly = parseInt(value, 10) || 0;
					break;
				case "ScriptFileJustTouch":
					result.scriptFileJustTouch = parseInt(value, 10) || 0;
					break;
				case "TimerScriptFile":
					result.timerScriptFile = value || null;
					break;
				case "TimerScriptInterval":
					result.timerScriptInterval = parseInt(value, 10) || 3000;
					break;
				case "WavFile":
					result.wavFile = value || null;
					break;
				case "ReviveNpcIni":
					result.reviveNpcIni = value || null;
					break;
				case "MillisecondsToRemove":
					result.millisecondsToRemove = parseInt(value, 10) || 0;
					break;
			}
		}

		return result;
	}

	/**
	 * 解析 Object 资源 INI 内容（objres/*.ini）
	 */
	private parseObjResIni(content: string): ObjResource {
		const result = createDefaultObjResource();
		const lines = content.split(/\r?\n/);
		let currentSection = "";

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith(";")) {
				continue;
			}

			const sectionMatch = trimmed.match(/^\[(.+)\]$/);
			if (sectionMatch) {
				currentSection = sectionMatch[1].toLowerCase();
				continue;
			}

			const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
			if (!kvMatch) continue;

			const key = kvMatch[1].trim();
			const value = kvMatch[2].trim();

			// 根据 section 名称映射到资源字段
			const stateKey = currentSection as keyof ObjResource;
			if (stateKey in result) {
				if (key === "Image") {
					result[stateKey] = {
						...result[stateKey],
						image: normalizeObjImagePath(value),
					};
				} else if (key === "Sound") {
					result[stateKey] = {
						...result[stateKey],
						sound: normalizeObjSoundPath(value),
					};
				}
			}
		}

		return result;
	}
}

export const objService = new ObjService();

/**
 * NPC 服务
 * 使用 PostgreSQL 数据库存储，数据以 JSON 形式存储在 data 字段中
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */
import { TRPCError } from "@trpc/server";
import type {
	Npc,
	NpcKind,
	NpcRelation,
	CreateNpcInput,
	UpdateNpcInput,
	ListNpcInput,
	ImportNpcInput,
	BatchImportNpcInput,
	BatchImportNpcResult,
	NpcListItem,
	NpcResource,
} from "@miu2d/types";
import {
	NpcKindFromValue,
	NpcRelationFromValue,
	createDefaultNpc,
	createDefaultNpcResource,
	normalizeNpcImagePath,
	normalizeNpcSoundPath,
} from "@miu2d/types";
import { and, eq, desc } from "drizzle-orm";
import { db } from "../../db/client";
import { gameMembers, games, npcs } from "../../db/schema";
import type { Language } from "../../i18n";
import { getMessage } from "../../i18n";

export class NpcService {
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
	 * 将数据库记录转换为 Npc 类型
	 */
	private toNpc(row: typeof npcs.$inferSelect): Npc {
		const data = row.data as Omit<Npc, "id" | "gameId" | "key" | "name" | "kind" | "relation" | "createdAt" | "updatedAt">;
		return {
			...data,
			id: row.id,
			gameId: row.gameId,
			key: row.key,
			name: row.name,
			kind: row.kind as Npc["kind"],
			relation: row.relation as Npc["relation"],
			createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
			updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
		};
	}

	/**
	 * 公开接口：通过 slug 列出游戏的所有 NPC（无需认证）
	 * 用于游戏客户端加载 NPC 数据
	 */
	async listPublicBySlug(gameSlug: string): Promise<Npc[]> {
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
			.from(npcs)
			.where(eq(npcs.gameId, game.id))
			.orderBy(desc(npcs.updatedAt));

		return rows.map(row => this.toNpc(row));
	}

	/**
	 * 获取单个 NPC
	 */
	async get(
		gameId: string,
		npcId: string,
		userId: string,
		language: Language
	): Promise<Npc | null> {
		await this.verifyGameAccess(gameId, userId, language);

		const [row] = await db
			.select()
			.from(npcs)
			.where(and(eq(npcs.id, npcId), eq(npcs.gameId, gameId)))
			.limit(1);

		if (!row) return null;
		return this.toNpc(row);
	}

	/**
	 * 列出 NPC
	 */
	async list(
		input: ListNpcInput,
		userId: string,
		language: Language
	): Promise<NpcListItem[]> {
		await this.verifyGameAccess(input.gameId, userId, language);

		const conditions = [eq(npcs.gameId, input.gameId)];
		if (input.kind) {
			conditions.push(eq(npcs.kind, input.kind));
		}
		if (input.relation) {
			conditions.push(eq(npcs.relation, input.relation));
		}

		const rows = await db
			.select()
			.from(npcs)
			.where(and(...conditions))
			.orderBy(desc(npcs.updatedAt));

		return rows.map(row => {
			const data = row.data as Record<string, unknown>;
			const resources = data.resources as NpcResource | undefined;
			return {
				id: row.id,
				key: row.key,
				name: row.name,
				kind: row.kind as NpcKind,
				relation: row.relation as NpcRelation,
				level: (data.level as number) ?? 1,
				icon: resources?.stand?.image ?? null,
				updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
			};
		});
	}

	/**
	 * 创建 NPC
	 */
	async create(
		input: CreateNpcInput,
		userId: string,
		language: Language
	): Promise<Npc> {
		await this.verifyGameAccess(input.gameId, userId, language);

		const defaultNpc = createDefaultNpc(input.gameId, input.key);
		const fullNpc = {
			...defaultNpc,
			...input,
		};

		// 分离索引字段和 data 字段
		const { gameId, key, name, kind, relation, ...data } = fullNpc;

		const [row] = await db
			.insert(npcs)
			.values({
				gameId,
				key,
				name: name ?? "未命名NPC",
				kind: kind ?? "Normal",
				relation: relation ?? "Friendly",
				data,
			})
			.returning();

		return this.toNpc(row);
	}

	/**
	 * 更新 NPC
	 */
	async update(
		input: UpdateNpcInput,
		userId: string,
		language: Language
	): Promise<Npc> {
		await this.verifyGameAccess(input.gameId, userId, language);

		// 检查是否存在
		const existing = await this.get(input.gameId, input.id, userId, language);
		if (!existing) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: getMessage(language, "errors.npc.notFound")
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
			relation,
			createdAt: _createdAt,
			updatedAt: _updatedAt,
			...data
		} = merged;

		const [row] = await db
			.update(npcs)
			.set({
				key,
				name,
				kind,
				relation,
				data,
				updatedAt: new Date(),
			})
			.where(and(eq(npcs.id, id), eq(npcs.gameId, gameId)))
			.returning();

		return this.toNpc(row);
	}

	/**
	 * 删除 NPC
	 */
	async delete(
		gameId: string,
		npcId: string,
		userId: string,
		language: Language
	): Promise<{ id: string }> {
		await this.verifyGameAccess(gameId, userId, language);

		await db
			.delete(npcs)
			.where(and(eq(npcs.id, npcId), eq(npcs.gameId, gameId)));

		return { id: npcId };
	}

	/**
	 * 从 INI 导入 NPC
	 */
	async importFromIni(
		input: ImportNpcInput,
		userId: string,
		language: Language
	): Promise<Npc> {
		await this.verifyGameAccess(input.gameId, userId, language);

		const parsed = this.parseNpcIni(input.iniContent);

		// 如果有资源配置 INI，解析并合并
		if (input.npcResContent) {
			parsed.resources = this.parseNpcResIni(input.npcResContent);
		}

		// 使用文件名作为 key
		const key = input.fileName;

		return this.create({
			gameId: input.gameId,
			key,
			name: parsed.name ?? key.replace(/\.ini$/i, ""),
			kind: parsed.kind,
			relation: parsed.relation,
			...parsed,
		}, userId, language);
	}

	/**
	 * 批量导入 NPC
	 * 支持自动关联 npcres 配置
	 */
	async batchImportFromIni(
		input: BatchImportNpcInput,
		userId: string,
		language: Language
	): Promise<BatchImportNpcResult> {
		await this.verifyGameAccess(input.gameId, userId, language);

		const success: BatchImportNpcResult["success"] = [];
		const failed: BatchImportNpcResult["failed"] = [];

		for (const item of input.items) {
			try {
				const parsed = this.parseNpcIni(item.iniContent);
				const hasResources = !!item.npcResContent;

				// 如果有资源配置 INI，解析并合并
				if (item.npcResContent) {
					parsed.resources = this.parseNpcResIni(item.npcResContent);
				}

				// 使用文件名作为 key
				const key = item.fileName;

				const npc = await this.create({
					gameId: input.gameId,
					key,
					name: parsed.name ?? item.fileName.replace(/\.ini$/i, ""),
					kind: parsed.kind,
					relation: parsed.relation,
					...parsed,
				}, userId, language);

				success.push({
					fileName: item.fileName,
					id: npc.id,
					name: npc.name,
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
	 * 解析 NPC INI 内容（npc/*.ini）
	 */
	private parseNpcIni(content: string): Partial<Npc> {
		const result: Partial<Npc> = {};
		const lines = content.split(/\r?\n/);
		let currentSection = "";

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
				case "Name":
					result.name = value;
					break;
				case "NpcIni":
					// 存储原始的 npcres 文件名，用于自动关联
					// 但我们不需要这个字段了，因为资源已经内嵌到 resources 中
					break;
				case "FlyIni":
					result.flyIni = value || null;
					break;
				case "BodyIni":
					result.bodyIni = value || null;
					break;
				case "Kind":
					result.kind = NpcKindFromValue[parseInt(value, 10)] ?? "Normal";
					break;
				case "Relation":
					result.relation = NpcRelationFromValue[parseInt(value, 10)] ?? "Friendly";
					break;
				case "Life":
					result.life = parseInt(value, 10) || 100;
					break;
				case "LifeMax":
					result.lifeMax = parseInt(value, 10) || 100;
					break;
				case "Thew":
					result.thew = parseInt(value, 10) || 100;
					break;
				case "ThewMax":
					result.thewMax = parseInt(value, 10) || 100;
					break;
				case "Mana":
					result.mana = parseInt(value, 10) || 100;
					break;
				case "ManaMax":
					result.manaMax = parseInt(value, 10) || 100;
					break;
				case "Attack":
					result.attack = parseInt(value, 10) || 10;
					break;
				case "Defence":
				case "Defend":
					result.defend = parseInt(value, 10) || 5;
					break;
				case "Evade":
					result.evade = parseInt(value, 10) || 10;
					break;
				case "Exp":
					result.exp = parseInt(value, 10) || 0;
					break;
				case "ExpBonus":
					result.expBonus = parseInt(value, 10) || 0;
					break;
				case "WalkSpeed":
					result.walkSpeed = parseInt(value, 10) || 1;
					break;
				case "Dir":
					result.dir = parseInt(value, 10) || 0;
					break;
				case "Lum":
					result.lum = parseInt(value, 10) || 0;
					break;
				case "Level":
					result.level = parseInt(value, 10) || 1;
					break;
				case "AttackRadius":
					result.attackRadius = parseInt(value, 10) || 1;
					break;
				case "AttackLevel":
					result.attackLevel = parseInt(value, 10) || 1;
					break;
				case "PathFinder":
					result.pathFinder = parseInt(value, 10) || 1;
					break;
				case "Idle":
					result.idle = parseInt(value, 10) || 0;
					break;
				case "DeathScript":
					result.deathScript = value || null;
					break;
				case "ScriptFile":
					result.scriptFile = value || null;
					break;
			}
		}

		return result;
	}

	/**
	 * 解析 NPC 资源 INI 内容（npcres/*.ini）
	 */
	private parseNpcResIni(content: string): NpcResource {
		const result = createDefaultNpcResource();
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
			const stateKey = currentSection as keyof NpcResource;
			if (stateKey in result) {
				if (key === "Image") {
					// 规范化图像路径：相对路径添加 asf/character/ 前缀
					result[stateKey] = {
						...result[stateKey],
						image: normalizeNpcImagePath(value),
					};
				} else if (key === "Sound") {
					// 规范化音效路径：相对路径添加 Content/sound/ 前缀，.wav -> .xnb
					result[stateKey] = {
						...result[stateKey],
						sound: normalizeNpcSoundPath(value),
					};
				}
			}
		}

		return result;
	}
}

export const npcService = new NpcService();

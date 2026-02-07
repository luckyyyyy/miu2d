/**
 * Portrait（对话头像映射）服务
 * 使用 PostgreSQL 数据库存储
 * 每个游戏一条记录，data 字段存 PortraitEntry[] 数组
 */
import { TRPCError } from "@trpc/server";
import type {
	PortraitEntry,
	PortraitMap,
	UpdatePortraitMapInput,
	ImportPortraitMapInput,
} from "@miu2d/types";
import { parsePortraitIni } from "@miu2d/types";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { gameMembers, games, portraits } from "../../db/schema";
import type { Language } from "../../i18n";
import { getMessage } from "../../i18n";

export class PortraitService {
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
	 * 获取头像映射（不存在则返回空数组）
	 */
	async get(
		gameId: string,
		userId: string,
		language: Language
	): Promise<{ gameId: string; entries: PortraitEntry[] }> {
		await this.verifyGameAccess(gameId, userId, language);

		const [row] = await db
			.select()
			.from(portraits)
			.where(eq(portraits.gameId, gameId))
			.limit(1);

		return {
			gameId,
			entries: row ? (row.data as PortraitEntry[]) : [],
		};
	}

	/**
	 * 公开接口：通过 slug 获取头像映射（无需认证）
	 */
	async getPublicBySlug(gameSlug: string): Promise<PortraitEntry[]> {
		const [game] = await db
			.select({ id: games.id })
			.from(games)
			.where(eq(games.slug, gameSlug))
			.limit(1);

		if (!game) {
			throw new Error("Game not found");
		}

		const [row] = await db
			.select()
			.from(portraits)
			.where(eq(portraits.gameId, game.id))
			.limit(1);

		return row ? (row.data as PortraitEntry[]) : [];
	}

	/**
	 * 更新头像映射（upsert）
	 */
	async update(
		input: UpdatePortraitMapInput,
		userId: string,
		language: Language
	): Promise<{ gameId: string; entries: PortraitEntry[] }> {
		await this.verifyGameAccess(input.gameId, userId, language);

		const sorted = [...input.entries].sort((a, b) => a.idx - b.idx);

		const [existing] = await db
			.select()
			.from(portraits)
			.where(eq(portraits.gameId, input.gameId))
			.limit(1);

		if (existing) {
			await db
				.update(portraits)
				.set({
					data: sorted,
					updatedAt: new Date(),
				})
				.where(eq(portraits.gameId, input.gameId));
		} else {
			await db
				.insert(portraits)
				.values({
					gameId: input.gameId,
					data: sorted,
				});
		}

		return { gameId: input.gameId, entries: sorted };
	}

	/**
	 * 从 INI 导入头像映射
	 */
	async importFromIni(
		input: ImportPortraitMapInput,
		userId: string,
		language: Language
	): Promise<{ gameId: string; entries: PortraitEntry[] }> {
		await this.verifyGameAccess(input.gameId, userId, language);

		const entries = parsePortraitIni(input.iniContent);

		return this.update({
			gameId: input.gameId,
			entries,
		}, userId, language);
	}
}

export const portraitService = new PortraitService();

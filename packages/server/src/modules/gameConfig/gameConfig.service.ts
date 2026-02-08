/**
 * 游戏全局配置服务
 */
import { TRPCError } from "@trpc/server";
import type {
	GameConfig,
	GameConfigData,
	UpdateGameConfigInput,
} from "@miu2d/types";
import { createDefaultGameConfig, GameConfigDataSchema } from "@miu2d/types";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { gameConfigs, gameMembers, games } from "../../db/schema";
import type { Language } from "../../i18n";
import { getMessage } from "../../i18n";

export class GameConfigService {
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
	 * 将数据库记录转换为 GameConfig 类型
	 * 旧记录可能缺少后来新增的字段，用 Zod parse 补全默认值
	 */
	private toGameConfig(row: typeof gameConfigs.$inferSelect): GameConfig {
		const defaults = createDefaultGameConfig();
		const raw = row.data as Record<string, unknown>;
		const merged = { ...defaults, ...raw };
		const data = GameConfigDataSchema.parse(merged);
		return {
			id: row.id,
			gameId: row.gameId,
			data,
			createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
			updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
		};
	}

	/**
	 * 获取游戏配置（不存在则创建默认配置）
	 */
	async get(
		gameId: string,
		userId: string,
		language: Language
	): Promise<GameConfig> {
		await this.verifyGameAccess(gameId, userId, language);

		const [row] = await db
			.select()
			.from(gameConfigs)
			.where(eq(gameConfigs.gameId, gameId))
			.limit(1);

		if (row) {
			return this.toGameConfig(row);
		}

		// 不存在则创建默认配置
		const defaultData = createDefaultGameConfig();
		const [newRow] = await db
			.insert(gameConfigs)
			.values({
				gameId,
				data: defaultData,
			})
			.returning();

		return this.toGameConfig(newRow);
	}

	/**
	 * 更新游戏配置（不存在则创建）
	 */
	async update(
		input: UpdateGameConfigInput,
		userId: string,
		language: Language
	): Promise<GameConfig> {
		await this.verifyGameAccess(input.gameId, userId, language);

		const [existing] = await db
			.select()
			.from(gameConfigs)
			.where(eq(gameConfigs.gameId, input.gameId))
			.limit(1);

		if (existing) {
			const [updated] = await db
				.update(gameConfigs)
				.set({
					data: input.data,
					updatedAt: new Date(),
				})
				.where(eq(gameConfigs.gameId, input.gameId))
				.returning();

			return this.toGameConfig(updated);
		}

		// 不存在则创建
		const [newRow] = await db
			.insert(gameConfigs)
			.values({
				gameId: input.gameId,
				data: input.data,
			})
			.returning();

		return this.toGameConfig(newRow);
	}
	/**
	 * 公开接口：通过 slug 获取游戏配置（无需认证）
	 * 不存在则返回默认配置
	 */
	async getPublicBySlug(gameSlug: string): Promise<GameConfigData> {
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
			.from(gameConfigs)
			.where(eq(gameConfigs.gameId, game.id))
			.limit(1);

		if (row) {
			const config = this.toGameConfig(row).data;
			// playerKey 未设置时，不返回 player/drop 配置
			if (!config.playerKey) {
				const { player: _, drop: __, ...rest } = config;
				return rest;
			}
			return config;
		}

		// 不存在则返回默认配置
		return createDefaultGameConfig();
	}
}

export const gameConfigService = new GameConfigService();

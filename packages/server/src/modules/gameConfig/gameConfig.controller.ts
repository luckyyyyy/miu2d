/**
 * 游戏配置 REST Controller
 *
 * 提供公开的 REST API 接口，用于游戏客户端获取游戏全局配置
 * GET /game/:gameSlug/api/config - 获取游戏全局配置
 */
import { Controller, Get, Param, Res, Logger, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { gameConfigService } from "./gameConfig.service";

@Controller("game")
export class GameConfigController {
	private readonly logger = new Logger(GameConfigController.name);

	/**
	 * 获取游戏全局配置
	 *
	 * GET /game/:gameSlug/api/config
	 *
	 * 返回该游戏的全局配置，包括：
	 * - gameName: 游戏名称
	 * - gameVersion: 游戏版本
	 * - gameDescription: 游戏描述
	 * - playerKey: 主角配置 key
	 * - newGameScript: 新游戏脚本
	 * - player: 主角配置（移动速度、体力消耗、自然恢复、战斗参数）
	 * - drop: 掉落系统配置（掉落概率、装备等级映射、金钱掉落、药品掉落、Boss 加成）
	 *
	 * 这是公开接口，不需要认证，用于游戏客户端加载配置
	 */
	@Get(":gameSlug/api/config")
	async getConfig(
		@Param("gameSlug") gameSlug: string,
		@Res() res: Response
	) {
		try {
			this.logger.debug(`[getConfig] gameSlug=${gameSlug}`);

			const config = await gameConfigService.getPublicBySlug(gameSlug);

			// 设置缓存头（5 分钟）
			res.setHeader("Cache-Control", "public, max-age=300");
			res.setHeader("Access-Control-Allow-Origin", "*");

			res.status(HttpStatus.OK).json(config);
		} catch (error) {
			this.logger.error(`[getConfig] Error:`, error);

			if (error instanceof Error && error.message === "Game not found") {
				res.status(HttpStatus.NOT_FOUND).json({ error: "Game not found" });
				return;
			}

			res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
		}
	}
}

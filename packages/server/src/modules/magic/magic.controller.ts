/**
 * 武功 REST Controller
 *
 * 提供公开的 REST API 接口，用于游戏客户端获取武功数据
 * GET /game/:gameSlug/api/magic - 获取游戏的所有武功配置
 */
import { Controller, Get, Param, Res, Logger, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { magicService } from "./magic.service";

@Controller("game")
export class MagicController {
	private readonly logger = new Logger(MagicController.name);

	/**
	 * 获取游戏的所有武功配置
	 *
	 * GET /game/:gameSlug/api/magic
	 *
	 * 返回该游戏下所有武功的配置数据，按 userType 分组：
	 * { player: Magic[], npc: Magic[] }
	 * 这是公开接口，不需要认证，用于游戏客户端加载武功数据
	 */
	@Get(":gameSlug/api/magic")
	async listMagics(
		@Param("gameSlug") gameSlug: string,
		@Res() res: Response
	) {
		try {
			this.logger.debug(`[listMagics] gameSlug=${gameSlug}`);

			const magics = await magicService.listPublicBySlug(gameSlug);

			// 按 userType 分组
			const result = {
				player: magics.filter(m => m.userType === "player"),
				npc: magics.filter(m => m.userType === "npc"),
			};

			// 设置缓存头（5 分钟）
			res.setHeader("Cache-Control", "public, max-age=300");

			// 允许跨域访问
			res.setHeader("Access-Control-Allow-Origin", "*");

			res.status(HttpStatus.OK).json(result);
		} catch (error) {
			this.logger.error(`[listMagics] Error:`, error);

			if (error instanceof Error && error.message === "Game not found") {
				res.status(HttpStatus.NOT_FOUND).json({ error: "Game not found" });
				return;
			}

			res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
		}
	}
}

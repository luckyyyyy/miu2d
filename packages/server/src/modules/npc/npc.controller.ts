/**
 * NPC REST Controller
 *
 * 提供公开的 REST API 接口，用于游戏客户端获取 NPC 数据
 * GET /game/:gameSlug/api/npc - 获取游戏的所有 NPC 配置
 */
import { Controller, Get, Param, Res, Logger, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { npcService } from "./npc.service";

@Controller("game")
export class NpcController {
	private readonly logger = new Logger(NpcController.name);

	/**
	 * 获取游戏的所有 NPC 配置
	 *
	 * GET /game/:gameSlug/api/npc
	 *
	 * 返回该游戏下所有 NPC 的配置数据，按类型分组
	 * 这是公开接口，不需要认证，用于游戏客户端加载 NPC 数据
	 */
	@Get(":gameSlug/api/npc")
	async listNpcs(
		@Param("gameSlug") gameSlug: string,
		@Res() res: Response
	) {
		try {
			this.logger.debug(`[listNpcs] gameSlug=${gameSlug}`);

			const npcs = await npcService.listPublicBySlug(gameSlug);

			// 按 kind 分组
			const result = {
				normal: npcs.filter(n => n.kind === "Normal"),
				fighter: npcs.filter(n => n.kind === "Fighter"),
				flyer: npcs.filter(n => n.kind === "Flyer"),
				animal: npcs.filter(n => n.kind === "GroundAnimal" || n.kind === "WaterAnimal"),
				decoration: npcs.filter(n => n.kind === "Decoration" || n.kind === "Intangible"),
			};

			// 设置缓存头（5 分钟）
			res.setHeader("Cache-Control", "public, max-age=300");

			// 允许跨域访问
			res.setHeader("Access-Control-Allow-Origin", "*");

			res.status(HttpStatus.OK).json(result);
		} catch (error) {
			this.logger.error(`[listNpcs] Error:`, error);

			if (error instanceof Error && error.message === "Game not found") {
				res.status(HttpStatus.NOT_FOUND).json({ error: "Game not found" });
				return;
			}

			res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
		}
	}
}

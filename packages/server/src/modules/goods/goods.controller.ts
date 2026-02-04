/**
 * 物品 REST Controller
 *
 * 提供公开的 REST API 接口，用于游戏客户端获取物品数据
 * GET /game/:gameSlug/api/goods - 获取游戏的所有物品配置
 */
import { Controller, Get, Param, Res, Logger, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { goodsService } from "./goods.service";

@Controller("game")
export class GoodsController {
	private readonly logger = new Logger(GoodsController.name);

	/**
	 * 获取游戏的所有物品配置
	 *
	 * GET /game/:gameSlug/api/goods
	 *
	 * 返回该游戏下所有物品的配置数据（扁平数组）
	 * 这是公开接口，不需要认证，用于游戏客户端加载物品数据
	 */
	@Get(":gameSlug/api/goods")
	async listGoods(
		@Param("gameSlug") gameSlug: string,
		@Res() res: Response
	) {
		try {
			this.logger.debug(`[listGoods] gameSlug=${gameSlug}`);

			const goods = await goodsService.listPublicBySlug(gameSlug);

			// 设置缓存头（5 分钟）
			res.setHeader("Cache-Control", "public, max-age=300");

			// 允许跨域访问
			res.setHeader("Access-Control-Allow-Origin", "*");

			res.status(HttpStatus.OK).json(goods);
		} catch (error) {
			this.logger.error(`[listGoods] Error:`, error);

			if (error instanceof Error && error.message === "Game not found") {
				res.status(HttpStatus.NOT_FOUND).json({ error: "Game not found" });
				return;
			}

			res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
		}
	}
}

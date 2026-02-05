/**
 * Object REST Controller
 *
 * 提供公开的 REST API 接口，用于游戏客户端获取 Object 数据
 * GET /game/:gameSlug/api/obj - 获取游戏的所有 Object 配置
 */
import { Controller, Get, Param, Res, Logger, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { objService } from "./obj.service";

@Controller("game")
export class ObjController {
	private readonly logger = new Logger(ObjController.name);

	/**
	 * 获取游戏的所有 Object 配置
	 *
	 * GET /game/:gameSlug/api/obj
	 *
	 * 返回该游戏下所有 Object 的配置数据，按类型分组
	 * 这是公开接口，不需要认证，用于游戏客户端加载 Object 数据
	 */
	@Get(":gameSlug/api/obj")
	async listObjs(
		@Param("gameSlug") gameSlug: string,
		@Res() res: Response
	) {
		try {
			this.logger.debug(`[listObjs] gameSlug=${gameSlug}`);

			const objs = await objService.listPublicBySlug(gameSlug);

			// 按 kind 分组
			const result = {
				dynamic: objs.filter(o => o.kind === "Dynamic"),
				static: objs.filter(o => o.kind === "Static"),
				body: objs.filter(o => o.kind === "Body"),
				sound: objs.filter(o => o.kind === "LoopingSound" || o.kind === "RandSound"),
				door: objs.filter(o => o.kind === "Door"),
				trap: objs.filter(o => o.kind === "Trap"),
				drop: objs.filter(o => o.kind === "Drop"),
			};

			// 设置缓存头（5 分钟）
			res.setHeader("Cache-Control", "public, max-age=300");

			// 允许跨域访问
			res.setHeader("Access-Control-Allow-Origin", "*");

			res.status(HttpStatus.OK).json(result);
		} catch (error) {
			this.logger.error(`[listObjs] Error:`, error);
			res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
				error: "Failed to load objects"
			});
		}
	}
}

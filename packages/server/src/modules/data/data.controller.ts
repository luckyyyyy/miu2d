/**
 * Game Data REST Controller
 *
 * 提供统一的公开 REST API 接口，用于游戏客户端获取所有配置数据
 * GET /game/:gameSlug/api/data - 获取游戏的所有配置数据（武功、物品、NPC、物体）
 */
import { Controller, Get, Param, Res, Logger, HttpStatus } from "@nestjs/common";
import type { Response } from "express";
import { magicService } from "../magic/magic.service";
import { goodsService } from "../goods/goods.service";
import { npcService, npcResourceService } from "../npc";
import { objService, objResourceService } from "../obj";

@Controller("game")
export class DataController {
	private readonly logger = new Logger(DataController.name);

	/**
	 * 获取游戏的所有配置数据
	 *
	 * GET /game/:gameSlug/api/data
	 *
	 * 返回该游戏下所有配置数据，包括：
	 * - magics: 武功配置（按 userType 分组）
	 * - goods: 物品配置（扁平数组）
	 * - npcs: NPC 配置（包含 npcs 数组和 resources 数组）
	 * - objs: 物体配置（包含 objs 数组和 resources 数组）
	 *
	 * 这是公开接口，不需要认证，用于游戏客户端加载配置数据
	 */
	@Get(":gameSlug/api/data")
	async getData(
		@Param("gameSlug") gameSlug: string,
		@Res() res: Response
	) {
		try {
			this.logger.debug(`[getData] gameSlug=${gameSlug}`);

			// 并行加载所有数据
			const [magics, goods, npcs, npcResources, objs, objResources] = await Promise.all([
				magicService.listPublicBySlug(gameSlug),
				goodsService.listPublicBySlug(gameSlug),
				npcService.listPublicBySlug(gameSlug),
				npcResourceService.listPublicBySlug(gameSlug),
				objService.listPublicBySlug(gameSlug),
				objResourceService.listPublicBySlug(gameSlug),
			]);

			// 构建 objResources 的 id -> resources 映射
			const objResourceMap = new Map(
				objResources.map(r => [r.id, r.resources])
			);

			// 为每个 obj 合并 resources 数据
			const objsWithResources = objs.map(obj => ({
				...obj,
				// 根据 resourceId 查找并合并 resources，没有则为空对象
				resources: obj.resourceId ? objResourceMap.get(obj.resourceId) ?? {} : {},
			}));

			// 构建响应
			const result = {
				// 武功按 userType 分组
				magics: {
					player: magics.filter(m => m.userType === "player"),
					npc: magics.filter(m => m.userType === "npc"),
				},
				// 物品扁平数组
				goods,
				// NPC: 包含 npcs 数组和 resources 数组
				npcs: {
					npcs: npcs,
					resources: npcResources,
				},
				// 物体: 包含 objs 数组（已合并 resources）和 resources 数组
				objs: {
					objs: objsWithResources,
					resources: objResources,
				},
			};

			// 设置缓存头（5 分钟）
			res.setHeader("Cache-Control", "public, max-age=300");

			// 允许跨域访问
			res.setHeader("Access-Control-Allow-Origin", "*");

			res.status(HttpStatus.OK).json(result);
		} catch (error) {
			this.logger.error(`[getData] Error:`, error);

			if (error instanceof Error && error.message === "Game not found") {
				res.status(HttpStatus.NOT_FOUND).json({ error: "Game not found" });
				return;
			}

			res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
		}
	}
}

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
import { shopService } from "../shop/shop.service";
import { npcService, npcResourceService } from "../npc";
import { objService, objResourceService } from "../obj";
import { playerService } from "../player";
import { portraitService } from "../portrait";
import { gameConfigService } from "../gameConfig/gameConfig.service";

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
	 * - shops: 商店配置（扁平数组）
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

			// 检查游戏是否已开放（不存在/未公开/未启用均返回 404）
			const config = await gameConfigService.getPublicBySlug(gameSlug);
			if (!config.gameEnabled) {
				res.status(HttpStatus.NOT_FOUND).json({ error: "Not found" });
				return;
			}

			// 并行加载所有数据
			const [magics, goods, shops, npcs, npcResources, objs, objResources, playersList, portraitEntries] = await Promise.all([
				magicService.listPublicBySlug(gameSlug),
				goodsService.listPublicBySlug(gameSlug),
				shopService.listPublicBySlug(gameSlug),
				npcService.listPublicBySlug(gameSlug),
				npcResourceService.listPublicBySlug(gameSlug),
				objService.listPublicBySlug(gameSlug),
				objResourceService.listPublicBySlug(gameSlug),
				playerService.listPublicBySlug(gameSlug),
				portraitService.getPublicBySlug(gameSlug),
			]);

			// 构建 objResources 的 id -> { resources, key } 映射
			const objResourceMap = new Map(
				objResources.map(r => [r.id, { resources: r.resources, key: r.key }])
			);

			// 为每个 obj 合并 resources 数据，并附带 resourceKey（objres 文件名）
			const objsWithResources = objs.map(obj => {
				const resEntry = obj.resourceId ? objResourceMap.get(obj.resourceId) : null;
				return {
					...obj,
					resources: resEntry?.resources ?? {},
					resourceKey: resEntry?.key ?? null,
				};
			});

			// 构建 npcResources 的 id -> { resources, key } 映射
			const npcResourceMap = new Map(
				npcResources.map(r => [r.id, { resources: r.resources, key: r.key }])
			);

			// 为每个 npc 合并 resources 数据，并附带 resourceKey（npcres 文件名）
			const npcsWithResources = npcs.map(npc => {
				const resEntry = npc.resourceId ? npcResourceMap.get(npc.resourceId) : null;
				return {
					...npc,
					resources: npc.resources ?? resEntry?.resources ?? {},
					resourceKey: resEntry?.key ?? null,
				};
			});

			// 构建响应
			const result = {
				// 武功按 userType 分组
				magics: {
					player: magics.filter(m => m.userType === "player"),
					npc: magics.filter(m => m.userType === "npc"),
				},
				// 物品扁平数组
				goods,
				// 商店扁平数组
				shops,
				// NPC: 包含 npcs 数组（已合并 resources）和 resources 数组
				npcs: {
					npcs: npcsWithResources,
					resources: npcResources,
				},
				// 物体: 包含 objs 数组（已合并 resources）和 resources 数组
				objs: {
					objs: objsWithResources,
					resources: objResources,
				},
				// 玩家角色列表
				players: playersList,
				// 对话头像映射
				portraits: portraitEntries,
			};

			// 设置缓存头（5 分钟）
			res.setHeader("Cache-Control", "public, max-age=300");

			// 允许跨域访问
			res.setHeader("Access-Control-Allow-Origin", "*");

			res.status(HttpStatus.OK).json(result);
		} catch (error) {
			this.logger.error(`[getData] Error:`, error);
			res.status(HttpStatus.NOT_FOUND).json({ error: "Not found" });
		}
	}
}

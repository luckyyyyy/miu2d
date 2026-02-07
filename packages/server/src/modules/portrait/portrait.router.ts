/**
 * Portrait（对话头像映射）tRPC 路由
 */
import { Logger } from "@nestjs/common";
import { z } from "zod";
import {
	PortraitMapResultSchema,
	GetPortraitMapInputSchema,
	UpdatePortraitMapInputSchema,
	ImportPortraitMapInputSchema,
} from "@miu2d/types";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { portraitService } from "./portrait.service";

@Router({ alias: "portrait" })
export class PortraitRouter {
	private readonly logger = new Logger(PortraitRouter.name);

	constructor() {
		this.logger.log("PortraitRouter registered");
	}

	/**
	 * 获取头像映射
	 */
	@UseMiddlewares(requireUser)
	@Query({ input: GetPortraitMapInputSchema, output: PortraitMapResultSchema })
	async get(input: z.infer<typeof GetPortraitMapInputSchema>, @Ctx() ctx: Context) {
		return portraitService.get(input.gameId, ctx.userId!, ctx.language);
	}

	/**
	 * 更新头像映射
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: UpdatePortraitMapInputSchema, output: PortraitMapResultSchema })
	async update(input: z.infer<typeof UpdatePortraitMapInputSchema>, @Ctx() ctx: Context) {
		return portraitService.update(input, ctx.userId!, ctx.language);
	}

	/**
	 * 从 INI 导入头像映射
	 */
	@UseMiddlewares(requireUser)
	@Mutation({ input: ImportPortraitMapInputSchema, output: PortraitMapResultSchema })
	async importFromIni(input: z.infer<typeof ImportPortraitMapInputSchema>, @Ctx() ctx: Context) {
		return portraitService.importFromIni(input, ctx.userId!, ctx.language);
	}
}

import { Logger } from "@nestjs/common";
import { z } from "zod";
import {
	GameSchema,
	CreateGameInputSchema,
	UpdateGameInputSchema,
	DeleteGameInputSchema
} from "@miu2d/types";
import type { Context } from "../../trpc/context";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { gameService, toGameOutput } from "./game.service";

@Router({ alias: "game" })
export class GameRouter {
	private readonly logger = new Logger(GameRouter.name);

	constructor() {
		this.logger.log("GameRouter registered");
	}

	@UseMiddlewares(requireUser)
	@Query({ output: z.array(GameSchema) })
	async list(@Ctx() ctx: Context) {
		const games = await gameService.listByUser(ctx.userId!);
		return games.map(toGameOutput);
	}

	@UseMiddlewares(requireUser)
	@Query({
		input: z.object({ slug: z.string() }),
		output: GameSchema.nullable()
	})
	async getBySlug(input: { slug: string }, @Ctx() ctx: Context) {
		const game = await gameService.getBySlug(input.slug, ctx.userId!);
		return game ? toGameOutput(game) : null;
	}

	@UseMiddlewares(requireUser)
	@Mutation({ input: CreateGameInputSchema, output: GameSchema })
	async create(input: z.infer<typeof CreateGameInputSchema>, @Ctx() ctx: Context) {
		const game = await gameService.create(input, ctx.userId!);
		return toGameOutput(game);
	}

	@UseMiddlewares(requireUser)
	@Mutation({ input: UpdateGameInputSchema, output: GameSchema })
	async update(input: z.infer<typeof UpdateGameInputSchema>, @Ctx() ctx: Context) {
		const updated = await gameService.update(input.id, input, ctx.userId!, ctx.language);
		return toGameOutput(updated);
	}

	@UseMiddlewares(requireUser)
	@Mutation({ input: DeleteGameInputSchema, output: z.object({ id: z.string() }) })
	async delete(input: z.infer<typeof DeleteGameInputSchema>, @Ctx() ctx: Context) {
		return gameService.delete(input.id, ctx.userId!, ctx.language);
	}
}

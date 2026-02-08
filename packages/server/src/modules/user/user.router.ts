import { TRPCError } from "@trpc/server";
import { Logger } from "@nestjs/common";
import { z } from "zod";
import { UserSchema, UserSettingsPatchSchema } from "@miu2d/types";
import { Ctx, Mutation, Query, Router, UseMiddlewares } from "../../trpc/decorators";
import type { Context } from "../../trpc/context";
import { requireUser } from "../../trpc/middlewares";
import { getMessage } from "../../i18n";
import { userService, toUserOutput } from "./user.service";

export const userProfileOutput = UserSchema;

export const userUpdateInput = z.object({
	name: z.string().min(1).optional(),
	email: z.string().email().optional(),
	settings: UserSettingsPatchSchema.nullable().optional()
});

@Router({ alias: "user" })
export class UserRouter {
	private readonly logger = new Logger(UserRouter.name);

	constructor() {
		this.logger.log("UserRouter registered");
	}
	@Query({ output: userProfileOutput })
	@UseMiddlewares(requireUser)
	async getProfile(@Ctx() ctx: Context) {
		const user = await userService.getById(ctx.userId!);
		if (!user) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: getMessage(ctx.language, "errors.user.notFound")
			});
		}
		return toUserOutput(user);
	}

	@Mutation({ input: userUpdateInput, output: userProfileOutput })
	@UseMiddlewares(requireUser)
	async updateProfile(input: z.infer<typeof userUpdateInput>, @Ctx() ctx: Context) {
		const updated = await userService.updateProfile(ctx.userId!, {
			name: input.name,
			email: input.email,
			settings: input.settings
		}, ctx.language);
		return toUserOutput(updated);
	}

	@Mutation({ output: userProfileOutput })
	@UseMiddlewares(requireUser)
	async deleteAvatar(@Ctx() ctx: Context) {
		const updated = await userService.deleteAvatar(ctx.userId!, ctx.language);
		return toUserOutput(updated);
	}
}

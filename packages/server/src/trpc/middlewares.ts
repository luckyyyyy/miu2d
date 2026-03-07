import { TRPCError } from "@trpc/server";
import type { MiddlewareResult } from "@trpc/server/unstable-core-do-not-import";
import { getMessage } from "../i18n";
import type { Context } from "./context";

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const requireUser = async ({
  ctx,
  next,
}: {
  ctx: Context;
  next: (opts?: { ctx?: Context }) => Promise<MiddlewareResult<Context>>;
}): Promise<MiddlewareResult<Context>> => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: getMessage(ctx.language, "errors.common.unauthorized"),
    });
  }
  return next();
};

export const requireGame = async ({
  ctx,
  next,
}: {
  ctx: Context;
  next: (opts?: { ctx?: Context }) => Promise<MiddlewareResult<Context>>;
}): Promise<MiddlewareResult<Context>> => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: getMessage(ctx.language, "errors.common.unauthorized"),
    });
  }

  if (!ctx.gameKey) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: getMessage(ctx.language, "errors.common.missingGame"),
    });
  }

  const game = await ctx.db.game.findFirst({
    where: isUuid(ctx.gameKey)
      ? { OR: [{ id: ctx.gameKey }, { slug: ctx.gameKey }] }
      : { slug: ctx.gameKey },
  });

  if (!game) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: getMessage(ctx.language, "errors.game.notFound"),
    });
  }

  const membership = await ctx.db.gameMember.findFirst({
    where: { gameId: game.id, userId: ctx.userId },
  });

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: getMessage(ctx.language, "errors.common.gameForbidden"),
    });
  }

  return next({ ctx: { ...ctx, game } });
};

import { TRPCError } from "@trpc/server";
import type { Game } from "@prisma/client";
import { db } from "../../db/client";
import { getMessage, type Language } from "../../i18n";

export const toGameOutput = (dbGame: Game) => ({
  id: dbGame.id,
  slug: dbGame.slug,
  name: dbGame.name,
  description: dbGame.description,
  createdAt: dbGame.createdAt?.toISOString(),
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export class GameService {
  private async isOwner(gameId: string, userId: string): Promise<boolean> {
    const member = await db.gameMember.findFirst({
      where: { gameId, userId },
      select: { role: true },
    });
    return member?.role === "owner";
  }

  async listByUser(userId: string) {
    const members = await db.gameMember.findMany({
      where: { userId },
      include: { game: true },
    });
    return members.map((m) => m.game);
  }

  async getBySlug(slug: string, userId: string) {
    const member = await db.gameMember.findFirst({
      where: { userId, game: { slug } },
      include: { game: true },
    });
    return member?.game ?? null;
  }

  async getById(id: string) {
    const game = await db.game.findFirst({ where: { id } });
    return game ?? null;
  }

  /**
   * 公开查询：通过 slug 查找游戏（不需要登录）
   */
  async getPublicBySlug(slug: string) {
    const game = await db.game.findFirst({ where: { slug } });
    return game ?? null;
  }

  async ensureUniqueSlug(baseSlug: string) {
    let slug = baseSlug;
    let suffix = 1;

    // eslint-disable-next-line no-constant-condition
    // biome-ignore lint/nursery/noUnnecessaryConditions: intentional infinite loop with break
    while (true) {
      const existing = await db.game.findFirst({ where: { slug }, select: { id: true } });
      if (!existing) break;
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    return slug;
  }

  async create(
    input: { name: string; slug?: string; description?: string | null },
    userId: string
  ) {
    const baseSlug = input.slug?.trim() || slugify(input.name) || "game";
    const slug = await this.ensureUniqueSlug(baseSlug);

    const result = await db.$transaction(async (tx) => {
      const game = await tx.game.create({
        data: {
          name: input.name,
          slug,
          description: input.description ?? null,
        },
      });

      await tx.gameMember.create({
        data: {
          gameId: game.id,
          userId,
          role: "owner",
        },
      });

      return game;
    });

    return result;
  }

  async update(
    id: string,
    input: { name?: string; slug?: string; description?: string | null },
    userId: string,
    language: Language
  ) {
    const game = await this.getById(id);
    if (!game) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.game.notFound"),
      });
    }

    if (!(await this.isOwner(id, userId))) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: getMessage(language, "errors.game.onlyOwnerCanUpdate"),
      });
    }

    let newSlug = game.slug;
    if (input.slug && input.slug !== game.slug) {
      const existing = await db.game.findFirst({
        where: { slug: input.slug },
        select: { id: true },
      });

      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: getMessage(language, "errors.game.slugExists"),
        });
      }

      newSlug = input.slug;
    }

    const updated = await db.game.update({
      where: { id },
      data: {
        name: input.name ?? game.name,
        slug: newSlug,
        description: input.description !== undefined ? input.description : game.description,
      },
    });

    return updated;
  }

  async delete(id: string, userId: string, language: Language) {
    const game = await this.getById(id);
    if (!game) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.game.notFound"),
      });
    }

    if (!(await this.isOwner(id, userId))) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: getMessage(language, "errors.game.onlyOwnerCanDelete"),
      });
    }

    await db.$transaction(async (tx) => {
      await tx.gameMember.deleteMany({ where: { gameId: id } });
      await tx.game.delete({ where: { id } });
    });

    return { id };
  }

  /**
   * 转让游戏所有权（只操作 game_members，无冗余字段）
   */
  async transferOwner(
    id: string,
    newOwnerId: string,
    currentUserId: string,
    language: Language
  ) {
    const game = await this.getById(id);
    if (!game) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.game.notFound"),
      });
    }

    if (!(await this.isOwner(id, currentUserId))) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: getMessage(language, "errors.game.onlyOwnerCanTransfer"),
      });
    }

    // 验证新所有者存在
    const targetUser = await db.user.findFirst({
      where: { id: newOwnerId },
      select: { id: true },
    });

    if (!targetUser) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.game.newOwnerNotFound"),
      });
    }

    return db.$transaction(async (tx) => {
      // 1. 把当前所有者降为 member
      await tx.gameMember.updateMany({
        where: { gameId: id, userId: currentUserId },
        data: { role: "member" },
      });

      // 2. 新所有者：已是成员则升级，否则插入
      const existingMember = await tx.gameMember.findFirst({
        where: { gameId: id, userId: newOwnerId },
        select: { id: true },
      });

      if (existingMember) {
        await tx.gameMember.updateMany({
          where: { gameId: id, userId: newOwnerId },
          data: { role: "owner" },
        });
      } else {
        await tx.gameMember.create({
          data: {
            gameId: id,
            userId: newOwnerId,
            role: "owner",
          },
        });
      }

      return game;
    });
  }
}

export const gameService = new GameService();

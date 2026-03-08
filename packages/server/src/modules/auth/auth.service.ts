import type { UserSettings } from "@miu2d/types";
import type { User } from "@prisma/client";
import { db } from "../../db/client";
import { env } from "../../env";
import { hashPassword } from "../../utils/password";

const SESSION_COOKIE_NAME = "SESSION_ID";
const SESSION_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 7;

export const toUserOutput = (user: User) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role as "admin" | "user",
  emailVerified: user.emailVerified,
  settings: (user.settings as UserSettings | null) ?? null,
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export class AuthService {
  async getUserByEmail(email: string) {
    const user = await db.user.findFirst({ where: { email } });
    return user ?? null;
  }

  async getDefaultGameSlug(userId: string) {
    const member = await db.gameMember.findFirst({
      where: { userId },
      include: { game: { select: { slug: true, createdAt: true } } },
      orderBy: { game: { createdAt: "asc" } },
    });
    return member?.game.slug ?? null;
  }

  async ensureUniqueGameSlug(base: string) {
    const baseSlug = slugify(base) || "game";
    let slug = baseSlug;
    let suffix = 1;

    // eslint-disable-next-line no-constant-condition
    // biome-ignore lint/nursery/noUnnecessaryConditions: intentional infinite loop with return/break
    while (true) {
      const existing = await db.game.findFirst({ where: { slug }, select: { id: true } });
      if (!existing) return slug;
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
  }

  async createSession(userId: string) {
    const expiresAt = new Date(Date.now() + SESSION_COOKIE_MAX_AGE);
    const session = await db.session.create({
      data: { userId, expiresAt },
      select: { id: true },
    });
    return session.id;
  }

  async deleteSession(sessionId: string) {
    await db.session.delete({ where: { id: sessionId } });
  }

  async registerUser(input: { name: string; email: string; password: string }) {
    const gameName = `${input.name}的游戏`;
    const gameSlug = await this.ensureUniqueGameSlug(gameName);

    const result = await db.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash: await hashPassword(input.password),
          role: "user",
        },
      });

      const createdGame = await tx.game.create({
        data: {
          slug: gameSlug,
          name: gameName,
          description: "默认游戏",
        },
      });

      await tx.gameMember.create({
        data: {
          gameId: createdGame.id,
          userId: createdUser.id,
          role: "owner",
        },
      });

      return { user: createdUser, game: createdGame };
    });

    return result;
  }

  setSessionCookie(
    res:
      | { setCookie: (name: string, value: string, options: Record<string, unknown>) => void }
      | undefined,
    sessionId: string
  ) {
    if (!res) return;
    const cookieSecure = env.cookieSecure;
    res.setCookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure,
      maxAge: SESSION_COOKIE_MAX_AGE,
      path: "/",
    });
  }

  clearSessionCookie(
    res: { deleteCookie: (name: string, options: Record<string, unknown>) => void } | undefined
  ) {
    if (!res) return;
    const cookieSecure = env.cookieSecure;
    res.deleteCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure,
      path: "/",
    });
  }
}

export const authService = new AuthService();

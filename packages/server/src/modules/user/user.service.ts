import type { UserSettings } from "@miu2d/types";
import { TRPCError } from "@trpc/server";
import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { db } from "../../db/client";
import { getMessage, type Language } from "../../i18n";
import { hashPassword, verifyPassword } from "../../utils/password";

export const toUserOutput = (user: User) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role as "admin" | "user",
  emailVerified: user.emailVerified,
  settings: (user.settings as UserSettings | null) ?? null,
});

export class UserService {
  async getById(userId: string) {
    const user = await db.user.findFirst({ where: { id: userId } });
    return user ?? null;
  }

  async getByEmail(email: string) {
    const user = await db.user.findFirst({ where: { email } });
    return user ?? null;
  }

  async checkEmailExists(email: string, excludeUserId?: string) {
    const existing = await db.user.findFirst({
      where: {
        email,
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
      },
      select: { id: true },
    });
    return !!existing;
  }

  async updateProfile(
    userId: string,
    updates: {
      name?: string;
      email?: string;
      settings?: Partial<UserSettings> | null;
    },
    language: Language
  ) {
    if (updates.email) {
      const emailExists = await this.checkEmailExists(updates.email, userId);
      if (emailExists) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: getMessage(language, "errors.user.emailInUse"),
        });
      }
    }

    const dbUpdates: {
      name?: string;
      email?: string;
      settings?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
    } = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name.trim();
    if (updates.email !== undefined) dbUpdates.email = updates.email.trim();

    if (updates.settings !== undefined) {
      if (updates.settings === null) {
        dbUpdates.settings = Prisma.JsonNull;
      } else {
        const current = await db.user.findFirst({
          where: { id: userId },
          select: { settings: true },
        });
        const currentSettings = (current?.settings as UserSettings | null) ?? {};
        dbUpdates.settings = { ...currentSettings, ...updates.settings };
      }
    }

    if (Object.keys(dbUpdates).length === 0) {
      const user = await this.getById(userId);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: getMessage(language, "errors.user.notFound"),
        });
      }
      return user;
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: dbUpdates,
    });

    return updated;
  }

  async deleteAvatar(userId: string, language: Language) {
    const current = await db.user.findFirst({
      where: { id: userId },
      select: { settings: true },
    });

    const currentSettings = (current?.settings as UserSettings | null) ?? {};
    const nextSettings = { ...currentSettings, avatarUrl: null };

    const updated = await db.user.update({
      where: { id: userId },
      data: { settings: nextSettings },
    });

    if (!updated) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.user.notFound"),
      });
    }

    return updated;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    language: Language
  ) {
    const user = await this.getById(userId);
    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.user.notFound"),
      });
    }

    const passwordValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordValid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: getMessage(language, "errors.user.wrongPassword"),
      });
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    return updated;
  }
}

export const userService = new UserService();

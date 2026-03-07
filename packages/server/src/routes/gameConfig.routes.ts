/**
 * 游戏配置 REST 路由（Hono）
 *
 * GET /game/:gameSlug/api/config    - 获取游戏全局配置
 * GET /game/:gameSlug/api/manifest  - 获取游戏专属 PWA Manifest（动态）
 * GET /game/:gameSlug/api/logo      - 获取游戏 Logo 原图
 * GET /game/:gameSlug/api/logo/:size - 获取指定尺寸 Logo（128/192/512）
 * POST /game/:gameSlug/api/logo     - 上传游戏 Logo（>=512px，自动生成多尺寸，需认证）
 * DELETE /game/:gameSlug/api/logo   - 删除游戏 Logo（需认证）
 */

import { createDefaultGameConfig, GameConfigDataSchema } from "@miu2d/types";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import sharp from "sharp";
import type { Prisma } from "@prisma/client";
import { db } from "../db/client";
import { gameConfigService } from "../modules/gameConfig/gameConfig.service";
import * as s3 from "../storage/s3";
import { Logger } from "../utils/logger";
import { resolveUserId } from "../utils/session";

const logger = new Logger("GameConfigRoutes");

/** PWA 图标尺寸规格 */
const LOGO_SIZES = [512, 192, 128] as const;
type LogoSize = (typeof LOGO_SIZES)[number];

/** Logo 在 S3 中的存储 key（原图） */
function logoStorageKey(gameId: string): string {
  return `games/${gameId}/_logo`;
}

/** Logo 指定尺寸变体的存储 key */
function logoSizedKey(gameId: string, size: LogoSize): string {
  return `games/${gameId}/_logo_${size}`;
}

/** 所有尺寸变体 + 原图的 key 列表 */
function allLogoKeys(gameId: string): string[] {
  return [
    logoStorageKey(gameId),
    ...LOGO_SIZES.map((size) => logoSizedKey(gameId, size)),
  ];
}

/**
 * 将原图缩放并生成所有 PWA 尺寸变体，返回 Buffer 数组
 */
async function generateLogoVariants(src: Buffer): Promise<Array<{ size: LogoSize; buf: Buffer }>> {
  const results: Array<{ size: LogoSize; buf: Buffer }> = [];
  for (const size of LOGO_SIZES) {
    const buf = await sharp(src)
      .resize(size, size, { fit: "cover", kernel: "lanczos3" })
      .png()
      .toBuffer();
    results.push({ size, buf });
  }
  return results;
}

export const gameConfigRoutes = new Hono();

/**
 * 获取游戏全局配置
 */
gameConfigRoutes.get(":gameSlug/api/config", async (c) => {
  try {
    const gameSlug = c.req.param("gameSlug");
    logger.debug(`[getConfig] gameSlug=${gameSlug}`);

    const config = await gameConfigService.getPublicBySlug(gameSlug);

    c.header("Cache-Control", "public, max-age=300");

    return c.json(config);
  } catch (error) {
    logger.error("[getConfig] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * 获取游戏专属 PWA Manifest（动态生成，含游戏名称/图标/start_url）
 */
gameConfigRoutes.get(":gameSlug/api/manifest", async (c) => {
  try {
    const gameSlug = c.req.param("gameSlug");

    const game = await db.game.findFirst({
      where: { slug: gameSlug },
      select: { id: true, name: true },
    });

    if (!game) {
      return c.json({ error: "Game not found" }, 404);
    }

    const startUrl = `/game/${gameSlug}/`;

    // 检查游戏是否有自定义 logo（上传时已自动生成 192/512 变体）
    let hasLogo = false;
    try {
      hasLogo = await s3.fileExists(logoSizedKey(game.id, 512));
    } catch {
      // ignore
    }

    const icons: Array<{ src: string; sizes: string; type: string; purpose: "any" | "maskable" }> = hasLogo
      ? [
          { src: `/game/${gameSlug}/api/logo/512`, sizes: "512x512", type: "image/png", purpose: "any" },
          { src: `/game/${gameSlug}/api/logo/192`, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: `/game/${gameSlug}/api/logo/512`, sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: `/game/${gameSlug}/api/logo/192`, sizes: "192x192", type: "image/png", purpose: "maskable" },
        ]
      : [
          { src: "/icons/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/pwa-maskable-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ];

    const manifest = {
      id: startUrl,
      name: game.name,
      short_name: game.name,
      description: `Play ${game.name} online`,
      start_url: startUrl,
      scope: `/game/${gameSlug}/`,
      display: "standalone",
      orientation: "landscape",
      background_color: "#000000",
      theme_color: "#1a1a2e",
      lang: "zh-CN",
      categories: ["games", "entertainment"],
      icons,
    };

    c.header("Content-Type", "application/manifest+json");
    c.header("Cache-Control", "public, max-age=300");

    return c.json(manifest);
  } catch (error) {
    logger.error("[getManifest] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * 获取游戏 Logo 图片（原图）
 */
gameConfigRoutes.get(":gameSlug/api/logo", async (c) => {
  try {
    const gameSlug = c.req.param("gameSlug");

    const game = await db.game.findFirst({
      where: { slug: gameSlug },
      select: { id: true },
    });

    if (!game) {
      return c.json({ error: "Game not found" }, 404);
    }

    const key = logoStorageKey(game.id);
    const { stream: fileStream, contentType, contentLength } = await s3.getFileStream(key);

    c.header("Content-Type", contentType || "image/png");
    if (contentLength) c.header("Content-Length", String(contentLength));
    c.header("Cache-Control", "public, max-age=3600");

    return stream(c, async (s) => {
      for await (const chunk of fileStream) {
        await s.write(chunk as Uint8Array);
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === "NoSuchKey") {
      return c.json({ error: "Logo not found" }, 404);
    }
    logger.error("[getLogo] Error:", error);
    return c.json({ error: "Logo not found" }, 404);
  }
});

/**
 * 获取游戏 Logo 指定尺寸变体（128/192/512）
 */
gameConfigRoutes.get(":gameSlug/api/logo/:size", async (c) => {
  try {
    const gameSlug = c.req.param("gameSlug");
    const sizeParam = Number(c.req.param("size"));

    if (!LOGO_SIZES.includes(sizeParam as LogoSize)) {
      return c.json({ error: `Invalid size. Allowed: ${LOGO_SIZES.join(", ")}` }, 400);
    }
    const size = sizeParam as LogoSize;

    const game = await db.game.findFirst({
      where: { slug: gameSlug },
      select: { id: true },
    });

    if (!game) {
      return c.json({ error: "Game not found" }, 404);
    }

    const key = logoSizedKey(game.id, size);
    const { stream: fileStream, contentType, contentLength } = await s3.getFileStream(key);

    c.header("Content-Type", contentType || "image/png");
    if (contentLength) c.header("Content-Length", String(contentLength));
    c.header("Cache-Control", "public, max-age=86400");

    return stream(c, async (s) => {
      for await (const chunk of fileStream) {
        await s.write(chunk as Uint8Array);
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name === "NoSuchKey") {
      return c.json({ error: "Logo not found" }, 404);
    }
    logger.error("[getLogoSized] Error:", error);
    return c.json({ error: "Logo not found" }, 404);
  }
});

/**
 * 上传游戏 Logo
 */
gameConfigRoutes.post(":gameSlug/api/logo", async (c) => {
  try {
    const gameSlug = c.req.param("gameSlug");

    // 认证
    const userId = await resolveUserId(c.req.header("cookie") ?? null);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // 查找游戏
    const game = await db.game.findFirst({
      where: { slug: gameSlug },
      select: { id: true },
    });

    if (!game) {
      return c.json({ error: "Game not found" }, 404);
    }

    // 检查权限
    const member = await db.gameMember.findFirst({
      where: { gameId: game.id, userId },
    });

    if (!member) {
      return c.json({ error: "No access" }, 403);
    }

    // 读取 body
    const body = Buffer.from(await c.req.arrayBuffer());

    if (body.length === 0) {
      return c.json({ error: "Empty body" }, 400);
    }

    if (body.length > 5 * 1024 * 1024) {
      return c.json({ error: "File too large (max 5MB)" }, 400);
    }

    // 验证图片尺寸：必须 >= 512x512
    const metadata = await sharp(body).metadata();
    if (!metadata.width || !metadata.height || metadata.width < 512 || metadata.height < 512) {
      return c.json(
        { error: `Logo must be at least 512x512 pixels (got ${metadata.width ?? 0}x${metadata.height ?? 0})` },
        400,
      );
    }

    // 生成所有尺寸变体（512/192/128）
    const variants = await generateLogoVariants(body);

    const contentType = c.req.header("content-type") || "image/png";
    const key = logoStorageKey(game.id);

    // 上传原图 + 所有变体
    await s3.uploadFile(key, body, contentType);
    await Promise.all(
      variants.map(({ size, buf }) =>
        s3.uploadFile(logoSizedKey(game.id, size), buf, "image/png"),
      ),
    );

    const logoUrl = `/game/${gameSlug}/api/logo`;
    try {
      const existing = await db.gameConfig.findFirst({ where: { gameId: game.id } });

      if (existing) {
        const defaults = createDefaultGameConfig();
        const raw = existing.data as Record<string, unknown>;
        const merged = { ...defaults, ...raw, logoUrl };
        const data = GameConfigDataSchema.parse(merged);
        await db.gameConfig.update({
          where: { gameId: game.id },
          data: { data: data as unknown as Prisma.InputJsonValue, updatedAt: new Date() },
        });
      } else {
        const data = GameConfigDataSchema.parse({
          ...createDefaultGameConfig(),
          logoUrl,
        });
        await db.gameConfig.create({ data: { gameId: game.id, data: data as unknown as Prisma.InputJsonValue } });
      }
    } catch (dbError) {
      // DB 写入失败：回滚 S3 上传，避免产生孤立文件
      logger.error("[uploadLogo] DB update failed, rolling back S3 upload:", dbError);
      try {
        await Promise.all(allLogoKeys(game.id).map((k) => s3.deleteFile(k).catch(() => {})));
      } catch (s3Error) {
        logger.error("[uploadLogo] S3 rollback also failed:", s3Error);
      }
      throw dbError;
    }

    logger.log(`[uploadLogo] Logo uploaded for game ${gameSlug}`);
    return c.json({ logoUrl });
  } catch (error) {
    logger.error("[uploadLogo] Error:", error);
    return c.json({ error: "Upload failed" }, 500);
  }
});

/**
 * 删除游戏 Logo
 */
gameConfigRoutes.delete(":gameSlug/api/logo", async (c) => {
  try {
    const gameSlug = c.req.param("gameSlug");

    const userId = await resolveUserId(c.req.header("cookie") ?? null);
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const game = await db.game.findFirst({
      where: { slug: gameSlug },
      select: { id: true },
    });

    if (!game) {
      return c.json({ error: "Game not found" }, 404);
    }

    const member = await db.gameMember.findFirst({
      where: { gameId: game.id, userId },
    });

    if (!member) {
      return c.json({ error: "No access" }, 403);
    }

    // 先清除 DB 中的 logoUrl，再删除 S3 文件。
    const existing = await db.gameConfig.findFirst({ where: { gameId: game.id } });

    if (existing) {
      const defaults = createDefaultGameConfig();
      const raw = existing.data as Record<string, unknown>;
      const merged = { ...defaults, ...raw, logoUrl: "" };
      const data = GameConfigDataSchema.parse(merged);
      await db.gameConfig.update({
        where: { gameId: game.id },
        data: { data: data as unknown as Prisma.InputJsonValue, updatedAt: new Date() },
      });
    }

    // DB 更新成功后，清理 S3（失败只产生孤立对象，不影响一致性）
    try {
      await Promise.all(allLogoKeys(game.id).map((k) => s3.deleteFile(k).catch(() => {})));
    } catch {
      logger.warn(`[deleteLogo] S3 cleanup failed for game ${game.id}, orphaned objects may exist`);
    }

    logger.log(`[deleteLogo] Logo deleted for game ${gameSlug}`);
    return c.json({ ok: true });
  } catch (error) {
    logger.error("[deleteLogo] Error:", error);
    return c.json({ error: "Delete failed" }, 500);
  }
});

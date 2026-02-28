/**
 * 文件公开访问路由（Hono）
 *
 * 提供 /game/:gameSlug/resources/* 路径的公开访问
 * 用于游戏客户端直接加载资源文件
 */

import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { db } from "../db/client";
import { type files, games } from "../db/schema";
import * as s3 from "../storage/s3";
import { Logger } from "../utils/logger";

const logger = new Logger("FileRoutes");

export const fileRoutes = new Hono();

/**
 * 公开访问游戏资源文件
 *
 * GET /game/:gameSlug/resources/*resourcePath
 * 例如: /game/william-chan/resources/测试/1.txt
 */
fileRoutes.get(":gameSlug/resources/*", async (c) => {
  try {
    const gameSlug = c.req.param("gameSlug");
    // 从 URL 中提取完整路径（去除 /:gameSlug/resources/ 前缀）
    const fullPath = new URL(c.req.url).pathname;
    const prefix = `/game/${gameSlug}/resources/`;
    const filePath = decodeURIComponent(fullPath.substring(prefix.length));

    if (!filePath) {
      return c.json({ error: "File path is required" }, 400);
    }

    logger.debug(`[getResource] gameSlug=${gameSlug}, filePath=${filePath}`);

    // 1. 根据 slug 获取游戏
    const [game] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.slug, gameSlug))
      .limit(1);

    if (!game) {
      return c.json({ error: "Game not found" }, 404);
    }

    // 2. 解析路径，找到目标文件
    const pathSegments = filePath.split("/").filter(Boolean);
    const file = await resolveFilePath(game.id, pathSegments);

    if (!file) {
      return c.json({ error: "File not found" }, 404);
    }

    if (file.type !== "file" || !file.storageKey) {
      return c.json({ error: "Path is not a file" }, 400);
    }

    // 3. 从 S3 获取文件流（流式传输，不加载到内存），支持 ETag 条件请求
    const ifNoneMatch = c.req.header("if-none-match");
    const {
      stream: fileStream,
      contentType,
      contentLength,
      etag,
      notModified,
    } = await s3.getFileStream(file.storageKey, ifNoneMatch);

    // 304 Not Modified — 文件内容未变化，不需要重新传输
    if (notModified) {
      c.header("Cache-Control", "no-cache");
      c.header("Access-Control-Allow-Origin", "*");
      if (etag) c.header("ETag", etag);
      return c.body(null, 304);
    }

    // 4. 设置响应头
    c.header("Content-Type", file.mimeType || contentType || "application/octet-stream");
    if (contentLength !== undefined) {
      c.header("Content-Length", String(contentLength));
    }
    // no-cache: 允许缓存，但每次必须向服务器验证 (ETag)，文件未变时返回 304
    c.header("Cache-Control", "no-cache");
    c.header("Access-Control-Allow-Origin", "*");
    if (etag) c.header("ETag", etag);

    // 5. 流式传输文件内容
    return stream(c, async (s) => {
      for await (const chunk of fileStream) {
        await s.write(chunk as Uint8Array);
      }
    });
  } catch (error) {
    logger.error("[getResource] Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * 根据路径段解析文件（大小写不敏感）
 *
 * 使用递归 CTE 一次查询完成整条路径解析，避免 N+1。
 * VALUES 通过 drizzle sql tag 参数化，防止 SQL 注入。
 */
async function resolveFilePath(
  gameId: string,
  pathSegments: string[]
): Promise<typeof files.$inferSelect | null> {
  if (pathSegments.length === 0) return null;

  // 用 drizzle sql tag 安全地构建 VALUES 列表
  const segValues = pathSegments
    .map((seg, i) => sql`(${i + 1}::int, ${seg.toLowerCase()})`)
    .reduce((acc, cur) => sql`${acc}, ${cur}`);

  const result = await db.execute<typeof files.$inferSelect>(sql`
    WITH RECURSIVE path_segments(depth, seg_name) AS (
      VALUES ${segValues}
    ),
    resolve(depth, id) AS (
      -- 基础 case：第 1 段，parent_id IS NULL
      SELECT 1, f.id
      FROM files f
      JOIN path_segments ps ON ps.depth = 1
      WHERE f.game_id = ${gameId}
        AND f.parent_id IS NULL
        AND LOWER(f.name) = ps.seg_name
        AND f.deleted_at IS NULL
      UNION ALL
      -- 递归 case：后续路径段（注意：递归项里不能用 LIMIT）
      SELECT r.depth + 1, f.id
      FROM resolve r
      JOIN path_segments ps ON ps.depth = r.depth + 1
      JOIN files f ON f.parent_id = r.id
        AND f.game_id = ${gameId}
        AND LOWER(f.name) = ps.seg_name
        AND f.deleted_at IS NULL
    )
    SELECT f.*
    FROM resolve r
    JOIN files f ON f.id = r.id
    WHERE r.depth = ${pathSegments.length}
    LIMIT 1
  `);

  return result.rows?.[0] ?? null;
}

/**
 * 文件路径解析工具（服务端共用）
 */
import type { File } from "@prisma/client";
import { db } from "../db/client";

/**
 * 根据路径段解析文件（大小写不敏感）
 *
 * 使用递归 CTE 一次查询完成整条路径解析，避免 N+1。
 * 参数通过 $queryRawUnsafe 参数化，防止 SQL 注入。
 */
export async function resolveFilePath(
  gameId: string,
  pathSegments: string[]
): Promise<File | null> {
  if (pathSegments.length === 0) return null;

  const valueRows = pathSegments.map((seg, i) => `(${i + 1}::int, $${i + 2})`).join(", ");

  const params: (string | number)[] = [gameId, ...pathSegments.map((s) => s.toLowerCase())];
  const depthParam = `$${params.length + 1}`;
  params.push(pathSegments.length);

  const rows = await db.$queryRawUnsafe<File[]>(
    `
    WITH RECURSIVE path_segments(depth, seg_name) AS (
      VALUES ${valueRows}
    ),
    resolve(depth, id) AS (
      SELECT 1, f.id
      FROM files f
      JOIN path_segments ps ON ps.depth = 1
      WHERE f.game_id = $1
        AND f.parent_id IS NULL
        AND LOWER(f.name) = ps.seg_name
        AND f.deleted_at IS NULL
      UNION ALL
      SELECT r.depth + 1, f.id
      FROM resolve r
      JOIN path_segments ps ON ps.depth = r.depth + 1
      JOIN files f ON f.parent_id = r.id
        AND f.game_id = $1
        AND LOWER(f.name) = ps.seg_name
        AND f.deleted_at IS NULL
    )
    SELECT
      f.id,
      f.game_id        AS "gameId",
      f.parent_id      AS "parentId",
      f.name,
      f.type,
      f.storage_key    AS "storageKey",
      f.size,
      f.mime_type      AS "mimeType",
      f.checksum,
      f.created_at     AS "createdAt",
      f.updated_at     AS "updatedAt",
      f.deleted_at     AS "deletedAt"
    FROM resolve r
    JOIN files f ON f.id = r.id
    WHERE r.depth = ${depthParam}
    LIMIT 1
  `,
    ...params
  );

  return rows[0] ?? null;
}

/**
 * 批量检查多个路径是否存在，返回存在的路径集合（小写）
 *
 * 并发执行，最多 BATCH_CONCURRENCY 个并发查询。
 */
const BATCH_CONCURRENCY = 8;

export async function batchCheckPaths(gameId: string, paths: string[]): Promise<Set<string>> {
  const uniquePaths = [...new Set(paths.map((p) => p.toLowerCase()))];
  const exists = new Set<string>();

  // 分批并发执行
  for (let i = 0; i < uniquePaths.length; i += BATCH_CONCURRENCY) {
    const batch = uniquePaths.slice(i, i + BATCH_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (p) => {
        const segments = p.split("/").filter(Boolean);
        const file = await resolveFilePath(gameId, segments);
        return file ? p : null;
      })
    );
    for (const r of results) {
      if (r) exists.add(r);
    }
  }

  return exists;
}

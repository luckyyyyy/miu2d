/**
 * One-off data migration: populate `data` for scenes where data IS NULL.
 *
 * For each null-data scene:
 *  1. Resolves TXT files under script/map/<scene-key>/ in the files table
 *  2. Downloads each from S3, classifies as trap (Trap*.txt) or regular script
 *  3. Also resolves NPC/OBJ ini files from ini/save/ by [Head] Map= field
 *  4. Writes {scripts, traps, npc, obj} into scene.data
 *
 * Idempotent: skips scenes that already have data.
 *
 * Usage (production):
 *   docker exec miu2d-server node dist/db/patch-null-scene-data.js
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { classifyScriptFile, parseIniContent, parseNpcEntries, parseObjEntries } from "@miu2d/types";
import { downloadFile } from "../storage/s3.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

type FileRow = { id: string; name: string; storageKey: string | null };

/**
 * Resolve a directory path in the files table, returns its ID.
 * Uses case-insensitive matching at each segment.
 */
async function findDirId(gameId: string, segments: string[]): Promise<string | null> {
  const valueRows = segments.map((_, i) => `(${i + 1}::int, $${i + 2})`).join(", ");
  const params: (string | number)[] = [gameId, ...segments.map((s) => s.toLowerCase())];
  const depthParam = `$${params.length + 1}`;
  params.push(segments.length);

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
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
    SELECT id FROM resolve WHERE depth = ${depthParam} LIMIT 1
    `,
    ...params,
  );

  return rows[0]?.id ?? null;
}

/**
 * List direct children (files only) in a directory.
 * Deduplicates by lowercase name, preferring most-recent entry.
 */
async function listDirFiles(gameId: string, parentId: string): Promise<FileRow[]> {
  return prisma.$queryRawUnsafe<FileRow[]>(
    `
    SELECT DISTINCT ON (LOWER(name)) id, name, storage_key AS "storageKey"
    FROM files
    WHERE game_id = $1
      AND parent_id = $2
      AND type = 'file'
      AND deleted_at IS NULL
    ORDER BY LOWER(name), created_at DESC
    `,
    gameId,
    parentId,
  );
}

async function downloadText(storageKey: string): Promise<string> {
  const buf = await downloadFile(storageKey);
  return buf.toString("utf-8");
}

async function main() {
  console.log("==> patch-null-scene-data: start");

  const nullScenes = await prisma.$queryRaw<Array<{ id: string; game_id: string; key: string; name: string }>>`
    SELECT id, game_id, key, name FROM scenes WHERE data IS NULL
  `.then((rows) => rows.map((r) => ({ id: r.id, gameId: r.game_id, key: r.key, name: r.name })));

  if (nullScenes.length === 0) {
    console.log("==> Nothing to patch.");
    await prisma.$disconnect();
    return;
  }

  console.log(`    found ${nullScenes.length} null-data scenes`);

  // Pre-load NPC/OBJ save files per game (keyed by gameid → file list)
  const gameIds = [...new Set(nullScenes.map((s) => s.gameId))];
  const npcObjByGame = new Map<string, Array<{ name: string; storageKey: string; kind: "npc" | "obj" }>>();

  for (const gameId of gameIds) {
    const saveDirId = await findDirId(gameId, ["ini", "save"]);
    if (!saveDirId) {
      console.log(`    no ini/save dir for game ${gameId}`);
      npcObjByGame.set(gameId, []);
      continue;
    }
    const files = await listDirFiles(gameId, saveDirId);
    const entries = files
      .filter(
        (f) =>
          (f.name.toLowerCase().endsWith(".npc") || f.name.toLowerCase().endsWith(".obj")) &&
          f.storageKey,
      )
      .map((f) => ({
        name: f.name,
        storageKey: f.storageKey!,
        kind: (f.name.toLowerCase().endsWith(".npc") ? "npc" : "obj") as "npc" | "obj",
      }));
    npcObjByGame.set(gameId, entries);
    console.log(`    game ${gameId}: ${entries.length} ini/save npc/obj files`);
  }

  // Process each null-data scene
  for (const scene of nullScenes) {
    console.log(`  processing: ${scene.name} (${scene.key})`);

    const data: {
      scripts: Record<string, string>;
      traps: Record<string, string>;
      npc: Record<string, unknown>;
      obj: Record<string, unknown>;
    } = { scripts: {}, traps: {}, npc: {}, obj: {} };

    // 1. Read script/trap TXT files
    const scriptDirId = await findDirId(scene.gameId, ["script", "map", scene.key]);
    if (scriptDirId) {
      const files = await listDirFiles(scene.gameId, scriptDirId);
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith(".txt") || !file.storageKey) continue;
        try {
          const content = await downloadText(file.storageKey);
          const kind = classifyScriptFile(file.name);
          if (kind === "trap") {
            data.traps[file.name] = content;
          } else {
            data.scripts[file.name] = content;
          }
          console.log(`    ${kind}: ${file.name}`);
        } catch (e) {
          console.warn(`    WARN: failed to download ${file.name}: ${e}`);
        }
      }
    } else {
      console.log(`    no script dir for scene ${scene.key}`);
    }

    // 2. Read NPC/OBJ save files belonging to this scene via [Head] Map=
    const saveFiles = npcObjByGame.get(scene.gameId) ?? [];
    for (const sf of saveFiles) {
      try {
        const content = await downloadText(sf.storageKey);
        const sections = parseIniContent(content);
        const headSection = sections.Head ?? sections.head;
        if (!headSection) continue;
        const mapValue = (headSection.Map ?? headSection.map ?? "")
          .replace(/\.(map|mmf)$/i, "")
          .toLowerCase();
        if (mapValue !== scene.key.toLowerCase()) continue;

        const fileKey = sf.name.toLowerCase();
        if (sf.kind === "npc") {
          const entries = parseNpcEntries(sections);
          data.npc[fileKey] = { key: fileKey, entries };
          console.log(`    npc: ${sf.name} (${entries.length} entries)`);
        } else {
          const entries = parseObjEntries(sections);
          data.obj[fileKey] = { key: fileKey, entries };
          console.log(`    obj: ${sf.name} (${entries.length} entries)`);
        }
      } catch (e) {
        console.warn(`    WARN: failed to process ${sf.name}: ${e}`);
      }
    }

    // 3. Persist
    await prisma.scene.update({
      where: { id: scene.id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { data: data as any },
    });
    console.log(`  ✓ patched: ${scene.name}`);
  }

  console.log("==> patch-null-scene-data: done");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("patch-null-scene-data failed:", err);
  process.exit(1);
});

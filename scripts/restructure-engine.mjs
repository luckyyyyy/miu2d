#!/usr/bin/env node
/**
 * Engine directory restructuring script
 *
 * Moves files to new locations and updates all import paths.
 *
 * Changes:
 * 1. runtime/ → storage/ : loader.ts, storage.ts
 * 2. runtime/ → data/    : memo-list-manager.ts, partner-list.ts, talk-text-list.ts
 * 3. core/   → data/     : timer-manager.ts
 * 4. runtime/ → magic/   : magic-handler.ts
 * 5. core/   → magic/    : effect-calc.ts
 * 6. core/   → utils/    : path-finder.ts, debug-manager.ts
 * 7. runtime/script-api/ → script/api/
 * 8. runtime/script-context-factory.ts → script/
 * 9. core/game-api.ts → script/api/
 * 10. player/good-drop.ts → player/goods/
 * 11. resource/ format files → resource/format/
 */

import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";

const ENGINE_SRC = resolve("packages/engine/src");
const WEB_SRC = resolve("packages/web/src");
const VIEWER_SRC = resolve("packages/viewer/src");
const SERVER_SRC = resolve("packages/server/src");

// ============= File moves =============
// [oldPath (relative to ENGINE_SRC), newPath (relative to ENGINE_SRC)]
const FILE_MOVES = [
  // 1. runtime/ → storage/
  ["runtime/loader.ts", "storage/loader.ts"],
  ["runtime/storage.ts", "storage/storage.ts"],

  // 2. runtime/ → data/
  ["runtime/memo-list-manager.ts", "data/memo-list-manager.ts"],
  ["runtime/partner-list.ts", "data/partner-list.ts"],
  ["runtime/talk-text-list.ts", "data/talk-text-list.ts"],

  // 3. core/ → data/
  ["core/timer-manager.ts", "data/timer-manager.ts"],

  // 4. runtime/ → magic/
  ["runtime/magic-handler.ts", "magic/magic-handler.ts"],

  // 5. core/ → magic/
  ["core/effect-calc.ts", "magic/effect-calc.ts"],

  // 6. core/ → utils/
  ["core/path-finder.ts", "utils/path-finder.ts"],
  ["core/debug-manager.ts", "utils/debug-manager.ts"],

  // 7. runtime/script-api/ → script/api/
  ["runtime/script-api/adapter.ts", "script/api/adapter.ts"],
  ["runtime/script-api/game-api-factory.ts", "script/api/game-api-factory.ts"],
  ["runtime/script-api/helpers.ts", "script/api/helpers.ts"],
  ["runtime/script-api/index.ts", "script/api/index.ts"],
  ["runtime/script-api/item-api.ts", "script/api/item-api.ts"],
  ["runtime/script-api/npc-api.ts", "script/api/npc-api.ts"],
  ["runtime/script-api/player-api.ts", "script/api/player-api.ts"],
  ["runtime/script-api/system-api.ts", "script/api/system-api.ts"],
  ["runtime/script-api/types.ts", "script/api/types.ts"],
  ["runtime/script-api/world-api.ts", "script/api/world-api.ts"],

  // 8. runtime/script-context-factory.ts → script/
  ["runtime/script-context-factory.ts", "script/script-context-factory.ts"],

  // 9. core/game-api.ts → script/api/
  ["core/game-api.ts", "script/api/game-api.ts"],

  // 10. player/good-drop.ts → player/goods/
  ["player/good-drop.ts", "player/goods/good-drop.ts"],

  // 11. resource/ format files → resource/format/
  ["resource/asf.ts", "resource/format/asf.ts"],
  ["resource/mpc.ts", "resource/format/mpc.ts"],
  ["resource/shd.ts", "resource/format/shd.ts"],
  ["resource/xnb.ts", "resource/format/xnb.ts"],
  ["resource/mmf.ts", "resource/format/mmf.ts"],
  ["resource/mmf-dto.ts", "resource/format/mmf-dto.ts"],
  ["resource/map.ts", "resource/format/map-parser.ts"],
  ["resource/binary-utils.ts", "resource/format/binary-utils.ts"],
  ["resource/encoding.ts", "resource/format/encoding.ts"],
];

// Build the move map: old absolute path → new absolute path
const moveMap = new Map();
for (const [oldRel, newRel] of FILE_MOVES) {
  moveMap.set(join(ENGINE_SRC, oldRel), join(ENGINE_SRC, newRel));
}

// ============= Collect all .ts/.tsx files =============
function collectFiles(dir, exts = [".ts", ".tsx"]) {
  const result = [];
  if (!existsSync(dir)) return result;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      result.push(...collectFiles(full, exts));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      result.push(full);
    }
  }
  return result;
}

// ============= Path resolution helpers =============

/**
 * Resolve a relative import from a source file to an absolute path.
 * Handles: "./foo", "../bar/baz", etc.
 * Returns the resolved path WITHOUT extension (we'll match against moveMap).
 */
function resolveImport(sourceFile, importPath) {
  if (!importPath.startsWith(".")) return null; // skip package imports
  const dir = dirname(sourceFile);
  return resolve(dir, importPath);
}

/**
 * Compute the relative import path from sourceFile to targetFile.
 * Both are absolute paths WITHOUT extension (for .ts matching).
 */
function computeRelativeImport(fromFile, toFileNoExt) {
  const fromDir = dirname(fromFile);
  let rel = relative(fromDir, toFileNoExt);
  if (!rel.startsWith(".")) rel = "./" + rel;
  // Normalize to forward slashes
  rel = rel.replace(/\\/g, "/");
  return rel;
}

/**
 * Given an absolute path (without extension), find if it matches a moved file.
 * We try: exact .ts match, /index.ts match
 */
function findMovedTarget(absNoExt) {
  // Direct .ts
  const withTs = absNoExt + ".ts";
  if (moveMap.has(withTs)) return { oldAbs: withTs, newAbs: moveMap.get(withTs) };

  // /index.ts (directory import)
  const withIndex = absNoExt + "/index.ts";
  if (moveMap.has(withIndex)) return { oldAbs: withIndex, newAbs: moveMap.get(withIndex) };

  return null;
}

// ============= Build @miu2d/engine import mapping =============
// For external packages that use @miu2d/engine/xxx paths
// Map old subpath → new subpath
const PACKAGE_IMPORT_REWRITES = [
  // @miu2d/engine/runtime/storage → @miu2d/engine/storage/storage
  ["@miu2d/engine/runtime/storage", "@miu2d/engine/storage/storage"],
  // @miu2d/engine/runtime/loader → @miu2d/engine/storage/loader
  ["@miu2d/engine/runtime/loader", "@miu2d/engine/storage/loader"],
  // @miu2d/engine/runtime/memo-list-manager → @miu2d/engine/data/memo-list-manager
  ["@miu2d/engine/runtime/memo-list-manager", "@miu2d/engine/data/memo-list-manager"],
  // @miu2d/engine/runtime/partner-list → @miu2d/engine/data/partner-list
  ["@miu2d/engine/runtime/partner-list", "@miu2d/engine/data/partner-list"],
  // @miu2d/engine/runtime/talk-text-list → @miu2d/engine/data/talk-text-list
  ["@miu2d/engine/runtime/talk-text-list", "@miu2d/engine/data/talk-text-list"],
  // @miu2d/engine/core/timer-manager → @miu2d/engine/data/timer-manager
  ["@miu2d/engine/core/timer-manager", "@miu2d/engine/data/timer-manager"],
  // @miu2d/engine/runtime/magic-handler → @miu2d/engine/magic/magic-handler
  ["@miu2d/engine/runtime/magic-handler", "@miu2d/engine/magic/magic-handler"],
  // @miu2d/engine/core/effect-calc → @miu2d/engine/magic/effect-calc
  ["@miu2d/engine/core/effect-calc", "@miu2d/engine/magic/effect-calc"],
  // @miu2d/engine/core/path-finder → @miu2d/engine/utils/path-finder
  ["@miu2d/engine/core/path-finder", "@miu2d/engine/utils/path-finder"],
  // @miu2d/engine/core/debug-manager → @miu2d/engine/utils/debug-manager
  ["@miu2d/engine/core/debug-manager", "@miu2d/engine/utils/debug-manager"],
  // @miu2d/engine/runtime/performance-stats → @miu2d/engine/runtime/performance-stats (NOT moved, stays)
  // @miu2d/engine/runtime/script-api/* → @miu2d/engine/script/api/*
  ["@miu2d/engine/runtime/script-api", "@miu2d/engine/script/api"],
  // @miu2d/engine/core/game-api → @miu2d/engine/script/api/game-api
  ["@miu2d/engine/core/game-api", "@miu2d/engine/script/api/game-api"],
  // @miu2d/engine/runtime/script-context-factory → @miu2d/engine/script/script-context-factory
  ["@miu2d/engine/runtime/script-context-factory", "@miu2d/engine/script/script-context-factory"],
  // resource format files
  ["@miu2d/engine/resource/asf", "@miu2d/engine/resource/format/asf"],
  ["@miu2d/engine/resource/mpc", "@miu2d/engine/resource/format/mpc"],
  ["@miu2d/engine/resource/shd", "@miu2d/engine/resource/format/shd"],
  ["@miu2d/engine/resource/xnb", "@miu2d/engine/resource/format/xnb"],
  ["@miu2d/engine/resource/mmf", "@miu2d/engine/resource/format/mmf"],
  ["@miu2d/engine/resource/mmf-dto", "@miu2d/engine/resource/format/mmf-dto"],
  ["@miu2d/engine/resource/map", "@miu2d/engine/resource/format/map-parser"],
  ["@miu2d/engine/resource/binary-utils", "@miu2d/engine/resource/format/binary-utils"],
  ["@miu2d/engine/resource/encoding", "@miu2d/engine/resource/format/encoding"],
  // player/good-drop → player/goods/good-drop
  ["@miu2d/engine/player/good-drop", "@miu2d/engine/player/goods/good-drop"],
];

// ============= Main logic =============

function main() {
  console.log("=== Engine Restructuring Script ===\n");

  // Phase 1: Collect all source files
  const engineFiles = collectFiles(ENGINE_SRC);
  const webFiles = collectFiles(WEB_SRC);
  const viewerFiles = collectFiles(VIEWER_SRC);
  const serverFiles = collectFiles(SERVER_SRC);
  const allFiles = [...engineFiles, ...webFiles, ...viewerFiles, ...serverFiles];

  console.log(`Found ${engineFiles.length} engine files, ${webFiles.length} web files, ${viewerFiles.length} viewer files, ${serverFiles.length} server files`);

  // Phase 2: Update imports in all files BEFORE moving
  // We need to:
  // a) For engine internal relative imports: rewrite based on file moves
  // b) For external @miu2d/engine imports: rewrite based on PACKAGE_IMPORT_REWRITES

  let totalChanges = 0;

  for (const filePath of allFiles) {
    const content = readFileSync(filePath, "utf-8");
    let newContent = content;

    // Determine if this file itself is being moved
    const fileIsMoving = moveMap.has(filePath);
    const newFilePath = fileIsMoving ? moveMap.get(filePath) : filePath;

    // Check if file is inside engine package (uses relative imports)
    const isEngineFile = filePath.startsWith(ENGINE_SRC);

    if (isEngineFile) {
      // Rewrite relative imports
      newContent = newContent.replace(
        /from\s+["'](\.[^"']+)["']/g,
        (match, importPath) => {
          const resolvedAbs = resolveImport(filePath, importPath);
          if (!resolvedAbs) return match;

          const moved = findMovedTarget(resolvedAbs);

          if (moved || fileIsMoving) {
            // Either the target moved, or this file is moving, or both
            const targetAbs = moved ? moved.newAbs : resolvedAbs + ".ts";
            const sourceForCalc = newFilePath; // use new location of current file

            // Remove .ts extension for import path
            const targetNoExt = targetAbs.replace(/\.ts$/, "");
            let newImport = computeRelativeImport(sourceForCalc, targetNoExt);

            // If original didn't have /index suffix and target is index.ts, remove it
            if (targetAbs.endsWith("/index.ts") && !importPath.endsWith("/index")) {
              newImport = newImport.replace(/\/index$/, "");
            }

            if (newImport !== importPath) {
              return `from "${newImport}"`;
            }
          }

          return match;
        }
      );
    } else {
      // External package - rewrite @miu2d/engine paths
      for (const [oldPkg, newPkg] of PACKAGE_IMPORT_REWRITES) {
        // Use regex to match exact imports (not partial matches)
        const escaped = oldPkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(from\\s+["'])${escaped}(["'])`, "g");
        newContent = newContent.replace(regex, `$1${newPkg}$2`);
      }
    }

    if (newContent !== content) {
      writeFileSync(filePath, newContent, "utf-8");
      const relPath = relative(resolve("."), filePath);
      console.log(`  Updated imports: ${relPath}`);
      totalChanges++;
    }
  }

  console.log(`\nPhase 2 complete: ${totalChanges} files updated\n`);

  // Phase 3: Move files
  console.log("Phase 3: Moving files...");
  let moveCount = 0;

  for (const [oldAbs, newAbs] of moveMap) {
    if (!existsSync(oldAbs)) {
      console.log(`  SKIP (not found): ${relative(ENGINE_SRC, oldAbs)}`);
      continue;
    }

    // Create target directory
    mkdirSync(dirname(newAbs), { recursive: true });

    // Move file
    renameSync(oldAbs, newAbs);
    const oldRel = relative(ENGINE_SRC, oldAbs);
    const newRel = relative(ENGINE_SRC, newAbs);
    console.log(`  Moved: ${oldRel} → ${newRel}`);
    moveCount++;
  }

  console.log(`\nPhase 3 complete: ${moveCount} files moved\n`);

  // Phase 4: Clean up empty directories
  console.log("Phase 4: Cleaning empty directories...");
  cleanEmptyDirs(join(ENGINE_SRC, "runtime/script-api"));

  console.log("\n=== Restructuring complete! ===");
  console.log("\nNext steps:");
  console.log("  1. Update index.ts files (storage, data, script, resource, etc.)");
  console.log("  2. Update package.json exports");
  console.log("  3. Run: make tsc");
  console.log("  4. Run: make lint");
}

function cleanEmptyDirs(dir) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir);
  if (entries.length === 0) {
    rmSync(dir, { recursive: true });
    console.log(`  Removed empty dir: ${relative(ENGINE_SRC, dir)}`);
  }
}

main();

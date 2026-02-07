#!/usr/bin/env node
/**
 * Phase 1: Unify ConfigLoader normalizeKey pattern
 *
 * Replace each file's local normalizeKey with normalizeCacheKey from config/resourcePaths.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_SRC = path.resolve(__dirname, "../packages/engine/src");

let changes = 0;

function transform(filePath, config) {
  const fullPath = path.join(ENGINE_SRC, filePath);
  let content = fs.readFileSync(fullPath, "utf-8");
  const original = content;

  // 1. Add normalizeCacheKey import (add to existing config/resourcePaths import or create new)
  if (config.addImport) {
    const { importFrom, existingImportPattern, addSymbol } = config.addImport;

    if (existingImportPattern) {
      // Add to existing import
      const regex = new RegExp(existingImportPattern);
      const match = content.match(regex);
      if (match) {
        const oldImport = match[0];
        // Add symbol to import
        if (!oldImport.includes(addSymbol)) {
          const newImport = oldImport.replace(/}\s*from/, `, ${addSymbol} } from`);
          content = content.replace(oldImport, newImport);
        }
      }
    } else {
      // Add new import line after last import
      const importLine = `import { normalizeCacheKey } from "${importFrom}";`;
      // Find last import line
      const lines = content.split("\n");
      let lastImportIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("import ") || lines[i].startsWith("  ")) {
          if (lines[i].includes(" from ")) lastImportIdx = i;
        }
      }
      if (lastImportIdx >= 0) {
        lines.splice(lastImportIdx + 1, 0, importLine);
        content = lines.join("\n");
      }
    }
  }

  // 2. Remove the old normalizeKey function
  if (config.removeFunctionPattern) {
    content = content.replace(config.removeFunctionPattern, "");
  }

  // 3. Replace all normalizeKey(...) calls with normalizeCacheKey(..., PREFIXES)
  if (config.replaceCalls) {
    for (const [from, to] of config.replaceCalls) {
      content = content.replaceAll(from, to);
    }
  }

  // 4. Add PREFIXES constant if specified
  if (config.addConstant) {
    // Insert before the cache declaration or after imports
    content = content.replace(config.addConstant.before, config.addConstant.value + "\n\n" + config.addConstant.before);
  }

  // 5. Remove unused getResourceRoot import if needed
  if (config.removeUnusedImport) {
    for (const sym of config.removeUnusedImport) {
      // Check if symbol is still used (excluding imports)
      const lines = content.split("\n");
      const usedInCode = lines.some(line =>
        !line.trimStart().startsWith("import") && line.includes(sym) && !line.includes(`// ${sym}`)
      );
      if (!usedInCode) {
        // Remove from import statement
        // Pattern: import { A, B, getResourceRoot } from "...";
        const importRegex = new RegExp(`\\b${sym},?\\s*`);
        const importLineRegex = new RegExp(`^(import\\s*\\{[^}]*?)\\b${sym},?\\s*([^}]*\\}\\s*from\\s*[^;]+;)`, 'm');
        const m = content.match(importLineRegex);
        if (m) {
          let cleaned = m[0].replace(new RegExp(`,\\s*${sym}\\b`), '').replace(new RegExp(`${sym},?\\s*`), '');
          // Clean up double commas or trailing commas before }
          cleaned = cleaned.replace(/,\s*,/g, ',').replace(/,\s*}/g, ' }').replace(/{\s*,/g, '{ ');
          content = content.replace(m[0], cleaned);
        }
      }
    }
  }

  if (content !== original) {
    fs.writeFileSync(fullPath, content, "utf-8");
    changes++;
    console.log(`  UPDATED: ${filePath}`);
  }
}

// ============================================================
// npcConfigLoader.ts
// ============================================================
console.log("\n=== Updating npcConfigLoader.ts ===");

{
  const filePath = "npc/npcConfigLoader.ts";
  const fullPath = path.join(ENGINE_SRC, filePath);
  let content = fs.readFileSync(fullPath, "utf-8");

  // Add normalizeCacheKey to the config import
  content = content.replace(
    'import { getResourceRoot } from "../config/resourcePaths";',
    'import { normalizeCacheKey } from "../config/resourcePaths";'
  );

  // Add prefixes constant
  const NPC_PREFIXES = `const NPC_KEY_PREFIXES = ["ini/npc/", "ini/partner/"] as const;`;
  content = content.replace(
    "const npcConfigCache",
    `${NPC_PREFIXES}\n\nconst npcConfigCache`
  );

  // Remove old normalizeKey function
  content = content.replace(
    /\/\/ ========== 缓存键规范化 ==========\n\nfunction normalizeKey\(fileName: string\): string \{[\s\S]*?return key\.toLowerCase\(\);\n\}/,
    ""
  );

  // Replace calls
  content = content.replaceAll("normalizeKey(", "normalizeCacheKey(");
  // Add prefixes argument
  content = content.replace(/normalizeCacheKey\(([^)]+)\)/g, (match, arg) => {
    if (arg.includes("NPC_KEY_PREFIXES")) return match;
    return `normalizeCacheKey(${arg}, NPC_KEY_PREFIXES)`;
  });

  fs.writeFileSync(fullPath, content, "utf-8");
  changes++;
  console.log(`  UPDATED: ${filePath}`);
}

// ============================================================
// objConfigLoader.ts
// ============================================================
console.log("\n=== Updating objConfigLoader.ts ===");

{
  const filePath = "obj/objConfigLoader.ts";
  const fullPath = path.join(ENGINE_SRC, filePath);
  let content = fs.readFileSync(fullPath, "utf-8");

  content = content.replace(
    'import { getResourceRoot } from "../config/resourcePaths";',
    'import { normalizeCacheKey } from "../config/resourcePaths";'
  );

  const OBJ_PREFIXES = `const OBJ_KEY_PREFIXES = ["ini/obj/", "ini/objres/"] as const;`;
  content = content.replace(
    "const objConfigCache",
    `${OBJ_PREFIXES}\n\nconst objConfigCache`
  );

  // Remove old normalizeKey function
  content = content.replace(
    /\/\/ ========== 缓存键规范化 ==========\n\nfunction normalizeKey\(fileName: string\): string \{[\s\S]*?return key\.toLowerCase\(\);\n\}/,
    ""
  );

  content = content.replaceAll("normalizeKey(", "normalizeCacheKey(");
  content = content.replace(/normalizeCacheKey\(([^)]+)\)/g, (match, arg) => {
    if (arg.includes("OBJ_KEY_PREFIXES")) return match;
    return `normalizeCacheKey(${arg}, OBJ_KEY_PREFIXES)`;
  });

  fs.writeFileSync(fullPath, content, "utf-8");
  changes++;
  console.log(`  UPDATED: ${filePath}`);
}

// ============================================================
// magicConfigLoader.ts
// ============================================================
console.log("\n=== Updating magicConfigLoader.ts ===");

{
  const filePath = "magic/magicConfigLoader.ts";
  const fullPath = path.join(ENGINE_SRC, filePath);
  let content = fs.readFileSync(fullPath, "utf-8");

  content = content.replace(
    'import { getResourceRoot } from "../config/resourcePaths";',
    'import { getResourceRoot, normalizeCacheKey } from "../config/resourcePaths";'
  );

  const MAGIC_PREFIXES = `const MAGIC_KEY_PREFIXES = ["ini/magic/"] as const;`;
  content = content.replace(
    "/** 已解析的武功配置缓存",
    `${MAGIC_PREFIXES}\n\n/** 已解析的武功配置缓存`
  );

  // Remove old normalizeKeyForCache function
  content = content.replace(
    /\/\/ ========== 缓存键规范化 ==========\n[\s\S]*?function normalizeKeyForCache\(fileName: string\): string \{[\s\S]*?return normalized\.toLowerCase\(\);\n\}/,
    ""
  );

  content = content.replaceAll("normalizeKeyForCache(", "normalizeCacheKey(");
  // Fix: normalizeCacheKey needs prefixes
  content = content.replace(/normalizeCacheKey\(([^,)]+)\)/g, (match, arg) => {
    if (arg.includes("MAGIC_KEY_PREFIXES")) return match;
    return `normalizeCacheKey(${arg}, MAGIC_KEY_PREFIXES)`;
  });

  fs.writeFileSync(fullPath, content, "utf-8");
  changes++;
  console.log(`  UPDATED: ${filePath}`);
}

// ============================================================
// player/goods/good.ts
// ============================================================
console.log("\n=== Updating player/goods/good.ts ===");

{
  const filePath = "player/goods/good.ts";
  const fullPath = path.join(ENGINE_SRC, filePath);
  let content = fs.readFileSync(fullPath, "utf-8");

  content = content.replace(
    'import { getResourceRoot } from "../../config/resourcePaths";',
    'import { normalizeCacheKey } from "../../config/resourcePaths";'
  );

  const GOODS_PREFIXES = `const GOODS_KEY_PREFIXES = ["ini/goods/"] as const;`;
  content = content.replace(
    "const goodsCache",
    `${GOODS_PREFIXES}\n\nconst goodsCache`
  );

  // Remove old normalizeKey function
  content = content.replace(
    /\/\/ =+ 缓存键规范化 =+\n\nfunction normalizeKey\(fileName: string\): string \{[\s\S]*?return key\.toLowerCase\(\);\n\}/,
    ""
  );

  content = content.replaceAll("normalizeKey(", "normalizeCacheKey(");
  content = content.replace(/normalizeCacheKey\(([^,)]+)\)/g, (match, arg) => {
    if (arg.includes("GOODS_KEY_PREFIXES")) return match;
    return `normalizeCacheKey(${arg}, GOODS_KEY_PREFIXES)`;
  });

  fs.writeFileSync(fullPath, content, "utf-8");
  changes++;
  console.log(`  UPDATED: ${filePath}`);
}

// ============================================================
// character/level/levelConfigLoader.ts
// ============================================================
console.log("\n=== Updating character/level/levelConfigLoader.ts ===");

{
  const filePath = "character/level/levelConfigLoader.ts";
  const fullPath = path.join(ENGINE_SRC, filePath);
  let content = fs.readFileSync(fullPath, "utf-8");

  // This one has a different normalizeKey - just extracts filename
  // Let's check if it needs the same treatment
  // Its normalizeKey: const name = fileName.replace(/\\/g, "/").split("/").pop() ?? fileName; return name.toLowerCase();
  // This is different - it only takes the filename part. Let's keep it simple - just extract the basename.
  // Actually this is a different pattern - it just takes the last path segment.
  // We should NOT replace this one with normalizeCacheKey since the logic is fundamentally different.
  console.log("  SKIPPED: levelConfigLoader uses basename-only normalization (different pattern)");
}

// ============================================================
// Update config/index.ts to export the new function
// ============================================================
console.log("\n=== Updating config/index.ts ===");

{
  const filePath = "config/index.ts";
  const fullPath = path.join(ENGINE_SRC, filePath);
  let content = fs.readFileSync(fullPath, "utf-8");

  if (!content.includes("normalizeCacheKey")) {
    content = content.replace(
      "  // 工具函数\n  isResourcePath,",
      "  // 工具函数\n  isResourcePath,\n  // 缓存键规范化\n  normalizeCacheKey,"
    );
    fs.writeFileSync(fullPath, content, "utf-8");
    changes++;
    console.log(`  UPDATED: ${filePath}`);
  }
}

console.log(`\n=== Done! Total files changed: ${changes} ===`);

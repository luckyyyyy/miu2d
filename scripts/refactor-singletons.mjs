#!/usr/bin/env node
/**
 * Phase 3+4: Clean up singletons and reduce scattered imports
 * 
 * 1. Remove unused resourceLoader bind convenience exports
 * 2. Remove deprecated MapBase.Instance / MapBase.setInstance (unused)
 * 3. Remove unused magicRenderer module-level singleton (→ class-only export)
 * 4. Remove unused partnerList module-level singleton (→ class export)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_SRC = path.resolve(__dirname, "../packages/engine/src");
let changes = 0;

function updateFile(relPath, fn) {
  const fullPath = path.join(ENGINE_SRC, relPath);
  const original = fs.readFileSync(fullPath, "utf-8");
  const result = fn(original);
  if (result !== original) {
    fs.writeFileSync(fullPath, result, "utf-8");
    changes++;
    console.log(`  UPDATED: ${relPath}`);
  }
}

// ============================================================
// 1. Remove resourceLoader bind convenience exports
// ============================================================
console.log("\n=== 1. Remove resourceLoader bind convenience exports ===");

updateFile("resource/resourceLoader.ts", content => {
  return content.replace(
    /\n\/\*\*\n \* 导出便捷函数\n \*\/\nexport const loadText = resourceLoader\.loadText\.bind\(resourceLoader\);\nexport const loadBinary = resourceLoader\.loadBinary\.bind\(resourceLoader\);\nexport const loadAudio = resourceLoader\.loadAudio\.bind\(resourceLoader\);\nexport const loadIni = resourceLoader\.loadIni\.bind\(resourceLoader\);\nexport const getResourceStats = resourceLoader\.getStats\.bind\(resourceLoader\);\nexport const getResourceDebugSummary = resourceLoader\.getDebugSummary\.bind\(resourceLoader\);\n/,
    "\n"
  );
});

// ============================================================
// 2. Remove MapBase.Instance static pattern (all references are in comments)
// ============================================================
console.log("\n=== 2. Clean up MapBase static singleton ===");

updateFile("map/mapBase.ts", content => {
  // Remove the static _instance field
  content = content.replace(
    /  \/\*\* 单例实例 \(\) \*\/\n  private static _instance: MapBase \| null = null;\n\n/,
    ""
  );
  
  // Remove the static Instance getter
  content = content.replace(
    /  \/\*\*\n   \* @deprecated 使用引擎注入的 map 实例代替。将在后续版本移除。\n   \*\/\n  static get Instance\(\): MapBase \{[\s\S]*?\n  \}\n\n/,
    ""
  );
  
  // Remove setInstance
  content = content.replace(
    /  \/\*\*\n   \* @internal 设置全局单例引用（仅由 GameEngine 在初始化时调用）\n   \*\/\n  static setInstance\(instance: MapBase\): void \{\n    MapBase\._instance = instance;\n  \}\n\n/,
    ""
  );
  
  // Update the doc comment that references MapBase.Instance
  content = content.replace(
    " * 所有状态都在实例上，通过 MapBase.Instance 或 engine.map 访问",
    " * 所有状态都在实例上，通过 engine.map 访问"
  );
  
  return content;
});

// Remove MapBase.setInstance call in gameEngine.ts
updateFile("game/gameEngine.ts", content => {
  content = content.replace(
    /    \/\/ 创建地图实例并设置为全局单例（后向兼容 MapBase\.Instance）\n    this\._map = new MapBase\(\);\n    MapBase\.setInstance\(this\._map\);\n/,
    "    this._map = new MapBase();\n"
  );
  return content;
});

// ============================================================
// 3. Convert magicRenderer from module singleton → exported class (callers create/inject it)
//    Since only 4 files use it and 2 are in game/, let's make GameManager own it
// ============================================================
console.log("\n=== 3. Remove magicRenderer module-level singleton ===");

updateFile("magic/magicRenderer.ts", content => {
  // Remove the module-level singleton line
  content = content.replace(
    "\n// 单例\nexport const magicRenderer = new MagicRenderer();\n",
    ""
  );
  return content;
});

// Update magicLoader.ts to receive magicRenderer as parameter
updateFile("magic/magicLoader.ts", content => {
  // Change import
  content = content.replace(
    'import { magicRenderer } from "./magicRenderer";',
    'import type { MagicRenderer } from "./magicRenderer";'
  );
  
  // We need to understand how magicRenderer is used in magicLoader.ts first
  // It's used as: magicRenderer.getAsf(...)
  // Change the function to accept magicRenderer as parameter
  // Let's read the actual usage pattern
  return content;
});

// Update magic/manager/spriteFactory.ts
updateFile("magic/manager/spriteFactory.ts", content => {
  content = content.replace(
    'import { magicRenderer } from "../magicRenderer";',
    'import type { MagicRenderer } from "../magicRenderer";'
  );
  return content;
});

// For game/gameEngine.ts and game/gameManager.ts, they import magicRenderer directly
// Let's make GameManager create and own the instance
updateFile("game/gameManager.ts", content => {
  // Change import to create instance
  content = content.replace(
    'import { magicRenderer } from "../magic/magicRenderer";',
    'import { MagicRenderer } from "../magic/magicRenderer";'
  );
  return content;
});

updateFile("game/gameEngine.ts", content => {
  content = content.replace(
    'import { magicRenderer } from "../magic/magicRenderer";',
    'import { MagicRenderer } from "../magic/magicRenderer";'
  );
  return content;
});

// ============================================================
// 4. Convert partnerList from module singleton → class export
// ============================================================
console.log("\n=== 4. Convert partnerList to class export ===");

updateFile("listManager/partnerList.ts", content => {
  // Make the class exported, remove module-level singleton
  content = content.replace(
    "class PartnerListManager {",
    "export class PartnerListManager {"
  );
  content = content.replace(
    "\nexport const partnerList = new PartnerListManager();\n",
    ""
  );
  return content;
});

// Update listManager/index.ts
updateFile("listManager/index.ts", content => {
  content = content.replace(
    'export { partnerList } from "./partnerList";',
    'export { PartnerListManager } from "./partnerList";'
  );
  return content;
});

console.log(`\n=== Done! Total files changed: ${changes} ===`);
console.log("\nNOTE: Manual follow-up needed:");
console.log("  - gameEngine.ts: create MagicRenderer instance + PartnerListManager instance");
console.log("  - gameManager.ts: receive magicRenderer from gameEngine");
console.log("  - All magicRenderer/partnerList import sites need updating");

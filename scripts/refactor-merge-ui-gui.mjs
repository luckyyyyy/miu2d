#!/usr/bin/env node
/**
 * Phase 2: Merge ui/ into gui/
 *
 * Actions:
 * 1. Move ui/contract.ts → gui/contract.ts
 * 2. Move ui/uiBridge.ts → gui/uiBridge.ts
 * 3. Update all internal imports within the moved files
 * 4. Update all imports across engine/src/ that reference ui/
 * 5. Update engine/src/index.ts barrel export
 * 6. Update engine package.json exports
 * 7. Update external imports in packages/web/
 * 8. Update gui/index.ts to include new exports
 * 9. Delete ui/ directory
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENGINE_SRC = path.join(ROOT, "packages/engine/src");

let totalChanges = 0;

function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.warn(`  SKIP (not found): ${filePath}`);
    return;
  }
  let content = fs.readFileSync(filePath, "utf-8");
  let changed = false;
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.replaceAll(from, to);
      changed = true;
      totalChanges++;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`  UPDATED: ${path.relative(ROOT, filePath)}`);
  }
}

function findTsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

// ============================================================
// Step 1: Move files
// ============================================================
console.log("\n=== Step 1: Move ui/ files to gui/ ===");

const uiDir = path.join(ENGINE_SRC, "ui");
const guiDir = path.join(ENGINE_SRC, "gui");

// Read source files before moving
const contractContent = fs.readFileSync(path.join(uiDir, "contract.ts"), "utf-8");
const uiBridgeContent = fs.readFileSync(path.join(uiDir, "uiBridge.ts"), "utf-8");

// Write to gui/
fs.writeFileSync(path.join(guiDir, "contract.ts"), contractContent);
fs.writeFileSync(path.join(guiDir, "uiBridge.ts"), uiBridgeContent);
console.log("  Copied ui/contract.ts → gui/contract.ts");
console.log("  Copied ui/uiBridge.ts → gui/uiBridge.ts");

// ============================================================
// Step 2: Fix imports inside the moved files
// ============================================================
console.log("\n=== Step 2: Fix imports in moved files ===");

// uiBridge.ts used to be in ui/, now it's in gui/
// - "../gui/buyManager" → "./buyManager" (now in same directory)
// - Other ../xxx paths stay the same (both ui/ and gui/ are at same depth)
replaceInFile(path.join(guiDir, "uiBridge.ts"), [
  ['from "../gui/buyManager"', 'from "./buyManager"'],
  ['from "../gui/guiManager"', 'from "./guiManager"'],
  ['from "../gui/types"', 'from "./types"'],
]);

// contract.ts has no gui/ imports, just ../core/ which stays the same

// ============================================================
// Step 3: Update all engine-internal imports
// ============================================================
console.log("\n=== Step 3: Update engine-internal imports ===");

const engineFiles = findTsFiles(ENGINE_SRC);
for (const file of engineFiles) {
  // Skip the files we already handled
  if (file.endsWith("ui/contract.ts") || file.endsWith("ui/uiBridge.ts") || file.endsWith("ui/index.ts")) {
    continue;
  }

  const rel = path.relative(path.dirname(file), ENGINE_SRC);

  replaceInFile(file, [
    // Direct imports from ui/ → gui/
    ['from "../ui/contract"', 'from "../gui/contract"'],
    ['from "../ui/uiBridge"', 'from "../gui/uiBridge"'],
    ['from "../../ui/contract"', 'from "../../gui/contract"'],
    ['from "../../ui/uiBridge"', 'from "../../gui/uiBridge"'],
    ['from "./ui/contract"', 'from "./gui/contract"'],
    ['from "./ui/uiBridge"', 'from "./gui/uiBridge"'],
    ['from "./ui"', 'from "./gui"'],
    // If the main index.ts re-exports ui
    ['export * from "./ui"', '// ui/ merged into gui/ - exports now in gui/index.ts'],
  ]);
}

// ============================================================
// Step 4: Update gui/index.ts to include new exports
// ============================================================
console.log("\n=== Step 4: Update gui/index.ts ===");

const guiIndexContent = `/**
 * GUI module - 引擎 GUI/UI 统一模块
 *
 * 包含:
 * - contract.ts: UI 层与引擎层之间的数据契约 (IUIBridge, UIAction, 面板类型等)
 * - uiBridge.ts: 引擎与 UI 层的桥接器实现
 * - guiManager.ts: 引擎内 GUI 状态管理 (对话框/菜单/选择)
 * - buyManager.ts: 商店购买系统
 * - uiConfig.ts: UI 配置加载
 * - uiSettings.ts: UI 设置加载
 * - types.ts: GUI 类型定义
 */

// UI 契约 (原 ui/contract.ts)
export * from "./contract";

// UI 桥接器 (原 ui/uiBridge.ts)
export { UIBridge, type UIBridgeDeps } from "./uiBridge";

// GUI 管理器
export * from "./guiManager";

// 购买管理器
export * from "./buyManager";

// GUI 类型
export * from "./types";

// UI 配置
export * from "./uiConfig";
`;

fs.writeFileSync(path.join(guiDir, "index.ts"), guiIndexContent);
console.log("  Rewrote gui/index.ts with merged exports");

// ============================================================
// Step 5: Update engine/src/index.ts
// ============================================================
console.log("\n=== Step 5: Update engine/src/index.ts ===");

replaceInFile(path.join(ENGINE_SRC, "index.ts"), [
  [
    '// ui/ merged into gui/ - exports now in gui/index.ts',
    '// UI contract & bridge now in gui/ module'
  ],
]);

// ============================================================
// Step 6: Update engine package.json exports
// ============================================================
console.log("\n=== Step 6: Update engine package.json ===");

const pkgPath = path.join(ROOT, "packages/engine/package.json");
let pkgContent = fs.readFileSync(pkgPath, "utf-8");

// Replace ui entries with gui entries, keeping gui entries
// Remove old ui entries
pkgContent = pkgContent.replace(/\s*"\.\/ui":\s*"\.\/src\/ui\/index\.ts",?\n/g, "\n");
pkgContent = pkgContent.replace(/\s*"\.\/ui\/\*":\s*"\.\/src\/ui\/\*\.ts",?\n/g, "\n");

// Add gui/contract and gui/uiBridge if not already present
if (!pkgContent.includes('"./gui/contract"')) {
  pkgContent = pkgContent.replace(
    '"./gui/*": "./src/gui/*.ts"',
    '"./gui/*": "./src/gui/*.ts",\n    "./gui/contract": "./src/gui/contract.ts"'
  );
}

fs.writeFileSync(pkgPath, pkgContent);
console.log("  Updated package.json exports");

// ============================================================
// Step 7: Update external imports (packages/web/)
// ============================================================
console.log("\n=== Step 7: Update external imports ===");

const webFiles = findTsFiles(path.join(ROOT, "packages/web/src"));
const viewerFiles = findTsFiles(path.join(ROOT, "packages/viewer/src"));

for (const file of [...webFiles, ...viewerFiles]) {
  replaceInFile(file, [
    ['from "@miu2d/engine/ui/contract"', 'from "@miu2d/engine/gui/contract"'],
    ['from "@miu2d/engine/ui/uiBridge"', 'from "@miu2d/engine/gui/uiBridge"'],
    ['from "@miu2d/engine/ui"', 'from "@miu2d/engine/gui"'],
  ]);
}

// ============================================================
// Step 8: Delete ui/ directory
// ============================================================
console.log("\n=== Step 8: Delete ui/ directory ===");

fs.rmSync(uiDir, { recursive: true });
console.log("  Deleted packages/engine/src/ui/");

console.log(`\n=== Done! Total replacements: ${totalChanges} ===`);

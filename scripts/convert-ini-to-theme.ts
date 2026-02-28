#!/usr/bin/env tsx
/**
 * INI → UiTheme JSON 转换脚本
 *
 * 将 ui_settings.ini 文件转换为 UiTheme JSON 格式。
 *
 * 用法:
 *   pnpm tsx scripts/convert-ini-to-theme.ts <ini_file> [output_file]
 *   pnpm tsx scripts/convert-ini-to-theme.ts ui_demo/月影传说.ini ui_demo/月影传说.json
 *   pnpm tsx scripts/convert-ini-to-theme.ts --all   # 批量转换 ui_demo/ 下所有 .ini
 *
 * 如果不指定 output_file，默认输出到同目录同名 .json 文件。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 直接导入 engine 的 parseIni 和各解析函数
// 因为 convertIniToTheme 已经封装在 engine 中，但这里避免依赖 logger 等副作用
// 所以我们直接内联 parseIni + 各 parse 函数的调用

// parseIni is a pure function, import it directly
import { convertIniToTheme } from "../packages/dashboard/src/lib/ui-settings-legacy";

function convertFile(iniPath: string, outputPath?: string): void {
  const resolvedIni = path.resolve(iniPath);
  if (!fs.existsSync(resolvedIni)) {
    console.error(`Error: file not found: ${resolvedIni}`);
    process.exit(1);
  }

  const iniContent = fs.readFileSync(resolvedIni, "utf-8");
  const theme = convertIniToTheme(iniContent);

  const out = outputPath
    ? path.resolve(outputPath)
    : resolvedIni.replace(/\.ini$/i, ".json");

  fs.writeFileSync(out, JSON.stringify(theme, null, 2), "utf-8");

  // 统计非空字段数
  const sectionCount = Object.keys(theme).length;
  const totalFields = Object.values(theme).reduce((acc, section) => {
    if (section && typeof section === "object") {
      return acc + Object.keys(section).length;
    }
    return acc;
  }, 0);

  console.log(`✓ ${path.basename(resolvedIni)} → ${path.basename(out)}`);
  console.log(`  ${sectionCount} sections, ${totalFields} top-level fields`);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage:");
    console.log("  pnpm tsx scripts/convert-ini-to-theme.ts <ini_file> [output_file]");
    console.log("  pnpm tsx scripts/convert-ini-to-theme.ts --all");
    console.log("");
    console.log("Options:");
    console.log("  --all    Convert all .ini files in ui_demo/ directory");
    process.exit(0);
  }

  if (args[0] === "--all") {
    const demoDir = path.resolve(__dirname, "../ui_demo");
    if (!fs.existsSync(demoDir)) {
      console.error(`Error: ui_demo/ directory not found`);
      process.exit(1);
    }

    const iniFiles = fs.readdirSync(demoDir).filter((f) => f.endsWith(".ini"));
    if (iniFiles.length === 0) {
      console.log("No .ini files found in ui_demo/");
      return;
    }

    console.log(`Converting ${iniFiles.length} INI files...\n`);
    for (const file of iniFiles) {
      convertFile(path.join(demoDir, file));
      console.log("");
    }
    console.log("Done!");
    return;
  }

  convertFile(args[0], args[1]);
}

main();

#!/usr/bin/env python3
"""
Convert text files from GBK to UTF-8 (无脑转换，不做判断).

Usage:
    uv run scripts/convert-encoding.py [resources_dir]

Examples:
    uv run scripts/convert-encoding.py              # 转换 ./resources
    uv run scripts/convert-encoding.py ./canghai    # 转换 ./canghai
"""

# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///

import sys
from pathlib import Path


def convert_file(filepath: Path) -> tuple[str, str]:
    """
    Convert a file from GBK to UTF-8 unconditionally.

    Returns:
        tuple of (status, message)
        status: "converted", "skipped", "failed"
    """
    try:
        content = filepath.read_bytes()
    except Exception as e:
        return "failed", f"❌ 读取失败: {filepath} ({e})"

    # Skip empty files
    if len(content) == 0:
        return "skipped", f"⏭️  跳过空文件: {filepath}"

    # 无脑用 GBK 解码，遇到错误用 replace 策略
    try:
        text = content.decode("gbk", errors="replace")
        filepath.write_text(text, encoding="utf-8")
        return "converted", f"✅ 已转换: {filepath} (GBK → UTF-8)"
    except Exception as e:
        return "failed", f"❌ 转换失败: {filepath} ({e})"


def main():
    # Get resources directory from command line or use default
    resources_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("./resources")

    if not resources_dir.exists():
        print(f"❌ 目录不存在: {resources_dir}")
        sys.exit(1)

    print(f"🔄 开始转换 {resources_dir} 目录中的 .ini, .txt, .npc 和 .obj 文件...")
    print("   从 GB2312/GBK 编码转换为 UTF-8")
    print()

    # Find all target files
    extensions = ("*.ini", "*.txt", "*.npc", "*.obj")
    files: list[Path] = []
    for ext in extensions:
        files.extend(resources_dir.rglob(ext))

    converted = 0
    skipped = 0
    failed = 0

    for filepath in sorted(files):
        status, message = convert_file(filepath)
        print(message)

        if status == "converted":
            converted += 1
        elif status == "skipped":
            skipped += 1
        else:
            failed += 1

    print()
    print("🎉 转换完成!")
    print(f"   转换文件数: {converted}")
    print(f"   跳过文件数: {skipped}")
    print(f"   失败文件数: {failed}")


if __name__ == "__main__":
    main()

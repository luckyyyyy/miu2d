#!/usr/bin/env python3
"""
Convert text files from GBK/GB2312 to UTF-8.

Usage:
    uv run scripts/convert-encoding.py [resources_dir]

Examples:
    uv run scripts/convert-encoding.py              # 转换 ./resources
    uv run scripts/convert-encoding.py ./canghai    # 转换 ./canghai

This script uses charset-normalizer for accurate encoding detection.
"""

# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "charset-normalizer>=3.0.0",
# ]
# ///

import sys
from pathlib import Path

from charset_normalizer import from_bytes


def detect_encoding(content: bytes) -> str | None:
    """Detect the encoding of byte content using charset-normalizer."""
    result = from_bytes(content)
    best = result.best()
    if best is None:
        return None
    return best.encoding


def is_ascii_only(content: bytes) -> bool:
    """Check if content contains only ASCII characters."""
    return all(b < 128 for b in content)


def has_utf8_bom(content: bytes) -> bool:
    """Check if content starts with UTF-8 BOM."""
    return content.startswith(b"\xef\xbb\xbf")


def convert_file(filepath: Path) -> tuple[str, str]:
    """
    Convert a file to UTF-8 if needed.

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

    # Skip ASCII-only files
    if is_ascii_only(content):
        return "skipped", f"⏭️  纯 ASCII: {filepath}"

    # Check for UTF-8 BOM - already UTF-8
    if has_utf8_bom(content):
        return "skipped", f"⏭️  已是 UTF-8 (BOM): {filepath}"

    # Detect encoding
    detected = detect_encoding(content)

    # If detection failed, try GBK as fallback (common for Chinese game resources)
    if detected is None:
        for enc in ("gbk", "gb18030", "gb2312"):
            try:
                # Use 'replace' to handle invalid bytes
                text = content.decode(enc, errors="replace")
                # Verify it contains Chinese characters after decoding
                if any('\u4e00' <= c <= '\u9fff' for c in text):
                    filepath.write_text(text, encoding="utf-8")
                    return "converted", f"✅ 已转换 (强制): {filepath} ({enc} → UTF-8)"
            except Exception:
                continue
        # Last resort: try with error replacement
        try:
            text = content.decode("gbk", errors="replace")
            filepath.write_text(text, encoding="utf-8")
            return "converted", f"✅ 已转换 (容错): {filepath} (gbk → UTF-8)"
        except Exception:
            pass
        return "failed", f"❌ 无法检测编码: {filepath}"

    detected_lower = detected.lower()

    # Already UTF-8
    if detected_lower in ("utf-8", "utf_8", "ascii"):
        return "skipped", f"⏭️  已是 UTF-8: {filepath}"

    # GBK family encodings
    gbk_encodings = ("gb2312", "gbk", "gb18030", "hz", "iso-2022-cn", "big5", "cp936")

    if detected_lower in gbk_encodings or detected_lower.startswith("gb"):
        try:
            # Try to decode with detected encoding
            text = content.decode(detected)
            # Write as UTF-8
            filepath.write_text(text, encoding="utf-8")
            return "converted", f"✅ 已转换: {filepath} ({detected} → UTF-8)"
        except Exception as e:
            # Fallback: try common Chinese encodings
            for enc in ("gbk", "gb18030", "gb2312"):
                try:
                    text = content.decode(enc)
                    filepath.write_text(text, encoding="utf-8")
                    return "converted", f"✅ 已转换: {filepath} ({enc} → UTF-8)"
                except Exception:
                    continue
            return "failed", f"❌ 转换失败: {filepath} ({e})"

    # Windows code pages that might be misdetected GBK
    windows_encodings = ("cp1250", "cp1251", "cp1252", "cp1253", "cp1254", "cp1255", "cp1256")
    if detected_lower in windows_encodings:
        # For Chinese game resources, try GBK first
        for enc in ("gbk", "gb18030"):
            try:
                text = content.decode(enc)
                # Check if result contains Chinese characters
                if any('\u4e00' <= c <= '\u9fff' for c in text):
                    filepath.write_text(text, encoding="utf-8")
                    return "converted", f"✅ 已转换: {filepath} ({enc} → UTF-8)"
            except Exception:
                continue
        # Fall through to use detected encoding

    # Other encodings - try to convert
    try:
        text = content.decode(detected)
        filepath.write_text(text, encoding="utf-8")
        return "converted", f"✅ 已转换: {filepath} ({detected} → UTF-8)"
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

#!/bin/bash
# Convert all .ini, .txt and .npc files in resources folder from GB2312 to UTF-8
# 将资源目录下所有 .ini, .txt 和 .npc 文件从 GB2312 转换为 UTF-8
#
# Usage: ./convert-encoding.sh [resources_dir]
#   resources_dir: 资源目录路径，默认为 "./resources"
#
# Examples:
#   ./convert-encoding.sh              # 转换 ./resources
#   ./convert-encoding.sh ./canghai    # 转换 ./canghai
#
# This script is idempotent - it will skip files that are already valid UTF-8.
#
# Detection strategy (精准判断):
#   1. Skip ASCII-only files (no conversion needed)
#   2. Check for UTF-8 BOM (0xEF 0xBB 0xBF) - definitely UTF-8
#   3. Use byte-level analysis to detect encoding:
#      - UTF-8 has specific multi-byte patterns: 110xxxxx 10xxxxxx, etc.
#      - GBK has two-byte sequences where both bytes are >= 0x81
#   4. Try both interpretations and check which produces valid Chinese
#
# Note: Simple `iconv -f UTF-8 -t UTF-8` validation is unreliable because some GBK
# byte sequences happen to be valid UTF-8 multibyte sequences.

set -e

# 支持参数化资源目录
RESOURCES_DIR="${1:-./resources}"
CONVERTED=0
SKIPPED=0
FAILED=0

echo "🔄 开始转换 $RESOURCES_DIR 目录中的 .ini, .txt 和 .npc 文件..."
echo "   从 GB2312/GBK 编码转换为 UTF-8"
echo ""

# Check if file contains only ASCII (no high bytes)
is_ascii_only() {
    ! grep -qP '[^\x00-\x7F]' "$1" 2>/dev/null
}

# Check if file has UTF-8 BOM (0xEF 0xBB 0xBF)
has_utf8_bom() {
    local first_bytes
    first_bytes=$(head -c 3 "$1" | xxd -p)
    [[ "$first_bytes" == "efbbbf" ]]
}

# Check if a string contains common Chinese characters (CJK Unified Ideographs)
# UTF-8 encoded Chinese: U+4E00-U+9FFF
contains_chinese() {
    grep -qP '[\x{4e00}-\x{9fff}]' "$1" 2>/dev/null
}

# Count Chinese characters in a file
count_chinese() {
    grep -oP '[\x{4e00}-\x{9fff}]' "$1" 2>/dev/null | wc -l
}

# Check if file is valid UTF-8 by trying to convert it
is_valid_utf8() {
    iconv -f UTF-8 -t UTF-8 "$1" > /dev/null 2>&1
}

# Check if content contains rare/unusual Unicode characters that indicate mojibake
# These are characters that commonly appear when GBK is misread as UTF-8
has_mojibake() {
    # Latin Extended-B, IPA Extensions, Spacing Modifier Letters, Hebrew, etc.
    # These rarely appear in legitimate Chinese text
    grep -qP '[\x{0250}-\x{02AF}\x{0180}-\x{024F}\x{0590}-\x{05FF}\x{0100}-\x{017F}]' "$1" 2>/dev/null
}

# Detect encoding by analyzing byte patterns and comparing results
# Returns: "utf8" if already UTF-8, "gbk" if needs conversion, "unknown" otherwise
detect_encoding() {
    local file="$1"
    local temp_utf8 temp_gbk
    temp_utf8=$(mktemp)
    temp_gbk=$(mktemp)

    # Check for UTF-8 BOM first
    if has_utf8_bom "$file"; then
        rm -f "$temp_utf8" "$temp_gbk"
        echo "utf8"
        return
    fi

    # Try interpreting as UTF-8
    local utf8_valid=false
    local utf8_chinese=0
    local utf8_mojibake=false
    if iconv -f UTF-8 -t UTF-8 "$file" > "$temp_utf8" 2>/dev/null; then
        utf8_valid=true
        utf8_chinese=$(count_chinese "$temp_utf8")
        if has_mojibake "$temp_utf8"; then
            utf8_mojibake=true
        fi
    fi

    # Try interpreting as GBK and converting to UTF-8
    local gbk_valid=false
    local gbk_chinese=0
    if iconv -f GBK -t UTF-8 "$file" > "$temp_gbk" 2>/dev/null; then
        gbk_valid=true
        gbk_chinese=$(count_chinese "$temp_gbk")
    fi

    rm -f "$temp_utf8" "$temp_gbk"

    # Decision logic:
    # 1. If UTF-8 produces mojibake, it's likely GBK
    # 2. If only one encoding is valid, use that
    # 3. If both valid, compare Chinese character counts
    # 4. The encoding that produces more Chinese characters is likely correct

    if $utf8_valid && $utf8_mojibake && $gbk_valid; then
        # UTF-8 interpretation has mojibake - it's GBK
        echo "gbk"
    elif $utf8_valid && ! $gbk_valid; then
        echo "utf8"
    elif $gbk_valid && ! $utf8_valid; then
        echo "gbk"
    elif $utf8_valid && $gbk_valid; then
        # Both valid - compare Chinese character counts
        # GBK files misread as UTF-8 typically produce fewer or no Chinese chars
        if (( gbk_chinese > utf8_chinese )); then
            # GBK produces more Chinese - it's GBK
            echo "gbk"
        elif (( utf8_chinese > gbk_chinese )); then
            # UTF-8 produces more Chinese - likely real UTF-8
            echo "utf8"
        elif (( gbk_chinese > 0 )); then
            # Same count but has Chinese - prefer GBK for game resources
            echo "gbk"
        else
            # Neither has Chinese - assume UTF-8 (safer)
            echo "utf8"
        fi
    else
        echo "unknown"
    fi
}

# Find all .ini, .txt and .npc files
while IFS= read -r -d '' file; do
    # Skip empty files
    if [[ ! -s "$file" ]]; then
        echo "⏭️  跳过空文件: $file"
        ((SKIPPED++)) || true
        continue
    fi

    # Skip ASCII-only files (no conversion needed)
    if is_ascii_only "$file"; then
        echo "⏭️  纯 ASCII: $file"
        ((SKIPPED++)) || true
        continue
    fi

    # Detect encoding using byte analysis
    encoding=$(detect_encoding "$file")

    case "$encoding" in
        utf8)
            echo "⏭️  已是 UTF-8: $file"
            ((SKIPPED++)) || true
            ;;
        gbk)
            # Convert from GBK to UTF-8
            temp_file=$(mktemp)
            if iconv -f GBK -t UTF-8 "$file" > "$temp_file" 2>/dev/null; then
                mv "$temp_file" "$file"
                echo "✅ 已转换: $file (GBK → UTF-8)"
                ((CONVERTED++)) || true
            else
                rm -f "$temp_file"
                # Fallback: try GB18030 (superset of GBK)
                if iconv -f GB18030 -t UTF-8 "$file" > "$temp_file" 2>/dev/null; then
                    mv "$temp_file" "$file"
                    echo "✅ 已转换: $file (GB18030 → UTF-8)"
                    ((CONVERTED++)) || true
                else
                    rm -f "$temp_file"
                    echo "❌ 转换失败: $file"
                    ((FAILED++)) || true
                fi
            fi
            ;;
        *)
            echo "⚠️  无法识别编码: $file"
            ((FAILED++)) || true
            ;;
    esac
done < <(find "$RESOURCES_DIR" -type f \( -name "*.ini" -o -name "*.txt" -o -name "*.npc" \) -print0)

echo ""
echo "🎉 转换完成!"
echo "   转换文件数: $CONVERTED"
echo "   跳过文件数: $SKIPPED"
echo "   失败文件数: $FAILED"

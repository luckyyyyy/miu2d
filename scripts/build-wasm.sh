#!/bin/bash
# 构建 engine-wasm 包
# 需要安装: rustup, wasm-pack

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WASM_DIR="$SCRIPT_DIR/../packages/engine-wasm"

echo "🦀 Building Miu2D Engine WASM..."

# 检查依赖
if ! command -v rustup &> /dev/null; then
    echo "❌ rustup not found. Please install Rust first:"
    echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

if ! command -v wasm-pack &> /dev/null; then
    echo "📦 Installing wasm-pack..."
    cargo install wasm-pack
fi

# 确保 wasm32 目标已安装
if ! rustup target list --installed | grep -q wasm32-unknown-unknown; then
    echo "🎯 Adding wasm32-unknown-unknown target..."
    rustup target add wasm32-unknown-unknown
fi

cd "$WASM_DIR"

# 构建
echo "🔨 Building WASM module..."
wasm-pack build --target web --out-dir pkg --release

# 清理不需要的文件
rm -f pkg/.gitignore pkg/package.json

echo "✅ Build complete! Output in packages/engine-wasm/pkg/"
echo ""
echo "📊 WASM file size:"
ls -lh pkg/*.wasm 2>/dev/null || echo "   No .wasm files found"

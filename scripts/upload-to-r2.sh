#!/bin/bash
# 上传资源文件到 Cloudflare R2
#
# 使用前请先配置 AWS CLI 和 R2 凭证:
#   1. 在 Cloudflare Dashboard -> R2 -> 管理 R2 API 令牌 创建 API 令牌
#   2. 运行: aws configure --profile r2
#      - Access Key ID: 你的 R2 Access Key
#      - Secret Access Key: 你的 R2 Secret Key
#      - Default region: auto
#      - Default output format: json
#
# 用法:
#   ./scripts/upload-to-r2.sh [--dry-run]
#
# 选项:
#   --dry-run  只显示将要上传的文件，不实际上传

set -e

# ====== 配置 ======
BUCKET_NAME="yycs"
ACCOUNT_ID="7ded1bc244a6ae412ccec1149151420a"
ENDPOINT_URL="https://${ACCOUNT_ID}.r2.cloudflarestorage.com"
SOURCE_DIR="./resources"
PROFILE="r2"

# ====== 参数处理 ======
DRY_RUN=""
if [ "$1" == "--dry-run" ]; then
    DRY_RUN="--dryrun"
    echo "🔍 Dry run mode - 不会实际上传文件"
fi

# ====== 检查 AWS CLI ======
if ! command -v aws &> /dev/null; then
    echo "❌ 未找到 AWS CLI，请先安装:"
    echo "   brew install awscli  # macOS"
    echo "   或访问 https://aws.amazon.com/cli/"
    exit 1
fi

# ====== 检查源目录 ======
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ 源目录不存在: $SOURCE_DIR"
    exit 1
fi

# ====== 计算文件数量和大小 ======
echo "📁 源目录: $SOURCE_DIR"
FILE_COUNT=$(find "$SOURCE_DIR" -type f | wc -l | tr -d ' ')
TOTAL_SIZE=$(du -sh "$SOURCE_DIR" | cut -f1)
echo "📊 文件数量: $FILE_COUNT"
echo "📊 总大小: $TOTAL_SIZE"
echo ""

# ====== 上传到 R2 ======
echo "🚀 开始上传到 R2..."
echo "   Bucket: $BUCKET_NAME"
echo "   Endpoint: $ENDPOINT_URL"
echo ""

aws s3 sync "$SOURCE_DIR" "s3://${BUCKET_NAME}/resources" \
    --endpoint-url "$ENDPOINT_URL" \
    --profile "$PROFILE" \
    --delete \
    $DRY_RUN

if [ -z "$DRY_RUN" ]; then
    echo ""
    echo "✅ 上传完成!"
    echo ""
    echo "📝 下一步:"
    echo "   1. 在 Cloudflare Dashboard -> R2 -> $BUCKET_NAME -> 设置"
    echo "      配置公开访问（自定义域名或 R2.dev 子域名）"
    echo "   2. 在 Vercel 项目设置中添加环境变量:"
    echo "      VITE_DEMO_RESOURCES_DOMAIN=https://your-r2-domain.example.com"
else
    echo ""
    echo "ℹ️  这是 dry run，未实际上传。移除 --dry-run 参数执行真正的上传。"
fi

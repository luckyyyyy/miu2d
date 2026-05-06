#!/usr/bin/env bash
# 目标服务器通过环境变量传入: MIRROR_HOST=<ip> bash deploy/deploy-mirror.sh
# 与 Vercel 部署等价，env vars 保持一致

set -euo pipefail

REMOTE_HOST="root@${MIRROR_HOST:?需要设置 MIRROR_HOST 环境变量}"
REMOTE_PORT=20000
SSH="ssh -p $REMOTE_PORT"
SCP="scp -P $REMOTE_PORT"
REMOTE_DIR="/home/miu2d"
IMAGES_TAR="/tmp/miu2d-web.tar.gz"

# ── 版本信息 ──────────────────────────────────────────────
export COMMIT_HASH
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
export APP_VERSION
APP_VERSION=$(node -p "require('./packages/web/package.json').version" 2>/dev/null || echo "0.0.0")
echo "==> Build: COMMIT_HASH=$COMMIT_HASH  APP_VERSION=$APP_VERSION"

# ── 构建前端镜像（env vars 同 vercel.json） ───────────────
echo "==> Building miu2d-web ..."
docker build \
  --file packages/web/Dockerfile \
  --tag miu2d-web:latest \
  --build-arg COMMIT_HASH="$COMMIT_HASH" \
  --build-arg APP_VERSION="$APP_VERSION" \
  --build-arg VITE_DEMO_RESOURCES_DOMAIN="https://miu2d.williamchan.me:10443" \
  --build-arg STATIC_ONLY=true \
  --build-arg VITE_S3_BASE_URL="https://s3.williamchan.me:10443/miu2d" \
  --build-arg CACHE_BUST="$(date +%s)" \
  .

# ── 打包并传输 ────────────────────────────────────────────
echo "==> Saving image ..."
docker save miu2d-web:latest | gzip > "$IMAGES_TAR"
echo "    Size: $(du -sh "$IMAGES_TAR" | cut -f1)"

echo "==> Uploading to server ..."
$SCP "$IMAGES_TAR" "$REMOTE_HOST:/tmp/miu2d-web.tar.gz"
$SSH "$REMOTE_HOST" "mkdir -p $REMOTE_DIR"
$SCP deploy/server-144/docker-compose.yml "$REMOTE_HOST:$REMOTE_DIR/docker-compose.yml"

# ── 服务端部署 ────────────────────────────────────────────
echo "==> Loading image on server ..."
$SSH "$REMOTE_HOST" "docker load -i /tmp/miu2d-web.tar.gz && rm -f /tmp/miu2d-web.tar.gz"

echo "==> Ensuring proxy-network exists ..."
$SSH "$REMOTE_HOST" "docker network inspect proxy-network >/dev/null 2>&1 || docker network create proxy-network"

echo "==> Starting miu2d-web ..."
$SSH "$REMOTE_HOST" "cd $REMOTE_DIR && docker compose up -d"

echo "==> Connecting ai-stack-nginx to proxy-network ..."
$SSH "$REMOTE_HOST" "docker network connect proxy-network ai-stack-nginx 2>/dev/null && echo 'connected' || echo 'already connected'"

# ── 生成 miu2d.com 自签名证书（Cloudflare Full 模式） ─────
echo "==> Ensuring miu2d.com cert ..."
$SSH "$REMOTE_HOST" bash << 'REMOTE'
CERT_DIR=/home/ai-stack/certs
if [[ ! -f "$CERT_DIR/miu2d.crt" ]]; then
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$CERT_DIR/miu2d.key" \
    -out "$CERT_DIR/miu2d.crt" \
    -subj "/CN=miu2d.com/O=miu2d/C=US" \
    -addext "subjectAltName=DNS:miu2d.com,DNS:www.miu2d.com" 2>/dev/null
  echo "    Certificate created."
else
  echo "    Certificate already exists."
fi
REMOTE

# ── 更新 ai-stack nginx 配置 ──────────────────────────────
echo "==> Updating nginx config ..."
$SCP deploy/server-144/nginx.conf "$REMOTE_HOST:/home/ai-stack/nginx.conf"
$SSH "$REMOTE_HOST" "docker exec ai-stack-nginx nginx -t && docker exec ai-stack-nginx nginx -s reload"

# ── 验证 ──────────────────────────────────────────────────
echo "==> Verifying ..."
$SSH "$REMOTE_HOST" bash << 'REMOTE'
echo ""
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "NAME|miu2d|ai-stack-nginx"
echo ""
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost/ -H "Host: miu2d.com" 2>/dev/null || echo "ERR")
echo "miu2d.com health: $STATUS"
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost/ -H "Host: specc.sh" 2>/dev/null || echo "ERR")
echo "specc.sh  health: $STATUS"
REMOTE

echo ""
echo "✅  Deploy complete!"
echo "    Vercel → OFF, miu2d.com → miu2d-web (static nginx)"
echo ""
echo "⚠️  Cloudflare DNS: miu2d.com A → ${MIRROR_HOST} (橙云代理)"
echo "⚠️  Cloudflare SSL: miu2d.com → Full 模式"

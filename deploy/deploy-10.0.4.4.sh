#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="root@10.0.4.4"
REMOTE_DIR="/home/miu2d"
COMPOSE_LOCAL="deploy/docker-compose.yml"
IMAGES_TAR="/tmp/miu2d-images.tar.gz"

if [[ ! -f "$COMPOSE_LOCAL" ]]; then
  echo "Missing $COMPOSE_LOCAL" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not found locally." >&2
  exit 1
fi

echo "==> Build images"
export COMMIT_HASH=$(git rev-parse --short HEAD)
export APP_VERSION=$(node -p "require('./packages/web/package.json').version" 2>/dev/null || echo "0.0.0")
echo "    COMMIT_HASH=$COMMIT_HASH  APP_VERSION=$APP_VERSION"
docker compose -f "$COMPOSE_LOCAL" build

echo "==> Save images"
docker save miu2d-server:latest miu2d-web:latest | gzip > "$IMAGES_TAR"

echo "==> Prepare remote dir"
ssh "$REMOTE_HOST" "mkdir -p $REMOTE_DIR"

echo "==> Upload images + compose"
scp "$IMAGES_TAR" "$REMOTE_HOST:/home/miu2d-images.tar.gz"
scp "$COMPOSE_LOCAL" "$REMOTE_HOST:$REMOTE_DIR/docker-compose.yml"

echo "==> Load images + start services"
ssh "$REMOTE_HOST" "docker load -i /home/miu2d-images.tar.gz"
ssh "$REMOTE_HOST" "docker compose -f $REMOTE_DIR/docker-compose.yml up -d"

echo "==> Wait for server to be healthy"
ssh "$REMOTE_HOST" "timeout 60 bash -c 'until docker exec miu2d-server node -e \"process.exit(0)\" 2>/dev/null; do sleep 2; done'"

echo "==> Run database migrations"
ssh "$REMOTE_HOST" "docker exec miu2d-server node dist/db/migrate.js"

echo "==> Rehash plaintext passwords (idempotent)"
ssh "$REMOTE_HOST" "docker exec miu2d-server node dist/db/rehash-passwords.js"

echo "==> Patch null scene data (idempotent)"
ssh "$REMOTE_HOST" "docker exec miu2d-server node dist/db/patch-null-scene-data.js"

echo "==> Done"

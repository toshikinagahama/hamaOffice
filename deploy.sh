#!/bin/bash
# サーバー上(exevolute権限)で実行するデプロイスクリプト。
# GitHub Actions から SSM 経由で呼ばれる想定。
set -euo pipefail
cd "$(dirname "$0")"

echo "=== git pull ==="
git pull origin main

echo "=== docker compose build & up ==="
docker compose up -d --build

echo "=== cleanup old images ==="
docker image prune -f

echo "=== done ==="

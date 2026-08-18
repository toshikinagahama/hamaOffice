#!/bin/bash
# サーバー上(exevolute権限)で実行するデプロイスクリプト。
# ビルドは GitHub Actions 側(潤沢なメモリ)で済ませ、ここでは
# ビルド済み成果物を S3 から取得して軽量な docker build を回すだけ。
# EC2 が t3.nano(0.5GB RAM) でフルビルドすると即スワップ地獄になるため。
#
# git pull はこのスクリプトの外(呼び出し元)で先に済ませておくこと。
# ここで git pull すると、実行中の bash がこのファイル自身の書き換えで
# 読み取り位置がズレ、以降の行を取りこぼす場合があるため。
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
cd "$(dirname "$0")"

echo "=== download build artifact from S3 ==="
aws s3 cp s3://hamaoffice-deploy-artifacts/deploy-artifact.tar.gz /tmp/deploy-artifact.tar.gz
tar xzf /tmp/deploy-artifact.tar.gz -C .
rm /tmp/deploy-artifact.tar.gz

echo "=== docker compose build & up ==="
docker compose up -d --build

echo "=== cleanup old images ==="
docker image prune -f

echo "=== done ==="

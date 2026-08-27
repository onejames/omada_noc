#!/usr/bin/env bash
set -e

# Detect container runtime (prefer podman, fallback to docker)
if command -v podman &> /dev/null; then
  RUNTIME="podman"
elif command -v docker &> /dev/null; then
  RUNTIME="docker"
else
  echo "❌ Error: Neither 'podman' nor 'docker' is installed in PATH."
  echo "👉 On macOS, install podman via: brew install podman && podman machine init && podman machine start"
  exit 1
fi

if [ ! -f ".env.local" ]; then
  echo "❌ Error: .env.local not found. Please copy .env.dist to .env.local and configure your credentials."
  exit 1
fi

# Use specified PORT or default to 3000 (or 3001 if 3000 is in use)
HOST_PORT=${HOST_PORT:-3000}
if lsof -i :$HOST_PORT &> /dev/null; then
  if [ "$HOST_PORT" = "3000" ]; then
    echo "⚠️ Port 3000 is already in use on host. Switching host port to 3001..."
    HOST_PORT=3001
  fi
fi

echo "🛑 Stopping and removing any existing 'noc_dash' container..."
$RUNTIME rm -f noc_dash 2>/dev/null || true

echo "🚀 Starting noc_dash container using $RUNTIME on host port $HOST_PORT (container port 3000)..."
$RUNTIME run -d \
  --name noc_dash \
  -p "$HOST_PORT:3000" \
  --env-file .env.local \
  noc_dash:latest

echo "⏳ Waiting for container to initialize..."
sleep 3

echo "🔍 Container Status:"
$RUNTIME ps | grep noc_dash || true

echo ""
echo "✅ Container is running!"
echo "👉 Open http://localhost:$HOST_PORT to view your live Omada NOC Dashboard."

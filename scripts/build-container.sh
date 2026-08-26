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

echo "🐳 Building noc_dash container using $RUNTIME..."
$RUNTIME build -t noc_dash:latest -f Containerfile .
echo "✅ Successfully built noc_dash:latest using $RUNTIME"

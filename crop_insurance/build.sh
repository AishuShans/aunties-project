#!/bin/bash
# AgriShield - Render Build Script
# Runs from: crop_insurance/ directory (rootDir in render.yaml)
set -e

echo "============================================"
echo "  AgriShield - Render Build Script"
echo "============================================"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Working dir: $SCRIPT_DIR"

# ── Step 1: Install Python dependencies ──────────────────────
echo ""
echo "[1/3] Installing Python dependencies..."
pip install -r "$SCRIPT_DIR/backend/requirements.txt"
echo "      Done."

# ── Step 2: Build React frontend ──────────────────────────────
echo ""
echo "[2/3] Building React frontend..."
cd "$SCRIPT_DIR/frontend"
npm install
npm run build
echo "      Build complete."

# ── Step 3: Copy built files to backend ───────────────────────
echo ""
echo "[3/3] Copying frontend dist to backend..."
rm -rf "$SCRIPT_DIR/backend/frontend_dist"
cp -r "$SCRIPT_DIR/frontend/dist" "$SCRIPT_DIR/backend/frontend_dist"
echo "      Copy complete."

echo ""
echo "============================================"
echo "  Build finished successfully!"
echo "  Start with: cd backend && uvicorn main:app --host 0.0.0.0 --port \$PORT"
echo "============================================"

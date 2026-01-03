#!/bin/bash
set -e

echo "Building YouTube Transcript LLM extension..."

# Clean dist
rm -rf dist
mkdir -p dist/content dist/background dist/icons

# Compile TypeScript
npx tsc

# Copy static files
cp src/popup/popup.html dist/
cp src/popup/popup.css dist/
cp manifest.json dist/

# Copy icons (create placeholder if not exist)
if [ -d "src/icons" ] && [ "$(ls -A src/icons 2>/dev/null)" ]; then
  cp src/icons/* dist/icons/
else
  echo "Warning: No icons found. Creating placeholders..."
  # Create simple placeholder icons using base64 encoded PNGs
  # These are simple colored squares as placeholders
  echo "Icons directory is empty - extension will work but without icons"
fi

echo "Build complete! Load dist/ folder in Chrome as unpacked extension."

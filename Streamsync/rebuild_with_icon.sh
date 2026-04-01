#!/bin/bash
# Streamsync - Rebuild with new icon + run on connected iPhone
# Double-click this file, or run it in Terminal

APP_DIR="/Users/dwong/Documents/GitHub/Streamsync/2026-Stream/homeflow"
IOS_DIR="$APP_DIR/ios"

echo "========================================"
echo " Streamsync Rebuild Script"
echo "========================================"
echo ""

cd "$APP_DIR" || { echo "ERROR: Could not find project at $APP_DIR"; exit 1; }

echo ">>> Step 1: Clearing Expo cache and DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData
rm -rf "$APP_DIR/.expo"
rm -rf "$APP_DIR/node_modules/.cache"
echo "Done."
echo ""

echo ">>> Step 2: Running expo prebuild --clean (this regenerates the native iOS icons)..."
npx expo prebuild --clean --platform ios
echo "Done."
echo ""

echo ">>> Step 3: Installing CocoaPods..."
cd "$IOS_DIR" && pod install
cd "$APP_DIR"
echo "Done."
echo ""

echo ">>> Step 4: Building and running on your connected iPhone..."
echo "    (Make sure your iPhone is unlocked and trusted on this Mac)"
echo ""
npx expo run:ios --device 2>&1 | tee /tmp/streamsync_build.log

echo ""
echo "========================================"
echo " Build complete. Check above for errors."
echo " Full log saved to: /tmp/streamsync_build.log"
echo "========================================"

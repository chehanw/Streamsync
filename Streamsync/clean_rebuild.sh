#!/bin/bash
echo "=== Cleaning Pods and DerivedData ==="
IOS_DIR="/Users/dwong/Documents/GitHub/Streamsync/2026-Stream/homeflow/ios"
APP_DIR="/Users/dwong/Documents/GitHub/Streamsync/2026-Stream/homeflow"

rm -rf "$IOS_DIR/Pods" "$IOS_DIR/Podfile.lock"
rm -rf ~/Library/Developer/Xcode/DerivedData
echo "Cleaned."

echo "=== Fresh pod install ==="
cd "$IOS_DIR"
pod install

echo "=== Building iOS app (no-install) ==="
cd "$APP_DIR"
npx expo run:ios --no-install 2>&1 | tee /tmp/expo_clean_build.log
echo "BUILD_EXIT: $?"

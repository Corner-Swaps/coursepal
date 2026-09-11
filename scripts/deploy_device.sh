#!/bin/bash
set -e

# Configuration
DEVICE_ID="48CDBE5E-B61B-52C8-B6FD-8B296C90A11C"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_PATH="/Users/slava/Library/Developer/Xcode/DerivedData/CoursePal-dcvtihrefvqubfaxyzothkhyfwln/Build/Products/Release-iphoneos/CoursePal.app"
BUNDLE_ID="com.coursepal.app"
SIGNING_IDENTITY="Apple Development: Viatcheslav Goloubov (3S4BRDY5RZ)"
APP_ID_ENTITLEMENT="KZ8W2GCVH8.com.coursepal.app"

echo "========================================================"
echo " CoursePal Automated Device Deployment Engine"
echo "========================================================"

cd "$PROJECT_DIR"

echo "🧹 1. Cleaning build locks & stale build daemons..."
killall -9 SWBBuildService 2>/dev/null || true
killall xcodebuild 2>/dev/null || true
rm -rf /Users/slava/Library/Developer/Xcode/DerivedData/CoursePal-dcvtihrefvqubfaxyzothkhyfwln/Build/Intermediates.noindex/XCBuildData

echo "📦 2. Bundling production React Native JS code..."
npx react-native bundle \
  --entry-file index.js \
  --platform ios \
  --dev false \
  --bundle-output ios/CoursePal/main.jsbundle \
  --assets-dest ios/CoursePal
cp ios/CoursePal/main.jsbundle ios/main.jsbundle

echo "🔨 3. Compiling native iOS app in Release mode..."
xcodebuild -workspace ios/CoursePal.xcworkspace \
  -scheme CoursePal \
  -configuration Release \
  -destination "id=$DEVICE_ID" \
  -allowProvisioningUpdates \
  build

echo "🔏 4. Extracting entitlements & code-signing app bundle..."
security cms -D -i "$APP_PATH/embedded.mobileprovision" > /tmp/profile.plist
plutil -extract Entitlements xml1 -o /tmp/entitlements.plist /tmp/profile.plist
plutil -replace application-identifier -string "$APP_ID_ENTITLEMENT" /tmp/entitlements.plist
codesign --force --sign "$SIGNING_IDENTITY" --entitlements /tmp/entitlements.plist --timestamp=none "$APP_PATH"

echo "📲 5. Installing app onto physical iPhone ($DEVICE_ID)..."
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH" --verbose

echo "🚀 6. Launching CoursePal ($BUNDLE_ID)..."
xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID"

echo "========================================================"
echo "✅ DEPLOYMENT COMPLETE! CoursePal is running on your iPhone."
echo "========================================================"

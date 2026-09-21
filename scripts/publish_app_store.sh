#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="$PROJECT_DIR/ios"
WORKSPACE="$IOS_DIR/CoursePal.xcworkspace"
SCHEME="CoursePal"
DATE_STR=$(date +%Y-%m-%d)
BUILD_NUM="5"
VERSION="1.4.2"
ARCHIVE_PATH="$HOME/Library/Developer/Xcode/Archives/$DATE_STR/CoursePal ${VERSION} (Build ${BUILD_NUM}).xcarchive"
EXPORT_DIR="$PROJECT_DIR/build/AppStore"
UPLOAD_DIR="$PROJECT_DIR/build/UploadAppStore"

echo "========================================================"
echo " CoursePal App Store Release & Publish Engine"
echo " Target: Version ${VERSION} (Build ${BUILD_NUM})"
echo "========================================================"

cd "$PROJECT_DIR"

echo "🧹 1. Cleaning build locks and output directories..."
rm -f /Users/slava/Library/Developer/Xcode/DerivedData/CoursePal-*/Build/Intermediates.noindex/XCBuildData/build.db* 2>/dev/null || true
rm -rf "$EXPORT_DIR" "$UPLOAD_DIR"
mkdir -p "$EXPORT_DIR" "$UPLOAD_DIR"
mkdir -p "$HOME/Library/Developer/Xcode/Archives/$DATE_STR"

echo "📦 2. Bundling fresh production React Native JS code..."
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
npx react-native bundle \
  --entry-file index.js \
  --platform ios \
  --dev false \
  --bundle-output ios/CoursePal/main.jsbundle \
  --assets-dest ios/CoursePal

echo "🔨 3. Archiving Xcode project to $ARCHIVE_PATH..."
xcodebuild archive \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=KZ8W2GCVH8

echo "📦 4. Archiving succeeded! Verifying archive structure..."
ls -la "$ARCHIVE_PATH/Products/Applications"

echo "📄 5. Preparing App Store export and upload manifests..."
cat << 'UPLOAD_PLIST' > "$UPLOAD_DIR/UploadOptions.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>destination</key>
	<string>upload</string>
	<key>manageAppVersionAndBuildNumber</key>
	<false/>
	<key>method</key>
	<string>app-store-connect</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>stripSwiftSymbols</key>
	<true/>
	<key>teamID</key>
	<string>KZ8W2GCVH8</string>
	<key>uploadSymbols</key>
	<true/>
</dict>
</plist>
UPLOAD_PLIST

cat << 'EXPORT_PLIST' > "$EXPORT_DIR/ExportOptions.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>destination</key>
	<string>export</string>
	<key>manageAppVersionAndBuildNumber</key>
	<false/>
	<key>method</key>
	<string>app-store</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>stripSwiftSymbols</key>
	<true/>
	<key>teamID</key>
	<string>KZ8W2GCVH8</string>
	<key>uploadSymbols</key>
	<true/>
</dict>
</plist>
EXPORT_PLIST

echo "📦 6. Exporting local IPA backup to $EXPORT_DIR..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$EXPORT_DIR/ExportOptions.plist" \
  -exportPath "$EXPORT_DIR" \
  -allowProvisioningUpdates

echo "✅ App Store IPA exported successfully to $EXPORT_DIR:"
ls -lh "$EXPORT_DIR"

echo "🚀 7. Uploading CoursePal ${VERSION} (Build ${BUILD_NUM}) to App Store Connect..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$UPLOAD_DIR/UploadOptions.plist" \
  -exportPath "$UPLOAD_DIR" \
  -allowProvisioningUpdates

echo "========================================================"
echo "✅ APP STORE CONNECT UPLOAD COMPLETE!"
echo "   CoursePal Version ${VERSION} (Build ${BUILD_NUM}) is published."
echo "========================================================"

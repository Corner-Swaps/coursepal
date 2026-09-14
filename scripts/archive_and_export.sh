#!/usr/bin/env bash
set -e

PROJECT_DIR="/Users/slava/Downloads/Projects/ClassPal"
IOS_DIR="$PROJECT_DIR/ios"
WORKSPACE="$IOS_DIR/CoursePal.xcworkspace"
SCHEME="CoursePal"
DATE_STR=$(date +%Y-%m-%d)
ARCHIVE_PATH="$HOME/Library/Developer/Xcode/Archives/$DATE_STR/CoursePal 1.4.1 (Build 2).xcarchive"
EXPORT_DIR="$PROJECT_DIR/build/AppStore"

echo "📦 1. Preparing export directory..."
rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR"
mkdir -p "$HOME/Library/Developer/Xcode/Archives/$DATE_STR"

echo "📦 2. Creating archive at $ARCHIVE_PATH..."
xcodebuild archive \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  -allowProvisioningUpdates \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=KZ8W2GCVH8

echo "📦 3. Archiving succeeded! Verifying archive structure..."
ls -la "$ARCHIVE_PATH/Products/Applications"

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

echo "📦 4. Exporting IPA using exportOptions.plist..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$EXPORT_DIR/ExportOptions.plist" \
  -exportPath "$EXPORT_DIR" \
  -allowProvisioningUpdates

echo "✅ App Store IPA exported successfully to $EXPORT_DIR:"
ls -lh "$EXPORT_DIR"

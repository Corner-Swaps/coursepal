#!/usr/bin/env bash
set -e

PROJECT_DIR="/Users/slava/Downloads/Projects/ClassPal"
DATE_STR=$(date +%Y-%m-%d)
ARCHIVE_PATH="$HOME/Library/Developer/Xcode/Archives/$DATE_STR/CoursePal 1.4.2 (Build 5).xcarchive"
UPLOAD_DIR="$PROJECT_DIR/build/UploadAppStore"

mkdir -p "$UPLOAD_DIR"

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

echo "🚀 Uploading CoursePal 1.4.2 (Build 5) to App Store Connect..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$UPLOAD_DIR/UploadOptions.plist" \
  -exportPath "$UPLOAD_DIR" \
  -allowProvisioningUpdates

echo "✅ Finished upload attempt."

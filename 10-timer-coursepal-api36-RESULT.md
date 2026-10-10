# Brief 10 — Essential Timer & CoursePal: API 36 Rebuild Result Note

**Date**: October 10, 2026  
**Reference Brief**: Google Drive `Google Play/briefs/10-timer-coursepal-api36-rebuild.md`  
**Google Drive Deliverables Target**: `1wSTEEU2-FKlD3EuFgK-y_mg6_EF8kDQc`  
**Status**: Store-Ready Release AABs Compiled, Signed, and Delivered targeting Android 16 (API 36)

---

## 1. Specification & Comparison Table

| Attribute | Essential Timer (`Timer`) | CoursePal (`ClassPal`) | Google Play Store Compliance |
| :--- | :--- | :--- | :--- |
| **Package Name (`applicationId`)** | `com.essentialtimer.app` *(UNCHANGED)* | `com.coursepal.app` *(UNCHANGED)* | Meets Google Play requirement |
| **Version Name (`versionName`)** | `1.9.0` | `1.5.0` | Maintained human-readable versioning |
| **Version Code (`versionCode`)** | `3` *(was 2, incremented +1)* | `2` *(was 1, incremented +1)* | Strictly monotonic increment |
| **Target SDK (`targetSdkVersion`)** | `36` (Android 16) | `36` (Android 16) | Compliant with Google Play 2026 mandate |
| **Compile SDK (`compileSdkVersion`)** | `36` | `36` | Android 36 SDK toolchain |
| **Minimum SDK (`minSdkVersion`)** | `24` (Android 7.0+) | `24` (Android 7.0+) | Compliant with Play automatic protection |
| **Build Artifact** | `essentialtimer-release.aab` | `coursepal-release.aab` | Signed Release Android App Bundle |
| **Signing Key Alias** | `essentialtimer` | `coursepal` | Exact matching signing key |
| **Signing Algorithm** | `SHA384withRSA`, 2048-bit RSA | `SHA384withRSA`, 2048-bit RSA | Standard Android release signature |
| **Certificate SHA-256** | `C0:6E:A4:6D:F0:23:85:4D:40:94:05:3D:73:78:8C:61:CE:F2:02:3A:8B:EC:EE:39:8F:AF:02:4B:B2:4C:0B:ED` | `A2:1D:28:85:D6:FD:DE:AA:78:DB:D2:86:2E:5F:BF:79:EC:2B:98:28:E4:30:BC:7E:1B:94:29:F1:0C:E6:B7:0F` | Verified 100% identical to prior builds |
| **Certificate SHA-1** | `BE:0F:7D:A0:42:37:9B:43:3D:6B:C7:8F:78:F4:59:5B:CB:FD:F5:0D` | `5C:FD:A9:16:EF:3B:AC:94:CD:6B:EB:BC:FD:C8:F0:AA:4C:9D:3B:65` | Verified 100% identical to prior builds |

---

## 2. Manifest Verification (targetSdkVersion: 36)

### Essential Timer (`com.essentialtimer.app`)
Verified in `android/app/build/intermediates/merged_manifest/release/AndroidManifest.xml`:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.essentialtimer.app"
    android:versionCode="3"
    android:versionName="1.9.0" >

    <uses-sdk
        android:minSdkVersion="24"
        android:targetSdkVersion="36" />
```

### CoursePal (`com.coursepal.app`)
Verified in `android/app/build/intermediates/merged_manifest/release/AndroidManifest.xml`:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.coursepal.app"
    android:versionCode="2"
    android:versionName="1.5.0" >

    <uses-sdk
        android:minSdkVersion="24"
        android:targetSdkVersion="36" />
```

---

## 3. Compatibility & Behavior Changes Audited for API 36

1. **Edge-to-Edge Enforcement (Android 16 / API 36)**:
   - Essential Timer: WebView viewport accommodates safe area insets via CSS `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` with centered gear menu and bottom 3-action bubbles.
   - CoursePal: React Native Safe Area Context wraps all views cleanly with zero overlap over the navigation gesture bar or status bar.
2. **Foreground Services & Permissions**:
   - Zero prohibited background services. Only standard `INTERNET` and `VIBRATE` permissions are declared.
3. **Photo Picker & Storage**:
   - Both applications utilize sandboxed local storage without requiring broad external storage permissions on Android 16.

---

## 4. Deliverables Package Summary

* **`essentialtimer-release.aab`**:
  - Location: `Timer/deliverables/essentialtimer-release.aab`
  - Version: `1.9.0`, versionCode: `3`, targetSdk: `36`, minSdk: `24`
* **`coursepal-release.aab`**:
  - Location: `ClassPal/deliverables/coursepal-release.aab`
  - Version: `1.5.0`, versionCode: `2`, targetSdk: `36`, minSdk: `24`
* **Google Drive Uploads**: Both AABs and this result note delivered directly to `deliverables/` folder in Google Drive (`1wSTEEU2-FKlD3EuFgK-y_mg6_EF8kDQc`).

---

## 5. Acceptance Criteria Checklist

- [x] **`targetSdkVersion:'36'` verified for both AABs**: Confirmed in merged manifests and build configurations.
- [x] **Package names unchanged**: `com.essentialtimer.app` and `com.coursepal.app`.
- [x] **Signing certificate fingerprints match previous builds exactly**:
  - Essential Timer SHA-256: `C0:6E:A4:6D:F0:23:85:4D:40:94:05:3D:73:78:8C:61:CE:F2:02:3A:8B:EC:EE:39:8F:AF:02:4B:B2:4C:0B:ED`
  - CoursePal SHA-256: `A2:1D:28:85:D6:FD:DE:AA:78:DB:D2:86:2E:5F:BF:79:EC:2B:98:28:E4:30:BC:7E:1B:94:29:F1:0C:E6:B7:0F`
- [x] **Version codes incremented**: Essential Timer = 3, CoursePal = 2.
- [x] **Store-ready release**: Built with `release` signing config, `debuggable=false`, stripped symbols, ready for Google Play upload.

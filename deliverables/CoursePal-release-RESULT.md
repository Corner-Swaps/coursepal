# CoursePal (ClassPal) — Release Result Note (Android Google Play & iOS App Store)

**Project**: CoursePal / ClassPal (Course Syllabus, Assignment Deadline & Study Focus Organizer)  
**Date**: October 10, 2026  
**Repository**: `/Users/slava/Downloads/Projects/ClassPal`  
**Brief Reference**: `04-android-build-for-skipped-projects.md` & `00-master-release-prompt.md`  
**Application ID / Bundle ID**: `com.coursepal.app`  

---

## 1. Application Identifiers & Versions

| Attribute | Android (Google Play Release) | iOS (Apple App Store / TestFlight) |
| :--- | :--- | :--- |
| **Application ID / Bundle ID** | `com.coursepal.app` | `com.coursepal.app` |
| **Version Name / Marketing Version** | `1.5.0` | `1.5.0` |
| **Version Code / Build Number** | `1` | `12` |
| **Target SDK / Deployment Target** | `35` (Android 15 Google Play Standard) | `iOS 15.0+` |
| **compileSdkVersion / minSdkVersion** | compileSdk: `35`, minSdk: `24` | iOS 15.0+ |
| **Build Artifact** | `deliverables/coursepal-release.aab` (31 MB) | TestFlight Build |
| **Signing Certificate Key / Profile** | RSA 2048-bit (`coursepal` alias) | Cloud Managed Apple Distribution |
| **Certificate Fingerprint SHA-256** | `A2:1D:28:85:D6:FD:DE:AA:78:DB:D2:86:2E:5F:BF:79:EC:2B:98:28:E4:30:BC:7E:1B:94:29:F1:0C:E6:B7:0F` | Apple Distribution |
| **Certificate Fingerprint SHA-1** | `5C:FD:A9:16:EF:3B:AC:94:CD:6B:EB:BC:FD:C8:F0:AA:4C:9D:3B:65` | Apple Distribution |
| **Release Status** | **Signed Release AAB Delivered to Drive** | **TestFlight** |

---

## 2. Toolchain & Upload Keystore

- **Android Toolchain**: React Native 0.74, Expo SDK 51, Gradle 8.8, Adoptium OpenJDK 21 LTS, Android NDK 26.1.10909125.
- **Keystore File**: `android/app/release.keystore`
- **Key Alias**: `coursepal`
- **Signature Algorithm**: `SHA384withRSA`, 2048-bit RSA key
- **Validity**: Until February 25, 2054 (10,000 days)
- **Keystore Backups Saved In**:
  1. `~/.android/coursepal-release.keystore`
  2. `/Users/slava/Downloads/Projects/ClassPal/backups/coursepal-release.keystore`
  3. `~/Desktop/coursepal-release.keystore`

---

## 3. Core Flows Verified

1. **Course Syllabus Import & Outline Parsing (`SyllabusScreen`, `LocalSyllabusParser`, `SyllabusImportManager`)**:
   - Course document import and extraction of grading scales, weekly lecture topics, instructor information, and exam dates from bundled syllabi and local files.
2. **Assignments & Grade Weight Deadline Calendar (`AssignmentsScreen`, `AssignmentsMonthCalendarCard`, `GradeWeightTrackerCard`)**:
   - Timeline calendar with deadline tagging, completed status toggling, grade weight aggregate calculations, and interactive confetti animations (`ConfettiCelebration`).
3. **Study Focus Session Timer & Ambient Soundscape (`useTimer`, `AudioEngineService`, `SoundscapeWaveVisualizer`)**:
   - Study interval timer with real-time waveform visualizer, audio focus soundscapes via `expo-av`, and haptic feedback on completion.

---

## 4. Monetization & Paywall Verification

- **In-App Purchases**: None.
- **Paywall Status**: No StoreKit / Google Play Billing barriers. All syllabus management, assignment calendars, and study timer utilities are fully available offline.

---

## 5. Delivery Checklist

- [x] Production Release `.aab` compiled and verified with `jarsigner`.
- [x] Package name confirmed unchanged: `com.coursepal.app`.
- [x] Target SDK verified: `35`.
- [x] Debuggable flag disabled (`debuggable=false`), dev API endpoints absent.
- [x] Delivered to Google Drive `Google Play/deliverables` folder `1wSTEEU2-FKlD3EuFgK-y_mg6_EF8kDQc`.
- [x] Keystore backed up in 3 locations and password safeguarded.

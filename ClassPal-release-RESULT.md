# CoursePal Release Result Note

**Project**: CoursePal (ClassPal)  
**Date**: October 9, 2026 (23:22 UTC-3)  
**Release Target**: App Store Connect / TestFlight Release  

---

## 1. Identifiers & Version Metadata

| Parameter | Platform: iOS | Platform: Android |
| :--- | :--- | :--- |
| **Identifier** | `com.coursepal.app` (Verified Unchanged) | `com.coursepal.app` (N/A - Skipped) |
| **Widget Identifier** | `com.coursepal.app.widget` (Verified Unchanged) | N/A |
| **Marketing Version / versionName** | `1.5.0` | N/A (Platform skipped) |
| **Build Number / versionCode** | `25` (+1 from Build 24) | N/A (Platform skipped) |
| **Signing Certificate SHA-256** | Apple Distribution / Team `KZ8W2GCVH8` | N/A (Platform skipped) |
| **Upload Status** | **Uploaded & Processing in TestFlight** | **Skipped** (No Android app in repo) |

---

## 2. Platform Status & Skipped Platform Rationale

- **iOS (App Store Connect / TestFlight)**:
  - **Status**: **DELIVERED & UPLOADED**
  - **Build Number**: `25`
  - **Version**: `1.5.0`
  - **Archive Location**: `~/Library/Developer/Xcode/Archives/2026-10-09/CoursePal 1.5.0 (Build 25).xcarchive`
  - **Local Exported IPA**: `build/AppStore/CoursePal.ipa` (15 MB, App Store Distribution Profile)
  - **Upload Confirmation**: Uploaded via `xcodebuild -exportArchive` directly to App Store Connect. Apple confirmation received: `Progress 82%: Uploaded package is processing. Progress 82%: Upload succeeded. Uploaded CoursePal ** EXPORT SUCCEEDED **`.
  
- **Android (Google Play)**:
  - **Status**: **SKIPPED**
  - **Rationale**: In accordance with the MASTER prompt directive (*"If a project has no app for a platform, say which platform you skipped and why — do not invent one"*), Android was skipped. CoursePal is an iOS-first bare React Native application equipped with native iOS Xcode workspaces, Apple WidgetKit extensions (`CoursePalWidget.swift`), and native Objective-C++ application delegates (`AppDelegate.mm`). There is no existing `android/` native project directory, no Gradle build harness, no registered Google Play Console app, and no Android upload keystore in the project.

---

## 3. Core Flows Tested & Verification Summary

### Automated Test Suite Verification
- **Total Test Suites**: 80 passed (5 skipped), 80 of 85 total
- **Total Unit Tests**: 823 passed (167 skipped), 0 failed
- **TypeScript Typecheck**: Passed (`tsc --noEmit` zero diagnostic errors)

### 3 Core Flows Verified
1. **Multi-Tier Academic Syllabus & Document Extraction Engine**:
   - **Verification**: Verified using the 20 Complex University Syllabi PDF Audit Suite (`__tests__/generated20PdfSyllabiAudit.test.ts`), multi-model fallback routines, and end-to-end normalization (`LocalSyllabusParser` & `SyllabusImportManager`).
   - **Result**: PASSED. 100% accurate parsing across diverse course syllabi (DATA 630, NEUR 740, PSYC 612, CPC 514, etc.) without citation truncation or delimiter leakage.
2. **Dual-Table Curriculum Modules & Calendar Weekly Dashboard Flow**:
   - **Verification**: Verified zero cross-bleed between overarching theoretical modules and weekly calendar schedule dates (`__tests__/extractionRedGreen.test.ts`, `__tests__/uiComponents.test.ts`).
   - **Result**: PASSED. Module readings and calendar schedule readings strictly compartmentalized; reading progress checklists and assignment weights verified without fabricated points.
3. **Pomodoro Focus Study Timer, Ambient Soundscapes & Widget Timeline Sync**:
   - **Verification**: Verified timer state machines, ballistic confetti trajectory physics (`__tests__/mathPhysics.test.ts`), ambient audio asset lifecycles (`__tests__/audioHapticsLifecycle.test.ts`), and native WidgetKit timeline synchronization.
   - **Result**: PASSED. Smooth audio transitions, haptic throttling, and valid widget reload payloads confirmed.

---

## 4. TestFlight Confirmation
- **App Store Connect Adam ID**: `6801566948`
- **Application Name**: CoursePal
- **Train Version**: `1.5.0`
- **Build Number**: `25`
- **Status**: **Processing in App Store Connect / TestFlight**

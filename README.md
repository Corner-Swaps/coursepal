# CoursePal - Academic Planner & Syllabus Intelligence 📚

[![CI / Unit Tests](https://img.shields.io/badge/tests-152%20passed-brightgreen.svg)]()
[![Backend Tests](https://img.shields.io/badge/backend%20tests-20%20passed-brightgreen.svg)]()
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Cross--Platform-blue.svg)]()
[![Version](https://img.shields.io/badge/version-1.4.0-indigo.svg)]()
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)]()

**CoursePal** is an intelligent academic planner designed for students, educators, and researchers to transform unstructured course syllabi (PDFs, images, and text) into an organized, stress-free semester schedule with sub-pixel visual fidelity, native audio focus soundscapes, and Gemini AI-powered syllabus extraction.

---

## 🏛️ Repository Architecture

This repository is organized as a cohesive full-stack workspace containing the cross-platform mobile application, the companion academic intelligence backend, native iOS bindings, and comprehensive automated test suites:

```text
📂 CoursePal Repository
├── 📱 src/                      # Mobile Application Core (React Native & TypeScript)
│   ├── App.tsx                  # Root application component & screen navigation ZStack
│   ├── index.ts                 # Master module export barrel
│   ├── screens/                 # 4 Primary Screens: Readings, Assignments, Syllabus, Invite
│   ├── components/              # 16 Atomic Vector UI & Gestural Components
│   ├── context/                 # Centralized State Container (CoursePalContext)
│   ├── services/                # Device & Intelligence Services (Audio, Haptics, Storage, AI)
│   ├── hooks/                   # Custom React Hooks (useAudio, useHaptics, useTimer)
│   ├── constants/               # Apple HIG Theme, Hex Palettes & Physics Constants
│   ├── types/                   # TypeScript Domain Models & Interfaces
│   └── utils/                   # Mathematics, Sound Catalog & Time Calculus
│
├── 🖥️ backend/                  # Academic Intelligence Service (Node.js, Express & Zod)
│   ├── src/services/            # Multi-Model Gemini Parser & 64-D Neural Vector Engine
│   ├── src/db/                  # PostgreSQL Pool with Resilient In-Memory Fallback
│   ├── src/tests/               # 20-Test Academic Engine Integration Suite
│   └── src/server.ts            # Express REST API & Encrypted Course Sharing Endpoints
│
├── 🍏 ios/                      # Native iOS Project (Xcode Workspace & CocoaPods)
│   ├── CoursePal.xcworkspace    # Main Xcode Workspace
│   ├── CoursePal/               # Native iOS Target, Info.plist & LaunchScreen
│   └── Podfile                  # CocoaPods Dependencies (Audio, Haptics, SVG, Hermes)
│
├── 🧪 __tests__/                # 152 Automated Client & Physics Unit Tests
│   ├── audioHapticsLifecycle.test.ts  # Background audio, haptic throttling & timer sync
│   ├── syllabusParser.test.ts         # 26-Test local syllabus parsing protocol
│   ├── vectorCanvasGestures.test.ts   # Dynamic Island safe areas & sub-pixel SVG math
│   ├── uiComponents.test.ts           # Atomic component instantiation & prop verification
│   └── mathPhysics.test.ts            # Ballistic trajectory & 64-D random projection
│
├── 📜 scripts/                  # Developer Automation & Diagnostic Tools
│   ├── test-gemini.ts           # Live Google Gemini 3.6 Flash connectivity test
│   ├── create-test-syllabi.py   # Synthetic test syllabi generator
│   └── populate-dummy-data.js   # Local test database seeder
│
├── 📖 docs/                     # Documentation & GitHub Pages Legal Center
│   ├── index.html               # Live Web Landing & Support Portal
│   ├── privacy.html             # App Store Compliant Privacy Policy
│   └── terms.html               # Terms of Service
│
├── App.tsx                      # Root Metro/Expo entry bridge -> src/App.tsx
├── index.js                     # Native AppRegistry entrypoint
└── package.json                 # Mobile dependencies, scripts, and build tasks
```

---

## ⚡ Core Features

### 1. Intelligent Syllabus & Document Extraction
- **PDF & Photo Parsing**: Upload or photograph syllabus documents to automatically extract assignments, readings, due dates, and grading weights in seconds.
- **AI Intelligence**: Powered by Google Gemini (`gemini-3.6-flash`) with automatic multi-model fallback (`gemini-3.5-flash` → `gemini-3.1-flash-lite`) and local-first neural indexing.

### 2. Weekly Dashboard & Milestone Tracking
- **Automatic Term Calculation**: Intelligently resolves academic term dates, week numbers, and deadlines.
- **Reading Lists**: Interactive checklists for chapters, papers, videos, and multimedia resources.

### 3. Study Timer & Focus Soundscapes
- **Pomodoro Physics**: Sub-pixel animated progress rings, spring-interpolated sliders, and ballistic confetti celebration physics.
- **Ambient Soundscapes**: Built-in background audio engine featuring white noise, rainfall, library acoustics, and completion chimes with haptic feedback.

### 4. Privacy-First Local Architecture
- All student notes, course records, and schedules remain encrypted in your local device sandbox. No monetization or third-party ad tracking.

---

## 🛠️ Engineering & Development

### Prerequisites
- Node.js >= 18.0.0
- Xcode 15+ (for iOS builds)
- CocoaPods (`pod --version`)

### Mobile App Setup & Testing
```bash
# Install dependencies
npm install

# Run complete QA test suite (152 unit tests across 11 test suites)
npm test

# Typecheck mobile TypeScript
npm run typecheck

# Test live Google Gemini API connectivity & syllabus extraction
npm run test:gemini

# Launch iOS simulator or device build
npm run ios
```

### Backend Service Setup & Testing
```bash
cd backend

# Install backend dependencies
npm install

# Run 20-test academic engine integration suite
npm test

# Run 64-D neural document vector tests
npm run test:neural

# Typecheck backend TypeScript
npm run typecheck

# Start local backend API server (port 3088)
npm run dev
```

---

## 📬 App Store Support & Developer Contact

- **Customer Support Email**: [goloubov@gmail.com](mailto:goloubov@gmail.com)
- **Live Support & Legal Center**: [https://corner-swaps.github.io/coursepal/](https://corner-swaps.github.io/coursepal/)
- **Privacy Policy**: [https://corner-swaps.github.io/coursepal/privacy.html](https://corner-swaps.github.io/coursepal/privacy.html)
- **Terms of Service**: [https://corner-swaps.github.io/coursepal/terms.html](https://corner-swaps.github.io/coursepal/terms.html)
- **Current App Store Version**: **1.4.0**

---

&copy; 2026 Viatcheslav Goloubov. All rights reserved.

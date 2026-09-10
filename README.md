# CoursePal - Academic Planner & Syllabus Parser 📚

[![CI / Unit Tests](https://img.shields.io/badge/tests-149%20passed-brightgreen.svg)]()
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Cross--Platform-blue.svg)]()
[![Version](https://img.shields.io/badge/version-1.4.0-indigo.svg)]()
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)]()

**CoursePal** is an intelligent academic planner designed for students, educators, and researchers to turn unstructured course syllabi into an organized, stress-free semester schedule with sub-pixel visual fidelity, native audio focus soundscapes, and Gemini AI-powered syllabus extraction.

---

## 📬 App Store Support & Developer Contact

- **Customer Support Email**: [goloubov@gmail.com](mailto:goloubov@gmail.com)
- **Live Support & Legal Center**: [https://corner-swaps.github.io/coursepal/](https://corner-swaps.github.io/coursepal/)
- **Privacy Policy**: [https://corner-swaps.github.io/coursepal/privacy.html](https://corner-swaps.github.io/coursepal/privacy.html)
- **Terms of Service**: [https://corner-swaps.github.io/coursepal/terms.html](https://corner-swaps.github.io/coursepal/terms.html)
- **Current App Store Version**: **1.4.0**

---

## ⚡ Core Features

### 1. Intelligent Syllabus & Document Extraction
- **PDF & Photo Parsing**: Upload or scan syllabus documents to extract assignments, readings, due dates, and grading weights in seconds.
- **AI Intelligence**: Powered by Google Gemini (`gemini-3.6-flash`) with automatic multi-model fallback and local-first neural indexing.

### 2. Weekly Dashboard & Milestone Tracking
- **Automatic Term Calculation**: Intelligently resolves academic term dates, week numbers, and deadlines.
- **Reading Lists**: Interactive checklists for chapters, papers, videos, and multimedia resources.

### 3. Study Timer & Focus Soundscapes
- **Pomodoro Physics**: Sub-pixel animated progress rings, spring-interpolated sliders, and ballistic confetti physics.
- **Ambient Soundscapes**: Built-in background audio engine featuring white noise, rainfall, library acoustics, and completion chimes with haptic feedback.

### 4. Privacy-First Local Architecture
- All student notes, course records, and schedules remain encrypted in your local device sandbox. No monetization or third-party ad tracking.

---

## 🛠️ Engineering & Development

CoursePal is built with a modern cross-platform **React Native & TypeScript** bare workflow with native iOS performance parity.

### Prerequisites
- Node.js >= 18.0.0
- Xcode 15+ (for iOS builds)
- CocoaPods

### Setup & Testing
```bash
# Install dependencies
npm install

# Run complete QA test suite (149 tests across 11 test suites)
npm test

# Test live Google Gemini API connectivity & syllabus extraction
npm run test:gemini

# Launch iOS development environment
npm run ios
```

---

## ❓ Frequently Asked Questions (FAQ)

### 1. How do I import a syllabus?
Open CoursePal, tap the **+** button, select your PDF or photograph a physical handout, and CoursePal will construct your course schedule automatically.

### 2. Is my student data private?
Yes. CoursePal operates under a strict Local-First model. Your syllabi, personal notes, and grades remain stored on your personal device.

### 3. What file formats are supported?
CoursePal supports digital PDF documents, camera document captures, and plain text syllabus files.

---

&copy; 2026 Viatcheslav Goloubov. All rights reserved.

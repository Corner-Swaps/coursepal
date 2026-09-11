# CoursePal Mobile Application Architecture 📱

This directory contains the complete source code for the **CoursePal** cross-platform mobile application, written in TypeScript and React Native with 1:1 Apple Human Interface Guidelines (HIG) fidelity.

---

## 🏛️ Directory Structure

```text
src/
├── App.tsx                  # Core React Native application root & screen navigation ZStack
├── index.ts                 # Master module exports barrel
│
├── components/              # Atomic vector UI & gesture-driven interaction components
│   ├── modals/              # Bottom sheet modals (Add Course, Add Task, Filter, Choices)
│   ├── AppIconLogo.tsx      # Authentic Apple squircle application icon with border overlay
│   ├── BottomSheetPanContainer.tsx # PanResponder drag-to-dismiss gesture container
│   ├── ConfettiCelebration.tsx     # 85-particle ballistic physics celebration canvas
│   ├── ContinuousProgressBar.tsx   # Continuous progress capsule bar with corner clamping
│   ├── ContinuousProgressRing.tsx  # Sub-pixel SVG circular progress indicator
│   ├── DeadlinesCalendarCard.tsx   # Upcoming deadline schedule visualizer
│   ├── FuzzedScrollMask.tsx        # Top & bottom fuzzed gradient canvas fades
│   ├── HighlighterText.tsx         # Academic highlighter background text badge
│   ├── MainTabBar.tsx              # Floating pill navigation bar with elevated action button
│   ├── PrecisionSlider.tsx         # Quantized snap-step haptic duration slider
│   ├── ScreenContainer.tsx         # Dynamic Island / Notch safe-area layout wrapper
│   ├── SlideUpModal.tsx            # Spring-physics Apple slide-up presentation sheet
│   ├── SoundscapeWaveVisualizer.tsx # Sine wave audio visualizer with sub-pixel SVG path
│   └── SvgIcons.tsx                # Native SVG vector icon set
│
├── screens/                 # 4 Primary Application Screens
│   ├── ReadingsScreen.tsx   # Weekly required reading checklist with category tabs
│   ├── AssignmentsScreen.tsx # Assignment timeline, rubrics, points vs weight, and notes
│   ├── SyllabusScreen.tsx   # Course overview, term timeline, and syllabus file manager
│   └── InviteScreen.tsx     # Peer-to-peer 12-char course sharing and QR join codes
│
├── context/                 # Application State & Data Management
│   └── CoursePalContext.tsx # Centralized state container (active tab, courses, confetti, timer)
│
├── services/                # Device & Intelligence Services
│   ├── APIService.ts        # Gemini AI syllabus extraction & remote API client
│   ├── AudioEngineService.ts # Background audio playback, loopable ambient tracks & speech
│   ├── CourseSharingService.ts # URL-safe Base64 serialization & course data codecs
│   ├── DataPersistenceBackupManager.ts # Encrypted JSON state snapshots & migration
│   ├── FacultyExtractor.ts  # Academic faculty name, email, and contact parsing
│   ├── HapticsService.ts    # Throttled 60Hz CoreHaptics impact and notification engine
│   ├── LocalSyllabusParser.ts # Offline regex & heuristic document extraction engine
│   ├── NeuralDocumentService.ts # On-device 64-D random projection semantic text search
│   └── StorageService.ts    # Secure AsyncStorage persistence layer
│
├── hooks/                   # Custom React Hooks
│   ├── useAudio.ts          # Audio playback lifecycle & volume fading
│   ├── useHaptics.ts        # Throttled tactile feedback triggers
│   └── useTimer.ts          # Pomodoro study timer with wall-clock background synchronization
│
├── constants/               # Physics & Styling Systems
│   ├── physics.ts           # Confetti ballistic gravity, velocity, and wobble constants
│   └── theme.ts             # CoursePal typography, hex palettes, and shadow styles
│
├── types/                   # Domain Interfaces & Types
│   ├── audio.ts             # Soundscape track definitions & playback state
│   ├── course.ts            # Course, Syllabus, Week, Reading, and Assignment models
│   └── index.ts             # Master domain type barrel
│
└── utils/                   # Mathematics & Helper Functions
    ├── mathPhysics.ts       # Parabolic gravity, cosine similarity & 64-D projection math
    ├── soundCatalog.ts      # Catalog of 5 curated ambient soundscape tracks
    └── timeFormatters.ts    # Academic term start dates, due date calculus, and timers
```

---

## 🔑 Architectural Principles

1. **Local-First Privacy**: All courses, assignments, student notes, and reading checklists persist in the local device sandbox (`AsyncStorage`). No login walls or tracking.
2. **Zero-Latency Navigation**: The 4 primary screens reside in an alive `ZStack` layout in [`src/App.tsx`](App.tsx). Switching tabs produces zero layout reflow or network latency.
3. **Apple Human Interface Guidelines (HIG)**: Slide-up modal sheets, spring damping physics, and quantized haptic sliders mimic first-party iOS system behavior.
4. **On-Device Semantic Search**: [`NeuralDocumentService`](services/NeuralEngineService.ts) runs a 64-dimensional random projection matrix to compute semantic cosine similarities for syllabus and chapter search without external dependencies.

---

&copy; 2026 CoursePal. All rights reserved.

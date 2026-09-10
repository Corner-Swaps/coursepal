# Contributing to CoursePal

Thank you for your interest in contributing to CoursePal! We are building the most capable, privacy-first academic schedule organizer.

---

## 🛠️ Development Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Corner-Swaps/coursepal.git
   cd coursepal
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Verify Local Environment**:
   ```bash
   # Run full test suite (149 tests across 11 suites)
   npm test

   # Run TypeScript typecheck
   npm run typecheck

   # Run live Gemini syllabus extraction test
   npm run test:gemini
   ```

---

## 🌿 Branching Strategy

- **`main`**: The primary active branch for all cross-platform development.
- **`legacy-swift`**: Historical archive of the original pure SwiftUI codebase. This branch is locked and preserved permanently.
- **Feature Branches**: Branch from `main` with descriptive prefixes:
  - `feat/rubric-point-tracker`
  - `fix/date-range-normalization`
  - `perf/vector-canvas-rendering`

---

## 📝 Commit Standards

All commits should adhere to [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` for new capabilities
- `fix:` for bug fixes
- `perf:` for performance or rendering optimizations
- `test:` for test additions or updates
- `docs:` for documentation updates
- `chore:` for build, dependency, or configuration updates

---

## 🚦 Pre-Push Quality Gate

Always ensure the following passes before committing or opening a PR:

```bash
npm test && npm run typecheck
```

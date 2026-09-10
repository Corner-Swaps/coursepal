# CoursePal Backend Service 🧠

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.19-black.svg?logo=express)](https://expressjs.com/)
[![Zod](https://img.shields.io/badge/Validation-Zod%20Strict-indigo.svg)](https://zod.dev/)
[![Tests](https://img.shields.io/badge/Tests-20%20Passing-brightgreen.svg)](#testing--verification)

The **CoursePal Backend** is a high-performance, modular TypeScript service providing intelligent syllabus extraction, on-device neural vector indexing, encrypted course sharing, and AI course chat endpoints.

---

## 🏗️ Architecture Overview

```text
backend/
├── src/
│   ├── db/
│   │   ├── index.ts              # PostgreSQL pool with resilient in-memory fallback
│   │   └── schema.sql            # Relational database schema for courses & users
│   ├── services/
│   │   ├── syllabusParser.ts     # Multi-model Gemini AI parser with Zod schema validation
│   │   └── neuralDocumentEngine.ts # 64-D random projection semantic text search engine
│   ├── tests/
│   │   ├── api.test.ts           # 20-test academic engine integration suite
│   │   └── neural.test.ts        # Neural vector learning & semantic query tests
│   └── server.ts                 # Express REST API routes & middleware
├── public/                       # Static web landing & invitation assets
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # Node/CommonJS TypeScript config
└── README.md                     # Service documentation
```

### Key Technical Capabilities

1. **Multi-Model Gemini Fallback Pipeline**:
   - Primary: `gemini-3.6-flash`
   - Fallbacks: `gemini-3.5-flash` → `gemini-3.1-flash-lite`
   - Automatically sanitizes markdown code blocks, normalizes academic week dates, and enforces strict reading title lengths (5–6 words).

2. **64-Dimensional Neural Vector Indexer**:
   - Uses a deterministic projection matrix seeded for zero external vector database dependencies.
   - Computes L2-normalized cosine similarity embeddings for instant full-text syllabus and chapter search.

3. **Resilient Data Layer**:
   - Connects to PostgreSQL in production environments.
   - Automatically falls back to high-speed in-memory maps (`MemoryDB`) during local testing or CI pipelines when PostgreSQL is unavailable.

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation
```bash
cd backend
npm install
```

### Running Locally
```bash
# Start dev server with auto-reload (port 3088)
npm run dev

# Compile TypeScript to dist/
npm run build

# Start production build
npm start
```

---

## 🧪 Testing & Verification

```bash
# Run the 20-test end-to-end academic test suite
npm test

# Run neural document learning & vector search tests
npm run test:neural

# Run TypeScript static type check
npm run typecheck
```

---

## 📡 API Reference

### System Health
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | System status, service identity, and version check. |

### Syllabus & AI Parsing
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/syllabus/parse` | Accepts raw text or multipart PDF/image; returns structured `ParsedSyllabus` JSON. |
| `POST` | `/api/courses/chat` | Context-aware AI tutoring on extracted course documents. |

### Neural Document Search
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/neural/train` | Indexes document chunks and computes 64-D embedding vectors. |
| `POST` | `/api/neural/query` | Top-K semantic similarity search across indexed documents. |
| `GET` | `/api/neural/stats` | Index chunk count, document count, and memory metrics. |

### Course Sharing & Sync
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/courses/share` | Generates a 12-character alphanumeric peer-sharing code. |
| `GET` | `/api/courses/shared/:code` | Resolves course payload from share code. |

---

## 🔒 Environment Variables

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `3088` | HTTP server port. |
| `HOST` | `0.0.0.0` | HTTP bind host. |
| `DATABASE_URL` | `postgresql://.../coursepal` | PostgreSQL connection string. |
| `GEMINI_API_KEY` | *(Bundled)* | Google Generative Language API key for AI syllabus extraction. |
| `NODE_ENV` | `development` | Runtime environment (`development`, `production`, `test`). |

---

&copy; 2026 CoursePal. All rights reserved.

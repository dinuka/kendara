# Architecture Specification — 2026-07-15

## 1. System Context

Kendara is a web application for astrology students to manage, search, and analyze horoscope databases. The system supports Sinhala and English, uses offline astrology calculations, and provides a RAG-powered natural language search.

## 2. Architectural Drivers

| Driver | Description |
|--------|-------------|
| Offline Calculations | All ephemeris and astrological computations must run locally (no external APIs) |
| Bilingual Search | Natural language search in Sinhala and English via RAG pipeline |
| Data Privacy | Horoscopes can be private/public; user data isolated |
| Study-Focused | Students need flexible metadata, labels, and configurable views |
| Zero-Cost Libraries | Must use free/open-source libraries |

## 3. Component Architecture

### 3.1 Frontend (Next.js + React)

**Pages:**
- `/signin` — Google SSO login
- `/dashboard` — User's horoscope list
- `/horoscopes/new` — Add horoscope form
- `/horoscopes/[id]` — Horoscope detail with charts and calculations
- `/horoscopes/[id]/edit` — Edit horoscope
- `/search` — Search page with results and configuration panel
- `/admin` — Super Admin dashboard
- `/share/[token]` — Shared horoscope view

**Components:**
- Layout: Header (language switcher, user menu), Sidebar (navigation)
- HoroscopeForm: Birth details input with location autocomplete
- ChartView: Renders astrological charts (SVG via D3.js)
- CalculationsPanel: Tabbed display of all calculated values
- SearchBar: Natural language input with suggestions
- ResultsList: Search results with relevance indicators
- ConfigPanel: Toggle visibility of chart/calculation sections
- MetadataEditor: Key-value tag management
- LanguageSwitcher: Sinhala/English toggle

### 3.2 Backend (Next.js API Routes — REST)

**Framework:** Next.js API Routes serve as the backend. Handles validation, MongoDB CRUD (via Mongoose), calculation orchestration (jyotish-calculations), RAG pipeline coordination (Gemini API + Qdrant), chart generation (D3.js SVG), and PDF/image export.

**API Modules:**
- `auth/` — NextAuth.js configuration with Google provider
- `horoscope/` — CRUD operations + calculation trigger
- `calculation/` — Swiss Ephemeris WASM integration
- `charts/` — D3.js server-side SVG generation
- `search/` — RAG pipeline + vector search
- `metadata/` — Label/tag CRUD
- `share/` — Share link generation and access
- `admin/` — Admin operations
- `export/` — PDF/image generation

### 3.3 Astrology Calculation Engine

The calculation engine is the core business logic. It takes birth data and produces:

1. **Base Calculations:**
   - Planetary positions (longitude, latitude, speed)
   - House cusps (Placidus/Equal house system)
   - Ascendant calculation

2. **Derived Calculations:**
   - Nakshatra and Pada determination
   - Dasha periods (Vimshottari)
   - Planetary strengths (dig bala, uchcha/neecha, etc.)
   - Aspect calculations with orbs
   - Drekkana and Navamsa lords
   - Badhaka, Maraka, Atmakaraka identification
   - Yoga and Dosha detection

**Library:** **jyotish-calculations** (npm) — comprehensive Vedic astrology library built on Swiss Ephemeris (swisseph). Provides Graha positions, Nakshatra determination, Rashi calculations, Bhava analysis, Dasha periods, and all advanced Vedic calculations. Runs natively in Node.js — no Python backend needed.

### 3.4 RAG Search Pipeline

**Tech:** Gemini API (free online LLM for query parsing) + Transformers.js (local embeddings) + @qdrant/js-client-rest (vector search) — all JS/TS.

**Embedding Generation (Async Background Job):**
- After horoscope is created and stored, a background job is queued
- Job converts calculated data into structured text description
- Generates embedding via **Transformers.js** (`@xenova/transformers`) running in Node.js
- Stores in Qdrant via `@qdrant/js-client-rest` with HNSW index
- This runs offline — no impact on horoscope creation response time

```
User Query (SI/EN)
    │
    ▼
┌─────────────────────┐
│ Gemini API          │
│ (Free online LLM)   │
│ Parses query into:  │
│ - Lagna/Sign        │
│ - Planet conditions │
│ - House positions   │
│ - Yoga references   │
│ - Aspect conditions │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌──────────────────┐ ┌──────────┐
│ Transformers.js  │ │Structured│
│ (@xenova/)       │ │ Filters  │
│ text embedding   │ │          │
└───────┬──────────┘ └─────┬────┘
        │                  │
        ▼                  ▼
┌──────────┐        ┌──────────┐
│ Qdrant   │        │ MongoDB  │
│Similarity│        │ $match   │
│Search    │        │ clause   │
└─────┬────┘        └─────┬────┘
      │                   │
      └───────┬───────────┘
              ▼
┌─────────────────────┐
│ Merge & Rank        │
│ Results             │
└─────────────────────┘
```

**Embedding Generation:**
- Convert each horoscope's calculated data into a structured text description
- Generate embedding via **Transformers.js** (`@xenova/transformers`) running in Node.js — no Python needed
- Store in Qdrant via `@qdrant/js-client-rest` with HNSW index

**Query Processing:**
- User enters natural language query in Sinhala or English
- Free online LLM via **Gemini API** (`@google/generative-ai`) parses query into structured conditions
- Generate query embedding via Transformers.js
- Vector similarity search (Qdrant) + MongoDB structured filter
- Merge results ranked by relevance
- Generate embedding from parsed query
- Vector similarity search (Qdrant) + MongoDB structured filter
- Merge results ranked by relevance

## 4. Data Flow Diagrams

### 4.1 Add Horoscope Sequence

```
┌─────┐     ┌──────────┐    ┌──────────┐    ┌────────┐    ┌────────┐    ┌──────────┐
│User │     │Frontend  │    │API Routes│    │Calc    │    │MongoDB │    │ Qdrant   │
│     │     │          │    │          │    │Engine  │    │        │    │          │
└──┬──┘     └───┬──────┘    └────┬─────┘    └───┬────┘    └────┬───┘    └────┬─────┘
   │            │                │               │             │               │
   │ Fill form  │                │               │             │               │
   │───────────>│                │               │             │               │
   │            │ POST /horoscope               │             │               │
   │            │────────────────>│              │             │               │
   │            │                │               │             │               │
   │            │                │ Geocode (auto-populate Lat/Lon) │             │               │
│            │                │ (user can override lat/lng)     │             │               │
   │            │                │──────────────>│             │               │
   │            │                │<──────────────│             │               │
   │            │                │               │             │               │
   │            │                │ Calculate     │             │               │
   │            │                │──────────────>│             │               │
   │            │                │<──────────────│             │               │
   │            │                │               │             │               │
   │            │                │ Save Horoscope              │               │
   │            │                │────────────────────────────>│               │
   │            │                │               │             │               │
   │            │                │ Queue embedding (async)     │               │
   │            │                │──────────────────────────────────────────>│
   │            │                │               │             │               │
   │            │ Return Result │               │             │               │
   │            │<────────────────│              │             │               │
   │ Show View  │                │               │             │               │
   │<───────────│                │               │             │               │
   │            │                │  [Background Job]            │               │
   │            │                │  Generate Embedding         │               │
   │            │                │────────────────────────────────────────────>│
```

### 4.2 Search Sequence

```
┌─────┐     ┌──────────┐    ┌──────────┐    ┌────────┐    ┌────────┐    ┌──────────┐
│User │     │Frontend  │    │API Routes│    │Local   │    │MongoDB │    │ Qdrant   │
│     │     │          │    │          │    │LLM     │    │        │    │          │
└──┬──┘     └───┬──────┘    └────┬─────┘    └───┬────┘    └────┬───┘    └────┬─────┘
   │            │                │               │             │               │
   │ Enter query│                │               │             │               │
   │───────────>│                │               │             │               │
   │            │ POST /search   │               │             │               │
   │            │────────────────>│              │             │               │
   │            │                │ Parse Query   │             │               │
   │            │                │──────────────>│             │               │
   │            │                │<──────────────│             │               │
   │            │                │               │             │               │
   │            │                │ Embed Query   │             │               │
   │            │                │───> (local embedding model)                │
   │            │                │               │             │               │
   │            │                │ Vector Search              │               │
   │            │                │────────────────────────────────────────────>│
   │            │                │<────────────────────────────────────────────│
   │            │                │               │             │               │
   │            │                │ Filter Results             │               │
   │            │                │────────────────────────────>│               │
   │            │                │<────────────────────────────│               │
   │            │                │               │             │               │
   │            │ Return Results│               │             │               │
   │            │<────────────────│              │             │               │
   │ Show       │                │               │             │               │
   │<───────────│                │               │             │               │
```

## 5. Component Interaction Design

### 5.1 Chart Generation Pipeline

```
CalculatedDetails (JSON)
        │
        ▼
┌───────────────────┐
│ Chart Generator   │
│ (D3.js on server) │
│                   │
│ For each chart:   │
│ - Birth Chart     │
│ - House Chart     │
│ - Navamsa D9      │
│ - Drekkana D3     │
│ - Dasamsa D10     │
│ - Chandra Lagna   │
│ - Surya Lagna     │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ SVG Generation    │
│ (D3.js rendering  │
│  to SVG string)   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Save to MinIO/S3  │
│ + DB record       │
└───────────────────┘
```

### 5.2 Export Pipeline

```
Horoscope Data
    │
    ▼
┌───────────────────┐
│ PDF Generator     │
│ (jsPDF +          │
│  html2canvas)     │
│                   │
│ - All visible     │
│   sections        │
│ - Selected charts │
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
┌────────┐ ┌────────┐
│ PDF    │ │ Image  │
│ Export │ │ Export │
└────────┘ └────────┘
```

## 6. Frontend Routing

| Route | Component | Auth | Description |
|-------|-----------|------|-------------|
| / | Dashboard | Required | Horoscope list |
| /signin | SignInPage | Public | Google SSO login |
| /horoscopes/new | NewHoroscopePage | Required | Add horoscope form |
| /horoscopes/[id] | HoroscopeDetailPage | Required | Full horoscope view |
| /horoscopes/[id]/edit | EditHoroscopePage | Required | Edit horoscope |
| /search | SearchPage | Required | Natural language search |
| /search/filters | SavedFiltersPage | Required | Manage saved filters |
| /admin | AdminDashboard | Admin | Super admin panel |
| /admin/users | AdminUsersPage | Admin | User management |
| /share/[token] | SharedHoroscopePage | Public | Shared view |
| /settings | SettingsPage | Required | Preferences |

## 7. Error Handling Strategy

| Error Type | HTTP Code | Response | User Action |
|------------|-----------|----------|-------------|
| Validation | 400 | { error, fields } | Fix form inputs |
| Unauthorized | 401 | { error } | Sign in |
| Forbidden | 403 | { error } | Contact admin |
| Not Found | 404 | { error } | Navigate away |
| Calculation | 422 | { error, detail } | Check birth data |
| Rate Limit | 429 | { error, retryAfter } | Wait and retry |
| Server | 500 | { error } | Retry later |

## 8. Configuration & Environment

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generated-secret>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
DATABASE_URL=mongodb://user:pass@localhost:27017/kendara
GEMINI_API_KEY=<your-gemini-api-key>
QDRANT_URL=http://localhost:6333
MINIO_ACCESS_KEY=<minio-access-key>
MINIO_SECRET_KEY=<minio-secret-key>
OLLAMA_URL=http://localhost:11434
```

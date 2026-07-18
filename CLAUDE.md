# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kendara is a bilingual (Sinhala/English) Vedic astrology study platform built with Next.js (App Router). Users create horoscopes from birth details, the server calculates planetary/chart data offline via Swiss Ephemeris, and results are stored in MongoDB. Google SSO is the only auth method.

Full specs live under `specs/` (architecture, business-analysis, ux, qa, pm, development) — check `specs/architecture/overview.md` and `specs/business-analysis/data-model.md` before making structural or data-model changes, since these are the source of truth for intended design.

**Implementation status note:** the architecture spec describes a full RAG search pipeline (Transformers.js embeddings + Qdrant vector search + Gemini query parsing). This is NOT yet implemented — `src/app/api/search/route.ts` currently does simple in-memory keyword scoring against `ZODIAC_SIGN_NAMES`/`PLANET_NAMES` maps over MongoDB results. Don't assume Qdrant/Gemini wiring exists; check the actual route before building on it.

## Commands

```bash
pnpm dev        # start dev server (Next.js)
pnpm build      # production build
pnpm start      # run production build
pnpm lint       # eslint
pnpm format     # prettier --write over src/**/*.{ts,tsx,css,json}
npx jest                                  # run all tests
npx jest src/__tests__/calculation.test.ts  # run a single test file
npx jest -t "test name"                   # run tests matching a name
```

Package manager is **pnpm** (see `pnpm-lock.yaml` / `pnpm-workspace.yaml`), though a `package-lock.json` also exists — prefer pnpm.

Tests live in `src/__tests__/*.test.ts` (Jest + ts-jest, node environment). `@/*` resolves to `src/*` in both Jest and TS (see `jest.config.js` moduleNameMapper and `tsconfig.json` paths).

## Architecture

### Request flow
`src/proxy.ts` (Next.js middleware equivalent) reads the `NEXT_LOCALE` cookie and injects `X-NEXT-INTL-LOCALE` on every non-API, non-asset route; defaults to `si` (Sinhala). It does not touch `/api/*`.

### Data layer
- MongoDB via Mongoose. `src/lib/db.ts` exports `connectDB()`, which caches the connection on `global.mongoose` (standard Next.js dev-reload-safe pattern) — always call this at the top of API routes before querying.
- Models in `src/models/*.ts`: `User`, `Horoscope`, `CalculatedDetails`, `Chart`, `Metadata`, `ShareLink`, `SavedFilter`. Each mirrors the entity tables in `specs/business-analysis/data-model.md` — check that spec for field meanings, enum value mappings, and the nested JSON shapes (houses, planets, dashas, yogas, doshas) before modifying a schema.
- Relational-style references between documents use the `{ id: UUID }` embedded-object convention (e.g. `horoscope.owner.id`, `chart.horoscope.id`), not Mongo ObjectId refs — follow this convention for new relations.

### Astrology calculation
- `src/lib/calculation.ts` and `src/lib/astrology.ts` contain calculation logic and shared TS interfaces (`Planet`, `House`, `Ascendant`, `Nakshatra`, `DashaInfo`, etc.), built on top of `jyotish-calculations` (Swiss Ephemeris wrapper) and `swisseph-v2`. Both are registered in `next.config.ts` under `serverExternalPackages` since they're native/CJS and must not be bundled.
- `src/lib/astrologyEnums.ts` defines numeric enums (`Planet`, `ZodiacSign`, `PlanetaryStrength`) plus lookup maps keyed by *both* English and Sinhala planet/sign names (e.g. `PLANET_NAMES`, `ZODIAC_SIGN_NAMES`) — used for parsing free-text search queries in either language. When adding a new planet/sign alias, add it to these maps rather than doing ad-hoc string matching elsewhere.
- All astrological values (planets, signs, nakshatras, strengths) are stored/passed as **numeric enum values**, never display strings — display names are resolved per-locale at render time via i18n messages, not hardcoded.

### i18n
- `next-intl` with locale resolution in `src/i18n/request.ts`: tries the routed locale first, falls back to the `NEXT_LOCALE` cookie, defaults to `si`.
- Messages in `src/messages/en.json` and `src/messages/si.json` — keep both in sync when adding UI strings.
- Client components read/write locale via the `useI18n()` hook (`src/hooks/useI18n.tsx`), which sets the `NEXT_LOCALE` cookie and calls `router.refresh()` (no client-side locale routing).

### Auth
- NextAuth with Google provider only, configured in `src/app/api/auth/[...nextauth]/route.ts` (exports `authOptions` for reuse in `getServerSession(authOptions)` calls elsewhere).
- `signIn` callback auto-creates a `User` document keyed on `googleId` with `role: "student"` by default; `session` callback attaches `id`/`role` onto `session.user`. Roles are `"student" | "super-admin"` — admin routes under `src/app/api/admin/**` must check `session.user.role`.

### API routes
REST routes under `src/app/api/**` largely follow the table in `specs/architecture/overview.md` (`/api/horoscope`, `/api/horoscope/[id]/chart/[type]`, `/api/horoscope/[id]/metadata/[metaId]`, `/api/horoscope/[id]/share`, `/api/share/[token]`, `/api/search`, `/api/search/filter`, `/api/admin/**`). Standard pattern per route: `getServerSession(authOptions)` → 401 if missing → `connectDB()` → Mongoose query/mutation → `logger` calls at info/debug/warn levels.

### Logging
`src/lib/logger.ts` exports a shared `pino` logger (pretty-printed in non-production). Use `logger.info/debug/warn/error` with printf-style `%s`/`%d` placeholders (matches existing call sites), not string interpolation.

## Conventions specific to this repo

- 4-space indentation (not 2) across `src/**` — matches existing files despite Prettier defaults elsewhere.
- Import order is enforced by `@trivago/prettier-plugin-sort-imports` — run `pnpm format` after adding imports rather than hand-ordering them.
- See the user's global naming/style conventions (folders, exports, TypeScript patterns) which apply on top of the above.

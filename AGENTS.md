# Kendara — Agent Guide

## Instruction Sources

- **`CLAUDE.md`** — architecture overview, commands, structure (note: framework versions may be stale; trust `package.json`)
- **`DECISIONS.md`** — established patterns for error handling, types, validation, DI, auth, repo scoping, class methods, logging
- Read `DECISIONS.md` before writing backend code.

## Project

npm workspaces monorepo (no Turborepo/Nx). Two workspaces:

| Workspace           | Stack                                                    | Port |
| ------------------- | -------------------------------------------------------- | ---- |
| `@kendara/frontend` | Next.js 16, React 19, TypeScript, Tailwind 4, Auth.js v5 | 3000 |
| `@kendara/backend`  | Express 5, TypeScript, MongoDB                           | 4000 |

## Commands

```bash
npm install                    # install all workspace deps (run from root)
npm run dev                    # start BE + FE concurrently
npm run build                  # build both (BE first, then FE)
npm run dev --workspace=backend   # BE only
npm run dev --workspace=frontend  # FE only
npm run format                 # prettier on staged files only (git diff)
npm run lint --workspace=frontend  # Next.js eslint
```

No test framework is configured yet. Do not attempt to run tests.

## Setup Prerequisites

- MongoDB running locally (backend reads `MONGO_URI` from `.env`)
- Google OAuth credentials configured in both `.env` files
- `AUTH_SECRET` in frontend `.env` — generate with `openssl rand -base64 32`
- See `.env.example` in each workspace for required variables

## Critical Conventions

### Config / Environment

- Single `config` object in each workspace's `lib/config.ts` — the ONLY place `process.env` is read
- All other modules import `config` as default — never access `process.env` directly

### Schema Generation (Backend)

- `predev` and `prebuild` scripts auto-generate JSON schemas via `backend/scripts/generateSchemas.ts`
- Output: `backend/src/schemas/generated.ts` — **gitignored, never committed**
- Generator scans types ending in `Body` (request schemas, `noExtraProps: true`) and `Data` (response schemas)
- Uses `typescript-json-schema` programmatic API — not CLI
- `Date` fields need `@format date` JSDoc for correct schema output

### Error Handling

- Controllers **throw** `AppError` (enum `ErrorCodes`, PascalCase members like `ErrorCodes.BadRequest`)
- Routes catch with `isAppError(err)` type guard → serialize to `{ error: { code, message } }`
- FE has its own `AppError` (no `status` field) — `apiFetch`/`apiFetchClient` map server errors via `mapServerError`
- Never leak raw server error details to the UI

### Types (Backend)

- Per-endpoint request/response types in `backend/src/types/<domain>/`
- Each file default-exports the wrapper type, named-exports the concrete body/data alias
- `AuthUser` lives in `backend/src/types/AuthUser.ts` — shared runtime type, schema generator skips it
- Protected controller methods: `(request, authUser)` — request first, authUser last

### Repository Layer

- Flat positional args — no input object wrappers
- Optional params use `?` syntax, not `Type | undefined`
- All queries MUST include `projection: { _id: 0 }`
- Owner-scoped queries use dot-notation: `{ 'owner.id': ownerId }`
- Entity IDs are UUIDs via `crypto.randomUUID()` — never MongoDB `ObjectId`
- Relationships use `Pick<RelatedModel, 'id'>` — never bare `string` FK fields

### Class Methods (Backend)

- Use regular method syntax — **not** arrow function class fields
- When passing a method as a callback, bind at call site or wrap in inline arrow

### Dependency Injection (Backend)

- Plain constructor injection — no DI framework, no interfaces
- Flow: `connectClient()` → `Repo(db)` → `Controller(repo)` → `makeRouter(controller)`

### Bootstrap (Backend)

- `index.ts` uses `async start()` with `await` — no `.then()` chains
- Express middleware and health route registered before `start()`

### Logging

- Both workspaces use `pino` via `logger.ts` in their `lib/` directories
- `pino-pretty` in dev, plain JSON in production
- No `console.*` calls — use `logger.*`

## Frontend Specifics

- Path alias `@/*` → `frontend/src/*`
- `noEmit: true` — Next.js compiles via SWC
- `apiFetch` — for server components (uses `auth()`)
- `apiFetchClient` — for client components (uses `getSession()`)
- Both forward `Authorization: Bearer <idToken>`
- Forms use `react-hook-form` with `@hookform/resolvers` (Zod)
- UI components: shadcn-style with Radix UI, class-variance-authority, tailwind-merge

## Formatting

- Prettier: single quotes, semicolons, trailing comma (es5), print width 100, tab width 2
- ESLint: `next/core-web-vitals`

## Auth

- Google OAuth via `google-auth-library` (backend) and Auth.js v5 (frontend)
- `makeAuthMiddleware(userRepo)` re-verifies ID token on every request
- Attaches `AuthUser` to `req.authUser` via cast
- On failure: responds 403 immediately — does NOT call `next(err)`
- Protected routers: `router.use(authMiddleware)` at the top

## Plans & Specs

- Feature plans: `plans/YYYY-MM-DD_<feature>.md`
- Specs: `specs/` directory
- When a plan is approved, extract architectural decisions into `DECISIONS.md`

# Kendara — Architecture Reference

## Structure

npm workspaces monorepo. No Turborepo or Nx.

```
kendara/
├── frontend/   Next.js 14 App Router (TypeScript) — port 3000
├── backend/    Express.js (TypeScript) — port 4000
└── specs/      Feature specifications (daily spec files)
```

## Commands

```bash
npm install        # install all workspace dependencies (run from root)
npm run dev        # start BE (4000) + FE (3000) concurrently
npm run build      # build both workspaces
```

Run a single workspace:
```bash
npm run dev --workspace=backend
npm run dev --workspace=frontend
```

## Ports

| Service  | URL                              |
|----------|----------------------------------|
| Frontend | http://localhost:3000            |
| Backend  | http://localhost:4000            |
| Health   | http://localhost:4000/api/health |

## Workspaces

- `@kendara/frontend` — Next.js 14, React 18, TypeScript, App Router
- `@kendara/backend` — Express 4, ts-node-dev, TypeScript

## Backend

- Dev: `ts-node-dev --respawn --transpile-only` (fast restarts, no type-check overhead)
- Build: `tsc` → compiles to `backend/dist/`
- Entry: `backend/src/index.ts`

## Frontend

- App Router, src dir layout: `frontend/src/app/`
- Path alias `@/*` maps to `frontend/src/*`
- TypeScript uses `noEmit: true` — Next.js compiles via SWC

## Adding API routes

Add handlers in `backend/src/`. Call from frontend using:
```ts
fetch('http://localhost:4000/api/your-route')
```
For production, replace the base URL with an environment variable.

# Architectural Decisions

## Backend

### Error Handling

- `ErrorCodes` is a TypeScript enum (PascalCase members, e.g. `ErrorCodes.BadRequest`) — not a `const` object
- `AppError` shape: `{ status: number; code: ErrorCodes; message: string }`
- Error factories (`badRequest`, `forbidden`, `notFound`, `internalServerError`) return `AppError` — all named exports from `errors.ts`
- `isAppError(err): err is AppError` type guard (named export from `errors.ts`) — checks the value is a non-null object with a `code` that is a valid `ErrorCodes` member; use this instead of `(err as AppError).code !== undefined` casts
- Controllers **throw** `AppError` on failure — no return-based error path in controllers
- Routes catch thrown errors with `if (isAppError(err))` — serialise to `{ error: { code, message } }` JSON; unknown errors go to `next(err)`
- Global error handler in `index.ts` also uses `{ error: { code, message } }` shape — consistent across all error paths

### Response Shape

Success:

```json
{ "data": { "user": { ... } } }
```

Error:

```json
{ "error": { "code": "BAD_REQUEST", "message": "Missing ID token" } }
```

### Per-Endpoint Request/Response Types

- Two shared generic wrappers live at the top of `types/`:
  - `RequestType.ts` exports `RequestType<B, P, Q>` (default). `P` and `Q` default to `void` — when `void`, those keys are excluded via conditional types (`{ params?: never }`). Body-only endpoints use `RequestType<SyncUserBody>`
  - `ActionResponse.ts` exports `ActionResponse<T>` (default) — typed `{ status, data?, error? }`
- Each endpoint has its own dedicated files in `backend/src/types/<domain>/`, named `<MethodName>Request.ts` / `<MethodName>Response.ts`
- Each per-endpoint file default-exports the wrapper type (matching the filename) and named-exports the concrete body/data alias:
  - Default export: the full wrapper alias (e.g. `SyncUserRequest`, `SyncUserResponse`) — used for controller typing
  - Named export: the concrete body/data alias (e.g. `SyncUserBody`, `SyncUserData`) — the schema generation target

  ```ts
  // SyncUserRequest.ts
  export type SyncUserBody = { idToken: string };
  type SyncUserRequest = RequestType<SyncUserBody>;
  export default SyncUserRequest;

  // SyncUserResponse.ts
  export type SyncUserData = { user: User };
  type SyncUserResponse = ActionResponse<SyncUserData>;
  export default SyncUserResponse;
  ```

- Controllers receive the specific `<Method>Request` type (default import) and destructure `{ body }` (and `params`/`query` if needed) from it

### Repository Methods

- Repo method params are flat positional arguments — no input object wrappers
- Optional fields use `?` param syntax (e.g. `avatarUrl?: string`), not `string | undefined`
- All queries must include `projection: { _id: 0 }` — MongoDB's `_id` is never exposed outside the repo layer
- Scoping queries use dot-notation for nested fields (e.g. `{ 'owner.id': ownerId }`)

### Models

- Entity IDs are custom UUIDs via `crypto.randomUUID()` — no MongoDB `ObjectId`
- `avatarUrl` is optional (`avatarUrl?: string`) — not `string | undefined` — consistent with the repo method param convention
- `Date` fields do not carry `@format date` JSDoc on the model type itself — that annotation is only needed if schema generation targets the model directly. Response schemas pick up the format via the `SyncUserData` wrapper type
- Model relationships use an embedded object typed with `Pick<RelatedModel, 'id'>` — never a bare `relatedId: string` field. Example: `owner: Pick<User, 'id'>` on `Horoscope`

### Auth Controller

- `syncUser` is a public (unauthenticated) endpoint — no `AuthUser` parameter
- Only include an `AuthUser` parameter on controller methods that require an authenticated user (e.g. activation flows)
- On protected controller methods, the request object comes first and `authUser` comes last — e.g. `async create({ body }: CreateHoroscopeRequest, authUser: AuthUser)`
- `AuthUser` lives in `backend/src/types/AuthUser.ts` (not under `types/<domain>/`) — it is a shared runtime contract, not an endpoint type; the schema generator skips it

### Runtime Validation

- Request/response types are validated at runtime using `ajv` (JSON Schema draft-07)
- JSON Schemas are generated from TypeScript types using `typescript-json-schema` **programmatic API** at build time — not the CLI
- A build script (`backend/scripts/generateSchemas.ts`) scans `backend/src/types/**/*.ts`, discovers all exported symbols, and generates schemas based on naming convention:
  - Types ending in `Body` → request schema (`noExtraProps: true` — rejects unknown fields from clients)
  - Types ending in `Data` → response schema (no `noExtraProps`)
  - All other types are skipped
- Export names in generated file: camelCase type name + `Schema` suffix (e.g. `SyncUserBody` → `syncUserBodySchema`)
- Generated file (`backend/src/schemas/generated.ts`) is gitignored — never committed, always regenerated
- `prebuild` and `predev` npm scripts run the generator automatically — schemas are always fresh
- `typescript-json-schema` is a `devDependency` — not needed at runtime
- `Date` fields in types must have `@format date` JSDoc so the schema emits `{ "type": "string", "format": "date" }` — response data is coerced via `JSON.parse(JSON.stringify(...))` before validation to convert `Date` objects to strings
- AJV instance and validators are created once at module scope in `backend/src/lib/validate.ts` — never per-request
- Two compile utilities: `compileRequestValidator` (throws 400 on failure) for requests, `compileResponseValidator` (throws 500 on failure) for responses
- Route validates request body before calling the controller — controller can assume body is valid and does not re-check

### Bootstrap

- `index.ts` uses an `async start()` function with `await` — no `.then()` chains
- Express middleware (`cors`, `json`) and health route registered before `start()` — only DB-dependent wiring goes inside

### Config

- Single `config` object in `backend/src/config/config.ts` — the only place `process.env` is read; default export
- All other modules import `config` as a default import — never access `process.env` directly

### Dependency Injection

- Plain constructor injection — no DI framework, no interfaces
- Flow: `connectClient()` → `UserRepo(db)` → `AuthController(userRepo)` → `makeAuthRouter(authController)`

## Frontend

### Config

- Single `config` object in `frontend/src/lib/config.ts` — the only place `process.env` is read; default export
- All other modules import `config` as a default import — never access `process.env` directly
- All external service URLs (e.g. Nominatim) live in `config` with defaults — so every third-party call is visible in one place

### Error Handling

- FE uses its own `AppError` type in `frontend/src/lib/errors.ts` — same shape as BE but without `status` (`{ code: ErrorCodes; message: string }`)
- Same `ErrorCodes` enum, same factory functions (`forbidden`, `notFound`, `internalServerError`), same `isAppError` guard — all named exports
- `apiFetch` / `apiFetchClient` catch server errors, log them via `logger`, then map to a clean FE `AppError` via `mapServerError` — raw server error detail is never re-thrown to the UI
- Unknown non-`AppError` responses fall through to `internalServerError()` with no detail leaked

### Fetch Helpers

- `frontend/src/lib/apiFetch.ts` — server-side (Next.js server components), reads session via `auth()`; default export
- `frontend/src/lib/apiFetchClient.ts` — client-side (`'use client'` components), reads session via `getSession()`; default export
- Both helpers forward `Authorization: Bearer <idToken>` and handle error mapping identically

### Logging

- Both BE and FE use `pino` via a `logger.ts` file in their respective `lib/` directories — default export matching the filename
- Logger reads `logLevel` and `nodeEnv` from the local `config` — never from `process.env` directly
- In non-production environments, `pino-pretty` transport is used for human-readable output; in production, plain JSON (ready for Datadog ingestion via `pino-datadog-transport`)
- All `console.*` calls are replaced with `logger.*` — `logger.info`, `logger.error`, etc.
- To add Datadog: install `pino-datadog-transport` and add it as a transport in `logger.ts` when `nodeEnv === 'production'`

### Class Methods

- Class methods are declared with **regular method syntax** — not arrow function class fields
- Example:

  ```ts
  // Correct
  export default class AuthController {
    constructor(private readonly userRepo: UserRepo) {}

    async syncUser({ body: { idToken } }: SyncUserRequest): Promise<SyncUserResponse> {
      // ...
    }
  }

  // Incorrect — do not use arrow function class fields
  export default class AuthController {
    syncUser = async ({ body: { idToken } }: SyncUserRequest): Promise<SyncUserResponse> => {
      // ...
    };
  }
  ```

- When a method is passed as a callback (e.g. to an Express route handler) and `this` binding is needed, bind it at the call site or wrap in an inline arrow — do **not** convert the method to an arrow class field

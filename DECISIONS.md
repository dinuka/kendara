# Architectural Decisions

## Backend

### Error Handling

- `ErrorCodes` is a TypeScript enum (PascalCase members, e.g. `ErrorCodes.BadRequest`) — not a `const` object
- `AppError` shape: `{ status: number; code: ErrorCodes; message: string }`
- Error factories (`badRequest`, `forbidden`, `notFound`, `internalServerError`) return `AppError` — all named exports from `errors.ts`
- Controllers **throw** `AppError` on failure — no return-based error path in controllers
- Routes catch thrown `AppError` and serialise to `{ error: { code, message } }` JSON; unknown errors go to `next(err)`
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
  - `RequestType.ts` exports `RequestType<B, P, Q>` (default) — typed `{ body, params, query }`. `P` and `Q` default to `void` — body-only endpoints use `RequestType<SyncUserBody>`
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

### Auth Controller

- `syncUser` is a public (unauthenticated) endpoint — no `AuthUser` parameter
- Only include an `AuthUser` parameter on controller methods that require an authenticated user (e.g. activation flows)

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

- Single `config` object in `backend/src/config/config.ts` — the only place `process.env` is read
- All other modules import `config` — never access `process.env` directly

### Models

- Entity IDs are custom UUIDs via `crypto.randomUUID()` — no MongoDB `ObjectId`
- `Date` fields must have `@format date` JSDoc so `typescript-json-schema` emits `{ "type": "string", "format": "date" }` instead of `date-time`

### Dependency Injection

- Plain constructor injection — no DI framework, no interfaces
- Flow: `connectClient()` → `UserRepo(db)` → `AuthController(userRepo)` → `makeAuthRouter(authController)`

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
  - `requestType.ts` exports `RequestType<P, Q, B>` — typed `{ params, query, body }`
  - `actionResponse.ts` exports `ActionResponse<T>` — typed `{ status, data?, error? }`
- Each endpoint has its own dedicated files in `backend/src/types/<domain>/`, named `<methodName>Request.ts` / `<methodName>Response.ts`
- Each per-endpoint file exports two types:
  - A concrete body/data alias (e.g. `SyncUserBody`, `SyncUserData`) — the schema generation target
  - A full wrapper alias (e.g. `SyncUserRequest`, `SyncUserResponse`) — used for controller typing
  ```ts
  // syncUserRequest.ts
  export type SyncUserBody = { idToken: string };
  export type SyncUserRequest = RequestType<Record<string, string>, Record<string, string>, SyncUserBody>;

  // syncUserResponse.ts
  export type SyncUserData = { user: User };
  export type SyncUserResponse = ActionResponse<SyncUserData>;
  ```
- Controllers receive the specific `<Method>Request` type and destructure `{ body }` (and `params`/`query` if needed) from it

### Repository Methods

- Repo method params are flat positional arguments — no input object wrappers
- Optional fields use `?` param syntax (e.g. `avatarUrl?: string`), not `string | undefined`

### Auth Controller

- `syncUser` is a public (unauthenticated) endpoint — no `AuthUser` parameter
- Only include an `AuthUser` parameter on controller methods that require an authenticated user (e.g. activation flows)

### Runtime Validation

- Request/response types are validated at runtime using `ajv` (JSON Schema draft-07)
- JSON Schemas are generated from TypeScript types using `typescript-json-schema` CLI — run manually from `backend/` whenever a request/response type changes, then commit the output
- Schema generation targets the concrete body/data aliases (`SyncUserBody`, `SyncUserData`), not the generic `RequestType`/`ActionResponse` wrappers
- Generated schemas live in `backend/src/schemas/<domain>/` and are committed to git
- `Date` fields in types must have `@format date` JSDoc so the schema emits `{ "type": "string", "format": "date" }` — response data is coerced via `JSON.parse(JSON.stringify(...))` before validation to convert `Date` objects to strings
- Schema generation commands (run from `backend/`):
  ```bash
  npx typescript-json-schema tsconfig.schema.json SyncUserBody --required --strictNullChecks --noExtraProps --out src/schemas/auth/syncUserBody.json
  npx typescript-json-schema tsconfig.schema.json SyncUserData --required --strictNullChecks --out src/schemas/auth/syncUserData.json
  ```
- `--noExtraProps` on request schemas only — rejects unknown fields from clients; omitted on response schemas
- `backend/tsconfig.schema.json` has a narrow `include` (types, models, errors only) to prevent the CLI from tripping over files that import runtime packages
- AJV instance and validators are created once at module scope in `backend/src/lib/validate.ts` — never per-request
- Two compile utilities: `compileValidator` (throws 400 on failure) for requests, `compileResponseValidator` (throws 500 on failure) for responses
- Route validates request body before calling the controller — controller can assume body is valid and does not re-check

### Dependency Injection

- Plain constructor injection — no DI framework, no interfaces
- Flow: `connectClient()` → `UserRepo(db)` → `AuthController(userRepo)` → `makeAuthRouter(authController)`

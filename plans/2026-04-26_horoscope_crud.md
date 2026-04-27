# Plan — 2026-04-26 Horoscope CRUD

## Context

The app needs a Horoscope domain so authenticated users can manage birth-chart records (name, birth date/time, timezone, location). Future features (graha charts, dasha charts, reports) will hang off this entity. Currently the backend has only the auth flow and the frontend has only home/login/dashboard, so this plan adds the first real domain end-to-end.

Two foundational gaps surfaced during exploration that this plan must close before CRUD itself:

1. **No backend auth middleware exists.** Currently every endpoint is public. The `/api/auth/sync` flow stores the Google ID token in the NextAuth session, but no middleware verifies it on protected routes. This plan adds an `authMiddleware` that re-verifies the Google ID token on every protected request and attaches an `AuthUser` to `req`.
2. **No frontend API fetch wrapper exists.** All future protected calls need `Authorization: Bearer <idToken>` forwarding. This plan adds a small `apiFetch` helper.

## Decisions confirmed with user

- **Form pattern:** Modal dialog over the list page (single `/horoscopes` route, Dialog primitive added)
- **Location input:** Place search with geocoding via OpenStreetMap Nominatim (free, no API key)
- **Timezone:** IANA string (`Asia/Colombo`) — overrides the spec's `number` for accuracy with DST/historical changes
- **Form library:** `react-hook-form` + `zod` with `@hookform/resolvers`

## Scope

- Backend auth middleware (Google ID token verification → `AuthUser`)
- Backend Horoscope CRUD: create, list, get-one, update, delete (all owner-scoped)
- Frontend `/horoscopes` list page with Dialog-based create/edit and delete confirmation
- Frontend `apiFetch` helper that forwards the session ID token
- Nav link from dashboard to `/horoscopes`; route protection via `proxy.ts`
- New shadcn primitives: Input, Label, Dialog, Select (for timezone), Combobox (place search)

## Out of scope

- Graha/dasha calculations, reports, charts
- Sharing horoscopes between users
- Bulk import/export
- Replacing Google ID token verification with an internal session JWT (future optimisation — Google call on every request is fine for now)

## Model

```ts
// backend/src/models/Horoscope.ts
import User from './User';

type Horoscope = {
  id: string; // crypto.randomUUID()
  owner: Pick<User, 'id'>; // scoping field — required by auth constraint
  name: string;
  birthTime: Date; // single Date — combined date + time
  timezone: string; // IANA, e.g. 'Asia/Colombo'
  location: {
    latitude: number;
    longitude: number;
    label: string; // human-readable, e.g. 'Colombo, Sri Lanka' (returned from geocoder)
  };
  createdAt: Date;
  updatedAt: Date;
};

export default Horoscope;
```

Note `owner` and `location.label` are additions to the spec — `owner` is required to enforce per-user scoping; `label` lets the UI display the place name without re-geocoding.

---

## Implementation Steps

### 1. Backend — Auth middleware

**Create** `backend/src/middleware/authMiddleware.ts`:

```ts
import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import config from '../config/config';
import { ErrorCodes, forbidden, isAppError } from '../errors';
import UserRepo from '../repos/UserRepo';
import AuthUser from '../types/AuthUser';

const client = new OAuth2Client(config.googleClientId);

export const makeAuthMiddleware =
  (userRepo: UserRepo) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) throw forbidden('Missing bearer token');
      const idToken = header.slice('Bearer '.length);

      const ticket = await client.verifyIdToken({ idToken, audience: config.googleClientId });
      const payload = ticket.getPayload();
      if (!payload?.sub) throw forbidden('Invalid Google token');

      const user = await userRepo.findByGoogleId(payload.sub);
      if (!user) throw forbidden('User not synced');

      (req as Request & { authUser: AuthUser }).authUser = user;
      next();
    } catch (err) {
      if (isAppError(err)) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
      } else {
        res.status(403).json({ error: { code: ErrorCodes.Forbidden, message: 'Auth failed' } });
      }
    }
  };
```

**Refactor** `backend/src/models/User.ts` from `type` → `interface` (so it can be extended):

```ts
export enum Role {
  User = 'user',
  Admin = 'admin',
}

interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export default User;
```

**Create** `backend/src/types/AuthUser.ts` — extends `User`:

```ts
import User from '../models/User';

interface AuthUser extends User {}

export default AuthUser;
```

`AuthUser` is the full authenticated user (same shape as `User` today; the separate type leaves room to add request-scoped fields later — e.g. `idToken`, permissions — without polluting the `User` model). This file is **not** under `types/<domain>/` because it isn't an endpoint request/response type — it's a shared runtime contract. The schema generator skips it (no `Body`/`Data` suffix).

### 2. Backend — Horoscope model & repo

**Create** `backend/src/models/Horoscope.ts` (see model section above).

**Create** `backend/src/repos/HoroscopeRepo.ts`:

```ts
import { Db } from 'mongodb';
import Horoscope from '../models/Horoscope';

const COLLECTION = 'horoscopes';

export default class HoroscopeRepo {
  constructor(private readonly db: Db) {}

  async create(
    ownerId: string,
    name: string,
    birthTime: Date,
    timezone: string,
    latitude: number,
    longitude: number,
    locationLabel: string
  ): Promise<Horoscope> {
    const now = new Date();
    const horoscope: Horoscope = {
      id: crypto.randomUUID(),
      owner: { id: ownerId },
      name,
      birthTime,
      timezone,
      location: { latitude, longitude, label: locationLabel },
      createdAt: now,
      updatedAt: now,
    };
    await this.db.collection<Horoscope>(COLLECTION).insertOne(horoscope);
    return horoscope;
  }

  async listByOwner(ownerId: string): Promise<Horoscope[]> {
    return this.db
      .collection<Horoscope>(COLLECTION)
      .find({ 'owner.id': ownerId }, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async findByIdAndOwner(id: string, ownerId: string): Promise<Horoscope | undefined> {
    return (
      (await this.db
        .collection<Horoscope>(COLLECTION)
        .findOne({ id, 'owner.id': ownerId }, { projection: { _id: 0 } })) ?? undefined
    );
  }

  async update(
    id: string,
    ownerId: string,
    name: string,
    birthTime: Date,
    timezone: string,
    latitude: number,
    longitude: number,
    locationLabel: string
  ): Promise<Horoscope | undefined> {
    const result = await this.db.collection<Horoscope>(COLLECTION).findOneAndUpdate(
      { id, 'owner.id': ownerId },
      {
        $set: {
          name,
          birthTime,
          timezone,
          location: { latitude, longitude, label: locationLabel },
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after', projection: { _id: 0 } }
    );
    return result ?? undefined;
  }

  async deleteByIdAndOwner(id: string, ownerId: string): Promise<boolean> {
    const result = await this.db
      .collection<Horoscope>(COLLECTION)
      .deleteOne({ id, 'owner.id': ownerId });
    return result.deletedCount === 1;
  }
}
```

Every read/write is scoped by `owner.id` — no method can leak across users.

### 3. Backend — Endpoint types

Five endpoints, each with its own request/response file under `backend/src/types/horoscope/`.

| File                         | Body / Data                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `CreateHoroscopeRequest.ts`  | `CreateHoroscopeBody = { name; birthTime: string (date-time); timezone; location: { latitude; longitude; label } }` |
| `CreateHoroscopeResponse.ts` | `CreateHoroscopeData = { horoscope: Horoscope }`                                                                    |
| `ListHoroscopesResponse.ts`  | `ListHoroscopesData = { horoscopes: Horoscope[] }`                                                                  |
| `GetHoroscopeResponse.ts`    | `GetHoroscopeData = { horoscope: Horoscope }`                                                                       |
| `UpdateHoroscopeRequest.ts`  | `UpdateHoroscopeBody` (same shape as create body)                                                                   |
| `UpdateHoroscopeResponse.ts` | `UpdateHoroscopeData = { horoscope: Horoscope }`                                                                    |
| `DeleteHoroscopeResponse.ts` | `DeleteHoroscopeData = { success: true }`                                                                           |

Each file follows the existing convention (`SyncUserRequest.ts` is the template): default export is the wrapper (`RequestType<Body, Params>` / `ActionResponse<Data>`), named export is the Body/Data alias. `Date` fields in the request bodies are typed as `string` with `/** @format date-time */` JSDoc so AJV validates them as ISO strings — the controller parses them into `Date`.

For path-param endpoints (get/update/delete), the request type is `RequestType<Body, { id: string }>` so `params.id` is typed.

### 4. Backend — Controller

**Create** `backend/src/controllers/HoroscopeController.ts`:

```ts
import HoroscopeRepo from '../repos/HoroscopeRepo';
import AuthUser from '../types/AuthUser';
import { notFound } from '../errors';
import CreateHoroscopeRequest from '../types/horoscope/CreateHoroscopeRequest';
import CreateHoroscopeResponse from '../types/horoscope/CreateHoroscopeResponse';
// ... other request/response imports

export default class HoroscopeController {
  constructor(private readonly horoscopeRepo: HoroscopeRepo) {}

  async create(
    { body }: CreateHoroscopeRequest,
    authUser: AuthUser
  ): Promise<CreateHoroscopeResponse> {
    const { name, birthTime, timezone, location } = body;
    const horoscope = await this.horoscopeRepo.create(
      authUser.id,
      name,
      new Date(birthTime),
      timezone,
      location.latitude,
      location.longitude,
      location.label
    );
    return { status: 201, data: { horoscope } };
  }

  async list(authUser: AuthUser): Promise<ListHoroscopesResponse> {
    const horoscopes = await this.horoscopeRepo.listByOwner(authUser.id);
    return { status: 200, data: { horoscopes } };
  }

  async get({ params }: GetHoroscopeRequest, authUser: AuthUser): Promise<GetHoroscopeResponse> {
    const horoscope = await this.horoscopeRepo.findByIdAndOwner(params.id, authUser.id);
    if (!horoscope) throw notFound('Horoscope not found');
    return { status: 200, data: { horoscope } };
  }

  async update(
    { body, params }: UpdateHoroscopeRequest,
    authUser: AuthUser
  ): Promise<UpdateHoroscopeResponse> {
    const updated = await this.horoscopeRepo.update(
      params.id,
      authUser.id,
      body.name,
      new Date(body.birthTime),
      body.timezone,
      body.location.latitude,
      body.location.longitude,
      body.location.label
    );
    if (!updated) throw notFound('Horoscope not found');
    return { status: 200, data: { horoscope: updated } };
  }

  async delete(
    { params }: DeleteHoroscopeRequest,
    authUser: AuthUser
  ): Promise<DeleteHoroscopeResponse> {
    const deleted = await this.horoscopeRepo.deleteByIdAndOwner(params.id, authUser.id);
    if (!deleted) throw notFound('Horoscope not found');
    return { status: 200, data: { success: true } };
  }
}
```

Note class methods use **regular method syntax** (not arrow function class fields) per the new "Class Methods" rule in DECISIONS.md. When passing methods to Express route handlers, wrap them in an inline arrow at the call site to preserve `this` binding (e.g. `(req, res, next) => controller.create(...)`).

This also establishes the **request-first, AuthUser-last convention** for protected controller methods — the request object comes first, `authUser` comes last (DECISIONS.md already hints at it but the pattern was not yet implemented).

### 5. Backend — Routes

**Create** `backend/src/routes/horoscopeRoutes.ts` following the `authRoutes.ts` template, but with one key difference — every handler runs `authMiddleware` first and reads `req.authUser`:

```ts
export const makeHoroscopeRouter = (
  controller: HoroscopeController,
  authMiddleware: RequestHandler
): Router => {
  const router = Router();
  router.use(authMiddleware); // protect all routes in this router

  router.post('/', async (req, res, next) => {
    try {
      const body = validateCreateBody(req.body);
      const authUser = (req as Request & { authUser: AuthUser }).authUser;
      const result = await controller.create({ body }, authUser);
      if (result.data) validateCreateResponse(JSON.parse(JSON.stringify(result.data)));
      res.status(result.status).json({ data: result.data });
    } catch (err) {
      if (isAppError(err))
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
      else next(err);
    }
  });

  // GET /, GET /:id, PUT /:id, DELETE /:id — same pattern
  return router;
};
```

### 5b. Backend — Refactor existing `AuthController.syncUser`

The existing `AuthController.syncUser` is currently an arrow function class field. Per the new "Class Methods" rule in DECISIONS.md, refactor it to a regular method:

```ts
// Before
syncUser = async ({ body: { idToken } }: SyncUserRequest): Promise<SyncUserResponse> => { /* ... */ };

// After
async syncUser({ body: { idToken } }: SyncUserRequest): Promise<SyncUserResponse> { /* ... */ }
```

Then update the call site in `routes/authRoutes.ts` to wrap the method in an inline arrow so `this` stays bound:

```ts
// Before
const result = await controller.syncUser({ body });

// After (still works because we're calling on the instance directly)
// — actually no change needed at the call site since `controller.syncUser({ body })` already preserves `this`.
// The only risk is if syncUser were passed as `controller.syncUser` (unbound reference). Confirm no such usage exists.
```

### 6. Backend — Wire it up in `index.ts`

```ts
const horoscopeRepo = new HoroscopeRepo(db);
const horoscopeController = new HoroscopeController(horoscopeRepo);
const authMiddleware = makeAuthMiddleware(userRepo);

app.use('/api/auth', makeAuthRouter(authController));
app.use('/api/horoscopes', makeHoroscopeRouter(horoscopeController, authMiddleware));
```

### 7. Frontend — `apiFetch` helper

**Create** `frontend/src/lib/apiFetch.ts`:

```ts
import { auth } from './auth';
import config from './config';
import {
  AppError,
  ErrorCodes,
  forbidden,
  internalServerError,
  isAppError,
  notFound,
} from './errors';
import logger from './logger';

const mapServerError = (serverError: AppError): AppError => {
  switch (serverError.code) {
    case ErrorCodes.NotFound:
      return notFound();
    case ErrorCodes.Forbidden:
      return forbidden();
    default:
      return internalServerError();
  }
};

const apiFetch = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const session = await auth();
  if (!session?.idToken) throw forbidden('Not authenticated');

  const res = await fetch(`${config.backendUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.idToken}`,
      ...(init.headers ?? {}),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    const serverError = json?.error;
    if (isAppError(serverError)) {
      logger.error(serverError, 'apiFetch error');
      throw mapServerError(serverError);
    }
    throw internalServerError();
  }
  return json.data as T;
};

export default apiFetch;
```

For client-component usage, a parallel `apiFetchClient` reads the token from `useSession()`:

```ts
// frontend/src/lib/apiFetchClient.ts
'use client';
import { getSession } from 'next-auth/react';
import config from './config';
import {
  AppError,
  ErrorCodes,
  forbidden,
  internalServerError,
  isAppError,
  notFound,
} from './errors';
import logger from './logger';

const mapServerError = (serverError: AppError): AppError => {
  switch (serverError.code) {
    case ErrorCodes.NotFound:
      return notFound();
    case ErrorCodes.Forbidden:
      return forbidden();
    default:
      return internalServerError();
  }
};

const apiFetchClient = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const session = await getSession();
  if (!session?.idToken) throw forbidden('Not authenticated');

  const res = await fetch(`${config.backendUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.idToken}`,
      ...(init.headers ?? {}),
    },
  });

  const json = await res.json();
  if (!res.ok) {
    const serverError = json?.error;
    if (isAppError(serverError)) {
      logger.error(serverError, 'apiFetchClient error');
      throw mapServerError(serverError);
    }
    throw internalServerError();
  }
  return json.data as T;
};

export default apiFetchClient;
```

Add `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000` to `frontend/.env.local`.

### 8. Frontend — Install dependencies

```bash
cd frontend
npm install react-hook-form zod @hookform/resolvers \
  @radix-ui/react-dialog @radix-ui/react-label @radix-ui/react-select date-fns
```

### 9. Frontend — Add UI primitives

Hand-write these in `frontend/src/components/ui/` (matching the existing manually-installed shadcn pattern):

- `input.tsx` — styled `<input>` with `cn()` className merging
- `label.tsx` — Radix Label primitive wrapper
- `dialog.tsx` — Radix Dialog primitives (Root, Trigger, Portal, Overlay, Content, Title, Description, Close)
- `select.tsx` — Radix Select primitives (for timezone dropdown)
- `combobox.tsx` — custom combobox built on a styled input + popup list (for place search)

Reference the official shadcn source for each as the template.

### 10. Frontend — Geocoding helper

**Create** `frontend/src/lib/geocode.ts` — wraps Nominatim:

```ts
import config from './config';

export type GeocodeResult = { latitude: number; longitude: number; label: string };

export const geocode = async (query: string): Promise<GeocodeResult[]> => {
  if (query.length < 2) return [];
  const url = `${config.nominatimUrl}?q=${encodeURIComponent(query)}&format=json&limit=5`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) return [];
  const data: Array<{ lat: string; lon: string; display_name: string }> = await res.json();
  return data.map(({ lat, lon, display_name }) => ({
    latitude: parseFloat(lat),
    longitude: parseFloat(lon),
    label: display_name,
  }));
};
```

Per Nominatim's usage policy, debounce calls (300ms) in the combobox.

### 11. Frontend — Form schema (shared)

**Create** `frontend/src/app/horoscopes/horoscopeFormSchema.ts`:

```ts
import { z } from 'zod';

export const horoscopeFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  birthTime: z.string().min(1, 'Birth date & time is required'), // datetime-local string
  timezone: z.string().min(1, 'Timezone is required'),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    label: z.string().min(1, 'Pick a location'),
  }),
});

export type HoroscopeFormValues = z.infer<typeof horoscopeFormSchema>;
```

### 12. Frontend — `HoroscopeFormDialog` component

**Create** `frontend/src/app/horoscopes/HoroscopeFormDialog.tsx` (`'use client'`):

- Props: `{ open; onOpenChange; mode: 'create' | 'edit'; initial?: Horoscope; onSaved: () => void }`
- Uses `useForm({ resolver: zodResolver(horoscopeFormSchema), defaultValues })`
- Fields:
  - Name → `<Input>`
  - Birth date+time → `<Input type="datetime-local">`
  - Timezone → `<Select>` listing IANA timezones via `Intl.supportedValuesOf('timeZone')`
  - Location → `<Combobox>` powered by debounced `geocode()`; on select, sets `location` form value
- On submit: POST `/api/horoscopes` (create) or PUT `/api/horoscopes/:id` (edit) via `apiFetchClient`
- Convert `birthTime` (datetime-local string) → ISO before sending: `new Date(value).toISOString()`
- Calls `onSaved()` after success → list refreshes

### 13. Frontend — `/horoscopes` page

**Create** `frontend/src/app/horoscopes/page.tsx` (server component):

```tsx
import { apiFetch } from '@/lib/apiFetch';
import HoroscopeListClient from './HoroscopeListClient';

const HoroscopesPage = async () => {
  const { horoscopes } = await apiFetch<{ horoscopes: Horoscope[] }>('/api/horoscopes');
  return <HoroscopeListClient initial={horoscopes} />;
};
export default HoroscopesPage;
```

**Create** `frontend/src/app/horoscopes/HoroscopeListClient.tsx` (`'use client'`):

- Holds `horoscopes` state, seeded from server props
- Header: "Horoscopes" + `<Button onClick>` to open the create dialog
- For each horoscope, a `<Card>` showing name, formatted birth date, location label, and `[Edit]` / `[Delete]` buttons
- Edit opens `HoroscopeFormDialog` in edit mode
- Delete opens a confirmation dialog → calls `apiFetchClient('/api/horoscopes/:id', { method: 'DELETE' })` → updates state
- After create/edit, refetches the list (or optimistically updates)

### 14. Frontend — Route protection & nav

- Update `frontend/src/proxy.ts` matcher: `['/dashboard/:path*', '/horoscopes/:path*', '/login']`
- Add a "Horoscopes" link in the dashboard header

---

## Critical Files

| File                                                                  | Action                                                                                       |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `backend/src/models/User.ts`                                          | Refactor `type` → `interface` (so AuthUser can extend)                                       |
| `backend/src/repos/UserRepo.ts`                                       | Add `projection: { _id: 0 }` to all queries — never expose `_id`                             |
| `backend/src/controllers/AuthController.ts`                           | Refactor `syncUser` arrow class field → regular method (per new DECISIONS.md rule)           |
| `backend/src/types/AuthUser.ts`                                       | Create — `interface AuthUser extends User`                                                   |
| `backend/src/middleware/authMiddleware.ts`                            | Create — Google ID token verification                                                        |
| `backend/src/models/Horoscope.ts`                                     | Create                                                                                       |
| `backend/src/repos/HoroscopeRepo.ts`                                  | Create — owner-scoped CRUD                                                                   |
| `backend/src/controllers/HoroscopeController.ts`                      | Create — AuthUser as first param                                                             |
| `backend/src/routes/horoscopeRoutes.ts`                               | Create — auth-protected router                                                               |
| `backend/src/types/horoscope/*.ts`                                    | Create — 7 request/response files                                                            |
| `backend/src/index.ts`                                                | Wire repo, controller, middleware, router                                                    |
| `frontend/src/lib/config.ts`                                          | Create — centralised env config with defaults                                                |
| `frontend/src/lib/auth.ts`                                            | Update — use `config.backendUrl` instead of `process.env` directly                           |
| `frontend/src/lib/apiFetch.ts`                                        | Create — server-side fetch wrapper                                                           |
| `frontend/src/lib/apiFetchClient.ts`                                  | Create — client-side fetch wrapper                                                           |
| `frontend/src/lib/geocode.ts`                                         | Create — Nominatim helper                                                                    |
| `frontend/src/components/ui/{input,label,dialog,select,combobox}.tsx` | Create — shadcn primitives                                                                   |
| `frontend/src/app/horoscopes/page.tsx`                                | Create — server list page                                                                    |
| `frontend/src/app/horoscopes/HoroscopeListClient.tsx`                 | Create — client list + delete                                                                |
| `frontend/src/app/horoscopes/HoroscopeFormDialog.tsx`                 | Create — create/edit dialog                                                                  |
| `frontend/src/app/horoscopes/horoscopeFormSchema.ts`                  | Create — shared zod schema                                                                   |
| `frontend/src/app/dashboard/page.tsx`                                 | Add nav link to `/horoscopes`                                                                |
| `frontend/src/proxy.ts`                                               | Add `/horoscopes/:path*` to matcher                                                          |
| `frontend/.env.local`                                                 | Add `NEXT_PUBLIC_BACKEND_URL`                                                                |
| `frontend/package.json`                                               | Add deps (react-hook-form, zod, @hookform/resolvers, radix dialog/label/select, date-fns)    |
| `DECISIONS.md`                                                        | Append: auth middleware pattern, AuthUser-as-first-param convention, repo owner-scoping rule |

---

## Verification

1. `npm run dev` from repo root — both FE (3000) and BE (4000) start without errors
2. Sign in via Google — `/dashboard` shows user info
3. Click "Horoscopes" nav link → `/horoscopes` loads (empty state)
4. Click "+ New" → dialog opens; fill name, birth date+time, pick a timezone (e.g. `Asia/Colombo`), search "Colombo" in the location combobox and pick a result
5. Click Save → dialog closes, new horoscope appears in the list
6. `curl -i http://localhost:4000/api/horoscopes` (no token) → 403 with `{ error: { code: 'FORBIDDEN', message: 'Missing bearer token' } }`
7. `curl -i -H "Authorization: Bearer <stale-token>" http://localhost:4000/api/horoscopes` → 403 (Google rejects)
8. Click Edit on a row → dialog pre-fills; change name; Save → list updates
9. Click Delete → confirmation dialog → confirm → row removed
10. **Owner scoping check:** open MongoDB shell, manually insert a horoscope with a different `owner.id`, verify it does NOT appear in the FE list and `GET /api/horoscopes/:thatId` returns 404
11. Resize to mobile width — list cards stack, dialog remains usable
12. Sign out, then visit `/horoscopes` directly → redirected to `/login` by `proxy.ts`
13. After implementation, append the new architectural decisions (auth middleware shape, AuthUser-as-first-param controller convention, repo owner-scoping invariant) to `DECISIONS.md`

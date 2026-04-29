# Plan — 2026-04-27 Horoscope PDF Import

## Context

Horoscope CRUD shipped per `plans/2026-04-26_horoscope_crud.md` — users create entries manually through the dialog form. The next step is bootstrapping a horoscope from an existing chart PDF: the user clicks "+ Import PDF", picks a file, the backend OCRs and parses it into structured fields, and the user lands on a review screen pre-populated with the extracted data. On save, the horoscope is persisted with an optional `chartData` object alongside the existing fields.

The OCR/parse pipeline is a Python script (already prototyped) wrapping `pdf2image` + Tesseract + regex extractors. The backend invokes it as a subprocess per request — no long-running parser service.

Three architectural concerns drive this plan and surface as new patterns in `DECISIONS.md`:

1. **Polyglot subprocess invocation** (Node spawning Python) — needs a single helper, deterministic stdout/stderr discipline, and explicit timeout/maxBuffer.
2. **Multipart upload handling** — first endpoint that doesn't take JSON; introduces `multer` and a non-`Body`-suffixed request type, which interacts subtly with the schema generator.
3. **Two-step write flow with cross-page state handoff** — parse endpoint returns extracted data without persisting; FE buffers in `sessionStorage`; save uses the existing `POST /api/horoscopes` (extended with optional `chartData`).

## Decisions confirmed with user

- **Parser location:** New sibling workspace `parser/` at repo root (Python script + venv + requirements). Backend invokes via `child_process.execFile` per request (~1–2s cold start acceptable).
- **Flow:** Two-step. `POST /api/horoscopes/parse-pdf` returns extracted JSON only; the FE buffers it; the existing `POST /api/horoscopes` (extended with `chartData?`) does the actual write.
- **Data model:** Extend `Horoscope` with optional `chartData?: ChartData`. Manual horoscopes leave it `undefined`.
- **UI entry point:** `+ Import PDF` button next to `+ New` on `/horoscopes` → native file picker → upload → navigate to `/horoscopes/import/review` with basic fields editable and rich fields read-only.

## Scope

- New `parser/` workspace (Python script, requirements, README, .gitignore) sibling to `backend/` and `frontend/`.
- Backend: `chartData?` on `Horoscope`; new `ChartData` type; `multer` integration; parse-PDF endpoint; subprocess helper (`lib/horoscopeParser.ts`); config additions; create/update extended to accept `chartData?`.
- Frontend: `apiFetchClient` extended for `FormData` bodies; `+ Import PDF` button; `/horoscopes/import/review` route; FE `ChartData` mirror; sessionStorage handoff helpers.
- DECISIONS.md additions: subprocess invocation pattern, multipart upload pattern, two-step import flow.

## Out of scope

- Editing rich chartData fields (planetary positions, cusps, dashas) from the UI — read-only this iteration. OCR mis-reads of numeric fields cannot be corrected in-app; user re-imports or edits MongoDB directly. Documented as a known limitation.
- Persisting raw OCR text (`_rawOcr`) on horoscope docs — would bloat documents.
- Async/queued parser. Subprocess-on-demand is sufficient.
- Streaming parse progress to the UI — single round-trip with a spinner.
- Re-importing into an existing horoscope. Always creates a new one.

## Models

```ts
// backend/src/models/Horoscope.ts (extended)
import User from './User';
import ChartData from './ChartData';

interface Horoscope {
  id: string;
  owner: Pick<User, 'id'>;
  name: string;
  birthTime: Date;
  timezone: string;
  location: {
    latitude: number;
    longitude: number;
    label: string;
  };
  chartData?: ChartData; // <— new, optional; absent on manually-created horoscopes
  createdAt: Date;
  updatedAt: Date;
}

export default Horoscope;
```

`ChartData` captures the full chart structure the parser extracts — planets with DMS degrees, sign/nakshatra loads, cuspal positions with lord chains, and a recursive dasha tree. Anything not on the model below is dropped before save.

```ts
// backend/src/models/ChartData.ts
interface Planet {
  id: number; //1...7
  name: string; // 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn' | 'Rahu' | 'Kethu'
  code: string; //Su,Mo,Ma,Me,Ju
}

interface Sign {
  id: number; //1...12
  name: string; //Libra, Capricorn
  load: Planet;
}

interface Nakshatra {
  id: number; //1..27
  name: string; //Ashwini, Bharani
  load: Planet;
}

interface House {
  id: number; // 1..12
}

interface PlanetaryPosition {
  planet: Planet;
  degrees: {
    d: number;
    m: number;
    s: number;
  };
  house: House;
  sign: Sign;
  starLoad: Planet; //STL
  subLoad: Planet; //SL
  subSubLoad: Planet; //SSL
  direct: Boolean;
}

interface CuspalPosition {
  id: number; //1...12
  sign: Sign;
  degrees: {
    d: number;
    m: number;
    s: number;
  };
  starLoad: Planet; //STL
  subLoad: Planet; //SL
  subSubLoad: Planet; //SSL
}

interface DashaPeriod {
  lord: Planet;
  startDate: string; // raw DD-MM-YYYY string from OCR — display only
  endDate: string;
  subDashaPeriods: DashaPeriod[]; // recursive nesting (Mahadasha → Bhukti → Antara → Sukshama → Prana)
}

interface ChartData {
  nakshatra: Nakshatra;
  nakshatraPada: number; //1,2,3,4
  tithi: {
    paksha: string; //Shukla,Krushna
    id: number; //1..15
  };
  planetaryPositions: PlanetaryPosition[]; // typically 9
  cuspalPositions: CuspalPosition[]; // 12
  dashas: DashaPeriod[]; // recursive — sub-periods nested via subDashaPeriods
}

export default ChartData;
```

**Date strategy.** Top-level `birthTime` on `Horoscope` stays a real `Date` (canonical, validated). Inside `ChartData`, dasha dates are raw OCR strings — coercing to `Date` would throw on noisy inputs, and these fields are display-only.

**`degrees` is `{ d, m, s }` on both planetary and cuspal positions.** `PlanetaryPosition.degrees` and `CuspalPosition.degrees` both store the OCR-parsed DMS triplet (e.g. `{ d: 12, m: 35, s: 0 }`). These feed both display and future angular calculations. No separate `degree` number field exists.

**Dropped from earlier draft (parser still extracts them, but they're not persisted):**

- Native info block (place, dayOfWeek, raw date/time, longitude/latitude, geocentricLatitude)
- Chart settings (lunarNodes, dst, siderealTime, ayanamsa, houseSystem)
- Per-level current dasha arrays (Bhukti/Antara/Sukshama/Prana) — collapsed into a single recursive `dashas` tree

If any of these become needed later, extend `ChartData` and the parser-emitted shape together.

**`_rawOcr`.** Excluded from both the parse-endpoint response and the persisted document. Useful for local CLI debugging only.

## Implementation Steps

### 1. Parser workspace setup

New top-level `parser/` directory:

```
parser/
  true_astro_pdf_horoscope_parser.py       # prototype script with stderr-only progress prints
  requirements.txt          # pdf2image, pytesseract, Pillow
  README.md                 # venv + system-deps setup
  .gitignore                # .venv/, __pycache__/, *.pyc
```

`requirements.txt`:

```
pdf2image>=1.17
pytesseract>=0.3.10
Pillow>=10
```

(No `pymongo` — backend owns DB writes.)

`README.md`:

````md
# Kendara Horoscope Parser

Subprocess invoked by the backend to OCR + parse horoscope PDFs.

## System dependencies

```bash
# Fedora
sudo dnf install tesseract poppler-utils
# Debian/Ubuntu
sudo apt install tesseract-ocr poppler-utils
# macOS
brew install tesseract poppler
```

## Python env

```bash
cd parser
python -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Smoke test

```bash
.venv/bin/python horoscope_parser.py path/to/sample.pdf | jq .
```
````

`.gitignore`:

```
.venv/
__pycache__/
*.pyc
```

**Required tweaks to the prototype script** (otherwise the backend's JSON parse fails):

- Route ALL progress/diagnostic prints to `sys.stderr` (the prototype prints `[1/4] OCR → ...` etc. on stdout, which corrupts the JSON output). Replace each `print(f"[N/4] ...")` with `print("...", file=sys.stderr)`.
- Output shape change: emit `birthDate` (YYYY-MM-DD) and `birthTimeOfDay` (HH:MM) as **separate** top-level keys instead of a combined ISO `birthTime`. Reason: the existing form schema (`frontend/src/app/horoscopes/horoscopeFormSchema.ts`) uses these split fields, and combining them requires knowing the IANA timezone — which is itself one of the parsed fields. Keeping them split lets the review page reuse the existing date/time inputs without conversion.
- Map raw timezone strings ("+5:30", "Indian Standard Time") to IANA (`Asia/Colombo`) via a small lookup table. If unknown, return empty string — review page lets user pick.
- Strip `_rawOcr` from script output entirely (or gate behind a `--debug` flag for local CLI use). Never sent to backend.
- **Reshape the `chartData` block to match the `ChartData` model** (see Models section). Specifically:
  - `planet` objects include `{ id, name, code }`. `Sign` objects include `{ id, name, load: Planet }`. `House` objects are `{ id }`. `Nakshatra` objects are `{ id, name, load: Planet }`.
  - `planetaryPositions[]` items become `{ planet: Planet, degrees: { d, m, s }, house: House, sign: Sign, starLoad: Planet, subLoad: Planet, subSubLoad: Planet, direct: boolean }`. Parse `degrees` from the OCR `DD-MM-SS` string into the DMS triplet.
  - `cuspalPositions[]` items become `{ id, sign: Sign, degrees: { d, m, s }, starLoad: Planet, subLoad: Planet, subSubLoad: Planet }`. Parse `degrees` from OCR similarly.
  - `nakshatra` is a full `{ id, name, load: Planet }` object. `nakshatraPada` is an integer (1–4). `tithi` is `{ paksha: string, id: number }`.
  - Collapse the five separate period arrays (`dashas`, `currentBhukti`, `currentAntara`, `currentSukshama`, `currentPrana`) into a single recursive `dashas: DashaPeriod[]` tree. Each `DashaPeriod` is `{ lord: Planet, startDate: string, endDate: string, subDashaPeriods: DashaPeriod[] }`. Build the tree by walking each Mahadasha and nesting matching Bhukti rows, then Antara within each Bhukti, etc. — based on the lord-chain prefix in the period label.
  - At the top level of `chartData`, emit only `nakshatra`, `nakshatraPada`, `tithi`, `planetaryPositions`, `cuspalPositions`, `dashas`. Drop `nativeInfo`, `chartSettings`, and all non-listed fields.
- The success path emits exactly one JSON document on stdout. On failure, exit code 1 with a single human-readable error line on stderr.

The `--insert --mongo-uri` direct-DB path stays in the script for local CLI use but is never invoked by the backend.

### 2. Backend — `ChartData` model

Create `backend/src/models/ChartData.ts` (full content shown above). Update `backend/src/models/Horoscope.ts` to add the optional `chartData?: ChartData` field, ordered before `createdAt`/`updatedAt`.

### 3. Backend — Subprocess helper

Create `backend/src/lib/horoscopeParser.ts`:

```ts
import { execFile } from 'child_process';
import { promisify } from 'util';
import config from '../config/config';
import { internalServerError, badRequest } from '../errors';
import logger from './logger';
import ChartData from '../models/ChartData';

const execFileAsync = promisify(execFile);

import Horoscope from '../models/Horoscope';
import ChartData from '../models/ChartData';

export type ParsedHoroscope = Pick<Horoscope, 'name' | 'timezone' | 'location'> & {
  birthDate: string; // YYYY-MM-DD — split from birthTime (pre-save)
  birthTimeOfDay: string; // HH:MM (24h) — split from birthTime (pre-save)
  chartData: ChartData;
};

export const parseHoroscopePdf = async (pdfPath: string): Promise<ParsedHoroscope> => {
  try {
    const { stdout } = await execFileAsync(
      config.parserPythonPath,
      [config.parserScriptPath, pdfPath],
      { timeout: config.parsePdfTimeoutMs, maxBuffer: 20 * 1024 * 1024 }
    );
    return JSON.parse(stdout) as ParsedHoroscope;
  } catch (err) {
    const e = err as { code?: number; stderr?: string; signal?: string; message?: string };
    logger.error({ err: e }, 'PDF parse failed');
    if (e.signal === 'SIGTERM') throw badRequest('PDF parse timed out');
    if (e.code === 1)
      throw badRequest(`PDF parse failed: ${(e.stderr ?? '').trim().slice(0, 200)}`);
    throw internalServerError('PDF parse failed');
  }
};
```

- **`execFile`, not `exec`** — no shell, no metacharacter risk on the path argument.
- **`badRequest` (not `internalServerError`) on exit-1** — root cause is almost always a malformed/un-OCR-able user-supplied PDF. That's a 400.
- **`SIGTERM`** is what Node sends when `timeout` expires.
- **20MB `maxBuffer`** — a parsed JSON for one chart is ~30KB; 20MB is a generous safety margin.

### 4. Backend — Config additions

Extend `backend/src/config/config.ts`:

```ts
import { resolve } from 'path';

// __dirname → backend/src/config (dev) or backend/dist/config (prod). Both go up three to repo root.
const repoRoot = resolve(__dirname, '../../..');

const config = {
  // ... existing fields
  parserPythonPath: process.env.PARSER_PYTHON_PATH ?? resolve(repoRoot, 'parser/.venv/bin/python'),
  parserScriptPath:
    process.env.PARSER_SCRIPT_PATH ?? resolve(repoRoot, 'parser/horoscope_parser.py'),
  parsePdfTimeoutMs: parseInt(process.env.PARSE_PDF_TIMEOUT_MS ?? '60000', 10),
  parsePdfMaxFileSize: parseInt(process.env.PARSE_PDF_MAX_FILE_SIZE ?? `${10 * 1024 * 1024}`, 10),
};

export default config;
```

Env-var overrides matter for prod where the venv may live elsewhere.

### 5. Backend — Endpoint types

**Multipart endpoints have no `Body` type.** The `typescript-json-schema` generator targets `Body`/`Data` suffixed types. Since `req.body` is `{}` after multer (the file is in `req.file`), creating a `ParsePdfBody` type would generate a useless schema. Only the response gets a typed alias.

Create `backend/src/types/horoscope/ParseHoroscopePdfResponse.ts`:

```ts
import ActionResponse from '../ActionResponse';
import { ParsedHoroscope } from '../lib/horoscopeParser';

export type ParseHoroscopePdfData = {
  parsed: ParsedHoroscope;
};

type ParseHoroscopePdfResponse = ActionResponse<ParseHoroscopePdfData>;

export default ParseHoroscopePdfResponse;
```

Extend `CreateHoroscopeRequest.ts` (and `UpdateHoroscopeRequest.ts` identically) with optional `chartData`:

```ts
import RequestType from '../RequestType';
import ChartData from '../../models/ChartData';
import Horoscope from '../../models/Horoscope';

export type CreateHoroscopeBody = Pick<
  Horoscope,
  'name' | 'timezone' | 'location' | 'chartData'
> & {
  /** @format date-time */
  birthTime: string; // ISO string — coerced to Date before persistence
};

type CreateHoroscopeRequest = RequestType<CreateHoroscopeBody>;
export default CreateHoroscopeRequest;
```

**Constraint to flag.** `noExtraProps: true` on request schemas means clients sending arbitrary extra keys inside `chartData` will be rejected with "should NOT have additional properties". The `ChartData` type must stay exhaustive — if the parser adds a new field, the type must update in the same PR. This is the right tradeoff (catches drift early) but the failure mode needs to be in the runbook.

### 6. Backend — Dependencies

```bash
cd backend
npm install multer@^2
npm install --save-dev @types/multer
```

**Pin to `multer@^2`.** The repo runs Express 5.2.1. Multer 1.x is built for Express 4 and has known compatibility issues on Express 5. Multer 2.x is the supported line.

### 7. Backend — Routes wiring

Extend `backend/src/routes/horoscopeRoutes.ts`. Order matters: `router.use(authMiddleware)` runs first → unauthenticated requests are rejected before multer ever writes a file. Add a router-level error middleware to map `MulterError` and `fileFilter` errors to `AppError`-shaped 400 responses.

```ts
import multer, { MulterError } from 'multer';
import os from 'os';
import { randomUUID } from 'crypto';
import path from 'path';
import { promises as fs } from 'fs';
import config from '../config/config';
import { ParseHoroscopePdfData } from '../types/horoscope/ParseHoroscopePdfResponse';
import { parseHoroscopePdfDataSchema } from '../schemas/generated';
import { ErrorCodes, badRequest } from '../errors';

const validateParsePdfData = compileResponseValidator<ParseHoroscopePdfData>(
  parseHoroscopePdfDataSchema
);

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}-${path.basename(file.originalname)}`),
  }),
  limits: { fileSize: config.parsePdfMaxFileSize, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files are accepted'));
      return;
    }
    cb(null, true);
  },
});

// ... inside makeHoroscopeRouter, after router.use(authMiddleware):
router.post(
  '/parse-pdf',
  upload.single('pdf'),
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      res.status(400).json({
        error: { code: ErrorCodes.BadRequest, message: 'Missing file under field name "pdf"' },
      });
      return;
    }
    try {
      const result = await controller.parsePdf({ filePath: req.file.path });
      if (result.data !== undefined) validateParsePdfData(JSON.parse(JSON.stringify(result.data)));
      res.status(result.status).json({ data: result.data });
    } catch (err) {
      if (isAppError(err)) {
        res.status(err.status).json({ error: { code: err.code, message: err.message } });
      } else {
        next(err);
      }
    } finally {
      if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
    }
  }
);

// Router-level error middleware AFTER all routes
router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : err.message;
    res.status(400).json({ error: { code: ErrorCodes.BadRequest, message } });
    return;
  }
  if (err instanceof Error && err.message === 'Only PDF files are accepted') {
    res.status(400).json({ error: { code: ErrorCodes.BadRequest, message: err.message } });
    return;
  }
  next(err);
});
```

The `try/finally` guarantees tmp-file cleanup whether parse succeeds, throws, or AJV validation fails. `.catch(() => {})` swallows ENOENT (defensive — shouldn't normally happen).

### 8. Backend — Controller method

Add `parsePdf` to the existing `HoroscopeController` (one extra method doesn't justify a sibling controller):

```ts
import { parseHoroscopePdf } from '../lib/horoscopeParser';
import ParseHoroscopePdfResponse from '../types/horoscope/ParseHoroscopePdfResponse';

// inside HoroscopeController:
async parsePdf(
  { filePath }: { filePath: string },
): Promise<ParseHoroscopePdfResponse> {
  const parsed = await parseHoroscopePdf(filePath);
  return { status: 200, data: { parsed } };
}
```

No `authUser` parameter — the endpoint doesn't use it. The route call passes only `{ filePath: req.file.path }`. The argument shape is intentionally **not** a `RequestType<Body>` — multipart endpoints have no JSON body — so we use a plain inline object type. Document this divergence in DECISIONS.md.

### 9. Backend — Repo + controller create/update extension

Update `HoroscopeRepo.create` and `HoroscopeRepo.update` to accept an optional `chartData?: ChartData` argument (positional flat args per existing convention):

```ts
async create(
  ownerId: string,
  name: string,
  birthTime: Date,
  timezone: string,
  latitude: number,
  longitude: number,
  locationLabel: string,
  chartData?: ChartData,
): Promise<Horoscope> {
  const now = new Date();
  const horoscope: Horoscope = {
    id: crypto.randomUUID(),
    owner: { id: ownerId },
    name,
    birthTime,
    timezone,
    location: { latitude, longitude, label: locationLabel },
    ...(chartData ? { chartData } : {}),
    createdAt: now,
    updatedAt: now,
  };
  await this.db.collection<Horoscope>(COLLECTION).insertOne(horoscope);
  return horoscope;
}
```

Conditional spread keeps `chartData` absent (not `undefined`/`null`) on docs created without it, so manual horoscopes don't get an empty slot.

For `update`: only include `chartData` in `$set` when present; otherwise leave existing chartData untouched. (Clearing chartData via PUT is a follow-up if needed.)

`HoroscopeController.create` / `update` thread `body.chartData` through:

```ts
const { name, birthTime, timezone, location, chartData } = body;
const horoscope = await this.horoscopeRepo.create(
  authUser.id,
  name,
  new Date(birthTime),
  timezone,
  location.latitude,
  location.longitude,
  location.label,
  chartData
);
```

### 10. Backend — `index.ts`

No new wiring beyond what's already there. The new route is registered inside `makeHoroscopeRouter` (same router, new path); the new controller method lives on the existing `HoroscopeController`. `parseHoroscopePdf` is imported directly into the controller — no additional injection.

### 11. Frontend — `apiFetchClient` FormData support

Update `frontend/src/lib/apiFetchClient.ts` to detect `FormData` bodies and skip the JSON content-type:

```ts
const apiFetchClient = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const session = await getSession();
  if (!session?.idToken) throw forbidden('Not authenticated');

  const isFormData = init.body instanceof FormData;
  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${session.idToken}`,
  };
  if (!isFormData) baseHeaders['Content-Type'] = 'application/json';

  const res = await fetch(`${config.backendUrl}${path}`, {
    ...init,
    headers: { ...baseHeaders, ...(init.headers ?? {}) },
  });
  // ... rest unchanged
};
```

**Critical.** When the body is `FormData`, the browser sets `Content-Type: multipart/form-data; boundary=...` automatically. If we set `application/json` ourselves, the boundary is missing and the server cannot parse the upload. Strip our header; let the browser do it.

The server-side `apiFetch.ts` does not need this change — server components don't upload binary user data.

### 12. Frontend — Type mirror

Extend `frontend/src/app/horoscopes/types.ts`:

```ts
export type Planet = {
  id: number;
  name: string;
  code: string;
};

export type Sign = {
  id: number;
  name: string;
  load: Planet;
};

export type House = {
  id: number;
};

export type Nakshatra = {
  id: number;
  name: string;
  load: Planet;
};

export type Degrees = {
  d: number;
  m: number;
  s: number;
};

export type PlanetaryPosition = {
  planet: Planet;
  degrees: Degrees;
  house: House;
  sign: Sign;
  starLoad: Planet;
  subLoad: Planet;
  subSubLoad: Planet;
  direct: boolean;
};

export type CuspalPosition = {
  id: number;
  sign: Sign;
  degrees: Degrees;
  starLoad: Planet;
  subLoad: Planet;
  subSubLoad: Planet;
};

export type DashaPeriod = {
  lord: Planet;
  startDate: string;
  endDate: string;
  subDashaPeriods: DashaPeriod[];
};

export type ChartData = {
  nakshatra: Nakshatra;
  nakshatraPada: number;
  tithi: {
    paksha: string;
    id: number;
  };
  planetaryPositions: PlanetaryPosition[];
  cuspalPositions: CuspalPosition[];
  dashas: DashaPeriod[];
};

export type Horoscope = {
  id: string;
  owner: { id: string };
  name: string;
  birthTime: string;
  timezone: string;
  location: {
    latitude: number;
    longitude: number;
    label: string;
  };
  chartData?: ChartData; // <— new, optional
  createdAt: string;
  updatedAt: string;
};

export type ParsedHoroscope = Pick<Horoscope, 'name' | 'timezone' | 'location' | 'chartData'> & {
  birthDate: string; // YYYY-MM-DD — split from birthTime (pre-save)
  birthTimeOfDay: string; // HH:MM — split from birthTime (pre-save)
};
```

### 13. Frontend — sessionStorage handoff

Create `frontend/src/app/horoscopes/import/importStorage.ts`:

```ts
import { ParsedHoroscope } from '../types';

const KEY = 'kendara:horoscopes:import:parsed';

export const setParsedImport = (parsed: ParsedHoroscope) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(parsed));
  } catch {}
};

export const getParsedImport = (): ParsedHoroscope | null => {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ParsedHoroscope) : null;
  } catch {
    return null;
  }
};

export const clearParsedImport = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
};
```

**Constraint to flag.** `sessionStorage` survives page refresh within the same tab but is lost on tab close. A typical chartData payload is ~10–30KB — well under the 5MB-per-origin browser limit. The review page must guard against missing storage (redirect to `/horoscopes`).

### 14. Frontend — `+ Import PDF` button on the list page

Update `frontend/src/app/horoscopes/HoroscopeListClient.tsx`. Add a hidden file input and a sibling button.

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { setParsedImport } from './import/importStorage';
import { ParsedHoroscope } from './types';

const HoroscopeListClient = ({ initial }: Props) => {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [importing, setImporting] = React.useState(false);
  // ... existing state

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so re-selecting same file fires onChange
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast('Please select a PDF file', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('PDF must be under 10MB', 'error');
      return;
    }

    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('pdf', file);
      const data = await apiFetchClient<{ parsed: ParsedHoroscope }>('/api/horoscopes/parse-pdf', {
        method: 'POST',
        body: fd,
      });
      setParsedImport(data.parsed);
      router.push('/horoscopes/import/review');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import PDF';
      toast(message, 'error');
    } finally {
      setImporting(false);
    }
  };

  // header alongside "+ New":
  // <Button variant="outline" onClick={handleImportClick} disabled={importing}>
  //   {importing ? 'Importing…' : '+ Import PDF'}
  // </Button>
  // <Button onClick={() => setCreateOpen(true)}>+ New</Button>
  // <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileSelected} />
};
```

Resetting `e.target.value = ''` immediately is critical — without it, selecting the same filename twice doesn't fire `onChange`.

### 15. Frontend — `/horoscopes/import/review` route

Create `frontend/src/app/horoscopes/import/review/page.tsx` (`'use client'`). Reads `sessionStorage` on mount; redirects to `/horoscopes` if empty. Editable fields use the same components as the create dialog (`DateInput`, `TimeInput`, `Combobox` for timezone, `Input` for location label + lat/lon). Rich data (planetary positions with sign/lord chains, cuspal positions, dashas) renders read-only in compact tables.

```tsx
'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import apiFetchClient from '@/lib/apiFetchClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import { TimeInput } from '@/components/ui/time-input';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { useToast } from '@/components/ui/toast';
import { ParsedHoroscope, DashaPeriod, PlanetaryPosition, CuspalPosition } from '../../types';
import { getParsedImport, clearParsedImport } from '../importStorage';

const timezones = Intl.supportedValuesOf('timeZone');

const DashaList = ({ periods }: { periods: DashaPeriod[] }) => (
  <ul className="ml-4 list-disc text-xs">
    {periods.map((p, i) => (
      <li key={`${p.lord.code}-${i}`}>
        <span>
          {p.lord.code} — {p.startDate} → {p.endDate}
        </span>
        {p.subDashaPeriods.length ? <DashaList periods={p.subDashaPeriods} /> : null}
      </li>
    ))}
  </ul>
);

const ImportReviewPage = () => {
  const router = useRouter();
  const { toast } = useToast();
  const [parsed, setParsed] = React.useState<ParsedHoroscope | null>(null);
  const [name, setName] = React.useState('');
  const [birthDate, setBirthDate] = React.useState('');
  const [birthTimeOfDay, setBirthTimeOfDay] = React.useState('');
  const [timezone, setTimezone] = React.useState('');
  const [location, setLocation] = React.useState({ latitude: 0, longitude: 0, label: '' });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const data = getParsedImport();
    if (!data) {
      router.replace('/horoscopes');
      return;
    }
    setParsed(data);
    setName(data.name);
    setBirthDate(data.birthDate);
    setBirthTimeOfDay(data.birthTimeOfDay);
    setTimezone(data.timezone);
    setLocation(data.location);
  }, [router]);

  const handleCancel = () => {
    clearParsedImport();
    router.push('/horoscopes');
  };

  const handleSave = async () => {
    if (!parsed) return;
    setSaving(true);
    try {
      const body = {
        name,
        birthTime: new Date(`${birthDate}T${birthTimeOfDay}:00`).toISOString(),
        timezone,
        location,
        chartData: parsed.chartData,
      };
      await apiFetchClient('/api/horoscopes', { method: 'POST', body: JSON.stringify(body) });
      clearParsedImport();
      toast('Horoscope imported');
      router.push('/horoscopes');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!parsed) return null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">Review imported horoscope</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        OCR may have errors. Edit the basic fields below before saving. Rich chart data is read-only
        this iteration — re-import or edit MongoDB directly if a value is wrong.
      </p>

      {/* Editable basic fields (same components as HoroscopeFormDialog) */}
      {/* ... see HoroscopeFormDialog for field structure */}

      {/* Read-only Planetary Positions table */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Planetary Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th>Planet</th>
                <th>Sign</th>
                <th>Degrees</th>
                <th>House</th>
                <th>STL</th>
                <th>SL</th>
                <th>SSL</th>
                <th>D/R</th>
              </tr>
            </thead>
            <tbody>
              {parsed.chartData.planetaryPositions.map((p) => (
                <tr key={p.planet.id}>
                  <td>{p.planet.code}</td>
                  <td>{p.sign.name}</td>
                  <td>
                    {p.degrees.d}°{p.degrees.m}'{p.degrees.s}"
                  </td>
                  <td>{p.house.id}</td>
                  <td>{p.starLoad.code}</td>
                  <td>{p.subLoad.code}</td>
                  <td>{p.subSubLoad.code}</td>
                  <td>{p.direct ? 'D' : 'R'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Read-only Cuspal Positions table */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Cuspal Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th>House</th>
                <th>Sign</th>
                <th>Degrees</th>
                <th>STL</th>
                <th>SL</th>
                <th>SSL</th>
              </tr>
            </thead>
            <tbody>
              {parsed.chartData.cuspalPositions.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.sign.name}</td>
                  <td>
                    {c.degrees.d}°{c.degrees.m}'{c.degrees.s}"
                  </td>
                  <td>{c.starLoad.code}</td>
                  <td>{c.subLoad.code}</td>
                  <td>{c.subSubLoad.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Read-only Dashas (recursive) */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Dashas</CardTitle>
        </CardHeader>
        <CardContent>
          <DashaList periods={parsed.chartData.dashas} />
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={handleCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !name || !birthDate || !birthTimeOfDay || !timezone}
        >
          {saving ? 'Saving…' : 'Save horoscope'}
        </Button>
      </div>
    </div>
  );
};

export default ImportReviewPage;
```

Notes:

- Client component because of `sessionStorage`.
- `router.replace` (not `push`) on missing storage avoids polluting history.
- Save button validates non-empty basic fields locally; AJV on the server is the source of truth for shape validation.
- Future polish: extract the editable fields into a shared `HoroscopeBasicFieldsForm` component reused by both `HoroscopeFormDialog` and this review page. Out of scope for this iteration to keep the diff small.

### 16. Frontend — Route protection (`proxy.ts`)

The current matcher is `['/dashboard/:path*', '/horoscopes/:path*', '/login']`. `/horoscopes/import/review` is already covered by `/horoscopes/:path*`. **No change needed.**

### 17. DECISIONS.md additions

Append three sections.

#### Polyglot subprocess invocation (Python from Node)

- All Python invocations go through a single helper in `backend/src/lib/<feature>Parser.ts`. The helper uses `child_process.execFile` (never `exec` — no shell, no metacharacter risk) wrapped via `util.promisify`.
- Python paths come from `config` (`parserPythonPath`, `parserScriptPath`) — never hardcoded. Defaults resolve relative to repo root via `path.resolve(__dirname, '../../..', 'parser/...')`. Override via env vars in production.
- A timeout (`config.parsePdfTimeoutMs`) and `maxBuffer` are required on every subprocess call.
- The Python script's stdout is reserved for a single JSON document on success. Progress and diagnostic prints go to stderr. Non-zero exit codes signal parse failure; the helper maps them to `badRequest` (user-supplied data is the cause).
- The caller is responsible for tmp-file cleanup. Use `try/finally` with `fs.unlink(...).catch(() => {})`.

#### Multipart upload pattern

- Multer 2.x is the supported version (Express 5 compatibility). Pin `multer@^2`.
- Disk storage in `os.tmpdir()` with `randomUUID()` filenames. File-size and file-count limits configured via `config`. `fileFilter` rejects non-PDF mimetypes before the file lands on disk.
- Auth middleware MUST run before multer. With `router.use(authMiddleware)` followed by `router.post('/parse-pdf', upload.single('pdf'), handler)`, Express runs auth first; an unauthenticated request returns 403 without ever invoking multer's disk write.
- Multer errors (`MulterError`, including `LIMIT_FILE_SIZE`) and `fileFilter` errors are not `AppError`s. Handle them in a router-level error middleware that maps them to `{ error: { code: ErrorCodes.BadRequest, message } }`.
- Multipart endpoints have **no `Body` type** — there is no JSON body for the schema generator to target. Only the `Data` response type is generated. The route handler skips body validation. The controller method takes a plain inline object type (`{ filePath: string }`), not `RequestType<Body>`.

#### Two-step import flow

- An import endpoint that does heavy work (parse, OCR, transform) MUST NOT also perform the persistent write. It returns the extracted/derived data; the FE displays it for review and confirmation; the existing create endpoint persists.
- FE buffers the parse result in `sessionStorage` (key prefixed `kendara:`) for the cross-page handoff. The review page is a client component; it `router.replace`s away if storage is empty.
- The persistent write extends the existing create endpoint with optional fields (`chartData?` here) — never a new `POST /api/horoscopes/import-save` shadow endpoint. One canonical write path.

## Critical Files

| File                                                       | Action                                                                                                                             |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `parser/horoscope_parser.py`                               | Create — prototype with stderr-only progress prints; emits `birthDate` + `birthTimeOfDay` separately; strips `_rawOcr` from output |
| `parser/requirements.txt`                                  | Create — pdf2image, pytesseract, Pillow                                                                                            |
| `parser/README.md`                                         | Create — venv + system-deps setup                                                                                                  |
| `parser/.gitignore`                                        | Create — `.venv/`, `__pycache__/`                                                                                                  |
| `backend/src/models/ChartData.ts`                          | Create — full ChartData type                                                                                                       |
| `backend/src/models/Horoscope.ts`                          | Add `chartData?: ChartData`                                                                                                        |
| `backend/src/lib/horoscopeParser.ts`                       | Create — execFile subprocess helper, badRequest on parse failure                                                                   |
| `backend/src/config/config.ts`                             | Add `parserPythonPath`, `parserScriptPath`, `parsePdfTimeoutMs`, `parsePdfMaxFileSize`                                             |
| `backend/src/types/horoscope/ParseHoroscopePdfResponse.ts` | Create — `ParseHoroscopePdfData` (no `Body` type for multipart)                                                                    |
| `backend/src/types/horoscope/CreateHoroscopeRequest.ts`    | Add optional `chartData?: ChartData` to `CreateHoroscopeBody`                                                                      |
| `backend/src/types/horoscope/UpdateHoroscopeRequest.ts`    | Add optional `chartData?: ChartData` to `UpdateHoroscopeBody`                                                                      |
| `backend/src/repos/HoroscopeRepo.ts`                       | Extend `create` and `update` with optional `chartData?: ChartData`                                                                 |
| `backend/src/controllers/HoroscopeController.ts`           | Add `parsePdf` method; thread `chartData` through `create`/`update`                                                                |
| `backend/src/routes/horoscopeRoutes.ts`                    | Add `POST /parse-pdf` route with multer; add MulterError handler                                                                   |
| `backend/package.json`                                     | Add `multer@^2` (runtime), `@types/multer` (dev)                                                                                   |
| `frontend/src/lib/apiFetchClient.ts`                       | Skip `Content-Type` when body is `FormData`                                                                                        |
| `frontend/src/app/horoscopes/types.ts`                     | Add `ChartData`, `ParsedHoroscope`, `chartData?` on `Horoscope`                                                                    |
| `frontend/src/app/horoscopes/import/importStorage.ts`      | Create — `setParsedImport`, `getParsedImport`, `clearParsedImport`                                                                 |
| `frontend/src/app/horoscopes/import/review/page.tsx`       | Create — review screen with editable basic fields and read-only rich data                                                          |
| `frontend/src/app/horoscopes/HoroscopeListClient.tsx`      | Add `+ Import PDF` button, hidden file input, multipart upload handler                                                             |
| `DECISIONS.md`                                             | Append: subprocess pattern, multipart pattern, two-step import flow                                                                |

## Verification

1. **Parser standalone:** `cd parser && python -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/python horoscope_parser.py path/to/sample.pdf | jq .` returns valid JSON with `name`, `birthDate` (YYYY-MM-DD), `birthTimeOfDay` (HH:MM), `timezone`, `location.{latitude,longitude,label}`, and `chartData` with all sub-objects populated.
2. **Stderr discipline:** the same command with `2>/dev/null` still produces valid JSON (no diagnostic prints on stdout).
3. **Backend boot:** `cd backend && npm install && npm run dev` — schemas regenerate (look for `parseHoroscopePdfDataSchema`), server starts on :4000.
4. **Frontend boot:** `cd frontend && npm run dev` — :3000 starts cleanly.
5. **End-to-end happy path:** sign in → `/horoscopes` → click `+ Import PDF` → pick sample PDF → spinner → land on `/horoscopes/import/review` with name, birth date, birth time, timezone, location pre-filled and a planetary-positions table showing 9 rows.
6. **Edit + save:** change the name, click Save → toast "Horoscope imported" → list page shows the new entry.
7. **Mongo verify:** `mongosh kendara --eval 'db.horoscopes.findOne({}, {chartData:1, name:1})'` — `chartData.planetaryPositions.length === 9` (each item has `planet.{id,name,code}`, `sign.{id,name,load}`, numeric `degrees.{d,m,s}`, `house.{id}`, `starLoad/subLoad/subSubLoad` as Planet objects, boolean `direct`); `chartData.cuspalPositions.length === 12` (each has numeric `id`, `sign.{id,name,load}`, numeric `degrees.{d,m,s}`, lord objects); `chartData.dashas.length > 0` (each `lord` is a Planet object with `{id,name,code}`, at least one item has nested `subDashaPeriods`); `chartData.nakshatra` is a full `{id,name,load}` object; `chartData.nakshatraPada` is 1–4; `chartData.tithi` has `{paksha,id}`.
8. **Manual create still works:** `+ New` flow saves a horoscope with `chartData` absent (not `null`) — `db.horoscopes.findOne({chartData: {$exists: false}})` returns the manually-created doc.
9. **Cancel:** import a PDF, land on review page, click Cancel → returns to list, sessionStorage cleared (DevTools → Application → Storage).
10. **Refresh on review page:** navigate to `/horoscopes/import/review` directly with no buffered data → redirected to `/horoscopes`.
11. **Auth required:** `curl -i -X POST http://localhost:4000/api/horoscopes/parse-pdf -F pdf=@sample.pdf` (no token) → 403 with `{ error: { code: 'FORBIDDEN', message: 'Missing bearer token' } }`. No file should be written to `/tmp` (multer never runs).
12. **Wrong mimetype:** upload a `.txt` file → 400 "Only PDF files are accepted".
13. **File too large:** `dd if=/dev/urandom of=big.pdf bs=1M count=12` then upload → 400 "File too large".
14. **Unparseable PDF:** upload a blank PDF → 400 with stderr message in the toast.
15. **Tmp cleanup:** before and after a successful parse, `ls /tmp/*-*.pdf | wc -l` returns the same count (upload temp file is unlinked).
16. **Timeout:** temporarily set `PARSE_PDF_TIMEOUT_MS=100` and re-import → 400 "PDF parse timed out".

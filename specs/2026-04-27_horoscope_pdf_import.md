# Spec — 2026-04-27 Horoscope PDF import

## Context

Builds on the Horoscope CRUD shipped in `2026-04-26_horoscope_crud.md`. Today users only create horoscopes by typing every field into the dialog form. Most of that data already exists in the chart PDFs astrologers generate from desktop tools — re-typing it is tedious and error-prone. We want to bootstrap a horoscope from an uploaded PDF so the user only edits and confirms.

The OCR + parse pipeline has already been prototyped as a Python script (`pdf2image` + Tesseract + regex extractors). Stack is fully free and offline.

## Goal

A signed-in user can click "+ Import PDF" on `/horoscopes`, pick a chart PDF, see a review screen with the extracted fields pre-filled, edit any basic field, and save — landing back on the list with the new horoscope persisted alongside its rich chart data.

## Backend changes

- New sibling workspace `parser/` at the repo root (Python script + venv + requirements). Backend invokes it via `child_process.execFile` per request.
- Extend the `Horoscope` model with an optional `chartData?: ChartData` field — manual horoscopes leave it undefined.
- Introduce `ChartData` model:
  ```ts
  interface Planet {
    name: string;
    sign: string;
  }
  interface PlanetaryPosition {
    planet: Planet;
    degree: number;
    house: number;
  }
  interface House {
    number: number;
    sign: string;
  }
  interface CuspalPosition {
    house: House;
    degrees: string;
  }
  interface DashaPeriod {
    lord: string;
    startDate: string;
    endDate: string;
    subDashaPeriods?: DashaPeriod[];
  }
  interface ChartData {
    nakshatra?: string;
    tithi?: string;
    planetaryPositions: PlanetaryPosition[];
    cuspalPositions: CuspalPosition[];
    dashas: DashaPeriod[];
  }
  ```
- New endpoint `POST /api/horoscopes/parse-pdf` (multipart/form-data, field `pdf`):
  - Auth-protected (Google ID-token middleware runs before multer).
  - PDF-only mimetype filter; 10MB max file size.
  - Returns the extracted JSON; does **not** persist anything.
  - Cleans up the tmp file in a `try/finally`.
- Extend `POST /api/horoscopes` and `PUT /api/horoscopes/:id` request bodies with optional `chartData?` so the review-screen save uses the existing canonical write path.
- New deps: `multer@^2` (Express 5 compatible) + `@types/multer`.

## Frontend changes

- Add a `+ Import PDF` button next to `+ New` on `/horoscopes` → hidden file input → upload via multipart → store the parsed result in `sessionStorage` → navigate to a new review route.
- New route `/horoscopes/import/review` — client component. Reads the buffered parse result, redirects back to `/horoscopes` if missing.
- Editable basic fields (name, birth date, birth time, timezone, location) reuse the same components as `HoroscopeFormDialog`.
- Read-only display of rich chart data: planetary positions table (Planet/Sign/Degree/House), cuspal positions table (House/Sign/Degrees), recursive dasha tree.
- On Save → POST `/api/horoscopes` with the basic fields + `chartData` → land on `/horoscopes`.
- Extend `apiFetchClient` to detect `FormData` bodies and skip the JSON `Content-Type` header (so the browser sets the boundary correctly).

## Acceptance criteria

- Signed-in user can import a chart PDF in under ~5 seconds (excluding OCR cold start) and review the extracted data before saving.
- The saved horoscope appears in the list with its `chartData` populated in MongoDB.
- Manual horoscope creation still works unchanged; manual records have `chartData` absent (not `null`).
- Unauthenticated upload attempts return 403 without writing anything to disk.
- Non-PDF uploads, oversized files, and unparseable PDFs surface a clean error toast.
- Tmp files in `os.tmpdir()` are cleaned up after every parse, success or failure.

## Out of scope

- Editing rich `chartData` fields (planets, cusps, dashas) from the UI — read-only this iteration. OCR mis-reads on numeric fields require re-import or direct MongoDB edits.
- Persisting the raw OCR text on horoscope documents.
- Async/queued parser, streaming progress, or a long-running Python service.
- Re-importing into an existing horoscope — always creates a new one.
- Native-info and chart-settings fields the parser extracts but we don't persist (place, dayOfWeek, longitude/latitude strings, lord chains, retrograde flag, ayanamsa, house system, etc.). Out of scope until a downstream feature needs them.

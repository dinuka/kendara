#!/usr/bin/env python3
"""
Horoscope PDF → Structured JSON for Kendara Backend
====================================================
Stack (all free, all offline):
  - pdf2image  : render PDF pages to PIL images
  - pytesseract: Tesseract 5 OCR binding
  - re / rules : deterministic structured extraction (no LM needed)

Install:
  pip install pdf2image pytesseract pillow
  sudo apt install tesseract-ocr poppler-utils   # Ubuntu/Debian
  brew install tesseract poppler                  # macOS

Usage:
  python horoscope_parser.py chart.pdf            # print JSON to stdout
  python horoscope_parser.py chart.pdf --insert   # insert into MongoDB (local CLI only)

Backend contract:
  - stdout: single JSON document (no extra text)
  - stderr: progress/diagnostics only
  - exit 0: success; exit 1: failure (error message on stderr)
  - No _rawOcr in output
"""

import sys
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from pdf2image import convert_from_path
import pytesseract

# ─────────────────────────────────────────────
#  Planet / Sign / Nakshatra lookup tables
# ─────────────────────────────────────────────
PLANET_IDS = {
    "Sun": 1, "Moon": 2, "Mars": 3, "Mercury": 4,
    "Jupiter": 5, "Venus": 6, "Saturn": 7, "Rahu": 8, "Kethu": 9,
}
PLANET_CODES = {
    "Sun": "Su", "Moon": "Mo", "Mars": "Ma", "Mercury": "Me",
    "Jupiter": "Ju", "Venus": "Ve", "Saturn": "Sa", "Rahu": "Ra", "Kethu": "Ke",
}
PLANET_NORM = {"Ketu": "Kethu"}

SIGNS_ABBR = {"Ari", "Tau", "Gem", "Can", "Leo", "Vir", "Lib", "Sco", "Sag", "Cap", "Aqu", "Pis"}
SIGN_FULL = {
    "Ari": "Aries", "Tau": "Taurus", "Gem": "Gemini", "Can": "Cancer",
    "Leo": "Leo", "Vir": "Virgo", "Lib": "Libra", "Sco": "Scorpio",
    "Sag": "Sagittarius", "Cap": "Capricorn", "Aqu": "Aquarius", "Pis": "Pisces",
}
SIGN_IDS = {
    "Ari": 1, "Tau": 2, "Gem": 3, "Can": 4, "Leo": 5, "Vir": 6,
    "Lib": 7, "Sco": 8, "Sag": 9, "Cap": 10, "Aqu": 11, "Pis": 12,
}
SIGN_LORDS = {
    "Ari": "Mars", "Tau": "Venus", "Gem": "Mercury", "Can": "Moon",
    "Leo": "Sun", "Vir": "Mercury", "Lib": "Venus", "Sco": "Mars",
    "Sag": "Jupiter", "Cap": "Saturn", "Aqu": "Saturn", "Pis": "Jupiter",
}

NAKSHATRA_LIST = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashirsha", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "PurvaPhalguni", "UttaraPhalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "PurvaShadha", "UttaraShadha", "Shravana", "Dhanishta",
    "Shatabhisha", "PurvaBhadrapada", "UttaraBhadrapada", "Revati",
]
NAKSHATRA_LORDS = {
    "Ashwini": "Kethu", "Bharani": "Venus", "Krittika": "Sun",
    "Rohini": "Moon", "Mrigashirsha": "Mars", "Ardra": "Rahu",
    "Punarvasu": "Jupiter", "Pushya": "Saturn", "Ashlesha": "Mercury",
    "Magha": "Kethu", "PurvaPhalguni": "Venus", "UttaraPhalguni": "Sun",
    "Hasta": "Moon", "Chitra": "Mars", "Swati": "Rahu",
    "Vishakha": "Jupiter", "Anuradha": "Saturn", "Jyeshtha": "Mercury",
    "Mula": "Kethu", "PurvaShadha": "Venus", "UttaraShadha": "Sun",
    "Shravana": "Moon", "Dhanishta": "Mars", "Shatabhisha": "Rahu",
    "PurvaBhadrapada": "Jupiter", "UttaraBhadrapada": "Saturn", "Revati": "Mercury",
}
NAKSHATRA_IDS = {name: i + 1 for i, name in enumerate(NAKSHATRA_LIST)}

NAKSHATRA_ALIASES = {
    "shravishtha": "Dhanishta",
    "shravishta":  "Dhanishta",
    "shravishti":  "Dhanishta",
    "dhanista":    "Dhanishta",
    "chitta":      "Chitra",
    "ashwathi":    "Ashwini",
    "ashvini":     "Ashwini",
    "pooram":      "PurvaPhalguni",
    "poorva":      "PurvaPhalguni",
    "uttaram":     "UttaraPhalguni",
    "uttara":      "UttaraPhalguni",
    "pooradam":    "PurvaShadha",
    "uttaradam":   "UttaraShadha",
    "thiruvonam":  "Shravana",
    "sravanam":    "Shravana",
}

TZ_LOOKUP = {
    "+5:30": "Asia/Colombo", "5:30": "Asia/Colombo", "+05:30": "Asia/Colombo",
    "IST": "Asia/Colombo", "Indian Standard Time": "Asia/Colombo",
    "+5:45": "Asia/Kathmandu", "NPT": "Asia/Kathmandu",
    "+0:00": "Etc/UTC", "GMT": "Etc/UTC", "UTC": "Etc/UTC",
    "+1:00": "Europe/London", "BST": "Europe/London",
    "-5:00": "America/New_York", "EST": "America/New_York", "EDT": "America/New_York",
    "-6:00": "America/Chicago", "CST": "America/Chicago",
    "-7:00": "America/Denver", "MST": "America/Denver",
    "-8:00": "America/Los_Angeles", "PST": "America/Los_Angeles", "PDT": "America/Los_Angeles",
    "+8:00": "Asia/Singapore", "SGT": "Asia/Singapore",
    "+9:00": "Asia/Tokyo", "JST": "Asia/Tokyo",
    "+10:00": "Australia/Sydney", "AEST": "Australia/Sydney",
}

TITHI_PAKSHA = {
    1: "Shukla", 2: "Shukla", 3: "Shukla", 4: "Shukla", 5: "Shukla",
    6: "Shukla", 7: "Shukla", 8: "Shukla", 9: "Shukla", 10: "Shukla",
    11: "Shukla", 12: "Shukla", 13: "Shukla", 14: "Shukla", 15: "Shukla",
    16: "Krishna", 17: "Krishna", 18: "Krishna", 19: "Krishna", 20: "Krishna",
    21: "Krishna", 22: "Krishna", 23: "Krishna", 24: "Krishna", 25: "Krishna",
    26: "Krishna", 27: "Krishna", 28: "Krishna", 29: "Krishna", 30: "Krishna",
}

TITHI_NAMES = {
    "prathama": 1,   "pratipada": 1,
    "dwitiya": 2,    "dvitiya": 2,
    "tritiya": 3,    "thrithiya": 3,
    "chaturthi": 4,  "chathurthi": 4,
    "panchami": 5,
    "shashti": 6,    "sashti": 6,
    "saptami": 7,
    "ashtami": 8,
    "navami": 9,
    "dasami": 10,    "dashami": 10,
    "ekadashi": 11,  "ekadasi": 11,
    "dwadashi": 12,  "dwadasi": 12,
    "trayodashi": 13, "trayodasi": 13,
    "chaturdashi": 14, "chaturdasi": 14,
    "purnima": 15,   "poornima": 15,
    "amavasya": 30,  "amavasai": 30,
}

# ─────────────────────────────────────────────
#  Helper factories
# ─────────────────────────────────────────────

# Add this near the top with other lookup tables
PLANET_CODE_TO_NAME = {v: k for k, v in PLANET_CODES.items()}
# e.g. {"Su": "Sun", "Mo": "Moon", "Ma": "Mars", ...}

def _planet(name):
    # Resolve abbreviation → full name if needed
    n = PLANET_CODE_TO_NAME.get(name, name)
    n = PLANET_NORM.get(n, n)
    return {"id": PLANET_IDS[n], "name": n, "code": PLANET_CODES[n]}

def _sign(abbr):
    return {"id": SIGN_IDS[abbr], "name": SIGN_FULL[abbr], "load": _planet(SIGN_LORDS[abbr])}

def _nakshatra(name):
    return {"id": NAKSHATRA_IDS[name], "name": name, "load": _planet(NAKSHATRA_LORDS[name])}

def _house(num):
    return {"id": num}

def _degrees(dms_str):
    """Parse 'DD-MM-SS' into {d, m, s}."""
    parts = dms_str.replace("-", " ").split()
    if len(parts) == 3:
        return {"d": int(parts[0]), "m": int(parts[1]), "s": int(parts[2])}
    return {"d": 0, "m": 0, "s": 0}

def _tithi(raw):
    """Extract tithi from OCR text — handles numeric and Sanskrit names."""
    if not raw:
        return None
    raw_lower = raw.lower()

    if "krishna" in raw_lower:
        paksha = "Krishna"
    elif "shukla" in raw_lower:
        paksha = "Shukla"
    else:
        paksha = None

    m = re.search(r"\b(\d{1,2})\b", raw)
    if m:
        tid = int(m.group(1))
        return {"paksha": paksha or TITHI_PAKSHA.get(tid, "Shukla"), "number": tid}

    for name, tid in TITHI_NAMES.items():
        if name in raw_lower:
            return {"paksha": paksha or TITHI_PAKSHA.get(tid, "Shukla"), "number": tid}

    return None

def _resolve_nakshatra(raw):
    """Find a nakshatra name from OCR text, return full object."""
    if not raw:
        return None
    raw_lower = raw.lower()
    for alias, canonical in NAKSHATRA_ALIASES.items():
        if alias in raw_lower:
            return _nakshatra(canonical)
    for name in NAKSHATRA_LIST:
        if name.lower() in raw_lower:
            return _nakshatra(name)
    return None

# ─────────────────────────────────────────────
#  1. OCR
# ─────────────────────────────────────────────
def ocr_pdf(pdf_path, dpi=300):
    pages = convert_from_path(pdf_path, dpi=dpi)
    return "\n".join(pytesseract.image_to_string(p, config="--psm 6") for p in pages)

# ─────────────────────────────────────────────
#  2. Header → birthDate, birthTimeOfDay, timezone, location, name
# ─────────────────────────────────────────────
def _grab(pattern, text, group=1):
    m = re.search(pattern, text, re.IGNORECASE)
    return m.group(group).strip() if m else None

def parse_header(text):
    raw_date = _grab(r"Date\s*&\s*Day\s*:(\d{2}/\d{2}/\d{4})", text)
    birth_date = None
    if raw_date:
        try:
            birth_date = datetime.strptime(raw_date, "%d/%m/%Y").strftime("%Y-%m-%d")
        except ValueError:
            pass

    raw_time = _grab(r"\bTime\s*:(\d{1,2}:\d{2}(?::\d{2})?)", text)
    birth_time = None
    if raw_time:
        parts = raw_time.split(":")
        if len(parts) >= 2:
            birth_time = f"{int(parts[0]):02d}:{int(parts[1]):02d}"

    raw_tz = _grab(r"Time\s*Zone\s*:([\+\-\d:]+)", text)
    tz_iana = TZ_LOOKUP.get(raw_tz, "") if raw_tz else ""

    lon_lat = _grab(r"Longitude\s*&\s*Latitude\s*:([\w\-./]+)", text)
    lon = lat = None
    if lon_lat:
        parts = lon_lat.upper().split("/")
        if len(parts) == 2:
            lon, lat = parts[0].strip(), parts[1].strip()

    return {
        "name":      _grab(r"Name\s*:(.*?)(?:\n|Place)", text),
        "birthDate": birth_date,
        "birthTimeOfDay": birth_time,
        "timezone":  tz_iana,
        "longitude": lon,
        "latitude":  lat,
    }

# ─────────────────────────────────────────────
#  3. Planetary positions → ChartData shape
# ─────────────────────────────────────────────
PLANET_PAT = re.compile(
    r"(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Kethu|Ketu)"
    r"\s*[|\s]\s*([A-Z][a-z]{2})\s*[|\s().\s]*"
    r"(\d{2}[-]\d{2}[-]\d{2})\s*[|\s)(\s]*"
    r"([A-Z][a-z])\s*[|\s]*([A-Z][a-z])\s*[|\s]*([A-Z][a-z])\s*[|\s]*([A-Z][a-z])"
    r"\s*[|\s]*(\d{1,2})\s*(R)?",
    re.IGNORECASE | re.MULTILINE,
)

def parse_planetary_positions(text):
    start = text.find("PLANETARY POSITION")
    end   = text.find("CUSPAL POSITION")
    block = text[start: end if end != -1 else start + 3000] if start != -1 else text
    results, seen = [], set()
    for m in PLANET_PAT.finditer(block):
        planet_raw = m.group(1)
        planet_name = PLANET_NORM.get(planet_raw, planet_raw)
        sign = m.group(2)
        if sign not in SIGNS_ABBR or planet_name in seen:
            continue
        seen.add(planet_name)
        results.append({
            "planet":     _planet(planet_name),
            "degrees":    _degrees(m.group(3)),
            "house":      _house(int(m.group(8))),
            "sign":       _sign(sign),
            "starLoad":   _planet(m.group(5)),
            "subLoad":    _planet(m.group(6)),
            "subSubLoad": _planet(m.group(7)),
            "direct":     not bool(m.group(9)),
        })
    return results

# ─────────────────────────────────────────────
#  4. Cuspal positions → ChartData shape
# ─────────────────────────────────────────────
CUSP_ROMAN = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6,
    "VII": 7, "VIII": 8, "VIX": 9, "IX": 9, "X": 10, "XI": 11, "XII": 12,
}
CUSP_PAT = re.compile(
    r"Cusp\s*(V?I{0,3}X?I{0,3}|XI{0,2}|XII)\s+"
    r"([A-Z][a-z]{2})\s+(\d{2}-\d{2}-\d{2})\s+"
    r"([A-Z][a-z])\s+([A-Z][a-z])\s+([A-Z][a-z])\s+([A-Z][a-z])",
    re.IGNORECASE,
)

def parse_cuspal_positions(text):
    start = text.find("CUSPAL POSITION")
    if start == -1:
        return []
    block = text[start:]
    cusps, seen = [], set()
    for m in CUSP_PAT.finditer(block):
        roman = m.group(1).upper()
        num = CUSP_ROMAN.get(roman)
        sign = m.group(2)
        if num is None or num in seen or sign not in SIGNS_ABBR:
            continue
        seen.add(num)
        cusps.append({
            "id":         num,
            "sign":       _sign(sign),
            "degrees":    _degrees(m.group(3)),
            "starLoad":   _planet(m.group(5)),
            "subLoad":    _planet(m.group(6)),
            "subSubLoad": _planet(m.group(7)),
        })
    cusps.sort(key=lambda c: c["id"])
    return cusps

# ─────────────────────────────────────────────
#  5. Vimshottari periods → recursive dashas tree
# ─────────────────────────────────────────────
PERIOD_PAT = re.compile(
    r"([A-Z][a-z](?:-[A-Z][a-z])*)"
    r"[-\s]*(\d{2}/\d{2}/\d{4})"
    r"\s*(?:::?|=:?|::)\s*"
    r"(\d{2}:\d{2}:\d{2})",
)

def _section(text, s_marker, e_marker):
    s = text.find(s_marker)
    e = text.find(e_marker, s + 1) if s != -1 else -1
    if s == -1:
        return ""
    return text[s: e if e != -1 else s + 5000]

def _norm_planet_name(name):
    return PLANET_NORM.get(name.strip(), name.strip())

def _ddmmyyy_to_ddmmyyyy(s):
    """Convert DD/MM/YYYY → DD-MM-YYYY."""
    return s.replace("/", "-")

def parse_dashas(text):
    dasha_block = _section(text, "Dashas", "Current Bhukti")
    out = []
    for m in PERIOD_PAT.finditer(dasha_block):
        planets = [_norm_planet_name(p) for p in m.group(1).split("-")]
        if len(planets) == 1:
            out.append({
                "lord": _planet(planets[0]),
                "startDate": _ddmmyyy_to_ddmmyyyy(m.group(2)),
                "endDate": None,
            })
    for i in range(len(out) - 1):
        out[i]["endDate"] = out[i + 1]["startDate"]
    return out

# ─────────────────────────────────────────────
#  6. Build output document
# ─────────────────────────────────────────────
def _dms_to_decimal(dms_str):
    """Convert '79-54-30-E' or '06-54-10-N' to decimal degrees."""
    if not dms_str:
        return 0.0
    # Strip direction letter
    direction = dms_str[-1].upper() if dms_str[-1].upper() in "NSEW" else None
    parts = re.split(r"[-\s]", dms_str.rstrip("NSEWnsew").strip())
    try:
        d, m, s = int(parts[0]), int(parts[1]), int(parts[2])
        decimal = d + m / 60 + s / 3600
        if direction in ("S", "W"):
            decimal = -decimal
        return round(decimal, 6)
    except (ValueError, IndexError):
        return 0.0

def build_document(pdf_path):
    print(f"[1/4] OCR  → {pdf_path}", file=sys.stderr, flush=True)
    raw = ocr_pdf(pdf_path)
    print("[2/4] Parsing header …", file=sys.stderr, flush=True)
    hdr = parse_header(raw)
    print("[3/4] Parsing positions …", file=sys.stderr, flush=True)
    planets = parse_planetary_positions(raw)
    cusps = parse_cuspal_positions(raw)
    print("[4/4] Parsing Vimshottari …", file=sys.stderr, flush=True)
    vimsh = parse_dashas(raw)

    raw_nakshatra = _grab(r"Nakshatra\s*:(.*?)(?:\n|Tithi)", raw)
    raw_tithi = _grab(r"Tithi\s*:(.*?)(?:\n|Time)", raw)

    pada_match = re.search(r"-\s*(\d)\s*Qtr", raw_nakshatra or "", re.IGNORECASE)
    nakshatra_pada = int(pada_match.group(1)) if pada_match else 1

    nakshatra = _resolve_nakshatra(raw_nakshatra) if raw_nakshatra else None
    tithi = _tithi(raw_tithi) if raw_tithi else None

    chart_data = {
        "nakshatra": nakshatra if nakshatra else {"id": 0, "name": "", "load": _planet("Sun")},
        "nakshatraPada": nakshatra_pada,
        "tithi": tithi if tithi else {"paksha": "", "number": 0},
        "planetaryPositions": planets,
        "cuspalPositions": cusps,
        "dashas": vimsh,
    }

    location = {
        "latitude":  _dms_to_decimal(hdr["latitude"]),
        "longitude": _dms_to_decimal(hdr["longitude"]),
        "label": hdr.get("place", ""),
    }

    return {
        "name": hdr["name"] or "",
        "birthDate": hdr["birthDate"] or "",
        "birthTimeOfDay": hdr["birthTimeOfDay"] or "",
        "timezone": hdr["timezone"] or "",
        "location": location,
        "chartData": chart_data,
    }

# ─────────────────────────────────────────────
#  7. CLI
# ─────────────────────────────────────────────
def _serial(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(type(obj))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python horoscope_parser.py <chart.pdf> [--insert]", file=sys.stderr)
        sys.exit(1)

    try:
        pdf_path = sys.argv[1]
        if not Path(pdf_path).exists():
            print(f"File not found: {pdf_path}", file=sys.stderr)
            sys.exit(1)

        doc = build_document(pdf_path)

        if "--insert" in sys.argv:
            from pymongo import MongoClient
            idx = sys.argv.index("--mongo-uri") if "--mongo-uri" in sys.argv else -1
            uri = sys.argv[idx + 1] if idx != -1 else "mongodb://localhost:27017"
            r = MongoClient(uri)["kendara"]["horoscopes"].insert_one(doc)
            print(f"\nInserted _id: {r.inserted_id}", file=sys.stderr)
        else:
            print(json.dumps(doc, indent=2, default=_serial))

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

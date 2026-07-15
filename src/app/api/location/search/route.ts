import { NextRequest, NextResponse } from "next/server";
import logger from "@/lib/logger";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  logger.info("location search: %s", q);

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "15");
  url.searchParams.set("countrycodes", "lk");
  url.searchParams.set("dedupe", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Kendara/1.0 (astrology-app)",
      "Accept-Language": "si,en",
    },
  });

  if (!res.ok) {
    logger.warn("Nominatim API error: %d", res.status);
    return NextResponse.json({ results: [] });
  }

  const data: NominatimResult[] = await res.json();

  const seen = new Set<string>();
  const results = data
    .filter((item) => {
      const key = `${parseFloat(item.lat).toFixed(3)},${parseFloat(item.lon).toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => ({
      label: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type,
    }));

  logger.info("location search returned %d results for: %s", results.length, q);
  return NextResponse.json({ results });
}

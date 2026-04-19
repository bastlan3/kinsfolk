import exifr from "exifr";

export interface Gps {
  lat: number;
  lon: number;
}

export async function extractGPS(buffer: Buffer): Promise<Gps | null> {
  try {
    const gps = await exifr.gps(buffer);
    if (!gps) return null;
    const { latitude, longitude } = gps;
    if (typeof latitude !== "number" || typeof longitude !== "number") return null;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    return { lat: latitude, lon: longitude };
  } catch {
    return null;
  }
}

export interface PlaceLabel {
  city?: string;
  country?: string;
}

// Reverse-geocode via OpenStreetMap Nominatim. Free service, 1 req/sec max,
// User-Agent required by their ToS. Handles intermittent failures by
// returning null so callers can retry later.
export async function reverseGeocode(lat: number, lon: number, userAgent: string): Promise<PlaceLabel | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("zoom", "10");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");

  try {
    const res = await fetch(url, { headers: { "User-Agent": userAgent } });
    if (!res.ok) return null;
    const json = (await res.json()) as { address?: Record<string, string> };
    const a = json.address ?? {};
    const city = a.city || a.town || a.village || a.municipality || a.hamlet || a.county;
    const country = a.country;
    if (!city && !country) return null;
    return { city, country };
  } catch {
    return null;
  }
}

export function formatLocation(place: PlaceLabel | null | undefined): string | null {
  if (!place) return null;
  if (place.city && place.country) return `${place.city}, ${place.country}`;
  return place.country || place.city || null;
}

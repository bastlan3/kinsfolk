// Polls Telegram for new updates, saves each photo into every capsule the
// sender belongs to, extracts GPS if present (and reverse-geocodes once per
// unique coordinate). Runs every 5 minutes.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { groupsForSender, loadConfig, requireEnv, type Group } from "../src/config.ts";
import { localNow } from "../src/time.ts";
import {
  dayDir,
  loadOffset,
  loadSubmissions,
  safeSlug,
  saveOffset,
  saveSubmissions,
  writeLocation,
  type LocationInfo,
  type Submission,
} from "../src/storage.ts";
import { bestPhoto, Telegram, type TgMessage } from "../src/telegram.ts";
import { extractGPS, reverseGeocode, type Gps, type PlaceLabel } from "../src/exif.ts";

const USER_AGENT = "Kinsfolk/1.0 (https://github.com/bastlan3/kinsfolk)";
const NOMINATIM_DELAY_MS = 1100; // Nominatim's usage policy: <= 1 req/sec.

async function main(): Promise<void> {
  const cfg = loadConfig();
  const tg = new Telegram(requireEnv("TELEGRAM_BOT_TOKEN"));

  const state = loadOffset();
  const updates = await tg.getUpdates(state.offset);
  if (updates.length === 0) {
    console.log("no new updates");
    return;
  }
  console.log(`got ${updates.length} update(s)`);

  const submissions = loadSubmissions();
  let maxSeen = state.offset - 1;
  // Cache geocoding responses within this run so duplicate coords only hit
  // Nominatim once. Key is lat,lon rounded to 3 decimals (~110m).
  const geocodeCache = new Map<string, PlaceLabel | null>();
  let lastGeocodeAt = 0;

  for (const u of updates) {
    maxSeen = Math.max(maxSeen, u.update_id);
    const msg = u.message;
    if (!msg || !msg.from) continue;

    const senderId = msg.from.id;
    const senderGroups = groupsForSender(cfg, senderId);
    if (senderGroups.length === 0) {
      console.log(`ignoring message from non-contributor ${senderId}`);
      continue;
    }

    if (!msg.photo && !msg.document) {
      await tg.sendMessage(
        msg.chat.id,
        "Send me a photo (or an image file for GPS) with an optional caption and I'll add it to today's capsule.",
      );
      continue;
    }

    const { buffer: original, wasDocument } = (await downloadIncomingImage(tg, msg)) ?? {};
    if (!original) {
      await tg.sendMessage(msg.chat.id, "Couldn't read that as an image. Try again with a photo or image file?");
      continue;
    }

    // Extract GPS BEFORE sharp re-encodes — rotate() strips EXIF from the
    // output. Reverse-geocode once per unique coord this run.
    const gps = await extractGPS(original);
    let place: PlaceLabel | null = null;
    if (gps && cfg.reverse_geocode) {
      place = await geocodeOnce(gps, geocodeCache, () => lastGeocodeAt, (t) => { lastGeocodeAt = t; });
    }

    const resized = await sharp(original)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    const contributorName = senderGroups[0].contributors.find((c) => c.telegram_id === senderId)!.name;
    const today = localNow(cfg.timezone).dateString;
    const caption = (msg.caption ?? "").trim();

    for (const group of senderGroups) {
      const dir = dayDir(group.id, today, contributorName);
      mkdirSync(dir, { recursive: true });
      const seq = nextSequenceNumber(dir);
      const filename = `${String(seq).padStart(3, "0")}.jpg`;
      writeFileSync(join(dir, filename), resized);
      if (caption) writeFileSync(join(dir, "caption.txt"), caption + "\n");
      if (gps) {
        const loc: LocationInfo = {
          lat: gps.lat,
          lon: gps.lon,
          ...(place ?? {}),
          fetched_at: new Date().toISOString(),
        };
        writeLocation(dir, loc);
      }

      submissions.push({
        group_id: group.id,
        date: today,
        contributor: safeSlug(contributorName),
        telegram_id: senderId,
        caption,
        file_relpath: `entries/${group.id}/${today.replace(/-/g, "/")}/${safeSlug(contributorName)}/${filename}`,
        received_at: new Date().toISOString(),
      } satisfies Submission);
    }

    await tg.sendMessage(msg.chat.id, buildAckMessage(senderGroups, today, caption, gps, place, wasDocument ?? false));
    console.log(
      `saved from ${contributorName} to ${senderGroups.map((g) => g.id).join(",")}` +
        (gps ? ` (GPS ${gps.lat.toFixed(3)},${gps.lon.toFixed(3)}${place ? ` → ${place.city ?? ""}/${place.country ?? ""}` : ""})` : ""),
    );
  }

  saveSubmissions(submissions);
  saveOffset({ offset: maxSeen + 1 });
}

async function downloadIncomingImage(
  tg: Telegram,
  msg: TgMessage,
): Promise<{ buffer: Buffer; wasDocument: boolean } | null> {
  if (msg.document && msg.document.mime_type?.startsWith("image/")) {
    const path = await tg.getFilePath(msg.document.file_id);
    return { buffer: await tg.downloadFile(path), wasDocument: true };
  }
  if (msg.photo && msg.photo.length > 0) {
    const photo = bestPhoto(msg.photo);
    const path = await tg.getFilePath(photo.file_id);
    return { buffer: await tg.downloadFile(path), wasDocument: false };
  }
  return null;
}

async function geocodeOnce(
  gps: Gps,
  cache: Map<string, PlaceLabel | null>,
  getLast: () => number,
  setLast: (t: number) => void,
): Promise<PlaceLabel | null> {
  const key = `${gps.lat.toFixed(3)},${gps.lon.toFixed(3)}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  const wait = NOMINATIM_DELAY_MS - (Date.now() - getLast());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  const place = await reverseGeocode(gps.lat, gps.lon, USER_AGENT);
  setLast(Date.now());
  cache.set(key, place);
  return place;
}

function buildAckMessage(
  groups: Group[],
  today: string,
  caption: string,
  gps: Gps | null,
  place: PlaceLabel | null,
  wasDocument: boolean,
): string {
  const where = groups.map((g) => g.name).join(", ");
  const parts: string[] = [`Got it ✓ — saved to ${where} for ${today}.`];
  if (gps && place) {
    const label = place.city && place.country ? `${place.city}, ${place.country}` : (place.city ?? place.country);
    parts.push(`Location detected: ${label}.`);
  } else if (gps) {
    parts.push(`Location detected (coords only).`);
  } else if (!wasDocument) {
    parts.push(`Tip: to include location, send as a file attachment (📎 → File) — Telegram strips GPS from "photo" sends.`);
  }
  if (!caption) parts.push(`Add a caption next time if you want one in the journal.`);
  return parts.join(" ");
}

function nextSequenceNumber(dir: string): number {
  if (!existsSync(dir)) return 1;
  const nums = readdirSync(dir)
    .map((f) => /^(\d+)\.jpe?g$/i.exec(f)?.[1])
    .filter((s): s is string => Boolean(s))
    .map((s) => Number(s));
  if (nums.length === 0) return 1;
  return Math.max(...nums) + 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

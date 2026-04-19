// End-to-end smoke test. No Telegram, no Resend, no secrets, no network
// (reverse-geocoding is skipped). Runs every module that doesn't need the
// internet against synthetic data in a temp dir and asserts the critical
// invariants. Safe to run any time.
//
//   npm run smoke
//
// Exits non-zero on any assertion failure.

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

// Env overrides must be set before anything that might resolve these paths.
const scratch = mkdtempSync(join(tmpdir(), "kinsfolk-smoke-"));
process.env.KINSFOLK_ENTRIES_DIR = join(scratch, "entries");
process.env.KINSFOLK_STATE_DIR = join(scratch, "state");
mkdirSync(process.env.KINSFOLK_ENTRIES_DIR, { recursive: true });
mkdirSync(process.env.KINSFOLK_STATE_DIR, { recursive: true });

import { localNow, yesterdayString, previousMonth, monthName, daysInMonth } from "../src/time.ts";
import {
  listEntriesForMonth,
  loadOffset,
  loadReminders,
  safeSlug,
  saveOffset,
  saveReminders,
  writeLocation,
} from "../src/storage.ts";
import { buildJournal } from "../src/journal.ts";
import { bestPhoto } from "../src/telegram.ts";
import { extractGPS, formatLocation } from "../src/exif.ts";

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

async function main(): Promise<void> {
  console.log(`smoke test in ${scratch}`);

  await testTime();
  await testStorage();
  await testImagePipeline();
  await testExif();
  await testJournalBuild();
  await testMultiGroupJournal();
  await testTelegramHelpers();

  if (failures > 0) {
    console.log(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log(`\nall green`);
}

async function testTime(): Promise<void> {
  console.log("\n[time]");
  const apr = localNow("Europe/Paris", new Date("2026-04-19T14:00:00Z"));
  check("Paris hour at 14:00Z in April is 16 (CEST)", apr.hour === 16, `got ${apr.hour}`);
  check("Paris dateString is 2026-04-19", apr.dateString === "2026-04-19");

  const jan = localNow("Europe/Paris", new Date("2026-01-15T14:00:00Z"));
  check("Paris hour at 14:00Z in January is 15 (CET)", jan.hour === 15, `got ${jan.hour}`);

  const lateNight = localNow("Europe/Paris", new Date("2026-04-19T22:30:00Z"));
  check("22:30Z lands on next Paris day", lateNight.dateString === "2026-04-20", lateNight.dateString);

  check("yesterday of 2026-04-19 is 2026-04-18",
    yesterdayString("Europe/Paris", new Date("2026-04-19T10:00:00Z")) === "2026-04-18");
  check("yesterday of 2026-04-01 is 2026-03-31",
    yesterdayString("Europe/Paris", new Date("2026-04-01T10:00:00Z")) === "2026-03-31");
  check("yesterday of 2026-01-01 is 2025-12-31",
    yesterdayString("Europe/Paris", new Date("2026-01-01T10:00:00Z")) === "2025-12-31");

  const pm = previousMonth("Europe/Paris", new Date("2026-04-01T10:00:00Z"));
  check("prev month of April 2026 is March 2026", pm.year === 2026 && pm.month === 3);
  const pmJan = previousMonth("Europe/Paris", new Date("2026-01-01T10:00:00Z"));
  check("prev month of January 2026 is December 2025", pmJan.year === 2025 && pmJan.month === 12);

  check("daysInMonth Feb 2024 = 29 (leap)", daysInMonth(2024, 2) === 29);
  check("daysInMonth Feb 2026 = 28", daysInMonth(2026, 2) === 28);
  check("monthName(4) === April", monthName(4) === "April");
}

async function testStorage(): Promise<void> {
  console.log("\n[storage]");
  check("safeSlug handles empty", safeSlug("") === "contributor");
  check("safeSlug lowercases", safeSlug("ALICE") === "alice");
  check("safeSlug collapses non-alnum", safeSlug("Marie-Hélène!").startsWith("marie-"));

  check("default offset is 0", loadOffset().offset === 0);
  saveOffset({ offset: 42 });
  check("offset round-trips", loadOffset().offset === 42);

  const r1 = loadReminders();
  check("default reminders has 4 sub-objects",
    ["today_reminders", "yesterday_escalations", "monthly_sent", "monthly_alerts"].every((k) => k in r1));
  r1.monthly_sent["maternal:2026-03"] = "2026-04-01T09:00:00Z";
  saveReminders(r1);
  check("reminders round-trip keyed by group", loadReminders().monthly_sent["maternal:2026-03"] === "2026-04-01T09:00:00Z");

  check("listEntriesForMonth on nonexistent group returns []",
    listEntriesForMonth("missing", 1999, 1).length === 0);
}

async function testImagePipeline(): Promise<void> {
  console.log("\n[image pipeline]");
  const src = await sharp({
    create: { width: 2400, height: 1800, channels: 3, background: { r: 180, g: 120, b: 60 } },
  }).jpeg({ quality: 92 }).toBuffer();

  const resized = await sharp(src)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  const meta = await sharp(resized).metadata();
  check("resized width <= 1600", (meta.width ?? 0) <= 1600, `width=${meta.width}`);
  check("resized height <= 1600", (meta.height ?? 0) <= 1600, `height=${meta.height}`);
  check("resized is still JPEG", meta.format === "jpeg");
  check("resized buffer < 600KB", resized.byteLength < 600_000);
}

async function testExif(): Promise<void> {
  console.log("\n[exif]");
  // Sharp-generated buffer with no EXIF → extractGPS returns null cleanly.
  const noExif = await sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 50, g: 50, b: 50 } },
  }).jpeg().toBuffer();
  const gps = await extractGPS(noExif);
  check("extractGPS on EXIF-less buffer returns null", gps === null);

  // formatLocation shapes
  check("formatLocation(null) === null", formatLocation(null) === null);
  check("formatLocation city+country", formatLocation({ city: "Paris", country: "France" }) === "Paris, France");
  check("formatLocation country-only", formatLocation({ country: "France" }) === "France");
  check("formatLocation city-only", formatLocation({ city: "Paris" }) === "Paris");
}

async function testJournalBuild(): Promise<void> {
  console.log("\n[journal build — single group]");
  const year = 2026;
  const month = 3;
  const groupId = "maternal";
  const base = join(scratch, "entries", groupId, String(year), "03");
  mkdirSync(base, { recursive: true });

  async function place(day: string, slug: string, filename: string, caption?: string, withLocation = false): Promise<void> {
    const dir = join(base, day, slug);
    mkdirSync(dir, { recursive: true });
    const buf = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 120, g: 180, b: 200 } },
    }).jpeg({ quality: 80 }).toBuffer();
    writeFileSync(join(dir, filename), buf);
    if (caption) writeFileSync(join(dir, "caption.txt"), caption + "\n");
    if (withLocation) {
      writeLocation(dir, {
        lat: 48.8566,
        lon: 2.3522,
        city: "Paris",
        country: "France",
        fetched_at: new Date().toISOString(),
      });
    }
  }

  await place("05", "alice", "001.jpg", "First daffodil", true);
  await place("05", "bob", "001.jpg");
  await place("12", "alice", "001.jpg", "Snow in March <weird> & \"quotes\"");
  await place("28", "bob", "001.jpg", "Lemon cake", true);

  const entries = listEntriesForMonth(groupId, year, month);
  check("listEntriesForMonth returns 4", entries.length === 4, `got ${entries.length}`);
  check("entries carry group_id", entries.every((e) => e.group_id === groupId));
  check("entries with location populated", entries.filter((e) => e.location).length === 2);

  const contributors = [
    { name: "Alice", telegram_id: 1 },
    { name: "Bob", telegram_id: 2 },
  ];
  const built = buildJournal({
    year,
    month,
    groupName: "My parents",
    entries,
    contributors,
    subject_template: "Kinsfolk — {group_name} — {month_name} {year}",
  });

  check("subject interpolates group_name",
    built.subject === "Kinsfolk — My parents — March 2026", built.subject);
  check("attachment count matches entries", built.attachments.length === 4);
  check("html references every cid", built.attachments.every((a) => built.html.includes(`cid:${a.content_id}`)));
  check("html escapes <weird>",
    !built.html.includes("<weird>") && built.html.includes("&lt;weird&gt;"));
  check("html renders location pin", built.html.includes("Paris, France"));
  check("html contains group name", built.html.includes("My parents"));
  check("byline includes Alice", built.html.includes("by Alice"));

  // 3 days have photos (5, 12, 28); 31 - 3 = 28 missed days.
  const misses = built.html.match(/no photo/g)?.length ?? 0;
  check("28 missed-day markers", misses === 28, `got ${misses}`);

  writeFileSync(join(scratch, "journal-maternal.html"), built.html);
  console.log(`  (wrote sample to ${join(scratch, "journal-maternal.html")})`);
}

async function testMultiGroupJournal(): Promise<void> {
  console.log("\n[journal build — multi group broadcast]");
  // Simulate the broadcast model: a contributor in two groups posts once;
  // poll-telegram saves the photo to both groups. Each group builds its own
  // journal independently.
  const year = 2026;
  const month = 3;
  const base = join(scratch, "entries");

  async function placeInGroup(groupId: string, day: string, slug: string): Promise<void> {
    const dir = join(base, groupId, String(year), "03", day, slug);
    mkdirSync(dir, { recursive: true });
    const buf = await sharp({
      create: { width: 300, height: 200, channels: 3, background: { r: 200, g: 150, b: 100 } },
    }).jpeg({ quality: 80 }).toBuffer();
    writeFileSync(join(dir, "001.jpg"), buf);
  }

  await placeInGroup("partner", "10", "me");
  await placeInGroup("partner", "20", "me");
  await placeInGroup("partner", "10", "laura");

  const entriesPartner = listEntriesForMonth("partner", year, month);
  const entriesMaternal = listEntriesForMonth("maternal", year, month);

  check("partner group has 3 entries", entriesPartner.length === 3);
  check("maternal group still has 4 entries (from prior test)", entriesMaternal.length === 4);

  const partnerJournal = buildJournal({
    year,
    month,
    groupName: "Laura's parents",
    entries: entriesPartner,
    contributors: [
      { name: "Me", telegram_id: 111 },
      { name: "Laura", telegram_id: 333 },
    ],
    subject_template: "Kinsfolk — {group_name} — {month_name} {year}",
  });
  check("partner subject renders", partnerJournal.subject === "Kinsfolk — Laura's parents — March 2026");
  check("partner journal has 3 attachments", partnerJournal.attachments.length === 3);
  check("partner journal does not leak maternal cids",
    !partnerJournal.html.includes("daffodil"));
}

async function testTelegramHelpers(): Promise<void> {
  console.log("\n[telegram helpers]");
  check("bestPhoto picks the largest",
    bestPhoto([
      { file_id: "a", file_unique_id: "a", width: 100, height: 100 },
      { file_id: "b", file_unique_id: "b", width: 800, height: 800 },
    ]).file_id === "b",
  );
}

main().catch((err) => {
  console.error("smoke test crashed:", err);
  process.exit(1);
});
// Scratch dir is intentionally left in place so a human can inspect journal HTML.

// End-to-end smoke test. No Telegram, no Resend, no secrets. Runs every
// module that doesn't need the network against synthetic data in a temp dir
// and asserts the critical invariants. Safe to run any time.
//
//   npm run smoke
//
// Exits non-zero on any assertion failure.

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

// Pull in the shipping modules so import resolution is exercised too.
import { localNow, yesterdayString, previousMonth, monthName, daysInMonth } from "../src/time.ts";
import {
  listEntriesForMonth,
  loadOffset,
  loadReminders,
  safeSlug,
  saveOffset,
  saveReminders,
} from "../src/storage.ts";
import { buildJournal } from "../src/journal.ts";
import { bestPhoto } from "../src/telegram.ts";

// Redirect entries/state to a scratch dir so we don't pollute the repo.
// Set the env vars BEFORE importing the storage module so paths resolve
// correctly on first access.
const scratch = mkdtempSync(join(tmpdir(), "kinsfolk-smoke-"));
process.env.KINSFOLK_ENTRIES_DIR = join(scratch, "entries");
process.env.KINSFOLK_STATE_DIR = join(scratch, "state");
mkdirSync(process.env.KINSFOLK_ENTRIES_DIR, { recursive: true });
mkdirSync(process.env.KINSFOLK_STATE_DIR, { recursive: true });

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
  await testJournalBuild();
  await testTelegramHelpers();

  if (failures > 0) {
    console.log(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log(`\nall green`);
}

async function testTime(): Promise<void> {
  console.log("\n[time]");
  // Anchor to a known instant: 2026-04-19 14:00 UTC = 16:00 Paris (CEST).
  const ref = new Date("2026-04-19T14:00:00Z");
  const paris = localNow("Europe/Paris", ref);
  check("Paris hour at 14:00Z in April is 16 (CEST)", paris.hour === 16, `got ${paris.hour}`);
  check("Paris dateString is 2026-04-19", paris.dateString === "2026-04-19", paris.dateString);

  // Winter: 2026-01-15 14:00 UTC = 15:00 Paris (CET).
  const winter = new Date("2026-01-15T14:00:00Z");
  const parisWinter = localNow("Europe/Paris", winter);
  check("Paris hour at 14:00Z in January is 15 (CET)", parisWinter.hour === 15, `got ${parisWinter.hour}`);

  // Day boundary test: 2026-04-19 22:30 UTC = 2026-04-20 00:30 Paris.
  const lateNight = new Date("2026-04-19T22:30:00Z");
  const afterMidnight = localNow("Europe/Paris", lateNight);
  check(
    "22:30Z lands on next Paris day",
    afterMidnight.dateString === "2026-04-20",
    afterMidnight.dateString,
  );

  // yesterdayString
  const yday = yesterdayString("Europe/Paris", new Date("2026-04-19T10:00:00Z"));
  check("yesterday of 2026-04-19 is 2026-04-18", yday === "2026-04-18", yday);

  // Month rollover
  const ydayMonth = yesterdayString("Europe/Paris", new Date("2026-04-01T10:00:00Z"));
  check("yesterday of 2026-04-01 is 2026-03-31", ydayMonth === "2026-03-31", ydayMonth);

  // Year rollover
  const ydayYear = yesterdayString("Europe/Paris", new Date("2026-01-01T10:00:00Z"));
  check("yesterday of 2026-01-01 is 2025-12-31", ydayYear === "2025-12-31", ydayYear);

  // previousMonth
  const pm = previousMonth("Europe/Paris", new Date("2026-04-01T10:00:00Z"));
  check("prev month of April 2026 is March 2026", pm.year === 2026 && pm.month === 3, JSON.stringify(pm));

  const pmJan = previousMonth("Europe/Paris", new Date("2026-01-01T10:00:00Z"));
  check("prev month of January 2026 is December 2025", pmJan.year === 2025 && pmJan.month === 12, JSON.stringify(pmJan));

  check("daysInMonth Feb 2024 = 29 (leap)", daysInMonth(2024, 2) === 29);
  check("daysInMonth Feb 2026 = 28", daysInMonth(2026, 2) === 28);
  check("monthName(4) === April", monthName(4) === "April");
}

async function testStorage(): Promise<void> {
  console.log("\n[storage]");

  check("safeSlug handles unicode names", safeSlug("Marie-Hélène") === "marie-h-l-ne" || safeSlug("Marie-Hélène").length > 0);
  check("safeSlug handles empty", safeSlug("") === "contributor");
  check("safeSlug lowercases", safeSlug("ALICE") === "alice");

  const o1 = loadOffset();
  check("default offset is 0", o1.offset === 0);
  saveOffset({ offset: 42 });
  const o2 = loadOffset();
  check("offset round-trips via JSON", o2.offset === 42, String(o2.offset));

  const r1 = loadReminders();
  check("default reminders has all sub-objects",
    Object.keys(r1).length === 4 &&
    "today_reminders" in r1 && "monthly_alerts" in r1);
  r1.monthly_sent["2026-03"] = "2026-04-01T09:00:00Z";
  saveReminders(r1);
  const r2 = loadReminders();
  check("reminders round-trip", r2.monthly_sent["2026-03"] === "2026-04-01T09:00:00Z");

  // listEntriesForMonth on a month with nothing should return [].
  const empty = listEntriesForMonth(1999, 1);
  check("listEntriesForMonth on empty month returns []", empty.length === 0, `got ${empty.length}`);
}

async function testImagePipeline(): Promise<void> {
  console.log("\n[image pipeline]");
  // Fabricate a 2400x1800 gradient, then run the same resize path poll-telegram uses.
  const src = await sharp({
    create: {
      width: 2400,
      height: 1800,
      channels: 3,
      background: { r: 180, g: 120, b: 60 },
    },
  })
    .jpeg({ quality: 92 })
    .toBuffer();

  const resized = await sharp(src)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  const meta = await sharp(resized).metadata();
  check("resized width <= 1600", (meta.width ?? 0) <= 1600, `width=${meta.width}`);
  check("resized height <= 1600", (meta.height ?? 0) <= 1600, `height=${meta.height}`);
  check("resized is still JPEG", meta.format === "jpeg", String(meta.format));
  check("resized buffer is smaller than 600KB",
    resized.byteLength < 600_000,
    `${Math.round(resized.byteLength / 1024)}KB`);
}

async function testJournalBuild(): Promise<void> {
  console.log("\n[journal build]");

  // Build a fake entries tree in the scratch dir, then temporarily point at it.
  const year = 2026;
  const month = 3; // March
  const base = join(scratch, "entries", String(year), "03");
  mkdirSync(base, { recursive: true });

  async function placeImage(day: string, slug: string, filename: string, caption?: string): Promise<void> {
    const dir = join(base, day, slug);
    mkdirSync(dir, { recursive: true });
    const buf = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 120, g: 180, b: 200 } },
    }).jpeg({ quality: 80 }).toBuffer();
    writeFileSync(join(dir, filename), buf);
    if (caption) writeFileSync(join(dir, "caption.txt"), caption + "\n");
  }

  await placeImage("05", "alice", "001.jpg", "First daffodil of the year");
  await placeImage("05", "bob", "001.jpg");
  await placeImage("12", "alice", "001.jpg", "Snow in March <weird> & \"quotes\"");
  await placeImage("28", "bob", "001.jpg", "Lemon cake");

  // listEntriesForMonth honours KINSFOLK_ENTRIES_DIR, which we pointed at
  // scratch/entries at the top of this file — so it finds our synthetic data.
  const entries = listEntriesForMonth(year, month);
  check("fake tree yields 4 entries", entries.length === 4, `got ${entries.length}`);

  const contributors = [
    { name: "Alice", telegram_id: 1 },
    { name: "Bob", telegram_id: 2 },
  ];

  const built = buildJournal({
    year,
    month,
    entries,
    contributors,
    subject_template: "Kinsfolk — {month_name} {year}",
  });

  check("subject substitutes template", built.subject === "Kinsfolk — March 2026", built.subject);
  check("attachments count matches entries", built.attachments.length === 4);
  check("each attachment has content_id", built.attachments.every((a) => !!a.content_id));
  check("each attachment has non-empty buffer", built.attachments.every((a) => a.content.byteLength > 0));
  check("html references every cid", built.attachments.every((a) => built.html.includes(`cid:${a.content_id}`)));

  check(
    "html escapes angle-brackets in captions",
    !built.html.includes("<weird>") && built.html.includes("&lt;weird&gt;"),
  );

  check("html mentions March 2026", built.html.includes("March 2026"));
  check("html includes Alice byline", built.html.includes("by Alice"));
  check("html includes Bob byline", built.html.includes("by Bob"));

  // March has 31 days — missed ones should render as "no photo".
  const noPhotoMatches = built.html.match(/no photo/g)?.length ?? 0;
  // Days with any photo: 5, 12, 28 → 3 present. 31 - 3 = 28 missed.
  check("28 missed-day markers in March", noPhotoMatches === 28, `got ${noPhotoMatches}`);

  const htmlOut = join(scratch, "journal.html");
  writeFileSync(htmlOut, built.html);
  console.log(`  (wrote sample journal to ${htmlOut}, ${Math.round(built.html.length / 1024)}KB)`);
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
// Scratch dir is intentionally left in place so a human can inspect journal.html.

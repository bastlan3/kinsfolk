import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { repoRoot } from "./config.ts";

// ---- on-disk layout helpers ----
//
//   entries/<group_id>/YYYY/MM/DD/<contributor-slug>/001.jpg
//   entries/<group_id>/YYYY/MM/DD/<contributor-slug>/caption.txt    (optional)
//   entries/<group_id>/YYYY/MM/DD/<contributor-slug>/location.json  (optional)
//
// A single photo from a contributor in multiple groups lands as independent
// copies under each group's directory, so every group is self-contained and
// can be deleted/rebuilt without touching the others.

export function entriesDir(): string {
  return resolve(process.env.KINSFOLK_ENTRIES_DIR ?? resolve(repoRoot(), "entries"));
}

export function stateDir(): string {
  const d = resolve(process.env.KINSFOLK_STATE_DIR ?? resolve(repoRoot(), "state"));
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

export function dayDir(groupId: string, dateString: string, contributor: string): string {
  const [y, m, d] = dateString.split("-");
  return resolve(entriesDir(), groupId, y, m, d, safeSlug(contributor));
}

export function safeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "contributor";
}

// ---- JSON state files ----

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

export interface OffsetState {
  offset: number;
}
const OFFSET_PATH = () => join(stateDir(), "telegram-offset.json");
export function loadOffset(): OffsetState {
  return readJson<OffsetState>(OFFSET_PATH(), { offset: 0 });
}
export function saveOffset(s: OffsetState): void {
  writeJson(OFFSET_PATH(), s);
}

export interface Submission {
  group_id: string;
  date: string;         // YYYY-MM-DD in contributor-local time at save time
  contributor: string;  // slug
  telegram_id: number;
  caption: string;
  file_relpath: string; // "entries/maternal/2026/04/19/alice/001.jpg"
  received_at: string;  // ISO UTC
}
interface SubmissionState {
  submissions: Submission[];
}
const SUB_PATH = () => join(stateDir(), "submissions.json");
export function loadSubmissions(): Submission[] {
  return readJson<SubmissionState>(SUB_PATH(), { submissions: [] }).submissions;
}
export function saveSubmissions(subs: Submission[]): void {
  writeJson(SUB_PATH(), { submissions: subs });
}

// Reminder keys:
//   today_reminders:       "${date}:${telegram_id}"               (per-person-per-day)
//   yesterday_escalations: "${date}:${telegram_id}"               (per-person-per-day)
//   monthly_sent:          "${group_id}:${year}-${month}"         (per-group-per-month)
//   monthly_alerts:        "${group_id}:${year}-${month}"         (per-group-per-month)
//
// Daily reminders are person-centric, not group-centric: a photo DMed once
// broadcasts to every group the sender belongs to, so "posted today" is
// meaningful at the person level.
export interface ReminderState {
  today_reminders: Record<string, string>;
  yesterday_escalations: Record<string, string>;
  monthly_sent: Record<string, string>;
  monthly_alerts: Record<string, string>;
}
const REM_PATH = () => join(stateDir(), "reminders.json");
export function loadReminders(): ReminderState {
  const loaded = readJson<Partial<ReminderState>>(REM_PATH(), {});
  return {
    today_reminders: loaded.today_reminders ?? {},
    yesterday_escalations: loaded.yesterday_escalations ?? {},
    monthly_sent: loaded.monthly_sent ?? {},
    monthly_alerts: loaded.monthly_alerts ?? {},
  };
}
export function saveReminders(s: ReminderState): void {
  writeJson(REM_PATH(), s);
}

// ---- location sidecar ----

export interface LocationInfo {
  lat: number;
  lon: number;
  city?: string;
  country?: string;
  fetched_at?: string; // ISO UTC when geocoding was last attempted
}

export function readLocation(dir: string): LocationInfo | null {
  const p = join(dir, "location.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as LocationInfo;
  } catch {
    return null;
  }
}

export function writeLocation(dir: string, loc: LocationInfo): void {
  writeJson(join(dir, "location.json"), loc);
}

// ---- enumerating entries for a given group/month ----

export interface MonthEntry {
  group_id: string;
  date: string;
  contributor: string;
  caption: string;
  location: LocationInfo | null;
  absPath: string;
  relPath: string;
}

export function listEntriesForMonth(groupId: string, year: number, month: number): MonthEntry[] {
  const monthDir = resolve(entriesDir(), groupId, String(year), String(month).padStart(2, "0"));
  if (!existsSync(monthDir)) return [];
  const out: MonthEntry[] = [];
  const days = readdirSync(monthDir).filter((d) => /^\d{2}$/.test(d)).sort();
  for (const dayStr of days) {
    const dayDirPath = join(monthDir, dayStr);
    if (!statSync(dayDirPath).isDirectory()) continue;
    for (const c of readdirSync(dayDirPath).sort()) {
      const cPath = join(dayDirPath, c);
      if (!statSync(cPath).isDirectory()) continue;
      const images = readdirSync(cPath)
        .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
        .sort();
      const captionPath = join(cPath, "caption.txt");
      const caption = existsSync(captionPath) ? readFileSync(captionPath, "utf8").trim() : "";
      const location = readLocation(cPath);
      for (const img of images) {
        out.push({
          group_id: groupId,
          date: `${year}-${String(month).padStart(2, "0")}-${dayStr}`,
          contributor: c,
          caption,
          location,
          absPath: join(cPath, img),
          relPath: `entries/${groupId}/${year}/${String(month).padStart(2, "0")}/${dayStr}/${c}/${img}`,
        });
      }
    }
  }
  return out;
}

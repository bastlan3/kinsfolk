import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { repoRoot } from "./config.ts";

// ---- on-disk layout helpers ----

export function entriesDir(): string {
  return resolve(repoRoot(), "entries");
}

export function stateDir(): string {
  const d = resolve(repoRoot(), "state");
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

export function dayDir(dateString: string, contributor: string): string {
  // dateString = YYYY-MM-DD
  const [y, m, d] = dateString.split("-");
  return resolve(entriesDir(), y, m, d, safeSlug(contributor));
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

// telegram-offset.json: { offset: number }
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

// submissions.json: flat list of every saved photo
export interface Submission {
  date: string;         // YYYY-MM-DD (contributor's local day at save time)
  contributor: string;  // name as configured
  telegram_id: number;
  caption: string;      // "" if none
  file_relpath: string; // "entries/2025/04/19/alice/001.jpg"
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

// reminders.json: tracks what we've already sent so we don't spam on hourly runs
export interface ReminderState {
  // key is `${date}:${telegram_id}`, value is ISO sent time
  today_reminders: Record<string, string>;
  yesterday_escalations: Record<string, string>;
  monthly_sent: Record<string, string>; // key is `${year}-${month}`
}
const REM_PATH = () => join(stateDir(), "reminders.json");
export function loadReminders(): ReminderState {
  return readJson<ReminderState>(REM_PATH(), {
    today_reminders: {},
    yesterday_escalations: {},
    monthly_sent: {},
  });
}
export function saveReminders(s: ReminderState): void {
  writeJson(REM_PATH(), s);
}

// ---- enumerating entries ----

export interface MonthEntry {
  date: string;
  contributor: string;
  caption: string;
  absPath: string;
  relPath: string;
}

export function listEntriesForMonth(year: number, month: number): MonthEntry[] {
  const monthDir = resolve(entriesDir(), String(year), String(month).padStart(2, "0"));
  if (!existsSync(monthDir)) return [];
  const out: MonthEntry[] = [];
  const days = readdirSync(monthDir).filter((d) => /^\d{2}$/.test(d)).sort();
  for (const dayStr of days) {
    const dayDirPath = join(monthDir, dayStr);
    if (!statSync(dayDirPath).isDirectory()) continue;
    const contribDirs = readdirSync(dayDirPath).sort();
    for (const c of contribDirs) {
      const cPath = join(dayDirPath, c);
      if (!statSync(cPath).isDirectory()) continue;
      const files = readdirSync(cPath);
      const images = files.filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
      const captionPath = join(cPath, "caption.txt");
      const caption = existsSync(captionPath) ? readFileSync(captionPath, "utf8").trim() : "";
      for (const img of images) {
        out.push({
          date: `${year}-${String(month).padStart(2, "0")}-${dayStr}`,
          contributor: c,
          caption,
          absPath: join(cPath, img),
          relPath: `entries/${year}/${String(month).padStart(2, "0")}/${dayStr}/${c}/${img}`,
        });
      }
    }
  }
  return out;
}

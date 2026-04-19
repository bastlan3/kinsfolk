import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parse } from "yaml";

export interface Contributor {
  name: string;
  telegram_id: number;
}

export interface JournalConfig {
  from_name: string;
  from_email: string;
  reply_to: string;
  subject_template: string;
}

export interface Config {
  timezone: string;
  daily_deadline_hour: number;
  contributors: Contributor[];
  receivers: string[];
  journal: JournalConfig;
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function loadConfig(): Config {
  const raw = readFileSync(resolve(REPO_ROOT, "config.yml"), "utf8");
  const cfg = parse(raw) as Config;

  if (!cfg.timezone) throw new Error("config.yml: timezone is required");
  if (typeof cfg.daily_deadline_hour !== "number") {
    throw new Error("config.yml: daily_deadline_hour must be a number");
  }
  if (!Array.isArray(cfg.contributors) || cfg.contributors.length === 0) {
    throw new Error("config.yml: at least one contributor is required");
  }
  for (const c of cfg.contributors) {
    if (!c.name || c.name === "CHANGE_ME") {
      throw new Error("config.yml: set a real name for every contributor");
    }
    if (!Number.isInteger(c.telegram_id) || c.telegram_id <= 0) {
      throw new Error(`config.yml: contributor ${c.name} needs a numeric telegram_id`);
    }
  }
  if (!Array.isArray(cfg.receivers) || cfg.receivers.length === 0) {
    throw new Error("config.yml: at least one receiver email is required");
  }
  for (const r of cfg.receivers) {
    if (!r.includes("@") || r.includes("CHANGE_ME")) {
      throw new Error(`config.yml: invalid receiver email ${r}`);
    }
  }
  if (!cfg.journal?.from_email?.includes("@")) {
    throw new Error("config.yml: journal.from_email required");
  }
  return cfg;
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

export function repoRoot(): string {
  return REPO_ROOT;
}

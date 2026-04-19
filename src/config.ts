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

export interface Group {
  id: string;
  name: string;
  contributors: Contributor[];
  receivers: string[];
  journal: JournalConfig; // resolved: defaults merged with per-group overrides
}

export interface Config {
  timezone: string;
  daily_deadline_hour: number;
  reverse_geocode: boolean;
  groups: Group[];
}

interface RawConfig {
  timezone: string;
  daily_deadline_hour: number;
  reverse_geocode?: boolean;
  defaults?: { journal?: Partial<JournalConfig> };
  groups: Array<{
    id: string;
    name: string;
    contributors: Contributor[];
    receivers: string[];
    journal?: Partial<JournalConfig>;
  }>;
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function loadConfig(): Config {
  const raw = parse(readFileSync(resolve(REPO_ROOT, "config.yml"), "utf8")) as RawConfig;

  if (!raw.timezone) throw new Error("config.yml: timezone is required");
  if (typeof raw.daily_deadline_hour !== "number") {
    throw new Error("config.yml: daily_deadline_hour must be a number");
  }
  if (!Array.isArray(raw.groups) || raw.groups.length === 0) {
    throw new Error("config.yml: at least one group is required");
  }

  const defaultJournal: Partial<JournalConfig> = raw.defaults?.journal ?? {};
  const seenGroupIds = new Set<string>();
  const nameByTelegramId = new Map<number, string>();

  const groups: Group[] = raw.groups.map((g) => {
    if (!g.id || !/^[a-z0-9][a-z0-9-]*$/.test(g.id)) {
      throw new Error(`config.yml: group id "${g.id}" must be lowercase slug (a-z, 0-9, -)`);
    }
    if (seenGroupIds.has(g.id)) throw new Error(`config.yml: duplicate group id "${g.id}"`);
    seenGroupIds.add(g.id);

    if (!Array.isArray(g.contributors) || g.contributors.length === 0) {
      throw new Error(`config.yml: group "${g.id}" needs at least one contributor`);
    }
    const telegramIdsInGroup = new Set<number>();
    for (const c of g.contributors) {
      if (!c.name || c.name === "CHANGE_ME") {
        throw new Error(`config.yml: group "${g.id}" has a contributor with no real name`);
      }
      if (!Number.isInteger(c.telegram_id) || c.telegram_id <= 0) {
        throw new Error(`config.yml: group "${g.id}" contributor ${c.name} needs a numeric telegram_id`);
      }
      if (telegramIdsInGroup.has(c.telegram_id)) {
        throw new Error(`config.yml: group "${g.id}" lists telegram_id ${c.telegram_id} twice`);
      }
      telegramIdsInGroup.add(c.telegram_id);

      const previousName = nameByTelegramId.get(c.telegram_id);
      if (previousName && previousName !== c.name) {
        throw new Error(
          `config.yml: telegram_id ${c.telegram_id} is named "${previousName}" in one group ` +
            `and "${c.name}" in another. Pick one name per person across all groups.`,
        );
      }
      nameByTelegramId.set(c.telegram_id, c.name);
    }

    if (!Array.isArray(g.receivers) || g.receivers.length === 0) {
      throw new Error(`config.yml: group "${g.id}" needs at least one receiver email`);
    }
    for (const r of g.receivers) {
      if (!r.includes("@") || r.includes("CHANGE_ME")) {
        throw new Error(`config.yml: group "${g.id}" has invalid receiver email "${r}"`);
      }
    }

    const merged: JournalConfig = {
      from_name: g.journal?.from_name ?? defaultJournal.from_name ?? "Kinsfolk",
      from_email: g.journal?.from_email ?? defaultJournal.from_email ?? "",
      reply_to: g.journal?.reply_to ?? defaultJournal.reply_to ?? "",
      subject_template:
        g.journal?.subject_template ??
        defaultJournal.subject_template ??
        "Kinsfolk — {month_name} {year}",
    };
    if (!merged.from_email.includes("@")) {
      throw new Error(`config.yml: group "${g.id}" resolved journal.from_email is invalid`);
    }

    return {
      id: g.id,
      name: g.name || g.id,
      contributors: g.contributors,
      receivers: g.receivers,
      journal: merged,
    };
  });

  return {
    timezone: raw.timezone,
    daily_deadline_hour: raw.daily_deadline_hour,
    reverse_geocode: raw.reverse_geocode ?? true,
    groups,
  };
}

// Return every group whose contributors list includes this telegram_id.
export function groupsForSender(cfg: Config, telegramId: number): Group[] {
  return cfg.groups.filter((g) => g.contributors.some((c) => c.telegram_id === telegramId));
}

// Every distinct contributor across all groups, keyed by telegram_id.
export function allContributors(cfg: Config): Contributor[] {
  const seen = new Map<number, Contributor>();
  for (const g of cfg.groups) {
    for (const c of g.contributors) {
      if (!seen.has(c.telegram_id)) seen.set(c.telegram_id, c);
    }
  }
  return Array.from(seen.values());
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

export function repoRoot(): string {
  return REPO_ROOT;
}

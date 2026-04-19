// Runs hourly. At 08:00 Paris, anyone who missed yesterday gets an escalated
// DM. Dedup via reminders.json.

import { loadConfig, requireEnv } from "../src/config.ts";
import { localNow, yesterdayString } from "../src/time.ts";
import { loadReminders, loadSubmissions, safeSlug, saveReminders } from "../src/storage.ts";
import { Telegram } from "../src/telegram.ts";

const ESCALATION_HOUR = 8;

async function main(): Promise<void> {
  const cfg = loadConfig();
  const now = localNow(cfg.timezone);

  if (now.hour !== ESCALATION_HOUR) {
    console.log(`skip: Paris hour is ${now.hour}, escalation hour is ${ESCALATION_HOUR}`);
    return;
  }

  const yesterday = yesterdayString(cfg.timezone);
  const submissions = loadSubmissions();
  const postedSlugs = new Set(
    submissions.filter((s) => s.date === yesterday).map((s) => s.contributor),
  );

  const reminders = loadReminders();
  const tg = new Telegram(requireEnv("TELEGRAM_BOT_TOKEN"));

  let sent = 0;
  for (const c of cfg.contributors) {
    if (postedSlugs.has(safeSlug(c.name))) continue;
    const dedupKey = `${yesterday}:${c.telegram_id}`;
    if (reminders.yesterday_escalations[dedupKey]) continue;

    await tg.sendMessage(
      c.telegram_id,
      `${c.name}, you missed ${yesterday}. The month's journal will show it. Don't miss today.`,
    );
    reminders.yesterday_escalations[dedupKey] = new Date().toISOString();
    sent++;
  }

  saveReminders(reminders);
  console.log(`sent ${sent} escalation(s) for ${yesterday}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

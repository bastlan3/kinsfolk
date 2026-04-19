// Runs hourly. If the Paris clock reads `daily_deadline_hour`, DM every
// contributor who hasn't posted today yet. Dedup via reminders.json so
// reruns in the same hour don't double-send.

import { loadConfig, requireEnv } from "../src/config.ts";
import { localNow } from "../src/time.ts";
import { loadReminders, loadSubmissions, safeSlug, saveReminders } from "../src/storage.ts";
import { Telegram } from "../src/telegram.ts";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const now = localNow(cfg.timezone);

  if (now.hour !== cfg.daily_deadline_hour) {
    console.log(`skip: Paris hour is ${now.hour}, deadline hour is ${cfg.daily_deadline_hour}`);
    return;
  }

  const today = now.dateString;
  const submissions = loadSubmissions();
  const postedSlugs = new Set(
    submissions.filter((s) => s.date === today).map((s) => s.contributor),
  );

  const reminders = loadReminders();
  const tg = new Telegram(requireEnv("TELEGRAM_BOT_TOKEN"));

  let sent = 0;
  for (const c of cfg.contributors) {
    if (postedSlugs.has(safeSlug(c.name))) continue;
    const dedupKey = `${today}:${c.telegram_id}`;
    if (reminders.today_reminders[dedupKey]) continue;

    await tg.sendMessage(
      c.telegram_id,
      `Hey ${c.name} — quick nudge: no photo yet for today (${today}). Send one before midnight to keep the streak alive.`,
    );
    reminders.today_reminders[dedupKey] = new Date().toISOString();
    sent++;
  }

  saveReminders(reminders);
  console.log(`sent ${sent} reminder(s) for ${today}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

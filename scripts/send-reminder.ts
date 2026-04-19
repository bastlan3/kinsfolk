// Runs hourly. If Paris clock == daily_deadline_hour, DMs every contributor
// who hasn't posted today to ANY group. Dedup via reminders.json.
//
// Broadcast model: one photo DMed to the bot lands in every capsule the
// sender belongs to, so "posted today" is a per-person property — we don't
// need per-group reminders.

import { allContributors, loadConfig, requireEnv } from "../src/config.ts";
import { localNow } from "../src/time.ts";
import { loadReminders, loadSubmissions, saveReminders } from "../src/storage.ts";
import { Telegram } from "../src/telegram.ts";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const now = localNow(cfg.timezone);

  if (now.hour !== cfg.daily_deadline_hour) {
    console.log(`skip: Paris hour is ${now.hour}, deadline hour is ${cfg.daily_deadline_hour}`);
    return;
  }

  const today = now.dateString;
  const postedToday = new Set(
    loadSubmissions()
      .filter((s) => s.date === today)
      .map((s) => s.telegram_id),
  );

  const reminders = loadReminders();
  const tg = new Telegram(requireEnv("TELEGRAM_BOT_TOKEN"));

  let sent = 0;
  for (const c of allContributors(cfg)) {
    if (postedToday.has(c.telegram_id)) continue;
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

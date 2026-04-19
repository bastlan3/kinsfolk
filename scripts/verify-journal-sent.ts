// Safety net. Runs daily after the 1st. For each group whose previous-month
// send isn't recorded, DM every contributor of that group once so a human
// can investigate. Dedups via monthly_alerts keyed per group+month.

import { loadConfig, requireEnv } from "../src/config.ts";
import { localNow, monthName, previousMonth } from "../src/time.ts";
import { loadReminders, saveReminders } from "../src/storage.ts";
import { Telegram } from "../src/telegram.ts";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const now = localNow(cfg.timezone);

  if (now.day < 2) {
    console.log(`skip: day ${now.day} is too early to verify last month's send`);
    return;
  }

  const { year, month } = previousMonth(cfg.timezone);
  const monthLabel = `${monthName(month)} ${year}`;
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const reminders = loadReminders();
  const tg = new Telegram(requireEnv("TELEGRAM_BOT_TOKEN"));
  let alerted = 0;

  for (const group of cfg.groups) {
    const key = `${group.id}:${monthKey}`;
    if (reminders.monthly_sent[key]) {
      console.log(`[${group.id}] ok, sent at ${reminders.monthly_sent[key]}`);
      continue;
    }
    if (reminders.monthly_alerts[key]) {
      console.log(`[${group.id}] already alerted contributors`);
      continue;
    }

    const msg =
      `Kinsfolk safety alert: the ${monthLabel} journal for capsule "${group.name}" ` +
      `has NOT been sent yet. Open the repo's Actions tab, check the "Monthly journal" ` +
      `run from the 1st, and re-run it with Run workflow → force=1 once fixed.`;
    for (const c of group.contributors) {
      await tg.sendMessage(c.telegram_id, msg);
    }
    reminders.monthly_alerts[key] = new Date().toISOString();
    saveReminders(reminders);
    alerted++;
  }

  console.log(`alerted for ${alerted} group(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

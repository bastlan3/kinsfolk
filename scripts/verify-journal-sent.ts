// Safety net. Runs daily after the 1st. If the previous month's journal is
// missing from reminders.json (i.e. send-journal.ts didn't record a
// successful send), DM every contributor on Telegram so a human can
// investigate and trigger a manual send. Dedups via monthly_alerts.

import { loadConfig, requireEnv } from "../src/config.ts";
import { localNow, monthName, previousMonth } from "../src/time.ts";
import { loadReminders, saveReminders } from "../src/storage.ts";
import { Telegram } from "../src/telegram.ts";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const now = localNow(cfg.timezone);

  // Only meaningful after the send has had a chance to run.
  if (now.day < 2) {
    console.log(`skip: day ${now.day} is too early to verify last month's send`);
    return;
  }

  const { year, month } = previousMonth(cfg.timezone);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const reminders = loadReminders();

  if (reminders.monthly_sent[monthKey]) {
    console.log(`ok: ${monthKey} journal recorded as sent at ${reminders.monthly_sent[monthKey]}`);
    return;
  }

  if (reminders.monthly_alerts[monthKey]) {
    console.log(`already alerted contributors about missing ${monthKey} send`);
    return;
  }

  const tg = new Telegram(requireEnv("TELEGRAM_BOT_TOKEN"));
  const msg =
    `Kinsfolk safety alert: the ${monthName(month)} ${year} journal has NOT been sent yet. ` +
    `Open the repo's Actions tab, look at the "Monthly journal" run from the 1st, ` +
    `and re-run it manually (Run workflow → force=1) once the underlying issue is fixed.`;

  for (const c of cfg.contributors) {
    await tg.sendMessage(c.telegram_id, msg);
  }
  reminders.monthly_alerts[monthKey] = new Date().toISOString();
  saveReminders(reminders);
  console.log(`alerted ${cfg.contributors.length} contributor(s) about missing ${monthKey} send`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

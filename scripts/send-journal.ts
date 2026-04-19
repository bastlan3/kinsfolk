// Runs hourly on day 1. At 09:00 Paris, builds and sends the monthly journal
// for the just-finished month. Dedup via reminders.json so a rerun on the
// same day won't resend.

import { loadConfig, requireEnv } from "../src/config.ts";
import { localNow, monthName, previousMonth } from "../src/time.ts";
import { listEntriesForMonth, loadReminders, saveReminders } from "../src/storage.ts";
import { buildJournal } from "../src/journal.ts";
import { sendEmail } from "../src/mail.ts";

const SEND_HOUR = 9;

async function main(): Promise<void> {
  const cfg = loadConfig();
  const now = localNow(cfg.timezone);
  const force = process.env.FORCE === "1";

  if (!force) {
    if (now.day !== 1) {
      console.log(`skip: day is ${now.day}, only runs on day 1`);
      return;
    }
    if (now.hour !== SEND_HOUR) {
      console.log(`skip: Paris hour is ${now.hour}, send hour is ${SEND_HOUR}`);
      return;
    }
  }

  const { year, month } = previousMonth(cfg.timezone);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const reminders = loadReminders();
  if (!force && reminders.monthly_sent[monthKey]) {
    console.log(`skip: journal for ${monthKey} already sent`);
    return;
  }

  const entries = listEntriesForMonth(year, month);
  console.log(`found ${entries.length} entries for ${monthName(month)} ${year}`);

  const journal = buildJournal({
    year,
    month,
    entries,
    contributors: cfg.contributors,
    subject_template: cfg.journal.subject_template,
  });

  const from = `${cfg.journal.from_name} <${cfg.journal.from_email}>`;
  await sendEmail({
    apiKey: requireEnv("RESEND_API_KEY"),
    from,
    to: cfg.receivers,
    replyTo: cfg.journal.reply_to || undefined,
    subject: journal.subject,
    html: journal.html,
    attachments: journal.attachments,
  });

  reminders.monthly_sent[monthKey] = new Date().toISOString();
  saveReminders(reminders);
  console.log(`journal ${monthKey} sent to ${cfg.receivers.length} receiver(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

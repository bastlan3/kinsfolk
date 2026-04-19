// Runs hourly on day 1. At 09:00 Paris, builds and sends one journal per
// group for the just-finished month. Dedup via reminders.monthly_sent per
// group so reruns won't resend.

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
  const monthLabel = `${monthName(month)} ${year}`;
  const apiKey = requireEnv("RESEND_API_KEY");
  const reminders = loadReminders();

  let sentGroups = 0;
  let skippedGroups = 0;

  for (const group of cfg.groups) {
    const key = `${group.id}:${year}-${String(month).padStart(2, "0")}`;
    if (!force && reminders.monthly_sent[key]) {
      console.log(`skip ${group.id}: already sent at ${reminders.monthly_sent[key]}`);
      skippedGroups++;
      continue;
    }

    const entries = listEntriesForMonth(group.id, year, month);
    console.log(`[${group.id}] ${entries.length} entries for ${monthLabel}`);

    const journal = buildJournal({
      year,
      month,
      groupName: group.name,
      entries,
      contributors: group.contributors,
      subject_template: group.journal.subject_template,
    });

    const from = `${group.journal.from_name} <${group.journal.from_email}>`;
    await sendEmail({
      apiKey,
      from,
      to: group.receivers,
      replyTo: group.journal.reply_to || undefined,
      subject: journal.subject,
      html: journal.html,
      attachments: journal.attachments,
    });

    reminders.monthly_sent[key] = new Date().toISOString();
    saveReminders(reminders); // persist incrementally in case a later group throws
    sentGroups++;
  }

  console.log(`done: sent ${sentGroups} group(s), skipped ${skippedGroups}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

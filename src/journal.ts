import { readFileSync } from "node:fs";
import type { MonthEntry } from "./storage.ts";
import type { Attachment } from "./mail.ts";
import { daysInMonth, monthName } from "./time.ts";
import type { Contributor } from "./config.ts";
import { formatLocation } from "./exif.ts";

export interface BuiltJournal {
  subject: string;
  html: string;
  attachments: Attachment[];
}

export interface BuildJournalInput {
  year: number;
  month: number;
  groupName: string;
  entries: MonthEntry[];
  contributors: Contributor[];
  subject_template: string;
}

// Produces an HTML email with all days of the month listed in order. Photos
// reference their attachment via cid: so they render inline across Gmail,
// Apple Mail, and Outlook.
export function buildJournal(input: BuildJournalInput): BuiltJournal {
  const { year, month, groupName, entries, contributors, subject_template } = input;
  const totalDays = daysInMonth(year, month);
  const mName = monthName(month);

  const subject = subject_template
    .replaceAll("{month_name}", mName)
    .replaceAll("{year}", String(year))
    .replaceAll("{group_name}", groupName);

  const attachments: Attachment[] = [];
  const perDay = groupByDay(entries);

  const expectedDays = Array.from({ length: totalDays }, (_, i) => i + 1);
  const missSummary: { name: string; posted: number; missed: number }[] = [];
  for (const c of contributors) {
    const slug = slugFor(c.name);
    let posted = 0;
    for (const d of expectedDays) {
      const dayEntries = perDay.get(pad2(d)) ?? [];
      if (dayEntries.some((e) => e.contributor === slug)) posted++;
    }
    missSummary.push({ name: c.name, posted, missed: totalDays - posted });
  }

  const dayBlocks: string[] = [];
  for (const d of expectedDays) {
    const dayEntries = perDay.get(pad2(d)) ?? [];
    if (dayEntries.length === 0) {
      dayBlocks.push(renderEmptyDay(year, month, d));
      continue;
    }
    const imgs: string[] = [];
    for (let i = 0; i < dayEntries.length; i++) {
      const e = dayEntries[i];
      const cid = `img-${year}-${pad2(month)}-${pad2(d)}-${i}`;
      const ext = e.absPath.split(".").pop()?.toLowerCase() ?? "jpg";
      attachments.push({
        filename: `${e.date}-${e.contributor}-${i}.${ext}`,
        content: readFileSync(e.absPath),
        content_id: cid,
      });
      const contribName = displayName(contributors, e.contributor);
      const locationLabel = formatLocation(e.location);
      imgs.push(renderPhoto(cid, contribName, e.caption, locationLabel));
    }
    dayBlocks.push(renderDay(year, month, d, imgs.join("")));
  }

  const html = renderDocument({
    groupName,
    mName,
    year,
    totalDays,
    missSummary,
    days: dayBlocks.join("\n"),
    totalPhotos: entries.length,
  });

  return { subject, html, attachments };
}

// ---- helpers ----

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function groupByDay(entries: MonthEntry[]): Map<string, MonthEntry[]> {
  const out = new Map<string, MonthEntry[]>();
  for (const e of entries) {
    const d = e.date.slice(8, 10);
    if (!out.has(d)) out.set(d, []);
    out.get(d)!.push(e);
  }
  return out;
}

function slugFor(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "contributor";
}

function displayName(contributors: Contributor[], slug: string): string {
  const match = contributors.find((c) => slugFor(c.name) === slug);
  return match?.name ?? slug;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- rendering ----

function renderDocument(p: {
  groupName: string;
  mName: string;
  year: number;
  totalDays: number;
  missSummary: { name: string; posted: number; missed: number }[];
  days: string;
  totalPhotos: number;
}): string {
  const rows = p.missSummary
    .map(
      (s) =>
        `<tr><td style="padding:4px 12px 4px 0;">${escape(s.name)}</td>` +
        `<td style="padding:4px 12px;color:#2a7a2a;">${s.posted} posted</td>` +
        `<td style="padding:4px 0;color:${s.missed > 0 ? "#b04a4a" : "#888"};">${s.missed} missed</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Kinsfolk — ${escape(p.groupName)} — ${p.mName} ${p.year}</title></head>
<body style="margin:0;padding:0;background:#f7f5f1;font-family:Georgia,'Times New Roman',serif;color:#2a2a2a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f1;">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;margin:24px 0;border:1px solid #e6e2da;">
        <tr><td style="padding:40px 40px 24px 40px;text-align:center;border-bottom:1px solid #e6e2da;">
          <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#8a7a5a;">Kinsfolk · ${escape(p.groupName)}</div>
          <h1 style="margin:12px 0 4px 0;font-size:32px;font-weight:normal;">${p.mName} ${p.year}</h1>
          <div style="color:#888;font-size:14px;">${p.totalPhotos} photo${p.totalPhotos === 1 ? "" : "s"} across ${p.totalDays} days</div>
        </td></tr>
        <tr><td style="padding:24px 40px;border-bottom:1px solid #f0ede7;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;">${rows}</table>
        </td></tr>
        <tr><td style="padding:24px 40px 40px 40px;">
          ${p.days}
        </td></tr>
        <tr><td style="padding:24px 40px;background:#faf8f4;text-align:center;color:#8a7a5a;font-size:12px;border-top:1px solid #e6e2da;">
          Sent by Kinsfolk, from our little corner of the family to yours.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function renderDay(year: number, month: number, day: number, innerImgs: string): string {
  const dateLabel = `${monthName(month)} ${day}, ${year}`;
  return `<div style="margin:0 0 36px 0;">
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a7a5a;margin-bottom:8px;">${escape(dateLabel)}</div>
    ${innerImgs}
  </div>`;
}

function renderEmptyDay(year: number, month: number, day: number): string {
  const dateLabel = `${monthName(month)} ${day}, ${year}`;
  return `<div style="margin:0 0 24px 0;opacity:0.5;">
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#b8ad95;">${escape(dateLabel)} — no photo</div>
  </div>`;
}

function renderPhoto(cid: string, who: string, caption: string, locationLabel: string | null): string {
  const cap = caption.trim();
  const capHtml = cap
    ? `<div style="margin-top:8px;font-style:italic;color:#555;font-size:15px;line-height:1.5;">${escape(cap)}</div>`
    : "";
  const locHtml = locationLabel
    ? `<div style="margin-top:6px;font-size:13px;color:#6b5e44;">📍 ${escape(locationLabel)}</div>`
    : "";
  const byline = `<div style="margin-top:4px;font-size:12px;color:#8a7a5a;">by ${escape(who)}</div>`;
  return `<div style="margin-bottom:20px;">
    <img src="cid:${cid}" alt="" style="display:block;width:100%;max-width:560px;height:auto;border:1px solid #e6e2da;" />
    ${capHtml}
    ${locHtml}
    ${byline}
  </div>`;
}

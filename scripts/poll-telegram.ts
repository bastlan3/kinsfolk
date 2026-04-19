// Polls Telegram for new updates, saves photos from allowlisted contributors,
// updates state, and acks the sender. Intended to be run every 5 minutes.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { loadConfig, requireEnv } from "../src/config.ts";
import { localNow } from "../src/time.ts";
import {
  dayDir,
  loadOffset,
  loadSubmissions,
  safeSlug,
  saveOffset,
  saveSubmissions,
  type Submission,
} from "../src/storage.ts";
import { bestPhoto, Telegram, type TgMessage } from "../src/telegram.ts";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  const tg = new Telegram(token);

  const allow = new Map<number, string>();
  for (const c of cfg.contributors) allow.set(c.telegram_id, c.name);

  const state = loadOffset();
  const updates = await tg.getUpdates(state.offset);
  if (updates.length === 0) {
    console.log("no new updates");
    return;
  }
  console.log(`got ${updates.length} update(s)`);

  const submissions = loadSubmissions();
  let maxSeen = state.offset - 1;

  for (const u of updates) {
    maxSeen = Math.max(maxSeen, u.update_id);
    const msg = u.message;
    if (!msg || !msg.from) continue;

    const fromId = msg.from.id;
    const name = allow.get(fromId);
    if (!name) {
      console.log(`ignoring message from non-contributor ${fromId}`);
      continue;
    }

    if (msg.text && !msg.photo && !msg.document) {
      // Friendly help for bare text.
      await tg.sendMessage(
        msg.chat.id,
        "Send me a photo (with an optional caption) and I'll add it to today's capsule. That's it!",
      );
      continue;
    }

    const photoBuffer = await downloadIncomingImage(tg, msg);
    if (!photoBuffer) {
      await tg.sendMessage(msg.chat.id, "Hmm, I could only handle that if it were a photo. Try again with an image?");
      continue;
    }

    const today = localNow(cfg.timezone).dateString;
    const dir = dayDir(today, name);
    mkdirSync(dir, { recursive: true });

    const resized = await sharp(photoBuffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    const seq = nextSequenceNumber(dir);
    const filename = `${String(seq).padStart(3, "0")}.jpg`;
    writeFileSync(join(dir, filename), resized);

    const caption = (msg.caption ?? "").trim();
    if (caption) {
      writeFileSync(join(dir, "caption.txt"), caption + "\n");
    }

    submissions.push({
      date: today,
      contributor: safeSlug(name),
      telegram_id: fromId,
      caption,
      file_relpath: `entries/${today.replace(/-/g, "/")}/${safeSlug(name)}/${filename}`,
      received_at: new Date().toISOString(),
    } satisfies Submission);

    await tg.sendMessage(
      msg.chat.id,
      `Got it ✓ — saved to ${today}. ${caption ? "Caption noted." : "Add a caption next time if you want one."}`,
    );
    console.log(`saved photo from ${name} for ${today}`);
  }

  saveSubmissions(submissions);
  saveOffset({ offset: maxSeen + 1 });
}

async function downloadIncomingImage(tg: Telegram, msg: TgMessage): Promise<Buffer | null> {
  if (msg.photo && msg.photo.length > 0) {
    const photo = bestPhoto(msg.photo);
    const path = await tg.getFilePath(photo.file_id);
    return tg.downloadFile(path);
  }
  if (msg.document && msg.document.mime_type?.startsWith("image/")) {
    const path = await tg.getFilePath(msg.document.file_id);
    return tg.downloadFile(path);
  }
  return null;
}

function nextSequenceNumber(dir: string): number {
  if (!existsSync(dir)) return 1;
  const nums = readdirSync(dir)
    .map((f) => /^(\d+)\.jpe?g$/i.exec(f)?.[1])
    .filter((s): s is string => Boolean(s))
    .map((s) => Number(s));
  if (nums.length === 0) return 1;
  return Math.max(...nums) + 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

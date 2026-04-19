# Kinsfolk

A family photo capsule that runs entirely on GitHub Actions.

- Each contributor DMs a private Telegram bot a photo per day.
- One bot, multiple **capsules** (groups): every DM is copied into every capsule the sender belongs to.
- Missed days trigger escalating reminders.
- On the 1st of each month, every capsule sends its own HTML email with the previous month's photos inline.
- If a photo carries GPS in its EXIF metadata, the journal labels it "📍 Town, Country".

No server. No frontend. Just cron.

## One-time setup

1. **Make the repo private.** Photos will be committed into it.
2. **Create a Telegram bot.**
   - Message `@BotFather`, run `/newbot`, copy the token.
   - Each contributor messages `@userinfobot` once to get their numeric Telegram ID.
   - Each contributor then sends `/start` to the new bot (required before the bot can DM them).
3. **Get a Resend API key** at resend.com (free tier is plenty).
4. **Add repo secrets** (Settings → Secrets and variables → Actions):
   - `TELEGRAM_BOT_TOKEN`
   - `RESEND_API_KEY`
5. **Edit `config.yml`:** fill in `groups`. Each group has its own contributors and receivers.
6. **Commit, push.** GitHub Actions does the rest.

## Capsules (groups)

Define as many as you want. Each gets its own monthly journal to its own receiver list.

```yaml
groups:
  - id: maternal
    name: "My parents"
    contributors:
      - { name: "Me",      telegram_id: 111 }
      - { name: "Sister",  telegram_id: 222 }
    receivers:
      - "mom@example.com"

  - id: partner
    name: "Laura's parents"
    contributors:
      - { name: "Me",    telegram_id: 111 }
      - { name: "Laura", telegram_id: 333 }
    receivers:
      - "laurasmom@example.com"
```

**Broadcast model:** if you (telegram_id 111) DM the bot one photo, it lands in **both** `maternal` and `partner`. That's by design — one shot, two audiences. Contributors only in one group are unaffected.

Add or remove someone by editing `config.yml` and pushing. The bot ignores messages from anyone not listed in at least one group.

## Location (GPS)

If a photo's EXIF has GPS coords, the bot reverse-geocodes them once via OpenStreetMap's free Nominatim service and labels the journal entry "📍 Paris, France".

**Important Telegram gotcha:** sending a photo as a **photo** (the default) strips EXIF. To preserve GPS, contributors must send the image as a **file**: in the Telegram compose view, tap 📎 → File → pick the image. The bot accepts both; the ack message tells you whether location was detected.

Set `reverse_geocode: false` in `config.yml` to skip the Nominatim call entirely (no data leaves the repo).

## Verifying it works

- Send a photo to the bot. Within ~5 min it replies "Got it" and a file appears under `entries/<group>/YYYY/MM/DD/<your-name>/`.
- On the 1st of next month, a journal lands in every group's receivers' inboxes.
- You can trigger any workflow manually from the Actions tab. The journal workflow has a `force=1` input to bypass the date/hour guards.
- **Safety net:** on day 2+, a daily workflow checks whether each group's previous-month journal was recorded as sent. If not, every contributor of that group gets a Telegram DM telling them to investigate.
- Run `npm run smoke` locally to exercise 43 assertions across time math, storage, image pipeline, EXIF, journal HTML, and multi-group isolation. No network, no secrets.

## How it works

| Workflow | Schedule | Does |
|---|---|---|
| `poll-telegram.yml` | every 5 min | Calls Telegram `getUpdates`, saves new photos to every group the sender is in, extracts GPS, reverse-geocodes. Commits. |
| `daily-reminder.yml` | hourly, acts at 20:00 Paris | DMs contributors who haven't posted today (to any group). |
| `daily-miss-check.yml` | hourly, acts at 08:00 Paris | DMs an escalation if yesterday was missed. |
| `monthly-journal.yml` | hourly on day 1, acts at 09:00 Paris | Sends one HTML email per group via Resend. |
| `verify-journal-sent.yml` | daily at 10:00 UTC | Alerts group contributors if the previous month's journal was never sent. |

Cron is UTC, so each reminder job runs hourly and the script exits early if the Paris clock isn't at the right hour. DST just works.

## File layout

```
entries/<group_id>/YYYY/MM/DD/<name>/001.jpg
entries/<group_id>/YYYY/MM/DD/<name>/caption.txt      (optional)
entries/<group_id>/YYYY/MM/DD/<name>/location.json    (optional: {lat, lon, city?, country?})
state/telegram-offset.json                            last processed update_id
state/submissions.json                                every submission, tagged with group_id
state/reminders.json                                  reminder + monthly-send dedup
config.yml                                            capsule definitions (you edit this)
```

## Swapping the sender domain

Until you verify a domain with Resend, emails go from `onboarding@resend.dev`. Some providers mark that as spam. Verify your own domain in Resend, then set `journal.from_email` in each group (or in `defaults.journal` to apply to all).

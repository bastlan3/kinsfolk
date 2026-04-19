# Kinsfolk

A family photo capsule that runs entirely on GitHub Actions.

- Each contributor DMs a private Telegram bot a photo per day.
- Missed days trigger escalating reminders.
- On the 1st of each month, every receiver gets an HTML email with the previous month's photos inline.

No server. No frontend. Just cron.

## One-time setup

1. **Make the repo private.** Photos will be committed into it.
2. **Create a Telegram bot.**
   - Message `@BotFather`, run `/newbot`, name it.
   - Copy the bot token.
   - Each contributor messages `@userinfobot` once to get their numeric Telegram ID.
   - Have each contributor send `/start` to the new bot (required before the bot can DM them).
3. **Get a Resend API key.** Sign up at https://resend.com and create a key.
4. **Add repo secrets** (Settings → Secrets and variables → Actions):
   - `TELEGRAM_BOT_TOKEN`
   - `RESEND_API_KEY`
5. **Edit `config.yml`:** fill in `contributors` (name + telegram_id) and `receivers` (emails).
6. **Commit, push.** Done. GitHub Actions does the rest.

## Verifying it works

- Send a photo to the bot. Within ~5 minutes it replies "Got it" and a file appears under `entries/YYYY/MM/DD/<your-name>/`.
- On the 1st, a journal lands in receivers' inboxes for the previous month.
- You can also run any workflow manually from the Actions tab.

## How it works

| Workflow | Schedule | Does |
|---|---|---|
| `poll-telegram.yml` | every 5 min | Calls Telegram `getUpdates`, saves new photos, commits them. |
| `daily-reminder.yml` | hourly, acts at 20:00 Paris | DMs contributors who haven't posted today. |
| `daily-miss-check.yml` | hourly, acts at 08:00 Paris | DMs an escalated reminder for yesterday's misses. |
| `monthly-journal.yml` | hourly on day 1, acts at 09:00 Paris | Sends the HTML journal email via Resend. |

Cron is UTC, so each job runs hourly and the script exits early if the Paris clock isn't at the right hour. DST just works.

## File layout

```
entries/YYYY/MM/DD/<name>/image.jpg
entries/YYYY/MM/DD/<name>/caption.txt   (optional, photo's Telegram caption)
state/telegram-offset.json              last processed update_id
state/submissions.json                  index of every submission
state/reminders.json                    which reminders were sent today
config.yml                              contributors + receivers (you edit this)
```

## Swapping the sender domain

Until you verify a domain with Resend, emails go from `onboarding@resend.dev`. Some providers mark that as spam. To fix: verify a domain in Resend, then change `journal.from_email` in `config.yml`.

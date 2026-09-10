# instadrop Telegram Bot

A fast, multilingual **Instagram downloader bot** for Telegram, running as a single
serverless function on [Vercel](https://vercel.com).

**Bot:** [t.me/Instadrop_tgbot](https://t.me/Instadrop_tgbot)
**Website:** https://instadrop.web.app/

Just paste an Instagram link into the chat and the bot sends the media back.

---

## Features

- **Supported content:** Posts, Carousels, Reels, Stories, Highlights, Profiles
- **Media details:** username, caption, upload date, likes, comments, views, plays,
  reshares, profile followers/following/post counts, verification & private status
- **Cover photos:** pull the cover/thumbnail of a video or reel
- **9 languages:** English, Russian, Uzbek, Indonesian, Arabic, Ukrainian, Persian,
  Turkish, Hindi
- **Auto language detection** from the user's Telegram `language_code` on first contact
- **Heart reaction** (`❤`) automatically added to any message containing a link
- **Admin notification** on each new user's first `/start`
- **Inline buttons** for language selection, cover photos and media details
- **Graceful fallbacks:** video → document, photo → document → text error

---

## How it works

```
Telegram ──(webhook POST)──▶  Vercel function (bot.js)  ──▶  instadrop download API
                                       │                            (Cloudflare Worker)
                                       ▼
                              Telegram Bot API (send media / messages)
```

1. Telegram delivers every update to the Vercel function via a webhook (`POST`).
2. The handler checks for a callback query (button press) or a text message.
3. If a message contains an Instagram URL, it is forwarded to the download API.
4. The API's JSON response is parsed, media is extracted, and the bot sends the
   photo/video (with a details/cover keyboard) back to the user.

---

## Commands

| Command        | Description                                       |
| -------------- | ------------------------------------------------- |
| `/start`       | Welcome message with feature overview + buttons   |
| `/language`    | Open the language selection menu                  |
| `/help`        | Help text in the user's current language          |

Sending any Instagram link triggers a download. Non-link text gets a friendly
"send me an Instagram link" prompt.

### Inline buttons

- **🌍 Choose language** → opens the language menu (`open_language`)
- **🌐 Open instadrop** → link to the website
- **🖼️ Get Cover Photo** → sends the cover/thumbnail (`get_cover:<id>`)
- **📋 Get Details** → sends formatted media metadata (`get_details:<id>`)
- Language buttons → `lang:<code>`

---

## Configuration

All configuration is via environment variables (set these in your Vercel project):

| Variable             | Required | Description                                             |
| -------------------- | -------- | ------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN` | Yes      | Token from [@BotFather](https://t.me/BotFather)         |
| `ADMIN_CHAT_ID`      | Yes      | Chat ID that receives new-user notifications            |
| `API_KEY`            | Yes      | API key for the download service (`X-API-Key` header)   |

Hardcoded constants at the top of `bot.js`:

| Constant        | Value                                                |
| --------------- | ---------------------------------------------------- |
| `API_URL`       | `https://instadrop.rishu-rishad2019.workers.dev/?url=` |
| `WELCOME_IMAGE` | `https://instadrop.web.app/og-image.png`             |
| `WEBSITE_URL`   | `https://instadrop.web.app/`                         |

---

## Deployment (Vercel)

1. Push this code to a Git repository and import it into Vercel, **or** deploy the
   file as an API route, e.g. `api/bot.js` (the default export is the webhook handler).
2. Add the three environment variables above.
3. Deploy, then register the webhook with Telegram:

   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-project>.vercel.app/api/bot"
   ```

4. Verify:

   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```

   You can also open the deployed URL in a browser — a `GET` returns
   `{"ok":true,"message":"instadrop Telegram bot is running."}`.

> **Runtime:** requires **Node.js 18+** (uses global `fetch` and `AbortSignal.timeout`).

---

## Project structure

The entire bot lives in a single file, `bot.js`, organised into sections:

| Section                     | Purpose                                                        |
| --------------------------- | ------------------------------------------------------------- |
| Configuration               | Env vars and hardcoded constants                              |
| Temporary storage           | In-memory maps/sets for media, notified users, language prefs |
| Supported languages         | The `LANGUAGES` table                                          |
| Translations                | The `TEXT` table (all UI strings, per language)               |
| Language helpers            | `getLanguage`, `setLanguage`, `t`, `languageKeyboard`         |
| Telegram API                | `telegram(method, payload)` — wraps the Bot API               |
| Basic helpers               | URL validation/cleanup, ID generation, truncation             |
| Link detection              | Instagram URL + generic URL extraction                        |
| Media parsing               | Response type / reel detection / media & cover extraction     |
| Storage & keyboards         | `storeMedia`, `buildMediaKeyboard`                            |
| Details formatting          | `formatDetails` — builds localized metadata text              |
| Sending                     | `sendMedia`, `sendCollectionHeader`, `notifyAdmin`, welcome   |
| Handlers                    | `handleCallback`, `processInstagramUrl`                       |
| Webhook                     | `export default async function handler(req, res)`             |

---

## Adding a language

1. Add an entry to `LANGUAGES` (code → `{ name, flag }`).
2. Add the code to every key in the `TEXT` table (fall back to English if omitted —
   `t()` returns `TEXT[key].en` when a translation is missing).
3. Add a button to `languageKeyboard()` with `callback_data: "lang:<code>"`.
4. Map the user's Telegram `language_code` in `automaticLanguageMap` (in the webhook
   handler) so it's auto-detected.
5. Inline per-field label maps inside `formatDetails()` may also need the new code.

---

## Known limitations

- **In-memory state:** `mediaStorage`, `notifiedUsers` and `userLanguages` are
  in-memory `Map`/`Set` objects. On serverless they are **not shared between
  instances and are lost on cold starts**, so stored media/details expire early and
  language preferences and the "new user" notification may reset. For production
  reliability, back these with a persistent store (e.g. Redis / Vercel KV / Upstash)
  or keep them inside the download service.
- **Storage TTL:** stored media/details are kept for **30 minutes** (`STORAGE_TTL`).
- The download API URL and website are hardcoded; change them at the top of `bot.js`
  if you self-host the backend.

---

## License

Provided as-is. Respect Instagram's Terms of Service and applicable copyright law
when using this bot.

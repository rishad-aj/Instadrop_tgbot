/**
 * =====================================================================
 *  InstaDrop — Telegram Bot  (Vercel serverless function, Node 18+)
 *  Downloads Instagram posts, reels, carousels, stories, highlights
 *  and profile pictures via the InstaDrop resolver worker.
 *
 *  FILES
 *  -----
 *  api/bot.js              <- this file
 *  package.json            <- { "dependencies": { "telegraf": "^4.16.3" } }
 *  vercel.json (optional)  <- { "functions": { "api/bot.js": { "maxDuration": 60 } } }
 *                             (hobby plans allow up to 60 s; default is 10 s —
 *                              raise it if your resolver runs slow)
 *
 *  ENVIRONMENT VARIABLES (Vercel -> Project -> Settings -> Env Vars)
 *  -----------------------------------------------------------------
 *  BOT_TOKEN             (required) token from @BotFather
 *  WEBHOOK_SECRET        (recommended) any long random string
 *  WEBSITE_URL           default https://instadrop.web.app/
 *  START_IMAGE           default https://instadrop.web.app/og-image.png
 *  RESOLVER_API          default https://instadrop.rishu-rishad2019.workers.dev/
 *  RESOLVE_TIMEOUT_MS    default 9000
 *
 *  NOTE: the resolver worker itself must have its IG_SESSIONID env var set,
 *  otherwise every request returns "Server has no IG session configured."
 *
 *  DEPLOY
 *  ------
 *  1. npm init -y && npm i telegraf@^4.16.3
 *  2. save this file as api/bot.js, add the env vars, deploy to Vercel.
 *  3. point Telegram at the deployed function (run once, from your machine):
 *       curl https://api.telegram.org/bot$BOT_TOKEN/deleteWebhook?drop_pending_updates=true
 *       curl -F "url=https://<your-app>.vercel.app/api/bot" \
 *            -F "secret_token=$WEBHOOK_SECRET" \
 *            https://api.telegram.org/bot$BOT_TOKEN/setWebhook
 *  4. optional — nice /start + /help menu buttons:
 *       curl -F "commands=[{\"command\":\"start\",\"description\":\"Start InstaDrop\"},{\"command\":\"help\",\"description\":\"How to use the bot\"}]" \
 *            https://api.telegram.org/bot$BOT_TOKEN/setMyCommands
 *
 *  USAGE
 *  -----
 *  Just send the bot any Instagram link:
 *    https://instagram.com/reel/CODE    https://instagram.com/p/CODE
 *    https://instagram.com/stories/user/ID   .../highlights/ID
 *    https://instagram.com/username    (profile picture)
 *  A bare 11-character media code or a bare username also works.
 * =====================================================================
 */
"use strict";

const { Telegraf } = require("telegraf");

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */
const BOT_TOKEN = process.env.BOT_TOKEN || "";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";
const WEBSITE_URL = process.env.WEBSITE_URL || "https://instadrop.web.app/";
const START_IMAGE = process.env.START_IMAGE || "https://instadrop.web.app/og-image.png";
const RESOLVER_API = process.env.RESOLVER_API || "https://instadrop.rishu-rishad2019.workers.dev/";
const RESOLVE_TIMEOUT_MS = parseInt(process.env.RESOLVE_TIMEOUT_MS || "9000", 10) || 9000;

const MAX_CAPTION = 1024;
const MAX_RELAY_BYTES = 45 * 1024 * 1024; // Telegram bot upload limit (we only relay on URL-send failure)

if (!BOT_TOKEN) {
  throw new Error("InstaDrop: BOT_TOKEN env var is missing — add it in Vercel env vars.");
}

const bot = new Telegraf(BOT_TOKEN);

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return trimZero((n / 1e6).toFixed(1)) + "M";
  if (n >= 1e3) return trimZero((n / 1e3).toFixed(1)) + "K";
  return String(n);
}
function trimZero(s) {
  return s.replace(/\.0$/, "");
}

function truncate(s, max) {
  s = String(s ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/* ------------------------------------------------------------------ */
/* Resolver API                                                        */
/* ------------------------------------------------------------------ */
async function resolveMedia(target) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RESOLVE_TIMEOUT_MS);
  try {
    const sep = RESOLVER_API.includes("?") ? "&url=" : "?url=";
    const res = await fetch(RESOLVER_API + sep + encodeURIComponent(target), {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "InstaDrop-Telegram-Bot/1.0" },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error((data && data.error) || ("Resolver error HTTP " + res.status));
    if (data.error) throw new Error(data.error);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Detection — pull an Instagram target out of a user message          */
/* ------------------------------------------------------------------ */
function extractTarget(text) {
  text = (text || "").trim();
  if (!text) return null;

  const link = text.match(/https?:\/\/[^\s<>"')\]]+/i);
  if (link && /(instagram\.com|instagr\.am|ig\.me)/i.test(link[0])) {
    return link[0].replace(/[.,;:!?]+$/, "");
  }

  const words = text.split(/\s+/);
  if (words.length === 1) {
    let w = words[0];
    if (w.startsWith("@")) w = w.slice(1);
    if (/^[A-Za-z0-9_-]{11}$/.test(w)) return w; // bare media short code
    if (/^[A-Za-z0-9._]{2,30}$/.test(w) && !/^\d+$/.test(w)) return w; // profile username
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Turn a resolver payload into a flat list of media pieces            */
/* ------------------------------------------------------------------ */
function collectMedia(payload) {
  const items = Array.isArray(payload.items) && payload.items.length ? payload.items : [payload];
  const media = [];
  for (const item of items) {
    for (const img of item.image || []) media.push({ type: "photo", url: img });
    for (const v of item.video || []) {
      const url = typeof v === "string" ? v : v && v.video;
      const cover = v && typeof v === "object" ? v.cover : null;
      if (url) media.push({ type: "video", url, cover });
    }
  }
  return media;
}

/* ------------------------------------------------------------------ */
/* Caption (HTML)                                                      */
/* ------------------------------------------------------------------ */
function buildCaption(payload) {
  const lines = [];

  const head = [];
  if (payload.username) head.push("<b>@" + esc(payload.username) + "</b>");
  if (payload.full_name) head.push(esc(truncate(payload.full_name, 60)));
  if (head.length) lines.push(head.join("  ·  "));

  const stats = [];
  const defs = [
    ["follower_count", "👥"],
    ["post_count", "🗂️"],
    ["like_count", "❤️"],
    ["comment_count", "💬"],
    ["view_count", "👁️"],
    ["play_count", "▶️"],
  ];
  for (const [key, icon] of defs) {
    const v = payload[key];
    if (v != null && Number(v) > 0) stats.push(icon + " " + fmt(v));
  }
  if (stats.length) lines.push(stats.join("   "));

  const tags = [];
  if (payload.is_verified) tags.push("✅ Verified");
  if (payload.is_business) tags.push("🏢 Business");
  if (payload.is_private) tags.push("🔒 Private");
  if (tags.length) lines.push(tags.join(" · "));

  const text = payload.highlight_title || payload.bio || payload.caption || "";
  if (text && !(payload.type === "dp")) lines.push("📝 " + esc(truncate(text, 220)));

  const footer = "⬇️ <a href=\"" + WEBSITE_URL.replace(/&/g, "&amp;").replace(/"/g, "") + "\">InstaDrop</a>";
  let body = lines.join("\n");
  const room = MAX_CAPTION - footer.length - 2;
  if (body.length > room) body = body.slice(0, room) + "…";
  return (body ? body + "\n" : "") + footer;
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */
async function downloadBuffer(url) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36" } });
  if (!r.ok) throw new Error("download failed (HTTP " + r.status + ")");
  const ab = await r.arrayBuffer();
  if (ab.byteLength > MAX_RELAY_BYTES) throw new Error("file is larger than 45 MB — Telegram refuses files that big");
  return Buffer.from(ab);
}

async function sendSingle(ctx, media, caption) {
  caption = caption || undefined;
  try {
    if (media.type === "photo") {
      await ctx.replyWithPhoto(media.url, { caption, parse_mode: "HTML" });
    } else {
      const opts = { caption, parse_mode: "HTML" };
      if (media.cover) opts.thumbnail = { url: media.cover };
      await ctx.replyWithVideo(media.url, opts);
    }
  } catch (err) {
    // Telegram couldn't fetch the CDN URL itself — download and upload instead.
    console.warn("URL send failed, relaying file:", err.description || err.message);
    const buf = await downloadBuffer(media.url);
    if (media.type === "photo") {
      await ctx.replyWithPhoto({ source: buf, filename: "instadrop.jpg" }, { caption, parse_mode: "HTML" });
    } else {
      const opts = { caption, parse_mode: "HTML" };
      if (media.cover) {
        try { opts.thumbnail = { source: await downloadBuffer(media.cover), filename: "cover.jpg" }; } catch { /* optional */ }
      }
      await ctx.replyWithVideo({ source: buf, filename: "instadrop.mp4" }, opts);
    }
  }
}

async function sendCollection(ctx, media, caption) {
  if (media.length === 1) return sendSingle(ctx, media[0], caption);

  for (let i = 0; i < media.length; i += 10) {
    const chunk = media.slice(i, i + 10);
    const input = chunk.map((m) =>
      m.type === "photo"
        ? { type: "photo", media: m.url }
        : { type: "video", media: m.url, ...(m.cover ? { thumbnail: m.cover } : {}) }
    );
    if (i === 0 && caption) Object.assign(input[0], { caption, parse_mode: "HTML" });

    try {
      await ctx.replyWithMediaGroup(input);
    } catch (err) {
      // Group failed (one bad URL breaks the whole album) — send one by one.
      console.warn("media group failed, sending individually:", err.description || err.message);
      for (const m of chunk) await sendSingle(ctx, m, i === 0 && caption ? caption : "");
    }
  }
}

/* ------------------------------------------------------------------ */
/* Main flow                                                           */
/* ------------------------------------------------------------------ */
async function processTarget(ctx, target) {
  let statusMsg = null;
  try {
    statusMsg = await ctx.reply("⏳ Downloading…");
  } catch { /* ignore */ }

  try {
    const payload = await resolveMedia(target);
    const media = collectMedia(payload);
    if (!media.length) throw new Error("Nothing downloadable was found for that link.");
    await sendCollection(ctx, media, buildCaption(payload));
  } catch (err) {
    console.error("processTarget failed:", err && (err.message || err.description || err));
    const timedOut = err && err.name === "AbortError";
    const reason = timedOut
      ? "The downloader took too long — please try again in a moment."
      : (err && err.message) || "Something went wrong.";
    try {
      await ctx.reply("❌ " + esc(reason));
    } catch { /* bot blocked etc. */ }
  } finally {
    if (statusMsg) {
      try { await ctx.deleteMessage(statusMsg.message_id); } catch { /* already gone */ }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */
const websiteButton = { reply_markup: { inline_keyboard: [[{ text: "🌐 Open Website", url: WEBSITE_URL }]] } };

bot.start(async (ctx) => {
  const caption = [
    "<b>InstaDrop</b> — Instagram downloader bot",
    "",
    "Send me an Instagram link and I'll fetch the media for you:",
    "",
    "🎬 Posts & Reels",
    "🖼️ Albums / carousels",
    "📖 Stories",
    "⭐ Highlights",
    "👤 Profile pictures (send the username or a profile link)",
    "",
    "More tools & tips: <a href=\"" + WEBSITE_URL.replace(/&/g, "&amp;") + "\">instadrop.web.app</a>",
  ].join("\n");
  try {
    await ctx.replyWithPhoto(START_IMAGE, { caption, parse_mode: "HTML", ...websiteButton });
  } catch {
    await ctx.reply(caption, { parse_mode: "HTML", ...websiteButton });
  }
});

bot.help(async (ctx) => {
  await ctx.reply(
    "Send me an Instagram link and I will send the media back.\n\n" +
      "Examples:\n" +
      "• https://www.instagram.com/reel/CODE\n" +
      "• https://www.instagram.com/p/CODE\n" +
      "• https://www.instagram.com/stories/username\n" +
      "• https://www.instagram.com/stories/highlights/ID\n" +
      "• https://www.instagram.com/username   (profile picture)\n\n" +
      "A bare 11-character media code also works.\n\n" +
      "Website: " + WEBSITE_URL,
    { disable_web_page_preview: true, ...websiteButton }
  );
});

bot.catch((err) => console.error("bot error:", err && (err.description || err.error || err.message || err)));

/* ------------------------------------------------------------------ */
/* Incoming messages                                                   */
/* ------------------------------------------------------------------ */
const lastSeen = new Map(); // per-chat flood guard
const FLOOD_GAP_MS = 1200;

bot.on("message", async (ctx) => {
  const msg = ctx.message;
  const text = (msg && (msg.text || msg.caption)) || "";
  if (!text) return; // sticker / photo without caption, etc.

  if (text.trim().startsWith("/")) {
    // unknown command — known ones (/start, /help) are handled above
    return ctx.reply("Unknown command. Use /start or /help.").catch(() => {});
  }

  const target = extractTarget(text);
  if (!target) {
    return ctx
      .reply(
        "I can't see an Instagram link in that message.\n\n" +
          "Send me something like:\n" +
          "• https://www.instagram.com/reel/…\n" +
          "• https://www.instagram.com/p/…\n" +
          "• https://www.instagram.com/stories/username/…\n" +
          "• a highlight or profile link\n" +
          "• or just a username (I'll grab the profile picture)",
        { disable_web_page_preview: true }
      )
      .catch(() => {});
  }

  const chatId = String(ctx.chat.id);
  const now = Date.now();
  const prev = lastSeen.get(chatId);
  if (prev && now - prev < FLOOD_GAP_MS) return; // ignore rapid duplicates
  lastSeen.set(chatId, now);
  if (lastSeen.size > 5000) lastSeen.clear();

  await processTarget(ctx, target);
});

/* ------------------------------------------------------------------ */
/* Vercel webhook handler (deploy as api/bot.js)                       */
/* ------------------------------------------------------------------ */
const busyChats = new Set();
const seenUpdates = new Set();

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(200).send("InstaDrop bot webhook is live — Telegram calls this URL with POST updates.");
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method Not Allowed");
  }

  if (WEBHOOK_SECRET && req.headers["x-telegram-bot-api-secret-token"] !== WEBHOOK_SECRET) {
    return res.status(403).send("Forbidden");
  }

  const update = req.body || {};

  if (update.update_id) {
    if (seenUpdates.has(update.update_id)) return res.status(200).send("OK"); // dedupe Telegram retries
    seenUpdates.add(update.update_id);
    if (seenUpdates.size > 10000) seenUpdates.clear();
  }

  const chatId = update.message && update.message.chat ? String(update.message.chat.id) : null;
  if (chatId && busyChats.has(chatId)) {
    return res.status(409).send("Busy"); // Telegram retries later → natural per-chat queue
  }
  if (chatId) busyChats.add(chatId);

  try {
    await bot.handleUpdate(update);
    res.status(200).send("OK");
  } catch (err) {
    console.error("handleUpdate error:", err && (err.message || err.description || err));
    res.status(200).send("OK"); // do not let Telegram retry our own bugs forever
  } finally {
    if (chatId) busyChats.delete(chatId);
  }
};

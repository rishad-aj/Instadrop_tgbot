import { Bot, InputFile, webhookCallback } from "grammy";

const BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s";



// ------------------------------------------------------------------
// TOKEN — never hardcode it. Set it as a Vercel environment variable:
//   vercel env add BOT_TOKEN production
// (If you ever paste a token into a chat/repo, revoke it in @BotFather!)
// ------------------------------------------------------------------

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || ""; // optional but recommended

const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 8000); // keep < Vercel's 10s on Hobby

const bot = BOT_TOKEN ? new Bot(BOT_TOKEN) : null;

// ----------------------------------------------------
// API CONFIG
// The SAME downloader endpoints the Instadrop website
// (public/script.js) uses, tried in order until one
// returns media. Response shapes vary per service:
//   thakur-infopd → { image: ["url", ...] } or { video: ["url", ...] }
//   mn-bots       → { success, media: [{ type, url, thumb }] }
//   others        → objects with url/video_url/display_url/link, or arrays of those
// ----------------------------------------------------
const APIS = {
  post: [
    (url) =>
      `https://insta.thakur-infopd.workers.dev/?url=${encodeURIComponent(url)}`,

    (url) =>
      `https://instagram-downloader.mn-bots.workers.dev/?url=${encodeURIComponent(url)}`,

    (url) =>
      `https://anon-social-info.vercel.app/igdl?key=igdl305&url=${encodeURIComponent(url)}`,

    (url) =>
      `https://api.dd.video/api/instagram?url=${encodeURIComponent(url)}`,

    (url) =>
      `https://snapinsta.app/api/instagram?url=${encodeURIComponent(url)}`,

    (url) =>
      `https://indown.io/api/info?url=${encodeURIComponent(url)}`
  ],

  reel: [
    (url) =>
      `https://insta.thakur-infopd.workers.dev/?url=${encodeURIComponent(url)}`,

    (url) =>
      `https://instagram-downloader.mn-bots.workers.dev/?url=${encodeURIComponent(url)}`,

    (url) =>
      `https://anon-social-info.vercel.app/igdl?key=igdl305&url=${encodeURIComponent(url)}`,

    (url) =>
      `https://api.dd.video/api/instagram?url=${encodeURIComponent(url)}`,

    (url) =>
      `https://snapinsta.app/api/instagram?url=${encodeURIComponent(url)}`,

    (url) =>
      `https://indown.io/api/info?url=${encodeURIComponent(url)}`
  ],

  story: [
    // Add your story API here
    // (url) => `https://example.com/story?url=${encodeURIComponent(url)}`
  ],

  highlight: [
    // Add your highlight API here
  ],

  profile: [
    // Add your profile-picture API here
  ]
};


// ----------------------------------------------------
// HELPERS
// ----------------------------------------------------

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36";

function cleanUrl(url) {
  return url
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

function detectType(url) {
  const match = String(url).match(
    /(?:instagram\.com|instagr\.am)\/(?:[A-Za-z0-9._]{1,30}\/)?(reel|reels|p|tv|stories|story|s)(?:\/|$)/i
  );

  if (!match) {
    return null;
  }

  const type = match[1].toLowerCase();

  if (["reel", "reels"].includes(type)) {
    return "reel";
  }

  if (["p", "tv"].includes(type)) {
    return "post";
  }

  if (["story", "stories", "s"].includes(type)) {
    return "story";
  }

  return null;
}

function isInstagramUrl(url) {
  try {
    const u = new URL(url);

    return (
      u.hostname === "instagram.com" ||
      u.hostname === "www.instagram.com" ||
      u.hostname === "instagr.am" ||
      u.hostname === "www.instagr.am"
    );
  } catch {
    return false;
  }
}


// ----------------------------------------------------
// FIND MEDIA URLS IN API RESPONSE
// Robust against every shape the services actually return:
//  * explicit keys (url, video, video_url, image_url, display_url, link, thumbnail, img)
//  * arrays of plain URL strings (thakur's image:[...] / video:[...])
//  * arrays of objects (mn-bots' media:[{url,type}], items, data, result, ...)
//  * instagram nested structures (video_versions, image_versions2, carousel_media)
// ----------------------------------------------------

function cleanMediaUrl(u) {
  return String(u || "")
    .trim()
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");
}

function extractMedia(data) {
  const results = [];
  const seen = new Set();

  const push = (raw, type) => {
    const url = cleanMediaUrl(raw);
    if (!/^https?:\/\//i.test(url)) return;
    if (seen.has(url)) return;
    seen.add(url);

    const isVideo =
      type === "video" || /\.(mp4|mov|webm)(\?|&|$)/i.test(url);
    const isImage =
      type === "image" || /\.(jpg|jpeg|png|webp|gif)(\?|&|$)/i.test(url);

    if (!isVideo && !isImage) return; // not a direct media file

    results.push({ url, type: isVideo ? "video" : "image" });
  };

  function walk(value) {
    if (!value) return;

    if (typeof value === "string") {
      push(value);
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }

    if (typeof value !== "object") return;

    // explicit string keys (also gives us mn-bots' {url, type} objects)
    if (typeof value.url === "string") push(value.url, value.type || value.kind);
    if (typeof value.video === "string") push(value.video, "video");
    if (typeof value.video_url === "string") push(value.video_url, "video");
    if (typeof value.download_url === "string") push(value.download_url, "video");
    if (typeof value.image_url === "string") push(value.image_url, "image");
    if (typeof value.display_url === "string") push(value.display_url, "image");
    if (typeof value.thumbnail === "string") push(value.thumbnail, "image");
    if (typeof value.img === "string") push(value.img, "image");
    if (typeof value.link === "string") push(value.link);

    // instagram-style nested structures
    if (Array.isArray(value.video_versions)) {
      const best = value.video_versions
        .slice()
        .sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (best) push(best.url, "video");
    }
    if (value.image_versions2 && Array.isArray(value.image_versions2.candidates)) {
      const best = value.image_versions2.candidates
        .slice()
        .sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (best) push(best.url, "image");
    }

    // arrays of URL strings or objects, under any known collection key
    for (const key of ["image", "video", "media", "medias", "items", "data", "result", "results", "stories", "carousel_media"]) {
      if (Array.isArray(value[key])) {
        for (const item of value[key]) walk(item);
      }
    }

    // last resort: any nested object (dedup handles repeats)
    for (const v of Object.values(value)) {
      if (v && typeof v === "object") walk(v);
    }
  }

  walk(data);
  return results;
}


// ----------------------------------------------------
// CALL ONE API
// ----------------------------------------------------

async function callApi(apiUrl) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json,text/html,*/*"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (typeof data === "string") {
      // raw HTML/text — grab every http(s) URL and keep the media ones
      const urls = [...data.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)].map((m) => m[0]);
      return extractMedia(urls);
    }

    return extractMedia(data);

  } finally {
    clearTimeout(timeout);
  }
}


// ----------------------------------------------------
// RESOLVE INSTAGRAM URL
// ----------------------------------------------------

async function resolveInstagram(url) {
  const type = detectType(url);

  if (!type) {
    throw new Error(
      "Unsupported Instagram URL. Send a Reel or Post link."
    );
  }

  const apis = APIS[type];

  if (!apis || apis.length === 0) {
    throw new Error(
      `No API has been configured for Instagram ${type}s yet.`
    );
  }

  for (const makeApiUrl of apis) {
    try {
      const apiUrl = makeApiUrl(url);

      console.log(`Trying ${type} API:`, apiUrl);

      const media = await callApi(apiUrl);

      if (media.length > 0) {
        return media;
      }

    } catch (error) {
      console.log(
        `${type} API failed:`,
        error.message
      );
    }
  }

  throw new Error(
    `Could not download this Instagram ${type}.`
  );
}


// ----------------------------------------------------
// DOWNLOAD MEDIA
// ----------------------------------------------------

async function downloadMedia(url) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Media HTTP ${response.status}`);
    }

    const contentLength = Number(
      response.headers.get("content-length") || 0
    );

    // Telegram Bot API upload limit
    if (contentLength > 50 * 1024 * 1024) {
      throw new Error("File is larger than Telegram's 50 MB limit.");
    }

    const buffer = Buffer.from(
      await response.arrayBuffer()
    );

    if (buffer.length > 50 * 1024 * 1024) {
      throw new Error("File is larger than Telegram's 50 MB limit.");
    }

    return {
      buffer,
      contentType:
        response.headers.get("content-type") || ""
    };

  } finally {
    clearTimeout(timeout);
  }
}


// ----------------------------------------------------
// /start  — with the Instadrop OG image
// ----------------------------------------------------

bot.command("start", async (ctx) => {
  await ctx.replyWithPhoto("https://instadrop.web.app/og-image.png", {
    caption:
      "👋 <b>Welcome to Instadrop</b>\n\n" +
      "Send me an Instagram <b>Reel</b> or <b>Post</b> link and I'll send the video straight to you.\n\n" +
      "📌 <b>Examples</b>:\n" +
      "<code>https://www.instagram.com/reel/AbCdEfGhIjk/</code>\n" +
      "<code>https://www.instagram.com/p/AbCdEfGhIjk/</code>\n\n" +
      "🔒 I only look at the link you send — nothing else is collected.\n" +
      "💾 Carousels are sent slide by slide.",
    parse_mode: "HTML"
  });
});


// ----------------------------------------------------
// /help
// ----------------------------------------------------

bot.command("help", async (ctx) => {
  await ctx.reply(
    "📥 <b>Instadrop Bot</b>\n\n" +
    "Send an Instagram URL and I'll download it for you.\n\n" +
    "<b>Supported:</b>\n" +
    "🎬 Reels\n" +
    "🖼 Posts\n" +
    "📚 Carousels\n\n" +
    "<b>Commands:</b>\n" +
    "/start — welcome\n" +
    "/help — this help",
    { parse_mode: "HTML" }
  );
});


// ----------------------------------------------------
// HANDLE URL
// ----------------------------------------------------

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();

  const match = text.match(
    /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/[^\s]+/i
  );

  if (!match) {
    await ctx.reply(
      "❌ Please send a valid Instagram URL."
    );

    return;
  }

  const instagramUrl = cleanUrl(match[0]);

  if (!isInstagramUrl(instagramUrl)) {
    await ctx.reply(
      "❌ That doesn't appear to be an Instagram URL."
    );

    return;
  }

  const status = await ctx.reply(
    "⏳ Downloading..."
  );

  try {
    const media = await resolveInstagram(
      instagramUrl
    );

    await ctx.api.editMessageText(
      ctx.chat.id,
      status.message_id,
      `✅ Found ${media.length} media file${media.length === 1 ? "" : "s"}.\n\n📤 Sending...`
    );

    let sent = 0;

    for (let i = 0; i < media.length; i++) {
      const item = media[i];

      try {
        const downloaded = await downloadMedia(
          item.url
        );

        const extension =
          item.type === "video"
            ? "mp4"
            : "jpg";

        const file = new InputFile(
          downloaded.buffer,
          `instadrop-${i + 1}.${extension}`
        );

        if (item.type === "video") {
          await ctx.replyWithVideo(file, {
            caption:
              i === 0
                ? "📥 Downloaded with Instadrop"
                : undefined,
            supports_streaming: true
          });
        } else {
          await ctx.replyWithPhoto(file, {
            caption:
              i === 0
                ? "📥 Downloaded with Instadrop"
                : undefined
          });
        }

        sent++;

      } catch (error) {
        console.log(
          "Media download failed:",
          error.message
        );
      }
    }

    if (sent === 0) {
      throw new Error(
        "The media could not be uploaded to Telegram."
      );
    }

    await ctx.api.editMessageText(
      ctx.chat.id,
      status.message_id,
      `✅ Done!\n\nSent ${sent} file${sent === 1 ? "" : "s"}.`
    );

  } catch (error) {
    console.error(error);

    await ctx.api.editMessageText(
      ctx.chat.id,
      status.message_id,
      `❌ ${error.message || "Download failed."}`
    );
  }
});


// ----------------------------------------------------
// VERCEL WEBHOOK
// ----------------------------------------------------

// Telegram retries webhook calls it doesn't get a quick 2xx for —
// remember recent update_ids so a retry never double-sends.
const processedUpdates = new Map();
const UPDATE_TTL = 10 * 60 * 1000;

// Vercel: raise this on Pro for bigger/faster downloads (Hobby is capped at 10)
export const config = {
  maxDuration: 10
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "Instadrop Telegram Bot"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  if (WEBHOOK_SECRET && req.headers["x-telegram-bot-api-secret-token"] !== WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false });
  }

  if (!bot) {
    return res.status(200).json({ ok: true, error: "BOT_TOKEN not configured" });
  }

  const updateId = req.body && req.body.update_id;
  if (updateId) {
    if (processedUpdates.has(updateId)) {
      return res.status(200).json({ ok: true, deduped: true });
    }
    processedUpdates.set(updateId, Date.now());
    for (const [id, ts] of processedUpdates) {
      if (Date.now() - ts > UPDATE_TTL) processedUpdates.delete(id);
    }
  }

  try {
    await webhookCallback(
      bot,
      "vercel"
    )(req, res);
  } catch (error) {
    console.error(
      "Telegram webhook error:",
      error
    );

    if (!res.headersSent) {
      return res.status(500).json({
        ok: false
      });
    }
  }
}


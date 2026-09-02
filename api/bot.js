import { Bot, InputFile, webhookCallback } from "grammy";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN");
}

const bot = new Bot(BOT_TOKEN);

// ----------------------------------------------------
// API CONFIG
// Put each API here according to what it supports.
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
  const match = url.match(
    /instagram\.com\/(reel|reels|p|tv|stories|story|s)\/?/i
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
      u.hostname === "www.instagram.com"
    );
  } catch {
    return false;
  }
}


// ----------------------------------------------------
// FIND MEDIA URLS IN API RESPONSE
// ----------------------------------------------------

function extractMedia(data) {
  const results = [];

  function walk(value) {
    if (!value) return;

    if (typeof value === "string") {
      if (
        value.startsWith("http://") ||
        value.startsWith("https://")
      ) {
        if (
          /\.(mp4|mov|webm)(\?|$)/i.test(value) ||
          /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(value)
        ) {
          results.push({
            url: value,
            type: /\.(mp4|mov|webm)(\?|$)/i.test(value)
              ? "video"
              : "image"
          });
        }
      }

      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item);
      }

      return;
    }

    if (typeof value === "object") {
      const videoKeys = [
        "video",
        "video_url",
        "videoUrl",
        "download_url",
        "downloadUrl"
      ];

      const imageKeys = [
        "image",
        "image_url",
        "imageUrl",
        "display_url",
        "displayUrl",
        "thumbnail"
      ];

      for (const key of videoKeys) {
        if (typeof value[key] === "string") {
          results.push({
            url: value[key],
            type: "video"
          });
        }
      }

      for (const key of imageKeys) {
        if (typeof value[key] === "string") {
          results.push({
            url: value[key],
            type: "image"
          });
        }
      }

      for (const key of [
        "items",
        "media",
        "medias",
        "data",
        "result",
        "results",
        "stories",
        "carousel"
      ]) {
        if (value[key]) {
          walk(value[key]);
        }
      }

      // Instagram-style nested structures
      if (value.video_versions) {
        walk(value.video_versions);
      }

      if (value.image_versions2) {
        walk(value.image_versions2);
      }
    }
  }

  walk(data);

  // Remove duplicates
  const seen = new Set();

  return results.filter((item) => {
    if (!item.url || seen.has(item.url)) {
      return false;
    }

    seen.add(item.url);
    return true;
  });
}


// ----------------------------------------------------
// CALL ONE API
// ----------------------------------------------------

async function callApi(apiUrl) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 20000);

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
      const urls = [
        ...data.matchAll(
          /https?:\/\/[^\s"'<>\\]+/gi
        )
      ].map((m) => m[0]);

      return urls.map((url) => ({
        url,
        type: /\.(mp4|mov|webm)(\?|$)/i.test(url)
          ? "video"
          : "image"
      }));
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
      "Unsupported Instagram URL. Send a Reel, Post, Story or supported Instagram link."
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
  }, 30000);

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
// /start
// ----------------------------------------------------

bot.command("start", async (ctx) => {
  await ctx.reply(
    "👋 Welcome to Instadrop!\n\n" +
    "Send me an Instagram Reel or Post URL and I'll send you the media.\n\n" +
    "Example:\n" +
    "https://www.instagram.com/reel/XXXXXXXX/"
  );
});


// ----------------------------------------------------
// /help
// ----------------------------------------------------

bot.command("help", async (ctx) => {
  await ctx.reply(
    "📥 Instadrop Bot\n\n" +
    "Send an Instagram URL and I'll try to download it.\n\n" +
    "Supported:\n" +
    "🎬 Reels\n" +
    "🖼 Posts\n" +
    "📚 Carousels\n\n" +
    "More Instagram types can be enabled by adding their API."
  );
});


// ----------------------------------------------------
// HANDLE URL
// ----------------------------------------------------

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();

  const match = text.match(
    /https?:\/\/(?:www\.)?instagram\.com\/[^\s]+/i
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
    "⏳ Finding media..."
  );

  try {
    const media = await resolveInstagram(
      instagramUrl
    );

    await ctx.api.editMessageText(
      ctx.chat.id,
      status.message_id,
      `✅ Found ${media.length} media file${
        media.length === 1 ? "" : "s"
      }.\n\n📤 Sending...`
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
                ? "📥 Instadrop"
                : undefined,
            supports_streaming: true
          });
        } else {
          await ctx.replyWithPhoto(file, {
            caption:
              i === 0
                ? "📥 Instadrop"
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
      `✅ Done!\n\nSent ${sent} file${
        sent === 1 ? "" : "s"
      }.`
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

  try {
    await webhookCallback(
      bot,
      "http"
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

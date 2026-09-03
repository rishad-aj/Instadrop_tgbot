
// InstaDrop Telegram Bot
// Vercel + grammY
//
// Features:
// - /start welcome message
// - Instagram Reel
// - Instagram Post
// - Carousel
// - Stories / Highlights (if API returns media)
// - Profile pictures (if API returns media)
// - Automatically detects media type
//
// Vercel file:
// api/bot.js

const { Bot, webhookCallback } = require("grammy");

// ============================================================
// CONFIG
// ============================================================

const BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s";

const API_BASE =
  "https://instadrop.rishu-rishad2019.workers.dev/?url=";

const START_IMAGE =
  "https://instadrop.web.app/og-image.png";

const WEBSITE =
  "https://instadrop.web.app/";

// ============================================================
// BOT
// ============================================================

const bot = new Bot(BOT_TOKEN);

// ============================================================
// HELPERS
// ============================================================

function isInstagramUrl(text) {
  if (!text) return false;

  try {
    const url = new URL(text.trim());

    return (
      url.hostname === "instagram.com" ||
      url.hostname === "www.instagram.com" ||
      url.hostname.endsWith(".instagram.com")
    );
  } catch {
    return false;
  }
}


// Recursively find URLs inside the API response.
//
// This makes the bot compatible with responses such as:
//
// {
//   "video": "https://...mp4"
// }
//
// {
//   "image": ["https://...jpg", "..."]
// }
//
// {
//   "media": [
//      {"url":"https://...mp4"},
//      {"url":"https://...jpg"}
//   ]
// }

function extractMedia(value, results = [], seen = new Set()) {
  if (!value) return results;

  if (typeof value === "string") {
    if (
      /^https?:\/\//i.test(value) &&
      /\.(jpg|jpeg|png|webp|gif|mp4|mov|m4v)(\?.*)?$/i.test(value)
    ) {
      if (!seen.has(value)) {
        seen.add(value);
        results.push(value);
      }
    }

    return results;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      extractMedia(item, results, seen);
    }

    return results;
  }

  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      // Ignore unrelated metadata.
      if (
        [
          "message",
          "error",
          "status",
          "success",
          "type",
          "username",
          "caption",
          "title"
        ].includes(key.toLowerCase())
      ) {
        continue;
      }

      extractMedia(item, results, seen);
    }
  }

  return results;
}


// More permissive URL extractor.
// Useful when the Worker returns CDN URLs without
// a recognizable file extension.

function extractAnyUrls(value, results = [], seen = new Set()) {
  if (!value) return results;

  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) {
      if (!seen.has(value)) {
        seen.add(value);
        results.push(value);
      }
    }

    return results;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      extractAnyUrls(item, results, seen);
    }

    return results;
  }

  if (typeof value === "object") {
    for (const item of Object.values(value)) {
      extractAnyUrls(item, results, seen);
    }
  }

  return results;
}


// Guess media type from URL.

function getMediaType(url) {
  const clean = url.split("?")[0].toLowerCase();

  if (
    clean.endsWith(".mp4") ||
    clean.endsWith(".mov") ||
    clean.endsWith(".m4v")
  ) {
    return "video";
  }

  if (
    clean.endsWith(".jpg") ||
    clean.endsWith(".jpeg") ||
    clean.endsWith(".png") ||
    clean.endsWith(".webp") ||
    clean.endsWith(".gif")
  ) {
    return "image";
  }

  // Instagram CDN URLs frequently don't expose extensions.
  // Try video indicators first.
  if (
    url.includes(".mp4") ||
    url.includes("/video/") ||
    url.includes("video")
  ) {
    return "video";
  }

  return "image";
}


// Download URL into a Buffer.
// Telegram can receive a Buffer as InputFile.

async function downloadMedia(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/126.0.0.0 Safari/537.36"
    },
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(
      `Media download failed: HTTP ${response.status}`
    );
  }

  const contentType =
    response.headers.get("content-type") || "";

  const arrayBuffer = await response.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType
  };
}


// ============================================================
// /START
// ============================================================

bot.command("start", async (ctx) => {
  const name =
    ctx.from?.first_name ||
    "there";

  const text =
    `👋 <b>Hey ${escapeHtml(name)}!</b>\n\n` +
    `Welcome to <b>InstaDrop</b> ⚡\n\n` +
    `📥 Download Instagram media instantly.\n\n` +
    `<b>Supported:</b>\n` +
    `• 🎬 Reels\n` +
    `• 🖼 Posts\n` +
    `• 🎞 Carousels\n` +
    `• 📸 Stories\n` +
    `• ✨ Highlights\n` +
    `• 👤 Profile pictures\n\n` +
    `Just send me an <b>Instagram link</b> and I'll download it for you.\n\n` +
    `🌐 ${WEBSITE}`;

  try {
    await ctx.replyWithPhoto(START_IMAGE, {
      caption: text,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🌐 Open InstaDrop",
              url: WEBSITE
            }
          ]
        ]
      }
    });
  } catch {
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🌐 Open InstaDrop",
              url: WEBSITE
            }
          ]
        ]
      }
    });
  }
});


// ============================================================
// HELP
// ============================================================

bot.command("help", async (ctx) => {
  await ctx.reply(
    "📥 <b>How to use InstaDrop</b>\n\n" +
      "Simply send an Instagram URL here.\n\n" +
      "Example:\n" +
      "https://www.instagram.com/reel/XXXXXXXX/\n\n" +
      "I'll fetch the available media and send it back.",
    {
      parse_mode: "HTML"
    }
  );
});


// ============================================================
// MESSAGE HANDLER
// ============================================================

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();

  // Ignore commands.
  if (text.startsWith("/")) return;

  if (!isInstagramUrl(text)) {
    await ctx.reply(
      "❌ <b>That doesn't look like an Instagram URL.</b>\n\n" +
        "Send me a public Instagram Reel, Post, Story, Highlight, " +
        "or profile URL.",
      {
        parse_mode: "HTML"
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // Processing message
  // ----------------------------------------------------------

  const processing = await ctx.reply(
    "⏳ <b>Processing your Instagram link...</b>\n\n" +
      "🔎 Finding media\n" +
      "⚡ Preparing download",
    {
      parse_mode: "HTML"
    }
  );

  try {
    const apiUrl =
      API_BASE + encodeURIComponent(text);

    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "InstaDrop-Telegram-Bot/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(
        `API returned HTTP ${response.status}`
      );
    }

    const data = await response.json();

    console.log(
      "InstaDrop API response:",
      JSON.stringify(data)
    );

    // First try extension-based media extraction.
    let media = extractMedia(data);

    // If nothing was found, use the more permissive
    // URL extraction.
    if (media.length === 0) {
      const allUrls = extractAnyUrls(data);

      media = allUrls.filter((url) => {
        // Never send the original Instagram URL.
        return !url.includes("instagram.com");
      });
    }

    // Remove duplicates.
    media = [...new Set(media)];

    if (media.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        processing.message_id,
        "❌ <b>No downloadable media was found.</b>\n\n" +
          "The post may be private, unavailable, expired, " +
          "or the Instagram API couldn't resolve it.",
        {
          parse_mode: "HTML"
        }
      );

      return;
    }

    // Limit to prevent accidentally processing a huge response.
    const MAX_MEDIA = 20;

    media = media.slice(0, MAX_MEDIA);

    await ctx.api.editMessageText(
      ctx.chat.id,
      processing.message_id,
      `✅ <b>Found ${media.length} media item${
        media.length === 1 ? "" : "s"
      }.</b>\n\n` +
        `📤 Sending to you...`,
      {
        parse_mode: "HTML"
      }
    );

    // --------------------------------------------------------
    // Send media
    // --------------------------------------------------------

    let sent = 0;

    for (const mediaUrl of media) {
      try {
        const type = getMediaType(mediaUrl);

        const downloaded =
          await downloadMedia(mediaUrl);

        if (type === "video") {
          await ctx.replyWithVideo(
            {
              source: downloaded.buffer,
              filename: `instadrop-${sent + 1}.mp4`
            },
            {
              supports_streaming: true
            }
          );
        } else {
          await ctx.replyWithPhoto(
            {
              source: downloaded.buffer,
              filename: `instadrop-${sent + 1}.jpg`
            }
          );
        }

        sent++;

      } catch (mediaError) {
        console.error(
          "Media error:",
          mediaError
        );

        // Fallback: give Telegram the direct URL.
        // This can work when Telegram can fetch the CDN URL itself.

        try {
          const type = getMediaType(mediaUrl);

          if (type === "video") {
            await ctx.replyWithVideo(mediaUrl, {
              supports_streaming: true
            });
          } else {
            await ctx.replyWithPhoto(mediaUrl);
          }

          sent++;

        } catch (fallbackError) {
          console.error(
            "Telegram fallback failed:",
            fallbackError
          );
        }
      }
    }

    if (sent === 0) {
      throw new Error(
        "Media was found but Telegram could not send it."
      );
    }

    await ctx.reply(
      `✅ <b>Done!</b>\n\n` +
        `📦 Sent: <b>${sent}</b> media item${
          sent === 1 ? "" : "s"
        }\n\n` +
        `⚡ <b>InstaDrop</b>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🌐 InstaDrop Website",
                url: WEBSITE
              }
            ]
          ]
        }
      }
    );

  } catch (error) {
    console.error(
      "InstaDrop error:",
      error
    );

    try {
      await ctx.api.editMessageText(
        ctx.chat.id,
        processing.message_id,
        "❌ <b>Download failed.</b>\n\n" +
          "I couldn't retrieve media from that Instagram URL.\n\n" +
          "Please make sure the post is public and try again.",
        {
          parse_mode: "HTML"
        }
      );
    } catch {
      await ctx.reply(
        "❌ Download failed. Please try again."
      );
    }
  }
});


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// ============================================================
// VERCEL WEBHOOK
// ============================================================

module.exports = webhookCallback(
  bot,
  "https"
);

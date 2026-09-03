// bot.js — InstaDrop Telegram Bot for Vercel
// Uses Telegraf webhook adapter
// Environment variables required: BOT_TOKEN

const { Telegraf } = require('telegraf');

// ---------- Configuration ----------
const BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s"; // Replace with your real token from @BotFather
const API_URL =
  "https://instadrop.rishu-rishad2019.workers.dev/?url=";

const bot = new Telegraf(BOT_TOKEN);

// ----------------------------------------------------
// INSTAGRAM URL EXTRACTOR
// ----------------------------------------------------

function extractInstagramUrls(text = "") {
  const regex =
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[^\s<>"']+/gi;

  return text.match(regex) || [];
}

function cleanInstagramUrl(url) {
  return url
    .replace(/[),.!?]+$/g, "")
    .trim();
}

// ----------------------------------------------------
// CAPTION
// ----------------------------------------------------

function buildCaption(data, prefix = "") {
  let caption = "";

  if (prefix) caption += `${prefix}\n`;

  if (data.caption) {
    caption += `${data.caption}\n`;
  }

  if (data.username) {
    caption += `👤 @${data.username}`;
  }

  if (data.taken_at) {
    const date = new Date(data.taken_at);

    if (!isNaN(date.getTime())) {
      caption += `\n📅 ${date.toLocaleString()}`;
    }
  }

  const stats = [];

  if (data.like_count != null) {
    stats.push(`❤️ ${data.like_count}`);
  }

  if (data.comment_count != null) {
    stats.push(`💬 ${data.comment_count}`);
  }

  if (data.view_count != null) {
    stats.push(`👁️ ${data.view_count}`);
  }

  if (stats.length) {
    caption += `\n${stats.join(" · ")}`;
  }

  if (caption.length > 1000) {
    caption = caption.slice(0, 997) + "...";
  }

  return caption;
}

// ----------------------------------------------------
// GET MEDIA
// ----------------------------------------------------

function getMediaItems(data) {
  const media = [];

  // Images
  if (Array.isArray(data.image)) {
    for (const image of data.image) {
      if (
        typeof image === "string" &&
        image.startsWith("http")
      ) {
        media.push({
          type: "photo",
          media: image,
        });
      }
    }
  }

  // Single image
  if (
    typeof data.image === "string" &&
    data.image.startsWith("http")
  ) {
    media.push({
      type: "photo",
      media: data.image,
    });
  }

  // Videos
  if (Array.isArray(data.video)) {
    for (const item of data.video) {
      let url = null;

      if (typeof item === "string") {
        url = item;
      } else if (item && typeof item === "object") {
        url =
          item.video ||
          item.url ||
          item.src ||
          null;
      }

      if (
        typeof url === "string" &&
        url.startsWith("http")
      ) {
        media.push({
          type: "video",
          media: url,
        });
      }
    }
  }

  // Single video
  if (
    typeof data.video === "string" &&
    data.video.startsWith("http")
  ) {
    media.push({
      type: "video",
      media: data.video,
    });
  }

  return media;
}

// ----------------------------------------------------
// SEND MEDIA
// ----------------------------------------------------

async function sendSingleMedia(
  ctx,
  data,
  prefix = ""
) {
  const media = getMediaItems(data);
  const caption = buildCaption(
    data,
    prefix
  );

  // No media
  if (media.length === 0) {
    await ctx.reply(
      caption ||
        "❌ No downloadable media found."
    );
    return;
  }

  // Multiple media
  if (media.length > 1) {
    for (let i = 0; i < media.length; i += 10) {
      const chunk = media.slice(
        i,
        i + 10
      );

      const group = chunk.map(
        (item, index) => ({
          type: item.type,
          media: item.media,

          ...(i === 0 &&
          index === 0 &&
          caption
            ? {
                caption,
                parse_mode: "HTML",
              }
            : {}),
        })
      );

      try {
        await ctx.telegram.sendMediaGroup(
          ctx.chat.id,
          group
        );
      } catch (error) {
        console.error(
          "Media group error:",
          error.message
        );

        // Individual fallback
        for (const item of chunk) {
          try {
            if (item.type === "photo") {
              await ctx.replyWithPhoto(
                item.media
              );
            } else {
              await ctx.replyWithVideo(
                item.media
              );
            }
          } catch (e) {
            console.error(
              "Media send error:",
              e.message
            );
          }
        }
      }
    }

    return;
  }

  // Single media
  const item = media[0];

  try {
    if (item.type === "photo") {
      await ctx.replyWithPhoto(
        item.media,
        caption
          ? {
              caption,
              parse_mode: "HTML",
            }
          : {}
      );
    } else {
      await ctx.replyWithVideo(
        item.media,
        caption
          ? {
              caption,
              parse_mode: "HTML",
            }
          : {}
      );
    }
  } catch (error) {
    console.error(
      "Telegram media error:",
      error.message
    );

    await ctx.reply(
      `⚠️ Media found, but Telegram couldn't download it directly.\n\n${item.media}`
    );
  }
}

// ----------------------------------------------------
// API RESPONSE
// ----------------------------------------------------

async function sendMedia(ctx, data) {
  // Stories / highlights
  if (
    Array.isArray(data.items) &&
    data.items.length
  ) {
    const username =
      data.username || "User";

    for (const item of data.items) {
      await sendSingleMedia(
        ctx,
        item,
        `📌 @${username}`
      );
    }

    return;
  }

  // Normal post / reel / profile
  await sendSingleMedia(
    ctx,
    data
  );
}

// ----------------------------------------------------
// START
// ----------------------------------------------------

bot.start(async (ctx) => {
  const photo =
    "https://instadrop.web.app/og-image.png";

  const caption =
    `<b>🌟 Welcome to InstaDrop!</b>\n\n` +
    `I can download Instagram content for you:\n\n` +
    `📸 Posts & Reels\n` +
    `📖 Stories\n` +
    `✨ Highlights\n` +
    `👤 Profile Pictures\n\n` +
    `Just send me an Instagram link and I'll fetch the media.\n\n` +
    `⚡ <b>Fast • Simple • Free</b>\n\n` +
    `👨‍💻 Created by Muhammed Rishad AJ`;

  try {
    await ctx.replyWithPhoto(
      photo,
      {
        caption,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🌐 Visit InstaDrop",
                url:
                  "https://instadrop.web.app/",
              },
            ],
            [
              {
                text: "❓ How to Use",
                callback_data: "help",
              },
            ],
          ],
        },
      }
    );
  } catch (error) {
    console.error(
      "Start error:",
      error.message
    );

    await ctx.reply(
      caption,
      {
        parse_mode: "HTML",
      }
    );
  }
});

// ----------------------------------------------------
// HELP
// ----------------------------------------------------

bot.help(async (ctx) => {
  await ctx.reply(
    `<b>📥 How to use InstaDrop</b>\n\n` +
      `Send any Instagram link here.\n\n` +
      `<b>Supported:</b>\n` +
      `📸 Posts\n` +
      `🎬 Reels\n` +
      `📖 Stories\n` +
      `✨ Highlights\n` +
      `👤 Profile Pictures\n\n` +
      `⚡ Powered by InstaDrop`,
    {
      parse_mode: "HTML",
    }
  );
});

// ----------------------------------------------------
// HELP BUTTON
// ----------------------------------------------------

bot.action("help", async (ctx) => {
  await ctx.answerCbQuery();

  await ctx.reply(
    `<b>📥 How to use InstaDrop</b>\n\n` +
      `Simply send an Instagram URL and I'll try to download the media.\n\n` +
      `📸 Posts\n` +
      `🎬 Reels\n` +
      `📖 Stories\n` +
      `✨ Highlights\n` +
      `👤 Profile Pictures`,
    {
      parse_mode: "HTML",
    }
  );
});

// ----------------------------------------------------
// TEXT HANDLER
// ----------------------------------------------------

bot.on("text", async (ctx) => {
  const text =
    ctx.message.text || "";

  if (text.startsWith("/")) {
    return;
  }

  const found =
    extractInstagramUrls(text);

  if (!found.length) {
    return;
  }

  const urls = [
    ...new Set(
      found.map(cleanInstagramUrl)
    ),
  ];

  console.log(
    "Instagram URLs:",
    urls
  );

  try {
    await ctx.sendChatAction(
      "typing"
    );
  } catch {}

  for (const url of urls) {
    try {
      console.log(
        "Fetching:",
        url
      );

      const apiEndpoint =
        API_URL +
        encodeURIComponent(url);

      const response =
        await fetch(apiEndpoint);

      if (!response.ok) {
        throw new Error(
          `API returned ${response.status}`
        );
      }

      const data =
        await response.json();

      console.log(
        "API response:",
        JSON.stringify(data).slice(
          0,
          1000
        )
      );

      if (
        data.error ||
        data.success === false
      ) {
        await ctx.reply(
          `❌ ${
            data.error ||
            data.message ||
            "Unable to download this content."
          }`
        );

        continue;
      }

      await sendMedia(
        ctx,
        data
      );
    } catch (error) {
      console.error(
        "Processing error:",
        error
      );

      await ctx.reply(
        `❌ <b>Failed to process this Instagram link.</b>\n\nPlease try again later.`,
        {
          parse_mode: "HTML",
        }
      );
    }
  }
});

// ----------------------------------------------------
// GLOBAL ERROR
// ----------------------------------------------------

bot.catch((error) => {
  console.error(
    "Telegraf error:",
    error
  );
});

// ----------------------------------------------------
// VERCEL HANDLER
// ----------------------------------------------------

module.exports = async function handler(
  req,
  res
) {
  console.log(
    "Webhook request:",
    req.method,
    req.url
  );

  // GET test
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      bot: "InstaDrop",
      message:
        "Telegram webhook is running.",
    });
  }

  // Telegram webhook must be POST
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    await bot.handleUpdate(
      req.body
    );

    return res.status(200).json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "Webhook error:",
      error
    );

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
};

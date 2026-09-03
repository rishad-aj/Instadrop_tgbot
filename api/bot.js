
const TELEGRAM_BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s";
const ADMIN_CHAT_ID = "7216371031";

const API_URL = "https://instadrop.rishu-rishad2019.workers.dev/?url=";
const WELCOME_IMAGE = "https://instadrop.web.app/og-image.png";
const WEBSITE_URL = "https://instadrop.web.app/";

// --------------------------------------------------
// IMPORTANT:
// This is temporary in-memory storage.
// For permanent first-user tracking, use a database/KV.
// --------------------------------------------------
const notifiedUsers = new Set();

// --------------------------------------------------
// Telegram API helper
// --------------------------------------------------
async function telegram(method, body) {
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  return await response.json();
}

// --------------------------------------------------
// Check Instagram URL
// --------------------------------------------------
function isInstagramUrl(text) {
  if (!text) return false;

  try {
    const url = new URL(text.trim());

    return (
      url.hostname === "instagram.com" ||
      url.hostname === "www.instagram.com" ||
      url.hostname === "m.instagram.com"
    );
  } catch {
    return false;
  }
}

// --------------------------------------------------
// Find media URLs recursively inside API response
// --------------------------------------------------
function extractMedia(data, results = []) {
  if (!data) return results;

  if (typeof data === "string") {
    if (
      data.startsWith("http://") ||
      data.startsWith("https://")
    ) {
      const lower = data.toLowerCase();

      if (
        lower.includes(".mp4") ||
        lower.includes(".mov") ||
        lower.includes(".webm") ||
        lower.includes(".jpg") ||
        lower.includes(".jpeg") ||
        lower.includes(".png") ||
        lower.includes(".webp") ||
        lower.includes("video") ||
        lower.includes("image")
      ) {
        results.push(data);
      }
    }

    return results;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      extractMedia(item, results);
    }

    return results;
  }

  if (typeof data === "object") {
    // Prioritize common media URL properties
    const preferredKeys = [
      "url",
      "download_url",
      "downloadUrl",
      "media_url",
      "mediaUrl",
      "video_url",
      "videoUrl",
      "image_url",
      "imageUrl",
      "src",
      "source",
      "thumbnail"
    ];

    for (const key of preferredKeys) {
      if (typeof data[key] === "string") {
        const value = data[key];

        if (
          value.startsWith("http://") ||
          value.startsWith("https://")
        ) {
          results.push(value);
        }
      }
    }

    // Recursively inspect everything else
    for (const [key, value] of Object.entries(data)) {
      if (!preferredKeys.includes(key)) {
        extractMedia(value, results);
      }
    }
  }

  return results;
}

// --------------------------------------------------
// Remove duplicate URLs
// --------------------------------------------------
function uniqueUrls(urls) {
  return [...new Set(urls)];
}

// --------------------------------------------------
// Guess media type
// --------------------------------------------------
function getMediaType(url) {
  const lower = url.toLowerCase();

  if (
    lower.includes(".mp4") ||
    lower.includes(".mov") ||
    lower.includes(".webm") ||
    lower.includes("video")
  ) {
    return "video";
  }

  return "photo";
}

// --------------------------------------------------
// Send media to Telegram
// --------------------------------------------------
async function sendMedia(chatId, url) {
  const type = getMediaType(url);

  if (type === "video") {
    return await telegram("sendVideo", {
      chat_id: chatId,
      video: url,
      supports_streaming: true
    });
  }

  return await telegram("sendPhoto", {
    chat_id: chatId,
    photo: url
  });
}

// --------------------------------------------------
// Send welcome message
// --------------------------------------------------
async function sendWelcome(chatId, firstName) {
  const welcomeCaption =
    `👋 <b>Welcome to Instadrop!</b>\n\n` +
    `📥 <b>Download Instagram media with ease.</b>\n` +
    `Just send me an Instagram link and I'll take care of the rest. 🚀\n\n` +

    `✨ <b>What I can download:</b>\n` +
    `🎬 Reels & Videos\n` +
    `🖼️ Posts & Carousels\n` +
    `📖 Stories & Highlights\n` +
    `👤 Profile Pictures & Media\n\n` +

    `🔗 <b>Simply paste an Instagram link to get started!</b>\n\n` +
    `⚡ Fast • Simple • Easy`;

  await telegram("sendPhoto", {
    chat_id: chatId,
    photo: WELCOME_IMAGE,
    caption: welcomeCaption,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🌐 Visit Instadrop",
            url: WEBSITE_URL
          }
        ]
      ]
    }
  });
}

// --------------------------------------------------
// Notify admin about a new user
// --------------------------------------------------
async function notifyAdmin(user) {
  const chatId = user.id;

  // Already notified
  if (notifiedUsers.has(chatId)) {
    return;
  }

  const firstName = user.first_name || "Unknown";
  const lastName = user.last_name || "";

  const username = user.username
    ? `@${user.username}`
    : "No username";

  const adminMessage =
    `🆕 <b>New User Started Instadrop</b>\n\n` +
    `👤 <b>Name:</b> ${firstName} ${lastName}\n` +
    `🔗 <b>Username:</b> ${username}\n` +
    `🆔 <b>Chat ID:</b> <code>${chatId}</code>`;

  await telegram("sendMessage", {
    chat_id: ADMIN_CHAT_ID,
    text: adminMessage,
    parse_mode: "HTML"
  });

  notifiedUsers.add(chatId);
}

// --------------------------------------------------
// Call Instadrop API
// --------------------------------------------------
async function downloadFromAPI(instagramUrl) {
  const endpoint =
    API_URL + encodeURIComponent(instagramUrl);

  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error(
      `API returned HTTP ${response.status}`
    );
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("API did not return JSON");
  }

  const data = await response.json();

  return {
    raw: data,
    media: uniqueUrls(extractMedia(data))
  };
}

// --------------------------------------------------
// Main handler
// --------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Instadrop Bot is running 🚀");
  }

  try {
    const update = req.body;

    if (!update || !update.message) {
      return res.status(200).json({
        ok: true
      });
    }

    const message = update.message;
    const user = message.from;

    if (!user) {
      return res.status(200).json({
        ok: true
      });
    }

    const chatId = message.chat.id;
    const firstName = user.first_name || "there";
    const text = (message.text || "").trim();

    // ==================================================
    // /START
    // ==================================================
    if (
      text === "/start" ||
      text.startsWith("/start ")
    ) {
      // Notify admin only for first start
      await notifyAdmin(user);

      // Welcome user every time they use /start
      await sendWelcome(chatId, firstName);

      return res.status(200).json({
        ok: true
      });
    }

    // ==================================================
    // IGNORE NON-TEXT MESSAGES
    // ==================================================
    if (!text) {
      return res.status(200).json({
        ok: true
      });
    }

    // ==================================================
    // INSTAGRAM LINK
    // ==================================================
    if (isInstagramUrl(text)) {
      // Processing message
      const processing = await telegram("sendMessage", {
        chat_id: chatId,
        text: "⏳ <b>Processing your Instagram link...</b>\n\nPlease wait a moment 🚀",
        parse_mode: "HTML"
      });

      try {
        // Call API
        const result = await downloadFromAPI(text);

        const media = result.media;

        // No media found
        if (!media || media.length === 0) {
          if (processing.result?.message_id) {
            await telegram("editMessageText", {
              chat_id: chatId,
              message_id: processing.result.message_id,
              text:
                "❌ <b>Sorry, I couldn't find downloadable media.</b>\n\n" +
                "The post may be private, unavailable, or unsupported.",
              parse_mode: "HTML"
            });
          }

          return res.status(200).json({
            ok: true
          });
        }

        // Delete processing message
        if (processing.result?.message_id) {
          await telegram("deleteMessage", {
            chat_id: chatId,
            message_id: processing.result.message_id
          });
        }

        // --------------------------------------------------
        // Send media
        // --------------------------------------------------

        // Telegram albums can contain max 10 media items.
        // Send individually to keep compatibility with all results.
        for (const mediaUrl of media) {
          try {
            await sendMedia(chatId, mediaUrl);
          } catch (mediaError) {
            console.error(
              "Media send error:",
              mediaError
            );

            // If Telegram cannot send the media directly,
            // provide the downloadable URL.
            await telegram("sendMessage", {
              chat_id: chatId,
              text:
                `📥 <b>Download:</b>\n${mediaUrl}`,
              parse_mode: "HTML",
              disable_web_page_preview: false
            });
          }
        }

        // Completion message
        await telegram("sendMessage", {
          chat_id: chatId,
          text:
            `✅ <b>Done!</b>\n\n` +
            `📦 ${media.length} media file${media.length > 1 ? "s" : ""} found.\n\n` +
            `🚀 <b>Powered by Instadrop</b>`,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🌐 Visit Instadrop",
                  url: WEBSITE_URL
                }
              ]
            ]
          }
        });

      } catch (error) {
        console.error(
          "Download error:",
          error
        );

        if (processing.result?.message_id) {
          await telegram("editMessageText", {
            chat_id: chatId,
            message_id: processing.result.message_id,
            text:
              `❌ <b>Download failed</b>\n\n` +
              `I couldn't process that Instagram link.\n\n` +
              `Please make sure the post is public and try again.`,
            parse_mode: "HTML"
          });
        } else {
          await telegram("sendMessage", {
            chat_id: chatId,
            text:
              `❌ <b>Download failed.</b>\n\n` +
              `Please check the Instagram link and try again.`,
            parse_mode: "HTML"
          });
        }
      }

      return res.status(200).json({
        ok: true
      });
    }

    // ==================================================
    // NOT AN INSTAGRAM LINK
    // ==================================================
    await telegram("sendMessage", {
      chat_id: chatId,
      text:
        `🔗 <b>Send me an Instagram link</b>\n\n` +
        `For example:\n` +
        `• Instagram Reel\n` +
        `• Post\n` +
        `• Carousel\n` +
        `• Story\n` +
        `• Profile\n\n` +
        `I'll handle the rest. 🚀`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🌐 Visit Instadrop",
              url: WEBSITE_URL
            }
          ]
        ]
      }
    });

    return res.status(200).json({
      ok: true
    });

  } catch (error) {
    console.error(
      "Webhook error:",
      error
    );

    return res.status(500).json({
      ok: false,
      error: "Something went wrong"
    });
  }
}

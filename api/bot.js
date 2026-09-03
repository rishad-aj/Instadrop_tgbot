const TELEGRAM_BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s";
const ADMIN_CHAT_ID = "7216371031";

const API_URL = "https://instadrop.rishu-rishad2019.workers.dev/?url=";
const WELCOME_IMAGE = "https://instadrop.web.app/og-image.png";
const WEBSITE_URL = "https://instadrop.web.app/";

// --------------------------------------------------
// IMPORTANT:
// Temporary in-memory storage.
//
// Stores API results so callback buttons can retrieve
// the cover/details for the media that was sent.
//
// For production/serverless deployments, use KV,
// Redis, a database, etc.
// --------------------------------------------------
const notifiedUsers = new Set();
const mediaStorage = new Map();

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
// Generate temporary storage ID
// --------------------------------------------------
function createStorageId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10)
  );
}

// --------------------------------------------------
// Get a URL from an object using common property names
// --------------------------------------------------
function getUrlFromObject(data, keys = []) {
  if (!data || typeof data !== "object") {
    return null;
  }

  for (const key of keys) {
    if (
      typeof data[key] === "string" &&
      /^https?:\/\//i.test(data[key])
    ) {
      return data[key];
    }
  }

  return null;
}

// --------------------------------------------------
// Guess media type
// --------------------------------------------------
function getMediaType(url) {
  if (!url || typeof url !== "string") {
    return "photo";
  }

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
// Recursively find downloadable media.
//
// IMPORTANT:
// This is mainly used for normal posts/carousels.
//
// Reel handling does NOT use this to avoid accidentally
// sending the reel cover together with the video.
// --------------------------------------------------
function extractMedia(data, results = []) {
  if (!data) return results;

  if (typeof data === "string") {
    if (/^https?:\/\//i.test(data)) {
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

        if (/^https?:\/\//i.test(value)) {
          const lower = value.toLowerCase();

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
            results.push(value);
          }
        }
      }
    }

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
// Determine whether API response is a Reel.
//
// Your example response contains:
// {
//   "p": true,
//   "video": [...],
//   "cover": "...",
//   "caption": "...",
//   ...
// }
//
// The existence of "video" + "cover" is enough to identify
// the new Reel response format.
//
// Additional checks are included for flexibility.
// --------------------------------------------------
function isReelResponse(data) {
  if (!data || typeof data !== "object") {
    return false;
  }

  if (
    Array.isArray(data.video) &&
    data.video.length > 0 &&
    data.cover
  ) {
    return true;
  }

  if (
    typeof data.video === "string" &&
    data.video &&
    data.cover
  ) {
    return true;
  }

  if (
    data.type === "reel" ||
    data.type === "reels" ||
    data.media_type === "reel" ||
    data.mediaType === "reel"
  ) {
    return true;
  }

  return false;
}

// --------------------------------------------------
// Get Reel video URL
// --------------------------------------------------
function getReelVideo(data) {
  if (!data) return null;

  if (typeof data.video === "string") {
    return data.video;
  }

  if (Array.isArray(data.video)) {
    for (const item of data.video) {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object") {
        const url = getUrlFromObject(item, [
          "url",
          "download_url",
          "downloadUrl",
          "media_url",
          "mediaUrl",
          "video_url",
          "videoUrl",
          "src",
          "source"
        ]);

        if (url) {
          return url;
        }
      }
    }
  }

  return null;
}

// --------------------------------------------------
// Get Reel cover URL
// --------------------------------------------------
function getCoverUrl(data) {
  if (!data) return null;

  if (typeof data.cover === "string") {
    return data.cover;
  }

  if (Array.isArray(data.cover)) {
    for (const item of data.cover) {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object") {
        const url = getUrlFromObject(item, [
          "url",
          "download_url",
          "downloadUrl",
          "media_url",
          "mediaUrl",
          "image_url",
          "imageUrl",
          "src",
          "source"
        ]);

        if (url) {
          return url;
        }
      }
    }
  }

  return null;
}

// --------------------------------------------------
// Find caption
// --------------------------------------------------
function getCaption(data) {
  if (!data || typeof data !== "object") {
    return "";
  }

  return (
    data.caption ||
    data.description ||
    data.text ||
    ""
  );
}

// --------------------------------------------------
// Find username / owner
// --------------------------------------------------
function getUsername(data) {
  if (!data || typeof data !== "object") {
    return "";
  }

  return (
    data.username ||
    data.owner ||
    data.user?.username ||
    ""
  );
}

// --------------------------------------------------
// Format API details for Telegram
// --------------------------------------------------
function formatDetails(data) {
  if (!data || typeof data !== "object") {
    return "📋 <b>Post Details</b>\n\nNo details available.";
  }

  const lines = [];

  lines.push("📋 <b>Instagram Details</b>");
  lines.push("");

  // Username
  const username =
    data.username ||
    data.owner?.username ||
    data.owner ||
    data.user?.username;

  if (username) {
    lines.push(`👤 <b>Username:</b> ${escapeHtml(String(username))}`);
  }

  // Caption
  if (data.caption) {
    lines.push("");
    lines.push("📝 <b>Caption:</b>");
    lines.push(escapeHtml(String(data.caption)));
  }

  // Taken date
  if (data.taken_at) {
    lines.push("");
    lines.push(
      `📅 <b>Taken at:</b> ${escapeHtml(String(data.taken_at))}`
    );
  }

  // Likes
  if (data.like_count !== undefined) {
    lines.push(
      `❤️ <b>Likes:</b> ${formatNumber(data.like_count)}`
    );
  }

  // Comments
  if (data.comment_count !== undefined) {
    lines.push(
      `💬 <b>Comments:</b> ${formatNumber(data.comment_count)}`
    );
  }

  // Views
  if (data.view_count !== undefined && data.view_count !== 0) {
    lines.push(
      `👁️ <b>Views:</b> ${formatNumber(data.view_count)}`
    );
  }

  // Plays
  if (data.play_count !== undefined) {
    lines.push(
      `▶️ <b>Plays:</b> ${formatNumber(data.play_count)}`
    );
  }

  // Reshares
  if (data.reshare_count !== undefined) {
    lines.push(
      `🔁 <b>Reshares:</b> ${formatNumber(data.reshare_count)}`
    );
  }

  // Media count
  if (Array.isArray(data.image)) {
    lines.push(
      `🖼️ <b>Images:</b> ${data.image.length}`
    );
  }

  if (Array.isArray(data.video)) {
    lines.push(
      `🎬 <b>Videos:</b> ${data.video.length}`
    );
  }

  if (data.p !== undefined) {
    lines.push(
      `📌 <b>Post:</b> ${data.p ? "Yes" : "No"}`
    );
  }

  if (data.made_by) {
    lines.push(
      `⚙️ <b>Source:</b> ${escapeHtml(String(data.made_by))}`
    );
  }

  lines.push("");
  lines.push("🚀 <b>Powered by Instadrop</b>");

  return lines.join("\n");
}

// --------------------------------------------------
// HTML escape
// --------------------------------------------------
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --------------------------------------------------
// Format numbers
// --------------------------------------------------
function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return escapeHtml(String(value));
  }

  return number.toLocaleString("en-US");
}

// --------------------------------------------------
// Build buttons
//
// Reel:
// [ Get Cover Photo ] [ Get Details ]
//
// Other media:
// [ Get Details ]
// --------------------------------------------------
function buildMediaKeyboard(storageId, includeCover = false) {
  if (includeCover) {
    return {
      inline_keyboard: [
        [
          {
            text: "🖼️ Get Cover Photo",
            callback_data: `get_cover:${storageId}`
          },
          {
            text: "📋 Get Details",
            callback_data: `get_details:${storageId}`
          }
        ]
      ]
    };
  }

  return {
    inline_keyboard: [
      [
        {
          text: "📋 Get Details",
          callback_data: `get_details:${storageId}`
        }
      ]
    ]
  };
}

// --------------------------------------------------
// Send media to Telegram
// --------------------------------------------------
async function sendMedia(
  chatId,
  url,
  options = {}
) {
  const type = getMediaType(url);

  const replyMarkup = options.storageId
    ? buildMediaKeyboard(
        options.storageId,
        options.includeCover === true
      )
    : undefined;

  if (type === "video") {
    return await telegram("sendVideo", {
      chat_id: chatId,
      video: url,
      supports_streaming: true,
      caption: options.caption || undefined,
      parse_mode: options.caption ? "HTML" : undefined,
      reply_markup: replyMarkup
    });
  }

  return await telegram("sendPhoto", {
    chat_id: chatId,
    photo: url,
    caption: options.caption || undefined,
    parse_mode: options.caption ? "HTML" : undefined,
    reply_markup: replyMarkup
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
    `👤 <b>Name:</b> ${escapeHtml(firstName)} ${escapeHtml(lastName)}\n` +
    `🔗 <b>Username:</b> ${escapeHtml(username)}\n` +
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
    isReel: isReelResponse(data),
    reelVideo: getReelVideo(data),
    cover: getCoverUrl(data),
    caption: getCaption(data),
    media: uniqueUrls(extractMedia(data))
  };
}

// --------------------------------------------------
// Store API response for callback buttons
// --------------------------------------------------
function storeMediaData(data) {
  const id = createStorageId();

  mediaStorage.set(id, {
    ...data,
    createdAt: Date.now()
  });

  // Prevent unlimited memory growth.
  //
  // Remove entries older than 30 minutes.
  const expiry = Date.now() - 30 * 60 * 1000;

  for (const [key, value] of mediaStorage.entries()) {
    if (value.createdAt < expiry) {
      mediaStorage.delete(key);
    }
  }

  return id;
}

// --------------------------------------------------
// Handle Get Cover / Get Details buttons
// --------------------------------------------------
async function handleCallbackQuery(callbackQuery) {
  const callbackId = callbackQuery.id;
  const message = callbackQuery.message;
  const chatId = message?.chat?.id;

  const data = callbackQuery.data || "";

  // Acknowledge button press immediately.
  await telegram("answerCallbackQuery", {
    callback_query_id: callbackId
  });

  if (!chatId) {
    return;
  }

  const [action, storageId] = data.split(":");

  if (!action || !storageId) {
    return;
  }

  const stored = mediaStorage.get(storageId);

  if (!stored) {
    await telegram("sendMessage", {
      chat_id: chatId,
      text:
        "⚠️ <b>This media information has expired.</b>\n\n" +
        "Please send the Instagram link again.",
      parse_mode: "HTML"
    });

    return;
  }

  // ==================================================
  // GET COVER PHOTO
  // ==================================================
  if (action === "get_cover") {
    if (!stored.cover) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          "❌ <b>Cover photo is not available.</b>",
        parse_mode: "HTML"
      });

      return;
    }

    try {
      await telegram("sendPhoto", {
        chat_id: chatId,
        photo: stored.cover,
        caption: "🖼️ <b>Reel Cover</b>\n\nDownloaded from Instadrop.",
        parse_mode: "HTML"
      });
    } catch (error) {
      console.error(
        "Cover send error:",
        error
      );

      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          `🖼️ <b>Cover Photo:</b>\n${stored.cover}`,
        parse_mode: "HTML"
      });
    }

    return;
  }

  // ==================================================
  // GET DETAILS
  // ==================================================
  if (action === "get_details") {
    const details = formatDetails(stored.raw);

    await telegram("sendMessage", {
      chat_id: chatId,
      text: details,
      parse_mode: "HTML",
      disable_web_page_preview: true
    });

    return;
  }
}

// --------------------------------------------------
// Main handler
// --------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send(
      "Instadrop Bot is running 🚀"
    );
  }

  try {
    const update = req.body;

    if (!update) {
      return res.status(200).json({
        ok: true
      });
    }

    // ==================================================
    // CALLBACK BUTTON
    // ==================================================
    if (update.callback_query) {
      await handleCallbackQuery(
        update.callback_query
      );

      return res.status(200).json({
        ok: true
      });
    }

    // ==================================================
    // NORMAL MESSAGE
    // ==================================================
    if (!update.message) {
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
      await notifyAdmin(user);
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
      const processing = await telegram(
        "sendMessage",
        {
          chat_id: chatId,
          text:
            "⏳ <b>Processing your Instagram link...</b>\n\n" +
            "Please wait a moment 🚀",
          parse_mode: "HTML"
        }
      );

      try {
        // --------------------------------------------------
        // Call API
        // --------------------------------------------------
        const result = await downloadFromAPI(text);

        // ==================================================
        // REEL
        // ==================================================
        //
        // NEW BEHAVIOUR:
        // Send ONLY the video.
        //
        // Do NOT send result.cover here.
        //
        // The video gets:
        // 🖼️ Get Cover Photo
        // 📋 Get Details
        // ==================================================
        if (result.isReel) {
          const reelVideo = result.reelVideo;

          if (!reelVideo) {
            throw new Error(
              "Reel response found but no video URL was available."
            );
          }

          const storageId = storeMediaData({
            raw: result.raw,
            cover: result.cover,
            caption: result.caption,
            isReel: true
          });

          if (processing.result?.message_id) {
            await telegram("deleteMessage", {
              chat_id: chatId,
              message_id:
                processing.result.message_id
            });
          }

          const reelCaption =
            `📥 <b>Downloaded from Instadrop</b>`;

          try {
            await sendMedia(
              chatId,
              reelVideo,
              {
                caption: reelCaption,
                storageId,
                includeCover: true
              }
            );
          } catch (mediaError) {
            console.error(
              "Reel send error:",
              mediaError
            );

            await telegram("sendMessage", {
              chat_id: chatId,
              text:
                `📥 <b>Download Reel:</b>\n${reelVideo}`,
              parse_mode: "HTML",
              reply_markup:
                buildMediaKeyboard(
                  storageId,
                  true
                )
            });
          }

          return res.status(200).json({
            ok: true
          });
        }

        // ==================================================
        // NORMAL POST / CAROUSEL / OTHER MEDIA
        // ==================================================
        //
        // For these, continue sending all media found.
        //
        // However, the new "Get Details" button is attached
        // to every media item.
        // ==================================================

        const media = result.media;

        if (!media || media.length === 0) {
          if (processing.result?.message_id) {
            await telegram("editMessageText", {
              chat_id: chatId,
              message_id:
                processing.result.message_id,
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

        // Store complete API response once.
        const storageId = storeMediaData({
          raw: result.raw,
          cover: result.cover,
          caption: result.caption,
          isReel: false
        });

        // Delete processing message.
        if (processing.result?.message_id) {
          await telegram("deleteMessage", {
            chat_id: chatId,
            message_id:
              processing.result.message_id
          });
        }

        // --------------------------------------------------
        // Send every actual media item
        // --------------------------------------------------
        for (let i = 0; i < media.length; i++) {
          const mediaUrl = media[i];

          try {
            await sendMedia(
              chatId,
              mediaUrl,
              {
                storageId,
                includeCover: false,
                caption:
                  i === 0
                    ? "📥 <b>Downloaded from Instadrop</b>"
                    : undefined
              }
            );
          } catch (mediaError) {
            console.error(
              "Media send error:",
              mediaError
            );

            await telegram("sendMessage", {
              chat_id: chatId,
              text:
                `📥 <b>Download:</b>\n${mediaUrl}`,
              parse_mode: "HTML",
              reply_markup:
                buildMediaKeyboard(
                  storageId,
                  false
                )
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
            message_id:
              processing.result.message_id,
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

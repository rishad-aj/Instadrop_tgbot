
const TELEGRAM_BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s";
const ADMIN_CHAT_ID = "7216371031";

const API_URL = "https://instadrop.rishu-rishad2019.workers.dev/?url=";
const WELCOME_IMAGE = "https://instadrop.web.app/og-image.png";
const WEBSITE_URL = "https://instadrop.web.app/";

// --------------------------------------------------
// Temporary first-user tracking
// --------------------------------------------------
// IMPORTANT:
// This resets when a serverless instance restarts.
// For permanent storage, use a database/KV/Redis.
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
// Instagram URL checker
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
// /start
// --------------------------------------------------
async function handleStart(message) {
  const user = message.from;
  const chatId = message.chat.id;

  const firstName = user.first_name || "Unknown";
  const lastName = user.last_name || "";

  const username = user.username
    ? `@${user.username}`
    : "No username";

  // ----------------------------------------------
  // Notify admin only once
  // ----------------------------------------------
  if (!notifiedUsers.has(user.id)) {
    const adminMessage =
      `🆕 <b>New User Started Instadrop</b>\n\n` +
      `👤 <b>Name:</b> ${firstName} ${lastName}\n` +
      `🔗 <b>Username:</b> ${username}\n` +
      `🆔 <b>Chat ID:</b> <code>${user.id}</code>`;

    await telegram("sendMessage", {
      chat_id: ADMIN_CHAT_ID,
      text: adminMessage,
      parse_mode: "HTML"
    });

    notifiedUsers.add(user.id);
  }

  // ----------------------------------------------
  // Welcome message
  // ----------------------------------------------
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
// Call Instadrop API
// --------------------------------------------------
async function getInstagramMedia(instagramUrl) {
  const apiUrl =
    API_URL + encodeURIComponent(instagramUrl);

  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error(
      `API Error: ${response.status}`
    );
  }

  const data = await response.json();

  return data;
}

// --------------------------------------------------
// Send Reel
// --------------------------------------------------
async function sendReel(chatId, data) {
  if (
    !data.video ||
    !Array.isArray(data.video) ||
    !data.video[0] ||
    !data.video[0].video
  ) {
    throw new Error("No Reel video found");
  }

  const videoUrl = data.video[0].video;
  const coverUrl = data.video[0].cover || null;

  // ----------------------------------------------
  // Build caption
  // ----------------------------------------------
  let caption = "";

  if (data.caption) {
    caption += `${data.caption}\n\n`;
  }

  caption += `📥 <b>Downloaded from @instadrop_tgbot</b>`;

  // Telegram caption limit is 1024 characters
  if (caption.length > 1024) {
    caption = caption.substring(0, 1010) + "...\n\n📥 <b>@instadrop_tgbot</b>";
  }

  // ----------------------------------------------
  // Buttons
  // ----------------------------------------------
  const buttons = [];

  if (coverUrl) {
    buttons.push({
      text: "🖼️ Download Cover Image",
      callback_data: `cover_${data.video[0].cover}`
    });
  }

  buttons.push({
    text: "📊 Post Details",
    callback_data: `details_${data.username || "unknown"}`
  });

  await telegram("sendVideo", {
    chat_id: chatId,
    video: videoUrl,
    caption: caption,
    parse_mode: "HTML",
    supports_streaming: true,
    reply_markup: {
      inline_keyboard: [
        buttons
      ]
    }
  });
}

// --------------------------------------------------
// Send Cover Image
// --------------------------------------------------
async function sendCover(chatId, coverUrl) {
  await telegram("sendPhoto", {
    chat_id: chatId,
    photo: coverUrl,
    caption:
      `🖼️ <b>Reel Cover</b>\n\n` +
      `📥 Downloaded from @instadrop_tgbot`,
    parse_mode: "HTML"
  });
}

// --------------------------------------------------
// Send Post Details
// --------------------------------------------------
async function sendPostDetails(chatId, data) {
  const username = data.username
    ? `@${data.username}`
    : "Unknown";

  const caption = data.caption || "No caption";

  const likes =
    typeof data.like_count === "number"
      ? data.like_count.toLocaleString()
      : "N/A";

  const comments =
    typeof data.comment_count === "number"
      ? data.comment_count.toLocaleString()
      : "N/A";

  const views =
    typeof data.view_count === "number" && data.view_count > 0
      ? data.view_count.toLocaleString()
      : "N/A";

  const plays =
    typeof data.play_count === "number"
      ? data.play_count.toLocaleString()
      : "N/A";

  const reshares =
    typeof data.reshare_count === "number"
      ? data.reshare_count.toLocaleString()
      : "N/A";

  const takenAt = data.taken_at
    ? new Date(data.taken_at).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
      })
    : "N/A";

  const details =
    `📊 <b>Post Details</b>\n\n` +

    `👤 <b>Username:</b> ${username}\n` +
    `❤️ <b>Likes:</b> ${likes}\n` +
    `💬 <b>Comments:</b> ${comments}\n` +
    `👁️ <b>Views:</b> ${views}\n` +
    `▶️ <b>Plays:</b> ${plays}\n` +
    `🔁 <b>Reshares:</b> ${reshares}\n` +
    `📅 <b>Published:</b> ${takenAt}\n\n` +

    `📝 <b>Caption:</b>\n` +
    `${caption}`;

  // Telegram message limit
  const finalText =
    details.length > 4096
      ? details.substring(0, 4080) + "..."
      : details;

  await telegram("sendMessage", {
    chat_id: chatId,
    text: finalText,
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
// Handle Instagram URL
// --------------------------------------------------
async function handleInstagramUrl(message) {
  const chatId = message.chat.id;
  const instagramUrl = message.text.trim();

  // ----------------------------------------------
  // Processing message
  // ----------------------------------------------
  const processing = await telegram("sendMessage", {
    chat_id: chatId,
    text:
      `⏳ <b>Processing your Instagram link...</b>\n\n` +
      `Please wait a moment 🚀`,
    parse_mode: "HTML"
  });

  try {
    // --------------------------------------------
    // Call API
    // --------------------------------------------
    const data = await getInstagramMedia(
      instagramUrl
    );

    // --------------------------------------------
    // Check Reel
    // --------------------------------------------
    if (
      data.video &&
      Array.isArray(data.video) &&
      data.video.length > 0 &&
      data.video[0].video
    ) {
      // Delete processing message
      if (processing.result?.message_id) {
        await telegram("deleteMessage", {
          chat_id: chatId,
          message_id: processing.result.message_id
        });
      }

      await sendReel(chatId, data);

      return;
    }

    // --------------------------------------------
    // If API returned images but no video
    // --------------------------------------------
    if (
      data.image &&
      Array.isArray(data.image) &&
      data.image.length > 0
    ) {
      if (processing.result?.message_id) {
        await telegram("deleteMessage", {
          chat_id: chatId,
          message_id: processing.result.message_id
        });
      }

      for (const image of data.image) {
        const imageUrl =
          typeof image === "string"
            ? image
            : image.image ||
              image.url ||
              image.src;

        if (!imageUrl) continue;

        await telegram("sendPhoto", {
          chat_id: chatId,
          photo: imageUrl
        });
      }

      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          `✅ <b>Done!</b>\n\n` +
          `📥 Downloaded from @instadrop_tgbot`,
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

      return;
    }

    // --------------------------------------------
    // Nothing found
    // --------------------------------------------
    if (processing.result?.message_id) {
      await telegram("editMessageText", {
        chat_id: chatId,
        message_id: processing.result.message_id,
        text:
          `❌ <b>No downloadable media found.</b>\n\n` +
          `The post may be private, unavailable, or unsupported.`,
        parse_mode: "HTML"
      });
    }

  } catch (error) {
    console.error(
      "Instagram download error:",
      error
    );

    if (processing.result?.message_id) {
      await telegram("editMessageText", {
        chat_id: chatId,
        message_id: processing.result.message_id,
        text:
          `❌ <b>Download failed</b>\n\n` +
          `I couldn't process that Instagram link.\n\n` +
          `Please check the link and try again.`,
        parse_mode: "HTML"
      });
    }
  }
}

// --------------------------------------------------
// Callback queries
// --------------------------------------------------
async function handleCallbackQuery(callbackQuery) {
  const callbackId = callbackQuery.id;
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const data = callbackQuery.data || "";

  // ----------------------------------------------
  // Always answer callback quickly
  // ----------------------------------------------
  await telegram("answerCallbackQuery", {
    callback_query_id: callbackId
  });

  // ----------------------------------------------
  // Cover button
  // ----------------------------------------------
  if (data.startsWith("cover_")) {
    const coverUrl = data.substring(6);

    if (!coverUrl) {
      return;
    }

    await sendCover(chatId, coverUrl);

    return;
  }

  // ----------------------------------------------
  // Details button
  // ----------------------------------------------
  if (data.startsWith("details_")) {
    // We need the original API data here.
    //
    // Telegram callback_data has a strict size limit,
    // so the complete API response should NOT be stored
    // inside callback_data.
    //
    // For now, tell the user to request the details.
    await telegram("sendMessage", {
      chat_id: chatId,
      text:
        `📊 <b>Post Details</b>\n\n` +
        `The details for this post are available from the API.`,
      parse_mode: "HTML"
    });

    return;
  }
}

// --------------------------------------------------
// Main webhook handler
// --------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(200)
      .send("Instadrop Bot is running 🚀");
  }

  try {
    const update = req.body;

    // ==================================================
    // CALLBACK QUERY
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

    // ==================================================
    // /START
    // ==================================================
    if (
      message.text === "/start" ||
      message.text?.startsWith("/start ")
    ) {
      await handleStart(message);

      return res.status(200).json({
        ok: true
      });
    }

    // ==================================================
    // INSTAGRAM URL
    // ==================================================
    if (
      message.text &&
      isInstagramUrl(message.text)
    ) {
      await handleInstagramUrl(message);

      return res.status(200).json({
        ok: true
      });
    }

    // ==================================================
    // OTHER MESSAGE
    // ==================================================
    if (message.text) {
      await telegram("sendMessage", {
        chat_id: message.chat.id,
        text:
          `🔗 <b>Send me an Instagram link!</b>\n\n` +
          `🎬 Reels\n` +
          `🖼️ Posts & Carousels\n` +
          `📖 Stories\n` +
          `👤 Profiles`,
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

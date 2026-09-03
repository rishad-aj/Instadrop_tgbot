const TELEGRAM_BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s";
const ADMIN_CHAT_ID = "7216371031";

const API_URL = "https://instadrop.rishu-rishad2019.workers.dev/?url=";
const WELCOME_IMAGE = "https://instadrop.web.app/og-image.png";
const WEBSITE_URL = "https://instadrop.web.app/";

// Temporary in-memory storage.
// Replace with a database/KV for permanent storage.
const notifiedUsers = new Set();

// Store Reel information temporarily for button callbacks.
// For production, use Redis/KV/database instead.
const reelCache = new Map();


// ==================================================
// TELEGRAM API HELPER
// ==================================================

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


// ==================================================
// INSTAGRAM URL CHECK
// ==================================================

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


// ==================================================
// API REQUEST
// ==================================================

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

  return await response.json();
}


// ==================================================
// WELCOME MESSAGE
// ==================================================

async function sendWelcome(chatId) {
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


// ==================================================
// ADMIN NOTIFICATION
// ==================================================

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


// ==================================================
// REEL HANDLER
// ==================================================

async function sendReel(chatId, data) {
  if (
    !data.video ||
    !Array.isArray(data.video) ||
    !data.video[0] ||
    !data.video[0].video
  ) {
    throw new Error("Reel video not found");
  }

  const reel = data.video[0];

  const videoUrl = reel.video;
  const coverUrl = reel.cover || null;

  // Create unique ID for button callbacks
  const reelId =
    `${chatId}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

  // Save Reel data for button actions
  reelCache.set(reelId, {
    cover: coverUrl,
    caption: data.caption || "",
    username: data.username || "Unknown",
    taken_at: data.taken_at || null,
    like_count: data.like_count || 0,
    comment_count: data.comment_count || 0,
    view_count: data.view_count || 0,
    play_count: data.play_count || 0,
    reshare_count: data.reshare_count || 0
  });

  // Keep cache from growing forever
  setTimeout(() => {
    reelCache.delete(reelId);
  }, 30 * 60 * 1000);


  // --------------------------------------------------
  // VIDEO CAPTION
  // --------------------------------------------------

  let caption = "";

  if (data.caption) {
    caption =
      `🎬 <b>Instagram Reel</b>\n\n` +
      `${data.caption}\n\n` +
      `📥 Downloaded from @instadrop_tgbot`;
  } else {
    caption =
      `🎬 <b>Instagram Reel</b>\n\n` +
      `📥 Downloaded from @instadrop_tgbot`;
  }

  // Telegram caption limit protection
  if (caption.length > 1024) {
    caption =
      `🎬 <b>Instagram Reel</b>\n\n` +
      `${data.caption.slice(0, 850)}...\n\n` +
      `📥 Downloaded from @instadrop_tgbot`;
  }


  // --------------------------------------------------
  // BUTTONS
  // --------------------------------------------------

  const buttons = [];

  if (coverUrl) {
    buttons.push({
      text: "🖼️ Download Cover",
      callback_data: `cover:${reelId}`
    });
  }

  buttons.push({
    text: "📊 Post Details",
    callback_data: `details:${reelId}`
  });


  // --------------------------------------------------
  // SEND REEL VIDEO
  // --------------------------------------------------

  const result = await telegram("sendVideo", {
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

  if (!result.ok) {
    throw new Error(
      result.description || "Telegram failed to send Reel"
    );
  }
}


// ==================================================
// POST DETAILS
// ==================================================

function formatNumber(number) {
  if (!number) return "0";

  return Number(number).toLocaleString("en-US");
}


function formatDate(date) {
  if (!date) return "Unknown";

  try {
    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return date;
  }
}


async function sendPostDetails(query, reel) {
  const details =
    `📊 <b>Instagram Reel Details</b>\n\n` +

    `👤 <b>Username:</b> @${reel.username.replace(/^@/, "")}\n` +

    `❤️ <b>Likes:</b> ${formatNumber(reel.like_count)}\n` +

    `💬 <b>Comments:</b> ${formatNumber(reel.comment_count)}\n` +

    `👁️ <b>Views:</b> ${formatNumber(reel.view_count)}\n` +

    `▶️ <b>Plays:</b> ${formatNumber(reel.play_count)}\n` +

    `🔄 <b>Reshares:</b> ${formatNumber(reel.reshare_count)}\n` +

    `📅 <b>Published:</b> ${formatDate(reel.taken_at)}\n\n` +

    `📝 <b>Caption:</b>\n` +
    `${reel.caption || "No caption"}\n\n` +

    `📥 <b>Downloaded from @instadrop_tgbot</b>`;

  await telegram("sendMessage", {
    chat_id: query.message.chat.id,
    text: details,
    parse_mode: "HTML"
  });
}


// ==================================================
// SEND REEL COVER
// ==================================================

async function sendReelCover(query, reel) {
  if (!reel.cover) {
    await telegram("answerCallbackQuery", {
      callback_query_id: query.id,
      text: "❌ Cover image is not available.",
      show_alert: true
    });

    return;
  }

  await telegram("answerCallbackQuery", {
    callback_query_id: query.id,
    text: "🖼️ Sending cover..."
  });

  await telegram("sendPhoto", {
    chat_id: query.message.chat.id,
    photo: reel.cover,
    caption:
      `🖼️ <b>Reel Cover</b>\n\n` +
      `📥 Downloaded from @instadrop_tgbot`,
    parse_mode: "HTML"
  });
}


// ==================================================
// CALLBACK QUERY HANDLER
// ==================================================

async function handleCallbackQuery(query) {
  const data = query.data || "";

  if (
    !data.startsWith("cover:") &&
    !data.startsWith("details:")
  ) {
    return;
  }

  const [action, reelId] = data.split(":");

  const reel = reelCache.get(reelId);

  if (!reel) {
    await telegram("answerCallbackQuery", {
      callback_query_id: query.id,
      text:
        "⏳ This Reel data has expired. Please download the Reel again.",
      show_alert: true
    });

    return;
  }

  if (action === "cover") {
    await sendReelCover(query, reel);
    return;
  }

  if (action === "details") {
    await telegram("answerCallbackQuery", {
      callback_query_id: query.id
    });

    await sendPostDetails(query, reel);
  }
}


// ==================================================
// MAIN HANDLER
// ==================================================

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res
      .status(200)
      .send("Instadrop Bot is running 🚀");
  }

  try {

    const update = req.body;

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
    // MESSAGE
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
    const text = (message.text || "").trim();


    // ==================================================
    // /START
    // ==================================================

    if (
      text === "/start" ||
      text.startsWith("/start ")
    ) {

      // Admin only gets first-time notification
      await notifyAdmin(user);

      // User gets welcome message
      await sendWelcome(chatId);

      return res.status(200).json({
        ok: true
      });
    }


    // ==================================================
    // IGNORE EMPTY MESSAGES
    // ==================================================

    if (!text) {
      return res.status(200).json({
        ok: true
      });
    }


    // ==================================================
    // INSTAGRAM URL
    // ==================================================

    if (isInstagramUrl(text)) {

      const processing =
        await telegram("sendMessage", {
          chat_id: chatId,
          text:
            `⏳ <b>Processing your Instagram link...</b>\n\n` +
            `Please wait a moment 🚀`,
          parse_mode: "HTML"
        });


      try {

        // Call your API
        const data =
          await downloadFromAPI(text);


        // ==================================================
        // REEL DETECTION
        // ==================================================

        const isReel =
          Array.isArray(data.video) &&
          data.video.length > 0 &&
          data.video[0] &&
          data.video[0].video;


        if (isReel) {

          // Delete processing message
          if (processing.result?.message_id) {
            await telegram("deleteMessage", {
              chat_id: chatId,
              message_id:
                processing.result.message_id
            });
          }

          // Send Reel
          await sendReel(
            chatId,
            data
          );

          return res.status(200).json({
            ok: true
          });
        }


        // ==================================================
        // OTHER MEDIA
        // ==================================================

        // Your existing non-Reel handling can remain here.
        // This section does NOT change Reel behavior.

        const mediaUrls = [];

        if (Array.isArray(data.image)) {
          for (const item of data.image) {

            if (typeof item === "string") {
              mediaUrls.push(item);
            }

            if (
              item &&
              typeof item.image === "string"
            ) {
              mediaUrls.push(item.image);
            }

            if (
              item &&
              typeof item.url === "string"
            ) {
              mediaUrls.push(item.url);
            }
          }
        }


        // Video fallback for non-Reel responses
        if (Array.isArray(data.video)) {
          for (const item of data.video) {

            if (
              item &&
              typeof item.video === "string"
            ) {
              mediaUrls.push(item.video);
            }
          }
        }


        // Remove duplicates
        const uniqueMedia =
          [...new Set(mediaUrls)];


        // Delete processing message
        if (processing.result?.message_id) {
          await telegram("deleteMessage", {
            chat_id: chatId,
            message_id:
              processing.result.message_id
          });
        }


        // No media
        if (uniqueMedia.length === 0) {

          await telegram("sendMessage", {
            chat_id: chatId,
            text:
              `❌ <b>No downloadable media found.</b>\n\n` +
              `The Instagram post may be private, unavailable, or unsupported.`,
            parse_mode: "HTML"
          });

          return res.status(200).json({
            ok: true
          });
        }


        // Send media
        for (const mediaUrl of uniqueMedia) {

          const lower =
            mediaUrl.toLowerCase();

          if (
            lower.includes(".mp4") ||
            lower.includes("video")
          ) {

            await telegram("sendVideo", {
              chat_id: chatId,
              video: mediaUrl,
              supports_streaming: true
            });

          } else {

            await telegram("sendPhoto", {
              chat_id: chatId,
              photo: mediaUrl
            });
          }
        }


        // Done message
        await telegram("sendMessage", {
          chat_id: chatId,
          text:
            `✅ <b>Done!</b>\n\n` +
            `📦 ${uniqueMedia.length} media file` +
            `${uniqueMedia.length > 1 ? "s" : ""} found.\n\n` +
            `📥 <b>Downloaded from @instadrop_tgbot</b>`,
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
    // NOT AN INSTAGRAM URL
    // ==================================================

    await telegram("sendMessage", {
      chat_id: chatId,
      text:
        `🔗 <b>Send me an Instagram link</b>\n\n` +
        `🎬 Reel\n` +
        `🖼️ Post\n` +
        `📚 Carousel\n` +
        `📖 Story\n\n` +
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

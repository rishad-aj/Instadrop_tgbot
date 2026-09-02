
import { Bot, InlineKeyboard } from "grammy";

const TELEGRAM_BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s";
const ADMIN_CHAT_ID = "7216371031";

const bot = new Bot(TELEGRAM_BOT_TOKEN);

// Temporary thumbnail storage.
// Later we can replace this with a proper database/KV store.
const thumbnailStore = new Map();


// ----------------------------------------------------
// TELEGRAM API HELPER
// ----------------------------------------------------

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

  return response.json();
}


// ----------------------------------------------------
// MAIN HANDLER
// ----------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Instadrop Bot is running 🚀");
  }

  try {
    const update = req.body;

    // --------------------------------------------------
    // CALLBACK QUERY
    // --------------------------------------------------

    if (update.callback_query) {
      const callback = update.callback_query;

      if (callback.data?.startsWith("thumbnail:")) {
        const id = callback.data.replace("thumbnail:", "");

        const thumbnail = thumbnailStore.get(id);

        // Tell Telegram the button was pressed
        await telegram("answerCallbackQuery", {
          callback_query_id: callback.id,
          text: "Sending thumbnail 🖼️"
        });

        if (!thumbnail) {
          await telegram("sendMessage", {
            chat_id: callback.from.id,
            text: "⚠️ Sorry, this thumbnail is no longer available."
          });

          return res.status(200).json({ ok: true });
        }

        // Send thumbnail
        await telegram("sendPhoto", {
          chat_id: callback.from.id,
          photo: thumbnail,
          caption: "🖼️ Reel Thumbnail\n\n@instadrop_tgbot"
        });

        return res.status(200).json({ ok: true });
      }

      return res.status(200).json({ ok: true });
    }


    // --------------------------------------------------
    // NORMAL MESSAGE
    // --------------------------------------------------

    if (!update.message) {
      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    const user = message.from;

    const chatId = user.id;
    const firstName = user.first_name || "Unknown";
    const lastName = user.last_name || "";

    const username = user.username
      ? `@${user.username}`
      : "No username";


    // --------------------------------------------------
    // /START
    // --------------------------------------------------

    if (message.text?.startsWith("/start")) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          `👋 Hello ${firstName}!\n\n` +
          `Welcome to *Instadrop* 🚀\n\n` +
          `📥 Send me an Instagram Reel URL and I'll download it for you.\n\n` +
          `Example:\n` +
          `https://www.instagram.com/reel/XXXXXXXX/`,
        parse_mode: "Markdown"
      });

      return res.status(200).json({ ok: true });
    }


    // --------------------------------------------------
    // CHECK FOR INSTAGRAM URL
    // --------------------------------------------------

    const text = message.text || "";

    const instagramUrl = text.match(
      /https?:\/\/(?:www\.)?instagram\.com\/[^\s]+/i
    )?.[0];

    if (!instagramUrl) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          `❌ I couldn't find an Instagram URL.\n\n` +
          `Send me an Instagram Reel link and I'll download it for you.`
      });

      return res.status(200).json({ ok: true });
    }


    // --------------------------------------------------
    // SHOW PROCESSING MESSAGE
    // --------------------------------------------------

    const processing = await telegram("sendMessage", {
      chat_id: chatId,
      text: "⏳ Fetching your Reel..."
    });


    // --------------------------------------------------
    // CALL REEL API
    // --------------------------------------------------

    const apiUrl =
      `https://insta.thakur-infopd.workers.dev/?url=${encodeURIComponent(
        instagramUrl
      )}`;

    const apiResponse = await fetch(apiUrl);

    if (!apiResponse.ok) {
      throw new Error(`Reel API returned ${apiResponse.status}`);
    }

    const data = await apiResponse.json();


    // --------------------------------------------------
    // CHECK API RESPONSE
    // --------------------------------------------------

    if (
      !data.p ||
      !Array.isArray(data.video) ||
      !data.video.length ||
      !data.video[0]?.video
    ) {
      await telegram("editMessageText", {
        chat_id: chatId,
        message_id: processing.result?.message_id,
        text:
          "❌ I couldn't download this Reel.\n\n" +
          "The Reel may be private, unavailable, or unsupported."
      });

      return res.status(200).json({ ok: true });
    }


    const reel = data.video[0];

    const videoUrl = reel.video;
    const thumbnailUrl = reel.thumbnail;


    // --------------------------------------------------
    // CREATE SHORT ID FOR THUMBNAIL BUTTON
    // --------------------------------------------------

    const thumbnailId =
      `${chatId}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    thumbnailStore.set(thumbnailId, thumbnailUrl);

    // Keep memory from growing forever
    setTimeout(() => {
      thumbnailStore.delete(thumbnailId);
    }, 30 * 60 * 1000);


    // --------------------------------------------------
    // DELETE PROCESSING MESSAGE
    // --------------------------------------------------

    if (processing.result?.message_id) {
      await telegram("deleteMessage", {
        chat_id: chatId,
        message_id: processing.result.message_id
      });
    }


    // --------------------------------------------------
    // SEND REEL
    // --------------------------------------------------

    const keyboard = new InlineKeyboard()
      .text(
        "🖼 Save Thumbnail",
        `thumbnail:${thumbnailId}`
      );

    await telegram("sendVideo", {
      chat_id: chatId,
      video: videoUrl,
      caption:
        `🎬 Instagram Reel\n\n` +
        `@instadrop_tgbot`,
      reply_markup: keyboard
    });


    // --------------------------------------------------
    // NOTIFY ADMIN
    // --------------------------------------------------

    const adminMessage =
      `📥 Reel Downloaded\n\n` +
      `👤 Name: ${firstName} ${lastName}\n` +
      `🔗 Username: ${username}\n` +
      `🆔 Chat ID: ${chatId}\n` +
      `🔗 ${instagramUrl}`;

    await telegram("sendMessage", {
      chat_id: ADMIN_CHAT_ID,
      text: adminMessage
    });


    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("BOT ERROR:", error);

    return res.status(200).json({
      ok: false,
      error: error.message
    });
  }
}

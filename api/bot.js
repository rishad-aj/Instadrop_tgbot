import { Bot, InlineKeyboard } from "grammy";

const TELEGRAM_BOT_TOKEN = "YOUR_NEW_BOT_TOKEN";
const ADMIN_CHAT_ID = "7216371031";

const bot = new Bot(TELEGRAM_BOT_TOKEN);

// Temporary thumbnail storage
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

  // Health check
  if (req.method !== "POST") {
    return res.status(200).send("Instadrop Bot is running 🚀");
  }

  try {

    const update = req.body;


    // ==================================================
    // CALLBACK QUERY
    // ==================================================

    if (update.callback_query) {

      const callback = update.callback_query;

      // ----------------------------------------------
      // SAVE THUMBNAIL
      // ----------------------------------------------

      if (callback.data?.startsWith("thumbnail:")) {

        const thumbnailId =
          callback.data.replace("thumbnail:", "");

        const thumbnail =
          thumbnailStore.get(thumbnailId);


        // Answer button click
        await telegram("answerCallbackQuery", {
          callback_query_id: callback.id,
          text: "Sending thumbnail 🖼️"
        });


        if (!thumbnail) {

          await telegram("sendMessage", {
            chat_id: callback.from.id,
            text:
              "⚠️ Sorry, this thumbnail has expired.\n\n" +
              "Please send the Instagram Reel again."
          });

          return res.status(200).json({
            ok: true
          });
        }


        // Send thumbnail
        await telegram("sendPhoto", {
          chat_id: callback.from.id,
          photo: thumbnail,
          caption:
            "🖼️ Reel Thumbnail\n\n" +
            "@instadrop_tgbot"
        });


        return res.status(200).json({
          ok: true
        });
      }


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


    const chatId = user.id;

    const firstName =
      user.first_name || "Unknown";

    const lastName =
      user.last_name || "";

    const username =
      user.username
        ? `@${user.username}`
        : "No username";


    // ==================================================
    // /START
    // ==================================================

    if (message.text?.startsWith("/start")) {

      await telegram("sendMessage", {

        chat_id: chatId,

        text:
          `👋 Hello ${firstName}!\n\n` +

          `🚀 Welcome to *Instadrop*.\n\n` +

          `📥 Send me an Instagram link and I'll download the media for you.\n\n` +

          `Currently supported:\n` +
          `🎬 Reels\n` +
          `🖼️ Posts\n` +
          `📚 Carousels\n\n` +

          `Simply send the Instagram URL here.`,
        
        parse_mode: "Markdown"
      });


      return res.status(200).json({
        ok: true
      });
    }


    // ==================================================
    // FIND INSTAGRAM URL
    // ==================================================

    const text =
      message.text || "";


    const instagramMatch =
      text.match(
        /https?:\/\/(?:www\.)?instagram\.com\/[^\s]+/i
      );


    if (!instagramMatch) {

      await telegram("sendMessage", {

        chat_id: chatId,

        text:
          `❌ I couldn't find an Instagram URL.\n\n` +

          `Send me an Instagram Reel, Post or Carousel link.`
      });


      return res.status(200).json({
        ok: true
      });
    }


    const instagramUrl =
      instagramMatch[0];


    // ==================================================
    // PROCESSING MESSAGE
    // ==================================================

    const processing =
      await telegram("sendMessage", {

        chat_id: chatId,

        text:
          "⏳ Fetching Instagram media..."
      });


    // ==================================================
    // INSTAGRAM API
    // ==================================================

    const apiUrl =
      `https://insta.thakur-infopd.workers.dev/?url=${encodeURIComponent(
        instagramUrl
      )}`;


    const apiResponse =
      await fetch(apiUrl);


    if (!apiResponse.ok) {

      throw new Error(
        `Instagram API returned ${apiResponse.status}`
      );
    }


    const data =
      await apiResponse.json();


    console.log(
      "Instagram API response:",
      data
    );


    // ==================================================
    // API FAILED
    // ==================================================

    if (!data.p) {

      if (processing.result?.message_id) {

        await telegram("editMessageText", {

          chat_id: chatId,

          message_id:
            processing.result.message_id,

          text:
            `❌ Unable to download this Instagram media.\n\n` +

            `It may be private, unavailable, or unsupported.`
        });
      }


      return res.status(200).json({
        ok: true
      });
    }


    // ==================================================
    // DELETE PROCESSING MESSAGE
    // ==================================================

    if (processing.result?.message_id) {

      await telegram("deleteMessage", {

        chat_id: chatId,

        message_id:
          processing.result.message_id
      });
    }


    // ==================================================
    // 🎬 REEL / VIDEO
    // ==================================================

    if (
      Array.isArray(data.video) &&
      data.video.length > 0
    ) {

      const reel =
        data.video[0];


      const videoUrl =
        reel.video;


      const thumbnailUrl =
        reel.thumbnail || null;


      if (!videoUrl) {

        throw new Error(
          "Video URL missing"
        );
      }


      // ----------------------------------------------
      // THUMBNAIL ID
      // ----------------------------------------------

      let keyboard;


      if (thumbnailUrl) {

        const thumbnailId =
          `${chatId}_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`;


        thumbnailStore.set(
          thumbnailId,
          thumbnailUrl
        );


        // Remove after 30 minutes
        setTimeout(() => {

          thumbnailStore.delete(
            thumbnailId
          );

        }, 30 * 60 * 1000);


        keyboard =
          new InlineKeyboard()
            .text(
              "🖼 Save Thumbnail",
              `thumbnail:${thumbnailId}`
            );
      }


      // ----------------------------------------------
      // SEND REEL
      // ----------------------------------------------

      await telegram("sendVideo", {

        chat_id: chatId,

        video: videoUrl,

        caption:
          `🎬 Instagram Reel\n\n` +
          `@instadrop_tgbot`,

        reply_markup:
          keyboard
      });


      return res.status(200).json({
        ok: true
      });
    }


    // ==================================================
    // 📚 CAROUSEL
    // ==================================================

    if (
      Array.isArray(data.image) &&
      data.image.length > 1
    ) {

      const images =
        data.image;


      // Telegram allows max 10 media items
      const imagesToSend =
        images.slice(0, 10);


      const media =
        imagesToSend.map(
          (imageUrl) => ({
            type: "photo",
            media: imageUrl
          })
        );


      // Caption only on first image
      media[0].caption =
        `📚 Instagram Carousel\n\n` +
        `@instadrop_tgbot`;


      // ----------------------------------------------
      // SEND ALBUM
      // ----------------------------------------------

      const result =
        await telegram(
          "sendMediaGroup",
          {
            chat_id: chatId,
            media: media
          }
        );


      console.log(
        "Carousel result:",
        result
      );


      // ----------------------------------------------
      // MORE THAN 10 IMAGES
      // ----------------------------------------------

      if (images.length > 10) {

        await telegram(
          "sendMessage",
          {

            chat_id: chatId,

            text:
              `⚠️ This carousel contains ${images.length} images.\n\n` +

              `Telegram allows a maximum of 10 images in one album, ` +
              `so only the first 10 were sent.`
          }
        );
      }


      return res.status(200).json({
        ok: true
      });
    }


    // ==================================================
    // 🖼️ SINGLE IMAGE POST
    // ==================================================

    if (
      Array.isArray(data.image) &&
      data.image.length === 1
    ) {

      const imageUrl =
        data.image[0];


      await telegram("sendPhoto", {

        chat_id: chatId,

        photo: imageUrl,

        caption:
          `🖼️ Instagram Post\n\n` +
          `@instadrop_tgbot`
      });


      return res.status(200).json({
        ok: true
      });
    }


    // ==================================================
    // ❌ UNSUPPORTED MEDIA
    // ==================================================

    await telegram("sendMessage", {

      chat_id: chatId,

      text:
        `❌ This Instagram link isn't supported yet.\n\n` +

        `Currently supported:\n` +
        `🎬 Reels\n` +
        `🖼️ Posts\n` +
        `📚 Carousels\n\n` +

        `Stories, Highlights and Profile Pictures ` +
        `aren't supported yet.`
    });


    return res.status(200).json({
      ok: true
    });


  } catch (error) {

    console.error(
      "BOT ERROR:",
      error
    );


    return res.status(200).json({
      ok: false,
      error: error.message
    });
  }
}


const TELEGRAM_BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s";
const ADMIN_CHAT_ID = "7216371031";

const WELCOME_IMAGE = "https://instadrop.web.app/og-image.png";
const WEBSITE_URL = "https://instadrop.web.app/";

// Temporary storage for users who have already been reported.
// IMPORTANT: This resets when a serverless instance restarts.
// For permanent tracking, use a database/KV/Redis.
const notifiedUsers = new Set();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot is running");
  }

  try {
    const update = req.body;

    if (!update.message) {
      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    const user = message.from;

    if (!user) {
      return res.status(200).json({ ok: true });
    }

    const chatId = user.id;
    const firstName = user.first_name || "Unknown";
    const lastName = user.last_name || "";
    const username = user.username
      ? `@${user.username}`
      : "No username";

    const text = message.text || "";

    // ==========================================
    // START COMMAND
    // ==========================================
    if (text === "/start" || text.startsWith("/start ")) {

      // Notify admin ONLY for first-time users
      if (!notifiedUsers.has(chatId)) {
        const adminMessage =
          `🆕 <b>New User Started Instadrop</b>\n\n` +
          `👤 <b>Name:</b> ${firstName} ${lastName}\n` +
          `🔗 <b>Username:</b> ${username}\n` +
          `🆔 <b>Chat ID:</b> <code>${chatId}</code>`;

        await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              chat_id: ADMIN_CHAT_ID,
              text: adminMessage,
              parse_mode: "HTML"
            })
          }
        );

        // Mark user as already notified
        notifiedUsers.add(chatId);
      }

      // ==========================================
      // WELCOME MESSAGE WITH IMAGE + BUTTON
      // ==========================================
      const welcomeCaption =
        `👋 <b>Welcome to Instadrop!</b>\n\n` +
        `📥 <b>Download Instagram media with ease.</b>\n` +
        `Just send me an Instagram link, and I'll take care of the rest. 🚀\n\n` +

        `✨ <b>What I can download:</b>\n` +
        `🎬 Reels & Videos\n` +
        `🖼️ Posts & Carousels\n` +
        `📖 Stories & Highlights\n` +
        `👤 Profile Pictures & Media\n\n` +

        `🔗 <b>Simply paste an Instagram link to get started!</b>\n\n` +
        `⚡ Fast • Simple • Easy`;

      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
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
          })
        }
      );

      return res.status(200).json({ ok: true });
    }

    // ==========================================
    // OTHER MESSAGES
    // ==========================================
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("Bot error:", error);

    return res.status(500).json({
      ok: false,
      error: "Something went wrong"
    });
  }
}

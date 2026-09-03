
const TELEGRAM_BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s";
const ADMIN_CHAT_ID = "7216371031";

// Temporary in-memory storage.
// NOTE: This resets when the server/serverless instance restarts.
// For production, replace this with Vercel KV, Redis, MongoDB, etc.
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

    // =========================
    // /START COMMAND
    // =========================
    if (text === "/start" || text.startsWith("/start ")) {

      // Notify admin ONLY the first time
      if (!notifiedUsers.has(chatId)) {
        const adminMessage =
          `🆕 New User Started The Bot\n\n` +
          `👤 Name: ${firstName} ${lastName}\n` +
          `🔗 Username: ${username}\n` +
          `🆔 Chat ID: ${chatId}`;

        await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              chat_id: ADMIN_CHAT_ID,
              text: adminMessage
            })
          }
        );

        // Mark user as notified
        notifiedUsers.add(chatId);
      }

      // Send welcome message to user
      const welcomeMessage =
        `👋 <b>Welcome to Instadrop!</b>\n\n` +
        `📥 Download Instagram media with ease.\n` +
        `Just send me an Instagram link and I'll take care of the rest. 🚀\n\n` +

        `✨ <b>What I can download:</b>\n` +
        `🎬 Reels & Videos\n` +
        `🖼️ Posts & Carousels\n` +
        `📖 Stories & Highlights\n` +
        `👤 Profile Pictures & Media\n\n` +

        `🔗 <b>Simply paste an Instagram link to get started!</b>\n\n` +
        `⚡ Fast • Simple • Easy`;

      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: welcomeMessage,
            parse_mode: "HTML"
          })
        }
      );

      return res.status(200).json({ ok: true });
    }

    // Ignore all other messages for now
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("Bot error:", error);

    return res.status(500).json({
      ok: false,
      error: "Something went wrong"
    });
  }
}

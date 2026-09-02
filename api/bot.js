const TELEGRAM_BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s";
const ADMIN_CHAT_ID = "7216371031";

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

    const chatId = user.id;
    const firstName = user.first_name || "Unknown";
    const lastName = user.last_name || "";
    const username = user.username
      ? `@${user.username}`
      : "No username";

    // Notify admin
    const adminMessage =
      `🆕 New User\n\n` +
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

    // Welcome the user
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: `👋 Hello ${firstName}! Welcome to the bot.`
        })
      }
    );

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}

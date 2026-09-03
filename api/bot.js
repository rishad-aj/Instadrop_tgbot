
/**
 * InstaDrop Bot — Instagram Media Downloader (v1)
 *
 * Dependencies:
 *   npm install node-telegram-bot-api express instagram-url-direct
 *
 * Setup:
 *   1. Paste your Telegram bot token in BOT_TOKEN below
 *   2. Deploy to Vercel
 *   3. Set webhook manually (replace <TOKEN>):
 *      https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://instadrop-tgbot.vercel.app/webhook
 */

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const getDirectUrl = require('instagram-url-direct');

// ===== CONFIG — paste your bot token here =====
const BOT_TOKEN = '8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s';
const PORT = process.env.PORT || 3000;

// ===== SERVER =====
const app = express();
app.use(express.json());

const bot = new TelegramBot(BOT_TOKEN);

// Webhook endpoint — Telegram sends updates here
app.post('/webhook', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', bot: 'InstaDrop Bot' });
});

// ===== /start COMMAND =====
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Hey! I'm InstaDrop Bot.\n\n" +
      "Send me an Instagram post or reel link and I'll grab the media for you.\n\n" +
      "Just paste the URL — that's it! 📸"
  );
});

// ===== /help COMMAND =====
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "📋 How to use:\n\n" +
      "1. Copy an Instagram post or reel link\n" +
      "2. Paste it here\n" +
      "3. I'll send you the media!\n\n" +
      "That's all there is to it. 🎉"
  );
});

// ===== HANDLE INCOMING MESSAGES =====
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Skip commands (already handled above)
  if (text && text.startsWith('/')) return;

  // Check if it looks like an Instagram link
  if (text && text.includes('instagram.com')) {
    // Send a "processing" message
    const processing = await bot.sendMessage(chatId, '⏳ Fetching media...');

    try {
      const result = await getDirectUrl(text);
      const mediaList = result.media_results || result.media || [];

      if (mediaList.length === 0) {
        await bot.editMessageText(
          "❌ Couldn't find any media in that link. Make sure it's a public post or reel.",
          { chat_id: chatId, message_id: processing.message_id }
        );
        return;
      }

      // Delete the "processing" message
      await bot.deleteMessage(chatId, processing.message_id).catch(() => {});

      // Send each media item (handles carousels too)
      for (let i = 0; i < mediaList.length; i++) {
        const item = mediaList[i];
        const isVideo = item.type === 'video' || item.type === 'Video';
        const url = item.download_url || item.url;

        if (isVideo) {
          await bot.sendVideo(chatId, url, {
            caption: i === mediaList.length - 1 ? '🎬 Here you go!' : undefined,
          });
        } else {
          await bot.sendPhoto(chatId, url, {
            caption: i === mediaList.length - 1 ? '📸 Here you go!' : undefined,
          });
        }
      }
    } catch (err) {
      console.error('Download error:', err.message);
      await bot.editMessageText(
        '❌ Something went wrong. The link might be private, expired, or Instagram is being stubborn. Try again later.',
        { chat_id: chatId, message_id: processing.message_id }
      );
    }
  } else {
    bot.sendMessage(
      chatId,
      "🤔 That doesn't look like an Instagram link. Send me an Instagram post or reel URL!"
    );
  }
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`InstaDrop Bot running on port ${PORT}`);

  // Auto-set webhook when deployed on Vercel
  if (process.env.VERCEL_URL) {
    const webhookUrl = `${process.env.VERCEL_URL}/webhook`;
    bot
      .setWebHook(webhookUrl)
      .then(() => console.log(`Webhook set: ${webhookUrl}`))
      .catch((err) => console.error('Webhook setup failed:', err.message));
  }
});

module.exports = app;

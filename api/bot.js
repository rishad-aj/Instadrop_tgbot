// bot.js — InstaDrop Telegram Bot for Vercel
// Uses Telegraf webhook adapter
// Environment variables required: BOT_TOKEN

const { Telegraf } = require('telegraf');

// ---------- Configuration ----------
const BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s"; // Replace with your real token from @BotFather
const API_URL = 'https://instadrop.rishu-rishad2019.workers.dev/?url=';

const bot = new Telegraf(BOT_TOKEN);

// ---------- Helpers ----------
function extractInstagramUrls(text) {
  const regex = /(https?:\/\/)?(www\.)?instagram\.com\/[^\s]+/gi;
  return text.match(regex) || [];
}

// Send a single media object (post/reel/profile picture)
async function sendSingleMedia(ctx, data, captionPrefix = '') {
  const images = data.image || [];
  const videos = data.video || []; // may be array of strings or objects {video, cover}
  const captionText = data.caption || '';
  const username = data.username || '';

  // Build final caption
  let fullCaption = captionPrefix ? `${captionPrefix}\n` : '';
  if (captionText) fullCaption += `${captionText}\n`;
  if (username) fullCaption += `@${username}`;
  if (data.taken_at) {
    const date = new Date(data.taken_at).toLocaleString();
    fullCaption += `\n📅 ${date}`;
  }
  // Engagement stats
  const stats = [];
  if (data.like_count) stats.push(`❤️ ${data.like_count}`);
  if (data.comment_count) stats.push(`💬 ${data.comment_count}`);
  if (data.view_count) stats.push(`👁️ ${data.view_count}`);
  if (stats.length) fullCaption += `\n${stats.join(' · ')}`;
  // Trim to Telegram limit
  if (fullCaption.length > 1000) fullCaption = fullCaption.slice(0, 997) + '...';

  // Collect all media (photos & videos) for album
  const mediaItems = [];

  for (const img of images) {
    mediaItems.push({ type: 'photo', media: img });
  }

  for (const v of videos) {
    let videoUrl = typeof v === 'string' ? v : v?.video;
    if (!videoUrl) continue;
    mediaItems.push({ type: 'video', media: videoUrl });
  }

  // Send as album (max 10 per group)
  if (mediaItems.length > 1) {
    const chunkSize = 10;
    for (let i = 0; i < mediaItems.length; i += chunkSize) {
      const chunk = mediaItems.slice(i, i + chunkSize);
      const inputMedia = chunk.map(item => ({
        type: item.type,
        media: item.media,
      }));
      try {
        await ctx.sendMediaGroup(inputMedia, {
          caption: i === 0 ? fullCaption : '',
        });
      } catch {
        // Fallback: send individually
        for (const item of chunk) {
          if (item.type === 'photo') await ctx.sendPhoto(item.media);
          else await ctx.sendVideo(item.media);
        }
        if (i === 0 && fullCaption) await ctx.reply(fullCaption);
      }
    }
    return;
  }

  // Single media
  if (mediaItems.length === 1) {
    const item = mediaItems[0];
    if (item.type === 'photo') {
      await ctx.sendPhoto(item.media, { caption: fullCaption });
    } else {
      await ctx.sendVideo(item.media, { caption: fullCaption });
    }
    return;
  }

  // No media – send caption only
  if (fullCaption) await ctx.reply(fullCaption);
  else await ctx.reply('No media found in this content.');
}

// Main dispatcher for API response
async function sendMedia(ctx, data) {
  // Collection (stories / highlights)
  if (data.items && Array.isArray(data.items)) {
    for (const item of data.items) {
      await sendSingleMedia(ctx, item, `📌 ${data.username || 'User'}`);
    }
    return;
  }
  // Single media
  await sendSingleMedia(ctx, data);
}

// ---------- Bot Commands ----------
bot.start(async (ctx) => {
  const photo = 'https://instadrop.web.app/og-image.png';
  const caption = `🌟 Welcome to *InstaDrop*!

I can download Instagram content for you:
📸 Posts & Reels
📖 Stories
✨ Highlights
👤 Profile Pictures

Just send me any Instagram link and I'll send the media!

🔗 [Website](https://instadrop.web.app/)
👨‍💻 Created by Muhammed Rishad AJ`;

  await ctx.replyWithPhoto(photo, {
    caption,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌐 Visit Website', url: 'https://instadrop.web.app/' }],
      ],
    },
  });
});

bot.help(async (ctx) => {
  await ctx.reply(
    '📥 *How to use InstaDrop*\n\n' +
    'Send any Instagram URL (post, reel, story, highlight, or profile) and I will download it for you.\n\n' +
    'Examples:\n' +
    '• https://instagram.com/p/ABC123\n' +
    '• https://instagram.com/reel/XYZ789\n' +
    '• https://instagram.com/username/stories/123456\n' +
    '• https://instagram.com/username (profile picture)\n\n' +
    'Powered by [InstaDrop](https://instadrop.web.app/)',
    { parse_mode: 'Markdown' }
  );
});

// ---------- Message Handler ----------
bot.on('text', async (ctx) => {
  const urls = extractInstagramUrls(ctx.message.text);
  if (urls.length === 0) return; // ignore non-Instagram messages

  await ctx.sendChatAction('typing');

  for (const url of urls) {
    try {
      const response = await fetch(`${API_URL}${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error(`API error (${response.status})`);
      }
      const data = await response.json();

      if (data.error) {
        await ctx.reply(`❌ ${data.error}`);
        continue;
      }

      await sendMedia(ctx, data);
    } catch (err) {
      console.error('Error processing URL:', err);
      await ctx.reply(`❌ Failed to process media. Please try again later.\nError: ${err.message}`);
    }
  }
});

// ---------- Vercel Webhook Handler ----------
// If your file is placed at /api/bot.js, the webhook path is '/api/bot'.
// Adjust if you deploy differently.
module.exports = bot.webhookCallback('/api/bot');

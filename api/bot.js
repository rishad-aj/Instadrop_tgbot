
// ---------- Configuration ----------

const BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s"; 
const TELEGRAM_API = `https://api.telegram.org/bot$8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s`;
const INSTA_API = "https://instadrop.rishu-rishad2019.workers.dev/?url=";

// Helper functions for Telegram API
async function sendMessage(chatId, text) {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' })
    });
}

async function sendPhoto(chatId, photoUrl, caption = "") {
    await fetch(`${TELEGRAM_API}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            photo: photoUrl,
            caption: caption,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [[{ text: "🌐 Visit InstaDrop", url: "https://instadrop.web.app/" }]]
            }
        })
    });
}

async function sendMediaGroup(chatId, media) {
    await fetch(`${TELEGRAM_API}/sendMediaGroup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, media: media })
    });
}

// Vercel Serverless Function Handler
export default async function handler(req, res) {
    // Vercel requirement: Always return 200 quickly so Telegram doesn't retry
    if (req.method !== 'POST') {
        return res.status(200).send('InstaDrop Bot is active.');
    }

    const update = req.body;
    if (!update || !update.message || !update.message.text) {
        return res.status(200).send('OK');
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();

    try {
        // Handle /start command
        if (text.startsWith('/start')) {
            const welcomeText = "👋 Welcome to <b>InstaDrop</b>!\n\nSend me any Instagram link (Reels, Posts, Stories, Highlights, or Profile) and I'll fetch the media for you.";
            await sendPhoto(chatId, 'https://instadrop.web.app/og-image.png', welcomeText);
            return res.status(200).send('OK');
        }

        // Handle Instagram URLs
        if (text.includes('instagram.com')) {
            await sendMessage(chatId, "⏳ <i>Fetching media, please wait...</i>");

            const response = await fetch(`${INSTA_API}${encodeURIComponent(text)}`);
            const data = await response.json();

            // Handle API Errors
            if (data.error) {
                await sendMessage(chatId, `❌ <b>Error:</b> ${data.error}`);
                return res.status(200).send('OK');
            }

            // 1. Handle Profile Pictures (DP)
            if (data.type === 'dp') {
                const dpCaption = `👤 <b>${data.full_name || data.username}</b> (@${data.username})\n\n📝 ${data.bio || "No bio"}\n\n👥 Followers: ${data.follower_count} | Following: ${data.following_count}\n\n<i>Downloaded via <a href="https://instadrop.web.app/">InstaDrop</a></i>`;
                const dpUrl = data.profile_pic_url_hd || data.profile_pic_url || data.image[0];
                await sendPhoto(chatId, dpUrl, dpCaption);
                return res.status(200).send('OK');
            }

            // 2. Handle Reels, Posts, Stories, Highlights
            let mediaGroup = [];
            const footerCaption = `\n\n<i>Downloaded via <a href="https://instadrop.web.app/">InstaDrop</a></i>`;
            const captionText = data.caption ? (data.caption.substring(0, 800) + footerCaption) : footerCaption;

            // Extract videos
            if (data.video && data.video.length > 0) {
                data.video.forEach(v => mediaGroup.push({ type: 'video', media: v.video }));
            }

            // Extract images
            if (data.image && data.image.length > 0) {
                data.image.forEach(img => mediaGroup.push({ type: 'photo', media: img }));
            }

            if (mediaGroup.length === 0) {
                 await sendMessage(chatId, "❌ No media found for this link.");
                 return res.status(200).send('OK');
            }

            // Send Single Media Item
            if (mediaGroup.length === 1) {
                const item = mediaGroup[0];
                const endpoint = item.type === 'video' ? 'sendVideo' : 'sendPhoto';
                await fetch(`${TELEGRAM_API}/${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        [item.type]: item.media,
                        caption: captionText,
                        parse_mode: 'HTML'
                    })
                });
            } 
            // Send Carousel / Multiple Items
            else {
                // Telegram max chunk size for media groups is 10
                for (let i = 0; i < mediaGroup.length; i += 10) {
                    const chunk = mediaGroup.slice(i, i + 10);
                    chunk[0].caption = captionText; 
                    chunk[0].parse_mode = 'HTML';
                    await sendMediaGroup(chatId, chunk);
                }
            }
        } else {
            // Ignore non-Instagram messages
            await sendMessage(chatId, "⚠️ Please send a valid Instagram URL.");
        }
    } catch (error) {
        console.error("Bot Error:", error);
        await sendMessage(chatId, "❌ An internal error occurred while processing your request.");
    }

    return res.status(200).send('OK');
}

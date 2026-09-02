import { Bot, InputFile, webhookCallback } from "grammy";

const BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s";
const START_IMAGE_URL = "https://user.uploads.dev/file/3de1bfd7fe6b7371018f580661f6bd47.png";

const bot = new Bot(BOT_TOKEN);

// ----------------------------------------------------
// HTTP HELPERS
// ----------------------------------------------------

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36";
const REQUEST_TIMEOUT = 25000;
const MAX_TELEGRAM_FILE = 50 * 1024 * 1024;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeout || REQUEST_TIMEOUT
  );
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getText(url) {
  const res = await fetchWithTimeout(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json,text/html,*/*" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function getJson(url) {
  return JSON.parse(await getText(url));
}

async function postJson(url, body) {
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ----------------------------------------------------
// URL HELPERS
// ----------------------------------------------------

function cleanUrl(url) {
  return String(url || "")
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

const RESERVED_WORDS = new Set([
  "reel", "reels", "p", "tv", "stories", "story", "highlights",
  "s", "explore", "accounts", "about", "directory",
]);

// Returns { kind: "reel"|"post"|"story"|"highlight"|"profile", ... } or null
function parseInput(raw) {
  const s = String(raw || "").trim().replace(/^@/, "");
  if (!s) return null;

  if (/instagram\.com\/stories\/highlights\//i.test(s)) {
    return { kind: "highlight", url: cleanUrl(s) };
  }
  if (/instagram\.com\/(stories|story)\//i.test(s)) {
    return { kind: "story", url: cleanUrl(s) };
  }

  const post = s.match(
    /instagram\.com\/(?:[A-Za-z0-9._]{1,30}\/)?(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i
  );
  if (post) {
    return {
      kind: /^reel/i.test(post[1]) ? "reel" : "post",
      code: post[2],
    };
  }

  const prof = s.match(
    /instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/i
  );
  if (prof && !RESERVED_WORDS.has(prof[1].toLowerCase())) {
    return { kind: "profile", username: prof[1] };
  }

  if (/^[A-Za-z0-9._]{1,30}$/.test(s) && !RESERVED_WORDS.has(s.toLowerCase())) {
    return { kind: "profile", username: s };
  }

  return null;
}

// ----------------------------------------------------
// RESPONSE PARSERS (match the real API shapes)
// ----------------------------------------------------

// Generic deep scan — handles most JSON APIs (anon-social, ddvideo,
// snapinsta, indown) AND thakur's shapes:
//   post:  { "p": true, "image": ["https://...jpg", ...] }
//   reel:  { "video": [ { "video": "...mp4", "thumbnail": "..." } ] }
function jsonToItems(data) {
  const items = [];
  const seen = new Set();
  const usedThumbs = new Set();

  const push = (raw, thumb, type) => {
    const u = cleanUrl(raw);
    if (!/^https?:\/\//i.test(u)) return;
    // A URL used as a video thumbnail is a preview, not a separate media item.
    if (type === "image" && usedThumbs.has(u)) return;
    if (seen.has(u)) return;
    seen.add(u);
    const finalType =
      type || (/\.(mp4|mov|webm)(\?|&|$)/i.test(u) ? "video" : "image");
    if (finalType === "video" && thumb) usedThumbs.add(cleanUrl(thumb));
    items.push({ url: u, type: finalType, thumb: thumb ? cleanUrl(thumb) : null });
  };

  const scan = (o) => {
    if (!o || typeof o !== "object") return;

    if (Array.isArray(o)) {
      for (const v of o) {
        if (typeof v === "string") {
          if (/^https?:\/\//i.test(v)) push(v, null);
        } else {
          scan(v);
        }
      }
      return;
    }

    if (typeof o.url === "string") push(o.url, o.thumb || o.thumbnail || o.img);
    if (typeof o.video === "string") push(o.video, o.thumbnail || o.thumb, "video");
    if (typeof o.video_url === "string") push(o.video_url, o.thumbnail || o.thumb || o.display_url, "video");
    if (typeof o.videoUrl === "string") push(o.videoUrl, o.thumbnail || o.thumb, "video");
    if (typeof o.download_url === "string") push(o.download_url, o.thumbnail || o.thumb);
    if (typeof o.downloadUrl === "string") push(o.downloadUrl, o.thumbnail || o.thumb);
    if (typeof o.image_url === "string") push(o.image_url, o.image_url, "image");
    if (typeof o.image === "string") push(o.image, o.image, "image");
    if (typeof o.display_url === "string") push(o.display_url, o.display_url, "image");
    if (typeof o.displayUrl === "string") push(o.displayUrl, o.displayUrl, "image");
    if (typeof o.link === "string") push(o.link, o.thumbnail || o.thumb);
    if (typeof o.thumbnail === "string") push(o.thumbnail, o.thumbnail, "image");

    if (Array.isArray(o.image)) for (const v of o.image) scan(v);
    if (Array.isArray(o.video)) for (const v of o.video) scan(v);

    if (o.image_versions2 && Array.isArray(o.image_versions2.candidates)) {
      const best = o.image_versions2.candidates
        .slice()
        .sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (best) push(best.url, best.url, "image");
    }
    if (Array.isArray(o.video_versions)) {
      const best = o.video_versions
        .slice()
        .sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (best) push(best.url, best.url, "video");
    }

    for (const k of ["media", "medias", "items", "data", "result", "results", "stories", "carousel", "edges"]) {
      if (o[k]) scan(o[k]);
    }
    for (const v of Object.values(o)) {
      if (v && typeof v === "object") scan(v);
    }
  };

  scan(data);
  return items;
}

// mn-bots: { success: true, media: [{ type, thumb, url, server2 }] }
function parseMnBots(text) {
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    return [];
  }
  if (!j || j.success !== true || !Array.isArray(j.media)) return [];
  const items = [];
  for (const m of j.media) {
    const url = cleanUrl(m.url || m.server2);
    if (!/^https?:\/\//i.test(url)) continue;
    items.push({
      url,
      type: m.type === "video" || /\.mp4(\?|&|$)/i.test(url) ? "video" : "image",
      thumb: m.thumb ? cleanUrl(m.thumb) : null,
    });
  }
  return items;
}

// downloadgram returns a JS snippet that injects HTML:
//   loader['style']['display']='none',document['getElementById']('div_download')
//   ['innerHTML']='<div class="download-items">...<a href="...token...">...'
// We run it with a fake document (like the site does), then regex the HTML.
function parseDownloadgram(text) {
  let html = null;
  try {
    const loader = { style: {} };
    const fakeDoc = {
      getElementById(id) {
        if (id === "div_download") return { set innerHTML(v) { html = v; } };
        return { remove() {} };
      },
    };
    new Function("loader", "document", "showAd", text)(loader, fakeDoc, () => {});
  } catch (e) {
    return [];
  }
  if (!html) return [];

  const items = [];
  const blocks = html.split('class="download-items"').slice(1);
  for (const block of blocks) {
    const linkMatch = block.match(/<a[^>]*href="([^"]+)"/);
    if (!linkMatch) continue;
    const imgMatch = block.match(/<img[^>]*src="([^"]+)"/);
    items.push({
      url: decodeEntities(linkMatch[1]),
      type: /icon-ivideo/.test(block) ? "video" : "image",
      thumb: imgMatch ? decodeEntities(imgMatch[1]) : null,
    });
  }
  return items;
}

// ----------------------------------------------------
// MEDIA RESOLUTION (each type has its own API list)
// ----------------------------------------------------

function mediaCandidates(url, kind) {
  const isPost = kind === "post" || kind === "reel";
  const list = [
    {
      name: "thakur-infopd",
      fetch: () =>
        getText("https://insta.thakur-infopd.workers.dev/?url=" + encodeURIComponent(url)),
      parse: jsonToItems,
    },
    {
      name: "mn-bots",
      fetch: () =>
        getText("https://instagram-downloader.mn-bots.workers.dev/?url=" + encodeURIComponent(url)),
      parse: parseMnBots,
    },
    {
      name: "anon-social",
      fetch: () =>
        getText("https://anon-social-info.vercel.app/igdl?key=igdl305&url=" + encodeURIComponent(url)),
      parse: jsonToItems,
    },
  ];

  if (isPost) {
    list.push({
      name: "downloadgram",
      fetch: async () => {
        const res = await fetchWithTimeout("https://api.downloadgram.org/media", {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
          body: JSON.stringify({ url }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
      },
      parse: parseDownloadgram,
    });
  }

  list.push(
    {
      name: "ddvideo",
      fetch: () =>
        getText("https://api.dd.video/api/instagram?url=" + encodeURIComponent(url)),
      parse: jsonToItems,
    },
    {
      name: "snapinsta",
      fetch: () =>
        getText("https://snapinsta.app/api/instagram?url=" + encodeURIComponent(url)),
      parse: jsonToItems,
    },
    {
      name: "indown",
      fetch: () =>
        getText("https://indown.io/api/info?url=" + encodeURIComponent(url)),
      parse: jsonToItems,
    }
  );

  return list;
}

// Try each API in order until one returns media.
async function firstWorking(candidates) {
  for (const c of candidates) {
    try {
      const text = await c.fetch();
      const items = c.parse(text);
      if (items && items.length) {
        const seen = new Set();
        return items.filter((i) => {
          if (seen.has(i.url)) return false;
          seen.add(i.url);
          return true;
        });
      }
    } catch (e) {
      // try the next candidate
    }
  }
  return [];
}

async function resolveMedia(url, kind) {
  const items = await firstWorking(mediaCandidates(url, kind));
  if (!items.length) {
    throw new Error(
      "Could not resolve this Instagram link — the free services are busy right now. Try again in a moment."
    );
  }
  return items;
}

// ----------------------------------------------------
// PROFILE PICTURE (DP)
// ----------------------------------------------------

async function resolveProfilePic(username) {
  // 1) greatonlinetools (POST) — most reliable
  try {
    const data = await postJson("https://greatonlinetools.com/endpoints-tools/endpoint.php", {
      username,
    });
    if (data && data.status) {
      const pic = data.downloadUrl || data.profilePictureUrl;
      if (pic) return cleanUrl(pic);
    }
  } catch (e) {}

  // 2) insta-profile-info worker (GET) — fallback
  try {
    const data = await getJson(
      "https://bj-insta-profile-info.mmabbas011687.workers.dev/info?username=" +
        encodeURIComponent(username)
    );
    if (data && data.pic) return cleanUrl(data.pic);
  } catch (e) {}

  throw new Error(
    "Couldn't find a profile picture for @" + username + "."
  );
}

// ----------------------------------------------------
// DOWNLOAD MEDIA
// ----------------------------------------------------

async function downloadMedia(url) {
  const res = await fetchWithTimeout(url, {
    headers: { "User-Agent": USER_AGENT },
    timeout: 30000,
  });
  if (!res.ok) throw new Error(`Media HTTP ${res.status}`);

  const contentLength = Number(res.headers.get("content-length") || 0);
  if (contentLength > MAX_TELEGRAM_FILE) {
    throw new Error("File is larger than Telegram's 50 MB limit.");
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_TELEGRAM_FILE) {
    throw new Error("File is larger than Telegram's 50 MB limit.");
  }

  return { buffer, contentType: res.headers.get("content-type") || "" };
}

// ----------------------------------------------------
// /start
// ----------------------------------------------------

bot.command("start", async (ctx) => {
  const caption =
    "👋 <b>Welcome to Instadrop!</b>\n\n" +
    "I download Instagram media for you — just send me a link.\n\n" +
    "📥 <b>What I support:</b>\n" +
    "🎬 Reels & Posts\n" +
    "🖼️ Carousels (multi-image posts)\n" +
    "📖 Stories & Highlights\n" +
    "👤 Profile pictures\n\n" +
    "<b>Examples:</b>\n" +
    "https://www.instagram.com/reel/XXXXXXXX/\n" +
    "https://www.instagram.com/p/XXXXXXXX/\n" +
    "@username\n\n" +
    "Just paste a link and I'll handle the rest! 🚀";

  try {
    const img = await downloadMedia(START_IMAGE_URL);
    await ctx.replyWithPhoto(new InputFile(img.buffer, "instadrop_welcome.jpg"), {
      caption,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "❓ How to use", callback_data: "howto" }],
        ],
      },
    });
  } catch (e) {
    await ctx.reply(caption, { parse_mode: "HTML" });
  }
});

bot.callbackQuery("howto", async (ctx) => {
  await ctx.answerCallbackQuery({
    text: "Send an Instagram link (reel, post, story, highlight) or a @username for a profile pic.",
    show_alert: true,
  });
});

// ----------------------------------------------------
// /help
// ----------------------------------------------------

bot.command("help", async (ctx) => {
  await ctx.reply(
    "📥 <b>Instadrop Bot</b>\n\n" +
      "Send me an Instagram link and I'll download it for you.\n\n" +
      "🎬 <b>Reels / Posts:</b>\n" +
      "https://www.instagram.com/reel/...\n" +
      "https://www.instagram.com/p/...\n\n" +
      "📖 <b>Stories / Highlights:</b>\n" +
      "https://www.instagram.com/stories/...\n" +
      "https://www.instagram.com/stories/highlights/...\n\n" +
      "👤 <b>Profile picture:</b>\n" +
      "https://www.instagram.com/username/\n" +
      "or just send @username",
    { parse_mode: "HTML" }
  );
});

// ----------------------------------------------------
// HANDLE MESSAGE
// ----------------------------------------------------

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();

  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  const parsed = parseInput(urlMatch ? urlMatch[0] : text);

  if (!parsed) {
    await ctx.reply(
      "❌ Send a valid Instagram link (reel, post, story, highlight) or a username.\n\n" +
        "Example: https://www.instagram.com/reel/XXXXXXXX/"
    );
    return;
  }

  if (parsed.kind === "profile") {
    await handleProfile(ctx, parsed.username);
    return;
  }

  const status = await ctx.reply("⏳ Finding media...");

  try {
    const url =
      parsed.kind === "post" || parsed.kind === "reel"
        ? "https://www.instagram.com/reel/" + parsed.code + "/"
        : parsed.url;

    const media = await resolveMedia(url, parsed.kind);

    await ctx.api.editMessageText(
      ctx.chat.id,
      status.message_id,
      `✅ Found ${media.length} media file${media.length === 1 ? "" : "s"}.\n\n📤 Sending...`
    );

    let sent = 0;

    for (let i = 0; i < media.length; i++) {
      const item = media[i];
      try {
        const downloaded = await downloadMedia(item.url);
        const extension = item.type === "video" ? "mp4" : "jpg";
        const file = new InputFile(
          downloaded.buffer,
          `instadrop_${parsed.code || "story"}_${i + 1}.${extension}`
        );

        if (item.type === "video") {
          await ctx.replyWithVideo(file, {
            caption: i === 0 ? "📥 Instadrop" : undefined,
            supports_streaming: true,
          });
        } else {
          await ctx.replyWithPhoto(file, {
            caption: i === 0 ? "📥 Instadrop" : undefined,
          });
        }

        sent++;
      } catch (error) {
        console.log("Media send failed:", error.message);
      }
    }

    if (sent === 0) {
      throw new Error("The media could not be uploaded to Telegram.");
    }

    await ctx.api.editMessageText(
      ctx.chat.id,
      status.message_id,
      `✅ Done!\n\nSent ${sent} file${sent === 1 ? "" : "s"}.`
    );
  } catch (error) {
    console.error(error);
    await ctx.api
      .editMessageText(ctx.chat.id, status.message_id, `❌ ${error.message || "Download failed."}`)
      .catch(() => {});
  }
});

async function handleProfile(ctx, username) {
  const status = await ctx.reply(`⏳ Looking up @${username}'s profile picture...`);

  try {
    const avatarUrl = await resolveProfilePic(username);

    try {
      const downloaded = await downloadMedia(avatarUrl);
      await ctx.api.editMessageText(
        ctx.chat.id,
        status.message_id,
        `✅ Found @${username}'s profile picture.\n\n📤 Sending...`
      );
      await ctx.replyWithPhoto(new InputFile(downloaded.buffer, `${username}_profile_pic.jpg`), {
        caption: `👤 @${username}`,
      });
      await ctx.api.editMessageText(
        ctx.chat.id,
        status.message_id,
        `✅ Sent @${username}'s profile picture.`
      );
    } catch {
      // fallback: let Telegram fetch the URL directly
      await ctx.api.editMessageText(
        ctx.chat.id,
        status.message_id,
        `✅ Sending @${username}'s profile picture...`
      );
      await ctx.replyWithPhoto(avatarUrl, { caption: `👤 @${username}` });
      await ctx.api.editMessageText(
        ctx.chat.id,
        status.message_id,
        `✅ Sent @${username}'s profile picture.`
      );
    }
  } catch (error) {
    console.error(error);
    await ctx.api
      .editMessageText(ctx.chat.id, status.message_id, `❌ ${error.message || "Could not find the profile."}`)
      .catch(() => {});
  }
}

// ----------------------------------------------------
// VERCEL WEBHOOK
// ----------------------------------------------------

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "Instadrop Telegram Bot",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    await webhookCallback(bot, "http")(req, res);
  } catch (error) {
    console.error("Telegram webhook error:", error);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false });
    }
  }
}

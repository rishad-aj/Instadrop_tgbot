import { Bot, InputFile, webhookCallback } from "grammy";
import { createHash } from "node:crypto";

const BOT_TOKEN = "8946163976:AAEwnQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s";
const START_IMAGE_URL = "https://instadrop.web.app/og-image.png";

const bot = new Bot(BOT_TOKEN);

// Vercel: allow enough time for the resolver/download work.
export const maxDuration = 60;

// ----------------------------------------------------
// GLOBAL STATE
// ----------------------------------------------------

// Telegram can resend the same update if the webhook takes too long.
// Keep a small in-memory cache to prevent duplicate processing.
const processedUpdates = new Map();
const processingChats = new Set();

const UPDATE_CACHE_TIME = 5 * 60 * 1000;

// Cleanup old update IDs occasionally.
function rememberUpdate(updateId) {
  const now = Date.now();

  for (const [id, time] of processedUpdates) {
    if (now - time > UPDATE_CACHE_TIME) {
      processedUpdates.delete(id);
    }
  }

  if (processedUpdates.has(updateId)) {
    return false;
  }

  processedUpdates.set(updateId, now);
  return true;
}

// ----------------------------------------------------
// HTTP HELPERS
// ----------------------------------------------------

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36";

const REQUEST_TIMEOUT = 12000;
const MAX_TELEGRAM_FILE = 50 * 1024 * 1024;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    options.timeout || REQUEST_TIMEOUT
  );

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function getText(url, options = {}) {
  const res = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json,text/html,*/*",
      ...(options.headers || {}),
    },
    timeout: options.timeout || REQUEST_TIMEOUT,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return await res.text();
}

async function getJson(url, options = {}) {
  const text = await getText(url, options);

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON response");
  }
}

async function postJson(url, body) {
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

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
  "reel",
  "reels",
  "p",
  "tv",
  "stories",
  "story",
  "highlights",
  "s",
  "explore",
  "accounts",
  "about",
  "directory",
]);

// ----------------------------------------------------
// INPUT PARSER
// ----------------------------------------------------

function parseInput(raw) {
  const s = String(raw || "").trim().replace(/^@/, "");

  if (!s) return null;

  // Highlight
  if (/instagram\.com\/stories\/highlights\//i.test(s)) {
    return {
      kind: "highlight",
      url: cleanUrl(s),
    };
  }

  // Story
  if (/instagram\.com\/(stories|story)\//i.test(s)) {
    return {
      kind: "story",
      url: cleanUrl(s),
    };
  }

  // Reel / Post / TV
  const post = s.match(
    /instagram\.com\/(?:[A-Za-z0-9._]{1,30}\/)?(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i
  );

  if (post) {
    const type = post[1].toLowerCase();

    return {
      kind:
        type === "reel" || type === "reels"
          ? "reel"
          : "post",

      code: post[2],

      // IMPORTANT:
      // Keep the original media type.
      // A /p/ URL must NOT become /reel/.
      url:
        type === "reel" || type === "reels"
          ? `https://www.instagram.com/reel/${post[2]}/`
          : `https://www.instagram.com/p/${post[2]}/`,
    };
  }

  // Profile URL
  const prof = s.match(
    /instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/i
  );

  if (
    prof &&
    !RESERVED_WORDS.has(prof[1].toLowerCase())
  ) {
    return {
      kind: "profile",
      username: prof[1],
    };
  }

  // @username / username
  if (
    /^[A-Za-z0-9._]{1,30}$/.test(s) &&
    !RESERVED_WORDS.has(s.toLowerCase())
  ) {
    return {
      kind: "profile",
      username: s,
    };
  }

  return null;
}

// ----------------------------------------------------
// MEDIA PARSER
// ----------------------------------------------------

function jsonToItems(data) {
  const items = [];
  const seen = new Set();
  const usedThumbs = new Set();

  const push = (raw, thumb, type) => {
    const u = cleanUrl(raw);

    if (!/^https?:\/\//i.test(u)) return;

    if (
      type === "image" &&
      usedThumbs.has(u)
    ) {
      return;
    }

    if (seen.has(u)) return;

    seen.add(u);

    const finalType =
      type ||
      (/\.(mp4|mov|webm)(\?|&|$)/i.test(u)
        ? "video"
        : "image");

    if (finalType === "video" && thumb) {
      usedThumbs.add(cleanUrl(thumb));
    }

    items.push({
      url: u,
      type: finalType,
      thumb: thumb ? cleanUrl(thumb) : null,
    });
  };

  const scan = (o) => {
    if (!o || typeof o !== "object") return;

    if (Array.isArray(o)) {
      for (const v of o) {
        if (typeof v === "string") {
          if (/^https?:\/\//i.test(v)) {
            push(v, null);
          }
        } else {
          scan(v);
        }
      }

      return;
    }

    if (typeof o.url === "string") {
      push(
        o.url,
        o.thumb || o.thumbnail || o.img
      );
    }

    if (typeof o.video === "string") {
      push(
        o.video,
        o.thumbnail || o.thumb,
        "video"
      );
    }

    if (typeof o.video_url === "string") {
      push(
        o.video_url,
        o.thumbnail ||
          o.thumb ||
          o.display_url,
        "video"
      );
    }

    if (typeof o.videoUrl === "string") {
      push(
        o.videoUrl,
        o.thumbnail || o.thumb,
        "video"
      );
    }

    if (typeof o.download_url === "string") {
      push(
        o.download_url,
        o.thumbnail || o.thumb
      );
    }

    if (typeof o.downloadUrl === "string") {
      push(
        o.downloadUrl,
        o.thumbnail || o.thumb
      );
    }

    if (typeof o.image_url === "string") {
      push(
        o.image_url,
        o.image_url,
        "image"
      );
    }

    if (typeof o.image === "string") {
      push(
        o.image,
        o.image,
        "image"
      );
    }

    if (typeof o.display_url === "string") {
      push(
        o.display_url,
        o.display_url,
        "image"
      );
    }

    if (typeof o.displayUrl === "string") {
      push(
        o.displayUrl,
        o.displayUrl,
        "image"
      );
    }

    if (typeof o.link === "string") {
      push(
        o.link,
        o.thumbnail || o.thumb
      );
    }

    if (typeof o.thumbnail === "string") {
      push(
        o.thumbnail,
        o.thumbnail,
        "image"
      );
    }

    if (
      o.image_versions2 &&
      Array.isArray(o.image_versions2.candidates)
    ) {
      const best = o.image_versions2.candidates
        .slice()
        .sort(
          (a, b) =>
            (b.width || 0) * (b.height || 0) -
            (a.width || 0) * (a.height || 0)
        )[0];

      if (best) {
        push(
          best.url,
          best.url,
          "image"
        );
      }
    }

    if (Array.isArray(o.video_versions)) {
      const best = o.video_versions
        .slice()
        .sort(
          (a, b) =>
            (b.width || 0) * (b.height || 0) -
            (a.width || 0) * (a.height || 0)
        )[0];

      if (best) {
        push(
          best.url,
          best.url,
          "video"
        );
      }
    }

    for (const k of [
      "media",
      "medias",
      "items",
      "data",
      "result",
      "results",
      "stories",
      "carousel",
      "edges",
    ]) {
      if (o[k]) scan(o[k]);
    }

    for (const v of Object.values(o)) {
      if (
        v &&
        typeof v === "object"
      ) {
        scan(v);
      }
    }
  };

  scan(data);

  return items;
}

// ----------------------------------------------------
// MN-BOTS PARSER
// ----------------------------------------------------

function parseMnBots(text) {
  let j;

  try {
    j = JSON.parse(text);
  } catch {
    return [];
  }

  if (
    !j ||
    j.success !== true ||
    !Array.isArray(j.media)
  ) {
    return [];
  }

  const items = [];

  for (const m of j.media) {
    const url = cleanUrl(
      m.url || m.server2
    );

    if (!/^https?:\/\//i.test(url)) {
      continue;
    }

    items.push({
      url,
      type:
        m.type === "video" ||
        /\.mp4(\?|&|$)/i.test(url)
          ? "video"
          : "image",
      thumb: m.thumb
        ? cleanUrl(m.thumb)
        : null,
    });
  }

  return items;
}

// ----------------------------------------------------
// DOWNLOADGRAM PARSER
// ----------------------------------------------------

function parseDownloadgram(text) {
  let html = null;

  try {
    const loader = {
      style: {},
    };

    const fakeDoc = {
      getElementById(id) {
        if (id === "div_download") {
          return {
            set innerHTML(v) {
              html = v;
            },
          };
        }

        return {
          remove() {},
        };
      },
    };

    new Function(
      "loader",
      "document",
      "showAd",
      text
    )(
      loader,
      fakeDoc,
      () => {}
    );
  } catch {
    return [];
  }

  if (!html) return [];

  const items = [];

  const blocks = html
    .split('class="download-items"')
    .slice(1);

  for (const block of blocks) {
    const linkMatch =
      block.match(
        /<a[^>]*href="([^"]+)"/
      );

    if (!linkMatch) continue;

    const imgMatch =
      block.match(
        /<img[^>]*src="([^"]+)"/
      );

    items.push({
      url: decodeEntities(
        linkMatch[1]
      ),
      type: /icon-ivideo/.test(block)
        ? "video"
        : "image",
      thumb: imgMatch
        ? decodeEntities(imgMatch[1])
        : null,
    });
  }

  return items;
}

// ----------------------------------------------------
// MEDIA API LIST
// ----------------------------------------------------

function mediaCandidates(url, kind) {
  const isPost =
    kind === "post" ||
    kind === "reel";

  const list = [
    {
      name: "thakur-infopd",

      fetch: () =>
        getText(
          "https://insta.thakur-infopd.workers.dev/?url=" +
            encodeURIComponent(url)
        ),

      parse: jsonToItems,
    },

    {
      name: "mn-bots",

      fetch: () =>
        getText(
          "https://instagram-downloader.mn-bots.workers.dev/?url=" +
            encodeURIComponent(url)
        ),

      parse: parseMnBots,
    },

    {
      name: "anon-social",

      fetch: () =>
        getText(
          "https://anon-social-info.vercel.app/igdl?key=igdl305&url=" +
            encodeURIComponent(url)
        ),

      parse: jsonToItems,
    },
  ];

  // Downloadgram is only used for posts/reels.
  if (isPost) {
    list.push({
      name: "downloadgram",

      fetch: async () => {
        const res =
          await fetchWithTimeout(
            "https://api.downloadgram.org/media",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
                "User-Agent":
                  USER_AGENT,
              },

              body: JSON.stringify({
                url,
              }),

              timeout: 12000,
            }
          );

        if (!res.ok) {
          throw new Error(
            `HTTP ${res.status}`
          );
        }

        return await res.text();
      },

      parse: parseDownloadgram,
    });
  }

  list.push(
    {
      name: "ddvideo",

      fetch: () =>
        getText(
          "https://api.dd.video/api/instagram?url=" +
            encodeURIComponent(url)
        ),

      parse: jsonToItems,
    },

    {
      name: "snapinsta",

      fetch: () =>
        getText(
          "https://snapinsta.app/api/instagram?url=" +
            encodeURIComponent(url)
        ),

      parse: jsonToItems,
    },

    {
      name: "indown",

      fetch: () =>
        getText(
          "https://indown.io/api/info?url=" +
            encodeURIComponent(url)
        ),

      parse: jsonToItems,
    }
  );

  return list;
}

// ----------------------------------------------------
// MEDIA RESOLVER
// ----------------------------------------------------

async function firstWorking(candidates) {
  for (const candidate of candidates) {
    try {
      console.log(
        `[resolver] Trying ${candidate.name}`
      );

      const text =
        await candidate.fetch();

      const items =
        candidate.parse(text);

      if (
        items &&
        items.length
      ) {
        const seen = new Set();

        const unique =
          items.filter((item) => {
            if (seen.has(item.url)) {
              return false;
            }

            seen.add(item.url);
            return true;
          });

        console.log(
          `[resolver] ${candidate.name} returned ${unique.length} item(s)`
        );

        if (unique.length) {
          return unique;
        }
      }

      console.log(
        `[resolver] ${candidate.name} returned no media`
      );
    } catch (error) {
      console.log(
        `[resolver] ${candidate.name} failed:`,
        error?.message || error
      );
    }
  }

  return [];
}

async function resolveMedia(url, kind) {
  const items =
    await firstWorking(
      mediaCandidates(
        url,
        kind
      )
    );

  if (!items.length) {
    throw new Error(
      "I couldn't find downloadable media from this Instagram link right now."
    );
  }

  return items;
}

// ----------------------------------------------------
// INSTAGRAM PROFILE PICTURE
// ----------------------------------------------------

function deepFindKey(o, key) {
  if (
    !o ||
    typeof o !== "object"
  ) {
    return null;
  }

  if (Array.isArray(o)) {
    for (const v of o) {
      const r =
        deepFindKey(v, key);

      if (r) return r;
    }

    return null;
  }

  for (const [k, v] of Object.entries(o)) {
    if (k === key) {
      return v;
    }

    const r =
      deepFindKey(v, key);

    if (r) return r;
  }

  return null;
}

function jsonScriptBlocks(html) {
  const blocks = [];

  const re =
    /<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g;

  let m;

  while ((m = re.exec(html))) {
    const text = m[1].trim();

    if (!text) continue;

    try {
      blocks.push(
        JSON.parse(text)
      );
    } catch {}
  }

  return blocks;
}

// ----------------------------------------------------
// DIRECT INSTAGRAM PROFILE API
// ----------------------------------------------------

async function getInstagramProfile(username) {
  const url =
    "https://www.instagram.com/api/v1/users/web_profile_info/?username=" +
    encodeURIComponent(username);

  const data =
    await getJson(url, {
      headers: {
        "X-IG-App-ID":
          "936619743392459",

        "Accept":
          "application/json,text/plain,*/*",

        "Referer":
          `https://www.instagram.com/${encodeURIComponent(username)}/`,
      },

      timeout: 10000,
    });

  const user =
    data?.data?.user;

  if (!user) {
    throw new Error(
      "Instagram profile data not found"
    );
  }

  return user;
}

async function scrapeProfilePic(username) {
  const user =
    await getInstagramProfile(
      username
    );

  const possible = [
    user.profile_pic_url_hd,
    user.profile_pic_url,
    user.profile_pic_url_512,
    user.profile_pic_url_256,
  ];

  for (const pic of possible) {
    if (
      typeof pic === "string" &&
      /^https?:\/\//i.test(pic)
    ) {
      return pic;
    }
  }

  return null;
}

// ----------------------------------------------------
// PROFILE PIC RESOLUTION
// ----------------------------------------------------

async function resolveProfilePic(username) {
  const candidates = [];
  const direct = [];

  const push = (
    url,
    isDirect = false
  ) => {
    const c =
      cleanUrl(url);

    if (
      !c ||
      !/^https?:\/\//i.test(c)
    ) {
      return;
    }

    if (
      !candidates.includes(c)
    ) {
      candidates.push(c);
    }

    if (
      isDirect &&
      !direct.includes(c)
    ) {
      direct.push(c);
    }
  };

  // 1. Direct Instagram API.
  try {
    const pic =
      await scrapeProfilePic(
        username
      );

    if (pic) {
      console.log(
        "[DP] Instagram API found profile picture"
      );

      push(pic, true);
    }
  } catch (error) {
    console.log(
      "[DP] Instagram API failed:",
      error?.message || error
    );
  }

  // 2. GreatOnlineTools.
  try {
    const data =
      await postJson(
        "https://greatonlinetools.com/endpoints-tools/endpoint.php",
        { username }
      );

    if (
      data &&
      data.status
    ) {
      push(
        data.downloadUrl ||
          data.profilePictureUrl,
        false
      );
    }
  } catch (error) {
    console.log(
      "[DP] greatonlinetools failed:",
      error?.message || error
    );
  }

  // 3. Existing worker fallback.
  try {
    const data =
      await getJson(
        "https://bj-insta-profile-info.mmabbas011687.workers.dev/info?username=" +
          encodeURIComponent(username)
      );

    if (
      data &&
      data.pic
    ) {
      push(
        data.pic,
        true
      );
    }
  } catch (error) {
    console.log(
      "[DP] profile worker failed:",
      error?.message || error
    );
  }

  // 4. Last HTML fallback.
  if (!candidates.length) {
    try {
      const html =
        await getText(
          "https://www.instagram.com/" +
            encodeURIComponent(username) +
            "/"
        );

      for (
        const block of
        jsonScriptBlocks(html)
      ) {
        const pic =
          deepFindKey(
            block,
            "profile_pic_url_hd"
          ) ||
          deepFindKey(
            block,
            "profile_pic_url"
          );

        if (
          typeof pic === "string"
        ) {
          push(
            pic,
            true
          );
        }
      }
    } catch (error) {
      console.log(
        "[DP] HTML fallback failed:",
        error?.message || error
      );
    }
  }

  if (!candidates.length) {
    throw new Error(
      `Couldn't find a profile picture for @${username}.`
    );
  }

  return {
    candidates,
    direct,
  };
}

// ----------------------------------------------------
// DOWNLOAD MEDIA
// ----------------------------------------------------

async function downloadMedia(url) {
  const res =
    await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent":
            USER_AGENT,
        },

        timeout: 30000,
      }
    );

  if (!res.ok) {
    throw new Error(
      `Media HTTP ${res.status}`
    );
  }

  const contentLength =
    Number(
      res.headers.get(
        "content-length"
      ) || 0
    );

  if (
    contentLength >
    MAX_TELEGRAM_FILE
  ) {
    throw new Error(
      "File is larger than Telegram's 50 MB limit."
    );
  }

  const buffer =
    Buffer.from(
      await res.arrayBuffer()
    );

  if (
    buffer.length >
    MAX_TELEGRAM_FILE
  ) {
    throw new Error(
      "File is larger than Telegram's 50 MB limit."
    );
  }

  return {
    buffer,
    contentType:
      res.headers.get(
        "content-type"
      ) || "",
  };
}

// ----------------------------------------------------
// START
// ----------------------------------------------------

bot.command(
  "start",
  async (ctx) => {
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
      const img =
        await downloadMedia(
          START_IMAGE_URL
        );

      await ctx.replyWithPhoto(
        new InputFile(
          img.buffer,
          "instadrop_welcome.jpg"
        ),
        {
          caption,
          parse_mode: "HTML",

          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "❓ How to use",
                  callback_data:
                    "howto",
                },
              ],
            ],
          },
        }
      );
    } catch {
      await ctx.reply(
        caption,
        {
          parse_mode:
            "HTML",
        }
      );
    }
  }
);

// ----------------------------------------------------
// HOW TO
// ----------------------------------------------------

bot.callbackQuery(
  "howto",
  async (ctx) => {
    await ctx.answerCallbackQuery(
      {
        text:
          "Send an Instagram link (reel, post, story, highlight) or a @username for a profile picture.",
        show_alert: true,
      }
    );
  }
);

// ----------------------------------------------------
// HELP
// ----------------------------------------------------

bot.command(
  "help",
  async (ctx) => {
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
      {
        parse_mode:
          "HTML",
      }
    );
  }
);

// ----------------------------------------------------
// TEXT MESSAGE
// ----------------------------------------------------

bot.on(
  "message:text",
  async (ctx) => {
    const chatId =
      ctx.chat.id;

    // Prevent overlapping work for this chat.
    if (
      processingChats.has(chatId)
    ) {
      await ctx.reply(
        "⏳ I'm already processing your previous request. Please wait for it to finish."
      );

      return;
    }

    processingChats.add(
      chatId
    );

    try {
      const text =
        ctx.message.text.trim();

      const urlMatch =
        text.match(
          /https?:\/\/[^\s]+/i
        );

      const parsed =
        parseInput(
          urlMatch
            ? urlMatch[0]
            : text
        );

      if (!parsed) {
        await ctx.reply(
          "❌ Send a valid Instagram link (reel, post, story, highlight) or a username.\n\n" +
            "Example: https://www.instagram.com/reel/XXXXXXXX/"
        );

        return;
      }

      // Profile picture
      if (
        parsed.kind ===
        "profile"
      ) {
        await handleProfile(
          ctx,
          parsed.username
        );

        return;
      }

      const status =
        await ctx.reply(
          "⏳ Finding media..."
        );

      try {
        // IMPORTANT:
        // Use the actual parsed URL.
        // /p/ stays /p/
        // /reel/ stays /reel/
        const url =
          parsed.url;

        console.log(
          `[MEDIA] ${parsed.kind}: ${url}`
        );

        const media =
          await resolveMedia(
            url,
            parsed.kind
          );

        await ctx.api.editMessageText(
          chatId,
          status.message_id,
          `✅ Found ${media.length} media file${
            media.length === 1
              ? ""
              : "s"
          }.\n\n📤 Sending...`
        );

        let sent = 0;

        const sentHashes =
          new Set();

        const results =
          await Promise.allSettled(
            media.map(
              (item) =>
                downloadMedia(
                  item.url
                )
            )
          );

        for (
          let i = 0;
          i < results.length;
          i++
        ) {
          const item =
            media[i];

          const result =
            results[i];

          if (
            result.status !==
            "fulfilled"
          ) {
            console.log(
              "Media download failed:",
              item.url,
              result.reason
                ?.message ||
                result.reason
            );

            continue;
          }

          const downloaded =
            result.value;

          const hash =
            createHash(
              "sha1"
            )
              .update(
                downloaded.buffer
              )
              .digest("hex");

          if (
            sentHashes.has(
              hash
            )
          ) {
            continue;
          }

          sentHashes.add(
            hash
          );

          try {
            const extension =
              item.type ===
              "video"
                ? "mp4"
                : "jpg";

            const file =
              new InputFile(
                downloaded.buffer,
                `instadrop_${
                  parsed.code ||
                  "story"
                }_${
                  i + 1
                }.${extension}`
              );

            if (
              item.type ===
              "video"
            ) {
              await ctx.replyWithVideo(
                file,
                {
                  caption:
                    sent === 0
                      ? "📥 Instadrop"
                      : undefined,

                  supports_streaming:
                    true,
                }
              );
            } else {
              await ctx.replyWithPhoto(
                file,
                {
                  caption:
                    sent === 0
                      ? "📥 Instadrop"
                      : undefined,
                }
              );
            }

            sent++;
          } catch (error) {
            console.log(
              "Media send failed:",
              error?.message ||
                error
            );
          }
        }

        if (
          sent === 0
        ) {
          throw new Error(
            "The media could not be uploaded to Telegram."
          );
        }

        await ctx.api.editMessageText(
          chatId,
          status.message_id,
          `✅ Done!\n\nSent ${sent} file${
            sent === 1
              ? ""
              : "s"
          }.`
        );
      } catch (error) {
        console.error(
          "[MEDIA ERROR]",
          error
        );

        await ctx.api
          .editMessageText(
            chatId,
            status.message_id,
            `❌ ${
              error?.message ||
              "Download failed."
            }`
          )
          .catch(() => {});
      }
    } finally {
      processingChats.delete(
        chatId
      );
    }
  }
);

// ----------------------------------------------------
// PROFILE HANDLER
// ----------------------------------------------------

async function handleProfile(
  ctx,
  username
) {
  const status =
    await ctx.reply(
      `⏳ Looking up @${username}'s profile picture...`
    );

  try {
    const {
      candidates,
      direct,
    } =
      await resolveProfilePic(
        username
      );

    // First try downloading and re-uploading.
    for (
      const url of candidates
    ) {
      try {
        const downloaded =
          await downloadMedia(
            url
          );

        await ctx.api.editMessageText(
          ctx.chat.id,
          status.message_id,
          `✅ Found @${username}'s profile picture.\n\n📤 Sending...`
        );

        await ctx.replyWithPhoto(
          new InputFile(
            downloaded.buffer,
            `${username}_profile_pic.jpg`
          ),
          {
            caption:
              `👤 @${username}`,
          }
        );

        await ctx.api.editMessageText(
          ctx.chat.id,
          status.message_id,
          `✅ Sent @${username}'s profile picture.`
        );

        return;
      } catch (error) {
        console.log(
          "[DP] Download failed:",
          error?.message ||
            error
        );
      }
    }

    // Direct Telegram fetch fallback.
    const directUrls =
      direct.length
        ? direct
        : candidates;

    for (
      const url of directUrls
    ) {
      try {
        await ctx.api.editMessageText(
          ctx.chat.id,
          status.message_id,
          `📤 Sending @${username}'s profile picture...`
        );

        await ctx.replyWithPhoto(
          url,
          {
            caption:
              `👤 @${username}`,
          }
        );

        await ctx.api.editMessageText(
          ctx.chat.id,
          status.message_id,
          `✅ Sent @${username}'s profile picture.`
        );

        return;
      } catch (error) {
        console.log(
          "[DP] Direct send failed:",
          error?.message ||
            error
        );
      }
    }

    throw new Error(
      `Couldn't download the profile picture for @${username}.`
    );
  } catch (error) {
    console.error(
      "[DP ERROR]",
      error
    );

    await ctx.api
      .editMessageText(
        ctx.chat.id,
        status.message_id,
        `❌ ${
          error?.message ||
          "Could not find the profile."
        }`
      )
      .catch(() => {});
  }
}

// ----------------------------------------------------
// WEBHOOK
// ----------------------------------------------------

const handleUpdate =
  webhookCallback(
    bot,
    "http",
    {
      // Give the handler more time than grammY's
      // default 10-second timeout.
      timeoutMilliseconds: 45000,

      // If something unexpected happens,
      // let Vercel return the error instead
      // of silently pretending the update succeeded.
      onTimeout: "throw",
    }
  );

export default async function handler(
  req,
  res
) {
  if (
    req.method ===
    "GET"
  ) {
    return res
      .status(200)
      .json({
        ok: true,
        service:
          "Instadrop Telegram Bot",
      });
  }

  if (
    req.method !==
    "POST"
  ) {
    return res
      .status(405)
      .json({
        ok: false,
        error:
          "Method not allowed",
      });
  }

  // --------------------------------------------------
  // DEDUPLICATE TELEGRAM UPDATE
  // --------------------------------------------------

  const updateId =
    req.body?.update_id;

  if (
    typeof updateId ===
    "number"
  ) {
    if (
      !rememberUpdate(
        updateId
      )
    ) {
      console.log(
        `[WEBHOOK] Duplicate update ignored: ${updateId}`
      );

      return res
        .status(200)
        .json({
          ok: true,
          duplicate: true,
        });
    }
  }

  try {
    await handleUpdate(
      req,
      res
    );
  } catch (error) {
    console.error(
      "[WEBHOOK ERROR]",
      error
    );

    if (
      !res.headersSent
    ) {
      return res
        .status(500)
        .json({
          ok: false,
        });
    }
  }
}

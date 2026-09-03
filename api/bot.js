const TELEGRAM_BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s";
const ADMIN_CHAT_ID = "7216371031";

const API_URL =
  "https://instadrop.rishu-rishad2019.workers.dev/?url=";

const WELCOME_IMAGE =
  "https://instadrop.web.app/og-image.png";

const WEBSITE_URL =
  "https://instadrop.web.app/";

// --------------------------------------------------
// TEMPORARY STORAGE
//
// Stores API response data for callback buttons.
//
// IMPORTANT:
// This is in-memory storage.
// For permanent/reliable production storage,
// use KV / Redis / database.
// --------------------------------------------------

const notifiedUsers = new Set();
const mediaStorage = new Map();


// --------------------------------------------------
// TELEGRAM API HELPER
// --------------------------------------------------

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

  return await response.json();
}


// --------------------------------------------------
// CHECK INSTAGRAM URL
// --------------------------------------------------

function isInstagramUrl(text) {
  if (!text) return false;

  try {
    const url = new URL(text.trim());

    return (
      url.hostname === "instagram.com" ||
      url.hostname === "www.instagram.com" ||
      url.hostname === "m.instagram.com"
    );
  } catch {
    return false;
  }
}


// --------------------------------------------------
// CREATE STORAGE ID
// --------------------------------------------------

function createStorageId() {
  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .substring(2, 10)
  );
}


// --------------------------------------------------
// STORE API DATA
// --------------------------------------------------

function storeMediaData(data) {
  const id = createStorageId();

  mediaStorage.set(id, {
    ...data,
    createdAt: Date.now()
  });

  // Remove old entries after 30 minutes
  const expiry =
    Date.now() - 30 * 60 * 1000;

  for (const [key, value] of mediaStorage.entries()) {
    if (value.createdAt < expiry) {
      mediaStorage.delete(key);
    }
  }

  return id;
}


// --------------------------------------------------
// GET URL FROM OBJECT
// --------------------------------------------------

function getUrlFromObject(data, keys = []) {
  if (!data || typeof data !== "object") {
    return null;
  }

  for (const key of keys) {
    if (
      typeof data[key] === "string" &&
      /^https?:\/\//i.test(data[key])
    ) {
      return data[key];
    }
  }

  return null;
}


// --------------------------------------------------
// GET MEDIA TYPE
// --------------------------------------------------

function getMediaType(url) {
  if (!url || typeof url !== "string") {
    return "photo";
  }

  const lower = url.toLowerCase();

  if (
    lower.includes(".mp4") ||
    lower.includes(".mov") ||
    lower.includes(".webm") ||
    lower.includes("video")
  ) {
    return "video";
  }

  return "photo";
}


// --------------------------------------------------
// GENERIC MEDIA EXTRACTION
//
// Used for normal posts / carousels.
//
// IMPORTANT:
// We DO NOT use this for Reels.
//
// This prevents the Reel cover from being extracted.
// --------------------------------------------------

function extractMedia(data, results = []) {
  if (!data) return results;

  // ------------------------------------------------
  // String
  // ------------------------------------------------

  if (typeof data === "string") {
    if (/^https?:\/\//i.test(data)) {
      const lower = data.toLowerCase();

      if (
        lower.includes(".mp4") ||
        lower.includes(".mov") ||
        lower.includes(".webm") ||
        lower.includes(".jpg") ||
        lower.includes(".jpeg") ||
        lower.includes(".png") ||
        lower.includes(".webp") ||
        lower.includes("video") ||
        lower.includes("image")
      ) {
        results.push(data);
      }
    }

    return results;
  }


  // ------------------------------------------------
  // Array
  // ------------------------------------------------

  if (Array.isArray(data)) {
    for (const item of data) {
      extractMedia(item, results);
    }

    return results;
  }


  // ------------------------------------------------
  // Object
  // ------------------------------------------------

  if (typeof data === "object") {
    const preferredKeys = [
      "url",
      "download_url",
      "downloadUrl",
      "media_url",
      "mediaUrl",
      "video_url",
      "videoUrl",
      "image_url",
      "imageUrl",
      "src",
      "source",
      "thumbnail"
    ];


    for (const key of preferredKeys) {
      if (typeof data[key] === "string") {
        const value = data[key];

        if (/^https?:\/\//i.test(value)) {
          const lower = value.toLowerCase();

          if (
            lower.includes(".mp4") ||
            lower.includes(".mov") ||
            lower.includes(".webm") ||
            lower.includes(".jpg") ||
            lower.includes(".jpeg") ||
            lower.includes(".png") ||
            lower.includes(".webp") ||
            lower.includes("video") ||
            lower.includes("image")
          ) {
            results.push(value);
          }
        }
      }
    }


    // Recursively inspect everything else
    for (const [key, value] of Object.entries(data)) {
      if (!preferredKeys.includes(key)) {
        extractMedia(value, results);
      }
    }
  }

  return results;
}


// --------------------------------------------------
// UNIQUE URLS
// --------------------------------------------------

function uniqueUrls(urls) {
  return [...new Set(urls)];
}


// --------------------------------------------------
// DETECT REEL
//
// YOUR NEW API EXAMPLE:
//
// {
//   "p": true,
//   "video": [
//     {
//       "video": "VIDEO_URL",
//       "cover": "COVER_URL"
//     }
//   ],
//   "cover": "COVER_URL",
//   "caption": "...",
//   ...
// }
//
// If video[] contains objects with a "video"
// property, this is treated as a Reel.
//
// IMPORTANT:
// The cover is NOT sent here.
// --------------------------------------------------

function isReelResponse(data) {
  if (!data || typeof data !== "object") {
    return false;
  }


  // Exact structure from your API
  if (
    Array.isArray(data.video) &&
    data.video.length > 0 &&
    data.video.some(
      item =>
        item &&
        typeof item === "object" &&
        typeof item.video === "string"
    )
  ) {
    return true;
  }


  // Fallback
  if (
    typeof data.video === "string" &&
    typeof data.cover === "string"
  ) {
    return true;
  }


  // Optional type fields
  if (
    data.type === "reel" ||
    data.type === "reels" ||
    data.media_type === "reel" ||
    data.mediaType === "reel"
  ) {
    return true;
  }


  return false;
}


// --------------------------------------------------
// GET REEL VIDEO
//
// EXACTLY:
//
// video[0].video
//
// NOT:
//
// video[0].cover
// --------------------------------------------------

function getReelVideo(data) {
  if (!data) {
    return null;
  }


  // New API format
  if (Array.isArray(data.video)) {
    for (const item of data.video) {

      // Example:
      //
      // {
      //   video: "https://...mp4",
      //   cover: "https://...jpg"
      // }

      if (
        item &&
        typeof item === "object" &&
        typeof item.video === "string" &&
        /^https?:\/\//i.test(item.video)
      ) {
        return item.video;
      }


      // Fallback if API returns plain strings
      if (
        typeof item === "string" &&
        /^https?:\/\//i.test(item)
      ) {
        return item;
      }
    }
  }


  // Fallback if video itself is a string
  if (
    typeof data.video === "string" &&
    /^https?:\/\//i.test(data.video)
  ) {
    return data.video;
  }


  return null;
}


// --------------------------------------------------
// GET REEL COVER
//
// This is ONLY STORED.
//
// It is NOT automatically sent.
//
// It is sent only when:
// "🖼️ Get Cover Photo"
// is clicked.
// --------------------------------------------------

function getCoverUrl(data) {
  if (!data) {
    return null;
  }


  // First check top-level cover
  if (
    typeof data.cover === "string" &&
    /^https?:\/\//i.test(data.cover)
  ) {
    return data.cover;
  }


  // Then check cover inside video[]
  if (Array.isArray(data.video)) {
    for (const item of data.video) {

      if (
        item &&
        typeof item === "object" &&
        typeof item.cover === "string" &&
        /^https?:\/\//i.test(item.cover)
      ) {
        return item.cover;
      }
    }
  }


  return null;
}


// --------------------------------------------------
// GET CAPTION
// --------------------------------------------------

function getCaption(data) {
  if (!data || typeof data !== "object") {
    return "";
  }

  return (
    data.caption ||
    data.description ||
    data.text ||
    ""
  );
}


// --------------------------------------------------
// ESCAPE HTML
// --------------------------------------------------

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


// --------------------------------------------------
// FORMAT NUMBERS
// --------------------------------------------------

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return escapeHtml(String(value));
  }

  return number.toLocaleString("en-US");
}


// --------------------------------------------------
// FORMAT DETAILS
//
// Sends all useful details returned by your new API.
// --------------------------------------------------

function formatDetails(data) {
  if (!data || typeof data !== "object") {
    return (
      "📋 <b>Instagram Details</b>\n\n" +
      "No details available."
    );
  }

  const lines = [];

  lines.push("📋 <b>Instagram Details</b>");
  lines.push("");


  // Username
  const username =
    data.username ||
    data.owner?.username ||
    data.owner ||
    data.user?.username;

  if (username) {
    lines.push(
      `👤 <b>Username:</b> ${escapeHtml(username)}`
    );
  }


  // Caption
  if (data.caption) {
    lines.push("");
    lines.push("📝 <b>Caption:</b>");
    lines.push(
      escapeHtml(String(data.caption))
    );
  }


  // Taken at
  if (data.taken_at) {
    lines.push(
      `📅 <b>Taken at:</b> ${escapeHtml(
        String(data.taken_at)
      )}`
    );
  }


  // Likes
  if (data.like_count !== undefined) {
    lines.push(
      `❤️ <b>Likes:</b> ${formatNumber(
        data.like_count
      )}`
    );
  }


  // Comments
  if (data.comment_count !== undefined) {
    lines.push(
      `💬 <b>Comments:</b> ${formatNumber(
        data.comment_count
      )}`
    );
  }


  // Views
  if (data.view_count !== undefined) {
    lines.push(
      `👁️ <b>Views:</b> ${formatNumber(
        data.view_count
      )}`
    );
  }


  // Plays
  if (data.play_count !== undefined) {
    lines.push(
      `▶️ <b>Plays:</b> ${formatNumber(
        data.play_count
      )}`
    );
  }


  // Reshares
  if (data.reshare_count !== undefined) {
    lines.push(
      `🔁 <b>Reshares:</b> ${formatNumber(
        data.reshare_count
      )}`
    );
  }


  // Image count
  if (Array.isArray(data.image)) {
    lines.push(
      `🖼️ <b>Images:</b> ${data.image.length}`
    );
  }


  // Video count
  if (Array.isArray(data.video)) {
    lines.push(
      `🎬 <b>Videos:</b> ${data.video.length}`
    );
  }


  // Post flag
  if (data.p !== undefined) {
    lines.push(
      `📌 <b>Post:</b> ${
        data.p ? "Yes" : "No"
      }`
    );
  }


  // API source
  if (data.made_by) {
    lines.push(
      `⚙️ <b>Source:</b> ${escapeHtml(
        String(data.made_by)
      )}`
    );
  }


  lines.push("");
  lines.push("🚀 <b>Powered by Instadrop</b>");

  return lines.join("\n");
}


// --------------------------------------------------
// MEDIA BUTTONS
// --------------------------------------------------

function buildMediaKeyboard(
  storageId,
  isReel = false
) {

  // Reel:
  //
  // [ Get Cover Photo ] [ Get Details ]

  if (isReel) {
    return {
      inline_keyboard: [
        [
          {
            text: "🖼️ Get Cover Photo",
            callback_data:
              `get_cover:${storageId}`
          },
          {
            text: "📋 Get Details",
            callback_data:
              `get_details:${storageId}`
          }
        ]
      ]
    };
  }


  // Normal post/carousel:
  //
  // [ Get Details ]

  return {
    inline_keyboard: [
      [
        {
          text: "📋 Get Details",
          callback_data:
            `get_details:${storageId}`
        }
      ]
    ]
  };
}


// --------------------------------------------------
// SEND MEDIA
// --------------------------------------------------

async function sendMedia(
  chatId,
  url,
  options = {}
) {
  const type = getMediaType(url);

  const replyMarkup =
    options.storageId
      ? buildMediaKeyboard(
          options.storageId,
          options.isReel === true
        )
      : undefined;


  // VIDEO
  if (type === "video") {
    const body = {
      chat_id: chatId,
      video: url,
      supports_streaming: true
    };

    if (options.caption) {
      body.caption = options.caption;
      body.parse_mode = "HTML";
    }

    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    return await telegram(
      "sendVideo",
      body
    );
  }


  // PHOTO
  const body = {
    chat_id: chatId,
    photo: url
  };

  if (options.caption) {
    body.caption = options.caption;
    body.parse_mode = "HTML";
  }

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  return await telegram(
    "sendPhoto",
    body
  );
}


// --------------------------------------------------
// WELCOME
// --------------------------------------------------

async function sendWelcome(
  chatId,
  firstName
) {
  const welcomeCaption =
    `👋 <b>Welcome to Instadrop!</b>\n\n` +
    `📥 <b>Download Instagram media with ease.</b>\n` +
    `Just send me an Instagram link and I'll take care of the rest. 🚀\n\n` +

    `✨ <b>What I can download:</b>\n` +
    `🎬 Reels & Videos\n` +
    `🖼️ Posts & Carousels\n` +
    `📖 Stories & Highlights\n` +
    `👤 Profile Pictures & Media\n\n` +

    `🔗 <b>Simply paste an Instagram link to get started!</b>\n\n` +
    `⚡ Fast • Simple • Easy`;

  await telegram("sendPhoto", {
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
  });
}


// --------------------------------------------------
// NOTIFY ADMIN
// --------------------------------------------------

async function notifyAdmin(user) {
  const chatId = user.id;

  if (notifiedUsers.has(chatId)) {
    return;
  }

  const firstName =
    user.first_name || "Unknown";

  const lastName =
    user.last_name || "";

  const username =
    user.username
      ? `@${user.username}`
      : "No username";

  const adminMessage =
    `🆕 <b>New User Started Instadrop</b>\n\n` +
    `👤 <b>Name:</b> ${escapeHtml(
      firstName
    )} ${escapeHtml(lastName)}\n` +
    `🔗 <b>Username:</b> ${escapeHtml(
      username
    )}\n` +
    `🆔 <b>Chat ID:</b> <code>${chatId}</code>`;

  await telegram("sendMessage", {
    chat_id: ADMIN_CHAT_ID,
    text: adminMessage,
    parse_mode: "HTML"
  });

  notifiedUsers.add(chatId);
}


// --------------------------------------------------
// CALL INSTADROP API
// --------------------------------------------------

async function downloadFromAPI(
  instagramUrl
) {
  const endpoint =
    API_URL +
    encodeURIComponent(instagramUrl);

  const response = await fetch(endpoint);

  if (!response.ok) {
    throw new Error(
      `API returned HTTP ${response.status}`
    );
  }

  const contentType =
    response.headers.get(
      "content-type"
    ) || "";

  if (
    !contentType.includes(
      "application/json"
    )
  ) {
    throw new Error(
      "API did not return JSON"
    );
  }

  const data =
    await response.json();


  // -----------------------------------------------
  // IMPORTANT:
  //
  // If Reel:
  // DO NOT call extractMedia(data)
  //
  // Because extractMedia would find:
  //
  // video[0].video
  // video[0].cover
  //
  // and possibly the top-level cover.
  //
  // Instead, Reel media is handled manually.
  // -----------------------------------------------

  const reel =
    isReelResponse(data);


  if (reel) {
    return {
      raw: data,

      isReel: true,

      reelVideo:
        getReelVideo(data),

      cover:
        getCoverUrl(data),

      caption:
        getCaption(data),

      media: []
    };
  }


  // -----------------------------------------------
  // NORMAL POST / CAROUSEL
  // -----------------------------------------------

  return {
    raw: data,

    isReel: false,

    reelVideo: null,

    cover: getCoverUrl(data),

    caption:
      getCaption(data),

    media:
      uniqueUrls(
        extractMedia(data)
      )
  };
}


// --------------------------------------------------
// CALLBACK HANDLER
// --------------------------------------------------

async function handleCallbackQuery(
  callbackQuery
) {
  const callbackId =
    callbackQuery.id;

  const message =
    callbackQuery.message;

  const chatId =
    message?.chat?.id;

  const callbackData =
    callbackQuery.data || "";


  // Acknowledge button immediately
  await telegram(
    "answerCallbackQuery",
    {
      callback_query_id:
        callbackId
    }
  );


  if (!chatId) {
    return;
  }


  const parts =
    callbackData.split(":");

  const action = parts[0];
  const storageId = parts[1];


  if (!action || !storageId) {
    return;
  }


  const stored =
    mediaStorage.get(storageId);


  // ------------------------------------------------
  // EXPIRED STORAGE
  // ------------------------------------------------

  if (!stored) {
    await telegram(
      "sendMessage",
      {
        chat_id: chatId,
        text:
          `⚠️ <b>This media information has expired.</b>\n\n` +
          `Please send the Instagram link again.`,
        parse_mode: "HTML"
      }
    );

    return;
  }


  // ==================================================
  // GET COVER PHOTO
  // ==================================================

  if (action === "get_cover") {

    if (!stored.cover) {
      await telegram(
        "sendMessage",
        {
          chat_id: chatId,
          text:
            `❌ <b>Cover photo is not available.</b>`,
          parse_mode: "HTML"
        }
      );

      return;
    }


    try {

      await telegram(
        "sendPhoto",
        {
          chat_id: chatId,

          photo: stored.cover,

          caption:
            `🖼️ <b>Reel Cover</b>\n\n` +
            `Downloaded from Instadrop.`,

          parse_mode: "HTML"
        }
      );

    } catch (error) {

      console.error(
        "Cover send error:",
        error
      );


      // Fallback to URL
      await telegram(
        "sendMessage",
        {
          chat_id: chatId,

          text:
            `🖼️ <b>Cover Photo:</b>\n\n` +
            `${stored.cover}`,

          parse_mode: "HTML"
        }
      );
    }

    return;
  }


  // ==================================================
  // GET DETAILS
  // ==================================================

  if (action === "get_details") {

    const details =
      formatDetails(
        stored.raw
      );

    await telegram(
      "sendMessage",
      {
        chat_id: chatId,

        text: details,

        parse_mode: "HTML",

        disable_web_page_preview: true
      }
    );

    return;
  }
}


// --------------------------------------------------
// MAIN HANDLER
// --------------------------------------------------

export default async function handler(
  req,
  res
) {

  // ------------------------------------------------
  // GET / OTHER REQUEST
  // ------------------------------------------------

  if (req.method !== "POST") {
    return res
      .status(200)
      .send(
        "Instadrop Bot is running 🚀"
      );
  }


  try {

    const update =
      req.body;


    if (!update) {
      return res
        .status(200)
        .json({
          ok: true
        });
    }


    // ==================================================
    // CALLBACK QUERY
    // ==================================================

    if (update.callback_query) {

      await handleCallbackQuery(
        update.callback_query
      );

      return res
        .status(200)
        .json({
          ok: true
        });
    }


    // ==================================================
    // NORMAL MESSAGE
    // ==================================================

    if (!update.message) {
      return res
        .status(200)
        .json({
          ok: true
        });
    }


    const message =
      update.message;

    const user =
      message.from;


    if (!user) {
      return res
        .status(200)
        .json({
          ok: true
        });
    }


    const chatId =
      message.chat.id;

    const firstName =
      user.first_name ||
      "there";

    const text =
      (
        message.text ||
        ""
      ).trim();


    // ==================================================
    // /START
    // ==================================================

    if (
      text === "/start" ||
      text.startsWith("/start ")
    ) {

      await notifyAdmin(user);

      await sendWelcome(
        chatId,
        firstName
      );

      return res
        .status(200)
        .json({
          ok: true
        });
    }


    // ==================================================
    // IGNORE NON-TEXT
    // ==================================================

    if (!text) {
      return res
        .status(200)
        .json({
          ok: true
        });
    }


    // ==================================================
    // INSTAGRAM LINK
    // ==================================================

    if (
      isInstagramUrl(text)
    ) {

      // ------------------------------------------------
      // PROCESSING MESSAGE
      // ------------------------------------------------

      const processing =
        await telegram(
          "sendMessage",
          {
            chat_id: chatId,

            text:
              `⏳ <b>Processing your Instagram link...</b>\n\n` +
              `Please wait a moment 🚀`,

            parse_mode: "HTML"
          }
        );


      try {

        // ------------------------------------------------
        // API
        // ------------------------------------------------

        const result =
          await downloadFromAPI(
            text
          );


        // ==================================================
        // REEL
        // ==================================================

        if (result.isReel) {

          const reelVideo =
            result.reelVideo;

          const reelCover =
            result.cover;


          // No video
          if (!reelVideo) {
            throw new Error(
              "Reel detected but no video URL was found."
            );
          }


          // ------------------------------------------------
          // STORE DATA
          //
          // Cover is stored here.
          //
          // It is NOT sent.
          // ------------------------------------------------

          const storageId =
            storeMediaData({
              raw: result.raw,

              cover: reelCover,

              caption:
                result.caption,

              isReel: true
            });


          // ------------------------------------------------
          // DELETE PROCESSING
          // ------------------------------------------------

          if (
            processing.result?.message_id
          ) {

            await telegram(
              "deleteMessage",
              {
                chat_id: chatId,

                message_id:
                  processing.result
                    .message_id
              }
            );
          }


          // ------------------------------------------------
          // SEND ONLY REEL VIDEO
          //
          // NO COVER IS SENT HERE.
          // ------------------------------------------------

          try {

            await telegram(
              "sendVideo",
              {
                chat_id: chatId,

                video: reelVideo,

                caption:
                  `📥 <b>Downloaded from Instadrop</b>`,

                parse_mode: "HTML",

                supports_streaming: true,

                reply_markup:
                  buildMediaKeyboard(
                    storageId,
                    true
                  )
              }
            );

          } catch (mediaError) {

            console.error(
              "Reel send error:",
              mediaError
            );


            // Fallback if Telegram can't fetch
            // the video directly.

            await telegram(
              "sendMessage",
              {
                chat_id: chatId,

                text:
                  `📥 <b>Reel Download:</b>\n\n` +
                  `${reelVideo}`,

                parse_mode: "HTML",

                reply_markup:
                  buildMediaKeyboard(
                    storageId,
                    true
                  )
              }
            );
          }


          return res
            .status(200)
            .json({
              ok: true
            });
        }


        // ==================================================
        // NORMAL POST / CAROUSEL / OTHER MEDIA
        // ==================================================

        const media =
          result.media;


        // No media
        if (
          !media ||
          media.length === 0
        ) {

          if (
            processing.result
              ?.message_id
          ) {

            await telegram(
              "editMessageText",
              {
                chat_id: chatId,

                message_id:
                  processing.result
                    .message_id,

                text:
                  `❌ <b>Sorry, I couldn't find downloadable media.</b>\n\n` +
                  `The post may be private, unavailable, or unsupported.`,

                parse_mode: "HTML"
              }
            );
          }


          return res
            .status(200)
            .json({
              ok: true
            });
        }


        // ------------------------------------------------
        // STORE POST DETAILS
        // ------------------------------------------------

        const storageId =
          storeMediaData({
            raw: result.raw,

            cover: result.cover,

            caption:
              result.caption,

            isReel: false
          });


        // ------------------------------------------------
        // DELETE PROCESSING
        // ------------------------------------------------

        if (
          processing.result?.message_id
        ) {

          await telegram(
            "deleteMessage",
            {
              chat_id: chatId,

              message_id:
                processing.result
                  .message_id
            }
          );
        }


        // ------------------------------------------------
        // SEND ALL NORMAL MEDIA
        //
        // Carousel behavior stays.
        //
        // Each media gets:
        //
        // [ 📋 Get Details ]
        // ------------------------------------------------

        for (
          let i = 0;
          i < media.length;
          i++
        ) {

          const mediaUrl =
            media[i];


          try {

            await sendMedia(
              chatId,
              mediaUrl,
              {
                storageId,

                isReel: false,

                caption:
                  i === 0
                    ? `📥 <b>Downloaded from Instadrop</b>`
                    : undefined
              }
            );

          } catch (mediaError) {

            console.error(
              "Media send error:",
              mediaError
            );


            // Fallback URL

            await telegram(
              "sendMessage",
              {
                chat_id: chatId,

                text:
                  `📥 <b>Download:</b>\n\n` +
                  `${mediaUrl}`,

                parse_mode: "HTML",

                reply_markup:
                  buildMediaKeyboard(
                    storageId,
                    false
                  )
              }
            );
          }
        }


        // ------------------------------------------------
        // COMPLETION MESSAGE
        // ------------------------------------------------

        await telegram(
          "sendMessage",
          {
            chat_id: chatId,

            text:
              `✅ <b>Done!</b>\n\n` +
              `📦 ${media.length} media file${
                media.length > 1
                  ? "s"
                  : ""
              } found.\n\n` +
              `🚀 <b>Powered by Instadrop</b>`,

            parse_mode: "HTML",

            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text:
                      "🌐 Visit Instadrop",

                    url:
                      WEBSITE_URL
                  }
                ]
              ]
            }
          }
        );

      } catch (error) {

        console.error(
          "Download error:",
          error
        );


        if (
          processing.result
            ?.message_id
        ) {

          await telegram(
            "editMessageText",
            {
              chat_id: chatId,

              message_id:
                processing.result
                  .message_id,

              text:
                `❌ <b>Download failed</b>\n\n` +
                `I couldn't process that Instagram link.\n\n` +
                `Please make sure the post is public and try again.`,

              parse_mode: "HTML"
            }
          );

        } else {

          await telegram(
            "sendMessage",
            {
              chat_id: chatId,

              text:
                `❌ <b>Download failed.</b>\n\n` +
                `Please check the Instagram link and try again.`,

              parse_mode: "HTML"
            }
          );
        }
      }


      return res
        .status(200)
        .json({
          ok: true
        });
    }


    // ==================================================
    // NOT AN INSTAGRAM LINK
    // ==================================================

    await telegram(
      "sendMessage",
      {
        chat_id: chatId,

        text:
          `🔗 <b>Send me an Instagram link</b>\n\n` +
          `For example:\n` +
          `• Instagram Reel\n` +
          `• Post\n` +
          `• Carousel\n` +
          `• Story\n` +
          `• Profile\n\n` +
          `I'll handle the rest. 🚀`,

        parse_mode: "HTML",

        reply_markup: {
          inline_keyboard: [
            [
              {
                text:
                  "🌐 Visit Instadrop",

                url:
                  WEBSITE_URL
              }
            ]
          ]
        }
      }
    );


    return res
      .status(200)
      .json({
        ok: true
      });

  } catch (error) {

    console.error(
      "Webhook error:",
      error
    );


    return res
      .status(500)
      .json({
        ok: false,

        error:
          "Something went wrong"
      });
  }
}

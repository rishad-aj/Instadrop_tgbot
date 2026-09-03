const TELEGRAM_BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s";
const ADMIN_CHAT_ID = "7216371031";

const API_URL =
  "https://instadrop.rishu-rishad2019.workers.dev/?url=";

const WELCOME_IMAGE =
  "https://instadrop.web.app/og-image.png";

const WEBSITE_URL =
  "https://instadrop.web.app/";


// ==================================================
// TEMPORARY STORAGE
// ==================================================
//
// Stores API response data for:
// - Get Cover Photo
// - Get Details
//
// IMPORTANT:
// This is in-memory storage.
// For serverless production, use KV / Redis / DB.
// ==================================================

const notifiedUsers = new Set();
const mediaStorage = new Map();


// ==================================================
// TELEGRAM API HELPER
// ==================================================

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


// ==================================================
// CHECK INSTAGRAM URL
// ==================================================

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


// ==================================================
// CREATE STORAGE ID
// ==================================================

function createStorageId() {
  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .substring(2, 10)
  );
}


// ==================================================
// STORE MEDIA/API DATA
// ==================================================

function storeMediaData(data) {
  const id = createStorageId();

  mediaStorage.set(id, {
    ...data,
    createdAt: Date.now()
  });

  // Remove entries older than 30 minutes
  const expiry =
    Date.now() - 30 * 60 * 1000;

  for (const [key, value] of mediaStorage.entries()) {
    if (value.createdAt < expiry) {
      mediaStorage.delete(key);
    }
  }

  return id;
}


// ==================================================
// UNIQUE URLS
// ==================================================

function uniqueUrls(urls) {
  return [...new Set(urls)];
}


// ==================================================
// GET MEDIA TYPE
// ==================================================
//
// The API already tells us whether something came from
// image[] or video[], but this function is still useful
// when sending individual media.
// ==================================================

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

  // Important:
  // Instagram image URLs can contain .heic even when
  // Instagram is returning a JPG through query params
  // such as stp=dst-jpg.
  //
  // Anything that came from image[] is therefore treated
  // as a photo.
  return "photo";
}


// ==================================================
// EXTRACT MEDIA FROM NEW API
// ==================================================
//
// Normal post/carousel API:
//
// {
//   "image": [
//     "IMAGE_1",
//     "IMAGE_2"
//   ],
//   "video": []
// }
//
// We directly read image[] and video[].
//
// This avoids relying on file extensions.
// ==================================================

function extractMedia(data) {
  const results = [];

  if (!data || typeof data !== "object") {
    return results;
  }


  // ------------------------------------------------
  // IMAGES
  // ------------------------------------------------

  if (Array.isArray(data.image)) {
    for (const image of data.image) {
      if (
        typeof image === "string" &&
        /^https?:\/\//i.test(image)
      ) {
        results.push(image);
      }
    }
  }


  // ------------------------------------------------
  // VIDEOS
  // ------------------------------------------------
  //
  // Supports:
  //
  // video: [
  //   "VIDEO_URL"
  // ]
  //
  // AND:
  //
  // video: [
  //   {
  //     video: "VIDEO_URL"
  //   }
  // ]
  //
  // ------------------------------------------------

  if (Array.isArray(data.video)) {
    for (const video of data.video) {

      // Plain URL
      if (
        typeof video === "string" &&
        /^https?:\/\//i.test(video)
      ) {
        results.push(video);
        continue;
      }


      // Object format
      if (
        video &&
        typeof video === "object"
      ) {
        const videoUrl =
          video.video ||
          video.url ||
          video.download_url ||
          video.downloadUrl ||
          video.media_url ||
          video.mediaUrl ||
          video.video_url ||
          video.videoUrl;

        if (
          typeof videoUrl === "string" &&
          /^https?:\/\//i.test(videoUrl)
        ) {
          results.push(videoUrl);
        }
      }
    }
  }


  return uniqueUrls(results);
}


// ==================================================
// DETECT REEL
// ==================================================
//
// Your Reel API:
//
// {
//   "video": [
//     {
//       "video": "VIDEO_URL",
//       "cover": "COVER_URL"
//     }
//   ],
//   "cover": "COVER_URL",
//   ...
// }
//
// This MUST be detected before extractMedia().
//
// Otherwise the cover could accidentally be treated
// as downloadable media.
// ==================================================

function isReelResponse(data) {
  if (!data || typeof data !== "object") {
    return false;
  }


  // Exact new Reel format
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


  // Fallback format
  if (
    typeof data.video === "string" &&
    typeof data.cover === "string"
  ) {
    return true;
  }


  // Optional API type fields
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


// ==================================================
// GET REEL VIDEO
// ==================================================
//
// IMPORTANT:
//
// For:
//
// video: [
//   {
//     video: "VIDEO",
//     cover: "COVER"
//   }
// ]
//
// ONLY video.video is returned.
//
// cover is NEVER returned here.
// ==================================================

function getReelVideo(data) {
  if (!data) {
    return null;
  }


  // New API structure
  if (Array.isArray(data.video)) {
    for (const item of data.video) {

      if (
        item &&
        typeof item === "object" &&
        typeof item.video === "string" &&
        /^https?:\/\//i.test(item.video)
      ) {
        return item.video;
      }


      // Fallback if video[] contains strings
      if (
        typeof item === "string" &&
        /^https?:\/\//i.test(item)
      ) {
        return item;
      }
    }
  }


  // Fallback if video is directly a URL
  if (
    typeof data.video === "string" &&
    /^https?:\/\//i.test(data.video)
  ) {
    return data.video;
  }


  return null;
}


// ==================================================
// GET COVER
// ==================================================
//
// Cover is stored only.
//
// It is NOT sent automatically.
//
// It is sent only when:
// 🖼️ Get Cover Photo
// is clicked.
// ==================================================

function getCoverUrl(data) {
  if (!data) {
    return null;
  }


  // Top-level cover
  if (
    typeof data.cover === "string" &&
    /^https?:\/\//i.test(data.cover)
  ) {
    return data.cover;
  }


  // Cover inside video[]
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


// ==================================================
// GET CAPTION
// ==================================================

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


// ==================================================
// HTML ESCAPE
// ==================================================

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


// ==================================================
// FORMAT NUMBER
// ==================================================

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return escapeHtml(String(value));
  }

  return number.toLocaleString("en-US");
}


// ==================================================
// FORMAT DETAILS
// ==================================================
//
// Uses the details returned by your new API.
//
// Example:
//
// username
// caption
// taken_at
// like_count
// comment_count
// view_count
// play_count
// reshare_count
// made_by
// etc.
// ==================================================

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


  // ------------------------------------------------
  // Username
  // ------------------------------------------------

  const username =
    data.username ||
    data.owner?.username ||
    data.owner ||
    data.user?.username;

  if (username) {
    lines.push(
      `👤 <b>Username:</b> ${escapeHtml(
        String(username)
      )}`
    );
  }


  // ------------------------------------------------
  // Caption
  // ------------------------------------------------

  if (data.caption) {
    lines.push("");
    lines.push("📝 <b>Caption:</b>");
    lines.push(
      escapeHtml(
        String(data.caption)
      )
    );
  }


  // ------------------------------------------------
  // Taken At
  // ------------------------------------------------

  if (data.taken_at) {
    lines.push(
      `📅 <b>Taken at:</b> ${escapeHtml(
        String(data.taken_at)
      )}`
    );
  }


  // ------------------------------------------------
  // Likes
  // ------------------------------------------------

  if (data.like_count !== undefined) {
    lines.push(
      `❤️ <b>Likes:</b> ${formatNumber(
        data.like_count
      )}`
    );
  }


  // ------------------------------------------------
  // Comments
  // ------------------------------------------------

  if (data.comment_count !== undefined) {
    lines.push(
      `💬 <b>Comments:</b> ${formatNumber(
        data.comment_count
      )}`
    );
  }


  // ------------------------------------------------
  // Views
  // ------------------------------------------------

  if (data.view_count !== undefined) {
    lines.push(
      `👁️ <b>Views:</b> ${formatNumber(
        data.view_count
      )}`
    );
  }


  // ------------------------------------------------
  // Plays
  // ------------------------------------------------

  if (data.play_count !== undefined) {
    lines.push(
      `▶️ <b>Plays:</b> ${formatNumber(
        data.play_count
      )}`
    );
  }


  // ------------------------------------------------
  // Reshares
  // ------------------------------------------------

  if (data.reshare_count !== undefined) {
    lines.push(
      `🔁 <b>Reshares:</b> ${formatNumber(
        data.reshare_count
      )}`
    );
  }


  // ------------------------------------------------
  // Images
  // ------------------------------------------------

  if (Array.isArray(data.image)) {
    lines.push(
      `🖼️ <b>Images:</b> ${data.image.length}`
    );
  }


  // ------------------------------------------------
  // Videos
  // ------------------------------------------------

  if (Array.isArray(data.video)) {
    lines.push(
      `🎬 <b>Videos:</b> ${data.video.length}`
    );
  }


  // ------------------------------------------------
  // Post flag
  // ------------------------------------------------

  if (data.p !== undefined) {
    lines.push(
      `📌 <b>Post:</b> ${
        data.p ? "Yes" : "No"
      }`
    );
  }


  // ------------------------------------------------
  // Made by
  // ------------------------------------------------

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


// ==================================================
// MEDIA BUTTONS
// ==================================================

function buildMediaKeyboard(
  storageId,
  isReel = false
) {

  // ------------------------------------------------
  // REEL
  // ------------------------------------------------
  //
  // [ 🖼️ Get Cover Photo ]
  // [ 📋 Get Details ]
  // ------------------------------------------------

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


  // ------------------------------------------------
  // NORMAL POST / CAROUSEL
  // ------------------------------------------------

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


// ==================================================
// SEND MEDIA
// ==================================================

async function sendMedia(
  chatId,
  url,
  options = {}
) {
  const type =
    getMediaType(url);

  const replyMarkup =
    options.storageId
      ? buildMediaKeyboard(
          options.storageId,
          options.isReel === true
        )
      : undefined;


  // ------------------------------------------------
  // VIDEO
  // ------------------------------------------------

  if (type === "video") {

    const body = {
      chat_id: chatId,
      video: url,
      supports_streaming: true
    };


    if (options.caption) {
      body.caption =
        options.caption;

      body.parse_mode =
        "HTML";
    }


    if (replyMarkup) {
      body.reply_markup =
        replyMarkup;
    }


    return await telegram(
      "sendVideo",
      body
    );
  }


  // ------------------------------------------------
  // PHOTO
  // ------------------------------------------------

  const body = {
    chat_id: chatId,
    photo: url
  };


  if (options.caption) {
    body.caption =
      options.caption;

    body.parse_mode =
      "HTML";
  }


  if (replyMarkup) {
    body.reply_markup =
      replyMarkup;
  }


  return await telegram(
    "sendPhoto",
    body
  );
}


// ==================================================
// WELCOME MESSAGE
// ==================================================

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

  await telegram(
    "sendPhoto",
    {
      chat_id: chatId,

      photo: WELCOME_IMAGE,

      caption:
        welcomeCaption,

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
}


// ==================================================
// NOTIFY ADMIN
// ==================================================

async function notifyAdmin(user) {
  const chatId =
    user.id;


  if (
    notifiedUsers.has(chatId)
  ) {
    return;
  }


  const firstName =
    user.first_name ||
    "Unknown";

  const lastName =
    user.last_name ||
    "";

  const username =
    user.username
      ? `@${user.username}`
      : "No username";


  const adminMessage =
    `🆕 <b>New User Started Instadrop</b>\n\n` +
    `👤 <b>Name:</b> ${escapeHtml(
      firstName
    )} ${escapeHtml(
      lastName
    )}\n` +
    `🔗 <b>Username:</b> ${escapeHtml(
      username
    )}\n` +
    `🆔 <b>Chat ID:</b> <code>${chatId}</code>`;


  await telegram(
    "sendMessage",
    {
      chat_id:
        ADMIN_CHAT_ID,

      text:
        adminMessage,

      parse_mode:
        "HTML"
    }
  );


  notifiedUsers.add(chatId);
}


// ==================================================
// CALL INSTADROP API
// ==================================================

async function downloadFromAPI(
  instagramUrl
) {
  const endpoint =
    API_URL +
    encodeURIComponent(
      instagramUrl
    );


  const response =
    await fetch(endpoint);


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


  // ==================================================
  // REEL
  // ==================================================
  //
  // IMPORTANT:
  //
  // We DO NOT use extractMedia() here.
  //
  // We manually get:
  //
  // video[].video -> video
  // video[].cover -> stored
  //
  // ==================================================

  const isReel =
    isReelResponse(data);


  if (isReel) {

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


  // ==================================================
  // NORMAL POST / CAROUSEL
  // ==================================================

  return {
    raw: data,

    isReel: false,

    reelVideo: null,

    cover:
      getCoverUrl(data),

    caption:
      getCaption(data),

    media:
      extractMedia(data)
  };
}


// ==================================================
// HANDLE CALLBACK BUTTONS
// ==================================================

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


  // ------------------------------------------------
  // Acknowledge button click
  // ------------------------------------------------

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

  const action =
    parts[0];

  const storageId =
    parts[1];


  if (
    !action ||
    !storageId
  ) {
    return;
  }


  const stored =
    mediaStorage.get(
      storageId
    );


  // ==================================================
  // EXPIRED DATA
  // ==================================================

  if (!stored) {

    await telegram(
      "sendMessage",
      {
        chat_id:
          chatId,

        text:
          `⚠️ <b>This media information has expired.</b>\n\n` +
          `Please send the Instagram link again.`,

        parse_mode:
          "HTML"
      }
    );

    return;
  }


  // ==================================================
  // GET COVER PHOTO
  // ==================================================

  if (
    action === "get_cover"
  ) {

    if (!stored.cover) {

      await telegram(
        "sendMessage",
        {
          chat_id:
            chatId,

          text:
            `❌ <b>Cover photo is not available.</b>`,

          parse_mode:
            "HTML"
        }
      );

      return;
    }


    try {

      await telegram(
        "sendPhoto",
        {
          chat_id:
            chatId,

          photo:
            stored.cover,

          caption:
            `🖼️ <b>Reel Cover</b>\n\n` +
            `Downloaded from Instadrop.`,

          parse_mode:
            "HTML"
        }
      );

    } catch (error) {

      console.error(
        "Cover send error:",
        error
      );


      await telegram(
        "sendMessage",
        {
          chat_id:
            chatId,

          text:
            `🖼️ <b>Cover Photo:</b>\n\n` +
            `${stored.cover}`,

          parse_mode:
            "HTML"
        }
      );
    }


    return;
  }


  // ==================================================
  // GET DETAILS
  // ==================================================

  if (
    action === "get_details"
  ) {

    const details =
      formatDetails(
        stored.raw
      );


    await telegram(
      "sendMessage",
      {
        chat_id:
          chatId,

        text:
          details,

        parse_mode:
          "HTML",

        disable_web_page_preview:
          true
      }
    );


    return;
  }
}


// ==================================================
// MAIN HANDLER
// ==================================================

export default async function handler(
  req,
  res
) {

  // ==================================================
  // NON POST REQUEST
  // ==================================================

  if (
    req.method !== "POST"
  ) {

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

    if (
      update.callback_query
    ) {

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

    if (
      !update.message
    ) {

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

      await notifyAdmin(
        user
      );


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
      // PROCESSING
      // ------------------------------------------------

      const processing =
        await telegram(
          "sendMessage",
          {
            chat_id:
              chatId,

            text:
              `⏳ <b>Processing your Instagram link...</b>\n\n` +
              `Please wait a moment 🚀`,

            parse_mode:
              "HTML"
          }
        );


      try {

        // ------------------------------------------------
        // API REQUEST
        // ------------------------------------------------

        const result =
          await downloadFromAPI(
            text
          );


        // ==================================================
        // REEL
        // ==================================================

        if (
          result.isReel
        ) {

          const reelVideo =
            result.reelVideo;

          const reelCover =
            result.cover;


          // ------------------------------------------------
          // MAKE SURE VIDEO EXISTS
          // ------------------------------------------------

          if (!reelVideo) {
            throw new Error(
              "Reel detected but no video URL was found."
            );
          }


          // ------------------------------------------------
          // STORE REEL INFORMATION
          //
          // Cover is stored only.
          // It is NOT sent now.
          // ------------------------------------------------

          const storageId =
            storeMediaData({
              raw:
                result.raw,

              cover:
                reelCover,

              caption:
                result.caption,

              isReel:
                true
            });


          // ------------------------------------------------
          // DELETE PROCESSING
          // ------------------------------------------------

          if (
            processing.result
              ?.message_id
          ) {

            await telegram(
              "deleteMessage",
              {
                chat_id:
                  chatId,

                message_id:
                  processing.result
                    .message_id
              }
            );
          }


          // ==================================================
          // SEND REEL VIDEO ONLY
          // ==================================================
          //
          // NO COVER IS SENT HERE.
          //
          // Buttons:
          //
          // 🖼️ Get Cover Photo
          // 📋 Get Details
          //
          // ==================================================

          try {

            await telegram(
              "sendVideo",
              {
                chat_id:
                  chatId,

                video:
                  reelVideo,

                caption:
                  `📥 <b>Downloaded from Instadrop</b>`,

                parse_mode:
                  "HTML",

                supports_streaming:
                  true,

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


            // ------------------------------------------------
            // FALLBACK
            // ------------------------------------------------

            await telegram(
              "sendMessage",
              {
                chat_id:
                  chatId,

                text:
                  `📥 <b>Reel Download:</b>\n\n` +
                  `${reelVideo}`,

                parse_mode:
                  "HTML",

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
        // NORMAL POST / CAROUSEL
        // ==================================================

        const media =
          result.media;


        // ------------------------------------------------
        // NO MEDIA
        // ------------------------------------------------

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
                chat_id:
                  chatId,

                message_id:
                  processing.result
                    .message_id,

                text:
                  `❌ <b>Sorry, I couldn't find downloadable media.</b>\n\n` +
                  `The post may be private, unavailable, or unsupported.`,

                parse_mode:
                  "HTML"
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
            raw:
              result.raw,

            cover:
              result.cover,

            caption:
              result.caption,

            isReel:
              false
          });


        // ------------------------------------------------
        // DELETE PROCESSING
        // ------------------------------------------------

        if (
          processing.result
            ?.message_id
        ) {

          await telegram(
            "deleteMessage",
            {
              chat_id:
                chatId,

              message_id:
                processing.result
                  .message_id
            }
          );
        }


        // ==================================================
        // SEND NORMAL MEDIA
        // ==================================================
        //
        // For:
        //
        // image: [image1, image2]
        //
        // both images are sent.
        //
        // Each gets:
        //
        // 📋 Get Details
        //
        // ==================================================

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
                storageId:

                  storageId,

                isReel:
                  false,

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


            // ------------------------------------------------
            // FALLBACK URL
            // ------------------------------------------------

            await telegram(
              "sendMessage",
              {
                chat_id:
                  chatId,

                text:
                  `📥 <b>Download:</b>\n\n` +
                  `${mediaUrl}`,

                parse_mode:
                  "HTML",

                reply_markup:
                  buildMediaKeyboard(
                    storageId,
                    false
                  )
              }
            );
          }
        }


        // ==================================================
        // COMPLETION MESSAGE
        // ==================================================

        await telegram(
          "sendMessage",
          {
            chat_id:
              chatId,

            text:
              `✅ <b>Done!</b>\n\n` +
              `📦 ${media.length} media file${
                media.length > 1
                  ? "s"
                  : ""
              } found.\n\n` +
              `🚀 <b>Powered by Instadrop</b>`,

            parse_mode:
              "HTML",

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


        // ------------------------------------------------
        // ERROR
        // ------------------------------------------------

        if (
          processing.result
            ?.message_id
        ) {

          await telegram(
            "editMessageText",
            {
              chat_id:
                chatId,

              message_id:
                processing.result
                  .message_id,

              text:
                `❌ <b>Download failed</b>\n\n` +
                `I couldn't process that Instagram link.\n\n` +
                `Please make sure the post is public and try again.`,

              parse_mode:
                "HTML"
            }
          );

        } else {

          await telegram(
            "sendMessage",
            {
              chat_id:
                chatId,

              text:
                `❌ <b>Download failed.</b>\n\n` +
                `Please check the Instagram link and try again.`,

              parse_mode:
                "HTML"
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
        chat_id:
          chatId,

        text:
          `🔗 <b>Send me an Instagram link</b>\n\n` +
          `For example:\n` +
          `• Instagram Reel\n` +
          `• Post\n` +
          `• Carousel\n` +
          `• Story\n` +
          `• Profile\n\n` +
          `I'll handle the rest. 🚀`,

        parse_mode:
          "HTML",

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

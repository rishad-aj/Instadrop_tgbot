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
// INSTAGRAM URL CHECK
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
// STORE DATA
// ==================================================

function storeMediaData(data) {
  const id = createStorageId();

  mediaStorage.set(id, {
    ...data,
    createdAt: Date.now()
  });

  // Cleanup anything older than 30 minutes
  const expiry =
    Date.now() - 30 * 60 * 1000;

  for (const [key, value] of mediaStorage.entries()) {
    if (
      value &&
      value.createdAt &&
      value.createdAt < expiry
    ) {
      mediaStorage.delete(key);
    }
  }

  return id;
}


// ==================================================
// VALID URL
// ==================================================

function isValidHttpUrl(value) {
  return (
    typeof value === "string" &&
    /^https?:\/\//i.test(value)
  );
}


// ==================================================
// UNIQUE ARRAY
// ==================================================

function uniqueUrls(urls) {
  return [
    ...new Set(
      urls.filter(
        isValidHttpUrl
      )
    )
  ];
}


// ==================================================
// GET MEDIA TYPE
// ==================================================

function getMediaType(url) {
  if (!url || typeof url !== "string") {
    return "photo";
  }

  const lower =
    url.toLowerCase();

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


// ==================================================
// GET VIDEO URL FROM VIDEO OBJECT
// ==================================================

function getVideoUrl(video) {
  if (!video) {
    return null;
  }

  // Direct string
  if (
    typeof video === "string" &&
    isValidHttpUrl(video)
  ) {
    return video;
  }

  // Object
  if (
    typeof video === "object"
  ) {
    const url =
      video.video ||
      video.url ||
      video.download_url ||
      video.downloadUrl ||
      video.media_url ||
      video.mediaUrl ||
      video.video_url ||
      video.videoUrl;

    if (
      isValidHttpUrl(url)
    ) {
      return url;
    }
  }

  return null;
}


// ==================================================
// GET COVER FROM VIDEO OBJECT
// ==================================================

function getVideoCover(video) {
  if (
    !video ||
    typeof video !== "object"
  ) {
    return null;
  }

  const cover =
    video.cover ||
    video.cover_url ||
    video.coverUrl ||
    video.thumbnail ||
    video.thumbnail_url ||
    video.thumbnailUrl;

  if (
    isValidHttpUrl(cover)
  ) {
    return cover;
  }

  return null;
}


// ==================================================
// NORMALIZE A SINGLE MEDIA ITEM
// ==================================================
//
// Converts:
//
// {
//   image: [...],
//   video: [...]
// }
//
// into:
//
// [
//   {
//     url: "...",
//     type: "photo",
//     cover: null,
//     data: {...}
//   }
// ]
//
// or:
//
// [
//   {
//     url: "...",
//     type: "video",
//     cover: "...",
//     data: {...}
//   }
// ]
// ==================================================

function normalizeMediaItem(item) {
  const results = [];

  if (
    !item ||
    typeof item !== "object"
  ) {
    return results;
  }


  // ------------------------------------------------
  // IMAGES
  // ------------------------------------------------

  if (
    Array.isArray(item.image)
  ) {
    for (const image of item.image) {

      if (
        isValidHttpUrl(image)
      ) {
        results.push({
          url: image,
          type: "photo",
          cover: null,
          data: item
        });
      }
    }
  }


  // ------------------------------------------------
  // VIDEOS
  // ------------------------------------------------

  if (
    Array.isArray(item.video)
  ) {
    for (const video of item.video) {

      const videoUrl =
        getVideoUrl(video);

      if (!videoUrl) {
        continue;
      }

      results.push({
        url: videoUrl,
        type: "video",

        // IMPORTANT:
        // Cover is stored but NOT automatically sent.
        cover:
          getVideoCover(video),

        data: item
      });
    }
  }


  return results;
}


// ==================================================
// EXTRACT NORMAL POST MEDIA
// ==================================================

function extractMedia(data) {
  const results = [];

  if (
    !data ||
    typeof data !== "object"
  ) {
    return results;
  }


  // ------------------------------------------------
  // NORMAL TOP-LEVEL MEDIA
  // ------------------------------------------------

  const normalized =
    normalizeMediaItem(
      data
    );

  results.push(
    ...normalized
  );


  // ------------------------------------------------
  // SAFETY FALLBACK
  // ------------------------------------------------

  // Some APIs could return direct video fields.
  if (
    results.length === 0 &&
    typeof data.video === "string" &&
    isValidHttpUrl(data.video)
  ) {
    results.push({
      url: data.video,
      type: "video",
      cover:
        isValidHttpUrl(data.cover)
          ? data.cover
          : null,
      data
    });
  }


  return results;
}


// ==================================================
// DETECT HIGHLIGHT
// ==================================================

function isHighlightResponse(data) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return false;
  }

  return (
    data.type === "highlight" ||
    data.type === "highlights" ||
    Array.isArray(data.items)
  );
}


// ==================================================
// DETECT STORY
// ==================================================

function isStoryResponse(data) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return false;
  }

  if (
    data.type === "story" ||
    data.type === "stories"
  ) {
    return true;
  }

  return false;
}


// ==================================================
// DETECT REEL
// ==================================================
//
// IMPORTANT:
//
// Highlight and Story are checked BEFORE Reel.
//
// This prevents a Story video with a cover from
// accidentally being treated as a Reel.
// ==================================================

function isReelResponse(data) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return false;
  }


  // Never treat Highlight as Reel
  if (
    isHighlightResponse(data)
  ) {
    return false;
  }


  // Never treat Story as Reel
  if (
    isStoryResponse(data)
  ) {
    return false;
  }


  // Explicit Reel type
  if (
    data.type === "reel" ||
    data.type === "reels" ||
    data.media_type === "reel" ||
    data.mediaType === "reel"
  ) {
    return true;
  }


  // New Reel structure
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


  // Old/fallback structure
  if (
    typeof data.video === "string" &&
    typeof data.cover === "string"
  ) {
    return true;
  }


  return false;
}


// ==================================================
// GET REEL VIDEO
// ==================================================

function getReelVideo(data) {
  if (!data) {
    return null;
  }


  if (
    Array.isArray(data.video)
  ) {

    for (
      const item of data.video
    ) {

      const url =
        getVideoUrl(item);

      if (url) {
        return url;
      }
    }
  }


  if (
    typeof data.video === "string" &&
    isValidHttpUrl(data.video)
  ) {
    return data.video;
  }


  return null;
}


// ==================================================
// GET REEL COVER
// ==================================================

function getCoverUrl(data) {
  if (!data) {
    return null;
  }


  // Top-level cover
  if (
    isValidHttpUrl(data.cover)
  ) {
    return data.cover;
  }


  // Cover inside video[]
  if (
    Array.isArray(data.video)
  ) {

    for (
      const item of data.video
    ) {

      const cover =
        getVideoCover(item);

      if (cover) {
        return cover;
      }
    }
  }


  return null;
}


// ==================================================
// EXTRACT HIGHLIGHT ITEMS
// ==================================================
//
// Highlight:
//
// {
//   type: "highlight",
//   items: [
//     {
//       image: [],
//       video: [
//         {
//           video: "...",
//           cover: "..."
//         }
//       ]
//     }
//   ]
// }
//
// Every item is processed independently.
// ==================================================

function extractHighlightItems(data) {
  const results = [];

  if (
    !data ||
    !Array.isArray(data.items)
  ) {
    return results;
  }


  for (
    let index = 0;
    index < data.items.length;
    index++
  ) {

    const item =
      data.items[index];

    const media =
      normalizeMediaItem(
        item
      );


    for (
      const mediaItem of media
    ) {

      results.push({
        ...mediaItem,

        index,

        highlightTitle:
          data.highlight_title ||
          "",

        highlightCover:
          isValidHttpUrl(
            data.highlight_cover
          )
            ? data.highlight_cover
            : null
      });
    }
  }


  return results;
}


// ==================================================
// EXTRACT STORY MEDIA
// ==================================================

function extractStoryMedia(data) {
  const results = [];

  if (
    !data ||
    typeof data !== "object"
  ) {
    return results;
  }


  // ------------------------------------------------
  // Some story responses use items[]
  // ------------------------------------------------

  if (
    Array.isArray(data.items)
  ) {

    for (
      let index = 0;
      index < data.items.length;
      index++
    ) {

      const item =
        data.items[index];

      const media =
        normalizeMediaItem(
          item
        );

      for (
        const mediaItem of media
      ) {

        results.push({
          ...mediaItem,
          index
        });
      }
    }

    if (
      results.length > 0
    ) {
      return results;
    }
  }


  // ------------------------------------------------
  // Some story responses use top-level media
  // ------------------------------------------------

  return normalizeMediaItem(
    data
  );
}


// ==================================================
// GET CAPTION
// ==================================================

function getCaption(data) {
  if (
    !data ||
    typeof data !== "object"
  ) {
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
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    );
}


// ==================================================
// FORMAT NUMBER
// ==================================================

function formatNumber(value) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return escapeHtml(
      String(value)
    );
  }

  return number.toLocaleString(
    "en-US"
  );
}


// ==================================================
// FORMAT DETAILS
// ==================================================

function formatDetails(data) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return (
      "📋 <b>Instagram Details</b>\n\n" +
      "No details available."
    );
  }


  const lines = [];


  lines.push(
    "📋 <b>Instagram Details</b>"
  );

  lines.push("");


  // ------------------------------------------------
  // TYPE
  // ------------------------------------------------

  if (data.type) {
    lines.push(
      `📂 <b>Type:</b> ${escapeHtml(
        String(data.type)
      )}`
    );
  }


  // ------------------------------------------------
  // USERNAME
  // ------------------------------------------------

  const username =
    data.username ||
    data.owner?.username ||
    data.user?.username;

  if (username) {
    lines.push(
      `👤 <b>Username:</b> ${escapeHtml(
        String(username)
      )}`
    );
  }


  // ------------------------------------------------
  // OWNER
  // ------------------------------------------------

  if (
    data.owner &&
    typeof data.owner === "string"
  ) {
    lines.push(
      `🔗 <b>Owner:</b> ${escapeHtml(
        data.owner
      )}`
    );
  }


  // ------------------------------------------------
  // HIGHLIGHT TITLE
  // ------------------------------------------------

  if (
    data.highlight_title
  ) {
    lines.push(
      `⭐ <b>Highlight:</b> ${escapeHtml(
        String(data.highlight_title)
      )}`
    );
  }


  // ------------------------------------------------
  // HIGHLIGHT COUNT
  // ------------------------------------------------

  if (
    data.count !== undefined
  ) {
    lines.push(
      `📦 <b>Items:</b> ${formatNumber(
        data.count
      )}`
    );
  }


  // ------------------------------------------------
  // CAPTION
  // ------------------------------------------------

  if (data.caption) {

    lines.push("");

    lines.push(
      "📝 <b>Caption:</b>"
    );

    lines.push(
      escapeHtml(
        String(data.caption)
      )
    );
  }


  // ------------------------------------------------
  // TAKEN AT
  // ------------------------------------------------

  if (
    data.taken_at
  ) {
    lines.push(
      `📅 <b>Taken at:</b> ${escapeHtml(
        String(data.taken_at)
      )}`
    );
  }


  // ------------------------------------------------
  // LIKES
  // ------------------------------------------------

  if (
    data.like_count !== undefined
  ) {
    lines.push(
      `❤️ <b>Likes:</b> ${formatNumber(
        data.like_count
      )}`
    );
  }


  // ------------------------------------------------
  // COMMENTS
  // ------------------------------------------------

  if (
    data.comment_count !== undefined
  ) {
    lines.push(
      `💬 <b>Comments:</b> ${formatNumber(
        data.comment_count
      )}`
    );
  }


  // ------------------------------------------------
  // VIEWS
  // ------------------------------------------------

  if (
    data.view_count !== undefined
  ) {
    lines.push(
      `👁️ <b>Views:</b> ${formatNumber(
        data.view_count
      )}`
    );
  }


  // ------------------------------------------------
  // PLAYS
  // ------------------------------------------------

  if (
    data.play_count !== undefined
  ) {
    lines.push(
      `▶️ <b>Plays:</b> ${formatNumber(
        data.play_count
      )}`
    );
  }


  // ------------------------------------------------
  // RESHARES
  // ------------------------------------------------

  if (
    data.reshare_count !== undefined
  ) {
    lines.push(
      `🔁 <b>Reshares:</b> ${formatNumber(
        data.reshare_count
      )}`
    );
  }


  // ------------------------------------------------
  // IMAGES
  // ------------------------------------------------

  if (
    Array.isArray(data.image)
  ) {
    lines.push(
      `🖼️ <b>Images:</b> ${data.image.length}`
    );
  }


  // ------------------------------------------------
  // VIDEOS
  // ------------------------------------------------

  if (
    Array.isArray(data.video)
  ) {
    lines.push(
      `🎬 <b>Videos:</b> ${data.video.length}`
    );
  }


  // ------------------------------------------------
  // ITEMS
  // ------------------------------------------------

  if (
    Array.isArray(data.items)
  ) {
    lines.push(
      `📦 <b>Media Items:</b> ${data.items.length}`
    );
  }


  // ------------------------------------------------
  // POST FLAG
  // ------------------------------------------------

  if (
    data.p !== undefined
  ) {
    lines.push(
      `📌 <b>Post:</b> ${
        data.p
          ? "Yes"
          : "No"
      }`
    );
  }


  // ------------------------------------------------
  // MADE BY
  // ------------------------------------------------

  if (
    data.made_by
  ) {
    lines.push(
      `⚙️ <b>Source:</b> ${escapeHtml(
        String(data.made_by)
      )}`
    );
  }


  lines.push("");

  lines.push(
    "🚀 <b>Powered by Instadrop</b>"
  );


  return lines.join("\n");
}


// ==================================================
// BUILD KEYBOARD
// ==================================================
//
// For media with cover:
//
// [ 🖼️ Get Cover Photo ]
// [ 📋 Get Details ]
//
// For media without cover:
//
// [ 📋 Get Details ]
//
// ==================================================

function buildMediaKeyboard(
  storageId,
  hasCover = false
) {

  const buttons = [];


  // Cover button
  if (hasCover) {
    buttons.push({
      text:
        "🖼️ Get Cover Photo",

      callback_data:
        `get_cover:${storageId}`
    });
  }


  // Details button
  buttons.push({
    text:
      "📋 Get Details",

    callback_data:
      `get_details:${storageId}`
  });


  return {
    inline_keyboard: [
      buttons
    ]
  };
}


// ==================================================
// SEND MEDIA
// ==================================================

async function sendMedia(
  chatId,
  mediaItem,
  options = {}
) {

  const url =
    mediaItem.url;

  const type =
    mediaItem.type ||
    getMediaType(url);

  const cover =
    mediaItem.cover ||
    null;


  const replyMarkup =
    options.storageId
      ? buildMediaKeyboard(
          options.storageId,
          !!cover
        )
      : undefined;


  // ==================================================
  // VIDEO
  // ==================================================

  if (
    type === "video"
  ) {

    const body = {
      chat_id:
        chatId,

      video:
        url,

      supports_streaming:
        true
    };


    if (
      options.caption
    ) {
      body.caption =
        options.caption;

      body.parse_mode =
        "HTML";
    }


    if (
      replyMarkup
    ) {
      body.reply_markup =
        replyMarkup;
    }


    return await telegram(
      "sendVideo",
      body
    );
  }


  // ==================================================
  // PHOTO
  // ==================================================

  const body = {
    chat_id:
      chatId,

    photo:
      url
  };


  if (
    options.caption
  ) {
    body.caption =
      options.caption;

    body.parse_mode =
      "HTML";
  }


  if (
    replyMarkup
  ) {
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
      chat_id:
        chatId,

      photo:
        WELCOME_IMAGE,

      caption:
        welcomeCaption,

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


  notifiedUsers.add(
    chatId
  );
}


// ==================================================
// CALL API
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


  if (
    !response.ok
  ) {
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
  // HIGHLIGHT
  // ==================================================

  if (
    isHighlightResponse(data)
  ) {

    return {
      raw:
        data,

      type:
        "highlight",

      isReel:
        false,

      isStory:
        false,

      isHighlight:
        true,

      reelVideo:
        null,

      cover:
        isValidHttpUrl(
          data.highlight_cover
        )
          ? data.highlight_cover
          : null,

      caption:
        getCaption(data),

      media:
        extractHighlightItems(
          data
        )
    };
  }


  // ==================================================
  // STORY
  // ==================================================

  if (
    isStoryResponse(data)
  ) {

    return {
      raw:
        data,

      type:
        "story",

      isReel:
        false,

      isStory:
        true,

      isHighlight:
        false,

      reelVideo:
        null,

      cover:
        getCoverUrl(data),

      caption:
        getCaption(data),

      media:
        extractStoryMedia(
          data
        )
    };
  }


  // ==================================================
  // REEL
  // ==================================================

  if (
    isReelResponse(data)
  ) {

    return {
      raw:
        data,

      type:
        "reel",

      isReel:
        true,

      isStory:
        false,

      isHighlight:
        false,

      reelVideo:
        getReelVideo(data),

      cover:
        getCoverUrl(data),

      caption:
        getCaption(data),

      media:
        []
    };
  }


  // ==================================================
  // NORMAL POST / CAROUSEL
  // ==================================================

  return {
    raw:
      data,

    type:
      data.type ||
      "post",

    isReel:
      false,

    isStory:
      false,

    isHighlight:
      false,

    reelVideo:
      null,

    cover:
      getCoverUrl(data),

    caption:
      getCaption(data),

    media:
      extractMedia(data)
  };
}


// ==================================================
// HANDLE CALLBACK
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
    callbackQuery.data ||
    "";


  // ------------------------------------------------
  // ACKNOWLEDGE
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
  // EXPIRED
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
  // GET COVER
  // ==================================================

  if (
    action === "get_cover"
  ) {

    if (
      !stored.cover
    ) {

      await telegram(
        "sendMessage",
        {
          chat_id:
            chatId,

          text:
            `❌ <b>Cover photo is not available for this media.</b>`,

          parse_mode:
            "HTML"
        }
      );

      return;
    }


    try {

      // ------------------------------------------------
      // SEND COVER IMAGE
      // ------------------------------------------------

      await telegram(
        "sendPhoto",
        {
          chat_id:
            chatId,

          photo:
            stored.cover,

          caption:
            `🖼️ <b>Cover Photo</b>\n\n` +
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


      // ------------------------------------------------
      // FALLBACK TO URL
      // ------------------------------------------------

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
  // GET / OTHER REQUEST
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
        user.first_name ||
          "there"
      );


      return res
        .status(200)
        .json({
          ok: true
        });
    }


    // ==================================================
    // EMPTY MESSAGE
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
        // API
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


          if (!reelVideo) {
            throw new Error(
              "Reel detected but no video URL was found."
            );
          }


          // ------------------------------------------------
          // STORE REEL
          // ------------------------------------------------

          const storageId =
            storeMediaData({
              raw:
                result.raw,

              cover:
                reelCover,

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


          // ------------------------------------------------
          // SEND VIDEO ONLY
          //
          // COVER IS NOT SENT AUTOMATICALLY
          // ------------------------------------------------

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
                    !!reelCover
                  )
              }
            );

          } catch (mediaError) {

            console.error(
              "Reel send error:",
              mediaError
            );


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
                    !!reelCover
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
        // HIGHLIGHT / STORY / NORMAL MEDIA
        // ==================================================

        const media =
          result.media || [];


        // ------------------------------------------------
        // NO MEDIA
        // ------------------------------------------------

        if (
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
                  `The Instagram content may be private, unavailable, or unsupported.`,

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
        // HIGHLIGHT
        // ==================================================

        if (
          result.isHighlight
        ) {

          for (
            let i = 0;
            i < media.length;
            i++
          ) {

            const mediaItem =
              media[i];


            // ----------------------------------------------
            // STORE THIS SPECIFIC ITEM
            //
            // IMPORTANT:
            // Each highlight item has its own cover.
            // ----------------------------------------------

            const storageId =
              storeMediaData({
                raw:
                  mediaItem.data ||
                  result.raw,

                cover:
                  mediaItem.cover,

                isReel:
                  false,

                isStory:
                  true,

                isHighlight:
                  true,

                highlightTitle:
                  result.raw
                    ?.highlight_title ||
                  "",

                highlightIndex:
                  mediaItem.index
              });


            try {

              await sendMedia(
                chatId,

                mediaItem,

                {
                  storageId:
                    storageId,

                  caption:
                    i === 0
                      ? `⭐ <b>Highlight: ${
                          escapeHtml(
                            result.raw
                              ?.highlight_title ||
                            ""
                          )
                        }</b>\n\n` +
                        `📥 <b>Downloaded from Instadrop</b>`
                      : undefined
                }
              );

            } catch (mediaError) {

              console.error(
                "Highlight media error:",
                mediaError
              );


              await telegram(
                "sendMessage",
                {
                  chat_id:
                    chatId,

                  text:
                    `📥 <b>Highlight Item ${
                      i + 1
                    }:</b>\n\n` +
                    `${mediaItem.url}`,

                  parse_mode:
                    "HTML",

                  reply_markup:
                    buildMediaKeyboard(
                      storageId,
                      !!mediaItem.cover
                    )
                }
              );
            }
          }


          // ------------------------------------------------
          // HIGHLIGHT COMPLETE
          // ------------------------------------------------

          await telegram(
            "sendMessage",
            {
              chat_id:
                chatId,

              text:
                `✅ <b>Highlight downloaded!</b>\n\n` +
                `⭐ <b>${escapeHtml(
                  result.raw
                    ?.highlight_title ||
                  "Highlight"
                )}</b>\n` +
                `📦 ${media.length} media item${
                  media.length !== 1
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


          return res
            .status(200)
            .json({
              ok: true
            });
        }


        // ==================================================
        // STORY
        // ==================================================

        if (
          result.isStory
        ) {

          for (
            let i = 0;
            i < media.length;
            i++
          ) {

            const mediaItem =
              media[i];


            // ----------------------------------------------
            // STORE STORY ITEM
            //
            // This stores that item's cover.
            // ----------------------------------------------

            const storageId =
              storeMediaData({
                raw:
                  mediaItem.data ||
                  result.raw,

                cover:
                  mediaItem.cover,

                isReel:
                  false,

                isStory:
                  true,

                isHighlight:
                  false,

                storyIndex:
                  mediaItem.index
              });


            try {

              await sendMedia(
                chatId,

                mediaItem,

                {
                  storageId:
                    storageId,

                  caption:
                    i === 0
                      ? `📖 <b>Instagram Story</b>\n\n` +
                        `📥 <b>Downloaded from Instadrop</b>`
                      : undefined
                }
              );

            } catch (mediaError) {

              console.error(
                "Story media error:",
                mediaError
              );


              await telegram(
                "sendMessage",
                {
                  chat_id:
                    chatId,

                  text:
                    `📥 <b>Story Item ${
                      i + 1
                    }:</b>\n\n` +
                    `${mediaItem.url}`,

                  parse_mode:
                    "HTML",

                  reply_markup:
                    buildMediaKeyboard(
                      storageId,
                      !!mediaItem.cover
                    )
                }
              );
            }
          }


          // ------------------------------------------------
          // STORY COMPLETE
          // ------------------------------------------------

          await telegram(
            "sendMessage",
            {
              chat_id:
                chatId,

              text:
                `✅ <b>Story downloaded!</b>\n\n` +
                `📦 ${media.length} media item${
                  media.length !== 1
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


          return res
            .status(200)
            .json({
              ok: true
            });
        }


        // ==================================================
        // NORMAL POST / CAROUSEL
        // ==================================================

        for (
          let i = 0;
          i < media.length;
          i++
        ) {

          const mediaItem =
            media[i];


          // ------------------------------------------------
          // STORE MEDIA
          // ------------------------------------------------

          const storageId =
            storeMediaData({
              raw:
                result.raw,

              cover:
                mediaItem.cover,

              isReel:
                false,

              isStory:
                false,

              isHighlight:
                false
            });


          try {

            await sendMedia(
              chatId,

              mediaItem,

              {
                storageId:
                  storageId,

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


            await telegram(
              "sendMessage",
              {
                chat_id:
                  chatId,

                text:
                  `📥 <b>Download:</b>\n\n` +
                  `${mediaItem.url}`,

                parse_mode:
                  "HTML",

                reply_markup:
                  buildMediaKeyboard(
                    storageId,
                    !!mediaItem.cover
                  )
              }
            );
          }
        }


        // ==================================================
        // NORMAL COMPLETE
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
                `Please make sure the content is public and try again.`,

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
    // NOT INSTAGRAM URL
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
          `• Highlight\n` +
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

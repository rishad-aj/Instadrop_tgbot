const TELEGRAM_BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s";
const ADMIN_CHAT_ID = "7216371031";

const API_URL =
  "https://instadrop.rishu-rishad2019.workers.dev/?url=";

const WELCOME_IMAGE =
  "https://instadrop.web.app/og-image.png";

const WEBSITE_URL =
  "https://instadrop.web.app/";

// Temporary in-memory storage for callback buttons.
// Works as long as the same serverless instance is alive.
const mediaStorage = new Map();

// Notify admin only once per bot instance/user.
const notifiedUsers = new Set();

const STORAGE_TTL = 30 * 60 * 1000; // 30 minutes


// --------------------------------------------------
// TELEGRAM API
// --------------------------------------------------

async function telegram(method, payload) {
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `Telegram returned invalid JSON (${response.status})`
    );
  }

  if (!response.ok || !result.ok) {
    throw new Error(
      result?.description ||
        `Telegram API error (${response.status})`
    );
  }

  return result;
}


// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function isValidUrl(value) {
  return (
    typeof value === "string" &&
    /^https?:\/\//i.test(value)
  );
}


function cleanInstagramUrl(url) {
  if (!url) return null;

  return url
    .trim()
    .replace(/[)\]}>.,!?]+$/g, "");
}


function findInstagramUrl(text) {
  if (!text) return null;

  const match = text.match(
    /https?:\/\/(?:www\.)?instagram\.com\/[^\s]+/i
  );

  if (!match) return null;

  return cleanInstagramUrl(match[0]);
}


function normalizeUsername(username) {
  if (!username) return null;

  const value = String(username).trim();

  if (!value) return null;

  return value.startsWith("@")
    ? value
    : `@${value}`;
}


function createStorageId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}


function cleanupStorage() {
  const now = Date.now();

  for (const [id, item] of mediaStorage.entries()) {
    if (
      !item ||
      !item.createdAt ||
      now - item.createdAt > STORAGE_TTL
    ) {
      mediaStorage.delete(id);
    }
  }
}


function truncate(text, maxLength = 3500) {
  if (!text) return "";

  const value = String(text);

  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength - 3) + "...";
}


// --------------------------------------------------
// RESPONSE TYPE
// --------------------------------------------------

function getResponseType(data) {
  if (!data || typeof data !== "object") {
    return "post";
  }

  const type = String(
    data.type ||
      data.media_type ||
      data.mediaType ||
      ""
  ).toLowerCase();

  if (
    type === "highlight" ||
    type === "highlights"
  ) {
    return "highlight";
  }

  if (
    type === "story" ||
    type === "stories"
  ) {
    return "story";
  }

  if (
    type === "reel" ||
    type === "reels"
  ) {
    return "reel";
  }

  // Collections with items should not be treated as reels.
  if (Array.isArray(data.items)) {
    return "collection";
  }

  return "post";
}


// --------------------------------------------------
// REEL DETECTION
// --------------------------------------------------

function isReelResponse(data) {
  if (!data || typeof data !== "object") {
    return false;
  }

  const type = String(
    data.type ||
      data.media_type ||
      data.mediaType ||
      ""
  ).toLowerCase();

  // Never mistake stories/highlights for reels.
  if (
    type === "highlight" ||
    type === "highlights" ||
    type === "story" ||
    type === "stories"
  ) {
    return false;
  }

  if (Array.isArray(data.items)) {
    return false;
  }

  if (
    type === "reel" ||
    type === "reels"
  ) {
    return true;
  }

  if (
    Array.isArray(data.video) &&
    data.video.some(
      item =>
        item &&
        typeof item === "object" &&
        typeof item.video === "string"
    )
  ) {
    return true;
  }

  if (
    typeof data.video === "string" &&
    typeof data.cover === "string"
  ) {
    return true;
  }

  return false;
}


// --------------------------------------------------
// VIDEO / COVER HELPERS
// --------------------------------------------------

function getVideoUrlFromObject(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const url =
    item.video ||
    item.url ||
    item.download_url ||
    item.downloadUrl ||
    item.media_url ||
    item.mediaUrl ||
    item.video_url ||
    item.videoUrl;

  return isValidUrl(url) ? url : null;
}


function getCoverFromObject(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const cover =
    item.cover ||
    item.cover_url ||
    item.coverUrl ||
    item.thumbnail ||
    item.thumbnail_url ||
    item.thumbnailUrl ||
    item.thumb;

  return isValidUrl(cover) ? cover : null;
}


function getReelVideo(data) {
  if (!data) return null;

  if (Array.isArray(data.video)) {
    for (const item of data.video) {
      if (typeof item === "string") {
        if (isValidUrl(item)) {
          return item;
        }
      }

      if (item && typeof item === "object") {
        const url = getVideoUrlFromObject(item);

        if (url) {
          return url;
        }
      }
    }
  }

  if (isValidUrl(data.video)) {
    return data.video;
  }

  return null;
}


function getCoverUrl(data) {
  if (!data) return null;

  if (isValidUrl(data.cover)) {
    return data.cover;
  }

  if (isValidUrl(data.cover_url)) {
    return data.cover_url;
  }

  if (isValidUrl(data.coverUrl)) {
    return data.coverUrl;
  }

  if (Array.isArray(data.video)) {
    for (const item of data.video) {
      const cover = getCoverFromObject(item);

      if (cover) {
        return cover;
      }
    }
  }

  return null;
}


// --------------------------------------------------
// TOP-LEVEL HIGHLIGHT / STORY COVER
// --------------------------------------------------

function getCollectionCover(data, responseType) {
  if (!data) return null;

  if (responseType === "highlight") {
    const highlightCover =
      data.highlight_cover ||
      data.highlightCover;

    return isValidUrl(highlightCover)
      ? highlightCover
      : null;
  }

  if (responseType === "story") {
    const storyCover =
      data.story_cover ||
      data.storyCover ||
      data.cover;

    return isValidUrl(storyCover)
      ? storyCover
      : null;
  }

  return null;
}


// --------------------------------------------------
// MEDIA EXTRACTION
// --------------------------------------------------

function extractMediaItems(data) {
  const results = [];

  if (!data || typeof data !== "object") {
    return results;
  }


  // ----------------------------------------------
  // Collections such as highlights
  // ----------------------------------------------

  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      const nested = extractMediaItems(item);

      for (const media of nested) {
        results.push(media);
      }
    }

    return results;
  }


  // ----------------------------------------------
  // Images
  // ----------------------------------------------

  if (Array.isArray(data.image)) {
    for (const image of data.image) {
      if (typeof image === "string") {
        if (isValidUrl(image)) {
          results.push({
            url: image,
            type: "photo",
            cover: null
          });
        }

        continue;
      }

      if (image && typeof image === "object") {
        const imageUrl =
          image.image ||
          image.url ||
          image.media_url ||
          image.mediaUrl;

        if (isValidUrl(imageUrl)) {
          results.push({
            url: imageUrl,
            type: "photo",
            cover: getCoverFromObject(image)
          });
        }
      }
    }
  }


  // ----------------------------------------------
  // Videos
  // ----------------------------------------------

  if (Array.isArray(data.video)) {
    for (const video of data.video) {
      if (typeof video === "string") {
        if (isValidUrl(video)) {
          results.push({
            url: video,
            type: "video",
            cover: null
          });
        }

        continue;
      }

      if (video && typeof video === "object") {
        const videoUrl = getVideoUrlFromObject(video);

        if (videoUrl) {
          results.push({
            url: videoUrl,
            type: "video",
            cover: getCoverFromObject(video)
          });
        }
      }
    }
  }


  // ----------------------------------------------
  // Single video string
  // ----------------------------------------------

  if (
    typeof data.video === "string" &&
    isValidUrl(data.video)
  ) {
    results.push({
      url: data.video,
      type: "video",
      cover: getCoverUrl(data)
    });
  }


  // ----------------------------------------------
  // Single image string
  // ----------------------------------------------

  if (
    typeof data.image === "string" &&
    isValidUrl(data.image)
  ) {
    results.push({
      url: data.image,
      type: "photo",
      cover: getCoverUrl(data)
    });
  }


  return results;
}


// --------------------------------------------------
// STORAGE
// --------------------------------------------------

function storeMedia({
  cover = null,
  data = null,
  parent = null,
  kind = "media"
}) {
  cleanupStorage();

  const id = createStorageId();

  mediaStorage.set(id, {
    cover: isValidUrl(cover) ? cover : null,
    data,
    parent,
    kind,
    createdAt: Date.now()
  });

  return id;
}


// --------------------------------------------------
// INLINE KEYBOARD
// --------------------------------------------------

function buildMediaKeyboard(
  storageId,
  hasCover = false
) {
  const buttons = [];

  if (hasCover) {
    buttons.push([
      {
        text: "🖼️ Get Cover Photo",
        callback_data: `get_cover:${storageId}`
      }
    ]);
  }

  buttons.push([
    {
      text: "📋 Get Details",
      callback_data: `get_details:${storageId}`
    }
  ]);

  return {
    inline_keyboard: buttons
  };
}


// --------------------------------------------------
// DETAILS
// --------------------------------------------------

function formatDetails(data, parent = null) {
  if (!data || typeof data !== "object") {
    return "No details available.";
  }

  const lines = [];

  const parentType =
    parent &&
    getResponseType(parent);

  if (parentType === "highlight") {
    const title =
      parent.highlight_title ||
      "Untitled";

    lines.push(`✨ Highlight: ${title}`);
  }

  if (parentType === "story") {
    lines.push("📖 Story");
  }


  // Username
  const username =
    normalizeUsername(
      data.username ||
        data.user ||
        data.author
    );

  if (username) {
    lines.push(`👤 Username: ${username}`);
  }


  // Caption
  if (data.caption) {
    lines.push("");
    lines.push("📝 Caption:");
    lines.push(
      truncate(data.caption, 2500)
    );
  }


  // Date
  if (data.taken_at) {
    lines.push("");
    lines.push(
      `📅 Taken: ${data.taken_at}`
    );
  }


  // Counts
  if (
    data.like_count !== undefined &&
    data.like_count !== null
  ) {
    lines.push(
      `❤️ Likes: ${data.like_count}`
    );
  }

  if (
    data.comment_count !== undefined &&
    data.comment_count !== null
  ) {
    lines.push(
      `💬 Comments: ${data.comment_count}`
    );
  }

  if (
    data.view_count !== undefined &&
    data.view_count !== null &&
    Number(data.view_count) > 0
  ) {
    lines.push(
      `👀 Views: ${data.view_count}`
    );
  }

  if (
    data.play_count !== undefined &&
    data.play_count !== null &&
    Number(data.play_count) > 0
  ) {
    lines.push(
      `▶️ Plays: ${data.play_count}`
    );
  }

  if (
    data.reshare_count !== undefined &&
    data.reshare_count !== null &&
    Number(data.reshare_count) > 0
  ) {
    lines.push(
      `🔁 Reshares: ${data.reshare_count}`
    );
  }


  // Highlight information
  if (
    parentType === "highlight" &&
    parent.count !== undefined
  ) {
    lines.push(
      `📦 Highlight Items: ${parent.count}`
    );
  }


  // Story/highlight item count
  if (Array.isArray(data.items)) {
    lines.push(
      `📦 Items: ${data.items.length}`
    );
  }


  // API creator/watermark
  if (data.made_by) {
    lines.push("");
    lines.push(
      `⚙️ ${data.made_by}`
    );
  }


  // IMPORTANT:
  // "owner" is intentionally NOT displayed.
  // It is your API watermark field and stays hidden.


  return truncate(
    lines.join("\n"),
    3900
  );
}


// --------------------------------------------------
// SEND MEDIA
// --------------------------------------------------

async function sendMedia(
  chatId,
  media,
  data,
  parent = null
) {
  const storageId = storeMedia({
    cover: media.cover,
    data,
    parent,
    kind: "media"
  });

  const keyboard = buildMediaKeyboard(
    storageId,
    Boolean(media.cover)
  );

  const caption =
    "📥 Downloaded from Instadrop";

  if (media.type === "video") {
    try {
      await telegram("sendVideo", {
        chat_id: chatId,
        video: media.url,
        caption,
        supports_streaming: true,
        reply_markup: keyboard
      });

      return;
    } catch (videoError) {
      console.error(
        "sendVideo failed:",
        videoError.message
      );

      // Fallback to document.
      try {
        await telegram("sendDocument", {
          chat_id: chatId,
          document: media.url,
          caption,
          reply_markup: keyboard
        });

        return;
      } catch (documentError) {
        console.error(
          "sendDocument video fallback failed:",
          documentError.message
        );
      }
    }
  }


  // Photo
  try {
    await telegram("sendPhoto", {
      chat_id: chatId,
      photo: media.url,
      caption,
      reply_markup: keyboard
    });
  } catch (photoError) {
    console.error(
      "sendPhoto failed:",
      photoError.message
    );

    // Useful fallback for HEIC/WEBP/etc.
    await telegram("sendDocument", {
      chat_id: chatId,
      document: media.url,
      caption,
      reply_markup: keyboard
    });
  }
}


// --------------------------------------------------
// SEND HIGHLIGHT / STORY HEADER
// --------------------------------------------------

async function sendCollectionHeader(
  chatId,
  data,
  responseType
) {
  const username =
    normalizeUsername(
      data.username
    );

  const lines = [];

  if (responseType === "highlight") {
    lines.push(
      `✨ Highlight: ${
        data.highlight_title || "Untitled"
      }`
    );
  } else if (responseType === "story") {
    lines.push("📖 Story");
  }

  if (username) {
    lines.push(`👤 ${username}`);
  }

  if (
    data.count !== undefined &&
    data.count !== null
  ) {
    lines.push(
      `📦 Items: ${data.count}`
    );
  } else if (Array.isArray(data.items)) {
    lines.push(
      `📦 Items: ${data.items.length}`
    );
  }


  const collectionCover =
    getCollectionCover(
      data,
      responseType
    );

  let replyMarkup;

  if (collectionCover) {
    const storageId = storeMedia({
      cover: collectionCover,
      data,
      parent: null,
      kind: "collection_cover"
    });

    replyMarkup =
      buildMediaKeyboard(
        storageId,
        true
      );
  }


  await telegram("sendMessage", {
    chat_id: chatId,
    text: lines.join("\n"),
    ...(replyMarkup
      ? { reply_markup: replyMarkup }
      : {})
  });
}


// --------------------------------------------------
// ADMIN NOTIFICATION
// --------------------------------------------------

async function notifyAdmin(
  chatId,
  user
) {
  const key = String(chatId);

  if (notifiedUsers.has(key)) {
    return;
  }

  notifiedUsers.add(key);

  const firstName =
    user?.first_name ||
    "Unknown";

  const username =
    normalizeUsername(
      user?.username
    );

  const lines = [
    "👤 New Instadrop user",
    "",
    `Chat ID: ${chatId}`,
    `Name: ${firstName}`
  ];

  if (username) {
    lines.push(
      `Username: ${username}`
    );
  }

  try {
    await telegram("sendMessage", {
      chat_id: ADMIN_CHAT_ID,
      text: lines.join("\n")
    });
  } catch (error) {
    console.error(
      "Admin notification failed:",
      error.message
    );
  }
}


// --------------------------------------------------
// START / WELCOME
// --------------------------------------------------

async function sendWelcome(
  chatId
) {
  try {
    await telegram("sendPhoto", {
      chat_id: chatId,
      photo: WELCOME_IMAGE,
      caption:
        "🚀 Welcome to InstaDrop!\n\nSend me an Instagram post, reel, story, or highlight link and I'll download the media for you.",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🌐 Open InstaDrop",
              url: WEBSITE_URL
            }
          ]
        ]
      }
    });
  } catch (error) {
    console.error(
      "Welcome image failed:",
      error.message
    );

    await telegram("sendMessage", {
      chat_id: chatId,
      text:
        "🚀 Welcome to InstaDrop!\n\nSend me an Instagram post, reel, story, or highlight link and I'll download the media for you.",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🌐 Open InstaDrop",
              url: WEBSITE_URL
            }
          ]
        ]
      }
    });
  }
}


// --------------------------------------------------
// CALLBACK HANDLER
// --------------------------------------------------

async function handleCallback(
  callback
) {
  const callbackId =
    callback.id;

  const chatId =
    callback.message?.chat?.id;

  const callbackData =
    callback.data || "";

  try {
    await telegram(
      "answerCallbackQuery",
      {
        callback_query_id:
          callbackId
      }
    );
  } catch (error) {
    console.error(
      "answerCallbackQuery failed:",
      error.message
    );
  }


  if (!chatId) {
    return;
  }


  // ----------------------------------------------
  // GET COVER
  // ----------------------------------------------

  if (
    callbackData.startsWith(
      "get_cover:"
    )
  ) {
    const storageId =
      callbackData.slice(
        "get_cover:".length
      );

    cleanupStorage();

    const stored =
      mediaStorage.get(storageId);

    if (
      !stored ||
      !stored.cover
    ) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          "❌ Sorry, the cover image is no longer available."
      });

      return;
    }

    try {
      await telegram("sendPhoto", {
        chat_id: chatId,
        photo: stored.cover
      });
    } catch (error) {
      console.error(
        "Cover send failed:",
        error.message
      );

      // Fallback to document if Telegram
      // doesn't accept the image URL.
      try {
        await telegram("sendDocument", {
          chat_id: chatId,
          document: stored.cover
        });
      } catch (fallbackError) {
        console.error(
          "Cover document fallback failed:",
          fallbackError.message
        );

        await telegram("sendMessage", {
          chat_id: chatId,
          text:
            "❌ Unable to send the cover image."
        });
      }
    }

    return;
  }


  // ----------------------------------------------
  // GET DETAILS
  // ----------------------------------------------

  if (
    callbackData.startsWith(
      "get_details:"
    )
  ) {
    const storageId =
      callbackData.slice(
        "get_details:".length
      );

    cleanupStorage();

    const stored =
      mediaStorage.get(storageId);

    if (!stored) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          "❌ Sorry, these details are no longer available."
      });

      return;
    }

    const details =
      formatDetails(
        stored.data,
        stored.parent
      );

    await telegram("sendMessage", {
      chat_id: chatId,
      text: details
    });

    return;
  }
}


// --------------------------------------------------
// INSTAGRAM PROCESSING
// --------------------------------------------------

async function processInstagramUrl(
  chatId,
  instagramUrl
) {
  await telegram("sendMessage", {
    chat_id: chatId,
    text: "⏳ Downloading..."
  });


  let response;

  try {
    response = await fetch(
      API_URL +
        encodeURIComponent(
          instagramUrl
        ),
      {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        signal:
          AbortSignal.timeout(60000)
      }
    );
  } catch (error) {
    console.error(
      "API request failed:",
      error.message
    );

    await telegram("sendMessage", {
      chat_id: chatId,
      text:
        "❌ Could not connect to the download API. Please try again."
    });

    return;
  }


  let data;

  try {
    data = await response.json();
  } catch {
    await telegram("sendMessage", {
      chat_id: chatId,
      text:
        "❌ The download API returned an invalid response."
    });

    return;
  }


  if (!response.ok) {
    console.error(
      "API HTTP error:",
      response.status,
      data
    );

    await telegram("sendMessage", {
      chat_id: chatId,
      text:
        "❌ The download failed. Please try again."
    });

    return;
  }


  if (
    data &&
    data.p === false
  ) {
    const message =
      data.message ||
      data.error ||
      "Unable to download this Instagram content.";

    await telegram("sendMessage", {
      chat_id: chatId,
      text: `❌ ${message}`
    });

    return;
  }


  const responseType =
    getResponseType(data);


  // ==================================================
  // REEL
  // ==================================================

  if (
    responseType === "reel" ||
    isReelResponse(data)
  ) {
    const videoUrl =
      getReelVideo(data);

    if (!videoUrl) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          "❌ No reel video was found."
      });

      return;
    }

    const cover =
      getCoverUrl(data);

    await sendMedia(
      chatId,
      {
        url: videoUrl,
        type: "video",
        cover
      },
      data,
      null
    );

    return;
  }


  // ==================================================
  // HIGHLIGHT
  // ==================================================

  if (
    responseType === "highlight"
  ) {
    // Send highlight information first.
    // The highlight cover is NOT automatically
    // downloaded. It is available through a button.
    await sendCollectionHeader(
      chatId,
      data,
      "highlight"
    );


    const items =
      extractMediaItems(data);

    if (!items.length) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          "❌ No media was found in this highlight."
      });

      return;
    }


    // Send every highlight item.
    for (
      let index = 0;
      index < items.length;
      index++
    ) {
      const media =
        items[index];

      // Find the original item so that
      // its own caption/details are preserved.
      let itemData = null;

      if (
        Array.isArray(data.items) &&
        data.items[index]
      ) {
        itemData =
          data.items[index];
      }

      if (!itemData) {
        itemData = {
          username:
            data.username,
          media
        };
      }

      await sendMedia(
        chatId,
        media,
        itemData,
        data
      );
    }

    return;
  }


  // ==================================================
  // STORY
  // ==================================================

  if (
    responseType === "story"
  ) {
    // If the story has a top-level cover,
    // it is available through a button.
    // It is NOT automatically sent.
    await sendCollectionHeader(
      chatId,
      data,
      "story"
    );


    const items =
      extractMediaItems(data);

    if (!items.length) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          "❌ No media was found in this story."
      });

      return;
    }


    // Send every story item.
    for (
      let index = 0;
      index < items.length;
      index++
    ) {
      const media =
        items[index];

      let itemData = null;

      if (
        Array.isArray(data.items) &&
        data.items[index]
      ) {
        itemData =
          data.items[index];
      }

      if (!itemData) {
        itemData = data;
      }

      await sendMedia(
        chatId,
        media,
        itemData,
        data
      );
    }

    return;
  }


  // ==================================================
  // NORMAL POST / CAROUSEL
  // ==================================================

  const mediaItems =
    extractMediaItems(data);

  if (!mediaItems.length) {
    await telegram("sendMessage", {
      chat_id: chatId,
      text:
        "❌ No downloadable media was found."
    });

    return;
  }


  // Carousel and normal posts.
  // Images/videos are identified directly from
  // their API fields, so .heic/.webp/etc URLs
  // do not cause the media type to be guessed.
  for (const media of mediaItems) {
    await sendMedia(
      chatId,
      media,
      data,
      null
    );
  }
}


// --------------------------------------------------
// MAIN VERCEL WEBHOOK
// --------------------------------------------------

export default async function handler(
  req,
  res
) {
  if (req.method !== "POST") {
    return res.status(200).json({
      ok: true,
      message:
        "InstaDrop Telegram bot is running."
    });
  }


  try {
    const update =
      req.body || {};


    // ----------------------------------------------
    // CALLBACK BUTTON
    // ----------------------------------------------

    if (update.callback_query) {
      await handleCallback(
        update.callback_query
      );

      return res.status(200).json({
        ok: true
      });
    }


    // ----------------------------------------------
    // NORMAL MESSAGE
    // ----------------------------------------------

    if (!update.message) {
      return res.status(200).json({
        ok: true
      });
    }


    const message =
      update.message;

    const chatId =
      message.chat?.id;

    if (!chatId) {
      return res.status(200).json({
        ok: true
      });
    }


    // Notify admin about new user.
    await notifyAdmin(
      chatId,
      message.from
    );


    const text =
      message.text ||
      message.caption ||
      "";


    // ----------------------------------------------
    // /start
    // ----------------------------------------------

    if (
      text === "/start" ||
      text.startsWith("/start ")
    ) {
      await sendWelcome(
        chatId
      );

      return res.status(200).json({
        ok: true
      });
    }


    // ----------------------------------------------
    // /help
    // ----------------------------------------------

    if (
      text === "/help" ||
      text.startsWith("/help ")
    ) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          "📥 Send me an Instagram post, carousel, reel, story, or highlight link and I'll download it for you."
      });

      return res.status(200).json({
        ok: true
      });
    }


    // ----------------------------------------------
    // FIND INSTAGRAM URL
    // ----------------------------------------------

    const instagramUrl =
      findInstagramUrl(text);


    if (!instagramUrl) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          "📎 Please send a valid Instagram link."
      });

      return res.status(200).json({
        ok: true
      });
    }


    // ----------------------------------------------
    // DOWNLOAD
    // ----------------------------------------------

    await processInstagramUrl(
      chatId,
      instagramUrl
    );


    return res.status(200).json({
      ok: true
    });
  } catch (error) {
    console.error(
      "Webhook error:",
      error
    );

    try {
      if (req.body?.message?.chat?.id) {
        await telegram("sendMessage", {
          chat_id:
            req.body.message.chat.id,
          text:
            "❌ Something went wrong while processing your request. Please try again."
        });
      }
    } catch (telegramError) {
      console.error(
        "Error message failed:",
        telegramError.message
      );
    }

    return res.status(200).json({
      ok: true
    });
  }
}

// ==================================================
// ENVIRONMENT VARIABLES
// ==================================================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const API_KEY = process.env.API_KEY;

const API_URL =
  "https://instadrop.rishu-rishad2019.workers.dev/?url=";

const WELCOME_IMAGE =
  "https://instadrop.web.app/og-image.png";

const WEBSITE_URL =
  "https://instadrop.web.app/";


// ==================================================
// TEMPORARY STORAGE
// ==================================================

const mediaStorage = new Map();

const notifiedUsers = new Set();

const STORAGE_TTL = 30 * 60 * 1000;


// ==================================================
// TELEGRAM API
// ==================================================

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


// ==================================================
// BASIC HELPERS
// ==================================================

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
    Math.random()
      .toString(36)
      .slice(2, 8)
  );
}


function truncate(text, maxLength = 3900) {
  if (!text) return "";

  const value = String(text);

  if (value.length <= maxLength) {
    return value;
  }

  return (
    value.slice(0, maxLength - 3) +
    "..."
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


// ==================================================
// RESPONSE TYPE
// ==================================================

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

  // Highlight
  if (
    type === "highlight" ||
    type === "highlights"
  ) {
    return "highlight";
  }

  // Story
  if (
    type === "story" ||
    type === "stories"
  ) {
    return "story";
  }

  // Reel
  if (
    type === "reel" ||
    type === "reels"
  ) {
    return "reel";
  }

  // A response containing items is treated
  // as a collection instead of a reel.
  if (Array.isArray(data.items)) {
    return "collection";
  }

  return "post";
}


// ==================================================
// REEL DETECTION
// ==================================================

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

  // NEVER classify highlights/stories as reels.
  if (
    type === "highlight" ||
    type === "highlights" ||
    type === "story" ||
    type === "stories"
  ) {
    return false;
  }

  // Collections are not reels.
  if (Array.isArray(data.items)) {
    return false;
  }

  if (
    type === "reel" ||
    type === "reels"
  ) {
    return true;
  }

  // Current Reel API format.
  if (
    Array.isArray(data.video) &&
    data.video.some(
      item =>
        item &&
        typeof item === "object" &&
        (
          typeof item.video === "string" ||
          typeof item.url === "string"
        )
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


// ==================================================
// VIDEO HELPERS
// ==================================================

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
    item.videoUrl ||
    item.src;

  return isValidUrl(url)
    ? url
    : null;
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
    item.thumb ||
    item.poster ||
    item.poster_url ||
    item.posterUrl;

  return isValidUrl(cover)
    ? cover
    : null;
}


function getReelVideo(data) {
  if (!data) return null;

  // Array of videos
  if (Array.isArray(data.video)) {
    for (const item of data.video) {
      if (typeof item === "string") {
        if (isValidUrl(item)) {
          return item;
        }
      }

      if (
        item &&
        typeof item === "object"
      ) {
        const url =
          getVideoUrlFromObject(item);

        if (url) {
          return url;
        }
      }
    }
  }

  // Single video object
  if (
    data.video &&
    typeof data.video === "object"
  ) {
    const url =
      getVideoUrlFromObject(
        data.video
      );

    if (url) {
      return url;
    }
  }

  // Single video string
  if (
    typeof data.video === "string" &&
    isValidUrl(data.video)
  ) {
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

  // Video array
  if (Array.isArray(data.video)) {
    for (const item of data.video) {
      const cover =
        getCoverFromObject(item);

      if (cover) {
        return cover;
      }
    }
  }

  // Single video object
  if (
    data.video &&
    typeof data.video === "object"
  ) {
    const cover =
      getCoverFromObject(
        data.video
      );

    if (cover) {
      return cover;
    }
  }

  return null;
}


// ==================================================
// COLLECTION COVER
// ==================================================

function getCollectionCover(
  data,
  responseType
) {
  if (!data) return null;

  // Highlight cover
  if (
    responseType === "highlight"
  ) {
    const cover =
      data.highlight_cover ||
      data.highlightCover;

    return isValidUrl(cover)
      ? cover
      : null;
  }

  // Story cover
  if (
    responseType === "story"
  ) {
    const cover =
      data.story_cover ||
      data.storyCover ||
      data.cover;

    return isValidUrl(cover)
      ? cover
      : null;
  }

  return null;
}


// ==================================================
// MEDIA EXTRACTION
// ==================================================

function extractMediaItems(data) {
  const results = [];

  if (
    !data ||
    typeof data !== "object"
  ) {
    return results;
  }

  // ----------------------------------------------
  // NESTED ITEMS
  // ----------------------------------------------

  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      if (
        !item ||
        typeof item !== "object"
      ) {
        continue;
      }

      const nested =
        extractMediaItems(item);

      for (const media of nested) {
        results.push(media);
      }
    }
  }

  // ----------------------------------------------
  // IMAGE ARRAY
  // ----------------------------------------------

  if (Array.isArray(data.image)) {
    for (const image of data.image) {
      // image: "https://..."
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

      // image: { url: "..." }
      if (
        image &&
        typeof image === "object"
      ) {
        const imageUrl =
          image.image ||
          image.url ||
          image.media_url ||
          image.mediaUrl ||
          image.src;

        if (isValidUrl(imageUrl)) {
          results.push({
            url: imageUrl,
            type: "photo",
            cover:
              getCoverFromObject(image)
          });
        }
      }
    }
  }

  // ----------------------------------------------
  // SINGLE IMAGE STRING
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

  // ----------------------------------------------
  // SINGLE IMAGE OBJECT
  // ----------------------------------------------

  if (
    data.image &&
    typeof data.image === "object" &&
    !Array.isArray(data.image)
  ) {
    const imageUrl =
      data.image.image ||
      data.image.url ||
      data.image.media_url ||
      data.image.mediaUrl ||
      data.image.src;

    if (isValidUrl(imageUrl)) {
      results.push({
        url: imageUrl,
        type: "photo",
        cover:
          getCoverFromObject(data.image)
      });
    }
  }

  // ----------------------------------------------
  // VIDEO ARRAY
  // ----------------------------------------------

  if (Array.isArray(data.video)) {
    for (const video of data.video) {
      // video: "https://..."
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

      // video: { video: "...", cover: "..." }
      if (
        video &&
        typeof video === "object"
      ) {
        const videoUrl =
          getVideoUrlFromObject(video);

        if (videoUrl) {
          results.push({
            url: videoUrl,
            type: "video",
            cover:
              getCoverFromObject(video)
          });
        }
      }
    }
  }

  // ----------------------------------------------
  // SINGLE VIDEO OBJECT
  // ----------------------------------------------

  if (
    data.video &&
    typeof data.video === "object" &&
    !Array.isArray(data.video)
  ) {
    const videoUrl =
      getVideoUrlFromObject(
        data.video
      );

    if (videoUrl) {
      results.push({
        url: videoUrl,
        type: "video",
        cover:
          getCoverFromObject(
            data.video
          )
      });
    }
  }

  // ----------------------------------------------
  // SINGLE VIDEO STRING
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

  return results;
}


// ==================================================
// STORAGE
// ==================================================

function storeMedia({
  cover = null,
  data = null,
  parent = null,
  kind = "media"
}) {
  cleanupStorage();

  const id =
    createStorageId();

  mediaStorage.set(id, {
    cover:
      isValidUrl(cover)
        ? cover
        : null,

    data,

    parent,

    kind,

    createdAt: Date.now()
  });

  return id;
}


// ==================================================
// BUTTONS
// ==================================================

function buildMediaKeyboard(
  storageId,
  hasCover
) {
  const buttons = [];


  if (hasCover) {
    buttons.push([
      {
        text: "🖼️ Get Cover Photo",
        callback_data:
          `get_cover:${storageId}`
      }
    ]);
  }


  buttons.push([
    {
      text: "📋 Get Details",
      callback_data:
        `get_details:${storageId}`
    }
  ]);


  return {
    inline_keyboard: buttons
  };
}


// ==================================================
// DETAILS
// ==================================================

function formatDetails(
  data,
  parent = null
) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return "ℹ️ No additional details are available for this media.";
  }

  const lines = [];


  // Parent highlight
  if (
    parent &&
    getResponseType(parent) ===
      "highlight"
  ) {
    lines.push(
      `✨ Highlight: ${
        parent.highlight_title ||
        "Untitled"
      }`
    );
  }


  // Parent story
  if (
    parent &&
    getResponseType(parent) ===
      "story"
  ) {
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
    lines.push(
      `👤 Username: ${username}`
    );
  }

  // Full name (for profile)
  if (data.full_name) {
    lines.push(
      `📛 Name: ${data.full_name}`
    );
  }

  // Bio (for profile)
  if (data.bio) {
    lines.push("");
    lines.push("📝 Bio:");
    lines.push(
      truncate(data.bio, 1000)
    );
  }

  // Follower count (for profile)
  if (
    data.follower_count !== undefined &&
    data.follower_count !== null
  ) {
    lines.push(
      `👥 Followers: ${data.follower_count}`
    );
  }

  // Following count (for profile)
  if (
    data.following_count !== undefined &&
    data.following_count !== null
  ) {
    lines.push(
      `👤 Following: ${data.following_count}`
    );
  }

  // Post count (for profile)
  if (
    data.post_count !== undefined &&
    data.post_count !== null
  ) {
    lines.push(
      `📦 Posts: ${data.post_count}`
    );
  }

  // Verified (for profile)
  if (data.is_verified) {
    lines.push("✅ Verified");
  }

  // Private (for profile)
  if (data.is_private) {
    lines.push("🔒 Private Account");
  }


  // Caption
  if (data.caption) {
    lines.push("");
    lines.push("📝 Caption:");
    lines.push(
      truncate(
        data.caption,
        2500
      )
    );
  }


  // Taken date
  if (data.taken_at) {
    lines.push("");
    lines.push(
      `📅 Taken: ${data.taken_at}`
    );
  }


  // Likes
  if (
    data.like_count !==
      undefined &&
    data.like_count !== null
  ) {
    lines.push(
      `❤️ Likes: ${data.like_count}`
    );
  }


  // Comments
  if (
    data.comment_count !==
      undefined &&
    data.comment_count !== null
  ) {
    lines.push(
      `💬 Comments: ${data.comment_count}`
    );
  }


  // Views
  if (
    data.view_count !==
      undefined &&
    data.view_count !== null &&
    Number(data.view_count) > 0
  ) {
    lines.push(
      `👀 Views: ${data.view_count}`
    );
  }


  // Plays
  if (
    data.play_count !==
      undefined &&
    data.play_count !== null &&
    Number(data.play_count) > 0
  ) {
    lines.push(
      `▶️ Plays: ${data.play_count}`
    );
  }


  // Reshares
  if (
    data.reshare_count !==
      undefined &&
    data.reshare_count !== null &&
    Number(data.reshare_count) > 0
  ) {
    lines.push(
      `🔁 Reshares: ${data.reshare_count}`
    );
  }


  // Highlight item count
  if (
    parent &&
    getResponseType(parent) ===
      "highlight" &&
    parent.count !==
      undefined
  ) {
    lines.push(
      `📦 Highlight Items: ${parent.count}`
    );
  }


  // Collection item count
  if (Array.isArray(data.items)) {
    lines.push(
      `📦 Items: ${data.items.length}`
    );
  }


  // API watermark
  if (data.made_by) {
    lines.push("");
    lines.push(
      `⚙️ ${data.made_by}`
    );
  }


  return truncate(
    lines.join("\n"),
    3900
  );
}


// ==================================================
// SEND MEDIA
// ==================================================

async function sendMedia(
  chatId,
  media,
  data,
  parent = null
) {
  if (
    !media ||
    !isValidUrl(media.url)
  ) {
    return;
  }


  const storageId =
    storeMedia({
      cover: media.cover,
      data,
      parent,
      kind: "media"
    });


  const keyboard =
    buildMediaKeyboard(
      storageId,
      Boolean(media.cover)
    );


  const caption =
    "✅ *Download ready!*\n\n" +
    "📥 Delivered by *instadrop*";


  // ----------------------------------------------
  // VIDEO
  // ----------------------------------------------

  if (
    media.type === "video"
  ) {
    try {
      await telegram(
        "sendVideo",
        {
          chat_id: chatId,
          video: media.url,
          caption,
          parse_mode: "Markdown",
          supports_streaming: true,
          reply_markup: keyboard
        }
      );

      return;
    } catch (error) {
      console.error(
        "sendVideo failed:",
        error.message
      );


      // Fallback
      try {
        await telegram(
          "sendDocument",
          {
            chat_id: chatId,
            document: media.url,
            caption,
            parse_mode: "Markdown",
            reply_markup: keyboard
          }
        );

        return;
      } catch (fallbackError) {
        console.error(
          "Video document fallback failed:",
          fallbackError.message
        );
      }
    }
  }


  // ----------------------------------------------
  // PHOTO
  // ----------------------------------------------

  try {
    await telegram(
      "sendPhoto",
      {
        chat_id: chatId,
        photo: media.url,
        caption,
        parse_mode: "Markdown",
        reply_markup: keyboard
      }
    );
  } catch (error) {
    console.error(
      "sendPhoto failed:",
      error.message
    );


    // Fallback for formats such as WEBP/HEIC.
    try {
      await telegram(
        "sendDocument",
        {
          chat_id: chatId,
          document: media.url,
          caption,
          parse_mode: "Markdown",
          reply_markup: keyboard
        }
      );
    } catch (fallbackError) {
      console.error(
        "Photo document fallback failed:",
        fallbackError.message
      );

      await telegram(
        "sendMessage",
        {
          chat_id: chatId,
          text:
            "⚠️ *Media found, but Telegram couldn't deliver it.*\n\n" +
            "Please try sending the Instagram link again.",
          parse_mode: "Markdown"
        }
      );
    }
  }
}


// ==================================================
// COLLECTION HEADER
// ==================================================

async function sendCollectionHeader(
  chatId,
  data,
  responseType
) {
  const lines = [];


  // ----------------------------------------------
  // HIGHLIGHT
  // ----------------------------------------------

  if (
    responseType === "highlight"
  ) {
    lines.push(
      `✨ *Highlight:* ${
        data.highlight_title ||
        "Untitled"
      }`
    );
  }


  // ----------------------------------------------
  // STORY
  // ----------------------------------------------

  if (
    responseType === "story"
  ) {
    lines.push("📖 *Story*");
  }


  // Username
  const username =
    normalizeUsername(
      data.username
    );

  if (username) {
    lines.push(
      `👤 ${username}`
    );
  }


  // Count
  if (
    data.count !== undefined &&
    data.count !== null
  ) {
    lines.push(
      `📦 *Items:* ${data.count}`
    );
  } else if (
    Array.isArray(data.items)
  ) {
    lines.push(
      `📦 *Items:* ${data.items.length}`
    );
  }


  // ----------------------------------------------
  // COLLECTION COVER
  // ----------------------------------------------

  const collectionCover =
    getCollectionCover(
      data,
      responseType
    );


  let replyMarkup = null;


  if (collectionCover) {
    const storageId =
      storeMedia({
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
  } else {
    // No cover — still add a details button
    const storageId =
      storeMedia({
        cover: null,
        data,
        parent: null,
        kind: "collection"
      });

    replyMarkup =
      buildMediaKeyboard(
        storageId,
        false
      );
  }


  await telegram(
    "sendMessage",
    {
      chat_id: chatId,
      text: lines.join("\n"),
      parse_mode: "Markdown",
      reply_markup: replyMarkup
    }
  );
}


// ==================================================
// ADMIN NOTIFICATION
// ==================================================

async function notifyAdmin(
  chatId,
  user
) {
  const key =
    String(chatId);


  if (
    notifiedUsers.has(key)
  ) {
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
    "👤 *New instadrop user*",
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
    await telegram(
      "sendMessage",
      {
        chat_id: ADMIN_CHAT_ID,
        text: lines.join("\n"),
        parse_mode: "Markdown"
      }
    );
  } catch (error) {
    console.error(
      "Admin notification failed:",
      error.message
    );
  }
}


// ==================================================
// WELCOME
// ==================================================

async function sendWelcome(
  chatId
) {
  const welcomeCaption =
    "🚀 *Welcome to instadrop!*\n\n" +

    "Your simple and fast Instagram downloader.\n\n" +

    "*What can I download?*\n" +
    "• \"Posts\"\n" +
    "• \"Carousels\"\n" +
    "• \"Reels\"\n" +
    "• \"Stories\"\n" +
    "• \"Highlights\"\n" +
    "• \"Profiles\"\n\n" +

    "*Profile support*\n" +
    "• Profile picture\n" +
    "• Account details\n" +
    "• Followers & following\n" +
    "• Post count\n" +
    "• Name & bio\n" +
    "• Verification status\n" +
    "• Private account status\n\n" +

    "*Media details*\n" +
    "• Username\n" +
    "• Caption\n" +
    "• Upload date\n" +
    "• Likes\n" +
    "• Comments\n" +
    "• Views\n" +
    "• Plays\n" +
    "• Reshares\n\n" +

    "*How to use:*\n" +
    "Just copy an Instagram link and send it here.\n\n" +

    "No complicated steps. Just send the link!";

  try {
    await telegram(
      "sendPhoto",
      {
        chat_id: chatId,
        photo: WELCOME_IMAGE,
        caption: welcomeCaption,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text:
                  "🌐 Open instadrop",
                url: WEBSITE_URL
              }
            ]
          ]
        }
      }
    );
  } catch (error) {
    console.error(
      "Welcome photo failed:",
      error.message
    );


    await telegram(
      "sendMessage",
      {
        chat_id: chatId,
        text: welcomeCaption,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text:
                  "🌐 Open instadrop",
                url: WEBSITE_URL
              }
            ]
          ]
        }
      }
    );
  }
}


// ==================================================
// CALLBACK HANDLER
// ==================================================

async function handleCallback(
  callback
) {
  const callbackId =
    callback.id;

  const chatId =
    callback.message?.chat?.id;

  const callbackData =
    callback.data || "";


  // Stop Telegram loading spinner.
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


  // ==================================================
  // GET COVER
  // ==================================================

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
      mediaStorage.get(
        storageId
      );


    if (
      !stored ||
      !stored.cover
    ) {
      await telegram(
        "sendMessage",
        {
          chat_id: chatId,
          text:
            "⏰ *Sorry, this cover has expired.*\n\n" +
            "Please send the Instagram link again to generate a fresh copy.",
          parse_mode: "Markdown"
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
            "🖼️ *Cover Photo*\n\n" +
            "✨ Here is the cover image you requested.",
          parse_mode: "Markdown"
        }
      );
    } catch (error) {
      console.error(
        "Cover sendPhoto failed:",
        error.message
      );


      // Fallback
      try {
        await telegram(
          "sendDocument",
          {
            chat_id: chatId,
            document: stored.cover,
            caption:
              "🖼️ *Cover Photo*\n\n" +
              "✨ Here is the cover image you requested.",
            parse_mode: "Markdown"
          }
        );
      } catch (fallbackError) {
        console.error(
          "Cover fallback failed:",
          fallbackError.message
        );


        await telegram(
          "sendMessage",
          {
            chat_id: chatId,
            text:
              "❌ *I couldn't send the cover image right now.*\n\n" +
              "Please try again.",
            parse_mode: "Markdown"
          }
        );
      }
    }


    return;
  }


  // ==================================================
  // GET DETAILS
  // ==================================================

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
      mediaStorage.get(
        storageId
      );


    if (!stored) {
      await telegram(
        "sendMessage",
        {
          chat_id: chatId,
          text:
            "⏰ *Sorry, these details have expired.*\n\n" +
            "Please send the Instagram link again to get fresh information.",
          parse_mode: "Markdown"
        }
      );

      return;
    }


    const details =
      formatDetails(
        stored.data,
        stored.parent
      );


    await telegram(
      "sendMessage",
      {
        chat_id: chatId,
        text:
          `📋 *Media Details*\n\n${details}`,
        parse_mode: "Markdown"
      }
    );


    return;
  }
}


// ==================================================
// DELETE TEMPORARY STATUS MESSAGE
// ==================================================

async function deleteStatusMessage(
  chatId,
  messageId
) {
  if (!chatId || !messageId) {
    return;
  }

  try {
    await telegram(
      "deleteMessage",
      {
        chat_id: chatId,
        message_id: messageId
      }
    );
  } catch (error) {
    console.error(
      "Temporary status deletion failed:",
      error.message
    );
  }
}


// ==================================================
// PROCESS INSTAGRAM URL
// ==================================================

async function processInstagramUrl(
  chatId,
  instagramUrl
) {
  let statusMessageId = null;


  // ==================================================
  // TEMPORARY STATUS
  // ==================================================

  try {
    const statusResponse =
      await telegram(
        "sendMessage",
        {
          chat_id: chatId,
          text:
            "⏳ *Working on it...*\n\n" +
            "🔎 Reading the Instagram link and preparing your media.",
          parse_mode: "Markdown"
        }
      );

    statusMessageId =
      statusResponse?.result?.message_id ||
      null;

  } catch (error) {
    console.error(
      "Status message failed:",
      error.message
    );
  }


  let response;


  // ==================================================
  // API REQUEST
  // ==================================================

  try {
    response = await fetch(
      API_URL +
        encodeURIComponent(
          instagramUrl
        ),
      {
        method: "GET",

        headers: {
          Accept:
            "application/json",
          "X-API-Key": API_KEY
        },

        signal:
          AbortSignal.timeout(
            60000
          )
      }
    );
  } catch (error) {
    console.error(
      "API request failed:",
      error.message
    );


    await deleteStatusMessage(
      chatId,
      statusMessageId
    );


    await telegram(
      "sendMessage",
      {
        chat_id: chatId,
        text:
          "❌ *I couldn't reach the download service.*\n\n" +
          "Please check the Instagram link and try again in a moment.",
        parse_mode: "Markdown"
      }
    );

    return;
  }


  // ==================================================
  // JSON
  // ==================================================

  let data;


  try {
    data =
      await response.json();
  } catch {
    await deleteStatusMessage(
      chatId,
      statusMessageId
    );


    await telegram(
      "sendMessage",
      {
        chat_id: chatId,
        text:
          "⚠️ *The download service returned an unexpected response.*\n\n" +
          "Please try the Instagram link again.",
        parse_mode: "Markdown"
      }
    );

    return;
  }


  console.log(
    "instadrop API response:",
    JSON.stringify(
      data,
      null,
      2
    ).slice(0, 2000)
  );


  if (!response.ok) {
    console.error(
      "API HTTP error:",
      response.status,
      data
    );

    const errorMsg =
      data?.error ||
      data?.message ||
      "The download could not be completed.";

    await deleteStatusMessage(
      chatId,
      statusMessageId
    );


    await telegram(
      "sendMessage",
      {
        chat_id: chatId,
        text:
          `❌ *${errorMsg}*\n\n` +
          "Please try again with a valid Instagram link.",
        parse_mode: "Markdown"
      }
    );

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


    await deleteStatusMessage(
      chatId,
      statusMessageId
    );


    await telegram(
      "sendMessage",
      {
        chat_id: chatId,
        text:
          `❌ *${message}*\n\n` +
          "💡 Make sure the content is available and the link is correct.",
        parse_mode: "Markdown"
      }
    );

    return;
  }


  // Check for error field without p field
  if (
    data &&
    data.error &&
    !data.p
  ) {
    await deleteStatusMessage(
      chatId,
      statusMessageId
    );


    await telegram(
      "sendMessage",
      {
        chat_id: chatId,
        text:
          `❌ *${data.error}*\n\n` +
          "Please try another Instagram link.",
        parse_mode: "Markdown"
      }
    );

    return;
  }


  const responseType =
    getResponseType(data);


  console.log(
    "Detected response type:",
    responseType
  );


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
      await deleteStatusMessage(
        chatId,
        statusMessageId
      );


      await telegram(
        "sendMessage",
        {
          chat_id: chatId,
          text:
            "❌ *I couldn't find a downloadable video in this reel.*\n\n" +
            "Please try the reel link again.",
          parse_mode: "Markdown"
        }
      );

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


    await deleteStatusMessage(
      chatId,
      statusMessageId
    );


    return;
  }


  // ==================================================
  // HIGHLIGHT
  // ==================================================

  if (
    responseType === "highlight"
  ) {
    console.log(
      "Processing highlight..."
    );


    // Header with highlight cover button.
    await sendCollectionHeader(
      chatId,
      data,
      "highlight"
    );


    // Extract ALL nested highlight media.
    const mediaItems =
      extractMediaItems(data);


    console.log(
      "Highlight media count:",
      mediaItems.length
    );


    if (!mediaItems.length) {
      await deleteStatusMessage(
        chatId,
        statusMessageId
      );


      await telegram(
        "sendMessage",
        {
          chat_id: chatId,
          text:
            "❌ *This highlight doesn't contain any downloadable media.*\n\n" +
            "Please try another highlight.",
          parse_mode: "Markdown"
        }
      );

      return;
    }


    // ------------------------------------------------
    // Each highlight item has its own data.
    // This preserves its individual cover/details.
    // ------------------------------------------------

    if (
      Array.isArray(data.items) &&
      data.items.length > 0
    ) {
      for (
        const item of data.items
      ) {
        const itemMedia =
          extractMediaItems(
            item
          );


        for (
          const media of itemMedia
        ) {
          await sendMedia(
            chatId,
            media,
            item,
            data
          );
        }
      }
    } else {
      // Fallback if highlight API does not use items.
      for (
        const media of mediaItems
      ) {
        await sendMedia(
          chatId,
          media,
          data,
          data
        );
      }
    }


    await deleteStatusMessage(
      chatId,
      statusMessageId
    );


    return;
  }


  // ==================================================
  // STORY
  // ==================================================

  if (
    responseType === "story"
  ) {
    console.log(
      "Processing story..."
    );


    // Header with story cover button.
    await sendCollectionHeader(
      chatId,
      data,
      "story"
    );


    const mediaItems =
      extractMediaItems(data);


    console.log(
      "Story media count:",
      mediaItems.length
    );


    if (!mediaItems.length) {
      await deleteStatusMessage(
        chatId,
        statusMessageId
      );


      await telegram(
        "sendMessage",
        {
          chat_id: chatId,
          text:
            "❌ *I couldn't find any downloadable media in this story.*\n\n" +
            "Please try the story link again.",
          parse_mode: "Markdown"
        }
      );

      return;
    }


    // Story with nested items.
    if (
      Array.isArray(data.items) &&
      data.items.length > 0
    ) {
      for (
        const item of data.items
      ) {
        const itemMedia =
          extractMediaItems(
            item
          );


        for (
          const media of itemMedia
        ) {
          await sendMedia(
            chatId,
            media,
            item,
            data
          );
        }
      }
    } else {
      // Story with direct image/video fields.
      for (
        const media of mediaItems
      ) {
        await sendMedia(
          chatId,
          media,
          data,
          data
        );
      }
    }


    await deleteStatusMessage(
      chatId,
      statusMessageId
    );


    return;
  }


  // ==================================================
  // COLLECTION (fallback for items without type)
  // ==================================================

  if (
    responseType === "collection"
  ) {
    console.log(
      "Processing collection..."
    );


    await sendCollectionHeader(
      chatId,
      data,
      "collection"
    );


    const mediaItems =
      extractMediaItems(data);


    if (!mediaItems.length) {
      await deleteStatusMessage(
        chatId,
        statusMessageId
      );


      await telegram(
        "sendMessage",
        {
          chat_id: chatId,
          text:
            "❌ *This collection doesn't contain any downloadable media.*\n\n" +
            "Please try another Instagram link.",
          parse_mode: "Markdown"
        }
      );

      return;
    }


    if (
      Array.isArray(data.items) &&
      data.items.length > 0
    ) {
      for (
        const item of data.items
      ) {
        const itemMedia =
          extractMediaItems(
            item
          );


        for (
          const media of itemMedia
        ) {
          await sendMedia(
            chatId,
            media,
            item,
            data
          );
        }
      }
    } else {
      for (
        const media of mediaItems
      ) {
        await sendMedia(
          chatId,
          media,
          data,
          null
        );
      }
    }


    await deleteStatusMessage(
      chatId,
      statusMessageId
    );


    return;
  }


  // ==================================================
  // NORMAL POST / CAROUSEL
  // ==================================================

  const mediaItems =
    extractMediaItems(data);


  console.log(
    "Normal media count:",
    mediaItems.length
  );


  if (!mediaItems.length) {
    await deleteStatusMessage(
      chatId,
      statusMessageId
    );


    await telegram(
      "sendMessage",
      {
        chat_id: chatId,
        text:
          "❌ *I couldn't find any downloadable media in that Instagram post.*\n\n" +
          "Please check the link and try again.",
        parse_mode: "Markdown"
      }
    );

    return;
  }


  // Send all carousel/normal media.
  for (
    const media of mediaItems
  ) {
    await sendMedia(
      chatId,
      media,
      data,
      null
    );
  }


  // Remove temporary processing message
  // only after all media has been sent.
  await deleteStatusMessage(
    chatId,
    statusMessageId
  );
}


// ==================================================
// VERCEL WEBHOOK
// ==================================================

export default async function handler(
  req,
  res
) {
  // Health check
  if (
    req.method !== "POST"
  ) {
    return res
      .status(200)
      .json({
        ok: true,
        message:
          "instadrop Telegram bot is running."
      });
  }


  try {
    const update =
      req.body || {};


    // ==================================================
    // CALLBACK QUERY
    // ==================================================

    if (
      update.callback_query
    ) {
      await handleCallback(
        update.callback_query
      );


      return res
        .status(200)
        .json({
          ok: true
        });
    }


    // ==================================================
    // MESSAGE
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


    const chatId =
      message.chat?.id;


    if (!chatId) {
      return res
        .status(200)
        .json({
          ok: true
        });
    }


    const text =
      message.text ||
      message.caption ||
      "";


    // ==================================================
    // /start
    // ==================================================

    if (
      text === "/start" ||
      text.startsWith(
        "/start "
      )
    ) {
      // Notify admin ONLY on the user's
      // first /start message.
      await notifyAdmin(
        chatId,
        message.from
      );


      await sendWelcome(
        chatId
      );


      return res
        .status(200)
        .json({
          ok: true
        });
    }


    // ==================================================
    // /help
    // ==================================================

    if (
      text === "/help" ||
      text.startsWith(
        "/help "
      )
    ) {
      await telegram(
        "sendMessage",
        {
          chat_id: chatId,
          text:
            "*instadrop Help*\n\n" +

            "Just send me an Instagram link and I'll handle the rest.\n\n" +

            "*Supported content*\n" +
            "• \"Posts\"\n" +
            "• \"Carousels\"\n" +
            "• \"Reels\"\n" +
            "• \"Stories\"\n" +
            "• \"Highlights\"\n" +
            "• \"Profiles\"\n\n" +

            "*Profile support*\n" +
            "Profile picture and available account information are supported.\n\n" +

            "*Details*\n" +
            "Available media and account information can be viewed using the *Get Details* button.\n\n" +

            "*Tip:* Copy the Instagram URL and paste it directly into this chat.\n\n" +

            "No extra commands are required.",
          parse_mode: "Markdown"
        }
      );


      return res
        .status(200)
        .json({
          ok: true
        });
    }


    // ==================================================
    // INSTAGRAM URL
    // ==================================================

    const instagramUrl =
      findInstagramUrl(text);


    if (!instagramUrl) {
      await telegram(
        "sendMessage",
        {
          chat_id: chatId,
          text:
            "📎 *I need an Instagram link to get started.*\n\n" +

            "Send me the link to a:\n" +
            "📸 Post\n" +
            "🖼️ Carousel\n" +
            "🎬 Reel\n" +
            "📖 Story\n" +
            "✨ Highlight\n" +
            "👤 Profile\n\n" +

            "💡 Just copy the Instagram URL and paste it here.",
          parse_mode: "Markdown"
        }
      );


      return res
        .status(200)
        .json({
          ok: true
        });
    }


    // ==================================================
    // DOWNLOAD
    // ==================================================

    await processInstagramUrl(
      chatId,
      instagramUrl
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


    try {
      const chatId =
        req.body?.message?.chat?.id;


      if (chatId) {
        await telegram(
          "sendMessage",
          {
            chat_id: chatId,
            text:
              "⚠️ *Something unexpected happened while processing your request.*\n\n" +
              "Please try the Instagram link again. If the problem continues, try again a little later.",
            parse_mode: "Markdown"
          }
        );
      }
    } catch (telegramError) {
      console.error(
        "Failed to send error message:",
        telegramError.message
      );
    }


    // Always return 200 to Telegram
    // so it doesn't repeatedly retry the webhook.
    return res
      .status(200)
      .json({
        ok: true
      });
  }
}

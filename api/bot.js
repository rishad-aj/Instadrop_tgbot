// api/resolve.js

export default async function handler(req, res) {
  // --------------------------------------------------
  // CORS
  // --------------------------------------------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-IG-Cookie");

  if (req.method === "OPTIONS") return res.status(200).end();

  // --------------------------------------------------
  // ONLY GET REQUESTS
  // --------------------------------------------------
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  // --------------------------------------------------
  // GET INSTAGRAM URL
  // --------------------------------------------------
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "Missing Instagram URL"
    });
  }

  // --------------------------------------------------
  // VALIDATE INSTAGRAM URL
  // --------------------------------------------------
  let instagramUrl;

  try {
    instagramUrl = new URL(url);
  } catch {
    return res.status(400).json({
      success: false,
      error: "Invalid URL"
    });
  }

  const hostname = instagramUrl.hostname.toLowerCase();

  const validInstagramHosts = [
    "instagram.com",
    "www.instagram.com",
    "m.instagram.com"
  ];

  if (!validInstagramHosts.includes(hostname)) {
    return res.status(400).json({
      success: false,
      error: "URL is not an Instagram URL"
    });
  }

  // --------------------------------------------------
  // DETECT CONTENT TYPE
  // --------------------------------------------------
  const pathname = instagramUrl.pathname;

  let type = "unknown";

  if (pathname.startsWith("/stories/highlights/")) {
    type = "highlight";
  } else if (pathname.startsWith("/stories/")) {
    type = "story";
  } else if (
    pathname.startsWith("/reel/") ||
    pathname.startsWith("/reels/")
  ) {
    type = "reel";
  } else if (pathname.startsWith("/p/")) {
    type = "post";
  }

  // --------------------------------------------------
  // EXTRACT SHORTCODE
  // --------------------------------------------------
  const match = pathname.match(
    /\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/
  );

  const shortcode = match && match[1];

  if (!shortcode) {
    return res.status(400).json({
      success: false,
      error: "Could not extract post shortcode from URL"
    });
  }

  // --------------------------------------------------
  // HEADERS
  // --------------------------------------------------
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",

    "Accept-Language": "en-US,en;q=0.9"
  };

  if (req.headers["x-ig-cookie"]) {
    headers["Cookie"] = req.headers["x-ig-cookie"];
  }

  // --------------------------------------------------
  // DATA
  // --------------------------------------------------
  let items = [];
  let username = null;
  let caption = "";
  let likeCount = null;
  let blocked = false;

  // --------------------------------------------------
  // METHOD 1
  // Try Instagram media endpoint
  // --------------------------------------------------
  try {
    const r = await fetch(
      `https://www.instagram.com/p/${shortcode}/media/?size=l`,
      {
        headers,
        redirect: "follow"
      }
    );

    const ct = (
      r.headers.get("content-type") || ""
    ).toLowerCase();

    if (
      r.ok &&
      (ct.startsWith("image/") || ct.startsWith("video/"))
    ) {
      items.push({
        type: ct.startsWith("video/") ? "video" : "image",
        url: r.url,
        width: null,
        height: null,
        index: 1
      });
    }

    if (r.status === 403 || r.status === 429) {
      blocked = true;
    }
  } catch (_) {}

  // --------------------------------------------------
  // METHOD 2
  // Instagram post HTML
  //
  // This is also where we try to extract carousel data.
  // --------------------------------------------------
  try {
    const page = await fetch(
      `https://www.instagram.com/p/${shortcode}/`,
      {
        headers,
        redirect: "follow"
      }
    );

    const html = await page.text();

    // ----------------------------------------------
    // Basic OG metadata
    // ----------------------------------------------
    const ogUrl = metaContent(html, "og:url");
    const ogImg = metaContent(html, "og:image");
    const ogVid = metaContent(html, "og:video");
    const ogDesc = metaContent(html, "og:description");

    username =
      (ogUrl &&
        ogUrl.match(
          /instagram\.com\/([A-Za-z0-9_.]+)\/(?:p|reel)\//
        )?.[1]) ||
      username;

    if (ogDesc) {
      caption = decodeEntities(ogDesc);
      likeCount = parseLikeCount(ogDesc);
    }

    // ----------------------------------------------
    // IMPORTANT:
    // Look for Instagram's embedded shortcode_media
    // ----------------------------------------------
    const media = extractShortcodeMedia(html);

    if (media) {
      const carouselItems = mediaToItems(media);

      if (carouselItems.length) {
        // Replace the single OG/media result
        // with the complete carousel.
        items = carouselItems;

        username =
          media.owner?.username ||
          username;

        caption =
          media.edge_media_to_caption?.edges?.[0]?.node?.text ||
          caption;

        likeCount =
          media.edge_media_preview_like?.count ??
          likeCount;
      }
    }

    // ----------------------------------------------
    // Fallback OG media
    // ----------------------------------------------
    if (!items.length) {
      if (ogVid) {
        items.push({
          type: "video",
          url: ogVid,
          width: null,
          height: null,
          index: 1
        });
      } else if (ogImg) {
        items.push({
          type: "image",
          url: ogImg,
          width: null,
          height: null,
          index: 1
        });
      }
    }

    if (page.status === 403 || page.status === 429) {
      blocked = true;
    }
  } catch (_) {
    blocked = true;
  }

  // --------------------------------------------------
  // METHOD 3
  // Legacy embed endpoint
  // --------------------------------------------------
  if (!items.length) {
    try {
      const emb = await fetch(
        `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
        {
          headers,
          redirect: "follow"
        }
      );

      if (emb.ok) {
        const media = extractShortcodeMedia(
          await emb.text()
        );

        if (media) {
          const embedItems = mediaToItems(media);

          if (embedItems.length) {
            items = embedItems;
          }

          username =
            media.owner?.username ||
            username;

          caption =
            media.edge_media_to_caption?.edges?.[0]?.node?.text ||
            caption;

          likeCount =
            media.edge_media_preview_like?.count ??
            likeCount;
        }
      }
    } catch (_) {}
  }

  // --------------------------------------------------
  // NO MEDIA
  // --------------------------------------------------
  if (!items.length) {
    return res.status(404).json({
      success: false,
      error: blocked
        ? "Instagram blocked this server. Pass an X-IG-Cookie header with your sessionid, or run on a residential IP."
        : "No media found — the post may be private, deleted, or unsupported."
    });
  }

  // --------------------------------------------------
  // NORMALIZE INDEX
  // --------------------------------------------------
  items = items.map((item, index) => ({
    ...item,
    index: index + 1
  }));

  // --------------------------------------------------
  // DOWNLOAD REDIRECT
  //
  // ?download=1 returns first media item.
  // ?download=2 returns second carousel item, etc.
  // --------------------------------------------------
  if (req.query.download) {
    const requestedIndex =
      parseInt(req.query.download, 10) || 1;

    const selected =
      items[requestedIndex - 1] || items[0];

    return res.redirect(302, selected.url);
  }

  // --------------------------------------------------
  // RESPONSE
  // --------------------------------------------------
  res.setHeader(
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400"
  );

  return res.status(200).json({
    success: true,

    type,

    shortcode,

    source_url: instagramUrl.href,

    username,

    caption,

    likeCount,

    media_count: items.length,

    is_carousel: items.length > 1,

    media: items,

    watermark: {
      enabled: true,
      text: "Downloaded with Instadrop",
      position: "bottom"
    },

    powered_by: "Instadrop"
  });
}

// ==================================================
// HELPERS
// ==================================================

function mediaToItems(media) {
  const items = [];

  const push = (node) => {
    if (!node) return;

    const isVideo =
      node.is_video === true ||
      !!node.video_url ||
      !!node.video_versions?.[0]?.url;

    const mediaUrl = isVideo
      ? (
          node.video_url ||
          node.video_versions?.[0]?.url ||
          node.display_url
        )
      : (
          node.display_url ||
          node.image_versions2?.candidates?.[0]?.url
        );

    if (!mediaUrl) return;

    items.push({
      type: isVideo ? "video" : "image",
      url: mediaUrl,

      width:
        node.dimensions?.width ||
        node.original_width ||
        null,

      height:
        node.dimensions?.height ||
        node.original_height ||
        null
    });
  };

  // ----------------------------------------------
  // CAROUSEL
  // ----------------------------------------------
  if (
    media.edge_sidecar_to_children?.edges?.length
  ) {
    for (
      const edge of media.edge_sidecar_to_children.edges
    ) {
      push(edge.node);
    }
  }

  // ----------------------------------------------
  // SINGLE POST
  // ----------------------------------------------
  else {
    push(media);
  }

  return items;
}

// ==================================================
// META TAG PARSER
// ==================================================

function metaContent(html, prop) {
  const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const m = html.match(
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)` +
      `|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
      "i"
    )
  );

  return m ? (m[1] || m[2]) : null;
}

// ==================================================
// HTML ENTITY DECODER
// ==================================================

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#x2019;/g, "’")
    .replace(/&#x2F;/g, "/")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// ==================================================
// LIKE COUNT
// ==================================================

function parseLikeCount(desc) {
  const m = desc.match(
    /([\d.,]+)\s*([KMB]?)\s*likes/i
  );

  if (!m) return null;

  const n = parseFloat(
    m[1].replace(/,/g, "")
  );

  const suffix = m[2].toUpperCase();

  if (suffix === "K") {
    return Math.round(n * 1e3);
  }

  if (suffix === "M") {
    return Math.round(n * 1e6);
  }

  if (suffix === "B") {
    return Math.round(n * 1e9);
  }

  return Math.round(n);
}

// ==================================================
// BALANCED JSON SCANNER
// ==================================================

function scanBalancedJson(html, openIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (
    let i = openIndex;
    i < html.length;
    i++
  ) {
    const c = html[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (c === "\\") {
        escaped = true;
      } else if (c === '"') {
        inString = false;
      }
    } else {
      if (c === '"') {
        inString = true;
      } else if (c === "{") {
        depth++;
      } else if (c === "}") {
        depth--;

        if (depth === 0) {
          return html.slice(
            openIndex,
            i + 1
          );
        }
      }
    }
  }

  return null;
}

// ==================================================
// EXTRACT INSTAGRAM EMBEDDED MEDIA
// ==================================================

function extractShortcodeMedia(html) {
  let from = 0;

  while (true) {
    const marker = html.indexOf(
      "__additionalDataLoaded",
      from
    );

    if (marker === -1) {
      break;
    }

    const open = html.indexOf(
      "{",
      marker
    );

    const jsonStr =
      open !== -1
        ? scanBalancedJson(html, open)
        : null;

    if (jsonStr) {
      try {
        const data = JSON.parse(jsonStr);

        if (
          data?.graphql?.shortcode_media
        ) {
          return data.graphql.shortcode_media;
        }
      } catch (_) {}
    }

    from = marker + 1;
  }

  // ----------------------------------------------
  // Additional fallback:
  // Search for graphql shortcode_media directly.
  // ----------------------------------------------
  const graphqlIndex =
    html.indexOf(
      '"shortcode_media"'
    );

  if (graphqlIndex !== -1) {
    const open = html.lastIndexOf(
      "{",
      graphqlIndex
    );

    if (open !== -1) {
      const jsonStr =
        scanBalancedJson(
          html,
          open
        );

      if (jsonStr) {
        try {
          const data = JSON.parse(jsonStr);

          if (
            data?.graphql?.shortcode_media
          ) {
            return data.graphql.shortcode_media;
          }
        } catch (_) {}
      }
    }
  }

  return null;
}

// api/resolve.js

export default async function handler(req, res) {
  // --------------------------------------------------
  // CORS
  // --------------------------------------------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-IG-Cookie"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --------------------------------------------------
  // ONLY GET
  // --------------------------------------------------
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  // --------------------------------------------------
  // GET URL
  // --------------------------------------------------
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "Missing Instagram URL"
    });
  }

  // --------------------------------------------------
  // VALIDATE URL
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

  const validHosts = [
    "instagram.com",
    "www.instagram.com",
    "m.instagram.com"
  ];

  if (!validHosts.includes(hostname)) {
    return res.status(400).json({
      success: false,
      error: "URL is not an Instagram URL"
    });
  }

  // --------------------------------------------------
  // DETECT TYPE
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
  // SHORTCODE
  // --------------------------------------------------
  const match = pathname.match(
    /\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/
  );

  const shortcode = match?.[1];

  if (!shortcode) {
    return res.status(400).json({
      success: false,
      error: "Could not extract shortcode from URL"
    });
  }

  // --------------------------------------------------
  // HEADERS
  // --------------------------------------------------
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/124.0.0.0 Safari/537.36",

    "Accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9," +
      "image/avif,image/webp,*/*;q=0.8",

    "Accept-Language": "en-US,en;q=0.9"
  };

  if (req.headers["x-ig-cookie"]) {
    headers["Cookie"] = req.headers["x-ig-cookie"];
  }

  // --------------------------------------------------
  // RESULT DATA
  // --------------------------------------------------
  let images = [];
  let videos = [];

  let owner = null;
  let caption = "";

  let blocked = false;

  // ==================================================
  // METHOD 1
  // POST PAGE
  //
  // IMPORTANT:
  // Always inspect the page for carousel data first.
  // ==================================================
  try {
    const page = await fetch(
      `https://www.instagram.com/p/${shortcode}/`,
      {
        headers,
        redirect: "follow"
      }
    );

    const html = await page.text();

    if (page.status === 403 || page.status === 429) {
      blocked = true;
    }

    // ------------------------------------------------
    // OG DATA
    // ------------------------------------------------
    const ogUrl = metaContent(html, "og:url");
    const ogImage = metaContent(html, "og:image");
    const ogVideo = metaContent(html, "og:video");
    const ogDescription = metaContent(
      html,
      "og:description"
    );

    // ------------------------------------------------
    // OWNER
    // ------------------------------------------------
    if (ogUrl) {
      const ownerMatch = ogUrl.match(
        /instagram\.com\/([A-Za-z0-9_.]+)\/(?:p|reel)\//
      );

      if (ownerMatch) {
        owner = "@" + ownerMatch[1];
      }
    }

    // ------------------------------------------------
    // CAPTION
    // ------------------------------------------------
    if (ogDescription) {
      caption = decodeEntities(ogDescription);
    }

    // ------------------------------------------------
    // EXTRACT INSTAGRAM INTERNAL DATA
    // ------------------------------------------------
    const media = extractShortcodeMedia(html);

    if (media) {
      owner =
        media.owner?.username
          ? "@" + media.owner.username
          : owner;

      caption =
        media.edge_media_to_caption?.edges?.[0]?.node?.text ||
        caption;

      // ----------------------------------------------
      // CAROUSEL
      // ----------------------------------------------
      if (
        media.edge_sidecar_to_children?.edges?.length
      ) {
        for (
          const edge of media.edge_sidecar_to_children.edges
        ) {
          const node = edge.node;

          if (!node) continue;

          const isVideo =
            node.is_video === true ||
            !!node.video_url ||
            !!node.video_versions?.length;

          if (isVideo) {
            const videoUrl =
              node.video_url ||
              node.video_versions?.[0]?.url;

            if (videoUrl) {
              videos.push(videoUrl);
            }
          } else {
            const imageUrl =
              node.display_url ||
              node.image_versions2?.candidates?.[0]?.url;

            if (imageUrl) {
              images.push(imageUrl);
            }
          }
        }
      }

      // ----------------------------------------------
      // SINGLE MEDIA
      // ----------------------------------------------
      else {
        const isVideo =
          media.is_video === true ||
          !!media.video_url ||
          !!media.video_versions?.length;

        if (isVideo) {
          const videoUrl =
            media.video_url ||
            media.video_versions?.[0]?.url;

          if (videoUrl) {
            videos.push(videoUrl);
          }
        } else {
          const imageUrl =
            media.display_url ||
            media.image_versions2?.candidates?.[0]?.url;

          if (imageUrl) {
            images.push(imageUrl);
          }
        }
      }
    }

    // ------------------------------------------------
    // OG FALLBACK
    // ------------------------------------------------
    if (!images.length && !videos.length) {
      if (ogVideo) {
        videos.push(ogVideo);
      } else if (ogImage) {
        images.push(ogImage);
      }
    }
  } catch (error) {
    blocked = true;
  }

  // ==================================================
  // METHOD 2
  // MEDIA ENDPOINT
  // ==================================================
  if (!images.length && !videos.length) {
    try {
      const r = await fetch(
        `https://www.instagram.com/p/${shortcode}/media/?size=l`,
        {
          headers,
          redirect: "follow"
        }
      );

      const contentType = (
        r.headers.get("content-type") || ""
      ).toLowerCase();

      if (
        r.ok &&
        contentType.startsWith("image/")
      ) {
        images.push(r.url);
      }

      if (
        r.ok &&
        contentType.startsWith("video/")
      ) {
        videos.push(r.url);
      }

      if (r.status === 403 || r.status === 429) {
        blocked = true;
      }
    } catch (_) {}
  }

  // ==================================================
  // METHOD 3
  // EMBED
  // ==================================================
  if (!images.length && !videos.length) {
    try {
      const emb = await fetch(
        `https://www.instagram.com/p/${shortcode}/embed/captioned/`,
        {
          headers,
          redirect: "follow"
        }
      );

      if (emb.ok) {
        const html = await emb.text();

        const media =
          extractShortcodeMedia(html);

        if (media) {
          owner =
            media.owner?.username
              ? "@" + media.owner.username
              : owner;

          caption =
            media.edge_media_to_caption?.edges?.[0]?.node?.text ||
            caption;

          const extracted =
            extractMedia(media);

          images = extracted.images;
          videos = extracted.videos;
        }
      }
    } catch (_) {}
  }

  // ==================================================
  // REMOVE DUPLICATES
  // ==================================================
  images = [...new Set(images)];
  videos = [...new Set(videos)];

  // ==================================================
  // NO MEDIA
  // ==================================================
  if (!images.length && !videos.length) {
    return res.status(404).json({
      success: false,
      error: blocked
        ? "Instagram blocked this server. Pass an X-IG-Cookie header with your sessionid."
        : "No media found — the post may be private, deleted, or unsupported."
    });
  }

  // ==================================================
  // DOWNLOAD
  //
  // ?download=1
  // ?download=2
  // etc.
  // ==================================================
  if (req.query.download) {
    const index =
      Math.max(
        1,
        parseInt(req.query.download, 10) || 1
      ) - 1;

    const allMedia = [
      ...images,
      ...videos
    ];

    const selected =
      allMedia[index] || allMedia[0];

    return res.redirect(302, selected);
  }

  // ==================================================
  // FINAL JSON
  //
  // SAME SIMPLE STYLE AS YOUR WORKING API
  // ==================================================

  const response = {
    p: type === "post",

    image: images,

    owner: owner,

    made_by: "Instadrop ♥️"
  };

  // Only add video when videos exist.
  if (videos.length) {
    response.video = videos;
  }

  // Optional metadata for your own frontend.
  response.type = type;
  response.shortcode = shortcode;

  if (caption) {
    response.caption = caption;
  }

  res.setHeader(
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400"
  );

  return res.status(200).json(response);
}

// ==================================================
// EXTRACT MEDIA FROM MEDIA OBJECT
// ==================================================

function extractMedia(media) {
  const images = [];
  const videos = [];

  const addNode = (node) => {
    if (!node) return;

    const isVideo =
      node.is_video === true ||
      !!node.video_url ||
      !!node.video_versions?.length;

    if (isVideo) {
      const url =
        node.video_url ||
        node.video_versions?.[0]?.url;

      if (url) videos.push(url);
    } else {
      const url =
        node.display_url ||
        node.image_versions2?.candidates?.[0]?.url;

      if (url) images.push(url);
    }
  };

  // Carousel
  if (
    media.edge_sidecar_to_children?.edges?.length
  ) {
    for (
      const edge of media.edge_sidecar_to_children.edges
    ) {
      addNode(edge.node);
    }
  }

  // Single
  else {
    addNode(media);
  }

  return {
    images,
    videos
  };
}

// ==================================================
// META TAG
// ==================================================

function metaContent(html, prop) {
  const escaped =
    prop.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["']` +
      `[^>]+content=["']([^"']+)` +
      `|<meta[^>]+content=["']([^"']+)["']` +
      `[^>]+(?:property|name)=["']${escaped}["']`,
    "i"
  );

  const match = html.match(regex);

  return match
    ? match[1] || match[2]
    : null;
}

// ==================================================
// HTML ENTITIES
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
// BALANCED JSON
// ==================================================

function scanBalancedJson(
  html,
  openIndex
) {
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
// EXTRACT INSTAGRAM MEDIA
// ==================================================

function extractShortcodeMedia(html) {
  let from = 0;

  while (true) {
    const marker =
      html.indexOf(
        "__additionalDataLoaded",
        from
      );

    if (marker === -1) break;

    const open =
      html.indexOf(
        "{",
        marker
      );

    if (open !== -1) {
      const jsonStr =
        scanBalancedJson(
          html,
          open
        );

      if (jsonStr) {
        try {
          const data =
            JSON.parse(jsonStr);

          if (
            data?.graphql?.shortcode_media
          ) {
            return (
              data.graphql.shortcode_media
            );
          }
        } catch (_) {}
      }
    }

    from = marker + 1;
  }

  // ------------------------------------------------
  // Additional fallback
  // ------------------------------------------------
  const marker =
    html.indexOf(
      '"shortcode_media"'
    );

  if (marker !== -1) {
    const open =
      html.lastIndexOf(
        "{",
        marker
      );

    if (open !== -1) {
      const jsonStr =
        scanBalancedJson(
          html,
          open
        );

      if (jsonStr) {
        try {
          const data =
            JSON.parse(jsonStr);

          if (
            data?.graphql?.shortcode_media
          ) {
            return (
              data.graphql.shortcode_media
            );
          }
        } catch (_) {}
      }
    }
  }

  return null;
}

// api/resolve.js

const APP = {
  name: "InstaDrop",
  creator: "Muhammed Rishad AJ",
  version: "1.0.0"
};

const MADE_BY = "InstaDrop — Created by Muhammed Rishad AJ";

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
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  // --------------------------------------------------
  // GET INSTAGRAM URL
  // --------------------------------------------------
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ success: false, error: "Missing Instagram URL" });
  }

  // --------------------------------------------------
  // VALIDATE INSTAGRAM URL
  // --------------------------------------------------
  let instagramUrl;
  try {
    instagramUrl = new URL(url);
  } catch {
    return res.status(400).json({ success: false, error: "Invalid URL" });
  }

  const hostname = instagramUrl.hostname.toLowerCase();
  const validInstagramHosts = ["instagram.com", "www.instagram.com", "m.instagram.com"];
  if (!validInstagramHosts.includes(hostname)) {
    return res.status(400).json({ success: false, error: "URL is not an Instagram URL" });
  }

  // --------------------------------------------------
  // DETECT CONTENT TYPE
  // --------------------------------------------------
  const pathname = instagramUrl.pathname;

  let type = "unknown";
  if (pathname.startsWith("/stories/highlights/")) type = "highlight";
  else if (pathname.startsWith("/stories/")) type = "story";
  else if (pathname.startsWith("/reel/") || pathname.startsWith("/reels/")) type = "reel";
  else if (pathname.startsWith("/p/")) type = "post";

  // --------------------------------------------------
  // EXTRACT SHORTCODE (the post ID in the URL)
  // --------------------------------------------------
  const match = pathname.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  const shortcode = match && match[1];
  if (!shortcode) {
    return res.status(400).json({ success: false, error: "Could not extract post shortcode from URL" });
  }

  // --------------------------------------------------
  // HEADERS — set IG_SESSIONID env var (recommended) or
  // pass X-IG-Cookie header to unlock carousels + likes.
  // Without a session you still get the first slide + metadata.
  // --------------------------------------------------
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9"
  };
  const cookie = process.env.IG_SESSIONID || req.headers["x-ig-cookie"];
  if (cookie) headers["Cookie"] = cookie;

  let owner = null;
  let username = null;
  let caption = "";
  let likeCount = null;
  let isCarousel = null;
  let items = [];
  let source = null;
  let blocked = false;
  let mediaId = shortcodeToId(shortcode);

  // --------------------------------------------------
  // METHOD 0 — oEmbed: owner + caption, no session needed
  // --------------------------------------------------
  try {
    const oe = await fetch(
      `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(`https://www.instagram.com/p/${shortcode}/`)}`,
      { headers }
    );
    if (oe.ok) {
      const j = await oe.json();
      username = j.author_name || username;
      caption = j.title || caption;
      if (j.media_id && j.media_id.includes("_")) mediaId = j.media_id.split("_")[0];
    }
  } catch (_) {}

  // --------------------------------------------------
  // METHOD 1 (BEST) — internal API with session:
  // all carousel slides, videos, likes
  // --------------------------------------------------
  if (cookie) {
    for (const base of [
      "https://www.instagram.com/api/v1/media/",
      "https://i.instagram.com/api/v1/media/"
    ]) {
      try {
        const r = await fetch(`${base}${mediaId}/info/`, {
          headers: { ...headers, "X-IG-App-ID": "936619743392459" }
        });
        if (!r.ok) continue;
        const data = await r.json();
        if (!data || data.status === "fail" || !Array.isArray(data.items) || !data.items.length) continue;

        const post = data.items[0];
        username = post.user?.username || username;
        caption = post.caption?.text || caption;
        likeCount = post.like_count ?? likeCount;
        isCarousel = post.media_type === 8;

        const slides =
          post.media_type === 8 && Array.isArray(post.carousel_media)
            ? post.carousel_media
            : [post];

        items = slides.map((s, i) => {
          const best = pickBest(s.image_versions2 && s.image_versions2.candidates);
          const vid = (s.video_versions && s.video_versions[0]) || null;
          return {
            index: i + 1,
            type: s.media_type === 2 || vid ? "video" : "image",
            url: (vid && vid.url) || (best && best.url),
            width: (vid && vid.width) || (best && best.width) || null,
            height: (vid && vid.height) || (best && best.height) || null,
            extension: vid ? "mp4" : "jpg"
          };
        });
        source = "api";
        break;
      } catch (_) {}
    }
  }

  // --------------------------------------------------
  // METHOD 2 — /media/?size=l : largest single image
  // --------------------------------------------------
  if (!items.length) {
    try {
      const r = await fetch(`https://www.instagram.com/p/${shortcode}/media/?size=l`, {
        headers, redirect: "follow"
      });
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      if (r.ok && (ct.startsWith("image/") || ct.startsWith("video/"))) {
        items.push({
          index: 1,
          type: ct.startsWith("video/") ? "video" : "image",
          url: r.url,
          width: null,
          height: null,
          extension: ct.startsWith("video/") ? "mp4" : "jpg"
        });
        source = "media";
      }
    } catch (_) {}
  }

  // --------------------------------------------------
  // METHOD 3 — og:image / og:video from the post page
  // --------------------------------------------------
  if (!items.length) {
    try {
      const page = await fetch(`https://www.instagram.com/p/${shortcode}/`, { headers });
      const html = await page.text();

      const ogUrl = metaContent(html, "og:url");
      const ogImg = metaContent(html, "og:image");
      const ogVid = metaContent(html, "og:video");

      username = (ogUrl && ogUrl.match(/instagram\.com\/([A-Za-z0-9_.]+)\/p\//))?.[1] || username;
      if (!caption) caption = decodeEntities(metaContent(html, "og:description") || "");
      if (!likeCount) likeCount = parseLikeCount(metaContent(html, "og:description") || "");

      if (ogVid) items.push({ index: 1, type: "video", url: ogVid, width: null, height: null, extension: "mp4" });
      else if (ogImg) items.push({ index: 1, type: "image", url: ogImg, width: null, height: null, extension: "jpg" });
      else if (page.status === 403 || page.status === 429) blocked = true;
      if (items.length) source = "og";
    } catch (_) {
      blocked = true;
    }
  }

  // --------------------------------------------------
  // METHOD 4 — legacy embed page JSON (carousels, captions)
  // --------------------------------------------------
  if (!items.length) {
    try {
      const emb = await fetch(`https://www.instagram.com/p/${shortcode}/embed/captioned/`, { headers });
      if (emb.ok) {
        const media = extractShortcodeMedia(await emb.text());
        if (media) {
          items = mediaToItems(media).map((m, i) => ({ index: i + 1, ...m }));
          username = media.owner?.username || username;
          caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || caption;
          likeCount = media.edge_media_preview_like?.count ?? likeCount;
          isCarousel = media.__typename === "GraphSidecar";
          source = "embed";
        }
      }
    } catch (_) {}
  }

  // --------------------------------------------------
  // RESPONSE
  // --------------------------------------------------
  if (!items.length) {
    return res.status(404).json({
      success: false,
      error: blocked
        ? "Instagram blocked this server. Set IG_SESSIONID or pass X-IG-Cookie."
        : "No media found — the post may be private, deleted, or a story/highlight (not supported)."
    });
  }

  owner = username ? "@" + username : owner;

  // ?download=1&index=N → 302 redirect straight to that file
  if (req.query.download && items[0]) {
    const idx = parseInt(req.query.index, 10) || 1;
    return res.redirect(302, items[idx - 1]?.url || items[0].url);
  }

  const payload = {
    success: true,
    p: true,
    app: APP,
    made_by: MADE_BY,
    type,
    shortcode,
    owner,
    username,
    caption,
    likeCount,
    isCarousel,
    image: items.filter((i) => i.type === "image").map((i) => i.url),
    video: items.filter((i) => i.type === "video").map((i) => i.url),
    media: items,
    totalMedia: items.length,
    source
  };

  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  if (req.query.pretty) {
    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(JSON.stringify(payload, null, 2));
  }
  return res.status(200).json(payload);
}

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function shortcodeToId(code) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let id = 0n;
  for (const c of code) id = id * 64n + BigInt(alphabet.indexOf(c));
  return id.toString();
}

function pickBest(candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return null;
  return candidates.reduce((a, b) => ((b.width || 0) > (a.width || 0) ? b : a));
}

function mediaToItems(media) {
  const items = [];
  const push = (node) => items.push({
    type: node.is_video ? "video" : "image",
    url: node.is_video ? node.video_url || node.video_versions?.[0]?.url || node.display_url : node.display_url,
    width: node.dimensions?.width || null,
    height: node.dimensions?.height || null,
    extension: node.is_video ? "mp4" : "jpg"
  });
  if (media.edge_sidecar_to_children?.edges?.length) {
    for (const e of media.edge_sidecar_to_children.edges) push(e.node);
  } else {
    push(media);
  }
  return items;
}

function metaContent(html, prop) {
  const m = html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)|` +
               `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i")
  );
  return m ? (m[1] || m[2]) : null;
}

function decodeEntities(s) {
  if (typeof window !== "undefined" && window.DOMParser) {
    return new DOMParser().parseFromString(s, "text/html").documentElement.textContent || s;
  }
  return s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
          .replace(/&amp;/g, "&").replace(/&#x2019;/g, "’");
}

function parseLikeCount(desc) {
  const m = desc.match(/([\d.,]+)\s*([KMB]?)\s*likes/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  if (m[2].toUpperCase() === "K") return Math.round(n * 1e3);
  if (m[2].toUpperCase() === "M") return Math.round(n * 1e6);
  if (m[2].toUpperCase() === "B") return Math.round(n * 1e9);
  return Math.round(n);
}

function scanBalancedJson(html, openIndex) {
  let depth = 0, inString = false, escaped = false;
  for (let i = openIndex; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return html.slice(openIndex, i + 1);
    }
  }
  return null;
}

function extractShortcodeMedia(html) {
  let from = 0;
  while (true) {
    const marker = html.indexOf("__additionalDataLoaded", from);
    if (marker === -1) return null;
    const open = html.indexOf("{", marker);
    const jsonStr = open !== -1 ? scanBalancedJson(html, open) : null;
    if (jsonStr) {
      try {
        const data = JSON.parse(jsonStr);
        if (data?.graphql?.shortcode_media) return data.graphql.shortcode_media;
      } catch (_) {}
    }
    from = marker + 1;
  }
}

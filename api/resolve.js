// api/resolve.js

export default async function handler(req, res) {
  // --------------------------------------------------
  // CORS
  // --------------------------------------------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

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
  // FETCH MEDIA DATA FROM INSTAGRAM
  // --------------------------------------------------
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  const headers = { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" };

  let media = null;
  let html = "";

  try {
    const embedRes = await fetch(`https://www.instagram.com/p/${shortcode}/embed/captioned/`, { headers });
    if (embedRes.ok) {
      html = await embedRes.text();
      media = extractShortcodeMedia(html);
    }
  } catch (_) {}

  // Fallback: scrape og:image from the normal post page
  if (!media) {
    try {
      const pageRes = await fetch(`https://www.instagram.com/p/${shortcode}/`, { headers });
      if (pageRes.ok) html = await pageRes.text();
      const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
      if (og) media = { display_url: og[1], is_video: false };
    } catch (_) {}
  }

  if (!media) {
    return res.status(404).json({
      success: false,
      error: "No media found — Instagram may be blocking this server"
    });
  }

  // --------------------------------------------------
  // BUILD MEDIA LIST (single image, reel, or carousel)
  // --------------------------------------------------
  const items = [];
  const push = (node) => {
    items.push({
      type: node.is_video ? "video" : "image",
      url: node.is_video ? node.video_url || node.video_versions?.[0]?.url || node.display_url : node.display_url,
      width: node.dimensions?.width || null,
      height: node.dimensions?.height || null
    });
  };

  if (media.edge_sidecar_to_children?.edges?.length) {
    for (const edge of media.edge_sidecar_to_children.edges) push(edge.node);
  } else {
    push(media);
  }

  // Optional: ?download=1 redirects straight to the media file
  if (req.query.download && items[0]) {
    return res.redirect(302, items[0].url);
  }

  // --------------------------------------------------
  // RESPONSE
  // --------------------------------------------------
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  return res.status(200).json({
    success: true,
    type,
    shortcode,
    username: media.owner?.username || null,
    caption: media.edge_media_to_caption?.edges?.[0]?.node?.text || "",
    likeCount: media.edge_media_preview_like?.count ?? null,
    media: items
  });
}

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

// Instagram embeds post data as:
//   window.__additionalDataLoaded('extra', { "config": ... });
// The JSON is deeply nested, so count braces (respecting strings) instead of regexing.
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

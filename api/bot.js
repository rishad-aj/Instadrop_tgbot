// api/resolve.js

export default async function handler(req, res) {
  // ==================================================
  // CORS
  // ==================================================

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-IG-Cookie"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  // ==================================================
  // URL
  // ==================================================

  const inputUrl = req.query.url;

  if (!inputUrl) {
    return res.status(400).json({
      success: false,
      error: "Missing Instagram URL"
    });
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(inputUrl);
  } catch {
    return res.status(400).json({
      success: false,
      error: "Invalid URL"
    });
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (
    hostname !== "instagram.com" &&
    hostname !== "www.instagram.com" &&
    hostname !== "m.instagram.com"
  ) {
    return res.status(400).json({
      success: false,
      error: "URL is not an Instagram URL"
    });
  }

  // ==================================================
  // EXTRACT SHORTCODE
  // ==================================================

  const match = parsedUrl.pathname.match(
    /\/(?:p|reel|reels|tv|stories)\/([A-Za-z0-9_-]+)/
  );

  if (!match) {
    return res.status(400).json({
      success: false,
      error: "Could not extract Instagram shortcode"
    });
  }

  const shortcode = match[1];

  // ==================================================
  // HEADERS
  //
  // X-IG-Cookie can optionally be supplied by your
  // frontend/server.
  // ==================================================

  const userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/124.0.0.0 Safari/537.36";

  const xIgAppId =
    "936619743392459";

  const headers = {
    "User-Agent": userAgent,
    "X-IG-App-ID": xIgAppId,
    "Accept": "*/*",
    "Sec-Fetch-Site": "same-origin"
  };

  if (req.headers["x-ig-cookie"]) {
    headers["Cookie"] = req.headers["x-ig-cookie"];
  }

  // ==================================================
  // RESULT
  // ==================================================

  let media = null;
  let lastError = null;

  // ==================================================
  // METHOD 1
  //
  // Instagram Magic Parameters
  //
  // ?__a=1&__d=dis
  // ==================================================

  try {
    const apiUrl =
      `https://www.instagram.com/p/${shortcode}/` +
      `?__a=1&__d=dis`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers
    });

    if (response.ok) {
      const json = await response.json();

      if (json?.items?.[0]) {
        media = json.items[0];
      }
    } else {
      lastError = `Magic Parameters returned ${response.status}`;
    }
  } catch (error) {
    lastError = error;
  }

  // ==================================================
  // METHOD 2
  //
  // Instagram GraphQL
  //
  // This is the method used by the GitHub project.
  // ==================================================

  if (!media) {
    try {
      const graphqlUrl = new URL(
        "https://www.instagram.com/api/graphql"
      );

      graphqlUrl.searchParams.set(
        "variables",
        JSON.stringify({
          shortcode
        })
      );

      graphqlUrl.searchParams.set(
        "doc_id",
        "10015901848480474"
      );

      graphqlUrl.searchParams.set(
        "lsd",
        "AVqbxe3J_YA"
      );

      const response = await fetch(
        graphqlUrl.toString(),
        {
          method: "POST",

          headers: {
            ...headers,
            "Content-Type":
              "application/x-www-form-urlencoded",
            "X-FB-LSD":
              "AVqbxe3J_YA",
            "X-ASBD-ID":
              "129477"
          }
        }
      );

      if (response.ok) {
        const json = await response.json();

        media =
          json?.data?.xdt_shortcode_media ||
          null;
      } else {
        lastError =
          `GraphQL returned ${response.status}`;
      }
    } catch (error) {
      lastError = error;
    }
  }

  // ==================================================
  // NOTHING FOUND
  // ==================================================

  if (!media) {
    return res.status(404).json({
      success: false,
      error:
        "Unable to resolve this Instagram media",
      details:
        process.env.NODE_ENV === "development"
          ? String(lastError || "")
          : undefined
    });
  }

  // ==================================================
  // OWNER
  // ==================================================

  let owner = null;

  if (media?.user?.username) {
    owner = "@" + media.user.username;
  } else if (media?.owner?.username) {
    owner = "@" + media.owner.username;
  }

  // ==================================================
  // MEDIA ARRAYS
  // ==================================================

  const images = [];
  const videos = [];

  // ==================================================
  // HELPER
  // ==================================================

  function addMedia(item) {
    if (!item) return;

    // ----------------------------------------------
    // VIDEO
    // ----------------------------------------------

    if (
      item.is_video === true ||
      item.video_url ||
      item.video_versions?.length
    ) {
      const videoUrl =
        item.video_url ||
        item.video_versions?.[0]?.url;

      if (videoUrl) {
        videos.push(videoUrl);
        return;
      }
    }

    // ----------------------------------------------
    // IMAGE
    // ----------------------------------------------

    const imageUrl =
      item.display_url ||
      item.image_versions2?.candidates?.[0]?.url ||
      item.image_versions?.candidates?.[0]?.url;

    if (imageUrl) {
      images.push(imageUrl);
    }
  }

  // ==================================================
  // CAROUSEL
  //
  // Instagram GraphQL:
  //
  // edge_sidecar_to_children.edges[]
  //
  // Magic Parameters:
  //
  // carousel_media[]
  // ==================================================

  if (
    media?.edge_sidecar_to_children?.edges?.length
  ) {
    for (
      const edge of media.edge_sidecar_to_children.edges
    ) {
      addMedia(edge.node);
    }
  }

  // ==================================================
  // MAGIC PARAMETERS CAROUSEL
  // ==================================================

  else if (
    media?.product_type === "carousel_container" &&
    Array.isArray(media.carousel_media)
  ) {
    for (const item of media.carousel_media) {
      addMedia(item);
    }
  }

  // ==================================================
  // SINGLE MEDIA
  // ==================================================

  else {
    addMedia(media);
  }

  // ==================================================
  // REMOVE DUPLICATES
  // ==================================================

  const uniqueImages = [
    ...new Set(images)
  ];

  const uniqueVideos = [
    ...new Set(videos)
  ];

  // ==================================================
  // NO MEDIA
  // ==================================================

  if (
    !uniqueImages.length &&
    !uniqueVideos.length
  ) {
    return res.status(404).json({
      success: false,
      error: "No downloadable media found"
    });
  }

  // ==================================================
  // POST / REEL TYPE
  // ==================================================

  const isPost =
    parsedUrl.pathname.startsWith("/p/");

  // ==================================================
  // RESPONSE
  //
  // This intentionally follows the structure you
  // showed from the working resolver.
  // ==================================================

  const result = {
    p: isPost,

    image: uniqueImages,

    made_by: "Instadrop ♥️",

    owner
  };

  // Only include video when there are videos.
  if (uniqueVideos.length) {
    result.video = uniqueVideos;
  }

  // ==================================================
  // OPTIONAL METADATA
  //
  // Kept separate so your existing frontend can
  // continue using image[] / video[].
  // ==================================================

  if (media?.caption?.text) {
    result.caption = media.caption.text;
  }

  if (
    media?.edge_media_to_caption?.edges?.[0]
      ?.node?.text
  ) {
    result.caption =
      media.edge_media_to_caption.edges[0]
        .node.text;
  }

  // ==================================================
  // CACHE
  // ==================================================

  res.setHeader(
    "Cache-Control",
    "public, max-age=300, s-maxage=3600"
  );

  return res.status(200).json(result);
}

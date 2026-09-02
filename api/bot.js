// InstaDrop — Instagram media resolver API
// Created by Muhammed Rishad AJ
//
// Next.js App Router route handler → put at  app/api/resolve/route.js
// Usage:
//   GET /api/resolve?url=https://www.instagram.com/p/CODE/
//   GET /api/resolve?url=...&download=1&index=0    (302-redirect to that slide's file)
//   GET /api/resolve?url=...&pretty=1              (pretty-printed JSON)
//   POST /api/resolve   body: { url, cookie? }
//
// HOW IT WORKS (verified Sep 2026):
//   1. ANONYMOUS PATH (always works): Instagram's public oEmbed endpoint
//      (www.instagram.com/api/v1/oembed/?url=) returns owner, caption and
//      thumbnail. The first/largest slide is fetched via
//      /p/CODE/media/?size=l  (or og:image).
//      ⚠ Instagram NO LONGER exposes carousel (multi-image) content to anonymous
//      requests — every legacy trick (?__a=1, __additionalDataLoaded JSON,
//      GraphQL doc_ids, /api/v1/media/{id}/info/ without a session) is dead or
//      auth-gated. So anonymously you get the FIRST slide only (status:"partial").
//   2. FULL PATH (every slide + video): set the IG_SESSIONID env var to YOUR OWN
//      instagram.com `sessionid` cookie (log in at instagram.com → DevTools →
//      Application → Cookies → sessionid). The API then calls
//      /api/v1/media/{id}/info/ with that session and returns the complete
//      carousel. You can also pass a cookie per-request via the `X-IG-Cookie`
//      header (or body.cookie on POST).

export const maxDuration = 60;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const MADE_BY = "InstaDrop — Created by Muhammed Rishad AJ";

function extractCode(url) {
  if (typeof url !== "string") return null;
  const clean = url.split(/[?#]/)[0];
  const m = clean.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  const m2 = clean.match(/\/[A-Za-z0-9_]+\/([A-Za-z0-9_-]{5,})\/?$/);
  if (m2) return m2[1];
  const last = clean.split("/").filter(Boolean).pop() || "";
  if (/^[A-Za-z0-9_-]{5,}$/.test(last)) return last;
  return null;
}

function bestCandidate(candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return null;
  return candidates.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
}

function ok(data, { status = 200, pretty = false } = {}) {
  return new Response(JSON.stringify(data, null, pretty ? 2 : 0), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function fail(message, status = 400, extra = {}) {
  return ok({ p: false, error: message, made_by: MADE_BY, ...extra }, { status });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-IG-Cookie",
    },
  });
}

export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }

async function handle(req) {
  try {
    const u = new URL(req.url);
    let input = u.searchParams.get("url");
    let cookie = process.env.IG_SESSIONID || null;
    const pretty = u.searchParams.has("pretty");

    if (req.method === "POST") {
      try {
        const body = await req.json();
        input = input || body.url || body.link || body.ig || null;
        cookie = cookie || body.cookie || null;
      } catch { /* not JSON */ }
    }
    cookie = req.headers.get("x-ig-cookie") || cookie;

    const code = extractCode(input);
    if (!code) return fail("Invalid Instagram URL. Use ?url=https://www.instagram.com/p/CODE/ or a /reel/ link.");
    const postUrl = `https://www.instagram.com/p/${code}/`;

    // 1) metadata via public oEmbed (anonymous, reliable)
    const oembed = await fetch(
      `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(postUrl)}`,
      { headers: { "User-Agent": UA, Accept: "application/json" } }
    ).then((r) => (r.ok ? r.json() : null)).catch(() => null);

    const mediaId = oembed?.media_id || null; // "pk_userid"
    const pk = mediaId ? String(mediaId).split("_")[0] : null;

    // 2) full media (every slide) — needs a session
    let source = "oembed";
    let items = null;
    if (cookie && pk) {
      items = await fetchMediaInfo(pk, cookie);
      if (items) source = "session";
    }

    if (items && items.length) {
      const built = buildFromItems(items);
      return finish(
        {
          p: true,
          status: "success",
          type: built.type,
          image: built.image,
          video: built.video,
          media: built.media,
          caption: oembed?.title ?? built.caption ?? "",
          owner: {
            username: oembed?.author_name ?? built.username ?? "",
            full_name: built.full_name ?? "",
            id: oembed?.author_id ?? built.user_id ?? "",
          },
          code,
          media_id: mediaId ?? built.pk ?? "",
          source,
          made_by: MADE_BY,
        },
        u,
        pretty
      );
    }

    // 3) anonymous fallback — first/largest slide only
    const first = await fetchFirstSlide(code, oembed?.thumbnail_url);
    const res = {
      p: true,
      status: "partial",
      image: first.image,
      video: first.video,
      media: first.image.map((url, i) => ({ index: i, type: "image", url }))
        .concat(first.video.map((url, i) => ({ index: i, type: "video", url }))),
      caption: oembed?.title ?? "",
      owner: { username: oembed?.author_name ?? "", full_name: "", id: oembed?.author_id ?? "" },
      code,
      media_id: mediaId ?? "",
      source,
      partial: true,
      note: "Instagram hides carousel slides behind a login. Set the IG_SESSIONID env var to get every image/video — anonymously only the first (largest) slide is available.",
      made_by: MADE_BY,
    };
    if (!first.image.length && !first.video.length) {
      return fail("Could not fetch this post. It may be private, deleted, or rate-limited.", 404, { code });
    }
    return finish(res, u, pretty);
  } catch (e) {
    return fail("Internal error: " + (e && e.message), 500);
  }
}

async function fetchMediaInfo(pk, cookie) {
  const res = await fetch(`https://www.instagram.com/api/v1/media/${pk}/info/`, {
    headers: {
      "User-Agent": UA,
      Cookie: cookie,
      "X-IG-App-ID": "936619743392459",
      "X-ASBD-ID": "129477",
      "X-IG-WWW-Claim": "0",
      Accept: "*/*",
    },
  });
  if (!res.ok) return null;
  const j = await res.json().catch(() => null);
  if (!j || !Array.isArray(j.items) || !j.items.length) return null;
  return j.items;
}

function buildFromItems(items) {
  const image = [], video = [], media = [];
  let type = "single", caption = "", username = "", full_name = "", user_id = "", pk = "";

  const walk = (item, index) => {
    const mt = item.media_type; // 1 image, 2 video, 8 carousel
    if (mt === 8 && Array.isArray(item.carousel_media)) {
      type = "carousel";
      item.carousel_media.forEach((c, i) => walk(c, i));
      return;
    }
    if (mt === 2 || (item.video_versions && item.video_versions.length)) {
      const v = bestCandidate(item.video_versions);
      if (v) {
        video.push(v.url);
        media.push({ index: index ?? video.length - 1, type: "video", url: v.url });
      } else {
        const img = bestCandidate(item.image_versions2?.candidates);
        if (img) {
          image.push(img.url);
          media.push({ index: index ?? image.length - 1, type: "image", url: img.url });
        }
      }
      return;
    }
    const img = bestCandidate(item.image_versions2?.candidates);
    if (img) {
      image.push(img.url);
      media.push({ index: index ?? image.length - 1, type: "image", url: img.url });
    }
  };

  for (const it of items) {
    if (it.caption?.text) caption = it.caption.text;
    if (it.user) {
      username = it.user.username || username;
      full_name = it.user.full_name || full_name;
      user_id = it.user.pk || user_id;
    }
    if (it.pk) pk = it.pk;
    walk(it);
  }
  return { type, image, video, media, caption, username, full_name, user_id, pk };
}

async function fetchFirstSlide(code, thumbUrl) {
  const image = [], video = [];
  try {
    const r = await fetch(`https://www.instagram.com/p/${code}/media/?size=l`, {
      redirect: "follow",
      headers: { "User-Agent": UA },
    });
    if (r.ok) {
      const ct = r.headers.get("content-type") || "";
      const finalUrl = r.url;
      if (ct.startsWith("video") || /\.mp4/i.test(finalUrl)) video.push(finalUrl);
      else image.push(finalUrl);
    }
  } catch { /* try next */ }
  if (!image.length && !video.length && thumbUrl) image.push(thumbUrl);
  if (!image.length && !video.length) {
    try {
      const html = await fetch(`https://www.instagram.com/p/${code}/`, {
        headers: { "User-Agent": UA },
      }).then((r) => r.text()).catch(() => "");
      const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      if (og) image.push(og[1]);
    } catch { /* give up */ }
  }
  return { image, video };
}

function finish(res, u, pretty) {
  const dl = u.searchParams.get("download");
  if (dl !== null && dl !== undefined && dl !== "") {
    const idx = parseInt(dl, 10) || 0;
    const list = res.media && res.media.length ? res.media : res.image;
    const target = list[idx];
    if (target && target.url) return Response.redirect(target.url, 302);
    return fail("Invalid index for download", 400, { code: res.code });
  }
  return ok(res, { pretty });
}

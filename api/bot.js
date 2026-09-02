const BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s";
const START_IMAGE_URL = "https://instadrop.web.app/og-image.png";

const bot = new Bot(BOT_TOKEN);

// ----------------------------------------------------
// HTTP HELPERS
// ----------------------------------------------------

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36";
const REQUEST_TIMEOUT = 12000;
const MAX_TELEGRAM_FILE = 50 * 1024 * 1024;

async function fetchWithTimeout(url, options = &#123;&#125;) &#123;
  const controller = new AbortController();
  const timer = setTimeout(
    () =&gt; controller.abort(),
    options.timeout || REQUEST_TIMEOUT
  );
  try &#123;
    return await fetch(url, &#123; ...options, signal: controller.signal &#125;);
  &#125; finally &#123;
    clearTimeout(timer);
  &#125;
&#125;

async function getText(url) &#123;
  const res = await fetchWithTimeout(url, &#123;
    headers: &#123; "User-Agent": USER_AGENT, Accept: "application/json,text/html,*/*" &#125;,
  &#125;);
  if (!res.ok) throw new Error(`HTTP $&#123;res.status&#125;`);
  return await res.text();
&#125;

async function getJson(url) &#123;
  return JSON.parse(await getText(url));
&#125;

async function postJson(url, body) &#123;
  const res = await fetchWithTimeout(url, &#123;
    method: "POST",
    headers: &#123; "Content-Type": "application/json", "User-Agent": USER_AGENT &#125;,
    body: JSON.stringify(body),
  &#125;);
  if (!res.ok) throw new Error(`HTTP $&#123;res.status&#125;`);
  const text = await res.text();
  try &#123;
    return JSON.parse(text);
  &#125; catch &#123;
    return text;
  &#125;
&#125;

// ----------------------------------------------------
// URL HELPERS
// ----------------------------------------------------

function cleanUrl(url) &#123;
  return String(url || "")
    .trim()
    .replace(/&#91;?#&#93;.*$/, "")
    .replace(/\/+$/, "");
&#125;

function decodeEntities(s) &#123;
  return String(s || "")
    .replace(/&amp;amp;/g, "&amp;")
    .replace(/&amp;quot;/g, '"')
    .replace(/&amp;#39;/g, "'")
    .replace(/&amp;lt;/g, "&lt;")
    .replace(/&amp;gt;/g, "&gt;");
&#125;

const RESERVED_WORDS = new Set(&#91;
  "reel", "reels", "p", "tv", "stories", "story", "highlights",
  "s", "explore", "accounts", "about", "directory",
&#93;);

// Returns &#123; kind: "reel"|"post"|"story"|"highlight"|"profile", ... &#125; or null
function parseInput(raw) &#123;
  const s = String(raw || "").trim().replace(/^@/, "");
  if (!s) return null;

  if (/instagram\.com\/stories\/highlights\//i.test(s)) &#123;
    return &#123; kind: "highlight", url: cleanUrl(s) &#125;;
  &#125;
  if (/instagram\.com\/(stories|story)\//i.test(s)) &#123;
    return &#123; kind: "story", url: cleanUrl(s) &#125;;
  &#125;

  const post = s.match(
    /instagram\.com\/(?:&#91;A-Za-z0-9._&#93;&#123;1,30&#125;\/)?(reel|reels|p|tv)\/(&#91;A-Za-z0-9_-&#93;+)/i
  );
  if (post) &#123;
    return &#123;
      kind: /^reel/i.test(post&#91;1&#93;) ? "reel" : "post",
      code: post&#91;2&#93;,
    &#125;;
  &#125;

  const prof = s.match(
    /instagram\.com\/(&#91;A-Za-z0-9._&#93;&#123;1,30&#125;)\/?(?:\?.*)?$/i
  );
  if (prof &amp;&amp; !RESERVED_WORDS.has(prof&#91;1&#93;.toLowerCase())) &#123;
    return &#123; kind: "profile", username: prof&#91;1&#93; &#125;;
  &#125;

  if (/^&#91;A-Za-z0-9._&#93;&#123;1,30&#125;$/.test(s) &amp;&amp; !RESERVED_WORDS.has(s.toLowerCase())) &#123;
    return &#123; kind: "profile", username: s &#125;;
  &#125;

  return null;
&#125;

// ----------------------------------------------------
// RESPONSE PARSERS (match the real API shapes)
// ----------------------------------------------------

// Generic deep scan — handles most JSON APIs (anon-social, ddvideo,
// snapinsta, indown) AND thakur's shapes:
//   post:  &#123; "p": true, "image": &#91;"https://...jpg", ...&#93; &#125;
//   reel:  &#123; "video": &#91; &#123; "video": "...mp4", "thumbnail": "..." &#125; &#93; &#125;
function jsonToItems(data) &#123;
  const items = &#91;&#93;;
  const seen = new Set();
  const usedThumbs = new Set();

  const push = (raw, thumb, type) =&gt; &#123;
    const u = cleanUrl(raw);
    if (!/^https?:\/\//i.test(u)) return;
    // A URL used as a video thumbnail is a preview, not a separate media item.
    if (type === "image" &amp;&amp; usedThumbs.has(u)) return;
    if (seen.has(u)) return;
    seen.add(u);
    const finalType =
      type || (/\.(mp4|mov|webm)(\?|&amp;|$)/i.test(u) ? "video" : "image");
    if (finalType === "video" &amp;&amp; thumb) usedThumbs.add(cleanUrl(thumb));
    items.push(&#123; url: u, type: finalType, thumb: thumb ? cleanUrl(thumb) : null &#125;);
  &#125;;

  const scan = (o) =&gt; &#123;
    if (!o || typeof o !== "object") return;

    if (Array.isArray(o)) &#123;
      for (const v of o) &#123;
        if (typeof v === "string") &#123;
          if (/^https?:\/\//i.test(v)) push(v, null);
        &#125; else &#123;
          scan(v);
        &#125;
      &#125;
      return;
    &#125;

    if (typeof o.url === "string") push(o.url, o.thumb || o.thumbnail || o.img);
    if (typeof o.video === "string") push(o.video, o.thumbnail || o.thumb, "video");
    if (typeof o.video_url === "string") push(o.video_url, o.thumbnail || o.thumb || o.display_url, "video");
    if (typeof o.videoUrl === "string") push(o.videoUrl, o.thumbnail || o.thumb, "video");
    if (typeof o.download_url === "string") push(o.download_url, o.thumbnail || o.thumb);
    if (typeof o.downloadUrl === "string") push(o.downloadUrl, o.thumbnail || o.thumb);
    if (typeof o.image_url === "string") push(o.image_url, o.image_url, "image");
    if (typeof o.image === "string") push(o.image, o.image, "image");
    if (typeof o.display_url === "string") push(o.display_url, o.display_url, "image");
    if (typeof o.displayUrl === "string") push(o.displayUrl, o.displayUrl, "image");
    if (typeof o.link === "string") push(o.link, o.thumbnail || o.thumb);
    if (typeof o.thumbnail === "string") push(o.thumbnail, o.thumbnail, "image");

    if (Array.isArray(o.image)) for (const v of o.image) scan(v);
    if (Array.isArray(o.video)) for (const v of o.video) scan(v);

    if (o.image_versions2 &amp;&amp; Array.isArray(o.image_versions2.candidates)) &#123;
      const best = o.image_versions2.candidates
        .slice()
        .sort((a, b) =&gt; b.width * b.height - a.width * a.height)&#91;0&#93;;
      if (best) push(best.url, best.url, "image");
    &#125;
    if (Array.isArray(o.video_versions)) &#123;
      const best = o.video_versions
        .slice()
        .sort((a, b) =&gt; b.width * b.height - a.width * a.height)&#91;0&#93;;
      if (best) push(best.url, best.url, "video");
    &#125;

    for (const k of &#91;"media", "medias", "items", "data", "result", "results", "stories", "carousel", "edges"&#93;) &#123;
      if (o&#91;k&#93;) scan(o&#91;k&#93;);
    &#125;
    for (const v of Object.values(o)) &#123;
      if (v &amp;&amp; typeof v === "object") scan(v);
    &#125;
  &#125;;

  scan(data);
  return items;
&#125;

// mn-bots: &#123; success: true, media: &#91;&#123; type, thumb, url, server2 &#125;&#93; &#125;
function parseMnBots(text) &#123;
  let j;
  try &#123;
    j = JSON.parse(text);
  &#125; catch &#123;
    return &#91;&#93;;
  &#125;
  if (!j || j.success !== true || !Array.isArray(j.media)) return &#91;&#93;;
  const items = &#91;&#93;;
  for (const m of j.media) &#123;
    const url = cleanUrl(m.url || m.server2);
    if (!/^https?:\/\//i.test(url)) continue;
    items.push(&#123;
      url,
      type: m.type === "video" || /\.mp4(\?|&amp;|$)/i.test(url) ? "video" : "image",
      thumb: m.thumb ? cleanUrl(m.thumb) : null,
    &#125;);
  &#125;
  return items;
&#125;

// downloadgram returns a JS snippet that injects HTML:
//   loader&#91;'style'&#93;&#91;'display'&#93;='none',document&#91;'getElementById'&#93;('div_download')
//   &#91;'innerHTML'&#93;='&lt;div class="download-items"&gt;...&lt;a href="...token..."&gt;...'
// We run it with a fake document (like the site does), then regex the HTML.
function parseDownloadgram(text) &#123;
  let html = null;
  try &#123;
    const loader = &#123; style: &#123;&#125; &#125;;
    const fakeDoc = &#123;
      getElementById(id) &#123;
        if (id === "div_download") return &#123; set innerHTML(v) &#123; html = v; &#125; &#125;;
        return &#123; remove() &#123;&#125; &#125;;
      &#125;,
    &#125;;
    new Function("loader", "document", "showAd", text)(loader, fakeDoc, () =&gt; &#123;&#125;);
  &#125; catch (e) &#123;
    return &#91;&#93;;
  &#125;
  if (!html) return &#91;&#93;;

  const items = &#91;&#93;;
  const blocks = html.split('class="download-items"').slice(1);
  for (const block of blocks) &#123;
    const linkMatch = block.match(/&lt;a&#91;^&gt;&#93;*href="(&#91;^"&#93;+)"/);
    if (!linkMatch) continue;
    const imgMatch = block.match(/&lt;img&#91;^&gt;&#93;*src="(&#91;^"&#93;+)"/);
    items.push(&#123;
      url: decodeEntities(linkMatch&#91;1&#93;),
      type: /icon-ivideo/.test(block) ? "video" : "image",
      thumb: imgMatch ? decodeEntities(imgMatch&#91;1&#93;) : null,
    &#125;);
  &#125;
  return items;
&#125;

// ----------------------------------------------------
// MEDIA RESOLUTION (each type has its own API list)
// ----------------------------------------------------

function mediaCandidates(url, kind) &#123;
  const isPost = kind === "post" || kind === "reel";
  const list = &#91;
    &#123;
      name: "thakur-infopd",
      fetch: () =&gt;
        getText("https://insta.thakur-infopd.workers.dev/?url=" + encodeURIComponent(url)),
      parse: jsonToItems,
    &#125;,
    &#123;
      name: "mn-bots",
      fetch: () =&gt;
        getText("https://instagram-downloader.mn-bots.workers.dev/?url=" + encodeURIComponent(url)),
      parse: parseMnBots,
    &#125;,
    &#123;
      name: "anon-social",
      fetch: () =&gt;
        getText("https://anon-social-info.vercel.app/igdl?key=igdl305&amp;url=" + encodeURIComponent(url)),
      parse: jsonToItems,
    &#125;,
  &#93;;

  if (isPost) &#123;
    list.push(&#123;
      name: "downloadgram",
      fetch: async () =&gt; &#123;
        const res = await fetchWithTimeout("https://api.downloadgram.org/media", &#123;
          method: "POST",
          headers: &#123; "Content-Type": "application/json", "User-Agent": USER_AGENT &#125;,
          body: JSON.stringify(&#123; url &#125;),
        &#125;);
        if (!res.ok) throw new Error(`HTTP $&#123;res.status&#125;`);
        return await res.text();
      &#125;,
      parse: parseDownloadgram,
    &#125;);
  &#125;

  list.push(
    &#123;
      name: "ddvideo",
      fetch: () =&gt;
        getText("https://api.dd.video/api/instagram?url=" + encodeURIComponent(url)),
      parse: jsonToItems,
    &#125;,
    &#123;
      name: "snapinsta",
      fetch: () =&gt;
        getText("https://snapinsta.app/api/instagram?url=" + encodeURIComponent(url)),
      parse: jsonToItems,
    &#125;,
    &#123;
      name: "indown",
      fetch: () =&gt;
        getText("https://indown.io/api/info?url=" + encodeURIComponent(url)),
      parse: jsonToItems,
    &#125;
  );

  return list;
&#125;

// Try each API in order until one returns media.
async function firstWorking(candidates) &#123;
  for (const c of candidates) &#123;
    try &#123;
      const text = await c.fetch();
      const items = c.parse(text);
      if (items &amp;&amp; items.length) &#123;
        const seen = new Set();
        return items.filter((i) =&gt; &#123;
          if (seen.has(i.url)) return false;
          seen.add(i.url);
          return true;
        &#125;);
      &#125;
    &#125; catch (e) &#123;
      // try the next candidate
    &#125;
  &#125;
  return &#91;&#93;;
&#125;

async function resolveMedia(url, kind) &#123;
  const items = await firstWorking(mediaCandidates(url, kind));
  if (!items.length) &#123;
    throw new Error(
      "Could not resolve this Instagram link — the free services are busy right now. Try again in a moment."
    );
  &#125;
  return items;
&#125;

// ----------------------------------------------------
// PROFILE PICTURE (DP)
// ----------------------------------------------------

function deepFindKey(o, key) &#123;
  if (!o || typeof o !== "object") return null;
  if (Array.isArray(o)) &#123;
    for (const v of o) &#123;
      const r = deepFindKey(v, key);
      if (r) return r;
    &#125;
    return null;
  &#125;
  for (const &#91;k, v&#93; of Object.entries(o)) &#123;
    if (k === key) return v;
    const r = deepFindKey(v, key);
    if (r) return r;
  &#125;
  return null;
&#125;

function jsonScriptBlocks(html) &#123;
  const blocks = &#91;&#93;;
  const re = /&lt;script type="application\/json"&#91;^&gt;&#93;*&gt;(&#91;\s\S&#93;*?)&lt;\/script&gt;/g;
  let m;
  while ((m = re.exec(html))) &#123;
    const text = m&#91;1&#93;.trim();
    if (!text) continue;
    try &#123;
      blocks.push(JSON.parse(text));
    &#125; catch (e) &#123;&#125;
  &#125;
  return blocks;
&#125;

// Scrape the profile page for a DIRECT scontent CDN url (Telegram can fetch these,
// unlike the tokenized urls some APIs return).
async function scrapeProfilePic(username) &#123;
  const html = await getText(
    "https://www.instagram.com/" + encodeURIComponent(username) + "/"
  );
  for (const block of jsonScriptBlocks(html)) &#123;
    const pic = deepFindKey(block, "profile_pic_url");
    if (typeof pic === "string" &amp;&amp; /^https?:\/\//i.test(pic)) &#123;
      return cleanUrl(pic);
    &#125;
  &#125;
  return null;
&#125;

// Returns &#123; candidates, direct &#125; — urls the BOT can download, and urls
// Telegram itself can fetch directly (direct CDN urls, not tokenized ones).
async function resolveProfilePic(username) &#123;
  const candidates = &#91;&#93;;
  const direct = &#91;&#93;;
  const push = (u, isDirect) =&gt; &#123;
    const c = cleanUrl(u);
    if (!c || !/^https?:\/\//i.test(c)) return;
    if (!candidates.includes(c)) candidates.push(c);
    if (isDirect &amp;&amp; !direct.includes(c)) direct.push(c);
  &#125;;

  // 1) greatonlinetools (POST) — tokenized urls, bot must download + re-upload
  try &#123;
    const data = await postJson(
      "https://greatonlinetools.com/endpoints-tools/endpoint.php",
      &#123; username &#125;
    );
    if (data &amp;&amp; data.status) &#123;
      push(data.downloadUrl || data.profilePictureUrl, false);
    &#125;
  &#125; catch (e) &#123;&#125;

  // 2) direct scrape of the profile page — gives a clean scontent CDN url
  try &#123;
    const pic = await scrapeProfilePic(username);
    if (pic) push(pic, true);
  &#125; catch (e) &#123;&#125;

  // 3) insta-profile-info worker — fallback
  try &#123;
    const data = await getJson(
      "https://bj-insta-profile-info.mmabbas011687.workers.dev/info?username=" +
        encodeURIComponent(username)
    );
    if (data &amp;&amp; data.pic) push(data.pic, true);
  &#125; catch (e) &#123;&#125;

  if (!candidates.length) &#123;
    throw new Error("Couldn't find a profile picture for @" + username + ".");
  &#125;
  return &#123; candidates, direct &#125;;
&#125;

// ----------------------------------------------------
// DOWNLOAD MEDIA
// ----------------------------------------------------

async function downloadMedia(url) &#123;
  const res = await fetchWithTimeout(url, &#123;
    headers: &#123; "User-Agent": USER_AGENT &#125;,
    timeout: 30000,
  &#125;);
  if (!res.ok) throw new Error(`Media HTTP $&#123;res.status&#125;`);

  const contentLength = Number(res.headers.get("content-length") || 0);
  if (contentLength &gt; MAX_TELEGRAM_FILE) &#123;
    throw new Error("File is larger than Telegram's 50 MB limit.");
  &#125;

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length &gt; MAX_TELEGRAM_FILE) &#123;
    throw new Error("File is larger than Telegram's 50 MB limit.");
  &#125;

  return &#123; buffer, contentType: res.headers.get("content-type") || "" &#125;;
&#125;

// ----------------------------------------------------
// /start
// ----------------------------------------------------

bot.command("start", async (ctx) =&gt; &#123;
  const caption =
    "👋 &lt;b&gt;Welcome to Instadrop!&lt;/b&gt;\n\n" +
    "I download Instagram media for you — just send me a link.\n\n" +
    "📥 &lt;b&gt;What I support:&lt;/b&gt;\n" +
    "🎬 Reels &amp; Posts\n" +
    "🖼️ Carousels (multi-image posts)\n" +
    "📖 Stories &amp; Highlights\n" +
    "👤 Profile pictures\n\n" +
    "&lt;b&gt;Examples:&lt;/b&gt;\n" +
    "https://www.instagram.com/reel/XXXXXXXX/\n" +
    "https://www.instagram.com/p/XXXXXXXX/\n" +
    "@username\n\n" +
    "Just paste a link and I'll handle the rest! 🚀";

  try &#123;
    const img = await downloadMedia(START_IMAGE_URL);
    await ctx.replyWithPhoto(new InputFile(img.buffer, "instadrop_welcome.jpg"), &#123;
      caption,
      parse_mode: "HTML",
      reply_markup: &#123;
        inline_keyboard: &#91;
          &#91;&#123; text: "❓ How to use", callback_data: "howto" &#125;&#93;,
        &#93;,
      &#125;,
    &#125;);
  &#125; catch (e) &#123;
    await ctx.reply(caption, &#123; parse_mode: "HTML" &#125;);
  &#125;
&#125;);

bot.callbackQuery("howto", async (ctx) =&gt; &#123;
  await ctx.answerCallbackQuery(&#123;
    text: "Send an Instagram link (reel, post, story, highlight) or a @username for a profile pic.",
    show_alert: true,
  &#125;);
&#125;);

// ----------------------------------------------------
// /help
// ----------------------------------------------------

bot.command("help", async (ctx) =&gt; &#123;
  await ctx.reply(
    "📥 &lt;b&gt;Instadrop Bot&lt;/b&gt;\n\n" +
      "Send me an Instagram link and I'll download it for you.\n\n" +
      "🎬 &lt;b&gt;Reels / Posts:&lt;/b&gt;\n" +
      "https://www.instagram.com/reel/...\n" +
      "https://www.instagram.com/p/...\n\n" +
      "📖 &lt;b&gt;Stories / Highlights:&lt;/b&gt;\n" +
      "https://www.instagram.com/stories/...\n" +
      "https://www.instagram.com/stories/highlights/...\n\n" +
      "👤 &lt;b&gt;Profile picture:&lt;/b&gt;\n" +
      "https://www.instagram.com/username/\n" +
      "or just send @username",
    &#123; parse_mode: "HTML" &#125;
  );
&#125;);

// ----------------------------------------------------
// HANDLE MESSAGE
// ----------------------------------------------------

bot.on("message:text", async (ctx) =&gt; &#123;
  const text = ctx.message.text.trim();

  const urlMatch = text.match(/https?:\/\/&#91;^\s&#93;+/i);
  const parsed = parseInput(urlMatch ? urlMatch&#91;0&#93; : text);

  if (!parsed) &#123;
    await ctx.reply(
      "❌ Send a valid Instagram link (reel, post, story, highlight) or a username.\n\n" +
        "Example: https://www.instagram.com/reel/XXXXXXXX/"
    );
    return;
  &#125;

  if (parsed.kind === "profile") &#123;
    await handleProfile(ctx, parsed.username);
    return;
  &#125;

  const status = await ctx.reply("⏳ Finding media...");

  try &#123;
    const url =
      parsed.kind === "post" || parsed.kind === "reel"
        ? "https://www.instagram.com/reel/" + parsed.code + "/"
        : parsed.url;

    const media = await resolveMedia(url, parsed.kind);

    await ctx.api.editMessageText(
      ctx.chat.id,
      status.message_id,
      `✅ Found $&#123;media.length&#125; media file$&#123;media.length === 1 ? "" : "s"&#125;.\n\n📤 Sending...`
    );

    let sent = 0;
    const sentHashes = new Set();

    // Download everything in parallel (faster than sequential on serverless),
    // then send in order, skipping content that is a byte-for-byte duplicate
    // (some APIs return the same image under two different urls).
    const results = await Promise.allSettled(
      media.map((item) =&gt; downloadMedia(item.url))
    );

    for (let i = 0; i &lt; results.length; i++) &#123;
      const item = media&#91;i&#93;;
      const result = results&#91;i&#93;;

      if (result.status !== "fulfilled") &#123;
        console.log("Media download failed:", item.url, result.reason &amp;&amp; result.reason.message);
        continue;
      &#125;

      const downloaded = result.value;
      const hash = createHash("sha1").update(downloaded.buffer).digest("hex");
      if (sentHashes.has(hash)) &#123;
        console.log("Duplicate media skipped:", item.url);
        continue;
      &#125;
      sentHashes.add(hash);

      try &#123;
        const extension = item.type === "video" ? "mp4" : "jpg";
        const file = new InputFile(
          downloaded.buffer,
          `instadrop_$&#123;parsed.code || "story"&#125;_$&#123;i + 1&#125;.$&#123;extension&#125;`
        );

        if (item.type === "video") &#123;
          await ctx.replyWithVideo(file, &#123;
            caption: sent === 0 ? "📥 Instadrop" : undefined,
            supports_streaming: true,
          &#125;);
        &#125; else &#123;
          await ctx.replyWithPhoto(file, &#123;
            caption: sent === 0 ? "📥 Instadrop" : undefined,
          &#125;);
        &#125;

        sent++;
      &#125; catch (error) &#123;
        console.log("Media send failed:", error.message);
      &#125;
    &#125;

    if (sent === 0) &#123;
      throw new Error("The media could not be uploaded to Telegram.");
    &#125;

    await ctx.api.editMessageText(
      ctx.chat.id,
      status.message_id,
      `✅ Done!\n\nSent $&#123;sent&#125; file$&#123;sent === 1 ? "" : "s"&#125;.`
    );
  &#125; catch (error) &#123;
    console.error(error);
    await ctx.api
      .editMessageText(ctx.chat.id, status.message_id, `❌ $&#123;error.message || "Download failed."&#125;`)
      .catch(() =&gt; &#123;&#125;);
  &#125;
&#125;);

async function handleProfile(ctx, username) &#123;
  const status = await ctx.reply(`⏳ Looking up @$&#123;username&#125;'s profile picture...`);

  try &#123;
    const &#123; candidates, direct &#125; = await resolveProfilePic(username);

    // 1) Download each candidate and re-upload as a file. This works even for
    //    tokenized urls that Telegram's servers can't fetch on their own.
    for (const url of candidates) &#123;
      try &#123;
        const downloaded = await downloadMedia(url);
        await ctx.api.editMessageText(
          ctx.chat.id,
          status.message_id,
          `✅ Found @$&#123;username&#125;'s profile picture.\n\n📤 Sending...`
        );
        await ctx.replyWithPhoto(
          new InputFile(downloaded.buffer, `$&#123;username&#125;_profile_pic.jpg`),
          &#123; caption: `👤 @$&#123;username&#125;` &#125;
        );
        await ctx.api.editMessageText(
          ctx.chat.id,
          status.message_id,
          `✅ Sent @$&#123;username&#125;'s profile picture.`
        );
        return;
      &#125; catch (e) &#123;
        console.log("DP download failed:", url, e.message);
      &#125;
    &#125;

    // 2) Last resort: let Telegram fetch the url directly (only direct CDN urls work).
    const directUrls = direct.length ? direct : candidates;
    for (const url of directUrls) &#123;
      try &#123;
        await ctx.api.editMessageText(
          ctx.chat.id,
          status.message_id,
          `✅ Sending @$&#123;username&#125;'s profile picture...`
        );
        await ctx.replyWithPhoto(url, &#123; caption: `👤 @$&#123;username&#125;` &#125;);
        await ctx.api.editMessageText(
          ctx.chat.id,
          status.message_id,
          `✅ Sent @$&#123;username&#125;'s profile picture.`
        );
        return;
      &#125; catch (e) &#123;
        console.log("DP direct send failed:", url, e.message);
      &#125;
    &#125;

    throw new Error(`Couldn't download the profile picture for @$&#123;username&#125;.`);
  &#125; catch (error) &#123;
    console.error(error);
    await ctx.api
      .editMessageText(ctx.chat.id, status.message_id, `❌ $&#123;error.message || "Could not find the profile."&#125;`)
      .catch(() =&gt; &#123;&#125;);
  &#125;
&#125;

// ----------------------------------------------------
// VERCEL WEBHOOK
// ----------------------------------------------------

export default async function handler(req, res) &#123;
  if (req.method === "GET") &#123;
    return res.status(200).json(&#123;
      ok: true,
      service: "Instadrop Telegram Bot",
    &#125;);
  &#125;

  if (req.method !== "POST") &#123;
    return res.status(405).json(&#123; ok: false, error: "Method not allowed" &#125;);
  &#125;

  try &#123;
    await webhookCallback(bot, "http")(req, res);
  &#125; catch (error) &#123;
    console.error("Telegram webhook error:", error);
    if (!res.headersSent) &#123;
      return res.status(500).json(&#123; ok: false &#125;);
    &#125;
  &#125;
&#125;

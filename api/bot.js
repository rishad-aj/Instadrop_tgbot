
/* ============================================================
   Instadrop Telegram Bot — bot.js
   Vercel serverless function. Deploy as  api/bot.js
   Requires Node 18+ (global fetch / FormData / Blob).

   Setup
     1. Create a bot with @BotFather and copy the token.
     2. Set env vars on Vercel:  BOT_TOKEN=<token>
        (optional)               ADMIN_SECRET=<random string>
     3. Deploy, then register the webhook once:
        https://<your-app>.vercel.app/api/bot?setwebhook=<ADMIN_SECRET>
        (or call Telegram setWebhook yourself with that /api/bot URL)

   What it does (ported from the Instadrop web app):
     - paste reel/post link           -> video(s) / image(s)
     - story / highlight link          -> media
     - profile link or bare username   -> HD profile picture
     - /audio <link> or the "Extract audio" button on a video -> MP3
   ============================================================ */

'use strict';

const BOT_TOKEN = "8946163976:AAEwnpQ3LuAhNp8HDMkIhi1ZbPMU4Ncsn4s";const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const API = 'https://api.telegram.org/bot' + BOT_TOKEN + '/';

const API_DG = 'https://api.downloadgram.org/media';
const FFMPEG_CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js';
const FFMPEG_WASM = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function withTimeout(promise, ms, msg) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(msg || 'Request timed out.')), ms); }),
  ]).finally(() => clearTimeout(timer));
}

/* ================= HTTP helpers ================= */

async function httpBuffer(url, opts = {}, timeoutMs = 60000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

async function httpText(url, opts = {}, timeoutMs = 25000) {
  return (await httpBuffer(url, opts, timeoutMs)).toString('utf8');
}

async function httpJson(url, opts = {}, timeoutMs = 25000) {
  return JSON.parse(await httpText(url, opts, timeoutMs));
}

async function postText(url, body) {
  const res = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify(body),
    }),
    25000,
    'service timed out'
  );
  if (!res.ok) throw new Error('HTTP ' + (res.status || 'error'));
  return await res.text();
}

/* ================= URL parsing ================= */

function extractShortcode(url) {
  const m = String(url).trim().match(/instagram\.com\/(?:[A-Za-z0-9._]{1,30}\/)?(?:reel|p|reels|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function parseInput(raw) {
  const s = String(raw).trim();
  if (/instagram\.com\/stories\/highlights\//.test(s)) return { kind: 'highlight', url: s };
  if (/instagram\.com\/stories\//.test(s)) return { kind: 'story', url: s };
  const code = extractShortcode(s);
  if (code) return { kind: 'post', code };
  const prof = s.match(/instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/);
  if (prof && !/^(reel|p|reels|tv|stories|highlights)$/.test(prof[1])) return { kind: 'dp', username: prof[1] };
  if (/^[A-Za-z0-9._]{1,30}$/.test(s)) return { kind: 'dp', username: s };
  return { kind: 'unknown' };
}

/* ================= media resolution (port from script.js) ================= */

function cleanUrl(u) { return String(u || '').replace(/\\\//g, '/').replace(/&amp;/g, '&'); }

function deepFindKey(o, key) {
  if (!o || typeof o !== 'object') return null;
  if (key in o) return o[key];
  for (const v of Object.values(o)) {
    const r = deepFindKey(v, key);
    if (r !== null && r !== undefined) return r;
  }
  return null;
}

function jsonScriptBlocks(html) {
  return (html.match(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g) || []).map((raw) => {
    const m = raw.match(/^<script type="application\/json"[^>]*>([\s\S]*?)<\/script>$/);
    return m ? m[1] : '';
  });
}

function largestCandidate(list) {
  if (!list || !list.length) return null;
  return list.reduce((a, b) => (a.height * a.width >= b.height * b.width ? a : b));
}

function normalizeItems(it) {
  const out = [];
  if (!it || typeof it !== 'object') return out;
  const img = it.image_versions2 ? largestCandidate(it.image_versions2.candidates) : null;
  const thumb = img ? img.url : it.display_url || null;
  const vid = it.video_versions ? largestCandidate(it.video_versions) : null;
  const videoUrl = vid ? vid.url : it.video_url || null;
  if (videoUrl) out.push({ kind: 'video', thumb, url: videoUrl });
  else if (thumb) out.push({ kind: 'image', thumb, url: thumb });
  if (Array.isArray(it.carousel_media)) for (const c of it.carousel_media) out.push(...normalizeItems(c));
  return out;
}

function itemsFromConnection(conn) {
  const items = [];
  for (const e of conn.edges || []) for (const it of (e.node && e.node.items) || []) items.push(...normalizeItems(it));
  return items;
}

function resolvePageFromHtml(html, keys) {
  for (const b of jsonScriptBlocks(html)) {
    let j;
    try { j = JSON.parse(b); } catch (e) { continue; }
    for (const key of keys) {
      const found = deepFindKey(j, key);
      if (!found) continue;
      if (key === 'xdt_api__v1__feed__reels_media__connection') return itemsFromConnection(found);
      if (key === 'xdt_api__v1__media__shortcode__web_info') {
        const items = [];
        for (const it of found.items || []) items.push(...normalizeItems(it));
        return items;
      }
      if (key === 'xdt_shortcode_media') return normalizeItems(found);
    }
  }
  return [];
}

function jsonToItems(text) {
  let j;
  try { j = JSON.parse(text); } catch (e) { return []; }
  const items = [];
  const seen = new Set();
  const push = (raw, thumb, kind) => {
    const u = cleanUrl(raw);
    if (!/^https?:\/\//.test(u)) return;
    if (seen.has(u)) return;
    seen.add(u);
    items.push({ kind: kind || (/\.mp4(\?|&|$)/i.test(u) ? 'video' : 'image'), thumb: thumb ? cleanUrl(thumb) : null, url: u });
  };
  const scan = (o) => {
    if (!o || typeof o !== 'object') return;
    if (typeof o.url === 'string' && /^https?:\/\//.test(o.url)) push(o.url, o.thumb || o.thumbnail || o.img);
    if (typeof o.video === 'string' && /^https?:\/\//.test(o.video)) push(o.video, o.thumbnail || o.thumb, 'video');
    if (typeof o.video_url === 'string' && /^https?:\/\//.test(o.video_url)) push(o.video_url, o.thumbnail || o.thumb || o.display_url, 'video');
    if (typeof o.image_url === 'string' && /^https?:\/\//.test(o.image_url)) push(o.image_url, o.image_url, 'image');
    if (typeof o.display_url === 'string') push(o.display_url, o.display_url, 'image');
    if (typeof o.link === 'string' && /^https?:\/\//.test(o.link)) push(o.link, o.thumbnail || o.thumb);
    if (typeof o.thumbnail === 'string' && /^https?:\/\//.test(o.thumbnail)) push(o.thumbnail, o.thumbnail, 'image');
    if (o.image_versions2 && Array.isArray(o.image_versions2.candidates)) {
      const c = o.image_versions2.candidates.slice().sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
      if (c) push(c.url, c.url, 'image');
    }
    if (Array.isArray(o.video_versions)) {
      const v = o.video_versions.slice().sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
      if (v) push(v.url, v.url, 'video');
    }
    if (Array.isArray(o.media)) { for (const m of o.media) scan(m); return; }
    if (Array.isArray(o.stories)) { for (const m of o.stories) scan(m); return; }
    if (Array.isArray(o.items)) { for (const m of o.items) scan(m); return; }
    if (Array.isArray(o.medias)) { for (const m of o.medias) scan(m); return; }
    if (Array.isArray(o.data)) { for (const m of o.data) scan(m); return; }
    if (Array.isArray(o.result)) { for (const m of o.result) scan(m); return; }
    for (const v of Object.values(o)) if (v && typeof v === 'object') scan(v);
  };
  scan(j);
  return items;
}

function parseMnBots(t) {
  let j;
  try { j = JSON.parse(t); } catch (e) { return []; }
  if (!j.success || !j.media) return [];
  return j.media.map((m) => ({
    kind: (m.type === 'video' || /\.mp4/i.test(m.url)) ? 'video' : 'image',
    thumb: m.thumb || null,
    url: m.url || m.server2 || null,
  })).filter((m) => m.url);
}

function decodeDgResponse(body) {
  let html = null;
  try {
    const fakeDoc = {
      getElementById(id) {
        if (id === 'div_download') return { set innerHTML(v) { html = v; } };
        return { remove() {} };
      },
    };
    new Function('loader', 'document', 'showAd', body)({ style: {} }, fakeDoc, () => {});
  } catch (e) {}
  return html;
}

function extractItems(html) {
  const items = [];
  const parts = html.split('class="download-items"');
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i].split('class="download-items"')[0];
    const img = block.match(/<img[^>]*src="([^"]+)"/);
    const link = block.match(/<a[^>]*href="([^"]+)"/);
    if (!link) continue;
    items.push({
      kind: /icon-ivideo/.test(block) ? 'video' : 'image',
      thumb: img ? img[1] : null,
      url: link[1],
    });
  }
  return items;
}

async function firstWorking(candidates) {
  for (const c of candidates) {
    try {
      const t = await withTimeout(c.fetch(), 25000, c.name + ' timed out');
      const items = c.parse(t);
      if (items && items.length) return items;
    } catch (e) {
      // try next candidate
    }
  }
  return [];
}

const POST_KEYS = ['xdt_api__v1__media__shortcode__web_info', 'xdt_shortcode_media', 'xdt_api__v1__feed__reels_media__connection'];

async function fetchMedia(url) {
  const code = extractShortcode(url);
  if (!code) throw new Error("That doesn't look like an Instagram reel/post link.");
  const clean = 'https://www.instagram.com/reel/' + code + '/';

  const items = await firstWorking([
    { name: 'thakur-infopd', fetch: () => httpText('https://insta.thakur-infopd.workers.dev/?url=' + encodeURIComponent(clean)), parse: jsonToItems },
    { name: 'mn-bots', fetch: () => httpText('https://instagram-downloader.mn-bots.workers.dev/?url=' + encodeURIComponent(clean)), parse: parseMnBots },
    { name: 'anon-social', fetch: () => httpText('https://anon-social-info.vercel.app/igdl?key=igdl305&url=' + encodeURIComponent(clean)), parse: jsonToItems },
    { name: 'downloadgram', fetch: () => postText(API_DG, { url: clean }), parse: (t) => { const html = decodeDgResponse(t); return html ? extractItems(html) : []; } },
    { name: 'ddvideo', fetch: () => httpText('https://api.dd.video/api/instagram?url=' + encodeURIComponent(clean)), parse: jsonToItems },
    { name: 'snapinsta', fetch: () => httpText('https://snapinsta.app/api/instagram?url=' + encodeURIComponent(clean)), parse: jsonToItems },
    { name: 'indown', fetch: () => httpText('https://indown.io/api/info?url=' + encodeURIComponent(clean)), parse: jsonToItems },
    { name: 'local-scrape', fetch: () => httpText(clean), parse: (h) => resolvePageFromHtml(h, POST_KEYS) },
  ]);

  if (!items.length) {
    throw new Error('No downloadable media was found in that post — the free services are busy right now. Try again in a moment.');
  }
  return { code, items };
}

async function fetchStoryMedia(url) {
  const isHl = /\/highlights\//.test(url);
  const items = await firstWorking([
    { name: 'thakur-infopd', fetch: () => httpText('https://insta.thakur-infopd.workers.dev/?url=' + encodeURIComponent(url)), parse: jsonToItems },
    { name: 'mn-bots', fetch: () => httpText('https://instagram-downloader.mn-bots.workers.dev/?url=' + encodeURIComponent(url)), parse: parseMnBots },
    { name: 'anon-social', fetch: () => httpText('https://anon-social-info.vercel.app/igdl?key=igdl305&url=' + encodeURIComponent(url)), parse: jsonToItems },
    { name: 'snapinsta', fetch: () => httpText('https://snapinsta.app/api/instagram?url=' + encodeURIComponent(url)), parse: jsonToItems },
    { name: 'ddvideo', fetch: () => httpText('https://api.dd.video/api/instagram?url=' + encodeURIComponent(url)), parse: jsonToItems },
    { name: 'indown', fetch: () => httpText('https://indown.io/api/info?url=' + encodeURIComponent(url)), parse: jsonToItems },
    { name: 'local-scrape', fetch: () => httpText(url), parse: (h) => resolvePageFromHtml(h, ['xdt_api__v1__feed__reels_media__connection']) },
  ]);

  if (!items.length) {
    throw new Error(
      isHl
        ? "Couldn't resolve that highlight — the free services are busy right now, or the highlight is private. Try again in a moment."
        : "Couldn't resolve that story right now — active stories expire after 24 hours and may be private. Try again in a moment."
    );
  }
  return { items };
}

async function resolveAvatar(username) {
  try {
    const data = await httpJson('https://greatonlinetools.com/endpoints-tools/endpoint.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    if (data && data.status) {
      const picUrl = data.downloadUrl || data.profilePictureUrl;
      if (picUrl) return cleanUrl(picUrl);
    }
  } catch (e) {}

  try {
    const data = await httpJson('https://bj-insta-profile-info.mmabbas011687.workers.dev/info?username=' + encodeURIComponent(username));
    if (data && data.pic) return cleanUrl(data.pic);
  } catch (e) {}

  try {
    const html = await httpText('https://www.instagram.com/' + encodeURIComponent(username) + '/');
    let user = null;
    for (const b of jsonScriptBlocks(html)) {
      let j;
      try { j = JSON.parse(b); } catch (e) { continue; }
      user = deepFindKey(j, 'xig_user_by_username');
      if (user) break;
    }
    if (user && user.profile_pic_url) return cleanUrl(user.profile_pic_url);
  } catch (e) {}

  throw new Error("Couldn't find a profile picture for @" + username + ' (the APIs may be blocked or the profile is private).');
}

/* ================= ffmpeg audio -> mp3 (wasm, no native binary) ================= */

let ffmpegCorePromise = null;

function getFfmpegCore() {
  if (ffmpegCorePromise) return ffmpegCorePromise;
  ffmpegCorePromise = (async () => {
    const [coreJs, wasmBuf] = await Promise.all([
      httpText(FFMPEG_CORE, {}, 30000),
      httpBuffer(FFMPEG_WASM, {}, 60000),
    ]);
    if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;
    const factory = new Function(coreJs + '\n;return (typeof createFFmpegCore!=="undefined" ? createFFmpegCore : null);')();
    if (!factory) throw new Error('Audio converter failed to initialize.');
    return await factory({
      mainScriptUrlOrBlob: null,
      wasmBinary: wasmBuf,
      print: () => {},
      printErr: (m) => console.error('[ffmpeg]', m),
    });
  })();
  ffmpegCorePromise.catch(() => { ffmpegCorePromise = null; });
  return ffmpegCorePromise;
}

async function convertToMp3(buf) {
  const mod = await getFfmpegCore();
  mod.FS.writeFile('in.mp4', new Uint8Array(buf));
  try {
    const ret = mod.exec('-i', 'in.mp4', '-vn', '-acodec', 'libmp3lame', '-q:a', '4', 'out.mp3');
    if (ret !== undefined && ret !== 0) throw new Error('ffmpeg exited with code ' + ret);
    return Buffer.from(mod.FS.readFile('out.mp3'));
  } finally {
    try { mod.FS.unlink('in.mp4'); } catch (e) {}
    try { mod.FS.unlink('out.mp3'); } catch (e) {}
  }
}

/* ================= Telegram API helpers ================= */

function fileParam(buf, type, name) {
  return { file: new Uint8Array(buf), type, name };
}

async function tg(method, params) {
  const hasFile = Object.values(params).some((v) => v && v.file);
  const url = API + method;
  let res;
  if (hasFile) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      if (v && v.file) fd.append(k, new Blob([v.file], { type: v.type || 'application/octet-stream' }), v.name || 'file');
      else fd.append(k, String(v));
    }
    res = await fetch(url, { method: 'POST', body: fd });
  } else {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
  }
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error('Telegram ' + method + ' failed: ' + JSON.stringify(data).slice(0, 300));
  return data.result;
}

async function sendMsg(chatId, text, extra = {}) {
  return tg('sendMessage', { chat_id: chatId, text, ...extra });
}

function captionFor(item, code, buf, i, total) {
  const mb = (buf.length / 1048576).toFixed(1);
  const lines = ['📦 ' + mb + ' MB'];
  if (code) lines.push('🔗 instagram.com/reel/' + code);
  if (total > 1) lines.push('Item ' + (i + 1) + '/' + total);
  return lines.join('\n');
}

function filenameFor(item, filePrefix, i, total) {
  const base = filePrefix || 'instagram_media';
  const ext = item.kind === 'video' ? 'mp4' : 'jpg';
  return base + (total > 1 ? '_' + (i + 1) : '') + '.' + ext;
}

async function mapLimit(arr, limit, fn) {
  const results = new Array(arr.length);
  let i = 0;
  async function worker() {
    while (i < arr.length) {
      const idx = i++;
      results[idx] = await fn(arr[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, arr.length) }, () => worker()));
  return results;
}

async function sendItems(chatId, items, opts = {}) {
  const { code = null, filePrefix = null } = opts;
  const total = items.length;
  await mapLimit(items, 3, async (item, i) => {
    try {
      const buf = await httpBuffer(item.url);
      const caption = captionFor(item, code, buf, i, total);
      const name = filenameFor(item, filePrefix, i, total);
      const mb = (buf.length / 1048576).toFixed(1);

      if (item.kind === 'video') {
        if (buf.length > 49 * 1048576) {
          await sendMsg(chatId, '⚠️ Video ' + (total > 1 ? '(' + (i + 1) + '/' + total + ') ' : '') + 'is too large for Telegram (' + mb + ' MB). Direct link:\n' + item.url);
          return;
        }
        await tg('sendChatAction', { chat_id: chatId, action: 'upload_video' });
        const params = { chat_id: chatId, video: fileParam(buf, 'video/mp4', name), caption, supports_streaming: true };
        if (code) {
          params.reply_markup = JSON.stringify({ inline_keyboard: [[{ text: '🎵 Extract audio (MP3)', callback_data: 'audio:' + code }]] });
        }
        await tg('sendVideo', params);
      } else {
        if (buf.length > 9 * 1048576) {
          await tg('sendChatAction', { chat_id: chatId, action: 'upload_document' });
          await tg('sendDocument', { chat_id: chatId, document: fileParam(buf, 'image/jpeg', name), caption });
        } else {
          await tg('sendChatAction', { chat_id: chatId, action: 'upload_photo' });
          await tg('sendPhoto', { chat_id: chatId, photo: fileParam(buf, 'image/jpeg', name), caption });
        }
      }
    } catch (e) {
      await sendMsg(chatId, '⚠️ Item ' + (total > 1 ? '(' + (i + 1) + '/' + total + ') ' : '') + 'failed: ' + (e && e.message || e));
    }
  });
}

/* ================= handlers ================= */

const HELP_TEXT =
  '📥 <b>Instadrop Bot</b>\n\n' +
  'Send me an Instagram link to download it:\n\n' +
  '• Reel / post link  →  video or images\n' +
  '• Story / highlight link  →  its media\n' +
  '• Profile link or username  →  HD profile picture\n' +
  '• Videos come with an <b>Extract audio (MP3)</b> button\n\n' +
  'Commands:\n' +
  '/reel &lt;link&gt;   /story &lt;link&gt;   /dp &lt;username&gt;   /audio &lt;link&gt;';

async function runPost(chatId, codeOrUrl) {
  await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
  const status = await sendMsg(chatId, '⏳ Resolving the post…');
  try {
    const url = /^https?:/i.test(codeOrUrl) ? codeOrUrl : 'https://www.instagram.com/reel/' + codeOrUrl + '/';
    const data = await fetchMedia(url);
    try {
      await tg('editMessageText', { chat_id: chatId, message_id: status.message_id, text: '✅ Found ' + data.items.length + ' item(s). Downloading…' });
    } catch (e) {}
    await sendItems(chatId, data.items, { code: data.code, filePrefix: 'instagram_' + data.code });
  } catch (e) {
    await sendMsg(chatId, '❌ ' + (e && e.message || e));
  }
}

async function runStory(chatId, parsed) {
  const isHl = parsed.kind === 'highlight';
  const hlId = isHl ? ((parsed.url.match(/highlights\/(\d+)/) || [])[1] || 'highlight') : null;
  await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
  const status = await sendMsg(chatId, isHl ? '⏳ Looking up the highlight…' : '⏳ Looking up the story…');
  try {
    const data = await fetchStoryMedia(parsed.url);
    try {
      await tg('editMessageText', { chat_id: chatId, message_id: status.message_id, text: '✅ Found ' + data.items.length + ' item(s). Downloading…' });
    } catch (e) {}
    await sendItems(chatId, data.items, { filePrefix: isHl ? 'highlight_' + hlId : 'story' });
  } catch (e) {
    await sendMsg(chatId, '❌ ' + (e && e.message || e));
  }
}

async function runDp(chatId, raw) {
  const username = String(raw || '').replace(/^@/, '').trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
  if (!username || !/^[A-Za-z0-9._]{1,30}$/.test(username)) {
    return sendMsg(chatId, 'Usage: /dp &lt;username&gt; — or just send a profile link / username.');
  }
  await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
  const status = await sendMsg(chatId, '⏳ Looking up @' + username + '…');
  try {
    const url = await resolveAvatar(username);
    const buf = await httpBuffer(url);
    try {
      await tg('editMessageText', { chat_id: chatId, message_id: status.message_id, text: '✅ Found it — downloading…' });
    } catch (e) {}
    await tg('sendChatAction', { chat_id: chatId, action: 'upload_photo' });
    await tg('sendPhoto', {
      chat_id: chatId,
      photo: fileParam(buf, 'image/jpeg', username + '_profile_pic.jpg'),
      caption: '🖼 Profile picture of @' + username + '\n📦 ' + (buf.length / 1048576).toFixed(1) + ' MB',
    });
  } catch (e) {
    await sendMsg(chatId, '❌ ' + (e && e.message || e));
  }
}

async function extractAudio(chatId, codeOrUrl, replyToMsgId) {
  const url = /^https?:/i.test(codeOrUrl) ? codeOrUrl : 'https://www.instagram.com/reel/' + codeOrUrl + '/';
  const code = extractShortcode(url);
  if (!code) return sendMsg(chatId, 'Send a reel/post link or shortcode: /audio &lt;link&gt;', { reply_to_message_id: replyToMsgId });
  await sendMsg(chatId, '🎵 Resolving, downloading and converting to MP3 — this can take up to a minute…', { reply_to_message_id: replyToMsgId });
  try {
    const data = await fetchMedia(url);
    const video = data.items.find((i) => i.kind === 'video') || data.items[0];
    if (!video) throw new Error('No video found in that post.');
    const buf = await httpBuffer(video.url);
    const mp3 = await convertToMp3(buf);
    await tg('sendChatAction', { chat_id: chatId, action: 'upload_audio' });
    await tg('sendAudio', {
      chat_id: chatId,
      audio: fileParam(mp3, 'audio/mpeg', code + '.mp3'),
      title: 'Instagram audio',
      performer: '@instagram',
      reply_to_message_id: replyToMsgId,
    });
  } catch (e) {
    await sendMsg(chatId, '❌ Audio failed: ' + (e && e.message || e), { reply_to_message_id: replyToMsgId });
  }
}

async function handleCallback(query) {
  const data = query.data || '';
  const chatId = query.message && query.message.chat.id;
  const msgId = query.message && query.message.message_id;
  if (!chatId) return;
  try {
    await tg('answerCallbackQuery', { callback_query_id: query.id, text: 'Working on it…' });
  } catch (e) {}
  if (data.startsWith('audio:')) {
    await extractAudio(chatId, data.slice(6), msgId);
  }
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  if (!text) return;

  const cmd = text.match(/^\/(\w+)(?:@\w+)?\s*(.*)$/);
  if (cmd) {
    const name = cmd[1].toLowerCase();
    const rest = (cmd[2] || '').trim();
    if (name === 'start' || name === 'help') return sendMsg(chatId, HELP_TEXT, { parse_mode: 'HTML' });
    if (name === 'reel' || name === 'post') return runPost(chatId, rest);
    if (name === 'story' || name === 'highlight') {
      const parsed = { kind: name, url: rest };
      return runStory(chatId, parsed);
    }
    if (name === 'dp' || name === 'profile') return runDp(chatId, rest);
    if (name === 'audio') return extractAudio(chatId, rest, null);
    return sendMsg(chatId, 'Unknown command. Send /help.');
  }

  const parsed = parseInput(text);
  if (parsed.kind === 'unknown') {
    return sendMsg(chatId, 'Paste a full Instagram link (reel/post, story or highlight), a profile link, or a bare username.');
  }
  if (parsed.kind === 'story' || parsed.kind === 'highlight') return runStory(chatId, parsed);
  if (parsed.kind === 'post') return runPost(chatId, parsed.code);
  return runDp(chatId, parsed.username);
}

async function processUpdate(u) {
  if (u && u.message && u.message.text != null) {
    await handleMessage(u.message);
  } else if (u && u.callback_query) {
    await handleCallback(u.callback_query);
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/* ================= Vercel handler ================= */

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const url = new URL(req.url, 'https://' + host);
    if (url.searchParams.get('setwebhook') === ADMIN_SECRET && ADMIN_SECRET) {
      const webhookUrl = 'https://' + host + url.pathname;
      const r = await fetch(API + 'setWebhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'callback_query'] }),
      });
      return res.status(200).json(await r.json());
    }
    if (url.searchParams.get('deletewebhook') === ADMIN_SECRET && ADMIN_SECRET) {
      const r = await fetch(API + 'deleteWebhook', { method: 'POST' });
      return res.status(200).json(await r.json());
    }
    return res.status(200).json({ ok: true, name: 'Instadrop Telegram Bot', hint: 'Set BOT_TOKEN, then call /api/bot?setwebhook=<ADMIN_SECRET> once.' });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });
  if (!BOT_TOKEN) return res.status(500).json({ ok: false, error: 'BOT_TOKEN env var is not set' });

  let body = req.body;
  if (!body || typeof body === 'string') {
    const raw = await readBody(req);
    try { body = JSON.parse(raw); } catch (e) { return res.status(400).json({ ok: false, error: 'invalid json' }); }
  }

  try {
    await processUpdate(body);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('update processing error:', e);
    res.status(200).json({ ok: true, error: String((e && e.message) || e) });
  }
};

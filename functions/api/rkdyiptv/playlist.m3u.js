// ============================================================
//  RKDYIPTV FUSION5 — Live TV + VOD (Single Playlist)
//  File: functions/api/rkdyiptv/playlist.m3u.js
//  Movies use: /movie/RKDYIPTV/rkdy/{id}.mp4?token={random}&p={portalId}
//  Cache Buster: v3
// ============================================================

import { resolvePortal } from '../../_lib/portals.js';
import { getToken, putToken } from '../../_lib/tokens.js';

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

const TOKEN_WINDOW    = 24 * 60 * 60 * 1000;
const STALKER_TOKEN_DURATION = 60 * 60 * 1000;
const CACHE_DURATION  = 10 * 60 * 1000;
const VOD_CACHE_DURATION = 0;
const TELEGRAM_URL    = 'https://t.me/rkdyiptv';
const DEFAULT_LOGO    = 'https://i.ibb.co/VWVcf4t5/RKDYIPTV.jpg';
const RATE_WINDOW     = 60 * 60 * 1000;
const MAX_PLAYLIST    = 300;
const MAX_STREAM      = 1000;

// VOD Settings
const VOD_MAX_CATEGORIES = 30000;
const VOD_PAGES_PER_CAT = 10;
const VOD_BATCH_SIZE = 1000;

// ── Per-portal caches (keyed by portalId + portalName to prevent stale data) ──
const authTokenCache = new Map();
const liveCache      = new Map();
const vodCache       = new Map();
const store          = new Map();

// ============================================================
//  CRYPTO
// ============================================================
async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

async function computeDeviceFingerprint(request, SECRET_KEY) {
  const ua = request.headers.get('user-agent') || 'unknown';
  const lang = request.headers.get('accept-language') || 'unknown';
  const strippedUA = ua.replace(/[\d.]+/g, 'x').toLowerCase().trim();
  const combined = strippedUA + '|' + lang.toLowerCase();
  return (await hmacSha256(SECRET_KEY, `device_${combined}`)).slice(0, 32);
}

// ============================================================
//  ACCESS CHECK
// ============================================================
function checkAccess(request) {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  const accept = request.headers.get('accept') || '';
  const sfd = request.headers.get('sec-fetch-dest') || '';
  const sfm = request.headers.get('sec-fetch-mode') || '';
  const referer = request.headers.get('referer') || '';

  const iptvApps = [
    'tivi mate', 'vlc', 'kodi', 'tivimate', 'ott navigator', 'ott',
    'iptv smarters', 'iptv', 'gse', 'perfect player',
    'perfect', 'televizo', 'exoplayer', 'okhttp',
    'python', 'curl', 'wget', 'dalvik', 'lavf',
    'ffmpeg', 'mpv', 'axios', 'smarters', 'mag',
    'stb', 'formuler', 'buzz', 'node', 'ss iptv', 'ssiptv',
    'flex', 'neutrino', 'dream', 'authoiptv', 'autho iptv',
    'auth iptv', 'authiptv', 'nplayer', 'infuse', 'vimu',
    'sparkle', 'mxplayer', 'mx player', 'jetplayer',
    'smartone', 'duplex', 'neutron', 'ibo player', 'iboplayer',
    'lazy iptv', 'lazyiptv', 'net iptv', 'netiptv',
    'room iptv', 'roomiptv', 'owl player', 'owlplayer',
    'mystro', 'plex', 'emby', 'jellyfin', 'kplayerx',
    'iplayerx', 'xtream', 'lgtv', 'ottplay', 'ott play',
    'iptvnator', 'electron', 'iptv navigator', 'iptvnavigator',
    'ottplayer', 'ott player', 'potplayer', 'mpc-hc', 'mpc-be',
    'kmplayer', 'gomplayer', 'mediaplayer', 'libmpv', 'player',
  ];

  const smartTVs = [
    'samsung', 'tizen', 'smart-tv', 'smarttv', 'webos', 'web0s',
    'netcast', 'lge', 'bravia', 'sonyandroidtv', 'androidtv',
    'googletv', 'chromecast', 'appletv', 'apple tv', 'cfnetwork',
    'firetv', 'fire tv', 'afts', 'roku', 'rokuchannel', 'philips',
    'nettv', 'hisense', 'vidaa', 'viera', 'panasonic', 'aquos',
    'tcl', 'mibox', 'mitv', 'shield', 'hbbtv', 'hybridcast',
    'vestel', 'cobalt', 'maple', 'espial', 'ekioh', 'lg', 'tgtv',
    'webappmanager', 'linux/smarttv',
  ];

  const isIPTV = iptvApps.some(p => ua.includes(p));
  const isSmartTV = smartTVs.some(p => ua.includes(p));
  const isTVDev = (
    ua.includes('television') || ua.includes('large_screen') ||
    ua.includes('linux/smarttv') || ua.includes('webappmanager') ||
    (ua.includes('android') && ua.includes('tv'))
  );

  if (isIPTV || isSmartTV || isTVDev) {
    return { allowed: true, matchedApp: 'IPTV App' };
  }

  if (referer.startsWith('view-source:')) {
    return { allowed: false, isBrowser: true, reason: 'View source blocked' };
  }

  const isBrowser = accept.includes('text/html') || sfd === 'document' || sfm === 'navigate';
  if (isBrowser) return { allowed: false, isBrowser: true, reason: 'Browser blocked' };
  return { allowed: false, reason: 'Unknown app' };
}

function isBrowserNavigation(request) {
  const sfd = request.headers.get('sec-fetch-dest') || '';
  const sfm = request.headers.get('sec-fetch-mode') || '';
  const referer = request.headers.get('referer') || '';
  return sfd === 'document' || sfm === 'navigate' || referer.startsWith('view-source:');
}

function accessDeniedResponse(commonHeaders) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Access Denied</title>
<style>
  body{background:#0b0b12;color:#eee;font-family:Arial,sans-serif;
       display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}
  .box{padding:24px} h1{color:#ff5555;margin:0 0 12px}
  a{color:#4ea1ff;text-decoration:none;font-weight:bold}
</style></head>
<body><div class="box">
  <h1>Access Denied</h1>
  <p>This link only works inside an IPTV app.</p>
  <p>Join Telegram <a href="${TELEGRAM_URL}">@RKDYIPTV</a></p>
</div></body></html>`;
  return new Response(html, { status: 403, headers: { ...commonHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
}

function errorM3U(title, message, commonHeaders) {
  const m3u = `#EXTM3U
#EXTINF:-1 tvg-logo="${DEFAULT_LOGO}" group-title="⚠️ RKDYIPTV",${title}
${TELEGRAM_URL}
#EXTINF:-1 tvg-logo="${DEFAULT_LOGO}" group-title="⚠️ RKDYIPTV",${message}
${TELEGRAM_URL}
`;
  return new Response(m3u, {
    status: 403,
    headers: { ...commonHeaders, 'Content-Type': 'application/x-mpegurl; charset=utf-8' },
  });
}

// ============================================================
//  RATE LIMIT
// ============================================================
function checkRateLimit(ip, type) {
  const now = Date.now();
  const key = type + '_' + ip;
  const max = type === 'playlist' ? MAX_PLAYLIST : MAX_STREAM;
  if (store.size > 10000) {
    for (const [k, v] of store.entries()) if (now > v.reset) store.delete(k);
  }
  if (!store.has(key)) {
    store.set(key, { count: 1, reset: now + RATE_WINDOW });
    return { allowed: true };
  }
  const entry = store.get(key);
  if (now > entry.reset) {
    store.set(key, { count: 1, reset: now + RATE_WINDOW });
    return { allowed: true };
  }
  if (entry.count >= max) return { allowed: false };
  entry.count++;
  return { allowed: true };
}

function getClientIP(request) {
  return request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || 'unknown';
}

// ============================================================
//  STREAM SIGNING (for Live TV)
// ============================================================
function getTimeSlot(time) {
  return Math.floor((time || Date.now()) / TOKEN_WINDOW);
}

async function signChannelId(channelId, portalId, SECRET_KEY) {
  try {
    const slot = getTimeSlot();
    const exp = Date.now() + TOKEN_WINDOW;
    const sig = (await hmacSha256(SECRET_KEY, channelId + '_' + portalId + '_' + slot)).slice(0, 20);
    const payload = { i: String(channelId), p: portalId, e: exp, s: slot, h: sig };
    return btoa(JSON.stringify(payload))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch { return null; }
}

async function verifyChannelToken(encoded, SECRET_KEY) {
  try {
    if (!encoded) return { valid: false };
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4);
    const payload = JSON.parse(atob(padded));
    if (!payload.i || !payload.p || !payload.e || !payload.s || !payload.h) return { valid: false };
    if (Date.now() > payload.e) return { valid: false };
    const cur = (await hmacSha256(SECRET_KEY, payload.i + '_' + payload.p + '_' + getTimeSlot())).slice(0, 20);
    const prev = (await hmacSha256(SECRET_KEY, payload.i + '_' + payload.p + '_' + (getTimeSlot() - 1))).slice(0, 20);
    if (payload.h !== cur && payload.h !== prev) return { valid: false };
    return { valid: true, id: payload.i, portalId: payload.p };
  } catch { return { valid: false }; }
}

function extractChannelId(cmd) {
  const m = cmd.match(/\/ch\/(\d+)/);
  if (m) return m[1];
  const n = cmd.match(/(\d+)$/);
  return n ? n[1] : null;
}

// ============================================================
//  RANDOM TOKEN GENERATOR (for movie URLs)
// ============================================================
function generateRandomToken() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================
//  STALKER PORTAL
// ============================================================
function getStalkerHeaders(portalConfig, token = null) {
  const h = {
    'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 4 rev: 1812 Safari/533.3',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-User-Agent': 'Model: MAG250; Link: WiFi',
    'Cookie': `mac=${portalConfig.mac}; stb_lang=en; timezone=${portalConfig.timezone};`,
    'Referer': `${portalConfig.portalUrl}/c/`,
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function getStalkerToken(portalConfig, portalId) {
  const now = Date.now();
  const cached = authTokenCache.get(portalId);
  if (cached && (now - cached.time) < STALKER_TOKEN_DURATION) return cached.token;

  const url = `${portalConfig.portalUrl}/server/load.php?type=stb&action=handshake&prehash=0&token=&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(portalConfig) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Handshake failed'); }
  if (!data.js?.token) throw new Error('No token');

  authTokenCache.set(portalId, { token: data.js.token, time: now });
  return data.js.token;
}

async function setupProfile(portalConfig, token) {
  const url = `${portalConfig.portalUrl}/server/load.php?type=stb&action=get_profile&hd=1&sn=${portalConfig.serialNo}&stb_type=MAG250&client_type=STB&image_version=218&video_out=hdmi&device_id=${portalConfig.deviceId}&device_id2=${portalConfig.deviceId2}&hw_version=1.7-BD-00&not_valid_token=0&timestamp=${Math.floor(Date.now()/1000)}&JsHttpRequest=1-xml`;
  await fetch(url, { headers: getStalkerHeaders(portalConfig, token) });
}

// ============================================================
//  LIVE TV FUNCTIONS
// ============================================================
async function getCategories(portalConfig, token) {
  const url = `${portalConfig.portalUrl}/server/load.php?type=itv&action=get_genres&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(portalConfig, token) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { return {}; }
  const map = {};
  if (data.js && Array.isArray(data.js)) data.js.forEach(c => { map[c.id] = c.title; });
  return map;
}

async function getChannels(portalConfig, token) {
  const url = `${portalConfig.portalUrl}/server/load.php?type=itv&action=get_all_channels&force_ch_link_check=&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(portalConfig, token) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Channels parse failed'); }
  if (!data.js?.data) throw new Error('No channels');
  return data.js.data;
}

async function getRealStreamUrl(portalConfig, token, channelId) {
  const cmd = `ffrt http://localhost/ch/${channelId}`;
  const url = `${portalConfig.portalUrl}/server/load.php?type=itv&action=create_link&cmd=${encodeURIComponent(cmd)}&series=&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(portalConfig, token) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Stream parse failed'); }
  if (!data.js?.cmd) throw new Error('No stream URL');
  return data.js.cmd.replace('ffmpeg ', '').replace('ffrt ', '');
}

// ============================================================
//  VOD (MOVIES) FUNCTIONS
// ============================================================
async function getVODCategories(portalConfig, token) {
  const url = `${portalConfig.portalUrl}/server/load.php?type=vod&action=get_categories&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(portalConfig, token) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { return {}; }
  const map = {};
  if (data.js && Array.isArray(data.js)) {
    data.js.forEach(c => {
      if (c.id && c.id !== '*' && c.title) {
        map[c.id] = c.title;
      }
    });
  }
  return map;
}

async function getVODByCategory(portalConfig, token, categoryId, maxPages = VOD_PAGES_PER_CAT) {
  const allMovies = [];
  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = `${portalConfig.portalUrl}/server/load.php?type=vod&action=get_ordered_list&category=${categoryId}&sortby=added&p=${page}&JsHttpRequest=1-xml`;
      const res = await fetch(url, { headers: getStalkerHeaders(portalConfig, token) });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { break; }
      if (!data.js?.data || !Array.isArray(data.js.data) || data.js.data.length === 0) break;
      allMovies.push(...data.js.data);
      const totalItems = parseInt(data.js.total_items || 0);
      const maxPageItems = parseInt(data.js.max_page_items || 14);
      const totalPages = Math.ceil(totalItems / maxPageItems);
      if (page >= totalPages) break;
    } catch (err) {
      console.error(`[VOD] Cat ${categoryId} page ${page} failed:`, err.message);
      break;
    }
  }
  return allMovies;
}

async function getAllVOD(portalConfig, token, catMap) {
  const allMovies = [];
  const categoryIds = Object.keys(catMap);
  const limitedCategoryIds = categoryIds.slice(0, VOD_MAX_CATEGORIES);
  console.log(`[VOD] Fetching ${limitedCategoryIds.length} categories from ${portalConfig.portalUrl}`);
  for (let i = 0; i < limitedCategoryIds.length; i += VOD_BATCH_SIZE) {
    const batch = limitedCategoryIds.slice(i, i + VOD_BATCH_SIZE);
    const results = await Promise.all(
      batch.map(catId =>
        getVODByCategory(portalConfig, token, catId).catch(err => {
          console.error(`[VOD] Cat ${catId} failed:`, err.message);
          return [];
        })
      )
    );
    results.forEach((movies, idx) => {
      const catId = batch[idx];
      movies.forEach(m => {
        m._categoryTitle = catMap[catId] || 'Movies';
      });
      allMovies.push(...movies);
    });
  }
  console.log(`[VOD] Total movies fetched: ${allMovies.length}`);
  return allMovies;
}

// ============================================================
//  ENTRY POINT
// ============================================================
export async function onRequest(context) {
  const { request, env } = context;
  const SECRET_KEY = env.SECURITY_KEY || 'rkdyiptv@2024#secret';

  const reqUrl = new URL(request.url);
  const myBase = `${reqUrl.origin}${reqUrl.pathname}`;
  const hostBase = reqUrl.origin;

  const commonHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': '*',
    'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
    'X-Content-Type-Options': 'nosniff',
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: commonHeaders });
  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers: { ...commonHeaders, 'Content-Type': 'application/x-mpegurl' } });
  }

  const ip = getClientIP(request);
  const params = reqUrl.searchParams;
  const action = params.get('action');
  const d = params.get('d');
  const userToken = params.get('token');

  const accessResult = checkAccess(request);

  if (!accessResult.allowed && action !== 'stream') {
    console.log('[BLOCKED]', accessResult.reason);
    return Response.redirect(TELEGRAM_URL, 302);
  }

  if (action === 'stream' && isBrowserNavigation(request)) {
    return accessDeniedResponse(commonHeaders);
  }

  // ============================================================
  //  STREAM ACTION — Live TV Only
  // ============================================================
  if (action === 'stream') {
    if (!checkRateLimit(ip, 'stream').allowed) return accessDeniedResponse(commonHeaders);
    if (!d) return accessDeniedResponse(commonHeaders);

    const verify = await verifyChannelToken(d, SECRET_KEY);
    if (!verify.valid) return accessDeniedResponse(commonHeaders);

    const channelId = verify.id;

    if (!env.DB) return accessDeniedResponse(commonHeaders);
    const resolved = await resolvePortal(env, verify.portalId);
    if (!resolved) return accessDeniedResponse(commonHeaders);
    const portalConfig = resolved.config;

    try {
      let token = await getStalkerToken(portalConfig, resolved.id);
      await setupProfile(portalConfig, token);
      let realUrl = await getRealStreamUrl(portalConfig, token, channelId);

      if (realUrl.includes('localhost') || !realUrl.startsWith('http')) {
        authTokenCache.delete(resolved.id);
        token = await getStalkerToken(portalConfig, resolved.id);
        await setupProfile(portalConfig, token);
        realUrl = await getRealStreamUrl(portalConfig, token, channelId);
      }

      console.log(`[STREAM OK] ID:${channelId} portal:${resolved.name}`);
      return new Response(null, {
        status: 302,
        headers: { ...commonHeaders, 'Cache-Control': 'no-cache', 'Location': realUrl },
      });
    } catch (err) {
      console.error('[STREAM ERROR]', err.message);
      authTokenCache.delete(resolved.id);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { ...commonHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // ============================================================
  //  PLAYLIST — Token + Device Lock Check
  // ============================================================
  if (!env.DB) {
    return errorM3U('⚠️ Server Misconfigured', 'D1 binding missing', commonHeaders);
  }

  if (!userToken) {
    return errorM3U('🔒 Token Required', 'Contact admin for a valid token', commonHeaders);
  }

  let tokenData;
  try {
    tokenData = await getToken(env, userToken);
  } catch (err) {
    return errorM3U('⚠️ Storage Error', 'Try again later', commonHeaders);
  }

  if (!tokenData) {
    return errorM3U('❌ Invalid Token', 'Token not found or expired', commonHeaders);
  }

  const now = Date.now();
  if (now > tokenData.expiryAt) {
    return errorM3U('⏰ Token Expired', 'Contact admin for a new token', commonHeaders);
  }

  const resolved = await resolvePortal(env, tokenData.portalId);
  if (!resolved) {
    return errorM3U('⚠️ No Portal Configured', 'Ask admin to add a portal in Portal Manager (/portal)', commonHeaders);
  }
  const portalConfig = resolved.config;

  // ✅ Cache key includes both portal ID + URL — prevents stale data from deleted/renamed portals
  const CACHE_KEY = `${resolved.id}__${portalConfig.portalUrl}__${portalConfig.mac}`;

  console.log(`[PLAYLIST] Portal: ${resolved.name} (id=${resolved.id}) | url=${portalConfig.portalUrl} | token=${userToken.slice(0,8)}...`);

  // ============================================================
  //  MULTI-DEVICE LOCK CHECK
  // ============================================================
  const currentDevice = await computeDeviceFingerprint(request, SECRET_KEY);

  // Backward-compat: migrate old single-device tokens (created before this feature)
  if (!Array.isArray(tokenData.devices)) {
    tokenData.devices = tokenData.device ? [tokenData.device] : [];
  }
  if (tokenData.deviceLimit === undefined || tokenData.deviceLimit === null) {
    tokenData.deviceLimit = 1;
  }

  const isUnlimited = tokenData.deviceLimit === 'unlimited';
  const alreadyKnown = tokenData.devices.includes(currentDevice);

  if (!isUnlimited && !alreadyKnown && tokenData.devices.length >= tokenData.deviceLimit) {
    console.log(`[DEVICE LIMIT REACHED] token=${userToken.slice(0,8)}... limit=${tokenData.deviceLimit}`);
    return errorM3U(
      '🔒 Device Limit Reached',
      `This token allows only ${tokenData.deviceLimit} device(s)`,
      commonHeaders
    );
  }

  if (!alreadyKnown) {
    tokenData.devices.push(currentDevice);
    tokenData.lockedAt = now;
    tokenData.lockedUA = (request.headers.get('user-agent') || '').substring(0, 100);
    tokenData.firstUseIP = tokenData.firstUseIP || ip;
    console.log(`[DEVICE ADDED] token=${userToken.slice(0,8)}... count=${tokenData.devices.length}/${isUnlimited ? '∞' : tokenData.deviceLimit}`);
  }

  tokenData.fetchCount = (tokenData.fetchCount || 0) + 1;

  // ✅ THROTTLE: sirf naya device add hone pe, ya har 10 min mein ek baar hi
  // KV write karo — warna free-tier 1000 writes/day turant khatam ho jate hain.
  const WRITE_THROTTLE_MS = 10 * 60 * 1000; // 10 minutes
  const isNewDevice = !alreadyKnown;
  const dueForWrite = !tokenData.lastUsed || (now - tokenData.lastUsed) > WRITE_THROTTLE_MS;

  tokenData.lastUsed = now;

  if (isNewDevice || dueForWrite) {
    try {
      await putToken(env, tokenData);
    } catch (err) {
      console.error('[D1 WRITE ERROR]', err.message);
    }
  }

  if (!checkRateLimit(ip, 'playlist').allowed) {
    return Response.redirect(TELEGRAM_URL, 302);
  }

  // ============================================================
  //  BUILD PLAYLIST — Live TV + Movies
  // ============================================================
  try {
    const cacheNow = Date.now();

    // ✅ Force fresh handshake — old cached tokens might not have profile setup
    authTokenCache.delete(resolved.id);
    let token = await getStalkerToken(portalConfig, resolved.id);
    await setupProfile(portalConfig, token);
    
    // ✅ Extra: account_info call to fully authorize VOD session
    try {
      await fetch(
        `${portalConfig.portalUrl}/server/load.php?type=account_info&action=get_main_info&JsHttpRequest=1-xml`,
        { headers: getStalkerHeaders(portalConfig, token) }
      );
    } catch (_) {}
    // ── LIVE TV data (cached per portal URL+MAC — prevents stale data) ──
    let liveCatMap, liveChannels;
    const cachedLiveEntry = liveCache.get(CACHE_KEY);

    if (cachedLiveEntry && (cacheNow - cachedLiveEntry.time) < CACHE_DURATION) {
      liveCatMap = cachedLiveEntry.catMap;
      liveChannels = cachedLiveEntry.channels;
      console.log(`[LIVE CACHE HIT] ${liveChannels.length} channels | portal:${resolved.name}`);
    } else {
      try {
        [liveCatMap, liveChannels] = await Promise.all([
          getCategories(portalConfig, token),
          getChannels(portalConfig, token)
        ]);
        if (!Array.isArray(liveChannels) || liveChannels.length === 0)
          throw new Error('Empty live list');

        liveCache.set(CACHE_KEY, {
          catMap: liveCatMap,
          channels: liveChannels,
          time: cacheNow,
        });
        console.log(`[LIVE FRESH] ${liveChannels.length} channels | portal:${resolved.name}`);
      } catch (innerErr) {
        console.log(`[LIVE RETRY] ${innerErr.message}`);
        authTokenCache.delete(resolved.id);
        token = await getStalkerToken(portalConfig, resolved.id);
        await setupProfile(portalConfig, token);
        [liveCatMap, liveChannels] = await Promise.all([
          getCategories(portalConfig, token),
          getChannels(portalConfig, token)
        ]);
        liveCache.set(CACHE_KEY, {
          catMap: liveCatMap,
          channels: liveChannels,
          time: cacheNow,
        });
      }
    }

    // ── VOD data (cached per portal URL+MAC — prevents stale data) ──
    let allMovies = [];
    const cachedVODEntry = vodCache.get(CACHE_KEY);

    if (cachedVODEntry && (cacheNow - cachedVODEntry.time) < VOD_CACHE_DURATION) {
      allMovies = cachedVODEntry.movies;
      console.log(`[VOD CACHE HIT] ${allMovies.length} movies | portal:${resolved.name}`);
    } else {
      try {
        const vodCatMap = await getVODCategories(portalConfig, token);
        console.log(`[VOD] Found ${Object.keys(vodCatMap).length} categories | portal:${resolved.name}`);
        allMovies = await getAllVOD(portalConfig, token, vodCatMap);
        if (allMovies.length > 0) {
          vodCache.set(CACHE_KEY, { movies: allMovies, time: cacheNow });
        }
        console.log(`[VOD FRESH] ${allMovies.length} movies | portal:${resolved.name}`);
      } catch (err) {
  console.error('[VOD ERROR]', err.message);
  allMovies = [];
      }
    }

    // ── BUILD M3U (fresh every request) ──
    let m3u = '#EXTM3U x-tvg-url="" tvg-shift=0 refresh="1380"\n';
    let liveCount = 0, movieCount = 0;

    // 📺 LIVE TV
    for (const ch of liveChannels) {
      const name = (ch.name || 'Unknown').trim();
      const logo = (ch.logo && ch.logo.trim() !== '') ? ch.logo : DEFAULT_LOGO;
      const group = liveCatMap[ch.tv_genre_id] || 'General';
      const cmd = ch.cmd || '';
      const chId = ch.id || '';

      if (!cmd) continue;
      const channelId = extractChannelId(cmd);
      if (!channelId) continue;

      const signedToken = await signChannelId(channelId, resolved.id, SECRET_KEY);
      if (!signedToken) continue;

      const streamUrl = `${myBase}?action=stream&d=${signedToken}`;
      m3u += `#EXTINF:-1 tvg-id="${chId}" tvg-name="${name}" tvg-logo="${logo}" group-title="${group}",${name}\n`;
      m3u += `${streamUrl}\n`;
      liveCount++;
    }

    // 🎬 MOVIES
    for (const movie of allMovies) {
      const name = (movie.name || 'Unknown Movie').trim();
      const logo = (movie.screenshot_uri || movie.pic || '').trim() || DEFAULT_LOGO;
      const group = movie._categoryTitle || 'Movies';
      const movieId = movie.id || '';

      if (!movieId) continue;

      const randomToken = generateRandomToken();
      const movieUrl = `${hostBase}/movie/RKDYIPTV/rkdy/${movieId}.mp4?token=${randomToken}&p=${resolved.id}`;

      let displayName = name;
      if (movie.year && !name.includes(movie.year)) {
        displayName = `${name} (${movie.year})`;
      }

      m3u += `#EXTINF:-1 tvg-id="movie_${movieId}" tvg-name="${name}" tvg-logo="${logo}" group-title="${group}",${displayName}\n`;
      m3u += `${movieUrl}\n`;
      movieCount++;
    }

    console.log(`[PLAYLIST OK] Live:${liveCount} Movies:${movieCount} | portal=${resolved.name}(${resolved.id}) | token=${userToken.slice(0,8)}...`);

    return new Response(m3u, {
      status: 200,
      headers: {
        ...commonHeaders,
        'Content-Type': 'application/x-mpegurl; charset=utf-8',
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

  } catch (err) {
    console.error('[PLAYLIST ERROR]', err.message);
    if (resolved) authTokenCache.delete(resolved.id);

    // ── Fallback — rebuild from cached data ──
    const cachedLive = liveCache.get(CACHE_KEY);
    const cachedVOD = vodCache.get(CACHE_KEY);

    if (cachedLive?.channels?.length > 0) {
      console.log('[FALLBACK] Rebuilding m3u from cached data | portal:', resolved.name);
      let m3u = '#EXTM3U x-tvg-url="" tvg-shift=0 refresh="1380"\n';

      for (const ch of cachedLive.channels) {
        const name = (ch.name || 'Unknown').trim();
        const logo = (ch.logo?.trim()) || DEFAULT_LOGO;
        const group = cachedLive.catMap[ch.tv_genre_id] || 'General';
        const cmd = ch.cmd || '';
        if (!cmd) continue;
        const channelId = extractChannelId(cmd);
        if (!channelId) continue;
        const signedToken = await signChannelId(channelId, resolved.id, SECRET_KEY);
        if (!signedToken) continue;
        m3u += `#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${name}" tvg-logo="${logo}" group-title="${group}",${name}\n`;
        m3u += `${myBase}?action=stream&d=${signedToken}\n`;
      }

      for (const movie of (cachedVOD?.movies || [])) {
        const name = (movie.name || 'Unknown Movie').trim();
        const logo = (movie.screenshot_uri || movie.pic || '').trim() || DEFAULT_LOGO;
        const group = movie._categoryTitle || 'Movies';
        if (!movie.id) continue;
        const randomToken = generateRandomToken();
        const movieUrl = `${hostBase}/movie/RKDYIPTV/rkdy/${movie.id}.mp4?token=${randomToken}&p=${resolved.id}`;
        let displayName = name;
        if (movie.year && !name.includes(movie.year)) {
          displayName = `${name} (${movie.year})`;
        }
        m3u += `#EXTINF:-1 tvg-id="movie_${movie.id}" tvg-name="${name}" tvg-logo="${logo}" group-title="${group}",${displayName}\n`;
        m3u += `${movieUrl}\n`;
      }

      return new Response(m3u, {
        status: 200,
        headers: { ...commonHeaders, 'Content-Type': 'application/x-mpegurl; charset=utf-8' },
      });
    }

    return errorM3U('⚠️ Server Error', err.message, commonHeaders);
  }
}

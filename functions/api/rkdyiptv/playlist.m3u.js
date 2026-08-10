// ============================================================
//  RKDYIPTV FUSION5 — Playlist with VOD Support
//  File: functions/api/rkdyiptv/playlist.m3u.js
//  Features: Live TV + Movies + Series in single playlist
// ============================================================

const PORTAL_CONFIG = {
  portalUrl: 'http://tv.stream4k.cc:80/stalker_portal',
  mac: '00:1A:79:00:00:43',
  serialNo: 'F6F47B17CA5B7',
  deviceId: '8DEAD6F4A3A3ED4004275EDD9D79C87533ABF379FCE1629AECCF2E6E9F3FE321',
  deviceId2: '8DEAD6F4A3A3ED4004275EDD9D79C87533ABF379FCE1629AECCF2E6E9F3FE321',
  timezone: 'Asia/Kolkata',
};

const TOKEN_WINDOW    = 24 * 60 * 60 * 1000;
const STALKER_TOKEN_DURATION = 60 * 60 * 1000;
const CACHE_DURATION  = 10 * 60 * 1000;
const VOD_CACHE_DURATION = 30 * 60 * 1000; // VOD 30 min cache
const TELEGRAM_URL    = 'https://t.me/rkdyiptv';
const DEFAULT_LOGO    = 'https://i.ibb.co/VWVcf4t5/RKDYIPTV.jpg';
const DEFAULT_MOVIE_LOGO = 'https://i.ibb.co/VWVcf4t5/RKDYIPTV.jpg';
const DEFAULT_SERIES_LOGO = 'https://i.ibb.co/VWVcf4t5/RKDYIPTV.jpg';
const RATE_WINDOW     = 60 * 60 * 1000;
const MAX_PLAYLIST    = 300;
const MAX_STREAM      = 10000;

let authToken     = null;
let tokenTime     = null;
let cachedPlaylist = null;
let cacheTime     = null;
let cachedVOD     = null;
let vodCacheTime  = null;
let cachedSeries  = null;
let seriesCacheTime = null;
const store       = new Map();

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
//  ACCESS CHECK (Same as Fusion4)
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
#EXTINF:-1 tvg-logo="${DEFAULT_LOGO}" group-title="⚠️ RKDYIPTV",Contact @RKDYIPTV
${TELEGRAM_URL}
`;
  return new Response(m3u, {
    status: 403,
    headers: { ...commonHeaders, 'Content-Type': 'application/x-mpegurl; charset=utf-8' },
  });
}

// ============================================================
//  RATE LIMIT (Same as Fusion4)
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
//  STREAM SIGNING (Same as Fusion4 + VOD support)
// ============================================================
function getTimeSlot(time) {
  return Math.floor((time || Date.now()) / TOKEN_WINDOW);
}

async function signChannelId(channelId, SECRET_KEY, type = 'live') {
  try {
    const slot = getTimeSlot();
    const exp = Date.now() + TOKEN_WINDOW;
    const sig = (await hmacSha256(SECRET_KEY, channelId + '_' + type + '_' + slot)).slice(0, 20);
    const payload = { i: String(channelId), t: type, e: exp, s: slot, h: sig };
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
    if (!payload.i || !payload.e || !payload.s || !payload.h) return { valid: false };
    if (Date.now() > payload.e) return { valid: false };
    const type = payload.t || 'live';
    const cur = (await hmacSha256(SECRET_KEY, payload.i + '_' + type + '_' + getTimeSlot())).slice(0, 20);
    const prev = (await hmacSha256(SECRET_KEY, payload.i + '_' + type + '_' + (getTimeSlot() - 1))).slice(0, 20);
    if (payload.h !== cur && payload.h !== prev) return { valid: false };
    return { valid: true, id: payload.i, type: type };
  } catch { return { valid: false }; }
}

function extractChannelId(cmd) {
  const m = cmd.match(/\/ch\/(\d+)/);
  if (m) return m[1];
  const n = cmd.match(/(\d+)$/);
  return n ? n[1] : null;
}

// ============================================================
//  STALKER PORTAL (Base functions - same as Fusion4)
// ============================================================
function getStalkerHeaders(token = null) {
  const h = {
    'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 4 rev: 1812 Safari/533.3',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-User-Agent': 'Model: MAG250; Link: WiFi',
    'Cookie': `mac=${PORTAL_CONFIG.mac}; stb_lang=en; timezone=${PORTAL_CONFIG.timezone};`,
    'Referer': `${PORTAL_CONFIG.portalUrl}/c/`,
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function getStalkerToken() {
  const now = Date.now();
  if (authToken && tokenTime && (now - tokenTime) < STALKER_TOKEN_DURATION) return authToken;
  const url = `${PORTAL_CONFIG.portalUrl}/server/load.php?type=stb&action=handshake&prehash=0&token=&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders() });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Handshake failed'); }
  if (!data.js?.token) throw new Error('No token');
  authToken = data.js.token;
  tokenTime = now;
  return authToken;
}

async function setupProfile(token) {
  const url = `${PORTAL_CONFIG.portalUrl}/server/load.php?type=stb&action=get_profile&hd=1&sn=${PORTAL_CONFIG.serialNo}&stb_type=MAG250&client_type=STB&image_version=218&video_out=hdmi&device_id=${PORTAL_CONFIG.deviceId}&device_id2=${PORTAL_CONFIG.deviceId2}&hw_version=1.7-BD-00&not_valid_token=0&timestamp=${Math.floor(Date.now()/1000)}&JsHttpRequest=1-xml`;
  await fetch(url, { headers: getStalkerHeaders(token) });
}

// ============================================================
//  LIVE TV FUNCTIONS (Same as Fusion4)
// ============================================================
async function getCategories(token) {
  const url = `${PORTAL_CONFIG.portalUrl}/server/load.php?type=itv&action=get_genres&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(token) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { return {}; }
  const map = {};
  if (data.js && Array.isArray(data.js)) data.js.forEach(c => { map[c.id] = c.title; });
  return map;
}

async function getChannels(token) {
  const url = `${PORTAL_CONFIG.portalUrl}/server/load.php?type=itv&action=get_all_channels&force_ch_link_check=&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(token) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Channels parse failed'); }
  if (!data.js?.data) throw new Error('No channels');
  return data.js.data;
}

async function getRealStreamUrl(token, channelId) {
  const cmd = `ffrt http://localhost/ch/${channelId}`;
  const url = `${PORTAL_CONFIG.portalUrl}/server/load.php?type=itv&action=create_link&cmd=${encodeURIComponent(cmd)}&series=&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(token) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Stream parse failed'); }
  if (!data.js?.cmd) throw new Error('No stream URL');
  return data.js.cmd.replace('ffmpeg ', '').replace('ffrt ', '');
}

// ============================================================
//  🎬 VOD (MOVIES) FUNCTIONS — NEW in Fusion5
// ============================================================
async function getVODCategories(token) {
  const url = `${PORTAL_CONFIG.portalUrl}/server/load.php?type=vod&action=get_categories&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(token) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { return {}; }
  const map = {};
  if (data.js && Array.isArray(data.js)) data.js.forEach(c => { map[c.id] = c.title; });
  return map;
}

async function getVODByCategory(token, categoryId) {
  const allMovies = [];
  let page = 1;
  const maxPages = 20; // Safety limit
  
  while (page <= maxPages) {
    const url = `${PORTAL_CONFIG.portalUrl}/server/load.php?type=vod&action=get_ordered_list&category=${categoryId}&sortby=added&p=${page}&JsHttpRequest=1-xml`;
    const res = await fetch(url, { headers: getStalkerHeaders(token) });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { break; }
    
    if (!data.js?.data || !Array.isArray(data.js.data) || data.js.data.length === 0) break;
    
    allMovies.push(...data.js.data);
    
    const totalItems = parseInt(data.js.total_items || 0);
    const maxPageItems = parseInt(data.js.max_page_items || 14);
    const totalPages = Math.ceil(totalItems / maxPageItems);
    
    if (page >= totalPages) break;
    page++;
  }
  
  return allMovies;
}

async function getAllVOD(token, catMap) {
  const allMovies = [];
  const categoryIds = Object.keys(catMap).filter(id => id !== '*' && id !== '0');
  
  // Fetch in batches of 3 to avoid overwhelming portal
  for (let i = 0; i < categoryIds.length; i += 3) {
    const batch = categoryIds.slice(i, i + 3);
    const results = await Promise.all(
      batch.map(catId => 
        getVODByCategory(token, catId).catch(err => {
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
  
  return allMovies;
}

async function getVODStreamUrl(token, movieId, cmd) {
  const useCmd = cmd || `/media/file_${movieId}.mpg`;
  const url = `${PORTAL_CONFIG.portalUrl}/server/load.php?type=vod&action=create_link&cmd=${encodeURIComponent(useCmd)}&series=0&forced_storage=0&disable_ad=0&download=0&force_ch_link_check=0&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(token) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('VOD stream parse failed'); }
  if (!data.js?.cmd) throw new Error('No VOD stream URL');
  return data.js.cmd.replace('ffmpeg ', '').replace('ffrt ', '').trim();
}

// ============================================================
//  📺 SERIES FUNCTIONS — NEW in Fusion5
// ============================================================
async function getSeriesCategories(token) {
  const url = `${PORTAL_CONFIG.portalUrl}/server/load.php?type=series&action=get_categories&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(token) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { return {}; }
  const map = {};
  if (data.js && Array.isArray(data.js)) data.js.forEach(c => { map[c.id] = c.title; });
  return map;
}

async function getSeriesByCategory(token, categoryId) {
  const allSeries = [];
  let page = 1;
  const maxPages = 20;
  
  while (page <= maxPages) {
    const url = `${PORTAL_CONFIG.portalUrl}/server/load.php?type=series&action=get_ordered_list&category=${categoryId}&sortby=added&p=${page}&JsHttpRequest=1-xml`;
    const res = await fetch(url, { headers: getStalkerHeaders(token) });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { break; }
    
    if (!data.js?.data || !Array.isArray(data.js.data) || data.js.data.length === 0) break;
    
    allSeries.push(...data.js.data);
    
    const totalItems = parseInt(data.js.total_items || 0);
    const maxPageItems = parseInt(data.js.max_page_items || 14);
    const totalPages = Math.ceil(totalItems / maxPageItems);
    
    if (page >= totalPages) break;
    page++;
  }
  
  return allSeries;
}

async function getAllSeries(token, catMap) {
  const allSeries = [];
  const categoryIds = Object.keys(catMap).filter(id => id !== '*' && id !== '0');
  
  for (let i = 0; i < categoryIds.length; i += 3) {
    const batch = categoryIds.slice(i, i + 3);
    const results = await Promise.all(
      batch.map(catId =>
        getSeriesByCategory(token, catId).catch(err => {
          console.error(`[SERIES] Cat ${catId} failed:`, err.message);
          return [];
        })
      )
    );
    results.forEach((series, idx) => {
      const catId = batch[idx];
      series.forEach(s => {
        s._categoryTitle = catMap[catId] || 'Series';
      });
      allSeries.push(...series);
    });
  }
  
  return allSeries;
}

async function getSeriesStreamUrl(token, seriesId, cmd, season, episode) {
  const useCmd = cmd || `/media/file.mkv`;
  const url = `${PORTAL_CONFIG.portalUrl}/server/load.php?type=vod&action=create_link&cmd=${encodeURIComponent(useCmd)}&series=${episode || 1}&forced_storage=0&disable_ad=0&download=0&force_ch_link_check=0&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(token) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Series stream parse failed'); }
  if (!data.js?.cmd) throw new Error('No Series stream URL');
  return data.js.cmd.replace('ffmpeg ', '').replace('ffrt ', '').trim();
}
// ============================================================
//  ENTRY POINT
// ============================================================
export async function onRequest(context) {
  const { request, env } = context;
  const SECRET_KEY = env.SECURITY_KEY || 'rkdyiptv@2024#secret';

  const reqUrl = new URL(request.url);
  const myBase = `${reqUrl.origin}${reqUrl.pathname}`;

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
  //  STREAM ACTION — Live TV / VOD / Series
  // ============================================================
  if (action === 'stream') {
    if (!checkRateLimit(ip, 'stream').allowed) return accessDeniedResponse(commonHeaders);
    if (!d) return accessDeniedResponse(commonHeaders);

    const verify = await verifyChannelToken(d, SECRET_KEY);
    if (!verify.valid) return accessDeniedResponse(commonHeaders);

    const channelId = verify.id;
    const streamType = verify.type || 'live';

    try {
      let token = await getStalkerToken();
      await setupProfile(token);
      let realUrl;

      // Route to correct stream handler based on type
      if (streamType === 'vod') {
        const cmd = params.get('c') ? decodeURIComponent(params.get('c')) : null;
        realUrl = await getVODStreamUrl(token, channelId, cmd);
      } else if (streamType === 'series') {
        const cmd = params.get('c') ? decodeURIComponent(params.get('c')) : null;
        const ep = params.get('ep') || 1;
        realUrl = await getSeriesStreamUrl(token, channelId, cmd, null, ep);
      } else {
        // Live TV (default)
        realUrl = await getRealStreamUrl(token, channelId);
      }

      // Retry on failure
      if (realUrl.includes('localhost') || !realUrl.startsWith('http')) {
        authToken = null;
        token = await getStalkerToken();
        await setupProfile(token);
        if (streamType === 'vod') {
          const cmd = params.get('c') ? decodeURIComponent(params.get('c')) : null;
          realUrl = await getVODStreamUrl(token, channelId, cmd);
        } else if (streamType === 'series') {
          const cmd = params.get('c') ? decodeURIComponent(params.get('c')) : null;
          const ep = params.get('ep') || 1;
          realUrl = await getSeriesStreamUrl(token, channelId, cmd, null, ep);
        } else {
          realUrl = await getRealStreamUrl(token, channelId);
        }
      }

      console.log(`[STREAM OK] Type:${streamType} ID:${channelId}`);
      return new Response(null, {
        status: 302,
        headers: { ...commonHeaders, 'Cache-Control': 'no-cache', 'Location': realUrl },
      });
    } catch (err) {
      console.error(`[STREAM ERROR] Type:${streamType}`, err.message);
      authToken = null;
      tokenTime = null;
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { ...commonHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // ============================================================
  //  PLAYLIST — Requires valid token + device lock
  // ============================================================
  if (!env.TOKENS) {
    return errorM3U('⚠️ Server Misconfigured', 'KV binding missing', commonHeaders);
  }

  if (!userToken) {
    return errorM3U('🔒 Token Required', 'Contact admin for a valid token', commonHeaders);
  }

  let tokenData;
  try {
    tokenData = await env.TOKENS.get(`token:${userToken}`, { type: 'json' });
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

  // Device fingerprint
  const currentDevice = await computeDeviceFingerprint(request, SECRET_KEY);

  if (tokenData.device === null) {
    tokenData.device = currentDevice;
    tokenData.lockedAt = now;
    tokenData.lockedUA = (request.headers.get('user-agent') || '').substring(0, 100);
    tokenData.firstUseIP = ip;
    console.log(`[DEVICE LOCKED] token=${userToken.slice(0,8)}...`);
  } else if (tokenData.device !== currentDevice) {
    console.log(`[DEVICE MISMATCH] token=${userToken.slice(0,8)}...`);
    return errorM3U(
      '🔒 Token Locked to Another Device',
      'This URL cannot be used on multiple devices',
      commonHeaders
    );
  }

  tokenData.fetchCount = (tokenData.fetchCount || 0) + 1;
  tokenData.lastUsed = now;

  const ttl = Math.ceil((tokenData.expiryAt - now) / 1000);
  if (ttl > 0) {
    try {
      await env.TOKENS.put(`token:${userToken}`, JSON.stringify(tokenData), {
        expirationTtl: ttl,
      });
    } catch (err) {
      console.error('[KV WRITE ERROR]', err.message);
    }
  }

  if (!checkRateLimit(ip, 'playlist').allowed) {
    return Response.redirect(TELEGRAM_URL, 302);
  }

  // ============================================================
  //  BUILD PLAYLIST — Live TV + Movies + Series
  // ============================================================
  try {
    const cacheNow = Date.now();

    // Serve from cache if fresh
    if (cachedPlaylist && cacheTime && (cacheNow - cacheTime) < CACHE_DURATION && cachedPlaylist.includes('#EXTINF')) {
      console.log('[PLAYLIST CACHE] Serving');
      return new Response(cachedPlaylist, {
        status: 200,
        headers: {
          ...commonHeaders,
          'Content-Type': 'application/x-mpegurl; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    let token = await getStalkerToken();
    await setupProfile(token);

    // ── Fetch LIVE TV ──
    let liveCatMap, liveChannels;
    try {
      [liveCatMap, liveChannels] = await Promise.all([
        getCategories(token),
        getChannels(token)
      ]);
      if (!Array.isArray(liveChannels) || liveChannels.length === 0) throw new Error('Empty live list');
    } catch (innerErr) {
      authToken = null;
      tokenTime = null;
      token = await getStalkerToken();
      await setupProfile(token);
      [liveCatMap, liveChannels] = await Promise.all([
        getCategories(token),
        getChannels(token)
      ]);
    }

    // ── Fetch VOD (Movies) with cache ──
    let allMovies = [];
    if (cachedVOD && vodCacheTime && (cacheNow - vodCacheTime) < VOD_CACHE_DURATION) {
      allMovies = cachedVOD;
      console.log('[VOD CACHE] Using cached movies');
    } else {
      try {
        const vodCatMap = await getVODCategories(token);
        allMovies = await getAllVOD(token, vodCatMap);
        cachedVOD = allMovies;
        vodCacheTime = cacheNow;
        console.log(`[VOD] Fetched ${allMovies.length} movies`);
      } catch (err) {
        console.error('[VOD ERROR]', err.message);
        allMovies = cachedVOD || [];
      }
    }

    // ── Fetch SERIES with cache ──
    let allSeries = [];
    if (cachedSeries && seriesCacheTime && (cacheNow - seriesCacheTime) < VOD_CACHE_DURATION) {
      allSeries = cachedSeries;
      console.log('[SERIES CACHE] Using cached series');
    } else {
      try {
        const seriesCatMap = await getSeriesCategories(token);
        allSeries = await getAllSeries(token, seriesCatMap);
        cachedSeries = allSeries;
        seriesCacheTime = cacheNow;
        console.log(`[SERIES] Fetched ${allSeries.length} series`);
      } catch (err) {
        console.error('[SERIES ERROR]', err.message);
        allSeries = cachedSeries || [];
      }
    }

    // ============================================================
    //  BUILD M3U
    // ============================================================
    let m3u = '#EXTM3U x-tvg-url="" tvg-shift=0 refresh="1380"\n';
    let liveCount = 0, movieCount = 0, seriesCount = 0;

    // ─── 📺 LIVE TV ───
    for (const ch of liveChannels) {
      const name = (ch.name || 'Unknown').trim();
      const logo = (ch.logo && ch.logo.trim() !== '') ? ch.logo : DEFAULT_LOGO;
      const group = liveCatMap[ch.tv_genre_id] || 'General';
      const cmd = ch.cmd || '';
      const chId = ch.id || '';

      if (!cmd) continue;
      const channelId = extractChannelId(cmd);
      if (!channelId) continue;

      const signedToken = await signChannelId(channelId, SECRET_KEY, 'live');
      if (!signedToken) continue;

      const streamUrl = `${myBase}?action=stream&d=${signedToken}`;
      m3u += `#EXTINF:-1 tvg-id="${chId}" tvg-name="${name}" tvg-logo="${logo}" group-title="${group}",${name}\n`;
      m3u += `${streamUrl}\n`;
      liveCount++;
    }

    // ─── 🎬 MOVIES (VOD) ───
    for (const movie of allMovies) {
      const name = (movie.name || 'Unknown Movie').trim();
      const logo = (movie.screenshot_uri || movie.pic || '').trim() || DEFAULT_MOVIE_LOGO;
      const category = movie._categoryTitle || 'Movies';
      const group = `🎬 Movies - ${category}`;
      const movieId = movie.id || '';
      const cmd = movie.cmd || '';

      if (!movieId) continue;

      const signedToken = await signChannelId(movieId, SECRET_KEY, 'vod');
      if (!signedToken) continue;

      const encodedCmd = cmd ? '&c=' + encodeURIComponent(cmd) : '';
      const streamUrl = `${myBase}?action=stream&d=${signedToken}${encodedCmd}`;
      
      // Add year, rating info if available
      let displayName = name;
      if (movie.year) displayName += ` (${movie.year})`;
      
      m3u += `#EXTINF:-1 tvg-id="movie_${movieId}" tvg-name="${name}" tvg-logo="${logo}" group-title="${group}",${displayName}\n`;
      m3u += `${streamUrl}\n`;
      movieCount++;
    }

    // ─── 📺 SERIES ───
    for (const series of allSeries) {
      const name = (series.name || 'Unknown Series').trim();
      const logo = (series.screenshot_uri || series.pic || '').trim() || DEFAULT_SERIES_LOGO;
      const category = series._categoryTitle || 'Series';
      const group = `📺 Series - ${category}`;
      const seriesId = series.id || '';
      const cmd = series.cmd || '';

      if (!seriesId) continue;

      // Series may have multiple episodes
      const episodes = series.series || [1];
      
      if (Array.isArray(episodes) && episodes.length > 0) {
        // Multi-episode series
        for (const ep of episodes) {
          const signedToken = await signChannelId(seriesId, SECRET_KEY, 'series');
          if (!signedToken) continue;

          const encodedCmd = cmd ? '&c=' + encodeURIComponent(cmd) : '';
          const streamUrl = `${myBase}?action=stream&d=${signedToken}${encodedCmd}&ep=${ep}`;
          
          const displayName = `${name} - Episode ${ep}`;
          m3u += `#EXTINF:-1 tvg-id="series_${seriesId}_${ep}" tvg-name="${name}" tvg-logo="${logo}" group-title="${group}",${displayName}\n`;
          m3u += `${streamUrl}\n`;
          seriesCount++;
        }
      } else {
        // Single episode/movie style series
        const signedToken = await signChannelId(seriesId, SECRET_KEY, 'series');
        if (!signedToken) continue;

        const encodedCmd = cmd ? '&c=' + encodeURIComponent(cmd) : '';
        const streamUrl = `${myBase}?action=stream&d=${signedToken}${encodedCmd}`;
        
        m3u += `#EXTINF:-1 tvg-id="series_${seriesId}" tvg-name="${name}" tvg-logo="${logo}" group-title="${group}",${name}\n`;
        m3u += `${streamUrl}\n`;
        seriesCount++;
      }
    }

    console.log(`[PLAYLIST OK] Live:${liveCount} Movies:${movieCount} Series:${seriesCount} | token=${userToken.slice(0,8)}...`);

    if (liveCount > 0 || movieCount > 0 || seriesCount > 0) {
      cachedPlaylist = m3u;
      cacheTime = cacheNow;
    }

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
    authToken = null;
    tokenTime = null;
    if (cachedPlaylist?.includes('#EXTINF')) {
      return new Response(cachedPlaylist, {
        status: 200,
        headers: { ...commonHeaders, 'Content-Type': 'application/x-mpegurl; charset=utf-8' },
      });
    }
    return errorM3U('⚠️ Server Error', err.message, commonHeaders);
  }
}

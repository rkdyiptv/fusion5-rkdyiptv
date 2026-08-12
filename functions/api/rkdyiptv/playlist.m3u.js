// ============================================================
//  RKDYIPTV FUSION5 — Live TV + VOD (Single Playlist)
//  File: functions/api/rkdyiptv/playlist.m3u.js
//  Movies use: /movie/RKDYIPTV/rkdy/{id}.mp4?token={random}&p={portalId}
// ============================================================

import { resolvePortal } from '../../_lib/portals.js';

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

const TOKEN_WINDOW    = 24 * 60 * 60 * 1000;
const STALKER_TOKEN_DURATION = 60 * 60 * 1000;
const CACHE_DURATION  = 10 * 60 * 1000;
const VOD_CACHE_DURATION = 60 * 60 * 1000;
const TELEGRAM_URL    = 'https://t.me/rkdyiptv';
const DEFAULT_LOGO    = 'https://i.ibb.co/VWVcf4t5/RKDYIPTV.jpg';
const RATE_WINDOW     = 60 * 60 * 1000;
const MAX_PLAYLIST    = 30;
const MAX_STREAM      = 1000;

// VOD Settings
const VOD_MAX_CATEGORIES = 30;
const VOD_PAGES_PER_CAT = 2;
const VOD_BATCH_SIZE = 5;

// ── Per-portal caches (keyed by portal id) ──
const authTokenCache = new Map();
const playlistCache  = new Map();
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

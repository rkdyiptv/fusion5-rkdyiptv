// ============================================================
//  RKDYIPTV FUSION5 — Movie Stream Handler (Dynamic Route)
//  File: functions/movie/[[path]].js
//  URL Format: /movie/RKDYIPTV/rkdy/{id}.{ext}?token={random}
// ============================================================

import { resolvePortal } from '../_lib/portals.js';

const TELEGRAM_URL = 'https://t.me/rkdyiptv';
const STALKER_TOKEN_DURATION = 60 * 60 * 1000;

// Per-portal auth token cache
const authTokenCache = new Map();

// ============================================================
//  STALKER HELPERS
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

async function getVODStreamUrl(portalConfig, token, movieId) {
  const cmd = `/media/file_${movieId}.mpg`;
  const url = `${portalConfig.portalUrl}/server/load.php?type=vod&action=create_link&cmd=${encodeURIComponent(cmd)}&series=0&forced_storage=0&disable_ad=0&download=0&force_ch_link_check=0&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(portalConfig, token) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('VOD stream parse failed'); }
  if (!data.js?.cmd) throw new Error('No VOD stream URL');
  return data.js.cmd.replace('ffmpeg ', '').replace('ffrt ', '').trim();
}

// ============================================================
//  MAIN HANDLER
// ============================================================
export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const userToken = url.searchParams.get('token');

  const commonHeaders = {
    'Access-Control-Allow-Origin': '*',
    'X-Robots-Tag': 'noindex, nofollow',
  };

  console.log(`[MOVIE REQ] path=${path}`);

  // ── Extract movie ID from path ──
  // Path: /movie/RKDYIPTV/rkdy/12345.mp4
  const match = path.match(/^\/movie\/RKDYIPTV\/rkdy\/(\d+)\.(mp4|mkv|avi|mpg|ts|m3u8)$/i);

  if (!match) {
    console.log('[MOVIE] Invalid URL format:', path);
    return new Response('Invalid movie URL format: ' + path, {
      status: 404,
      headers: commonHeaders,
    });
  }

  const movieId = match[1];
  const extension = match[2];

  // ── Validate token exists ──
  if (!userToken) {
    return new Response('Token required', {
      status: 401,
      headers: commonHeaders,
    });
  }

  // ── Resolve portal from Portal Manager ──
  const resolved = await resolvePortal(env, null);
  if (!resolved) {
    return new Response('No portal configured. Add one at /portal', {
      status: 500,
      headers: commonHeaders,
    });
  }
  const portalConfig = resolved.config;

  // ── Fetch stream URL from Stalker ──
  try {
    let stalkerToken = await getStalkerToken(portalConfig, resolved.id);
    await setupProfile(portalConfig, stalkerToken);
    let realUrl = await getVODStreamUrl(portalConfig, stalkerToken, movieId);

    // Retry on failure
    if (!realUrl || !realUrl.startsWith('http')) {
      authTokenCache.delete(resolved.id);
      stalkerToken = await getStalkerToken(portalConfig, resolved.id);
      await setupProfile(portalConfig, stalkerToken);
      realUrl = await getVODStreamUrl(portalConfig, stalkerToken, movieId);
    }

    console.log(`[MOVIE OK] ID:${movieId} portal=${resolved.name}`);

    return new Response(null, {
      status: 302,
      headers: {
        ...commonHeaders,
        'Location': realUrl,
        'Cache-Control': 'no-cache',
      },
    });

  } catch (err) {
    console.error('[MOVIE ERROR]', err.message);
    authTokenCache.delete(resolved.id);
    return new Response(`Stream error: ${err.message}`, {
      status: 500,
      headers: commonHeaders,
    });
  }
}

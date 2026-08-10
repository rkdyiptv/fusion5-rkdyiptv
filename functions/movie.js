// ============================================================
//  RKDYIPTV FUSION5 — Movie Stream Handler
//  File: functions/movie.js
//  URL Format: /movie/RKDYIPTV/rkdy/{id}.{ext}?token={random}
// ============================================================

const PORTAL_CONFIG = {
  portalUrl: 'http://tv.stream4k.cc:80/stalker_portal',
  mac: '00:1A:79:00:00:43',
  serialNo: 'F6F47B17CA5B7',
  deviceId: '8DEAD6F4A3A3ED4004275EDD9D79C87533ABF379FCE1629AECCF2E6E9F3FE321',
  deviceId2: '8DEAD6F4A3A3ED4004275EDD9D79C87533ABF379FCE1629AECCF2E6E9F3FE321',
  timezone: 'Asia/Kolkata',
};

const TELEGRAM_URL = 'https://t.me/rkdyiptv';
const STALKER_TOKEN_DURATION = 60 * 60 * 1000;

let authToken = null;
let tokenTime = null;

// ============================================================
//  STALKER HELPERS
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

async function getVODStreamUrl(token, movieId) {
  const cmd = `/media/file_${movieId}.mpg`;
  const url = `${PORTAL_CONFIG.portalUrl}/server/load.php?type=vod&action=create_link&cmd=${encodeURIComponent(cmd)}&series=0&forced_storage=0&disable_ad=0&download=0&force_ch_link_check=0&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(token) });
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
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;  // e.g. /movie/RKDYIPTV/rkdy/12345.mp4
  const userToken = url.searchParams.get('token');

  const commonHeaders = {
    'Access-Control-Allow-Origin': '*',
    'X-Robots-Tag': 'noindex, nofollow',
  };

  // ── Extract movie ID from path ──
  // Path: /movie/RKDYIPTV/rkdy/12345.mp4
  const match = path.match(/^\/movie\/RKDYIPTV\/rkdy\/(\d+)\.(mp4|mkv|avi|mpg|ts|m3u8)$/i);
  
  if (!match) {
    return new Response('Invalid movie URL format', {
      status: 404,
      headers: commonHeaders,
    });
  }

  const movieId = match[1];
  const extension = match[2];

  // ── Validate user token ──
  if (!userToken) {
    return new Response('Token required', {
      status: 401,
      headers: commonHeaders,
    });
  }

  if (!env.TOKENS) {
    return new Response('Server misconfigured', {
      status: 500,
      headers: commonHeaders,
    });
  }

  // ── Check token in KV ──
  let tokenData;
  try {
    tokenData = await env.TOKENS.get(`token:${userToken}`, { type: 'json' });
  } catch (err) {
    return new Response('Storage error', {
      status: 500,
      headers: commonHeaders,
    });
  }

  if (!tokenData) {
    return new Response('Invalid or expired token', {
      status: 403,
      headers: commonHeaders,
    });
  }

  const now = Date.now();
  if (now > tokenData.expiryAt) {
    return new Response('Token expired', {
      status: 403,
      headers: commonHeaders,
    });
  }

  // ── Fetch stream URL from Stalker ──
  try {
    let stalkerToken = await getStalkerToken();
    await setupProfile(stalkerToken);
    let realUrl = await getVODStreamUrl(stalkerToken, movieId);

    // Retry on failure
    if (!realUrl || !realUrl.startsWith('http')) {
      authToken = null;
      stalkerToken = await getStalkerToken();
      await setupProfile(stalkerToken);
      realUrl = await getVODStreamUrl(stalkerToken, movieId);
    }

    console.log(`[MOVIE OK] ID:${movieId} ext:${extension} token=${userToken.slice(0,8)}...`);

    // Redirect to real stream URL
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
    authToken = null;
    tokenTime = null;
    return new Response(`Stream error: ${err.message}`, {
      status: 500,
      headers: commonHeaders,
    });
  }
}

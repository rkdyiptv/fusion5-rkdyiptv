// ============================================================
//  RKDYIPTV — Multi-API Playlist Proxy
//  File: functions/api/xtream/playlist.m3u.js
//  Route: /api/xtream/playlist.m3u
// ============================================================

const TELEGRAM_URL    = 'https://t.me/rkdyiptv';
const RKDYIPTV_LOGO   = 'https://i.ibb.co/VWVcf4t5/RKDYIPTV.jpg';
const REFRESH_SECONDS = 900;
const MAX_APIS        = 50;
const FETCH_TIMEOUT   = 25000;

// ============================================================
//  GROUP RENAME MAP
// ============================================================
const GROUP_RENAME_MAP = {
  'Vortex-TV': 'Voot',
  'Unknown':   'RKDYIPTV',
  'LazyyXD | FIFA2026':   'ZEE5 LIVE EVENTS ONLY',
  'Spor':   'Sports',
  'jiopulz-rkdyiptv.pages.dev':   'RKDYIPTV JIOTV',
  'Premium Plug x':   'SunNxt',
};

// ============================================================
//  CHANNEL NAME RENAME MAP
// ============================================================
const CHANNEL_RENAME_MAP = {
  '@Premiumplugx': '@RKDYIPTV',
  // Aur bhi add kar sakte ho:
  // '@OldName': '@NewName',
};

// ============================================================
//  GROUP HIDE LIST — inn group-titles wale channels hide honge
//  (PARTIAL match hota hai — group-title me ye text kahin bhi
//   ho to wo group hide ho jayega, case-insensitive)
// ============================================================
const GROUP_HIDE_LIST = [
  'MC OTHER COPY PASTER',
  'MAKABOSRA COPY PASTER KA',
  'MAKICHUT COPY PASTER KI',
  'FUCK OF STREALERS',
];

// ============================================================
//  VOD / MOVIES FILTER
//
//  LOGIC (3-step check):
//  1. URL clearly live  → ALWAYS KEEP  (override everything)
//  2. URL clearly VOD   → BLOCK
//  3. Group name VOD    → BLOCK only if URL is NOT live-like
// ============================================================

// ── Step 1: URL patterns that confirm LIVE stream ──────────
const LIVE_URL_PATTERNS = [
  /\/live\//i,
  /\/[^/]+\/[^/]+\/\d+\.ts/i,
  /\/[^/]+\/[^/]+\/\d+$/i,
  /\.m3u8($|\?)/i,
  /\.ts($|\?)/i,
  /:\d{4,5}\/live\//i,
  /:\d{4,5}\/[^/]+\/[^/]+\/\d+/i,
];

// ── Step 2: URL patterns that confirm VOD ─────────────────
const VOD_URL_PATTERNS = [
  /\.mp4($|\?)/i,
  /\.mkv($|\?)/i,
  /\.avi($|\?)/i,
  /\.mov($|\?)/i,
  /\.wmv($|\?)/i,
  /\.flv($|\?)/i,
  /\.webm($|\?)/i,
  /\/movie\//i,
  /\/vod\//i,
  /\/series\//i,
];

// ── Step 3: Group title keywords that suggest VOD ─────────
const VOD_GROUP_KEYWORDS = [
  'vod',
  'movie',
  'movies',
  'film',
  'films',
  'cinema',
];

// ── Series/episode keywords ────────────────────────────────
const EPISODE_NAME_PATTERNS = [
  /\bS\d{1,2}E\d{1,2}\b/i,
  /\bSeason\s*\d+\s*Ep/i,
  /\bEpisode\s*\d+\b/i,
];

// ============================================================
//  BROWSER BLOCK
// ============================================================
function isIPTVApp(request) {
  const ua     = (request.headers.get('user-agent') || '').toLowerCase();
  const accept = request.headers.get('accept') || '';
  const sfd    = request.headers.get('sec-fetch-dest') || '';

  const iptvApps = [
    'vlc', 'kodi', 'tivimate', 'ott navigator', 'iptv',
    'smarters', 'perfect', 'televizo', 'exoplayer', 'okhttp',
    'lavf', 'ffmpeg', 'mpv', 'dalvik', 'mag', 'stb',
    'formuler', 'nplayer', 'infuse', 'vimu', 'mxplayer',
    'ibo player', 'lazy iptv', 'net iptv', 'plex', 'emby',
    'jellyfin', 'xtream', 'iptvnator', 'ottplayer',
    'gse', 'python', 'curl', 'wget', 'axios', 'node',
    'samsung', 'tizen', 'webos', 'androidtv', 'firetv',
    'chromecast', 'roku', 'shield', 'appletv', 'smart-tv',
    'playtv',
  ];

  const isIPTV    = iptvApps.some(p => ua.includes(p));
  const isBrowser = accept.includes('text/html') || sfd === 'document';
  return isIPTV || !isBrowser;
}

// ============================================================
//  ERROR M3U
// ============================================================
function errorM3U(message) {
  return `#EXTM3U
#EXTINF:-1 tvg-logo="${RKDYIPTV_LOGO}",⚠️ ${message}
${TELEGRAM_URL}
#EXTINF:-1 tvg-logo="${RKDYIPTV_LOGO}",Join Telegram @RKDYIPTV
${TELEGRAM_URL}
`;
}

// ============================================================
//  COLLECT API URLS
// ============================================================
function collectApiUrls(env) {
  const urls = [];
  for (let i = 1; i <= MAX_APIS; i++) {
    const url = env[`API_URL_${i}`];
    if (url && url.trim().startsWith('http')) {
      urls.push({ index: i, url: url.trim() });
    }
  }
  return urls;
}

// ============================================================
//  FETCH ONE API  (OTT Navigator User-Agent)
// ============================================================
async function fetchOneApi(apiInfo) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);

  try {
    console.log(`[FETCH START] API #${apiInfo.index}`);
    const res = await fetch(apiInfo.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'OTT Navigator/1.7.1.3 (Linux; Android 14) OTTNavigator/1.7.1.3',
        'Accept': '*/*',
      },
      cf: { cacheTtl: 300, cacheEverything: true },
      signal: ctrl.signal,
    });
    clearTimeout(tid);

    if (!res.ok) {
      console.error(`[FETCH FAIL] API #${apiInfo.index} HTTP ${res.status}`);
      return { index: apiInfo.index, success: false, content: '' };
    }

    const text = await res.text();
    if (!text || !text.includes('#EXTINF')) {
      console.error(`[FETCH FAIL] API #${apiInfo.index} invalid M3U`);
      return { index: apiInfo.index, success: false, content: '' };
    }

    console.log(`[FETCH OK] API #${apiInfo.index} — ${text.length} bytes`);
    return { index: apiInfo.index, success: true, content: text };

  } catch (err) {
    clearTimeout(tid);
    console.error(`[FETCH ERROR] API #${apiInfo.index}: ${err.message}`);
    return { index: apiInfo.index, success: false, content: '' };
  }
}

// ============================================================
//  CHECK IF ENTRY IS VOD/MOVIE  (smart 3-step logic)
// ============================================================
function isVodEntry(extinfLine, urlLine) {
  const infoLower = (extinfLine || '').toLowerCase();
  const url       = (urlLine   || '').trim();
  const urlLower  = url.toLowerCase();

  // ── Step 1: Is the URL clearly LIVE? ──────────────────────
  const isDefinitelyLive = LIVE_URL_PATTERNS.some(p => p.test(url));
  if (isDefinitelyLive) {
    return false;
  }

  // ── Step 2: Is the URL clearly VOD? ───────────────────────
  const isDefinitelyVod = VOD_URL_PATTERNS.some(p => p.test(urlLower));
  if (isDefinitelyVod) {
    return true;
  }

  // ── Step 3: Check group-title keywords ────────────────────
  const groupMatch = infoLower.match(/group-title="([^"]*)"/);
  if (groupMatch) {
    const groupTitle = groupMatch[1].toLowerCase();
    const groupIsVod = VOD_GROUP_KEYWORDS.some(kw => groupTitle.includes(kw));
    if (groupIsVod) {
      return true;
    }
  }

  // ── Step 4: Channel name has episode pattern → VOD ────────
  const channelNameMatch = infoLower.match(/,(.+)$/);
  if (channelNameMatch) {
    const channelName = channelNameMatch[1];
    const hasEpisodeTag = EPISODE_NAME_PATTERNS.some(p => p.test(channelName));
    if (hasEpisodeTag) {
      return true;
    }
  }

  return false;
}

// ============================================================
//  FILTER VOD ENTRIES FROM M3U
// ============================================================
function filterVodEntries(content) {
  const lines    = content.split('\n');
  const filtered = [];
  let removedCount = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('#EXTINF')) {
      const entryLines = [line];
      let j = i + 1;
      let streamUrl = '';

      while (j < lines.length) {
        const nextLine = lines[j];
        entryLines.push(nextLine);

        if (!nextLine.startsWith('#') && nextLine.trim().length > 0) {
          streamUrl = nextLine.trim();
          j++;
          break;
        }
        j++;
      }

      if (isVodEntry(line, streamUrl)) {
        removedCount++;
      } else {
        filtered.push(...entryLines);
      }

      i = j;
    } else {
      filtered.push(line);
      i++;
    }
  }

  console.log(`[VOD FILTER] Removed ${removedCount} VOD entries`);
  return filtered.join('\n');
}

// ============================================================
//  CHECK IF ENTRY'S GROUP IS HIDDEN  (PARTIAL, case-insensitive)
// ============================================================
function isHiddenGroup(extinfLine) {
  if (GROUP_HIDE_LIST.length === 0) return false;

  const groupMatch = (extinfLine || '').match(/group-title="([^"]*)"/i);
  if (!groupMatch) return false;

  const groupTitle = groupMatch[1].trim().toLowerCase();
  return GROUP_HIDE_LIST.some(g => groupTitle.includes(g.trim().toLowerCase()));
}

// ============================================================
//  FILTER HIDDEN-GROUP ENTRIES FROM M3U
// ============================================================
function filterHiddenGroups(content) {
  if (GROUP_HIDE_LIST.length === 0) return content;

  const lines    = content.split('\n');
  const filtered = [];
  let removedCount = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('#EXTINF')) {
      const entryLines = [line];
      let j = i + 1;

      while (j < lines.length) {
        const nextLine = lines[j];
        entryLines.push(nextLine);

        if (!nextLine.startsWith('#') && nextLine.trim().length > 0) {
          j++;
          break;
        }
        j++;
      }

      if (isHiddenGroup(line)) {
        removedCount++;
      } else {
        filtered.push(...entryLines);
      }

      i = j;
    } else {
      filtered.push(line);
      i++;
    }
  }

  console.log(`[GROUP HIDE] Removed ${removedCount} entries from hidden groups`);
  return filtered.join('\n');
}

// ============================================================
//  RENAME GROUPS
// ============================================================
function renameGroups(content) {
  let m3u = content;
  for (const [oldName, newName] of Object.entries(GROUP_RENAME_MAP)) {
    const esc = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    m3u = m3u.replace(new RegExp(`group-title="${esc}"`, 'gi'), `group-title="${newName}"`);
    m3u = m3u.replace(new RegExp(`group-title='${esc}'`, 'gi'), `group-title="${newName}"`);
  }
  return m3u;
}

// ============================================================
//  RENAME CHANNEL NAMES
// ============================================================
function renameChannels(content) {
  let m3u = content;
  for (const [oldName, newName] of Object.entries(CHANNEL_RENAME_MAP)) {
    const esc = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    m3u = m3u.replace(new RegExp(esc, 'gi'), newName);
  }
  return m3u;
}

// ============================================================
//  TRANSFORM M3U CONTENT
// ============================================================
function transformM3UContent(content) {
  let m3u = content;

  // Remove #EXTM3U header
  m3u = m3u.replace(/^#EXTM3U[^\n]*\n?/i, '');

  // Filter VOD
  m3u = filterVodEntries(m3u);

  // Filter hidden groups (original group names, rename se pehle)
  m3u = filterHiddenGroups(m3u);

  // Rename groups
  m3u = renameGroups(m3u);

  // Rename channel names
  m3u = renameChannels(m3u);

  // Replace group-logo
  m3u = m3u.replace(/group-logo="[^"]*"/gi, `group-logo="${RKDYIPTV_LOGO}"`);
  m3u = m3u.replace(/group-logo='[^']*'/gi,  `group-logo="${RKDYIPTV_LOGO}"`);

  return m3u.trim();
}

// ============================================================
//  MERGE M3US
// ============================================================
function mergeM3Us(results) {
  const successful = results.filter(r => r.success && r.content);
  if (successful.length === 0) return null;

  const parts = [`#EXTM3U refresh="${REFRESH_SECONDS}"\n`];
  for (const result of successful) {
    const transformed = transformM3UContent(result.content);
    if (transformed) {
      parts.push(transformed);
      parts.push('\n');
    }
  }
  return parts.join('');
}

// ============================================================
//  ENTRY POINT
// ============================================================
export async function onRequest(context) {
  const { request, env } = context;

  const commonHeaders = {
    'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Powered-By': 'RKDYIPTV',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: commonHeaders });
  }

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: { ...commonHeaders, 'Content-Type': 'application/x-mpegurl' },
    });
  }

  const apiUrls = collectApiUrls(env);
  if (apiUrls.length === 0) {
    return new Response(errorM3U('No APIs configured — contact admin'), {
      status: 500,
      headers: { ...commonHeaders, 'Content-Type': 'application/x-mpegurl; charset=utf-8' },
    });
  }

  console.log(`[PROXY START] ${apiUrls.length} APIs configured`);

  if (!isIPTVApp(request)) {
    return Response.redirect(TELEGRAM_URL, 302);
  }

  try {
    const fetchPromises = apiUrls.map(api => fetchOneApi(api));
    const results       = await Promise.all(fetchPromises);

    const mergedM3U = mergeM3Us(results);
    if (!mergedM3U) {
      return new Response(errorM3U('All backend APIs failed'), {
        status: 502,
        headers: { ...commonHeaders, 'Content-Type': 'application/x-mpegurl; charset=utf-8' },
      });
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[PROXY OK] ${successCount}/${apiUrls.length} APIs | ${mergedM3U.length} bytes`);

    return new Response(mergedM3U, {
      status: 200,
      headers: {
        ...commonHeaders,
        'Content-Type':        'application/x-mpegurl; charset=utf-8',
        'Content-Disposition': 'inline',
        'Cache-Control':       `public, max-age=${REFRESH_SECONDS}`,
        'X-Refresh-Interval':  String(REFRESH_SECONDS),
        'X-APIs-Success':      `${successCount}/${apiUrls.length}`,
      },
    });

  } catch (err) {
    console.error('[PROXY ERROR]', err.message);
    return new Response(errorM3U(err.message), {
      status: 500,
      headers: { ...commonHeaders, 'Content-Type': 'application/x-mpegurl; charset=utf-8' },
    });
  }
}

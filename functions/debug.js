// ============================================================
//  RKDYIPTV — Debug Endpoint
//  File: functions/debug.js
//  Route: /debug?token=YOUR_TOKEN
//  Shows: Portal info, cache state, live/VOD test fetch
// ============================================================

import { resolvePortal, getPortals } from './_lib/portals.js';

function getStalkerHeaders(portalConfig, token = null) {
  const h = {
    'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 4 rev: 1812 Safari/533.3',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-User-Agent': 'Model: MAG250; Link: WiFi',
    'Cookie': `mac=${portalConfig.mac}; stb_lang=en; timezone=Asia/Kolkata;`,
    'Referer': `${portalConfig.portalUrl}/c/`,
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function getStalkerToken(portalConfig) {
  const url = `${portalConfig.portalUrl}/server/load.php?type=stb&action=handshake&prehash=0&token=&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(portalConfig) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Handshake failed: ' + text.slice(0, 100)); }
  if (!data.js?.token) throw new Error('No token in handshake response');
  return data.js.token;
}

async function getVODCategories(portalConfig, token) {
  const url = `${portalConfig.portalUrl}/server/load.php?type=vod&action=get_categories&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(portalConfig, token) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { return { error: 'Parse failed', raw: text.slice(0, 200) }; }
  return data.js || {};
}

async function getFirstVODMovies(portalConfig, token, categoryId) {
  const url = `${portalConfig.portalUrl}/server/load.php?type=vod&action=get_ordered_list&category=${categoryId}&sortby=added&p=1&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(portalConfig, token) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { return { error: 'Parse failed' }; }
  return data.js || {};
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userToken = url.searchParams.get('token');

  const commonHeaders = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  };

  if (!env.TOKENS) {
    return new Response('<h1>❌ KV binding TOKENS missing</h1>', {
      status: 500, headers: commonHeaders,
    });
  }

  const debug = {
    step1_input: { userToken: userToken || 'MISSING' },
    step2_portals: null,
    step3_tokenData: null,
    step4_resolvedPortal: null,
    step5_liveTest: null,
    step6_vodTest: null,
    step7_firstMovies: null,
    errors: [],
  };

  try {
    // ── STEP 2: List all portals ──
    const portals = await getPortals(env);
    debug.step2_portals = {
      count: portals.length,
      portals: portals.map(p => ({
        id: p.id,
        name: p.name,
        url: p.url,
        mac: p.mac,
        serial: p.serial,
        isDefault: !!p.isDefault,
      })),
    };

    if (!userToken) {
      return renderHTML(debug, '⚠️ No token provided. Use: /debug?token=YOUR_TOKEN');
    }

    // ── STEP 3: Get token data ──
    const tokenData = await env.TOKENS.get(`token:${userToken}`, { type: 'json' });
    if (!tokenData) {
      debug.errors.push('Token not found in KV');
      return renderHTML(debug, '❌ Token not found');
    }
    debug.step3_tokenData = tokenData;

    // ── STEP 4: Resolve portal ──
    const resolved = await resolvePortal(env, tokenData.portalId);
    if (!resolved) {
      debug.errors.push('No portal could be resolved');
      return renderHTML(debug, '❌ No portal resolved');
    }
    debug.step4_resolvedPortal = {
      id: resolved.id,
      name: resolved.name,
      config: resolved.config,
      matchType: tokenData.portalId === resolved.id ? '✅ EXACT MATCH' : '⚠️ FALLBACK (token portal not found)',
    };

    const portalConfig = resolved.config;

    // ── STEP 5: Test Stalker handshake ──
    let stalkerToken;
    try {
      stalkerToken = await getStalkerToken(portalConfig);
      debug.step5_liveTest = {
        handshake: '✅ SUCCESS',
        stalkerToken: stalkerToken.slice(0, 16) + '...',
      };
    } catch (err) {
      debug.step5_liveTest = { handshake: '❌ FAILED', error: err.message };
      debug.errors.push('Handshake failed: ' + err.message);
      return renderHTML(debug, '❌ Handshake failed');
    }

    // ── STEP 6: Fetch VOD categories ──
    try {
      const vodCats = await getVODCategories(portalConfig, stalkerToken);
      const catArray = Array.isArray(vodCats) ? vodCats : [];
      debug.step6_vodTest = {
        totalCategories: catArray.length,
        firstFive: catArray.slice(0, 5).map(c => ({ id: c.id, title: c.title })),
        raw: catArray.length === 0 ? vodCats : undefined,
      };

      // ── STEP 7: Fetch first 5 movies from first category ──
      if (catArray.length > 0) {
        const firstCat = catArray.find(c => c.id && c.id !== '*') || catArray[0];
        const movies = await getFirstVODMovies(portalConfig, stalkerToken, firstCat.id);
        const movieList = movies?.data || [];
        debug.step7_firstMovies = {
          categoryUsed: firstCat.title,
          categoryId: firstCat.id,
          totalMoviesInCat: movies?.total_items || 0,
          firstFive: movieList.slice(0, 5).map(m => ({
            id: m.id,
            name: m.name,
            year: m.year,
            added: m.added,
          })),
        };
      }
    } catch (err) {
      debug.step6_vodTest = { error: err.message };
      debug.errors.push('VOD fetch failed: ' + err.message);
    }

    return renderHTML(debug, '✅ Debug complete');

  } catch (err) {
    debug.errors.push('Fatal: ' + err.message);
    return renderHTML(debug, '❌ Fatal error');
  }
}

function renderHTML(debug, title) {
  const json = JSON.stringify(debug, null, 2);
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>RKDYIPTV Debug</title>
<style>
  body {
    background: #0b0b12;
    color: #eee;
    font-family: 'Courier New', monospace;
    padding: 20px;
    line-height: 1.5;
  }
  h1 {
    color: #4ea1ff;
    border-bottom: 2px solid #4ea1ff;
    padding-bottom: 10px;
  }
  pre {
    background: #000;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #333;
    overflow-x: auto;
    font-size: 13px;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .success { color: #2ed573; }
  .error { color: #ff5555; }
  .warn { color: #ffaa33; }
  .info-box {
    background: rgba(78,161,255,0.1);
    border: 1px solid rgba(78,161,255,0.3);
    padding: 15px;
    border-radius: 8px;
    margin: 15px 0;
    font-family: Arial, sans-serif;
  }
  code {
    background: #222;
    padding: 2px 6px;
    border-radius: 4px;
    color: #ffaa33;
  }
</style>
</head>
<body>
  <h1>🔍 RKDYIPTV Debug — ${title}</h1>
  
  <div class="info-box">
    <b>Usage:</b> <code>/debug?token=YOUR_PLAYLIST_TOKEN</code><br>
    <b>What to check:</b>
    <ol>
      <li><b>step2_portals</b> — Kaunse portals hain KV mein</li>
      <li><b>step3_tokenData</b> — Token mein saved portalId + portalName</li>
      <li><b>step4_resolvedPortal</b> — Actually kaunsa portal use ho raha (check <code>matchType</code>)</li>
      <li><b>step6_vodTest</b> — VOD categories jo actually fetch hui</li>
      <li><b>step7_firstMovies</b> — Pehle 5 movies naam ke saath</li>
    </ol>
  </div>

  <pre>${json.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

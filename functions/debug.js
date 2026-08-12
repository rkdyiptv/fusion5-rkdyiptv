// ============================================================
//  RKDYIPTV — Debug v3 (Find where Fusion data is coming from)
//  File: functions/debug.js
// ============================================================

import { getPortals } from './_lib/portals.js';

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

export async function onRequest(context) {
  const { env } = context;
  const debug = {};

  try {
    // ── 1. Get portal config being used ──
    const portals = await getPortals(env);
    if (!portals.length) return renderHTML({ error: 'No portals' });

    const p = portals[0];
    debug['1_portal_saved_in_KV'] = {
      id: p.id,
      name: p.name,
      url: p.url,
      mac: p.mac,
      serial: p.serial,
      deviceId1: p.deviceId1,
      deviceId2: p.deviceId2,
    };

    const portalConfig = {
      portalUrl: p.url,
      mac: p.mac,
      serialNo: p.serial,
      deviceId: p.deviceId1,
      deviceId2: p.deviceId2,
    };

    // ── 2. Handshake ──
    const hsRes = await fetch(
      `${portalConfig.portalUrl}/server/load.php?type=stb&action=handshake&prehash=0&token=&JsHttpRequest=1-xml`,
      { headers: getStalkerHeaders(portalConfig) }
    );
    const hsText = await hsRes.text();
    const hsData = JSON.parse(hsText);
    const token = hsData.js.token;

    // ── 3. Get profile ──
    await fetch(
      `${portalConfig.portalUrl}/server/load.php?type=stb&action=get_profile&hd=1&sn=${portalConfig.serialNo}&stb_type=MAG250&client_type=STB&image_version=218&video_out=hdmi&device_id=${portalConfig.deviceId}&device_id2=${portalConfig.deviceId2}&hw_version=1.7-BD-00&not_valid_token=0&timestamp=${Math.floor(Date.now()/1000)}&JsHttpRequest=1-xml`,
      { headers: getStalkerHeaders(portalConfig, token) }
    );

    // ── 4. Get account info to see WHO owns this MAC ──
    const accRes = await fetch(
      `${portalConfig.portalUrl}/server/load.php?type=account_info&action=get_main_info&JsHttpRequest=1-xml`,
      { headers: getStalkerHeaders(portalConfig, token) }
    );
    const accText = await accRes.text();
    debug['2_account_info'] = accText;

    // ── 5. Get VOD categories ──
    const catRes = await fetch(
      `${portalConfig.portalUrl}/server/load.php?type=vod&action=get_categories&JsHttpRequest=1-xml`,
      { headers: getStalkerHeaders(portalConfig, token) }
    );
    const catText = await catRes.text();
    const catData = JSON.parse(catText);
    
    debug['3_vod_categories_from_server'] = {
      total: Array.isArray(catData.js) ? catData.js.length : 0,
      all: Array.isArray(catData.js) ? catData.js.map(c => ({ id: c.id, title: c.title })) : catData,
    };

    // ── 6. Check first 3 categories - fetch movies ──
    const sampleMovies = {};
    if (Array.isArray(catData.js)) {
      const validCats = catData.js.filter(c => c.id && c.id !== '*').slice(0, 3);
      for (const cat of validCats) {
        try {
          const movRes = await fetch(
            `${portalConfig.portalUrl}/server/load.php?type=vod&action=get_ordered_list&category=${cat.id}&sortby=added&p=1&JsHttpRequest=1-xml`,
            { headers: getStalkerHeaders(portalConfig, token) }
          );
          const movText = await movRes.text();
          const movData = JSON.parse(movText);
          sampleMovies[cat.title] = {
            total: movData.js?.total_items || 0,
            firstThree: (movData.js?.data || []).slice(0, 3).map(m => m.name),
          };
        } catch (e) {
          sampleMovies[cat.title] = { error: e.message };
        }
      }
    }
    debug['4_sample_movies_per_category'] = sampleMovies;

    return renderHTML(debug);

  } catch (err) {
    debug.error = err.message;
    return renderHTML(debug);
  }
}

function renderHTML(debug) {
  const json = JSON.stringify(debug, null, 2);
  return new Response(`<!DOCTYPE html>
<html><head><title>Debug v3</title>
<style>
  body{background:#0b0b12;color:#eee;font-family:monospace;padding:20px}
  h1{color:#4ea1ff}
  pre{background:#000;padding:15px;border-radius:8px;white-space:pre-wrap;word-break:break-all;font-size:11px}
</style></head>
<body>
<h1>🔍 Debug v3 — What server actually returns</h1>
<pre>${json.replace(/</g, '&lt;')}</pre>
</body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

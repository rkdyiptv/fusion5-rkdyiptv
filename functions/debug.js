// ============================================================
//  RKDYIPTV — Debug Endpoint v2 (VOD deep diagnostics)
//  File: functions/debug.js
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

async function callAPI(url, headers) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  return { status: res.status, text, url };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userToken = url.searchParams.get('token');

  const debug = { steps: [] };

  try {
    const portals = await getPortals(env);
    debug.steps.push({ '1_portals_count': portals.length });

    if (!portals.length) {
      return renderHTML(debug, '❌ No portals');
    }

    const p = portals[0];
    const portalConfig = {
      portalUrl: p.url,
      mac: p.mac,
      serialNo: p.serial,
      deviceId: p.deviceId1,
      deviceId2: p.deviceId2,
    };

    // STEP 1: Handshake
    const hs = await callAPI(
      `${portalConfig.portalUrl}/server/load.php?type=stb&action=handshake&prehash=0&token=&JsHttpRequest=1-xml`,
      getStalkerHeaders(portalConfig)
    );
    debug.steps.push({ '2_handshake_status': hs.status, '2_handshake_raw': hs.text.slice(0, 300) });

    let stalkerToken;
    try {
      stalkerToken = JSON.parse(hs.text).js.token;
      debug.steps.push({ '2_handshake_token': stalkerToken.slice(0, 20) + '...' });
    } catch {
      return renderHTML(debug, '❌ Handshake parse failed');
    }

    // STEP 2: Get Profile (IMPORTANT for authorization)
    const profileUrl = `${portalConfig.portalUrl}/server/load.php?type=stb&action=get_profile&hd=1&sn=${portalConfig.serialNo}&stb_type=MAG250&client_type=STB&image_version=218&video_out=hdmi&device_id=${portalConfig.deviceId}&device_id2=${portalConfig.deviceId2}&hw_version=1.7-BD-00&not_valid_token=0&timestamp=${Math.floor(Date.now()/1000)}&JsHttpRequest=1-xml`;
    const prof = await callAPI(profileUrl, getStalkerHeaders(portalConfig, stalkerToken));
    debug.steps.push({ '3_profile_status': prof.status, '3_profile_raw': prof.text.slice(0, 500) });

    // STEP 3: Get Account Info (auth check)
    const accInfo = await callAPI(
      `${portalConfig.portalUrl}/server/load.php?type=account_info&action=get_main_info&JsHttpRequest=1-xml`,
      getStalkerHeaders(portalConfig, stalkerToken)
    );
    debug.steps.push({ '4_account_status': accInfo.status, '4_account_raw': accInfo.text.slice(0, 500) });

    // STEP 4: Try VOD categories (basic)
    const vod1 = await callAPI(
      `${portalConfig.portalUrl}/server/load.php?type=vod&action=get_categories&JsHttpRequest=1-xml`,
      getStalkerHeaders(portalConfig, stalkerToken)
    );
    debug.steps.push({ '5_vod_categories_status': vod1.status, '5_vod_categories_raw': vod1.text.slice(0, 500) });

    // STEP 5: Try VOD with full params (like IPTV app)
    const vod2 = await callAPI(
      `${portalConfig.portalUrl}/server/load.php?type=vod&action=get_categories&p=1&JsHttpRequest=1-xml`,
      getStalkerHeaders(portalConfig, stalkerToken)
    );
    debug.steps.push({ '6_vod_categories_v2_status': vod2.status, '6_vod_categories_v2_raw': vod2.text.slice(0, 500) });

    // STEP 6: Try get_ordered_list directly
    const vod3 = await callAPI(
      `${portalConfig.portalUrl}/server/load.php?type=vod&action=get_ordered_list&category=*&genre=*&force_ch_link_check=&fav=0&sortby=added&hd=0&not_ended=0&p=1&JsHttpRequest=1-xml`,
      getStalkerHeaders(portalConfig, stalkerToken)
    );
    debug.steps.push({ '7_vod_ordered_status': vod3.status, '7_vod_ordered_raw': vod3.text.slice(0, 500) });

    return renderHTML(debug, '✅ Deep VOD debug complete');

  } catch (err) {
    debug.error = err.message;
    return renderHTML(debug, '❌ Error');
  }
}

function renderHTML(debug, title) {
  const json = JSON.stringify(debug, null, 2);
  return new Response(`<!DOCTYPE html>
<html><head><title>Debug v2</title>
<style>
  body{background:#0b0b12;color:#eee;font-family:monospace;padding:20px}
  h1{color:#4ea1ff}
  pre{background:#000;padding:15px;border-radius:8px;white-space:pre-wrap;word-break:break-all;font-size:12px}
</style></head>
<body>
<h1>🔍 Deep VOD Debug — ${title}</h1>
<pre>${json.replace(/</g, '&lt;')}</pre>
</body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

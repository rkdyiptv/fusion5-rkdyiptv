// ============================================================
//  RKDYIPTV — VOD Debug Tool
//  File: functions/api/debug/vod-test.js
//  Route: /api/debug/vod-test?key=YOUR_SECURITY_KEY
// ============================================================

const PORTAL_CONFIG = {
  portalUrl: 'http://tv.stream4k.cc:80/stalker_portal',
  mac: '00:1A:79:00:00:43',
  serialNo: 'F6F47B17CA5B7',
  deviceId: '8DEAD6F4A3A3ED4004275EDD9D79C87533ABF379FCE1629AECCF2E6E9F3FE321',
  deviceId2: '8DEAD6F4A3A3ED4004275EDD9D79C87533ABF379FCE1629AECCF2E6E9F3FE321',
  timezone: 'Asia/Kolkata',
};

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
  const url = `${PORTAL_CONFIG.portalUrl}/server/load.php?type=stb&action=handshake&prehash=0&token=&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders() });
  const text = await res.text();
  const data = JSON.parse(text);
  return data.js?.token;
}

async function setupProfile(token) {
  const url = `${PORTAL_CONFIG.portalUrl}/server/load.php?type=stb&action=get_profile&hd=1&sn=${PORTAL_CONFIG.serialNo}&stb_type=MAG250&client_type=STB&image_version=218&video_out=hdmi&device_id=${PORTAL_CONFIG.deviceId}&device_id2=${PORTAL_CONFIG.deviceId2}&hw_version=1.7-BD-00&not_valid_token=0&timestamp=${Math.floor(Date.now()/1000)}&JsHttpRequest=1-xml`;
  const res = await fetch(url, { headers: getStalkerHeaders(token) });
  return await res.text();
}

async function testEndpoint(token, name, url) {
  try {
    const res = await fetch(url, { headers: getStalkerHeaders(token) });
    const text = await res.text();
    let parsed = null;
    let dataInfo = 'N/A';
    try {
      parsed = JSON.parse(text);
      if (parsed.js) {
        if (Array.isArray(parsed.js)) {
          dataInfo = `Array with ${parsed.js.length} items`;
        } else if (parsed.js.data && Array.isArray(parsed.js.data)) {
          dataInfo = `Data array with ${parsed.js.data.length} items (total: ${parsed.js.total_items || 'unknown'})`;
        } else {
          dataInfo = `Object: ${Object.keys(parsed.js).join(', ')}`;
        }
      }
    } catch (e) {
      dataInfo = 'JSON parse failed';
    }
    return {
      name,
      url,
      status: res.status,
      dataInfo,
      preview: text.substring(0, 500),
    };
  } catch (err) {
    return { name, url, error: err.message };
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  const SECRET_KEY = env.SECURITY_KEY || 'rkdyiptv@2024#secret';

  if (key !== SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Add ?key=YOUR_SECURITY_KEY' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const token = await getStalkerToken();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Handshake failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await setupProfile(token);

    // Test multiple VOD endpoints
    const tests = [
      {
        name: 'VOD Categories',
        url: `${PORTAL_CONFIG.portalUrl}/server/load.php?type=vod&action=get_categories&JsHttpRequest=1-xml`,
      },
      {
        name: 'VOD Genres (alternate)',
        url: `${PORTAL_CONFIG.portalUrl}/server/load.php?type=vod&action=get_genres&JsHttpRequest=1-xml`,
      },
      {
        name: 'VOD All Movies (page 1)',
        url: `${PORTAL_CONFIG.portalUrl}/server/load.php?type=vod&action=get_ordered_list&category=*&sortby=added&p=1&JsHttpRequest=1-xml`,
      },
      {
        name: 'VOD List (basic)',
        url: `${PORTAL_CONFIG.portalUrl}/server/load.php?type=vod&action=get_ordered_list&p=1&JsHttpRequest=1-xml`,
      },
      {
        name: 'Series Categories',
        url: `${PORTAL_CONFIG.portalUrl}/server/load.php?type=series&action=get_categories&JsHttpRequest=1-xml`,
      },
      {
        name: 'Series All',
        url: `${PORTAL_CONFIG.portalUrl}/server/load.php?type=series&action=get_ordered_list&category=*&sortby=added&p=1&JsHttpRequest=1-xml`,
      },
      {
        name: 'Modules (available features)',
        url: `${PORTAL_CONFIG.portalUrl}/server/load.php?type=stb&action=get_modules&JsHttpRequest=1-xml`,
      },
    ];

    const results = [];
    for (const test of tests) {
      const result = await testEndpoint(token, test.name, test.url);
      results.push(result);
    }

    return new Response(JSON.stringify({
      success: true,
      portal: PORTAL_CONFIG.portalUrl,
      mac: PORTAL_CONFIG.mac,
      stalkerToken: token.substring(0, 20) + '...',
      tests: results,
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

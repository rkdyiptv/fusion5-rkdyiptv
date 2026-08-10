// ============================================================
//  RKDYIPTV — List Tokens API
//  File: functions/api/admin/list-tokens.js
//  Route: GET /api/admin/list-tokens
// ============================================================

function checkAdminSession(request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/rkdy_admin=([^;]+)/);
  return match && match[1].length > 20;
}

export async function onRequest(context) {
  const { request, env } = context;

  const commonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  if (!checkAdminSession(request)) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401, headers: commonHeaders,
    });
  }

  if (!env.TOKENS) {
    return new Response(JSON.stringify({ success: false, error: 'KV binding TOKENS missing' }), {
      status: 500, headers: commonHeaders,
    });
  }

  try {
    // List all keys with prefix "token:"
    const list = await env.TOKENS.list({ prefix: 'token:', limit: 1000 });
    
    const tokens = [];
    for (const key of list.keys) {
      try {
        const data = await env.TOKENS.get(key.name, { type: 'json' });
        if (data) {
          tokens.push(data);
        }
      } catch (e) {
        console.error('[LIST TOKENS] Failed to fetch:', key.name);
      }
    }

    return new Response(JSON.stringify({ success: true, tokens }), {
      status: 200, headers: commonHeaders,
    });

  } catch (err) {
    console.error('[LIST TOKENS ERROR]', err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: commonHeaders,
    });
  }
}

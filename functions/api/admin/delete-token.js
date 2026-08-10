// ============================================================
//  RKDYIPTV — Delete Token API
//  File: functions/api/admin/delete-token.js
//  Route: POST /api/admin/delete-token
// ============================================================

function checkAdminSession(request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/rkdy_admin=([^;]+)/);
  return match && match[1].length > 20;
}

export async function onRequest(context) {
  const { request, env } = context;
  const commonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'POST required' }), {
      status: 405, headers: commonHeaders,
    });
  }

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
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'Token required' }), {
        status: 400, headers: commonHeaders,
      });
    }

    await env.TOKENS.delete(`token:${token}`);
    console.log(`[ADMIN] Token deleted: ${token.slice(0,8)}...`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: commonHeaders,
    });

  } catch (err) {
    console.error('[DELETE TOKEN ERROR]', err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: commonHeaders,
    });
  }
}

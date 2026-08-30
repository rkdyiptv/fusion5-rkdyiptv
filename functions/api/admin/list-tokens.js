// ============================================================
//  RKDYIPTV — List Tokens API
//  File: functions/api/admin/list-tokens.js
//  Route: GET /api/admin/list-tokens
// ============================================================
import { listTokens } from '../../_lib/tokens.js';

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

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'D1 binding DB missing' }), {
      status: 500, headers: commonHeaders,
    });
  }

  try {
    const tokens = await listTokens(env);

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

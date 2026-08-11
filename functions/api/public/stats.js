// ============================================================
//  RKDYIPTV — Public Playlist Stats
//  File: functions/api/public/stats.js
//  Route: GET /api/public/stats
//  Reads the counter written by create-token.js. Purely informational,
//  read-only — never increments anything here.
// ============================================================

const STATS_KEY = 'stats:playlists';

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

export async function onRequest(context) {
  const { request, env } = context;
  const commonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ success: false, error: 'GET required' }), {
      status: 405, headers: commonHeaders,
    });
  }

  if (!env.TOKENS) {
    return new Response(JSON.stringify({ success: false, error: 'KV binding TOKENS missing' }), {
      status: 500, headers: commonHeaders,
    });
  }

  const today = todayUTC();
  let total = 0;
  let todayCount = 0;

  const raw = await env.TOKENS.get(STATS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      total = parsed.total || 0;
      todayCount = parsed.date === today ? (parsed.todayCount || 0) : 0;
    } catch (_) { /* leave at 0 on corrupt data */ }
  }

  return new Response(JSON.stringify({
    success: true,
    total,
    today: todayCount,
    date: today,
  }), { status: 200, headers: commonHeaders });
}

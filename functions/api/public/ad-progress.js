// ============================================================
//  RKDYIPTV — Public Ad Progress Tracker
//  File: functions/api/public/ad-progress.js
//  GET  -> start new ad-watch session
//  POST -> increment watched-ad count (server verified)
// ============================================================

const REQUIRED_ADS = 5;
const SESSION_TTL = 900; // 15 min window to finish watching ads

function generateSessionId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  const { request, env } = context;
  const commonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  if (!env.TOKENS) {
    return new Response(JSON.stringify({ success: false, error: 'KV binding TOKENS missing' }), {
      status: 500, headers: commonHeaders,
    });
  }

  // ── Start new session ──
  if (request.method === 'GET') {
    const sessionId = generateSessionId();
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const sessionData = { count: 0, createdAt: Date.now(), ip };
    await env.TOKENS.put(`adsession:${sessionId}`, JSON.stringify(sessionData), {
      expirationTtl: SESSION_TTL,
    });
    return new Response(JSON.stringify({ success: true, sessionId, required: REQUIRED_ADS }), {
      status: 200, headers: commonHeaders,
    });
  }

  // ── Mark one ad as watched ──
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const sessionId = body.sessionId;
      if (!sessionId || typeof sessionId !== 'string') {
        return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
          status: 400, headers: commonHeaders,
        });
      }

      const raw = await env.TOKENS.get(`adsession:${sessionId}`);
      if (!raw) {
        return new Response(JSON.stringify({ success: false, error: 'Session expire ho gaya, page reload karo' }), {
          status: 400, headers: commonHeaders,
        });
      }

      const sessionData = JSON.parse(raw);
      sessionData.count = Math.min((sessionData.count || 0) + 1, REQUIRED_ADS);

      await env.TOKENS.put(`adsession:${sessionId}`, JSON.stringify(sessionData), {
        expirationTtl: SESSION_TTL,
      });

      return new Response(JSON.stringify({ success: true, count: sessionData.count, required: REQUIRED_ADS }), {
        status: 200, headers: commonHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: commonHeaders,
      });
    }
  }

  return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
    status: 405, headers: commonHeaders,
  });
}

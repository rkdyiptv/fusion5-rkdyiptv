// ============================================================
//  RKDYIPTV — Public Ad Progress Tracker
//  File: functions/api/public/ad-progress.js
//  GET  -> start new ad-watch session (blocked during cooldown)
//  POST -> increment watched-ad count (server verified)
// ============================================================

const REQUIRED_ADS = 5;
const SESSION_TTL = 480; // 15 min window to finish watching ads

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
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    // Respect the 15-minute cooldown after a successful generation
    const cooldownRaw = await env.TOKENS.get(`cooldown:${ip}`);
    if (cooldownRaw) {
      const cooldownExpiresAt = parseInt(cooldownRaw, 10);
      const remainingMs = cooldownExpiresAt - Date.now();
      if (remainingMs > 0) {
        return new Response(JSON.stringify({
          success: false,
          cooldown: true,
          remainingMs,
          error: 'Please wait before starting a new playlist request.',
        }), { status: 429, headers: commonHeaders });
      }
    }

    const sessionId = generateSessionId();
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
        return new Response(JSON.stringify({ success: false, error: 'Session expired, please reload the page' }), {
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

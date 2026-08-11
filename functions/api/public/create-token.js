// ============================================================
//  RKDYIPTV — Public Playlist Token Generator (Ad-Gated)
//  File: functions/api/public/create-token.js
//  Route: POST /api/public/create-token
//  Requires: 5 server-verified ads watched. Fixed 24h validity.
// ============================================================

const REQUIRED_ADS = 5;
const FIXED_HOURS = 24;
const MAX_TOKENS_PER_IP_PER_DAY = 5;

function generateTokenId() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  const { request, env } = context;
  const commonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'POST required' }), {
      status: 405, headers: commonHeaders,
    });
  }

  if (!env.TOKENS) {
    return new Response(JSON.stringify({ success: false, error: 'KV binding TOKENS missing' }), {
      status: 500, headers: commonHeaders,
    });
  }

  try {
    const body = await request.json();
    const sessionId = body.sessionId;
    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'Session ID missing' }), {
        status: 400, headers: commonHeaders,
      });
    }

    // ── Verify ad session actually completed 5/5 (server-side, not trust-client) ──
    const rawSession = await env.TOKENS.get(`adsession:${sessionId}`);
    if (!rawSession) {
      return new Response(JSON.stringify({ success: false, error: 'Session expire ho gaya. Page reload karke dubara 5 ads dekho.' }), {
        status: 400, headers: commonHeaders,
      });
    }
    const sessionData = JSON.parse(rawSession);
    if ((sessionData.count || 0) < REQUIRED_ADS) {
      return new Response(JSON.stringify({ success: false, error: `Sirf ${sessionData.count}/${REQUIRED_ADS} ads complete hue hain.` }), {
        status: 400, headers: commonHeaders,
      });
    }

    // ── Basic per-IP anti-abuse limit ──
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const rlKey = `ratelimit:public-token:${ip}`;
    const rlRaw = await env.TOKENS.get(rlKey);
    const rlCount = rlRaw ? parseInt(rlRaw) : 0;
    if (rlCount >= MAX_TOKENS_PER_IP_PER_DAY) {
      return new Response(JSON.stringify({ success: false, error: 'Aaj ka limit khatam ho gaya, kal try karo.' }), {
        status: 429, headers: commonHeaders,
      });
    }

    // ── Create token — same shape as admin create-token.js ──
    const now = Date.now();
    const durationMs = FIXED_HOURS * 60 * 60 * 1000;
    const expiryAt = now + durationMs;
    const tokenId = generateTokenId();

    const tokenData = {
      token: tokenId,
      durationHours: FIXED_HOURS,
      durationLabel: FIXED_HOURS + 'h',
      createdAt: now,
      expiryAt: expiryAt,
      device: null,
      lockedAt: null,
      lockedUA: null,
      firstUseIP: null,
      fetchCount: 0,
      lastUsed: null,
      source: 'public-ad-gate',
    };

    const ttl = Math.ceil(durationMs / 1000);
    await env.TOKENS.put(`token:${tokenId}`, JSON.stringify(tokenData), { expirationTtl: ttl });

    // consume the ad session (single-use) + bump rate limit counter
    await env.TOKENS.delete(`adsession:${sessionId}`);
    await env.TOKENS.put(rlKey, String(rlCount + 1), { expirationTtl: 86400 });

    const url = new URL(request.url);
    const playlistUrl = `${url.origin}/api/rkdyiptv/playlist.m3u?token=${tokenId}`;

    console.log(`[PUBLIC] Ad-gated token created: ${tokenId.slice(0,8)}...`);

    return new Response(JSON.stringify({
      success: true,
      token: tokenId,
      playlistUrl,
      expiryAt,
      durationLabel: FIXED_HOURS + 'h',
    }), { status: 200, headers: commonHeaders });

  } catch (err) {
    console.error('[PUBLIC CREATE TOKEN ERROR]', err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: commonHeaders,
    });
  }
}

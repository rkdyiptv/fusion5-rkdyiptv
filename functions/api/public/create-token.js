// ============================================================
//  RKDYIPTV — Public Playlist Token Generator (Ad-Gated)
//  File: functions/api/public/create-token.js
//  Route: POST /api/public/create-token
//  Requires: 5 server-verified ads watched. Fixed 24h validity.
//  Adds: 15-minute per-IP cooldown after each successful generation.
// ============================================================

const REQUIRED_ADS = 5;
const FIXED_HOURS = 24;
const MAX_TOKENS_PER_IP_PER_DAY = 5;
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
const COOLDOWN_TTL_SECONDS = 900;   // 15 minutes

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

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    // ── Enforce 15-minute cooldown since last successful generation ──
    const cooldownKey = `cooldown:${ip}`;
    const cooldownRaw = await env.TOKENS.get(cooldownKey);
    if (cooldownRaw) {
      const cooldownExpiresAt = parseInt(cooldownRaw, 10);
      const remainingMs = cooldownExpiresAt - Date.now();
      if (remainingMs > 0) {
        return new Response(JSON.stringify({
          success: false,
          cooldown: true,
          remainingMs,
          error: 'Please wait before generating another playlist.',
        }), { status: 429, headers: commonHeaders });
      }
    }

    // ── Verify ad session actually completed 5/5 (server-side, not trust-client) ──
    const rawSession = await env.TOKENS.get(`adsession:${sessionId}`);
    if (!rawSession) {
      return new Response(JSON.stringify({ success: false, error: 'Session expired. Reload the page and watch the 5 ads again.' }), {
        status: 400, headers: commonHeaders,
      });
    }
    const sessionData = JSON.parse(rawSession);
    if ((sessionData.count || 0) < REQUIRED_ADS) {
      return new Response(JSON.stringify({ success: false, error: `Only ${sessionData.count}/${REQUIRED_ADS} ads completed.` }), {
        status: 400, headers: commonHeaders,
      });
    }

    // ── Basic per-IP daily anti-abuse limit ──
    const rlKey = `ratelimit:public-token:${ip}`;
    const rlRaw = await env.TOKENS.get(rlKey);
    const rlCount = rlRaw ? parseInt(rlRaw) : 0;
    if (rlCount >= MAX_TOKENS_PER_IP_PER_DAY) {
      return new Response(JSON.stringify({ success: false, error: 'Daily limit reached, please try again tomorrow.' }), {
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

    // consume the ad session (single-use) + bump daily rate limit counter
    await env.TOKENS.delete(`adsession:${sessionId}`);
    await env.TOKENS.put(rlKey, String(rlCount + 1), { expirationTtl: 86400 });

    // start the 15-minute cooldown for this IP
    await env.TOKENS.put(cooldownKey, String(now + COOLDOWN_MS), { expirationTtl: COOLDOWN_TTL_SECONDS });

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

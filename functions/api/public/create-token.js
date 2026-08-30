// ============================================================
//  RKDYIPTV — Public Playlist Token Generator (Ad-Gated)
//  File: functions/api/public/create-token.js
//  Route: POST /api/public/create-token
//  Requires: 5 server-verified ads watched. Fixed 24h validity.
//  Adds: 15-minute per-IP cooldown after each successful generation.
// ============================================================

import { getPortals } from '../../_lib/portals.js';
import { putToken } from '../../_lib/tokens.js';

const REQUIRED_ADS      = 5;
const FIXED_HOURS       = 48;
const MAX_TOKENS_PER_IP_PER_DAY = 5;
const COOLDOWN_MS       = 8 * 60 * 1000;
const COOLDOWN_TTL_SECONDS = 480;
const STATS_KEY         = 'stats:playlists';

function generateTokenId() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

async function bumpPlaylistStats(env) {
  const today = todayUTC();
  let stats = { total: 0, date: today, todayCount: 0 };
  const raw = await env.TOKENS.get(STATS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      stats.total      = parsed.total || 0;
      stats.todayCount = parsed.date === today ? (parsed.todayCount || 0) : 0;
    } catch (_) {}
  }
  stats.total      += 1;
  stats.todayCount += 1;
  stats.date        = today;
  await env.TOKENS.put(STATS_KEY, JSON.stringify(stats));
  return stats;
}

export async function onRequest(context) {
  const { request, env } = context;
  const commonHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'POST required' }), {
      status: 405, headers: commonHeaders,
    });
  }

  if (!env.TOKENS || !env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Storage binding missing (TOKENS/DB)' }), {
      status: 500, headers: commonHeaders,
    });
  }

  try {
    const body = await request.json();
    const sessionId = body.sessionId;
    const requestedPortalId = typeof body.portalId === 'string' ? body.portalId.trim() : '';

    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'Session ID missing' }), {
        status: 400, headers: commonHeaders,
      });
    }

    // ── Portal resolve — STRICT, no silent fallback ──
    const portals = await getPortals(env);

    if (portals.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No portals configured. Please contact admin.',
      }), { status: 503, headers: commonHeaders });
    }

    let resolvedPortal = null;

    if (requestedPortalId) {
      // ✅ User ne portal select kiya — exactly wahi dhundho
      resolvedPortal = portals.find(p => p.id === requestedPortalId) || null;

      if (!resolvedPortal) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Selected portal not found. Please reload and try again.',
        }), { status: 400, headers: commonHeaders });
      }
    } else {
      // ✅ Portal select nahi kiya — default use karo
      resolvedPortal = portals.find(p => p.isDefault) || portals[0];
    }

    console.log(`[PUBLIC] Portal resolved: ${resolvedPortal.name} (id=${resolvedPortal.id})`);

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    // ── 15-minute cooldown check ──
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

    // ── Verify ad session completed 5/5 ──
    const rawSession = await env.TOKENS.get(`adsession:${sessionId}`);
    if (!rawSession) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Session expired. Reload the page and watch the 5 ads again.',
      }), { status: 400, headers: commonHeaders });
    }

    const sessionData = JSON.parse(rawSession);
    if ((sessionData.count || 0) < REQUIRED_ADS) {
      return new Response(JSON.stringify({
        success: false,
        error: `Only ${sessionData.count}/${REQUIRED_ADS} ads completed.`,
      }), { status: 400, headers: commonHeaders });
    }

    // ── Per-IP daily limit ──
    const rlKey = `ratelimit:public-token:${ip}`;
    const rlRaw = await env.TOKENS.get(rlKey);
    const rlCount = rlRaw ? parseInt(rlRaw, 10) : 0;
    if (rlCount >= MAX_TOKENS_PER_IP_PER_DAY) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Daily limit reached, please try again tomorrow.',
      }), { status: 429, headers: commonHeaders });
    }

    // ── Create token ──
    const now       = Date.now();
    const durationMs = FIXED_HOURS * 60 * 60 * 1000;
    const expiryAt  = now + durationMs;
    const tokenId   = generateTokenId();

    const tokenData = {
      token:        tokenId,
      durationHours: FIXED_HOURS,
      durationLabel: FIXED_HOURS + 'h',
      createdAt:    now,
      expiryAt:     expiryAt,
      device:       null,
      lockedAt:     null,
      lockedUA:     null,
      firstUseIP:   null,
      fetchCount:   0,
      lastUsed:     null,
      source:       'public-ad-gate',
      // ✅ Correct portal — jo user ne select kiya
      portalId:     resolvedPortal.id,
      portalName:   resolvedPortal.name,
    };

    await putToken(env, tokenData);

    // ── Cleanup + counters (still KV — transient, TTL-based) ──
    await env.TOKENS.delete(`adsession:${sessionId}`);
    await env.TOKENS.put(rlKey, String(rlCount + 1), { expirationTtl: 86400 });
    await env.TOKENS.put(cooldownKey, String(now + COOLDOWN_MS), {
      expirationTtl: COOLDOWN_TTL_SECONDS,
    });

    const stats = await bumpPlaylistStats(env);

    const url = new URL(request.url);
    const playlistUrl = `${url.origin}/api/rkdyiptv/playlist.m3u?token=${tokenId}`;

    console.log(
      `[PUBLIC] Token created: ${tokenId.slice(0,8)}... ` +
      `portal=${resolvedPortal.name} (id=${resolvedPortal.id}) ` +
      `total=${stats.total} today=${stats.todayCount}`
    );

    return new Response(JSON.stringify({
      success:        true,
      token:          tokenId,
      playlistUrl,
      expiryAt,
      durationLabel:  FIXED_HOURS + 'h',
      // ✅ Frontend verify kar sakta hai
      portalId:       resolvedPortal.id,
      portalName:     resolvedPortal.name,
      totalGenerated: stats.total,
      todayGenerated: stats.todayCount,
    }), { status: 200, headers: commonHeaders });

  } catch (err) {
    console.error('[PUBLIC CREATE TOKEN ERROR]', err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: commonHeaders,
    });
  }
}

// ============================================================
//  RKDYIPTV — Create Token API
//  File: functions/api/admin/create-token.js
//  Route: POST /api/admin/create-token
// ============================================================

import { getPortals } from '../../_lib/portals.js';

function checkAdminSession(request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/rkdy_admin=([^;]+)/);
  return match && match[1].length > 20;
}
function generateTokenId() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
function formatDurationLabel(hours) {
  if (hours < 24) return hours + 'h';
  const days = hours / 24;
  return days + 'd';
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
    const hours = parseInt(body.hours);
    const validHours = [1, 2, 3, 6, 12, 24, 48, 72, 168, 360, 720];
    if (!validHours.includes(hours)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid duration' }), {
        status: 400, headers: commonHeaders,
      });
    }

    // Resolve which portal this token is for: use the requested portalId if
    // valid, otherwise fall back to whichever portal is marked default.
    let resolvedPortal = null;
    const portals = await getPortals(env);
    if (portals.length > 0) {
      resolvedPortal =
        (body.portalId && portals.find(p => p.id === body.portalId)) ||
        portals.find(p => p.isDefault) ||
        portals[0];
    }

    const now = Date.now();
    const durationMs = hours * 60 * 60 * 1000;
    const expiryAt = now + durationMs;
    const tokenId = generateTokenId();
    const tokenData = {
      token: tokenId,
      durationHours: hours,
      durationLabel: formatDurationLabel(hours),
      createdAt: now,
      expiryAt: expiryAt,
      device: null,
      lockedAt: null,
      lockedUA: null,
      firstUseIP: null,
      fetchCount: 0,
      lastUsed: null,
      portalId: resolvedPortal ? resolvedPortal.id : null,
      portalName: resolvedPortal ? resolvedPortal.name : null,
    };
    const ttl = Math.ceil(durationMs / 1000);
    await env.TOKENS.put(`token:${tokenId}`, JSON.stringify(tokenData), {
      expirationTtl: ttl,
    });
    console.log(`[ADMIN] Token created: ${tokenId.slice(0,8)}... duration=${hours}h portal=${resolvedPortal ? resolvedPortal.name : 'none'}`);
    return new Response(JSON.stringify({
      success: true,
      token: tokenId,
      durationLabel: formatDurationLabel(hours),
      expiryAt: expiryAt,
      portalId: resolvedPortal ? resolvedPortal.id : null,
      portalName: resolvedPortal ? resolvedPortal.name : null,
    }), { status: 200, headers: commonHeaders });
  } catch (err) {
    console.error('[CREATE TOKEN ERROR]', err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: commonHeaders,
    });
  }
}

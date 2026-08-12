// ============================================================
//  RKDYIPTV — Public Portal List (safe fields only)
//  File: functions/api/portal/public-list.js
//  Route: GET /api/portal/public-list
//  No password required. NEVER returns mac/serial/device ids —
//  only id, name, isDefault — safe to expose on the public page.
// ============================================================

import { getPortals, toPublicPortal } from '../../_lib/portals.js';

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

  const portals = await getPortals(env);
  return new Response(JSON.stringify({
    success: true,
    portals: portals.map(toPublicPortal),
  }), { status: 200, headers: commonHeaders });
}

// ============================================================
//  RKDYIPTV — Admin Portal List (full fields)
//  File: functions/api/portal/list.js
//  Route: GET /api/portal/list
//  Requires the portal password via 'x-portal-password' header.
// ============================================================

import { getPortals, checkPortalPassword } from '../../_lib/portals.js';

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

  const password = request.headers.get('x-portal-password') || '';
  if (!checkPortalPassword(password, env)) {
    return new Response(JSON.stringify({ success: false, error: 'Wrong password' }), {
      status: 401, headers: commonHeaders,
    });
  }

  const portals = await getPortals(env);
  return new Response(JSON.stringify({ success: true, portals }), {
    status: 200, headers: commonHeaders,
  });
}

// ============================================================
//  RKDYIPTV — Admin Portal Save (create or update)
//  File: functions/api/portal/save.js
//  Route: POST /api/portal/save
//  Requires the portal password via 'x-portal-password' header.
//  Body: { id? (omit to create new), name, url, mac, serial,
//          deviceId1, deviceId2, isDefault }
// ============================================================

import { checkPortalPassword, upsertPortal } from '../../_lib/portals.js';

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

  const password = request.headers.get('x-portal-password') || '';
  if (!checkPortalPassword(password, env)) {
    return new Response(JSON.stringify({ success: false, error: 'Wrong password' }), {
      status: 401, headers: commonHeaders,
    });
  }

  try {
    const body = await request.json();
    const saved = await upsertPortal(env, body);
    return new Response(JSON.stringify({ success: true, portal: saved }), {
      status: 200, headers: commonHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400, headers: commonHeaders,
    });
  }
}

// ============================================================
//  RKDYIPTV — Admin Portal Delete
//  File: functions/api/portal/delete.js
//  Route: POST /api/portal/delete
//  Requires the portal password via 'x-portal-password' header.
//  Body: { id }
// ============================================================

import { checkPortalPassword, deletePortal } from '../../_lib/portals.js';

export async function onRequest(context) {
  const { request, env } = context;
  const commonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'POST required' }), {
      status: 405, headers: commonHeaders,
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'D1 binding DB missing' }), {
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
    if (!body.id) {
      return new Response(JSON.stringify({ success: false, error: 'id is required' }), {
        status: 400, headers: commonHeaders,
      });
    }
    const ok = await deletePortal(env, body.id);
    if (!ok) {
      return new Response(JSON.stringify({ success: false, error: 'Portal not found' }), {
        status: 404, headers: commonHeaders,
      });
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: commonHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: commonHeaders,
    });
  }
}

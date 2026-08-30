// ============================================================
//  RKDYIPTV — One-time KV → D1 Migration
//  File: functions/api/admin/migrate-to-d1.js
//  Route: POST /api/admin/migrate-to-d1
//
//  Run this ONCE after deploying the D1 binding + schema.sql.
//  Copies existing `token:*` and `portals:list` KV data into D1
//  so live tokens/portals keep working after the code switch.
//  Safe to re-run (uses INSERT ... ON CONFLICT).
// ============================================================
import { putToken } from '../../_lib/tokens.js';

function checkAdminSession(request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/rkdy_admin=([^;]+)/);
  return match && match[1].length > 20;
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

  if (!env.TOKENS || !env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Both TOKENS (KV) and DB (D1) bindings are required for migration' }), {
      status: 500, headers: commonHeaders,
    });
  }

  const result = { tokensMigrated: 0, tokensSkipped: 0, portalsMigrated: 0, errors: [] };

  try {
    // ── Migrate tokens ──
    const list = await env.TOKENS.list({ prefix: 'token:', limit: 1000 });
    for (const key of list.keys) {
      try {
        const data = await env.TOKENS.get(key.name, { type: 'json' });
        if (!data || !data.token) { result.tokensSkipped++; continue; }

        // Old public-gate tokens used `device` (singular) instead of `devices` array
        if (!Array.isArray(data.devices)) {
          data.devices = data.device ? [data.device] : [];
        }
        if (data.deviceLimit === undefined || data.deviceLimit === null) {
          data.deviceLimit = 1;
        }

        await putToken(env, data);
        result.tokensMigrated++;
      } catch (e) {
        result.errors.push(`token ${key.name}: ${e.message}`);
      }
    }

    // ── Migrate portals ──
    const rawPortals = await env.TOKENS.get('portals:list');
    if (rawPortals) {
      const portals = JSON.parse(rawPortals);
      const now = Date.now();
      for (const p of portals) {
        try {
          await env.DB.prepare(
            `INSERT INTO portals (id, name, url, mac, serial, device_id1, device_id2, is_default, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               name=excluded.name, url=excluded.url, mac=excluded.mac, serial=excluded.serial,
               device_id1=excluded.device_id1, device_id2=excluded.device_id2,
               is_default=excluded.is_default, updated_at=excluded.updated_at`
          ).bind(
            p.id, p.name, p.url, p.mac, p.serial, p.deviceId1, p.deviceId2,
            p.isDefault ? 1 : 0, p.createdAt || now, p.updatedAt || now
          ).run();
          result.portalsMigrated++;
        } catch (e) {
          result.errors.push(`portal ${p.id}: ${e.message}`);
        }
      }
    }

    console.log(`[MIGRATE] tokens=${result.tokensMigrated} portals=${result.portalsMigrated} errors=${result.errors.length}`);

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200, headers: commonHeaders,
    });

  } catch (err) {
    console.error('[MIGRATE ERROR]', err.message);
    return new Response(JSON.stringify({ success: false, error: err.message, ...result }), {
      status: 500, headers: commonHeaders,
    });
  }
}

// ============================================================
//  RKDYIPTV — Shared Token Storage Helpers (D1-backed)
//  File: functions/_lib/tokens.js
//  Replaces the old KV `token:*` reads/writes. Free D1 tier =
//  100k writes/day + 5M reads/day, vs KV's 1k writes/day.
// ============================================================

function rowToToken(row) {
  if (!row) return null;
  return {
    token: row.token,
    durationHours: row.duration_hours,
    durationLabel: row.duration_label,
    createdAt: row.created_at,
    expiryAt: row.expiry_at,
    deviceLimit: row.device_limit === 'unlimited' ? 'unlimited' : parseInt(row.device_limit, 10),
    devices: JSON.parse(row.devices || '[]'),
    lockedAt: row.locked_at,
    lockedUA: row.locked_ua,
    firstUseIP: row.first_use_ip,
    fetchCount: row.fetch_count || 0,
    lastUsed: row.last_used,
    source: row.source,
    portalId: row.portal_id,
    portalName: row.portal_name,
  };
}

export async function getToken(env, tokenId) {
  const row = await env.DB.prepare('SELECT * FROM tokens WHERE token = ?').bind(tokenId).first();
  return rowToToken(row);
}

// Insert-or-update. `data` is the same shape as the old KV tokenData object.
export async function putToken(env, data) {
  await env.DB.prepare(
    `INSERT INTO tokens (
       token, duration_hours, duration_label, created_at, expiry_at,
       device_limit, devices, locked_at, locked_ua, first_use_ip,
       fetch_count, last_used, source, portal_id, portal_name
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET
       device_limit=excluded.device_limit, devices=excluded.devices,
       locked_at=excluded.locked_at, locked_ua=excluded.locked_ua,
       first_use_ip=excluded.first_use_ip, fetch_count=excluded.fetch_count,
       last_used=excluded.last_used`
  ).bind(
    data.token, data.durationHours, data.durationLabel, data.createdAt, data.expiryAt,
    String(data.deviceLimit), JSON.stringify(data.devices || []),
    data.lockedAt, data.lockedUA, data.firstUseIP,
    data.fetchCount || 0, data.lastUsed, data.source || null,
    data.portalId, data.portalName
  ).run();
}

export async function deleteToken(env, tokenId) {
  await env.DB.prepare('DELETE FROM tokens WHERE token = ?').bind(tokenId).run();
}

// All tokens, newest first. (KV version had to do N individual GETs after
// a list() call — this is a single query.)
export async function listTokens(env) {
  const { results } = await env.DB
    .prepare('SELECT * FROM tokens ORDER BY created_at DESC LIMIT 1000')
    .all();
  return (results || []).map(rowToToken);
}

// D1 has no native TTL like KV did — call this occasionally (e.g. from a
// cron trigger, or opportunistically) to drop rows past their expiry.
export async function cleanupExpiredTokens(env) {
  await env.DB.prepare('DELETE FROM tokens WHERE expiry_at < ?').bind(Date.now()).run();
}

// ============================================================
//  RKDYIPTV — Shared Portal Storage Helpers (D1-backed)
//  File: functions/_lib/portals.js
//  Not a route itself (folder starts with "_") — imported by the
//  portal API endpoints and by dashboard.js.
// ============================================================

// 🔑 Password comes from the Cloudflare Pages environment variable
// PORTAL_PASSWORD — set it in: Pages dashboard → your project → Settings
// → Environment variables → add "PORTAL_PASSWORD" (for Production, and
// Preview if you use it too). No code file needs to be touched or
// redeployed to change it later.

export function checkPortalPassword(provided, env) {
  const expected = env && env.PORTAL_PASSWORD;
  if (!expected) return false; // fail closed if the env var isn't set yet
  return typeof provided === 'string' && provided.length > 0 && provided === expected;
}

function generatePortalId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function rowToPortal(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    mac: row.mac,
    serial: row.serial,
    deviceId1: row.device_id1,
    deviceId2: row.device_id2,
    isDefault: !!row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Returns the full array of portal objects (all fields, including
// mac/serial/device ids). Only ever called from password-gated or
// already-authenticated (admin cookie) code paths.
export async function getPortals(env) {
  const { results } = await env.DB
    .prepare('SELECT * FROM portals ORDER BY created_at ASC')
    .all();
  return (results || []).map(rowToPortal);
}

// Kept for backward-compat with any code that still imports savePortals
// directly — writes the whole array back (used only by rare bulk paths).
export async function savePortals(env, portals) {
  const stmts = portals.map(p =>
    env.DB.prepare(
      `INSERT INTO portals (id, name, url, mac, serial, device_id1, device_id2, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, url=excluded.url, mac=excluded.mac, serial=excluded.serial,
         device_id1=excluded.device_id1, device_id2=excluded.device_id2,
         is_default=excluded.is_default, updated_at=excluded.updated_at`
    ).bind(
      p.id, p.name, p.url, p.mac, p.serial, p.deviceId1, p.deviceId2,
      p.isDefault ? 1 : 0, p.createdAt || Date.now(), p.updatedAt || Date.now()
    )
  );
  if (stmts.length) await env.DB.batch(stmts);
}

// Safe subset for public / unauthenticated display — no mac/serial/device ids.
export function toPublicPortal(p) {
  return { id: p.id, name: p.name, isDefault: !!p.isDefault };
}

// Create or update a portal. If input.id matches an existing portal, it's
// updated in place; otherwise a new portal is created. If isDefault is set
// true, every other portal's isDefault is cleared so only one is default.
export async function upsertPortal(env, input) {
  const now = Date.now();

  const clean = {
    name: (input.name || '').trim(),
    url: (input.url || '').trim(),
    mac: (input.mac || '').trim(),
    serial: (input.serial || '').trim(),
    deviceId1: (input.deviceId1 || '').trim(),
    deviceId2: (input.deviceId2 || '').trim(),
    isDefault: !!input.isDefault,
  };

  if (!clean.name || !clean.url) {
    throw new Error('Portal name and URL are required');
  }

  const existing = input.id
    ? await env.DB.prepare('SELECT * FROM portals WHERE id = ?').bind(input.id).first()
    : null;

  const { results: countRows } = await env.DB.prepare('SELECT COUNT(*) as c FROM portals').all();
  const isFirstEver = !existing && (countRows[0]?.c || 0) === 0;

  const id = existing ? existing.id : generatePortalId();
  const createdAt = existing ? existing.created_at : now;
  const makeDefault = clean.isDefault || isFirstEver;

  if (makeDefault) {
    await env.DB.prepare('UPDATE portals SET is_default = 0').run();
  }

  await env.DB.prepare(
    `INSERT INTO portals (id, name, url, mac, serial, device_id1, device_id2, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, url=excluded.url, mac=excluded.mac, serial=excluded.serial,
       device_id1=excluded.device_id1, device_id2=excluded.device_id2,
       is_default=excluded.is_default, updated_at=excluded.updated_at`
  ).bind(
    id, clean.name, clean.url, clean.mac, clean.serial, clean.deviceId1, clean.deviceId2,
    makeDefault ? 1 : 0, createdAt, now
  ).run();

  const saved = await env.DB.prepare('SELECT * FROM portals WHERE id = ?').bind(id).first();
  return rowToPortal(saved);
}

export async function deletePortal(env, id) {
  const existing = await env.DB.prepare('SELECT * FROM portals WHERE id = ?').bind(id).first();
  if (!existing) return false;

  await env.DB.prepare('DELETE FROM portals WHERE id = ?').bind(id).run();

  // If we just deleted the default portal, promote the next one so
  // generate.js still has a default to pre-select.
  if (existing.is_default) {
    const next = await env.DB.prepare('SELECT id FROM portals ORDER BY created_at ASC LIMIT 1').first();
    if (next) {
      await env.DB.prepare('UPDATE portals SET is_default = 1 WHERE id = ?').bind(next.id).run();
    }
  }
  return true;
}

// ============================================================
//  Shared portal-config resolution — used by playlist.m3u.js and
//  movie.js so both resolve the "which portal does this token use"
//  question the exact same way, from the exact same data.
// ============================================================

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

// Converts a stored portal object (name/url/mac/serial/deviceId1/deviceId2)
// into the shape the Stalker-portal request functions expect
// (portalUrl/mac/serialNo/deviceId/deviceId2/timezone).
export function toPortalConfig(portal) {
  return {
    portalUrl: portal.url,
    mac: portal.mac,
    serialNo: portal.serial,
    deviceId: portal.deviceId1,
    deviceId2: portal.deviceId2,
    timezone: DEFAULT_TIMEZONE,
  };
}

// Picks the portal a token/stream should use: the one it was created
// with, falling back to whichever portal is marked default, falling
// back to the first portal that exists. Returns null if no portals
// have been added in Portal Manager yet.
export async function resolvePortal(env, portalId) {
  let match = null;
  if (portalId) {
    match = await env.DB.prepare('SELECT * FROM portals WHERE id = ?').bind(portalId).first();
  }
  if (!match) {
    match = await env.DB.prepare('SELECT * FROM portals WHERE is_default = 1 LIMIT 1').first();
  }
  if (!match) {
    match = await env.DB.prepare('SELECT * FROM portals ORDER BY created_at ASC LIMIT 1').first();
  }
  if (!match) return null;
  const portal = rowToPortal(match);
  return { id: portal.id, name: portal.name, config: toPortalConfig(portal) };
}

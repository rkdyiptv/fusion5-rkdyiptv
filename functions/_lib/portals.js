// ============================================================
//  RKDYIPTV — Shared Portal Storage Helpers
//  File: functions/_lib/portals.js
//  Not a route itself (folder starts with "_") — imported by the
//  portal API endpoints and by dashboard.js.
// ============================================================

// 🔑 Password comes from the Cloudflare Pages environment variable
// PORTAL_PASSWORD — set it in: Pages dashboard → your project → Settings
// → Environment variables → add "PORTAL_PASSWORD" (for Production, and
// Preview if you use it too). No code file needs to be touched or
// redeployed to change it later.
const PORTALS_KEY = 'portals:list';

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

// Returns the full array of portal objects (all fields, including
// mac/serial/device ids). Only ever called from password-gated or
// already-authenticated (admin cookie) code paths.
export async function getPortals(env) {
  const raw = await env.TOKENS.get(PORTALS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export async function savePortals(env, portals) {
  await env.TOKENS.put(PORTALS_KEY, JSON.stringify(portals));
}

// Safe subset for public / unauthenticated display — no mac/serial/device ids.
export function toPublicPortal(p) {
  return { id: p.id, name: p.name, isDefault: !!p.isDefault };
}

// Create or update a portal. If input.id matches an existing portal, it's
// updated in place; otherwise a new portal is created. If isDefault is set
// true, every other portal's isDefault is cleared so only one is default.
export async function upsertPortal(env, input) {
  const portals = await getPortals(env);
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

  let saved;
  const existingIndex = input.id ? portals.findIndex(p => p.id === input.id) : -1;

  if (existingIndex >= 0) {
    saved = { ...portals[existingIndex], ...clean, updatedAt: now };
    portals[existingIndex] = saved;
  } else {
    saved = { id: generatePortalId(), ...clean, createdAt: now, updatedAt: now };
    portals.push(saved);
  }

  // If this portal is now default, unset default on all the others.
  // If it's the very first portal ever added, make it default automatically
  // so generate.js always has something pre-selected.
  if (clean.isDefault || portals.length === 1) {
    saved.isDefault = true;
    for (const p of portals) {
      if (p.id !== saved.id) p.isDefault = false;
    }
  }

  await savePortals(env, portals);
  return saved;
}

export async function deletePortal(env, id) {
  const portals = await getPortals(env);
  const index = portals.findIndex(p => p.id === id);
  if (index === -1) return false;

  const wasDefault = portals[index].isDefault;
  portals.splice(index, 1);

  // If we just deleted the default portal, promote the next one so
  // generate.js still has a default to pre-select.
  if (wasDefault && portals.length > 0) {
    portals[0].isDefault = true;
  }

  await savePortals(env, portals);
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
  const portals = await getPortals(env);
  if (portals.length === 0) return null;
  const match =
    (portalId && portals.find(p => p.id === portalId)) ||
    portals.find(p => p.isDefault) ||
    portals[0];
  if (!match) return null;
  return { id: match.id, name: match.name, config: toPortalConfig(match) };
}

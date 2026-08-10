// ============================================================
//  RKDYIPTV — Admin Login API
//  File: functions/api/admin/login.js
//  Route: POST /api/admin/login
// ============================================================

async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'POST required' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  const ADMIN_USER = env.ADMIN_USERNAME;
  const ADMIN_PASS = env.ADMIN_PASSWORD;
  const SECRET_KEY = env.SECURITY_KEY || 'rkdyiptv@2024#secret';

  if (!ADMIN_USER || !ADMIN_PASS) {
    return new Response(JSON.stringify({ success: false, error: 'Admin credentials not set in env vars' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { username, password } = body;

    if (username !== ADMIN_USER || password !== ADMIN_PASS) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate session token
    const sessionToken = await hmacSha256(SECRET_KEY, `admin_${Date.now()}_${Math.random()}`);
    
    // Set cookie (24 hours)
    const cookieValue = `rkdy_admin=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieValue,
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

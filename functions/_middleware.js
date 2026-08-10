// ============================================================
//  RKDYIPTV — Global Middleware
//  File: functions/_middleware.js
//  Runs on EVERY request before route handlers
// ============================================================

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname.toLowerCase();

  // ── Block common exploit paths ──
  const blockedPaths = [
    '/wp-admin', '/wp-login', '/wp-content', '/wp-includes',
    '/.env', '/.git', '/.htaccess', '/config.php',
    '/phpmyadmin', '/administrator',
    '/xmlrpc.php', '/wp-config.php', '/.aws',
    '/backup', '/dump.sql', '/database.sql',
    '/vendor/', '/composer.json', '/node_modules/',
  ];
  if (blockedPaths.some(p => path.includes(p))) {
    return new Response('Not Found', { status: 404 });
  }

  // ── Block malicious bots ──
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  const badBots = [
    'nikto', 'sqlmap', 'nmap', 'masscan', 'zgrab',
    'nuclei', 'acunetix', 'nessus', 'openvas',
    'metasploit', 'burpsuite', 'havij', 'w3af',
  ];
  if (badBots.some(b => ua.includes(b))) {
    return new Response('Forbidden', { status: 403 });
  }

  // ── Pass to route handler ──
  const response = await next();

  // ── Add security headers ──
  const newHeaders = new Headers(response.headers);
  newHeaders.set('X-Content-Type-Options', 'nosniff');
  newHeaders.set('X-Frame-Options', 'DENY');
  newHeaders.set('Referrer-Policy', 'no-referrer-when-downgrade');
  newHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  newHeaders.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  newHeaders.set('X-Powered-By', 'RKDYIPTV');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

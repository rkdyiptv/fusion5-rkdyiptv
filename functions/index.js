// ============================================================
//  RKDYIPTV — Root Landing Page
//  File: functions/index.js
//  Route: /
// ============================================================

const TELEGRAM_URL = 'https://t.me/rkdyiptv';
const LOGO_URL = 'https://i.ibb.co/VWVcf4t5/RKDYIPTV.jpg';

export async function onRequest(context) {
  const { request } = context;

  const commonHeaders = {
    'Access-Control-Allow-Origin': '*',
    'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: commonHeaders });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>RKDYIPTV — Premium IPTV Service</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: linear-gradient(135deg, #0b0b12 0%, #1a0b2e 100%);
    color: #eee;
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 40px 30px;
    max-width: 480px;
    width: 100%;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
  }
  .logo {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    margin: 0 auto 20px;
    display: block;
    border: 3px solid #4ea1ff;
    box-shadow: 0 0 30px rgba(78, 161, 255, 0.4);
  }
  h1 {
    font-size: 28px;
    background: linear-gradient(90deg, #4ea1ff, #b16cff);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    margin-bottom: 8px;
    letter-spacing: 1px;
  }
  .tag {
    color: #aaa;
    font-size: 14px;
    margin-bottom: 24px;
  }
  .info {
    background: rgba(78, 161, 255, 0.08);
    border-left: 3px solid #4ea1ff;
    padding: 14px 16px;
    border-radius: 8px;
    text-align: left;
    margin-bottom: 24px;
    font-size: 14px;
    line-height: 1.6;
    color: #ccc;
  }
  .btn {
    display: inline-block;
    background: linear-gradient(90deg, #229ED9, #4ea1ff);
    color: #fff;
    padding: 14px 32px;
    border-radius: 30px;
    text-decoration: none;
    font-weight: bold;
    font-size: 16px;
    transition: transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 4px 20px rgba(78, 161, 255, 0.3);
    margin: 4px;
  }
  .btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(78, 161, 255, 0.5);
  }
  .btn.secondary {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.15);
    color: #ccc;
  }
  .footer {
    margin-top: 24px;
    font-size: 12px;
    color: #666;
  }
  .badge {
    display: inline-block;
    background: rgba(46, 213, 115, 0.15);
    color: #2ed573;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    margin-top: 8px;
  }
</style>
</head>
<body>
  <div class="card">
    <img class="logo" src="${LOGO_URL}" alt="RKDYIPTV">
    <h1>RKDYIPTV</h1>
    <p class="tag">Premium IPTV Streaming Service</p>
    <div class="badge">● Service Online</div>

    <div class="info" style="margin-top: 20px;">
      This service is designed to work exclusively inside supported
      IPTV applications like <b>TiviMate</b>, <b>IPTV Smarters</b>,
      <b>VLC</b>, <b>Perfect Player</b>, and other players.
      <br><br>
      Direct browser access is not supported.
    </div>

    <a class="btn" href="${TELEGRAM_URL}">Join Telegram Channel</a>

    <div class="footer">
      © ${new Date().getFullYear()} RKDYIPTV — All rights reserved
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { ...commonHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

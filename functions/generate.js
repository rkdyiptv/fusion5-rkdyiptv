// ============================================================
//  RKDYIPTV — Public Playlist Generator (Watch 5 Ads → 24h Playlist)
//  File: functions/generate.js
//  Route: /generate
// ============================================================

export async function onRequest(context) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>RKDYIPTV — Get Playlist</title>
<script src='//libtl.com/sdk.js' data-zone='11341413' data-sdk='show_11341413'></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: linear-gradient(135deg, #0b0b12 0%, #1a0b2e 100%);
    color: #eee;
    font-family: 'Segoe UI', Arial, sans-serif;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 36px 26px;
    max-width: 420px;
    width: 100%;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }
  h1 {
    font-size: 22px;
    background: linear-gradient(90deg, #4ea1ff, #b16cff);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    margin-bottom: 6px;
  }
  .sub { color: #999; font-size: 13px; margin-bottom: 24px; }
  .dots { display: flex; justify-content: center; gap: 10px; margin-bottom: 22px; }
  .dot {
    width: 14px; height: 14px; border-radius: 50%;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    transition: all .25s;
  }
  .dot.filled { background: linear-gradient(90deg, #4ea1ff, #b16cff); border-color: transparent; }
  .btn {
    width: 100%;
    padding: 14px;
    background: linear-gradient(90deg, #229ED9, #4ea1ff);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    font-size: 15px;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn.generate { background: linear-gradient(90deg, #22c55e, #16a34a); }
  .msg { font-size: 13px; margin-top: 14px; min-height: 18px; }
  .msg.error { color: #ff5555; }
  .msg.info { color: #4ea1ff; }
  #generate-section { display: none; }
  #result-section { display: none; margin-top: 10px; }
  .url-box {
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 12px;
    font-size: 12px;
    word-break: break-all;
    color: #4ea1ff;
    margin-bottom: 12px;
    text-align: left;
  }
  .expiry { font-size: 12px; color: #aaa; margin-bottom: 14px; }
  .logo-emoji { font-size: 36px; margin-bottom: 8px; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo-emoji">🎬</div>
    <h1>RKDYIPTV Playlist</h1>
    <div class="sub">5 ads dekho, 24h ka playlist link paao</div>

    <div id="ad-section">
      <div class="dots" id="dots"></div>
      <button class="btn" id="watch-btn" onclick="watchAd()">Loading...</button>
      <div class="msg" id="ad-msg"></div>
    </div>

    <div id="generate-section">
      <button class="btn generate" id="gen-btn" onclick="generatePlaylist()">🎉 Generate Playlist</button>
      <div class="msg" id="gen-msg"></div>
    </div>

    <div id="result-section">
      <div class="url-box" id="result-url"></div>
      <div class="expiry" id="result-expiry"></div>
      <button class="btn" onclick="copyUrl()">📋 Copy Link</button>
    </div>
  </div>

<script>
const REQUIRED_ADS = 5;
let sessionId = null;
let watchedCount = 0;
let generatedUrl = '';

function renderDots() {
  const dotsEl = document.getElementById('dots');
  dotsEl.innerHTML = '';
  for (let i = 0; i < REQUIRED_ADS; i++) {
    const d = document.createElement('div');
    d.className = 'dot' + (i < watchedCount ? ' filled' : '');
    dotsEl.appendChild(d);
  }
}

async function initSession() {
  const btn = document.getElementById('watch-btn');
  try {
    const res = await fetch('/api/public/ad-progress');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Session start fail');
    sessionId = data.sessionId;
    renderDots();
    btn.disabled = false;
    btn.textContent = 'Watch Ad (0/' + REQUIRED_ADS + ')';
  } catch (err) {
    showAdMsg('Session shuru nahi hua. Page reload karo.', true);
  }
}

function showAdMsg(text, isError) {
  const el = document.getElementById('ad-msg');
  el.textContent = text;
  el.className = 'msg ' + (isError ? 'error' : 'info');
}

async function watchAd() {
  const btn = document.getElementById('watch-btn');
  btn.disabled = true;
  btn.textContent = 'Ad load ho raha hai...';
  showAdMsg('', false);

  try {
    await show_11341413();

    const res = await fetch('/api/public/ad-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Progress update fail');

    watchedCount = data.count;
    renderDots();

    if (watchedCount >= REQUIRED_ADS) {
      document.getElementById('ad-section').style.display = 'none';
      document.getElementById('generate-section').style.display = 'block';
    } else {
      btn.disabled = false;
      btn.textContent = 'Watch Ad (' + watchedCount + '/' + REQUIRED_ADS + ')';
      showAdMsg('✅ Ad complete! Next ad dekho.', false);
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Watch Ad (' + watchedCount + '/' + REQUIRED_ADS + ') — Retry';
    showAdMsg('❌ Ad complete nahi hui ya skip ho gayi. Dubara try karo.', true);
  }
}

async function generatePlaylist() {
  const btn = document.getElementById('gen-btn');
  const msgEl = document.getElementById('gen-msg');
  btn.disabled = true;
  btn.textContent = 'Generating...';
  msgEl.textContent = '';

  try {
    const res = await fetch('/api/public/create-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Generate fail');

    generatedUrl = data.playlistUrl;
    document.getElementById('result-url').textContent = generatedUrl;
    const expiryDate = new Date(data.expiryAt);
    document.getElementById('result-expiry').textContent = '⏰ Valid for 24h — expires: ' + expiryDate.toLocaleString();

    document.getElementById('generate-section').style.display = 'none';
    document.getElementById('result-section').style.display = 'block';
  } catch (err) {
    msgEl.className = 'msg error';
    msgEl.textContent = '❌ ' + err.message;
    btn.disabled = false;
    btn.textContent = '🎉 Generate Playlist';
  }
}

function copyUrl() {
  navigator.clipboard.writeText(generatedUrl).then(() => {
    showAdMsg('', false);
    const el = document.getElementById('result-expiry');
    const original = el.textContent;
    el.textContent = '✅ Copied!';
    setTimeout(() => { el.textContent = original; }, 1500);
  });
}

initSession();
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

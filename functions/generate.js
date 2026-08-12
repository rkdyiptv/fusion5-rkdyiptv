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
  html, body {
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
  }
  body {
    background:
      radial-gradient(circle at 15% 20%, rgba(0,230,195,0.12), transparent 40%),
      radial-gradient(circle at 85% 80%, rgba(255,0,153,0.14), transparent 45%),
      #05060a;
    color: #e8e8f0;
    font-family: 'Segoe UI', Arial, sans-serif;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(0,230,195,0.25);
    border-radius: 18px;
    padding: 34px 26px;
    max-width: 420px;
    width: 100%;
    text-align: center;
    box-shadow: 0 0 0 1px rgba(255,0,153,0.05), 0 25px 60px rgba(0,0,0,0.6);
    position: relative;
    overflow: hidden;
  }
  .card::before {
    content: '';
    position: absolute;
    top: -60%; left: -20%;
    width: 140%; height: 140%;
    background: conic-gradient(from 0deg, transparent, rgba(0,230,195,0.08), transparent 30%);
    animation: spin 10s linear infinite;
    pointer-events: none;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .card > * { position: relative; z-index: 1; }
  .logo-emoji { font-size: 34px; margin-bottom: 6px; }
  h1 {
    font-size: 21px;
    letter-spacing: 0.5px;
    background: linear-gradient(90deg, #00e6c3, #ff0099);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    margin-bottom: 6px;
  }
  .sub { color: #9a9ab0; font-size: 13px; margin-bottom: 22px; }
  .dots { display: flex; justify-content: center; gap: 10px; margin-bottom: 20px; }
  .dot {
    width: 13px; height: 13px; border-radius: 50%;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    transition: all .25s;
  }
  .dot.filled { background: linear-gradient(90deg, #00e6c3, #ff0099); border-color: transparent; box-shadow: 0 0 10px rgba(0,230,195,0.6); }
  .btn {
    width: 100%;
    padding: 14px;
    background: linear-gradient(90deg, #00b8d4, #00e6c3);
    color: #04231f;
    border: none;
    border-radius: 10px;
    font-weight: 700;
    cursor: pointer;
    font-size: 15px;
    letter-spacing: 0.2px;
  }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn.generate { background: linear-gradient(90deg, #ff0099, #ff5f8a); color: #2a0016; }
  .btn.copy { background: linear-gradient(90deg, #7c4dff, #00e6c3); color: #12002b; }
  .btn.telegram {
    background: transparent;
    color: #00e6c3;
    border: 1px solid rgba(0,230,195,0.4);
    margin-top: 16px;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .btn.telegram:hover { background: rgba(0,230,195,0.08); }
  .msg { font-size: 13px; margin-top: 14px; min-height: 18px; }
  .msg.error { color: #ff5c7a; }
  .msg.info { color: #00e6c3; }
  #generate-section { display: none; }
  #result-section { display: none; margin-top: 10px; }
  .url-box {
    background: rgba(0,0,0,0.45);
    border: 1px solid rgba(0,230,195,0.2);
    border-radius: 10px;
    padding: 12px;
    font-size: 12px;
    word-break: break-all;
    color: #00e6c3;
    margin-bottom: 12px;
    text-align: left;
  }
  .expiry { font-size: 12px; color: #aeaec2; margin-bottom: 14px; }
  .cooldown-box {
    display: none;
    background: rgba(255,0,153,0.06);
    border: 1px solid rgba(255,0,153,0.25);
    border-radius: 10px;
    padding: 14px;
    font-size: 13px;
    color: #ff9fc4;
  }
  .stats-row {
    display: flex;
    justify-content: center;
    gap: 18px;
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,0.08);
    font-size: 12px;
    color: #9a9ab0;
  }
  .stats-row b { color: #00e6c3; font-size: 14px; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo-emoji">🎬</div>
    <h1>RKDYIPTV Playlist</h1>
    <div class="sub">Watch 5 ads → unlock a 24h playlist link</div>

    <div id="cooldown-section" class="cooldown-box"></div>

    <div id="portal-section" style="display:none; margin-bottom:18px; text-align:left;">
      <label for="portal-select" style="display:block; font-size:12px; color:#9a9ab0; margin-bottom:6px;">Select Portal</label>
      <select id="portal-select" style="width:100%; padding:11px; background:rgba(0,0,0,0.4); border:1px solid rgba(0,230,195,0.25); border-radius:8px; color:#e8e8f0; font-size:13px;"></select>
    </div>

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
      <button class="btn copy" id="copy-btn" onclick="copyUrl()" disabled>📋 Copy Link</button>
    </div>

    <a class="btn telegram" href="https://t.me/rkdyiptv" target="_blank" rel="noopener noreferrer">📣 Join Telegram</a>

    <div class="stats-row" id="stats-row">
      <div>Today: <b id="stat-today">—</b></div>
      <div>Total: <b id="stat-total">—</b></div>
    </div>
  </div>

<script>
const REQUIRED_ADS = 5;
let sessionId = null;
let watchedCount = 0;
let generatedUrl = '';
let selectedPortalId = null;

async function loadPortals() {
  try {
    const res = await fetch('/api/portal/public-list');
    const data = await res.json();
    if (!data.success || !data.portals || data.portals.length === 0) return;

    const section = document.getElementById('portal-section');
    const select = document.getElementById('portal-select');
    select.innerHTML = '';

    data.portals.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });

    // The portal currently marked default in Portal Manager is pre-selected
    const def = data.portals.find(p => p.isDefault) || data.portals[0];
    select.value = def.id;
    selectedPortalId = def.id;

    select.addEventListener('change', () => { selectedPortalId = select.value; });
    section.style.display = 'block';
  } catch (_) {
    // No portals configured yet, or endpoint unavailable — generation still
    // works without one, so fail silently here.
  }
}

// ---- Basic anti view-source / anti-save deterrents ----
// Note: these only discourage casual copying; they cannot fully block
// browser dev tools or view-source, since that is enforced client-side.
document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
document.addEventListener('keydown', function (e) {
  const key = (e.key || '').toLowerCase();
  const blockCombo =
    key === 'f12' ||
    (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(key)) ||
    (e.ctrlKey && ['u', 's'].includes(key));
  if (blockCombo) e.preventDefault();
});

async function loadStats() {
  try {
    const res = await fetch('/api/public/stats');
    const data = await res.json();
    if (data.success) {
      document.getElementById('stat-today').textContent = data.today;
      document.getElementById('stat-total').textContent = data.total;
    }
  } catch (_) { /* stats are informational only, fail silently */ }
}

function renderDots() {
  const dotsEl = document.getElementById('dots');
  dotsEl.innerHTML = '';
  for (let i = 0; i < REQUIRED_ADS; i++) {
    const d = document.createElement('div');
    d.className = 'dot' + (i < watchedCount ? ' filled' : '');
    dotsEl.appendChild(d);
  }
}

function showCooldown(remainingMs) {
  document.getElementById('ad-section').style.display = 'none';
  document.getElementById('generate-section').style.display = 'none';
  const box = document.getElementById('cooldown-section');
  box.style.display = 'block';

  function tick() {
    const mins = Math.max(0, Math.ceil(remainingMs / 60000));
    box.textContent = '⏳ You already generated a playlist recently. Please wait ~' + mins + ' more minute(s) before generating a new one.';
    remainingMs -= 1000;
    if (remainingMs <= 0) {
      window.location.reload();
      return;
    }
    setTimeout(tick, 1000);
  }
  tick();
}

async function initSession() {
  const btn = document.getElementById('watch-btn');
  try {
    const res = await fetch('/api/public/ad-progress');
    const data = await res.json();

    if (!data.success && data.cooldown && typeof data.remainingMs === 'number') {
      showCooldown(data.remainingMs);
      return;
    }
    if (!data.success) throw new Error(data.error || 'Could not start session');

    sessionId = data.sessionId;
    renderDots();
    btn.disabled = false;
    btn.textContent = 'Watch Ad (0/' + REQUIRED_ADS + ')';
  } catch (err) {
    showAdMsg('Could not start session. Please reload the page.', true);
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
  btn.textContent = 'Loading ad...';
  showAdMsg('', false);

  try {
    await show_11341413();

    const res = await fetch('/api/public/ad-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Could not update progress');

    watchedCount = data.count;
    renderDots();

    if (watchedCount >= REQUIRED_ADS) {
      document.getElementById('ad-section').style.display = 'none';
      document.getElementById('generate-section').style.display = 'block';
    } else {
      btn.disabled = false;
      btn.textContent = 'Watch Ad (' + watchedCount + '/' + REQUIRED_ADS + ')';
      showAdMsg('✅ Ad complete! Watch the next one.', false);
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Watch Ad (' + watchedCount + '/' + REQUIRED_ADS + ') — Retry';
    showAdMsg('❌ Ad was not completed or was skipped. Please try again.', true);
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
      body: JSON.stringify({ sessionId, portalId: selectedPortalId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Could not generate playlist');

    generatedUrl = data.playlistUrl;
    document.getElementById('result-url').textContent = generatedUrl;
    const expiryDate = new Date(data.expiryAt);
    document.getElementById('result-expiry').textContent = '⏰ Valid for 24h — expires: ' + expiryDate.toLocaleString();

    document.getElementById('generate-section').style.display = 'none';
    document.getElementById('result-section').style.display = 'block';

    // Copy button only becomes usable once the playlist actually exists
    const copyBtn = document.getElementById('copy-btn');
    copyBtn.disabled = false;

    // Instant counter update — no need to wait for a fresh /stats fetch
    if (typeof data.totalGenerated === 'number') {
      document.getElementById('stat-total').textContent = data.totalGenerated;
    }
    if (typeof data.todayGenerated === 'number') {
      document.getElementById('stat-today').textContent = data.todayGenerated;
    }
  } catch (err) {
    msgEl.className = 'msg error';
    msgEl.textContent = '❌ ' + err.message;
    btn.disabled = false;
    btn.textContent = '🎉 Generate Playlist';
  }
}

function copyUrl() {
  if (!generatedUrl) return;
  navigator.clipboard.writeText(generatedUrl).then(() => {
    const el = document.getElementById('result-expiry');
    const original = el.textContent;
    el.textContent = '✅ Copied!';
    setTimeout(() => { el.textContent = original; }, 1500);
  });
}

initSession();
loadStats();
loadPortals();
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

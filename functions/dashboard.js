// ============================================================
//  RKDYIPTV — Admin Dashboard
//  File: functions/dashboard.js
//  Route: /dashboard
// ============================================================

import { getPortals } from './_lib/portals.js';

function checkAdminSession(request, env) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/rkdy_admin=([^;]+)/);
  if (!match) return false;
  return match[1].length > 20;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (!checkAdminSession(request, env)) {
    return Response.redirect(new URL('/admin', request.url).toString(), 302);
  }

  const portals = env.TOKENS ? await getPortals(env) : [];
  const portalsJson = JSON.stringify(portals).replace(/</g, '\\u003c');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>RKDYIPTV Admin — Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: linear-gradient(135deg, #0b0b12 0%, #1a0b2e 100%);
    color: #eee;
    font-family: 'Segoe UI', Arial, sans-serif;
    min-height: 100vh;
    padding: 20px;
  }
  .container { max-width: 1000px; margin: 0 auto; }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 15px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  h1 {
    font-size: 22px;
    background: linear-gradient(90deg, #4ea1ff, #b16cff);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .logout-btn {
    background: rgba(255,85,85,0.15);
    color: #ff5555;
    border: 1px solid rgba(255,85,85,0.3);
    padding: 8px 16px;
    border-radius: 20px;
    cursor: pointer;
    font-size: 13px;
  }
  .card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 15px;
    padding: 24px;
    margin-bottom: 20px;
  }
  .card h2 {
    font-size: 16px;
    color: #4ea1ff;
    margin-bottom: 15px;
  }
  .card h2 a {
    float: right;
    font-size: 12px;
    color: #b16cff;
    text-decoration: none;
    border: 1px solid rgba(177,108,255,0.35);
    padding: 4px 10px;
    border-radius: 14px;
  }
  .duration-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 8px;
    margin-bottom: 15px;
  }
  .dur-btn {
    padding: 10px;
    background: rgba(78,161,255,0.1);
    border: 1px solid rgba(78,161,255,0.3);
    color: #4ea1ff;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    text-align: center;
    transition: all 0.2s;
  }
  .dur-btn:hover { background: rgba(78,161,255,0.2); }
  .dur-btn.active { background: #4ea1ff; color: #fff; }
  .btn {
    background: linear-gradient(90deg, #229ED9, #4ea1ff);
    color: #fff;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    font-size: 14px;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .token-item {
    background: rgba(0,0,0,0.3);
    padding: 15px;
    border-radius: 10px;
    margin-bottom: 12px;
    border-left: 3px solid #4ea1ff;
  }
  .token-item.locked { border-left-color: #2ed573; }
  .token-item.expiring { border-left-color: #ffaa33; }
  .token-value {
    font-family: monospace;
    font-size: 11px;
    color: #4ea1ff;
    word-break: break-all;
    background: #000;
    padding: 8px;
    border-radius: 4px;
    margin: 8px 0;
  }
  .token-info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
    font-size: 12px;
    color: #aaa;
    margin: 8px 0;
  }
  .token-info b { color: #eee; }
  .token-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  .action-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 12px;
    font-weight: bold;
  }
  .copy-btn { background: #2ed573; color: #fff; }
  .delete-btn { background: #ff5555; color: #fff; }
  .status-badge {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: bold;
  }
  .unlocked { background: rgba(255,170,51,0.15); color: #ffaa33; }
  .locked { background: rgba(46,213,115,0.15); color: #2ed573; }
  .expired { background: rgba(255,85,85,0.15); color: #ff5555; }
  /* ✅ Portal badge in token */
  .portal-tag {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: bold;
    background: rgba(177,108,255,0.15);
    color: #b16cff;
    margin-left: 6px;
    border: 1px solid rgba(177,108,255,0.3);
  }
  #new-token-result {
    display: none;
    margin-top: 15px;
    padding: 15px;
    background: rgba(46,213,115,0.08);
    border: 1px solid rgba(46,213,115,0.3);
    border-radius: 8px;
  }
  #status-msg {
    margin-top: 10px;
    font-size: 13px;
    color: #aaa;
    min-height: 18px;
  }
  .empty { text-align: center; padding: 40px; color: #666; }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 10px;
    margin-bottom: 15px;
  }
  .stat-item {
    background: rgba(0,0,0,0.3);
    padding: 12px;
    border-radius: 8px;
    text-align: center;
  }
  .stat-num { font-size: 22px; font-weight: bold; color: #4ea1ff; }
  .stat-label { font-size: 11px; color: #999; margin-top: 4px; }
  .portal-item {
    background: rgba(0,0,0,0.3);
    padding: 12px 15px;
    border-radius: 10px;
    margin-bottom: 10px;
    border-left: 3px solid #b16cff;
  }
  .portal-item.is-default { border-left-color: #ffaa33; }
  .portal-name { font-weight: bold; font-size: 13px; }
  .portal-badge {
    display: inline-block;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(255,170,51,0.15);
    color: #ffaa33;
    margin-left: 8px;
  }
  .portal-info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 6px;
    font-size: 12px;
    color: #aaa;
    margin-top: 8px;
  }
  .portal-info b { color: #eee; }
  /* ✅ No portal warning */
  .no-portal-warn {
    background: rgba(255,85,85,0.1);
    border: 1px solid rgba(255,85,85,0.3);
    border-radius: 8px;
    padding: 12px;
    color: #ff8888;
    font-size: 13px;
    margin-bottom: 15px;
    display: none;
  }
  select {
    width: 100%;
    padding: 10px;
    margin-bottom: 16px;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    color: #eee;
    font-size: 13px;
  }
  select:focus { outline: none; border-color: #4ea1ff; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎛️ RKDYIPTV Admin Dashboard</h1>
      <button class="logout-btn" onclick="logout()">🚪 Logout</button>
    </div>

    <!-- Generate Token Section -->
    <div class="card">
      <h2>🎫 Generate New Token</h2>

      <!-- ✅ No portal warning -->
      <div class="no-portal-warn" id="no-portal-warn">
        ⚠️ No portal selected! Please <a href="/portal" style="color:#ff8888;">add a portal</a> first.
      </div>

      <label for="portal-select" style="display:block; font-size:12px; color:#999; margin-bottom:6px;">
        📡 Select Portal
      </label>
      <select id="portal-select" onchange="onPortalChange()">
        ${
          portals.length === 0
            ? '<option value="">⚠️ No portals added yet</option>'
            : portals.map(p =>
                `<option value="${p.id}" ${p.isDefault ? 'selected' : ''}>
                  ${p.name}${p.isDefault ? ' ⭐ (default)' : ''}
                </option>`
              ).join('')
        }
      </select>

      <label style="display:block; font-size:12px; color:#999; margin-bottom:8px;">
        ⏱️ Select Duration
      </label>
      <div class="duration-grid">
        <div class="dur-btn" data-hours="1">1h</div>
        <div class="dur-btn" data-hours="2">2h</div>
        <div class="dur-btn" data-hours="3">3h</div>
        <div class="dur-btn" data-hours="6">6h</div>
        <div class="dur-btn" data-hours="12">12h</div>
        <div class="dur-btn" data-hours="24">1d</div>
        <div class="dur-btn" data-hours="48">2d</div>
        <div class="dur-btn" data-hours="72">3d</div>
        <div class="dur-btn" data-hours="168">7d</div>
        <div class="dur-btn" data-hours="360">15d</div>
        <div class="dur-btn" data-hours="720">30d</div>
      </div>

      <button class="btn" id="gen-btn" onclick="generateToken()" disabled>
        Select Duration First
      </button>
      <div id="status-msg"></div>

      <div id="new-token-result">
        <div style="color:#2ed573;font-weight:bold;margin-bottom:8px;">✅ Token Created!</div>
        <div style="font-size:12px;color:#aaa;margin-bottom:4px;">
          📡 Portal: <b id="new-portal-name" style="color:#b16cff;"></b>
        </div>
        <div style="font-size:12px;color:#ccc;margin-bottom:6px;">Playlist URL:</div>
        <div class="token-value" id="new-url"></div>
        <button class="action-btn copy-btn" onclick="copyNewUrl()">📋 Copy URL</button>
      </div>
    </div>

    <!-- Portals Section -->
    <div class="card">
      <h2>📡 Portals <a href="/portal">Manage →</a></h2>
      <div id="portals-list">${
        portals.length === 0
          ? '<div class="empty">No portals added yet — click "Manage" to add one.</div>'
          : portals.map(p => `
            <div class="portal-item ${p.isDefault ? 'is-default' : ''}">
              <div class="portal-name">
                ${p.name}
                ${p.isDefault ? '<span class="portal-badge">⭐ DEFAULT</span>' : ''}
                <span style="font-size:10px;color:#555;margin-left:8px;font-family:monospace;">
                  id: ${p.id}
                </span>
              </div>
              <div class="portal-info">
                <div>🔗 <b>URL:</b> ${p.url}</div>
                <div>📟 <b>MAC:</b> ${p.mac || '—'}</div>
                <div>🔢 <b>Serial:</b> ${p.serial || '—'}</div>
                <div>🆔 <b>Device 1:</b> ${p.deviceId1 || '—'}</div>
                <div>🆔 <b>Device 2:</b> ${p.deviceId2 || '—'}</div>
              </div>
            </div>
          `).join('')
      }</div>
    </div>

    <!-- Active Tokens Section -->
    <div class="card">
      <h2>📋 Active Tokens</h2>
      <div class="stats" id="stats"></div>
      <div id="tokens-list">
        <div class="empty">Loading tokens...</div>
      </div>
    </div>
  </div>

<script>
let selectedHours = null;
let newTokenUrl = '';
const PORTALS = ${portalsJson};
const currentPlaylistBase = window.location.origin + '/api/rkdyiptv/playlist.m3u';

// ✅ Portal change handler — warn if empty
function onPortalChange() {
  const val = document.getElementById('portal-select').value;
  const warn = document.getElementById('no-portal-warn');
  warn.style.display = val ? 'none' : 'block';
}

// Run on load
onPortalChange();

// Duration button selection
document.querySelectorAll('.dur-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedHours = parseInt(btn.dataset.hours, 10);
    const genBtn = document.getElementById('gen-btn');
    const portalVal = document.getElementById('portal-select').value;
    if (!portalVal) {
      genBtn.disabled = true;
      genBtn.textContent = 'Select a Portal First';
      return;
    }
    genBtn.disabled = false;
    genBtn.textContent = 'Generate Token (' + btn.textContent + ')';
  });
});

async function generateToken() {
  if (!selectedHours) return;

  const portalId = document.getElementById('portal-select').value;

  // ✅ Guard — portal must be selected
  if (!portalId) {
    document.getElementById('status-msg').textContent = '❌ Please select a portal first!';
    return;
  }

  const selectedPortal = PORTALS.find(p => p.id === portalId);
  const portalName = selectedPortal ? selectedPortal.name : 'Unknown';

  const btn = document.getElementById('gen-btn');
  const status = document.getElementById('status-msg');
  btn.disabled = true;
  btn.textContent = 'Generating...';
  status.textContent = '⏳ Please wait...';

  try {
    // ✅ portalId correctly sent to backend
    const res = await fetch('/api/admin/create-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hours: selectedHours,
        portalId: portalId,
      }),
    });

    const data = await res.json();

    if (data.success) {
      // ✅ Verify backend returned same portal
      if (data.portalId !== portalId) {
        status.textContent = '⚠️ Warning: Portal mismatch! Expected ' + portalName + ' but got ' + data.portalName;
        btn.disabled = false;
        btn.textContent = 'Generate Token';
        return;
      }

      newTokenUrl = currentPlaylistBase + '?token=' + encodeURIComponent(data.token);
      document.getElementById('new-url').textContent = newTokenUrl;
      document.getElementById('new-portal-name').textContent = data.portalName || portalName;
      document.getElementById('new-token-result').style.display = 'block';
      status.textContent = '✅ Token created for portal: ' + (data.portalName || portalName);
      loadTokens();
    } else {
      status.textContent = '❌ ' + (data.error || 'Failed');
    }
  } catch (err) {
    status.textContent = '❌ ' + err.message;
  }

  btn.disabled = false;
  btn.textContent = 'Generate Token';
}

function copyNewUrl() {
  navigator.clipboard.writeText(newTokenUrl).then(() => {
    const btn = event.target;
    btn.textContent = '✅ Copied!';
    setTimeout(() => btn.textContent = '📋 Copy URL', 2000);
  });
}

async function loadTokens() {
  try {
    const res = await fetch('/api/admin/list-tokens');
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    renderTokens(data.tokens);
    renderStats(data.tokens);
  } catch (err) {
    document.getElementById('tokens-list').innerHTML =
      '<div class="empty">❌ Error: ' + err.message + '</div>';
  }
}

function renderStats(tokens) {
  const total = tokens.length;
  const locked = tokens.filter(t => t.device).length;
  const unlocked = total - locked;
  const now = Date.now();
  const expiringSoon = tokens.filter(t => (t.expiryAt - now) < 3600000).length;
  document.getElementById('stats').innerHTML =
    stat(total, 'Total Tokens') +
    stat(locked, '🔒 Locked') +
    stat(unlocked, '🔓 Unlocked') +
    stat(expiringSoon, '⏰ Expiring Soon');
}

function stat(num, label) {
  return '<div class="stat-item"><div class="stat-num">' + num +
    '</div><div class="stat-label">' + label + '</div></div>';
}

function renderTokens(tokens) {
  const container = document.getElementById('tokens-list');
  if (tokens.length === 0) {
    container.innerHTML = '<div class="empty">No active tokens</div>';
    return;
  }

  tokens.sort((a, b) => b.createdAt - a.createdAt);
  const now = Date.now();

  container.innerHTML = tokens.map(t => {
    const timeLeft = t.expiryAt - now;
    const isExpiring = timeLeft < 3600000;
    const isLocked = !!t.device;

    const statusBadge = isLocked
      ? '<span class="status-badge locked">🔒 Locked</span>'
      : '<span class="status-badge unlocked">🔓 Unlocked</span>';

    // ✅ Portal badge in every token
    const portalBadge = t.portalName
      ? '<span class="portal-tag">📡 ' + t.portalName + '</span>'
      : '<span class="portal-tag" style="color:#ff8888;border-color:rgba(255,85,85,0.3);">⚠️ No Portal</span>';

    const expiringClass = isExpiring ? 'expiring' : (isLocked ? 'locked' : '');
    const playlistUrl = currentPlaylistBase + '?token=' + encodeURIComponent(t.token);

    return \`
      <div class="token-item \${expiringClass}">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div>\${statusBadge}\${portalBadge} <b style="font-size:13px;">Duration: \${t.durationLabel}</b></div>
          <div style="font-size:11px;color:#999;">Created: \${formatTime(t.createdAt)}</div>
        </div>
        <div class="token-value">\${playlistUrl}</div>
        <div class="token-info">
          <div>⏰ <b>Expires:</b> \${formatTime(t.expiryAt)}</div>
          <div>⌛ <b>Time Left:</b> \${formatDuration(timeLeft)}</div>
          <div>📊 <b>Fetches:</b> \${t.fetchCount || 0}</div>
          \${t.portalId ? '<div>🆔 <b>Portal ID:</b> ' + t.portalId.slice(0,8) + '...</div>' : ''}
          \${isLocked ? '<div>📱 <b>Device:</b> ' + (t.lockedUA || 'Unknown').substring(0, 40) + '...</div>' : ''}
          \${t.firstUseIP ? '<div>🌐 <b>IP:</b> ' + t.firstUseIP + '</div>' : ''}
          \${t.lockedAt ? '<div>🔒 <b>Locked:</b> ' + formatTime(t.lockedAt) + '</div>' : ''}
        </div>
        <div class="token-actions">
          <button class="action-btn copy-btn" onclick="copyUrl('\${playlistUrl}', this)">📋 Copy URL</button>
          <button class="action-btn delete-btn" onclick="deleteToken('\${t.token}')">🗑️ Delete</button>
        </div>
      </div>
    \`;
  }).join('');
}

function copyUrl(url, btn) {
  navigator.clipboard.writeText(url).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✅ Copied!';
    setTimeout(() => btn.textContent = orig, 2000);
  });
}

async function deleteToken(token) {
  if (!confirm('Delete this token? This cannot be undone.')) return;
  try {
    const res = await fetch('/api/admin/delete-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (data.success) {
      loadTokens();
    } else {
      alert('Delete failed: ' + data.error);
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function logout() {
  document.cookie = 'rkdy_admin=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  window.location.href = '/admin';
}

function formatTime(ms) {
  const d = new Date(ms);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(ms) {
  if (ms <= 0) return 'Expired';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return days + 'd ' + hours + 'h';
  if (hours > 0) return hours + 'h ' + mins + 'm';
  return mins + 'm';
}

// Initial load
loadTokens();
setInterval(loadTokens, 30000);
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

// ============================================================
//  RKDYIPTV — Portal Manager
//  File: functions/portal.js
//  Route: /portal
//  Client-side password prompt gates the UI; every API call is
//  re-checked server-side against PORTAL_PASSWORD in _lib/portals.js.
// ============================================================

export async function onRequest(context) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>RKDYIPTV — Portal Manager</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: linear-gradient(135deg, #0b0b12 0%, #1a0b2e 100%);
    color: #eee;
    font-family: 'Segoe UI', Arial, sans-serif;
    min-height: 100vh;
    padding: 20px;
  }
  .container { max-width: 720px; margin: 0 auto; }
  h1 {
    font-size: 22px;
    background: linear-gradient(90deg, #00e6c3, #ff0099);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    margin-bottom: 20px;
  }
  .card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 15px;
    padding: 24px;
    margin-bottom: 20px;
  }
  .card h2 { font-size: 15px; color: #00e6c3; margin-bottom: 15px; }
  label { display: block; font-size: 12px; color: #aaa; margin: 10px 0 5px; }
  input[type=text], input[type=password] {
    width: 100%;
    padding: 10px 12px;
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    color: #eee;
    font-size: 13px;
  }
  input:focus { outline: none; border-color: #00e6c3; }
  .btn {
    background: linear-gradient(90deg, #00b8d4, #00e6c3);
    color: #04231f;
    border: none;
    padding: 12px 22px;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    font-size: 14px;
    margin-top: 14px;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn.secondary { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #eee; }
  .btn.danger { background: linear-gradient(90deg, #ff0099, #ff5f8a); color: #2a0016; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 6px; }
  .row .btn { margin-top: 0; }
  #gate {
    max-width: 360px;
    margin: 80px auto 0;
    text-align: center;
  }
  #gate .msg { font-size: 13px; color: #ff5c7a; min-height: 18px; margin-top: 10px; }
  #app { display: none; }
  .portal-item {
    background: rgba(0,0,0,0.3);
    padding: 15px;
    border-radius: 10px;
    margin-bottom: 12px;
    border-left: 3px solid #00e6c3;
  }
  .portal-item.default { border-left-color: #ff0099; }
  .portal-name { font-weight: bold; font-size: 14px; }
  .badge {
    display: inline-block;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(255,0,153,0.15);
    color: #ff5f9c;
    margin-left: 8px;
  }
  .portal-info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 6px;
    font-size: 12px;
    color: #aaa;
    margin: 10px 0;
  }
  .portal-info b { color: #eee; }
  .empty { text-align: center; padding: 30px; color: #666; }
  .status { font-size: 13px; margin-top: 10px; min-height: 18px; }
  .status.error { color: #ff5c7a; }
  .status.ok { color: #00e6c3; }
</style>
</head>
<body>

  <div id="gate">
    <h1 style="text-align:center;">🔐 Portal Manager</h1>
    <label>Enter password</label>
    <input type="password" id="pw-input" placeholder="Password">
    <button class="btn" style="width:100%;" onclick="unlock()">Unlock</button>
    <div class="msg" id="gate-msg"></div>
  </div>

  <div class="container" id="app">
    <h1>📡 Portal Manager</h1>

    <div class="card">
      <h2 id="form-title">➕ Add New Portal</h2>
      <input type="hidden" id="f-id">
      <label>Portal Name</label>
      <input type="text" id="f-name" placeholder="e.g. Main Portal">
      <label>URL</label>
      <input type="text" id="f-url" placeholder="http://portal-domain.com:port/c/">
      <label>MAC Address</label>
      <input type="text" id="f-mac" placeholder="00:1A:79:XX:XX:XX">
      <label>Serial No</label>
      <input type="text" id="f-serial" placeholder="Serial number">
      <label>Device ID 1</label>
      <input type="text" id="f-deviceId1" placeholder="Device ID 1">
      <label>Device ID 2</label>
      <input type="text" id="f-deviceId2" placeholder="Device ID 2">
      <label style="display:flex;align-items:center;gap:8px;margin-top:14px;">
        <input type="checkbox" id="f-default" style="width:auto;"> Set as default portal
      </label>
      <div class="row">
        <button class="btn" id="save-btn" onclick="savePortal()">💾 Save Portal</button>
        <button class="btn secondary" id="cancel-btn" onclick="resetForm()" style="display:none;">Cancel Edit</button>
      </div>
      <div class="status" id="form-status"></div>
    </div>

    <div class="card">
      <h2>📋 Saved Portals</h2>
      <div id="portal-list"><div class="empty">Loading...</div></div>
    </div>
  </div>

<script>
let PORTAL_PASSWORD = '';
let allPortals = [];

function unlock() {
  const pw = document.getElementById('pw-input').value;
  if (!pw) return;
  PORTAL_PASSWORD = pw;
  testPasswordAndEnter();
}

async function testPasswordAndEnter() {
  const gateMsg = document.getElementById('gate-msg');
  gateMsg.textContent = '';
  try {
    const res = await fetch('/api/portal/list', { headers: { 'x-portal-password': PORTAL_PASSWORD } });
    const data = await res.json();
    if (!data.success) {
      gateMsg.textContent = '❌ ' + (data.error || 'Wrong password');
      return;
    }
    document.getElementById('gate').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    allPortals = data.portals;
    renderPortals();
  } catch (err) {
    gateMsg.textContent = '❌ ' + err.message;
  }
}

document.getElementById('pw-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') unlock();
});

function renderPortals() {
  const container = document.getElementById('portal-list');
  if (allPortals.length === 0) {
    container.innerHTML = '<div class="empty">No portals added yet</div>';
    return;
  }
  container.innerHTML = allPortals.map(p => \`
    <div class="portal-item \${p.isDefault ? 'default' : ''}">
      <div class="portal-name">\${p.name} \${p.isDefault ? '<span class="badge">DEFAULT</span>' : ''}</div>
      <div class="portal-info">
        <div>🔗 <b>URL:</b> \${p.url}</div>
        <div>📟 <b>MAC:</b> \${p.mac || '—'}</div>
        <div>🔢 <b>Serial:</b> \${p.serial || '—'}</div>
        <div>🆔 <b>Device 1:</b> \${p.deviceId1 || '—'}</div>
        <div>🆔 <b>Device 2:</b> \${p.deviceId2 || '—'}</div>
      </div>
      <div class="row">
        <button class="btn secondary" onclick="editPortal('\${p.id}')">✏️ Edit</button>
        \${!p.isDefault ? '<button class="btn secondary" onclick="makeDefault(\\'' + p.id + '\\')">⭐ Make Default</button>' : ''}
        <button class="btn danger" onclick="removePortal('\${p.id}')">🗑️ Delete</button>
      </div>
    </div>
  \`).join('');
}

function resetForm() {
  document.getElementById('f-id').value = '';
  document.getElementById('f-name').value = '';
  document.getElementById('f-url').value = '';
  document.getElementById('f-mac').value = '';
  document.getElementById('f-serial').value = '';
  document.getElementById('f-deviceId1').value = '';
  document.getElementById('f-deviceId2').value = '';
  document.getElementById('f-default').checked = false;
  document.getElementById('form-title').textContent = '➕ Add New Portal';
  document.getElementById('cancel-btn').style.display = 'none';
  document.getElementById('form-status').textContent = '';
}

function editPortal(id) {
  const p = allPortals.find(x => x.id === id);
  if (!p) return;
  document.getElementById('f-id').value = p.id;
  document.getElementById('f-name').value = p.name;
  document.getElementById('f-url').value = p.url;
  document.getElementById('f-mac').value = p.mac;
  document.getElementById('f-serial').value = p.serial;
  document.getElementById('f-deviceId1').value = p.deviceId1;
  document.getElementById('f-deviceId2').value = p.deviceId2;
  document.getElementById('f-default').checked = !!p.isDefault;
  document.getElementById('form-title').textContent = '✏️ Edit Portal';
  document.getElementById('cancel-btn').style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function savePortal() {
  const btn = document.getElementById('save-btn');
  const statusEl = document.getElementById('form-status');
  const payload = {
    id: document.getElementById('f-id').value || undefined,
    name: document.getElementById('f-name').value,
    url: document.getElementById('f-url').value,
    mac: document.getElementById('f-mac').value,
    serial: document.getElementById('f-serial').value,
    deviceId1: document.getElementById('f-deviceId1').value,
    deviceId2: document.getElementById('f-deviceId2').value,
    isDefault: document.getElementById('f-default').checked,
  };
  btn.disabled = true;
  statusEl.className = 'status';
  statusEl.textContent = 'Saving...';
  try {
    const res = await fetch('/api/portal/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-portal-password': PORTAL_PASSWORD },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Save failed');
    statusEl.className = 'status ok';
    statusEl.textContent = '✅ Saved!';
    resetForm();
    await reloadPortals();
  } catch (err) {
    statusEl.className = 'status error';
    statusEl.textContent = '❌ ' + err.message;
  }
  btn.disabled = false;
}

async function makeDefault(id) {
  const p = allPortals.find(x => x.id === id);
  if (!p) return;
  try {
    const res = await fetch('/api/portal/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-portal-password': PORTAL_PASSWORD },
      body: JSON.stringify({ ...p, isDefault: true }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed');
    await reloadPortals();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function removePortal(id) {
  if (!confirm('Delete this portal? This cannot be undone.')) return;
  try {
    const res = await fetch('/api/portal/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-portal-password': PORTAL_PASSWORD },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Delete failed');
    await reloadPortals();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function reloadPortals() {
  const res = await fetch('/api/portal/list', { headers: { 'x-portal-password': PORTAL_PASSWORD } });
  const data = await res.json();
  if (data.success) {
    allPortals = data.portals;
    renderPortals();
  }
}
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

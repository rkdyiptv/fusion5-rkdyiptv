// ============================================================
//  RKDYIPTV — Admin Login Page (Root Level)
//  File: functions/admin.js
//  Route: /admin
// ============================================================

export async function onRequest(context) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>RKDYIPTV Admin — Login</title>
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
    padding: 40px 30px;
    max-width: 400px;
    width: 100%;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }
  h1 {
    font-size: 24px;
    background: linear-gradient(90deg, #4ea1ff, #b16cff);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    margin-bottom: 20px;
  }
  .form-group { margin-bottom: 15px; text-align: left; }
  label {
    display: block;
    font-size: 13px;
    color: #aaa;
    margin-bottom: 6px;
  }
  input {
    width: 100%;
    padding: 12px 14px;
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    outline: none;
  }
  input:focus { border-color: #4ea1ff; }
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
    margin-top: 10px;
  }
  .error {
    color: #ff5555;
    font-size: 13px;
    margin-top: 10px;
    min-height: 18px;
  }
  .logo-emoji { font-size: 40px; margin-bottom: 10px; }
</style>
</head>
<body>
  <div class="card">
    <div class="logo-emoji">🔐</div>
    <h1>RKDYIPTV Admin</h1>
    <form id="login-form" onsubmit="return doLogin(event)">
      <div class="form-group">
        <label>Username</label>
        <input type="text" id="username" required autocomplete="username">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="password" required autocomplete="current-password">
      </div>
      <button type="submit" class="btn">Sign In</button>
      <div class="error" id="error"></div>
    </form>
  </div>
<script>
async function doLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorBox = document.getElementById('error');
  errorBox.textContent = 'Signing in...';
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.success) {
      window.location.href = '/admin/dashboard';
    } else {
      errorBox.textContent = '❌ ' + (data.error || 'Login failed');
    }
  } catch (err) {
    errorBox.textContent = '❌ Network error';
  }
  return false;
}
</script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

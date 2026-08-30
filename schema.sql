-- ============================================================
--  RKDYIPTV — D1 Schema (tokens + portals)
--  Run once: wrangler d1 execute rkdyiptv-db --remote --file=./schema.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS tokens (
  token           TEXT PRIMARY KEY,
  duration_hours  INTEGER,
  duration_label  TEXT,
  created_at      INTEGER,
  expiry_at       INTEGER,
  device_limit    TEXT,              -- number stored as text, or 'unlimited'
  devices         TEXT DEFAULT '[]', -- JSON array string
  locked_at       INTEGER,
  locked_ua       TEXT,
  first_use_ip    TEXT,
  fetch_count     INTEGER DEFAULT 0,
  last_used       INTEGER,
  source          TEXT,              -- 'admin' or 'public-ad-gate'
  portal_id       TEXT,
  portal_name     TEXT
);

CREATE INDEX IF NOT EXISTS idx_tokens_expiry ON tokens(expiry_at);

CREATE TABLE IF NOT EXISTS portals (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  mac         TEXT,
  serial      TEXT,
  device_id1  TEXT,
  device_id2  TEXT,
  is_default  INTEGER DEFAULT 0,
  created_at  INTEGER,
  updated_at  INTEGER
);

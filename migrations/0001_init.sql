CREATE TABLE recipients (
  id TEXT PRIMARY KEY, alias TEXT UNIQUE NOT NULL, email TEXT NOT NULL,
  dashboard_token TEXT UNIQUE NOT NULL, base_cents INTEGER NOT NULL DEFAULT 100,
  paused INTEGER NOT NULL DEFAULT 0, verified INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE allowlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT, recipient_id TEXT NOT NULL, pattern TEXT NOT NULL,
  UNIQUE(recipient_id, pattern)
);
CREATE TABLE senders (
  email TEXT PRIMARY KEY, released INTEGER NOT NULL DEFAULT 0, captured INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE messages (
  id TEXT PRIMARY KEY, recipient_id TEXT NOT NULL, from_email TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '', raw_key TEXT, status TEXT NOT NULL, reason TEXT,
  price_cents INTEGER, category TEXT, summary TEXT, bulk_score REAL, dupes INTEGER DEFAULT 0,
  shingles TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX idx_msg_rec ON messages(recipient_id, created_at);
CREATE INDEX idx_msg_sender ON messages(recipient_id, from_email, created_at);
CREATE TABLE bonds (
  id TEXT PRIMARY KEY, message_id TEXT NOT NULL, recipient_id TEXT NOT NULL, amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL, session_id TEXT, payment_intent_id TEXT, held_at INTEGER, hold_expires_at INTEGER,
  decided_at INTEGER, created_at INTEGER NOT NULL
);
CREATE INDEX idx_bond_status ON bonds(status, hold_expires_at);
CREATE TABLE ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT, recipient_id TEXT NOT NULL, bond_id TEXT NOT NULL, cents INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, type TEXT NOT NULL, recipient_id TEXT, cents INTEGER, data TEXT
);
CREATE TABLE processed_events (id TEXT PRIMARY KEY, ts INTEGER NOT NULL);

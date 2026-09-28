CREATE TABLE rate_limits (key TEXT NOT NULL, ts INTEGER NOT NULL);
CREATE INDEX idx_rate ON rate_limits(key, ts);

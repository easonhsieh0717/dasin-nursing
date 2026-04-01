-- Rate limiter table for distributed login attempt tracking
-- Used by src/lib/rate-limiter.ts in production (Supabase-backed)

CREATE TABLE IF NOT EXISTS login_attempts (
  id         BIGSERIAL PRIMARY KEY,
  ip         TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by IP + time window
CREATE INDEX idx_login_attempts_ip_time ON login_attempts (ip, attempted_at DESC);

-- Auto-cleanup: remove entries older than 1 hour (generous buffer over 15-min window)
-- Run via pg_cron or Supabase scheduled function
-- Example: SELECT cron.schedule('cleanup-login-attempts', '*/30 * * * *',
--   $$DELETE FROM login_attempts WHERE attempted_at < now() - interval '1 hour'$$);

-- RLS: only service_role can access (no client access)
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
-- No policies = no anon/authenticated access, only service_role bypasses RLS

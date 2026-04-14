-- Password management: add columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS login_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz DEFAULT NULL;

-- Password reset requests table
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pw_reset_requests_org_status ON password_reset_requests (org_id, status);
CREATE INDEX IF NOT EXISTS idx_pw_reset_requests_user ON password_reset_requests (user_id);

ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_all_pw_reset" ON password_reset_requests
  USING (true) WITH CHECK (true);

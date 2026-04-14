-- P6: Flexible rate profiles per case

-- Rate profiles (one per case or shared)
CREATE TABLE IF NOT EXISTS rate_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_profiles_org ON rate_profiles (org_id);

ALTER TABLE rate_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_all_rate_profiles" ON rate_profiles
  USING (true) WITH CHECK (true);

-- Rate periods: each profile has 2-4 time periods
CREATE TABLE IF NOT EXISTS rate_periods (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES rate_profiles(id) ON DELETE CASCADE,
  start_time text NOT NULL,    -- e.g. "0800"
  end_time text NOT NULL,      -- e.g. "2000"
  billing_rate numeric(10,2) NOT NULL DEFAULT 0,
  nurse_rate numeric(10,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_periods_profile ON rate_periods (profile_id, sort_order);

ALTER TABLE rate_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_all_rate_periods" ON rate_periods
  USING (true) WITH CHECK (true);

-- Add rate_profile_id to cases (nullable = use standard rate_settings)
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS rate_profile_id uuid REFERENCES rate_profiles(id) ON DELETE SET NULL;

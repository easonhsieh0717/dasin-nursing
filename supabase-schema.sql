-- 特護打卡系統 Supabase Schema
-- 請在 Supabase SQL Editor 中執行此腳本

-- 組織
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 使用者（管理員 + 特護）
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  account VARCHAR(50) NOT NULL,
  password VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'employee',
  hourly_rate DECIMAL(10,2) DEFAULT 200,
  bank VARCHAR(100) DEFAULT '',
  account_no VARCHAR(50) DEFAULT '',
  account_name VARCHAR(50) DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, account)
);

-- 個案
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  case_type VARCHAR(20) DEFAULT '一般',
  settlement_type VARCHAR(10) DEFAULT '週',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 打卡紀錄
CREATE TABLE clock_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  clock_in_time TIMESTAMPTZ,
  clock_in_lat DOUBLE PRECISION,
  clock_in_lng DOUBLE PRECISION,
  clock_out_time TIMESTAMPTZ,
  clock_out_lat DOUBLE PRECISION,
  clock_out_lng DOUBLE PRECISION,
  salary DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 特殊狀況
CREATE TABLE special_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  target VARCHAR(100),
  multiplier DECIMAL(5,2) DEFAULT 1,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 費率設定
CREATE TABLE rate_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL,
  label VARCHAR(100),
  main_day_rate DECIMAL(10,2) DEFAULT 490,
  main_night_rate DECIMAL(10,2) DEFAULT 530,
  other_day_rate DECIMAL(10,2) DEFAULT 550,
  other_night_rate DECIMAL(10,2) DEFAULT 600,
  full_day_rate_24h DECIMAL(10,2) DEFAULT 12240,
  min_billing_hours INTEGER DEFAULT 8,
  remote_area_subsidy DECIMAL(10,2) DEFAULT 500,
  dialysis_visit_fee DECIMAL(10,2) DEFAULT 3000,
  dialysis_overtime_rate DECIMAL(10,2) DEFAULT 500,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_cases_org ON cases(org_id);
CREATE INDEX idx_clock_records_org ON clock_records(org_id);
CREATE INDEX idx_clock_records_user ON clock_records(user_id);
CREATE INDEX idx_clock_records_case ON clock_records(case_id);
CREATE INDEX idx_clock_records_time ON clock_records(clock_in_time DESC);
CREATE INDEX idx_clock_records_out_time ON clock_records(clock_out_time DESC);
CREATE INDEX idx_clock_records_open ON clock_records(user_id) WHERE clock_out_time IS NULL;

-- 插入預設資料
INSERT INTO organizations (id, code, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'ZSB', '達信護理');

INSERT INTO users (org_id, name, account, password, role, hourly_rate) VALUES
  ('00000000-0000-0000-0000-000000000001', '管理員', 'A123', '9123', 'admin', 0),
  ('00000000-0000-0000-0000-000000000001', '特護測試', 'L123', '9123', 'employee', 200),
  ('00000000-0000-0000-0000-000000000001', '郭語', 'G001', '1234', 'employee', 200),
  ('00000000-0000-0000-0000-000000000001', '陳俞均', 'C001', '1234', 'employee', 220);

INSERT INTO cases (org_id, name, code, case_type, settlement_type) VALUES
  ('00000000-0000-0000-0000-000000000001', '中山區寶寶', 'ZSBB', '一般', '週'),
  ('00000000-0000-0000-0000-000000000001', '高樹梁伯伯', 'GSLBB', '一般', '月'),
  ('00000000-0000-0000-0000-000000000001', '林口錢林奶奶', 'LKQLN', '一般', '週'),
  ('00000000-0000-0000-0000-000000000001', '天母居家奶奶', 'TMJJN', '一般', '月');

INSERT INTO rate_settings (org_id, effective_date, label, main_day_rate, main_night_rate, other_day_rate, other_night_rate, full_day_rate_24h, min_billing_hours, remote_area_subsidy, dialysis_visit_fee, dialysis_overtime_rate) VALUES
  ('00000000-0000-0000-0000-000000000001', '2024-12-01', '113/12/1 生效費率', 490, 530, 550, 600, 12240, 8, 500, 3000, 500);

INSERT INTO special_conditions (org_id, name, target, multiplier, start_time, end_time) VALUES
  ('00000000-0000-0000-0000-000000000001', '過年', 'ZSB', 2, '2026-02-16 16:30:00+08', '2026-02-21 23:59:00+08');

-- RLS: 只允許 service_role 完全存取（API 用 service key）
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE clock_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all" ON organizations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON cases FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON clock_records FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON special_conditions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON rate_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

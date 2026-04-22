-- 達信護理打卡系統 — Supabase Schema
-- v4.19.6 / 2026-04-17
-- 以生產資料庫為準（hazlgllkgdryilcvvfsd.supabase.co）
-- 新環境建立流程：Supabase Dashboard → SQL Editor → 全選貼上執行

-- ============================================================
-- 機構
-- ============================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 使用者（管理員 + 特護）
-- ============================================================
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
  note TEXT DEFAULT '',
  default_case_id UUID,                                    -- 歷史遺留，永遠 NULL，勿使用
  must_change_password BOOLEAN NOT NULL DEFAULT false,     -- 首次登入強制改密
  login_attempts INTEGER NOT NULL DEFAULT 0,               -- 連續錯誤次數
  locked_until TIMESTAMPTZ,                                -- 帳號鎖定到期時間
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, account)
);

-- ============================================================
-- 個案
-- ============================================================
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  case_type VARCHAR(20) DEFAULT '主要地區',   -- '主要地區' | '偏遠地區'
  settlement_type VARCHAR(10) DEFAULT '週',
  remote_subsidy BOOLEAN NOT NULL DEFAULT false,  -- 偏遠地區補貼
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 打卡紀錄
-- ============================================================
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
  salary DECIMAL(10,2) DEFAULT 0,          -- 管理員手動覆寫用（0 = 自動計算）
  billing DECIMAL(10,2) DEFAULT 0,         -- 機構向家屬請款金額
  nurse_salary DECIMAL(10,2) DEFAULT 0,    -- 護理師薪資
  day_hours DECIMAL(6,2) DEFAULT 0,        -- 日班工時（08:00-20:00）
  night_hours DECIMAL(6,2) DEFAULT 0,      -- 夜班工時（20:00-08:00）
  paid_at TIMESTAMPTZ,                     -- 結帳時間（null = 未結帳）
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 費率設定
-- ============================================================
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

-- ============================================================
-- 特殊狀況（颱風假、連假倍率）
-- ============================================================
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

-- ============================================================
-- 推播訂閱
-- ============================================================
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 索引
-- ============================================================
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_account ON users(org_id, account);
CREATE INDEX idx_cases_org ON cases(org_id);
CREATE INDEX idx_cases_code ON cases(code);
CREATE INDEX idx_clock_records_org ON clock_records(org_id);
CREATE INDEX idx_clock_records_user ON clock_records(user_id);
CREATE INDEX idx_clock_records_case ON clock_records(case_id);
CREATE INDEX idx_clock_records_time ON clock_records(clock_in_time DESC);
CREATE INDEX idx_clock_records_out_time ON clock_records(clock_out_time DESC);
CREATE INDEX idx_clock_records_open ON clock_records(user_id) WHERE clock_out_time IS NULL;

-- ============================================================
-- Row Level Security（API 只用 service_role key，全部允許）
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE clock_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all" ON organizations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON cases FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON clock_records FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON rate_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON special_conditions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON push_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 預設資料（新環境用）
-- ============================================================
INSERT INTO organizations (id, code, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'ZSB', '達信護理');

-- 管理員帳號（密碼請改成 bcrypt hash，預設明文僅供測試）
INSERT INTO users (org_id, name, account, password, role, hourly_rate) VALUES
  ('00000000-0000-0000-0000-000000000001', '管理員', 'A123', '$2b$10$預設請重設', 'admin', 0);

INSERT INTO rate_settings (org_id, effective_date, label, main_day_rate, main_night_rate,
  other_day_rate, other_night_rate, full_day_rate_24h, min_billing_hours,
  remote_area_subsidy, dialysis_visit_fee, dialysis_overtime_rate) VALUES
  ('00000000-0000-0000-0000-000000000001', '2024-12-01', '113/12/1 生效費率',
   490, 530, 550, 600, 12240, 8, 500, 3000, 500);

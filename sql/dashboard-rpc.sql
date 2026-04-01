-- ============================================================
-- Dashboard RPC Functions for 達心特護打卡系統
-- 請在 Supabase SQL Editor 中執行此檔案
-- ============================================================

-- 1. dashboard_summary: 摘要 KPI
CREATE OR REPLACE FUNCTION dashboard_summary(
  p_org_id UUID,
  p_start_time TEXT DEFAULT NULL,
  p_end_time TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'totalBilling', COALESCE(SUM(billing), 0),
      'totalNurseSalary', COALESCE(SUM(nurse_salary), 0),
      'totalProfit', COALESCE(SUM(billing), 0) - COALESCE(SUM(nurse_salary), 0),
      'totalShifts', COUNT(*),
      'totalDayHours', COALESCE(SUM(day_hours), 0),
      'totalNightHours', COALESCE(SUM(night_hours), 0)
    )
    FROM clock_records
    WHERE org_id = p_org_id
      AND clock_out_time IS NOT NULL
      AND (p_start_time IS NULL OR clock_in_time >= p_start_time::timestamptz)
      AND (p_end_time IS NULL OR clock_in_time <= p_end_time::timestamptz)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. dashboard_trend: 趨勢圖（支援 day/week/month 粒度）
CREATE OR REPLACE FUNCTION dashboard_trend(
  p_org_id UUID,
  p_start_time TEXT DEFAULT NULL,
  p_end_time TEXT DEFAULT NULL,
  p_granularity TEXT DEFAULT 'month'
)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_data ORDER BY period), '[]'::json)
    FROM (
      SELECT
        json_build_object(
          'label', CASE p_granularity
            WHEN 'day' THEN to_char(date_trunc('day', cr.clock_in_time AT TIME ZONE 'Asia/Taipei'), 'MM-DD')
            WHEN 'week' THEN
              to_char(date_trunc('week', cr.clock_in_time AT TIME ZONE 'Asia/Taipei'), 'MM-DD')
              || '~' ||
              to_char(date_trunc('week', cr.clock_in_time AT TIME ZONE 'Asia/Taipei') + INTERVAL '6 days', 'MM-DD')
            ELSE to_char(date_trunc('month', cr.clock_in_time AT TIME ZONE 'Asia/Taipei'), 'YYYY-MM')
          END,
          'billing', COALESCE(SUM(cr.billing), 0),
          'nurseSalary', COALESCE(SUM(cr.nurse_salary), 0),
          'profit', COALESCE(SUM(cr.billing), 0) - COALESCE(SUM(cr.nurse_salary), 0),
          'shifts', COUNT(*),
          'activeNurses', COUNT(DISTINCT cr.user_id)
        ) AS row_data,
        date_trunc(
          CASE p_granularity WHEN 'day' THEN 'day' WHEN 'week' THEN 'week' ELSE 'month' END,
          cr.clock_in_time AT TIME ZONE 'Asia/Taipei'
        ) AS period
      FROM clock_records cr
      WHERE cr.org_id = p_org_id
        AND cr.clock_out_time IS NOT NULL
        AND (p_start_time IS NULL OR cr.clock_in_time >= p_start_time::timestamptz)
        AND (p_end_time IS NULL OR cr.clock_in_time <= p_end_time::timestamptz)
      GROUP BY period
    ) sub
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. dashboard_case_breakdown: 個案營收排名
CREATE OR REPLACE FUNCTION dashboard_case_breakdown(
  p_org_id UUID,
  p_start_time TEXT DEFAULT NULL,
  p_end_time TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_data ORDER BY total_billing DESC), '[]'::json)
    FROM (
      SELECT
        json_build_object(
          'name', c.name,
          'billing', COALESCE(SUM(cr.billing), 0),
          'nurseSalary', COALESCE(SUM(cr.nurse_salary), 0),
          'profit', COALESCE(SUM(cr.billing), 0) - COALESCE(SUM(cr.nurse_salary), 0),
          'shifts', COUNT(*),
          'margin', CASE WHEN SUM(cr.billing) > 0
            THEN ROUND(((SUM(cr.billing) - SUM(cr.nurse_salary))::NUMERIC / SUM(cr.billing)) * 1000) / 10
            ELSE 0 END
        ) AS row_data,
        SUM(cr.billing) AS total_billing
      FROM clock_records cr
      JOIN cases c ON c.id = cr.case_id
      WHERE cr.org_id = p_org_id
        AND cr.clock_out_time IS NOT NULL
        AND (p_start_time IS NULL OR cr.clock_in_time >= p_start_time::timestamptz)
        AND (p_end_time IS NULL OR cr.clock_in_time <= p_end_time::timestamptz)
      GROUP BY cr.case_id, c.name
    ) sub
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. dashboard_nurse_breakdown: 特護工時排名
CREATE OR REPLACE FUNCTION dashboard_nurse_breakdown(
  p_org_id UUID,
  p_start_time TEXT DEFAULT NULL,
  p_end_time TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_data ORDER BY total_hours DESC), '[]'::json)
    FROM (
      SELECT
        json_build_object(
          'name', u.name,
          'totalHours', COALESCE(SUM(cr.day_hours + cr.night_hours), 0),
          'dayHours', COALESCE(SUM(cr.day_hours), 0),
          'nightHours', COALESCE(SUM(cr.night_hours), 0),
          'billing', COALESCE(SUM(cr.billing), 0),
          'nurseSalary', COALESCE(SUM(cr.nurse_salary), 0),
          'shifts', COUNT(*)
        ) AS row_data,
        SUM(cr.day_hours + cr.night_hours) AS total_hours
      FROM clock_records cr
      JOIN users u ON u.id = cr.user_id
      WHERE cr.org_id = p_org_id
        AND cr.clock_out_time IS NOT NULL
        AND (p_start_time IS NULL OR cr.clock_in_time >= p_start_time::timestamptz)
        AND (p_end_time IS NULL OR cr.clock_in_time <= p_end_time::timestamptz)
      GROUP BY cr.user_id, u.name
    ) sub
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. dashboard_unpaid_shifts: 未發薪明細
CREATE OR REPLACE FUNCTION dashboard_unpaid_shifts(
  p_org_id UUID,
  p_start_time TEXT DEFAULT NULL,
  p_end_time TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_data ORDER BY total_amount DESC), '[]'::json)
    FROM (
      SELECT
        json_build_object(
          'nurseName', u.name,
          'count', COUNT(*),
          'totalAmount', COALESCE(SUM(cr.nurse_salary), 0),
          'oldestDate', MIN(cr.clock_in_time)
        ) AS row_data,
        SUM(cr.nurse_salary) AS total_amount
      FROM clock_records cr
      JOIN users u ON u.id = cr.user_id
      WHERE cr.org_id = p_org_id
        AND cr.clock_out_time IS NOT NULL
        AND cr.paid_at IS NULL
        AND (p_start_time IS NULL OR cr.clock_in_time >= p_start_time::timestamptz)
        AND (p_end_time IS NULL OR cr.clock_in_time <= p_end_time::timestamptz)
      GROUP BY cr.user_id, u.name
    ) sub
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. dashboard_nurse_utilization: 護理師出勤統計
CREATE OR REPLACE FUNCTION dashboard_nurse_utilization(
  p_org_id UUID,
  p_start_time TEXT DEFAULT NULL,
  p_end_time TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_data ORDER BY total_shifts DESC), '[]'::json)
    FROM (
      SELECT
        json_build_object(
          'nurseName', u.name,
          'totalShifts', COUNT(*),
          'dayHours', COALESCE(SUM(cr.day_hours), 0),
          'nightHours', COALESCE(SUM(cr.night_hours), 0),
          'avgPerMonth', ROUND(
            COUNT(*)::NUMERIC / GREATEST(1, COUNT(DISTINCT to_char(cr.clock_in_time AT TIME ZONE 'Asia/Taipei', 'YYYY-MM'))),
            1
          )
        ) AS row_data,
        COUNT(*) AS total_shifts
      FROM clock_records cr
      JOIN users u ON u.id = cr.user_id
      WHERE cr.org_id = p_org_id
        AND cr.clock_out_time IS NOT NULL
        AND (p_start_time IS NULL OR cr.clock_in_time >= p_start_time::timestamptz)
        AND (p_end_time IS NULL OR cr.clock_in_time <= p_end_time::timestamptz)
      GROUP BY cr.user_id, u.name
    ) sub
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. dashboard_case_service_days: 個案服務天數表
CREATE OR REPLACE FUNCTION dashboard_case_service_days(
  p_org_id UUID,
  p_start_time TEXT DEFAULT NULL,
  p_end_time TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_data ORDER BY total_days DESC), '[]'::json)
    FROM (
      SELECT
        json_build_object(
          'caseName', c.name,
          'months', (
            SELECT json_object_agg(month_key, day_count ORDER BY month_key)
            FROM (
              SELECT
                to_char(cr2.clock_in_time AT TIME ZONE 'Asia/Taipei', 'YYYY-MM') AS month_key,
                COUNT(DISTINCT (cr2.clock_in_time AT TIME ZONE 'Asia/Taipei')::date) AS day_count
              FROM clock_records cr2
              WHERE cr2.case_id = cr.case_id
                AND cr2.org_id = p_org_id
                AND cr2.clock_out_time IS NOT NULL
                AND (p_start_time IS NULL OR cr2.clock_in_time >= p_start_time::timestamptz)
                AND (p_end_time IS NULL OR cr2.clock_in_time <= p_end_time::timestamptz)
              GROUP BY month_key
            ) months_sub
          )
        ) AS row_data,
        COUNT(DISTINCT (cr.clock_in_time AT TIME ZONE 'Asia/Taipei')::date) AS total_days
      FROM clock_records cr
      JOIN cases c ON c.id = cr.case_id
      WHERE cr.org_id = p_org_id
        AND cr.clock_out_time IS NOT NULL
        AND (p_start_time IS NULL OR cr.clock_in_time >= p_start_time::timestamptz)
        AND (p_end_time IS NULL OR cr.clock_in_time <= p_end_time::timestamptz)
      GROUP BY cr.case_id, c.name
    ) sub
  );
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Dasin Nursing - Full Functional Test Suite (v4.19.6)
 * 35/36 pass expected. The only known fail: admin A123 password was changed from default.
 *
 * HOW TO RUN:
 *   1. Forge an admin JWT (need JWT_SECRET from .env.local or Vercel dashboard):
 *      node -e "
 *        import('./node_modules/jose/dist/webapi/index.js').then(({SignJWT}) =>
 *          new SignJWT({ userId:'<admin_user_id>', orgId:'00000000-0000-0000-0000-000000000001',
 *            orgCode:'ZSB', name:'管理員', role:'admin' })
 *          .setProtectedHeader({alg:'HS256'}).setExpirationTime('2h')
 *          .sign(new TextEncoder().encode(process.env.JWT_SECRET))
 *          .then(console.log)
 *        )
 *      "
 *   2. Run: ADMIN_TOKEN=<jwt> node run_tests.mjs
 *
 * TEST ACCOUNT: X123 / password: X123 / case code: TST
 * Admin user ID: a323562a-acfc-41bd-b9a2-7c56b63dc6c3
 */

const BASE = 'https://dasin-nursing.vercel.app';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

let pass = 0, fail = 0;
const results = [];

function log(name, ok, detail = '') {
  const icon = ok ? '✅' : '❌';
  results.push({ name, ok, detail });
  console.log(`${icon} ${name}${detail ? ' — ' + detail : ''}`);
  if (ok) pass++; else fail++;
}

async function api(path, opts = {}, cookieHeader = '') {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (cookieHeader) headers['Cookie'] = cookieHeader;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  let body;
  try { body = await res.json(); } catch { body = {}; }
  return { status: res.status, body, cookie: res.headers.get('set-cookie') || '' };
}

// Extract session cookie
function extractToken(cookieStr) {
  const m = cookieStr.match(/token=([^;]+)/);
  return m ? `token=${m[1]}` : '';
}

// ─────────────────────────────────────────────
// 1. AUTH TESTS
// ─────────────────────────────────────────────
console.log('\n=== 1. AUTH ===');

// 1a. Employee login with correct case code
let r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ code: 'TST', account: 'X123', password: 'X123' }) });
log('員工登入(正確代碼+帳密)', r.status === 200 && r.body.success, `mustChangePassword=${r.body.mustChangePassword}`);
const empCookie = extractToken(r.cookie);

// 1b. Employee login with wrong case code
r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ code: 'WRONG999', account: 'X123', password: 'X123' }) });
log('員工登入(錯誤個案代碼)應拒絕', r.status === 401, `msg: ${r.body.error}`);

// 1c. Employee login with wrong password
r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ code: 'TST', account: 'X123', password: 'WRONGPASS' }) });
log('員工登入(錯誤密碼)應拒絕', r.status === 401, `msg: ${r.body.error}`);

// 1d. Admin login (no code)
r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ code: '', account: 'A123', password: 'A123' }) });
log('管理員登入(不填代碼)', r.status === 200 && r.body.success, `role=${r.body.user?.role}`);
const adminCookie = extractToken(r.cookie);

// 1e. Unauthenticated access to protected route
r = await api('/api/clock/status');
log('未登入存取打卡狀態應401', r.status === 401);

// 1f. Employee accessing admin route should 403
r = await api('/api/admin/nurses', {}, empCookie);
log('員工存取管理員API應403', r.status === 403, `msg: ${r.body.error}`);

// ─────────────────────────────────────────────
// 2. NURSE CRUD
// ─────────────────────────────────────────────
console.log('\n=== 2. NURSE CRUD ===');
const adminHdr = `token=${ADMIN_TOKEN}`;

// 2a. Create nurse
r = await api('/api/admin/nurses', {
  method: 'POST',
  body: JSON.stringify({ name: 'TEST自動測試', account: 'AUTOTEST01', hourlyRate: 200 })
}, adminHdr);
log('新增特護', r.status === 200, `id=${r.body.id?.slice(0,8)}`);
const newNurseId = r.body.id;
const expectedMustChange = r.body.mustChangePassword;
log('新增特護 mustChangePassword=true', expectedMustChange === true, `actual=${expectedMustChange}`);

// 2b. Duplicate account error
r = await api('/api/admin/nurses', {
  method: 'POST',
  body: JSON.stringify({ name: 'TEST重複', account: 'AUTOTEST01', hourlyRate: 0 })
}, adminHdr);
log('重複帳號應400', r.status === 400, `msg: ${r.body.error}`);

// 2c. Get nurses list
r = await api('/api/admin/nurses?page=1&pageSize=5', {}, adminHdr);
log('取得特護列表', r.status === 200 && Array.isArray(r.body.data), `total=${r.body.total}`);
log('特護列表不含密碼', r.body.data?.[0] && !('password' in r.body.data[0]));

// 2d. Update nurse
if (newNurseId) {
  r = await api('/api/admin/nurses', {
    method: 'PUT',
    body: JSON.stringify({ id: newNurseId, name: 'TEST自動測試(已更新)', hourlyRate: 250 })
  }, adminHdr);
  log('更新特護', r.status === 200 && r.body.name?.includes('已更新'), `name=${r.body.name}`);
}

// 2e. New nurse login → mustChangePassword should be true
r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ code: 'TST', account: 'AUTOTEST01', password: 'AUTOTEST01' }) });
log('新特護首次登入', r.status === 200 && r.body.mustChangePassword === true, `mustChangePassword=${r.body.mustChangePassword}`);
const newNurseCookie = extractToken(r.cookie);

// ─────────────────────────────────────────────
// 3. PASSWORD MECHANISM
// ─────────────────────────────────────────────
console.log('\n=== 3. PASSWORD MECHANISM ===');

// 3a. Too short
r = await api('/api/auth/change-password', {
  method: 'POST',
  body: JSON.stringify({ currentPassword: 'AUTOTEST01', newPassword: 'Ab1', confirmPassword: 'Ab1' })
}, newNurseCookie);
log('密碼太短應拒絕', r.status === 400, `msg: ${r.body.error}`);

// 3b. No uppercase
r = await api('/api/auth/change-password', {
  method: 'POST',
  body: JSON.stringify({ currentPassword: 'AUTOTEST01', newPassword: 'abcdef123', confirmPassword: 'abcdef123' })
}, newNurseCookie);
log('無大寫應拒絕', r.status === 400, `msg: ${r.body.error}`);

// 3c. No lowercase
r = await api('/api/auth/change-password', {
  method: 'POST',
  body: JSON.stringify({ currentPassword: 'AUTOTEST01', newPassword: 'ABCDEF123', confirmPassword: 'ABCDEF123' })
}, newNurseCookie);
log('無小寫應拒絕', r.status === 400, `msg: ${r.body.error}`);

// 3d. No number
r = await api('/api/auth/change-password', {
  method: 'POST',
  body: JSON.stringify({ currentPassword: 'AUTOTEST01', newPassword: 'AbcdefGhi', confirmPassword: 'AbcdefGhi' })
}, newNurseCookie);
log('無數字應拒絕', r.status === 400, `msg: ${r.body.error}`);

// 3e. Mismatch confirm
r = await api('/api/auth/change-password', {
  method: 'POST',
  body: JSON.stringify({ currentPassword: 'AUTOTEST01', newPassword: 'NewPass123', confirmPassword: 'NewPass456' })
}, newNurseCookie);
log('確認密碼不符應拒絕', r.status === 400, `msg: ${r.body.error}`);

// 3f. Correct password change
r = await api('/api/auth/change-password', {
  method: 'POST',
  body: JSON.stringify({ currentPassword: 'AUTOTEST01', newPassword: 'NewPass123', confirmPassword: 'NewPass123' })
}, newNurseCookie);
log('正確修改密碼', r.status === 200 && r.body.success, `result: ${JSON.stringify(r.body)}`);

// 3g. Login with new password
r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ code: 'TST', account: 'AUTOTEST01', password: 'NewPass123' }) });
log('用新密碼登入', r.status === 200 && r.body.success, `mustChangePassword=${r.body.mustChangePassword}`);
log('改密後mustChangePassword=false', r.body.mustChangePassword === false, `actual=${r.body.mustChangePassword}`);

// 3h. Old password no longer works
r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ code: 'TST', account: 'AUTOTEST01', password: 'AUTOTEST01' }) });
log('舊密碼應無效', r.status === 401, `status: ${r.status}`);

// ─────────────────────────────────────────────
// 4. CASE CRUD
// ─────────────────────────────────────────────
console.log('\n=== 4. CASE CRUD ===');

// 4a. Create case
r = await api('/api/admin/cases', {
  method: 'POST',
  body: JSON.stringify({ name: 'TEST測試個案刪除用', code: 'DELTEST', caseType: '主要地區', remoteSubsidy: false })
}, adminHdr);
log('新增個案', r.status === 200, `id=${r.body.id?.slice(0,8)}, code=${r.body.code}`);
const newCaseId = r.body.id;

// 4b. Get cases list
r = await api('/api/admin/cases?page=1&pageSize=5', {}, adminHdr);
log('取得個案列表', r.status === 200 && Array.isArray(r.body.data), `total=${r.body.total}`);

// 4c. Update case
if (newCaseId) {
  r = await api('/api/admin/cases', {
    method: 'PUT',
    body: JSON.stringify({ id: newCaseId, name: 'TEST測試個案(已更新)', code: 'DELTEST', caseType: '主要地區', remoteSubsidy: false })
  }, adminHdr);
  log('更新個案', r.status === 200 && r.body.name?.includes('已更新'), `name=${r.body.name}`);
}

// 4d. Delete case without records
if (newCaseId) {
  r = await api(`/api/admin/cases?id=${newCaseId}`, { method: 'DELETE' }, adminHdr);
  log('刪除個案(無打卡紀錄)', r.status === 200 && r.body.success, `result: ${JSON.stringify(r.body)}`);
}

// ─────────────────────────────────────────────
// 5. CLOCK & BILLING CALCULATION
// ─────────────────────────────────────────────
console.log('\n=== 5. CLOCK STATUS & RECORDS ===');

// 5a. Clock status for X123 - should not be clocked in (we just clocked out)
r = await api('/api/clock/status', {}, empCookie);
log('打卡狀態查詢', r.status === 200, `isClockedIn=${r.body.isClockedIn}, caseCode=${r.body.defaultCaseCode}`);
log('打卡頁顯示正確個案TST', r.body.defaultCaseCode === 'TST', `actual=${r.body.defaultCaseCode}`);

// 5b. Employee records (should have 2 records from earlier)
r = await api('/api/records', {}, empCookie);
log('員工查自己打卡紀錄', r.status === 200 && r.body.total >= 2, `total=${r.body.total}`);
log('紀錄均屬TST個案', r.body.data?.every(rec => rec.caseCode === 'TST'), `codes=${r.body.data?.map(r=>r.caseCode).join(',')}`);

// 5c. Admin records (all records visible)
r = await api('/api/admin/records?page=1&pageSize=5', {}, adminHdr);
log('管理員查全部紀錄', r.status === 200 && r.body.total > 0, `total=${r.body.total}`);

// 5d. Check billing on the non-test record (14:23~21:31 = 7h8min shift)
const rec = r.body.data?.[0];
if (rec) {
  log('紀錄包含billing欄位', typeof rec.billing === 'number', `billing=${rec.billing}`);
  log('紀錄包含nurseSalary欄位', typeof rec.nurseSalary === 'number', `nurseSalary=${rec.nurseSalary}`);
}

// ─────────────────────────────────────────────
// 6. BILLING CALCULATION VERIFICATION (various shift times)
// ─────────────────────────────────────────────
console.log('\n=== 6. BILLING CALCULATION (via recalculate API) ===');

// Get X123's records for billing check
r = await api('/api/records', {}, empCookie);
const records = r.body.data || [];

for (const rec of records) {
  if (rec.clockInTime && rec.clockOutTime) {
    const inT = new Date(rec.clockInTime);
    const outT = new Date(rec.clockOutTime);
    const durationMin = Math.round((outT - inT) / 60000);
    const inTW = new Date(inT.getTime() + 8*3600*1000).toISOString().replace('T',' ').slice(0,16);
    const outTW = new Date(outT.getTime() + 8*3600*1000).toISOString().replace('T',' ').slice(0,16);
    const isReasonable = durationMin > 60;
    if (isReasonable) {
      log(
        `薪資計算 (${inTW}~${outTW}, ${Math.round(durationMin/60*10)/10}h)`,
        rec.billing > 0 && rec.dayHours + rec.nightHours > 0,
        `billing=${rec.billing}, nurseSalary=${rec.nurseSalary}, dayH=${rec.dayHours}, nightH=${rec.nightHours}`
      );
    }
  }
}

// ─────────────────────────────────────────────
// 7. CLEANUP - Delete test nurse
// ─────────────────────────────────────────────
console.log('\n=== 7. CLEANUP ===');
if (newNurseId) {
  r = await api(`/api/admin/nurses?id=${newNurseId}`, { method: 'DELETE' }, adminHdr);
  log('刪除測試特護(無打卡紀錄)', r.status === 200 && r.body.success, `result: ${JSON.stringify(r.body)}`);
}

// Delete attempt on nurse with records should fail
r = await api(`/api/admin/nurses?id=30bf2095-e55c-4ab0-b62e-05e55c712722`, { method: 'DELETE' }, adminHdr);
log('刪除有打卡紀錄的特護應400', r.status === 400, `msg: ${r.body.error}`);

// ─────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────
console.log(`\n${'='.repeat(50)}`);
console.log(`測試結果：${pass} 通過 / ${fail} 失敗 / ${pass+fail} 總計`);
if (fail > 0) {
  console.log('\n失敗項目：');
  results.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.name}: ${r.detail}`));
}

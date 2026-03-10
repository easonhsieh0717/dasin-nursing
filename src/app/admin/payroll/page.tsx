'use client';

import { useState, useRef } from 'react';

interface PayrollItem {
  name: string;
  userId: string;
  totalSalary: number;
  shifts: number;
  bank: string;
  accountNo: string;
  accountName: string;
  isPostOffice: boolean;
}

interface PayrollData {
  summary: PayrollItem[];
  totalAmount: number;
  postOfficeCount: number;
  postOfficeAmount: number;
  bankCount: number;
  bankAmount: number;
}

export default function PayrollPage() {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [data, setData] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchPayroll = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startTime) params.set('startTime', startTime);
      if (endTime) params.set('endTime', endTime);
      const res = await fetch(`/api/admin/payroll?${params}`);
      const d = await res.json();
      setData(d);
    } catch {
      alert('載入失敗');
    } finally {
      setLoading(false);
    }
  };

  const printPostalSlips = () => {
    if (!data) return;
    const postItems = data.summary.filter(s => s.isPostOffice && s.accountNo);
    if (postItems.length === 0) {
      alert('沒有郵局項目可列印');
      return;
    }

    const now = new Date();
    const rocYear = now.getFullYear() - 1911;
    const month = now.getMonth() + 1;
    const day = now.getDate();

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>郵局存款單</title>
    <style>
      @page { size: A4 portrait; margin: 0; }
      body { margin: 0; padding: 0; font-family: '標楷體', serif; }
      .slip { width: 210mm; min-height: 120mm; border: 1px dashed #ccc; padding: 15mm 20mm; page-break-after: always; position: relative; }
      .slip:last-child { page-break-after: auto; }
      .slip-title { text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 15px; color: #333; }
      .field-row { display: flex; margin-bottom: 10px; align-items: center; }
      .field-label { width: 100px; font-weight: bold; color: #555; font-size: 14px; }
      .field-value { flex: 1; font-size: 16px; border-bottom: 1px solid #333; padding: 4px 8px; min-height: 24px; }
      .field-value.mono { font-family: 'Courier New', monospace; letter-spacing: 3px; font-size: 18px; }
      .amount-box { background: #f8f8f8; border: 2px solid #333; border-radius: 8px; padding: 15px; margin: 15px 0; text-align: center; }
      .amount-number { font-size: 28px; font-weight: bold; color: #d32f2f; font-family: 'Courier New', monospace; }
      .amount-chinese { font-size: 16px; margin-top: 5px; color: #333; }
      .date-row { text-align: right; font-size: 13px; color: #666; margin-top: 15px; }
      .toolbar { padding: 10px 20px; text-align: center; background: #f5f5f5; border-bottom: 1px solid #ddd; }
      .toolbar button { padding: 8px 24px; margin: 0 8px; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: bold; }
      .btn-print { background: #1565c0; color: white; }
      .btn-close { background: #757575; color: white; }
      @media (max-width: 600px) {
        .toolbar { padding: 12px 10px; }
        .toolbar button { display: block; width: 90%; margin: 8px auto; padding: 14px 0; font-size: 18px; }
      }
      @media print { .slip { border: none; } .toolbar { display: none; } }
    </style></head><body>
    <div class="toolbar">
      <button class="btn-print" onclick="window.print()">列印</button>
      <button class="btn-close" onclick="window.close()">關閉視窗</button>
    </div>`;

    for (const item of postItems) {
      const amt = Math.floor(item.totalSalary);
      const rawAcc = item.accountNo.replace(/-/g, '').padStart(14, '0');
      const accPart1 = rawAcc.slice(0, 7);
      const accPart2 = rawAcc.slice(7, 14);

      // 中文大寫金額
      const digits = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'];
      const w = Math.floor(amt / 10000);
      const q = Math.floor((amt % 10000) / 1000);
      const b = Math.floor((amt % 1000) / 100);
      const s = Math.floor((amt % 100) / 10);
      const y = amt % 10;
      let chineseAmt = '';
      if (w > 0) chineseAmt += digits[w] + '萬';
      if (q > 0) chineseAmt += digits[q] + '仟';
      else if (w > 0 && (b > 0 || s > 0 || y > 0)) chineseAmt += '零';
      if (b > 0) chineseAmt += digits[b] + '佰';
      else if (q > 0 && (s > 0 || y > 0)) chineseAmt += '零';
      if (s > 0) chineseAmt += digits[s] + '拾';
      else if (b > 0 && y > 0) chineseAmt += '零';
      if (y > 0) chineseAmt += digits[y];
      chineseAmt += '元整';

      html += `<div class="slip">
        <div class="slip-title">郵局無摺存款單</div>
        <div class="field-row">
          <div class="field-label">局號：</div>
          <div class="field-value mono">${accPart1}</div>
          <div class="field-label" style="width:80px; text-align:center;">帳號：</div>
          <div class="field-value mono">${accPart2}</div>
        </div>
        <div class="field-row">
          <div class="field-label">戶名：</div>
          <div class="field-value" style="font-size:20px;">${item.accountName || item.name}</div>
        </div>
        <div class="amount-box">
          <div class="amount-number">NT$ ${amt.toLocaleString()}</div>
          <div class="amount-chinese">新臺幣 ${chineseAmt}</div>
        </div>
        <div class="field-row">
          <div class="field-label">特護姓名：</div>
          <div class="field-value">${item.name}</div>
          <div class="field-label" style="width:80px; text-align:center;">班數：</div>
          <div class="field-value">${item.shifts} 班</div>
        </div>
        <div class="date-row">中華民國 ${rocYear} 年 ${month} 月 ${day} 日</div>
      </div>`;
    }

    html += '</body></html>';

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const printBankList = () => {
    if (!data) return;
    const bankItems = data.summary.filter(s => !s.isPostOffice && s.totalSalary > 0);
    if (bankItems.length === 0) {
      alert('沒有銀行匯款項目');
      return;
    }

    const now = new Date();
    const total = bankItems.reduce((sum, s) => sum + Math.floor(s.totalSalary), 0);

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>銀行匯款清單</title>
    <style>
      body { font-family: 'Noto Sans TC', sans-serif; padding: 20mm; padding-top: 10mm; }
      h1 { text-align: center; color: #1565c0; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: left; }
      th { background: #e3f2fd; color: #1565c0; }
      .total-row { background: #f5f5f5; font-weight: bold; }
      .date { text-align: right; color: #666; margin-top: 20px; }
      .toolbar { position: fixed; top: 0; left: 0; right: 0; padding: 10px 20px; text-align: center; background: #f5f5f5; border-bottom: 1px solid #ddd; z-index: 100; }
      .toolbar button { padding: 8px 24px; margin: 0 8px; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: bold; }
      .btn-print { background: #1565c0; color: white; }
      .btn-close { background: #757575; color: white; }
      @media (max-width: 600px) {
        .toolbar { padding: 12px 10px; }
        .toolbar button { display: block; width: 90%; margin: 8px auto; padding: 14px 0; font-size: 18px; }
      }
      @media print { .toolbar { display: none; } body { padding-top: 20mm; } }
    </style></head><body>
    <div class="toolbar">
      <button class="btn-print" onclick="window.print()">列印</button>
      <button class="btn-close" onclick="window.close()">關閉視窗</button>
    </div>
    <h1>銀行匯款清單</h1>
    <table>
      <thead><tr><th>#</th><th>特護姓名</th><th>銀行</th><th>帳號</th><th>戶名</th><th>金額</th></tr></thead>
      <tbody>`;

    bankItems.forEach((item, i) => {
      html += `<tr>
        <td>${i + 1}</td>
        <td>${item.name}</td>
        <td>${item.bank || '-'}</td>
        <td style="font-family:monospace;">${item.accountNo || '-'}</td>
        <td>${item.accountName || item.name}</td>
        <td style="text-align:right;">NT$ ${Math.floor(item.totalSalary).toLocaleString()}</td>
      </tr>`;
    });

    html += `<tr class="total-row">
      <td colspan="5">合計（${bankItems.length} 筆）</td>
      <td style="text-align:right;">NT$ ${total.toLocaleString()}</td>
    </tr></tbody></table>
    <div class="date">列印日期：${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}</div>
    </body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const postItems = data?.summary.filter(s => s.isPostOffice) || [];
  const bankItems = data?.summary.filter(s => !s.isPostOffice) || [];

  return (
    <div className="p-3 sm:p-6">
      <h2 className="text-base sm:text-xl font-bold text-gray-800 mb-4">薪資發放</h2>

      {/* Date filter */}
      <div className="bg-white p-3 sm:p-4 rounded-lg mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="font-bold text-orange-700 text-sm">篩選時間</span>
        <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)}
          className="px-2 py-1 border rounded text-sm flex-1 min-w-[140px]" />
        <span className="text-sm">~</span>
        <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)}
          className="px-2 py-1 border rounded text-sm flex-1 min-w-[140px]" />
        <button onClick={fetchPayroll} disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 text-sm disabled:opacity-50">
          {loading ? '計算中...' : '計算薪資'}
        </button>
      </div>

      {data && (
        <>
          {/* Stats overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-green-500">
              <div className="text-sm text-gray-500">發放總額</div>
              <div className="text-xl sm:text-2xl font-bold text-green-700">NT$ {Math.floor(data.totalAmount).toLocaleString()}</div>
              <div className="text-xs text-gray-400">{data.summary.length} 位特護</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-red-400">
              <div className="text-sm text-gray-500">郵局</div>
              <div className="text-lg sm:text-xl font-bold text-red-600">NT$ {Math.floor(data.postOfficeAmount).toLocaleString()}</div>
              <div className="text-xs text-gray-400">{data.postOfficeCount} 筆</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-blue-400">
              <div className="text-sm text-gray-500">銀行</div>
              <div className="text-lg sm:text-xl font-bold text-blue-600">NT$ {Math.floor(data.bankAmount).toLocaleString()}</div>
              <div className="text-xs text-gray-400">{data.bankCount} 筆</div>
            </div>
          </div>

          {/* Hint: missing bank info */}
          {data.summary.some(s => !s.bank && !s.accountNo) && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4 text-sm text-yellow-800">
              ⚠ 部分特護尚未設定銀行資訊，請至「<a href="/admin/nurses" className="text-blue-600 underline font-bold">特護管理</a>」頁面填寫銀行/郵局帳號，系統才能正確分類郵局與銀行。
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={printPostalSlips}
              disabled={data.postOfficeCount === 0}
              className="px-4 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
              列印郵局存款單 {data.postOfficeCount > 0 ? `(${data.postOfficeCount} 筆)` : ''}
            </button>
            <button onClick={printBankList}
              disabled={data.bankCount === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
              列印銀行匯款清單 {data.bankCount > 0 ? `(${data.bankCount} 筆)` : ''}
            </button>
          </div>

          {/* Post Office section */}
          {postItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-red-600 mb-2 border-l-4 border-red-500 pl-2">郵局發放明細</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>特護姓名</th>
                      <th>戶名</th>
                      <th>帳號</th>
                      <th>班數</th>
                      <th>金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {postItems.map(item => (
                      <tr key={item.userId}>
                        <td>{item.name}</td>
                        <td>{item.accountName || item.name}</td>
                        <td className="font-mono text-xs">{item.accountNo || '-'}</td>
                        <td>{item.shifts}</td>
                        <td className="font-bold text-green-700">NT$ {Math.floor(item.totalSalary).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bank section */}
          {bankItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-blue-600 mb-2 border-l-4 border-blue-500 pl-2">銀行匯款明細</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>特護姓名</th>
                      <th>銀行</th>
                      <th>帳號</th>
                      <th>戶名</th>
                      <th>班數</th>
                      <th>金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankItems.map(item => (
                      <tr key={item.userId}>
                        <td>{item.name}</td>
                        <td className="text-xs">{item.bank || '-'}</td>
                        <td className="font-mono text-xs">{item.accountNo || '-'}</td>
                        <td>{item.accountName || item.name}</td>
                        <td>{item.shifts}</td>
                        <td className="font-bold text-green-700">NT$ {Math.floor(item.totalSalary).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.summary.length === 0 && (
            <div className="text-center py-12 text-gray-400">此時段無打卡紀錄</div>
          )}
        </>
      )}

      {!data && !loading && (
        <div className="text-center py-12 text-gray-400">請選擇時間範圍後點擊「計算薪資」</div>
      )}

      <div ref={printRef} />
    </div>
  );
}

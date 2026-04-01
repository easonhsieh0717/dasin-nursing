'use client';

import { useState, useEffect, useRef } from 'react';
import CaseSearchInput from '@/components/CaseSearchInput';
import { useToast } from '@/components/Toast';
import { Search, Calculator, Check, Printer, CreditCard } from 'lucide-react';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';

interface PayrollItem {
  name: string;
  userId: string;
  totalBilling: number;
  totalSalary: number;
  shifts: number;
  bank: string;
  accountNo: string;
  accountName: string;
  isPostOffice: boolean;
  caseNames: string[];
  note: string;
  advanceExpenseTotal: number;
}

interface PayrollData {
  caseName: string;
  summary: PayrollItem[];
  totalAmount: number;
  totalBilling: number;
  totalAdvanceExpenses: number;
  postOfficeCount: number;
  postOfficeAmount: number;
  bankCount: number;
  bankAmount: number;
  recordIds: string[];
  paidCount: number;
  unpaidCount: number;
}

interface CaseOption {
  id: string;
  name: string;
  code: string;
}

export default function PayrollPage() {
  const toast = useToast();
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [data, setData] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // 載入個案清單
  useEffect(() => {
    fetch('/api/admin/cases?all=true')
      .then(res => res.json())
      .then(d => setCases(d.data || []))
      .catch(() => {});
  }, []);

  const fetchPayroll = async () => {
    if (!selectedCaseId) {
      toast.error('請先選擇個案');
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ caseId: selectedCaseId });
      if (startTime) params.set('startTime', startTime);
      if (endTime) params.set('endTime', endTime);
      const res = await fetch(`/api/admin/payroll?${params}`);
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || '載入失敗');
        return;
      }
      setData(d);
    } catch {
      toast.error('載入失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!data || data.unpaidCount === 0) return;
    if (!confirm(`確定要發放 ${data.postOfficeCount + data.bankCount} 位特護共 ${data.unpaidCount} 筆紀錄？此操作無法撤銷。`)) return;

    setConfirming(true);
    try {
      const res = await fetch('/api/admin/payroll/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordIds: data.recordIds }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || '操作失敗');
        return;
      }
      toast.success(`已成功標記 ${d.count} 筆紀錄為已發放！`);
      printPostalSlips();
      printBankList();
      await fetchPayroll();
    } catch {
      toast.error('系統錯誤');
    } finally {
      setConfirming(false);
    }
  };

  const printPostalSlips = () => {
    if (!data) return;
    const postItems = data.summary.filter(s => s.isPostOffice && s.accountNo);
    if (postItems.length === 0) {
      toast.error('沒有郵局項目可列印');
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
      const amt = Math.floor(item.totalSalary + (item.advanceExpenseTotal || 0));
      const rawAcc = item.accountNo.replace(/-/g, '').padStart(14, '0');
      const accPart1 = rawAcc.slice(0, 7);
      const accPart2 = rawAcc.slice(7, 14);

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
      toast.error('沒有銀行匯款項目');
      return;
    }

    const now = new Date();
    const total = bankItems.reduce((sum, s) => sum + Math.floor(s.totalSalary + (s.advanceExpenseTotal || 0)), 0);

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
        <td style="text-align:right;">NT$ ${Math.floor(item.totalSalary + (item.advanceExpenseTotal || 0)).toLocaleString()}</td>
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
      <h2 className="text-base sm:text-xl font-bold text-[var(--color-text-primary)] mb-4">薪資發放</h2>

      {/* 個案選擇 + 日期篩選 */}
      <div className="warm-card p-3 sm:p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="font-bold text-[var(--color-primary)] text-sm whitespace-nowrap">① 選擇個案</span>
          <CaseSearchInput cases={cases} value={selectedCaseId}
            onChange={id => { setSelectedCaseId(id); setData(null); }}
            showCode placeholder="搜尋個案..." className="flex-1 min-w-[160px]" />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="font-bold text-[var(--color-primary)] text-sm whitespace-nowrap">② 日期範圍</span>
          <input type="date" value={startTime} onChange={e => setStartTime(e.target.value)}
            className="px-2 py-1 border rounded text-sm flex-1 min-w-[120px]" />
          <span className="text-sm">~</span>
          <input type="date" value={endTime} onChange={e => setEndTime(e.target.value)}
            className="px-2 py-1 border rounded text-sm flex-1 min-w-[120px]" />
          <button onClick={fetchPayroll} disabled={loading || !selectedCaseId}
            className="px-4 py-2 btn-primary text-white rounded font-bold text-sm disabled:opacity-50 flex items-center gap-1">
            <Search size={14} className="inline mr-1" />{loading ? <><Spinner size="sm" className="mr-1" />計算中...</> : '計算薪資'}
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* 個案名稱標題 */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 text-sm font-bold text-orange-800">
            個案：{data.caseName}{startTime && endTime ? ` | 期間：${startTime} ~ ${endTime}` : ''}
          </div>

          {/* Stats overview */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            <div className="warm-card p-4 border-l-4 border-blue-500">
              <div className="text-sm text-[var(--color-text-secondary)]">請款總額</div>
              <div className="text-lg sm:text-xl font-bold text-blue-700">NT$ {Math.floor(data.totalBilling || 0).toLocaleString()}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{data.summary.length} 位特護</div>
            </div>
            <div className="warm-card p-4 border-l-4 border-green-500">
              <div className="text-sm text-[var(--color-text-secondary)]">發放總額（薪資 90%）</div>
              <div className="text-xl sm:text-2xl font-bold text-[var(--color-success)]">NT$ {Math.floor(data.totalAmount).toLocaleString()}</div>
              <div className="text-xs text-[var(--color-text-muted)]">公司利潤：NT$ {Math.floor((data.totalBilling || 0) - data.totalAmount).toLocaleString()}</div>
            </div>
            {data.totalAdvanceExpenses > 0 && (
              <div className="warm-card p-4 border-l-4 border-purple-500">
                <div className="text-sm text-[var(--color-text-secondary)]">代墊費用</div>
                <div className="text-lg sm:text-xl font-bold text-purple-700">NT$ {data.totalAdvanceExpenses.toLocaleString()}</div>
                <div className="text-xs text-[var(--color-text-muted)]">實發含代墊：NT$ {Math.floor(data.totalAmount + data.totalAdvanceExpenses).toLocaleString()}</div>
              </div>
            )}
            <div className="warm-card p-4 border-l-4 border-red-400">
              <div className="text-sm text-[var(--color-text-secondary)]">郵局</div>
              <div className="text-lg sm:text-xl font-bold text-[var(--color-danger)]">NT$ {Math.floor(data.postOfficeAmount).toLocaleString()}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{data.postOfficeCount} 筆</div>
            </div>
            <div className="warm-card p-4 border-l-4 border-blue-400">
              <div className="text-sm text-[var(--color-text-secondary)]">銀行</div>
              <div className="text-lg sm:text-xl font-bold text-[var(--color-text-link)]">NT$ {Math.floor(data.bankAmount).toLocaleString()}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{data.bankCount} 筆</div>
            </div>
          </div>

          {/* 發放狀態提示 */}
          {data.paidCount > 0 && data.unpaidCount === 0 && (
            <div className="bg-green-50 border border-green-300 rounded-xl p-3 mb-4 text-sm text-green-800 font-bold">
              此期間 {data.paidCount} 筆紀錄已全部發放
            </div>
          )}
          {data.paidCount > 0 && data.unpaidCount > 0 && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-3 mb-4 text-sm text-yellow-800">
              已發放 {data.paidCount} 筆，尚有 <span className="font-bold text-[var(--color-danger)]">{data.unpaidCount} 筆未發放</span>
            </div>
          )}

          {/* Hint: missing bank info */}
          {data.summary.some(s => !s.bank && !s.accountNo) && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-3 mb-4 text-sm text-yellow-800">
              部分特護尚未設定銀行資訊，請至「<a href="/admin/nurses" className="text-[var(--color-text-link)] underline font-bold">特護管理</a>」頁面填寫銀行/郵局帳號，系統才能正確分類郵局與銀行。
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={handleConfirmPayment}
              disabled={data.unpaidCount === 0 || confirming}
              className="px-5 py-2.5 btn-success text-white rounded-lg font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex items-center gap-1">
              <Check size={14} className="inline mr-1" />{confirming ? <><Spinner size="sm" className="mr-1" />處理中...</> : `確定發放 (${data.postOfficeCount + data.bankCount} 人)`}
            </button>
            <button onClick={printPostalSlips}
              disabled={data.postOfficeCount === 0}
              className="px-4 py-2 btn-danger text-white rounded font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">
              <Printer size={14} className="inline mr-1" />列印郵局存款單 {data.postOfficeCount > 0 ? `(${data.postOfficeCount} 筆)` : ''}
            </button>
            <button onClick={printBankList}
              disabled={data.bankCount === 0}
              className="px-4 py-2 btn-primary text-white rounded font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">
              <Printer size={14} className="inline mr-1" />列印銀行匯款清單 {data.bankCount > 0 ? `(${data.bankCount} 筆)` : ''}
            </button>
          </div>

          {/* Post Office section */}
          {postItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-[var(--color-danger)] mb-2 border-l-4 border-red-500 pl-2">郵局發放明細</h3>
              <p className="text-sm text-red-700 font-bold mb-2">郵局小計：{postItems.length} 筆 | 金額總計：{Math.floor(postItems.reduce((s, i) => s + i.totalSalary, 0)).toLocaleString()} 元</p>
              {/* 手機卡片 */}
              <div className="sm:hidden space-y-2">
                {postItems.map(item => (
                  <div key={item.userId} className="warm-card p-3 border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[var(--color-text-primary)]">{item.name}</span>
                      <span className="font-bold text-[var(--color-success)]">NT$ {Math.floor(item.totalSalary + (item.advanceExpenseTotal || 0)).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] mb-1">郵局 <span className="font-mono">{item.accountNo || '-'}</span> | 戶名：{item.accountName || item.name}</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span>{item.shifts} 班</span>
                      <span>薪資 {Math.floor(item.totalSalary).toLocaleString()}</span>
                      {item.advanceExpenseTotal > 0 && <span className="text-purple-700">代墊 {item.advanceExpenseTotal.toLocaleString()}</span>}
                    </div>
                    {item.note && <div className="text-xs text-[var(--color-text-muted)] mt-1">{item.note}</div>}
                  </div>
                ))}
              </div>
              {/* 桌面表格 */}
              <div className="hidden sm:block">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>特護全名</th>
                      <th>帳戶名稱</th>
                      <th>銀行</th>
                      <th>帳號</th>
                      <th>班數</th>
                      <th>薪資</th>
                      <th>代墊</th>
                      <th>實發</th>
                      <th>備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    {postItems.map(item => (
                      <tr key={item.userId}>
                        <td>{item.name}</td>
                        <td>{item.accountName || item.name}</td>
                        <td>郵局</td>
                        <td className="font-mono text-xs">{item.accountNo || '-'}</td>
                        <td className="text-center">{item.shifts}</td>
                        <td className="text-right">{Math.floor(item.totalSalary).toLocaleString()}</td>
                        <td className="text-right text-purple-700">{item.advanceExpenseTotal > 0 ? item.advanceExpenseTotal.toLocaleString() : '-'}</td>
                        <td className="font-bold text-right text-[var(--color-success)]">{Math.floor(item.totalSalary + (item.advanceExpenseTotal || 0)).toLocaleString()}</td>
                        <td className="text-xs text-[var(--color-text-secondary)]">{item.note || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
            </div>
          )}

          {/* Bank section */}
          {bankItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-[var(--color-text-link)] mb-2 border-l-4 border-blue-500 pl-2">銀行匯款明細</h3>
              <p className="text-sm text-blue-700 font-bold mb-2">銀行小計：{bankItems.length} 筆 | 金額總計：{Math.floor(bankItems.reduce((s, i) => s + i.totalSalary, 0)).toLocaleString()} 元</p>
              {/* 手機卡片 */}
              <div className="sm:hidden space-y-2">
                {bankItems.map(item => (
                  <div key={item.userId} className="warm-card p-3 border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[var(--color-text-primary)]">{item.name}</span>
                      <span className="font-bold text-[var(--color-success)]">NT$ {Math.floor(item.totalSalary + (item.advanceExpenseTotal || 0)).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] mb-1">{item.bank || '-'} <span className="font-mono">{item.accountNo || '-'}</span> | 戶名：{item.accountName || item.name}</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span>{item.shifts} 班</span>
                      <span>薪資 {Math.floor(item.totalSalary).toLocaleString()}</span>
                      {item.advanceExpenseTotal > 0 && <span className="text-purple-700">代墊 {item.advanceExpenseTotal.toLocaleString()}</span>}
                    </div>
                    {item.note && <div className="text-xs text-[var(--color-text-muted)] mt-1">{item.note}</div>}
                  </div>
                ))}
              </div>
              {/* 桌面表格 */}
              <div className="hidden sm:block">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>特護全名</th>
                      <th>帳戶名稱</th>
                      <th>銀行</th>
                      <th>帳號</th>
                      <th>班數</th>
                      <th>薪資</th>
                      <th>代墊</th>
                      <th>實發</th>
                      <th>備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankItems.map(item => (
                      <tr key={item.userId}>
                        <td>{item.name}</td>
                        <td>{item.accountName || item.name}</td>
                        <td className="text-xs">{item.bank || '-'}</td>
                        <td className="font-mono text-xs">{item.accountNo || '-'}</td>
                        <td className="text-center">{item.shifts}</td>
                        <td className="text-right">{Math.floor(item.totalSalary).toLocaleString()}</td>
                        <td className="text-right text-purple-700">{item.advanceExpenseTotal > 0 ? item.advanceExpenseTotal.toLocaleString() : '-'}</td>
                        <td className="font-bold text-right text-[var(--color-success)]">{Math.floor(item.totalSalary + (item.advanceExpenseTotal || 0)).toLocaleString()}</td>
                        <td className="text-xs text-[var(--color-text-secondary)]">{item.note || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
            </div>
          )}

          {data.summary.length === 0 && (
            <EmptyState icon={CreditCard} title="此個案在此期間無打卡紀錄" />
          )}
        </>
      )}

      {!data && !loading && (
        <EmptyState icon={Calculator} title="請選擇個案與日期範圍後點擊「計算薪資」" />
      )}

      <div ref={printRef} />
    </div>
  );
}

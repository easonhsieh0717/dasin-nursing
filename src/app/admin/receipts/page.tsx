'use client';

import { useState, useEffect } from 'react';
import CaseSearchInput from '@/components/CaseSearchInput';
import { useToast } from '@/components/Toast';
import { Search, Plus, Printer, Download, Save, Trash2, Pencil, Receipt } from 'lucide-react';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';

interface CaseItem { id: string; name: string; code: string; }
interface ReceiptItem {
  id: string; serialNumber: string; caseId: string; recipientName: string;
  serviceLocation: string; serviceStartDate: string; serviceEndDate: string;
  serviceDays: number; serviceAmount: number; transportationFee: number;
  advanceExpenseTotal: number; advanceExpenseItems: string;
  totalAmount: number; dispatchCompany: string; receiptDate: string;
  note: string; status: string;
}
interface CalcResult { serviceDays: number; serviceAmount: number; records: Array<{ date: string; hours: number; amount: number }>; advanceExpenses?: Record<string, number>; advanceExpenseTotal?: number; }

function toChineseAmount(amt: number): string {
  if (amt === 0) return '零元整';
  const digits = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'];
  const bigUnits = ['', '萬', '億'];
  let remaining = Math.floor(amt);
  const segments: number[] = [];
  while (remaining > 0) { segments.push(remaining % 10000); remaining = Math.floor(remaining / 10000); }
  let result = '';
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (seg === 0) { if (result && i > 0) result += '零'; continue; }
    const q = Math.floor(seg / 1000), b = Math.floor((seg % 1000) / 100);
    const s = Math.floor((seg % 100) / 10), y = seg % 10;
    if (q > 0) result += digits[q] + '仟';
    else if (i < segments.length - 1 && seg < 1000) result += '零';
    if (b > 0) result += digits[b] + '佰';
    else if (q > 0 && (s > 0 || y > 0)) result += '零';
    if (s > 0) result += digits[s] + '拾';
    else if (b > 0 && y > 0) result += '零';
    if (y > 0) result += digits[y];
    result += bigUnits[i] || '';
  }
  return result + '元整';
}

export default function ReceiptsPage() {
  const toast = useToast();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter
  const [filterCaseId, setFilterCaseId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    caseId: '', recipientName: '', serviceLocation: '',
    serviceStartDate: '', serviceEndDate: '',
    serviceDays: 0, serviceAmount: 0, transportationFee: 0,
    advanceExpenseTotal: 0, advanceExpenseItems: '[]',
    totalAmount: 0, dispatchCompany: '達心特護',
    receiptDate: new Date().toISOString().slice(0, 10),
    note: '',
  });
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);

  // 載入個案列表
  useEffect(() => {
    fetch('/api/admin/cases')
      .then(r => r.json())
      .then(d => setCases(d.data || d || []))
      .catch(() => {});
  }, []);

  // 查詢收據
  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCaseId) params.set('caseId', filterCaseId);
      if (filterStartDate) params.set('startDate', filterStartDate);
      if (filterEndDate) params.set('endDate', filterEndDate);
      const res = await fetch(`/api/admin/receipts?${params}`);
      const d = await res.json();
      setReceipts(d.data || []);
    } catch { toast.error('載入失敗'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReceipts(); }, []);

  // 計算服務金額
  const handleCalc = async () => {
    if (!form.caseId || !form.serviceStartDate || !form.serviceEndDate) {
      toast.error('請先選擇個案和服務期間');
      return;
    }
    setCalculating(true);
    try {
      const params = new URLSearchParams({
        caseId: form.caseId,
        startDate: form.serviceStartDate,
        endDate: form.serviceEndDate,
      });
      const res = await fetch(`/api/admin/receipts/calculate?${params}`);
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || '計算失敗'); return; }
      setCalcResult(d);
      const advTotal = d.advanceExpenseTotal || 0;
      const advItems = d.advanceExpenses ? JSON.stringify(Object.entries(d.advanceExpenses).map(([type, amount]) => ({ type, amount }))) : '[]';
      setForm(f => ({
        ...f,
        serviceDays: d.serviceDays,
        serviceAmount: d.serviceAmount,
        advanceExpenseTotal: advTotal,
        advanceExpenseItems: advItems,
        totalAmount: d.serviceAmount + f.transportationFee + advTotal,
      }));
    } catch { toast.error('計算失敗'); }
    finally { setCalculating(false); }
  };

  // 車馬費變更時自動更新總金額
  const handleTransportChange = (val: string) => {
    const fee = parseInt(val) || 0;
    setForm(f => ({ ...f, transportationFee: fee, totalAmount: f.serviceAmount + fee + f.advanceExpenseTotal }));
  };

  // 開啟新增
  const openAdd = () => {
    setEditingId(null);
    setForm({
      caseId: '', recipientName: '', serviceLocation: '',
      serviceStartDate: '', serviceEndDate: '',
      serviceDays: 0, serviceAmount: 0, transportationFee: 0,
      advanceExpenseTotal: 0, advanceExpenseItems: '[]',
      totalAmount: 0, dispatchCompany: '達心特護',
      receiptDate: new Date().toISOString().slice(0, 10),
      note: '',
    });
    setCalcResult(null);
    setShowModal(true);
  };

  // 開啟編輯
  const openEdit = (r: ReceiptItem) => {
    setEditingId(r.id);
    setForm({
      caseId: r.caseId, recipientName: r.recipientName,
      serviceLocation: r.serviceLocation,
      serviceStartDate: r.serviceStartDate, serviceEndDate: r.serviceEndDate,
      serviceDays: r.serviceDays, serviceAmount: r.serviceAmount,
      transportationFee: r.transportationFee, totalAmount: r.totalAmount,
      advanceExpenseTotal: (r as any).advanceExpenseTotal || 0,
      advanceExpenseItems: r.advanceExpenseItems || '[]',
      dispatchCompany: r.dispatchCompany,
      receiptDate: r.receiptDate, note: r.note,
    });
    setCalcResult(null);
    setShowModal(true);
  };

  // 儲存
  const handleSave = async () => {
    if (!form.caseId || !form.serviceStartDate || !form.serviceEndDate) {
      toast.error('請填寫必要欄位（個案、服務期間）');
      return;
    }
    setSaving(true);
    try {
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { id: editingId, ...form } : form;
      const res = await fetch('/api/admin/receipts', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || '儲存失敗');
        return;
      }
      setShowModal(false);
      fetchReceipts();
    } catch { toast.error('儲存失敗'); }
    finally { setSaving(false); }
  };

  // 刪除
  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此收據？')) return;
    try {
      const res = await fetch(`/api/admin/receipts?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('刪除失敗'); return; }
      fetchReceipts();
    } catch { toast.error('刪除失敗'); }
  };

  // 產生收據內容 HTML（共用，列印 / 下載都用）
  const buildReceiptBody = (r: ReceiptItem) => {
    const caseName = cases.find(c => c.id === r.caseId)?.name || '';
    const now = new Date(r.receiptDate);
    const rocYear = now.getFullYear() - 1911;
    const month = now.getMonth() + 1;
    const day = now.getDate();

    const startD = new Date(r.serviceStartDate);
    const endD = new Date(r.serviceEndDate);
    const startStr = `${startD.getFullYear() - 1911}年${startD.getMonth() + 1}月${startD.getDate()}日`;
    const endStr = `${endD.getFullYear() - 1911}年${endD.getMonth() + 1}月${endD.getDate()}日`;

    const chineseTotal = toChineseAmount(r.totalAmount);

    let advRows = '';
    try {
      const items = JSON.parse(r.advanceExpenseItems || '[]') as Array<{ type: string; amount: number }>;
      advRows = items.map(item => `<tr><td>${item.type}</td><td class="amount-cell">NT$ ${item.amount.toLocaleString()}</td></tr>`).join('');
    } catch { /* ignore */ }

    return `
      <div class="serial"><span class="serial-label">編號：</span>${r.serialNumber}</div>
      <div class="receipt-title">服務費收據</div>
      <div class="section">
        <div class="field-row"><div class="field-label">個案姓名：</div><div class="field-value">${caseName}</div></div>
        ${r.serviceLocation ? `<div class="field-row"><div class="field-label">服務地點：</div><div class="field-value">${r.serviceLocation}</div></div>` : ''}
        <div class="field-row"><div class="field-label">服務期間：</div><div class="field-value">${startStr} 至 ${endStr}（共 ${r.serviceDays} 天）</div></div>
      </div>
      <table class="amount-table"><thead><tr><th>項目</th><th>金額</th></tr></thead><tbody>
        <tr><td>服務費</td><td class="amount-cell">NT$ ${r.serviceAmount.toLocaleString()}</td></tr>
        ${r.transportationFee > 0 ? `<tr><td>車馬費</td><td class="amount-cell">NT$ ${r.transportationFee.toLocaleString()}</td></tr>` : ''}
        ${advRows}
        <tr class="total-row"><td>合計</td><td class="amount-cell" style="font-size:16px; color:#c00;">NT$ ${r.totalAmount.toLocaleString()}</td></tr>
      </tbody></table>
      <div class="chinese-amount">新臺幣 <span>${chineseTotal}</span></div>
      ${r.note ? `<div style="font-size:12px; color:#555; margin:4px 0;">備註：${r.note}</div>` : ''}
      <div class="footer"><div class="company">${r.dispatchCompany}</div><div class="date">中華民國 ${rocYear} 年 ${month} 月 ${day} 日</div></div>
      <div class="disclaimer">此收據僅作為費用收取之證明，不作為其他用途。如有疑問請洽派遣公司。</div>`;
  };

  const receiptStyles = `
    body { margin: 0; padding: 0; font-family: 'Microsoft JhengHei', '微軟正黑體', '標楷體', sans-serif; color: #333; }
    .receipt { width: 680px; margin: 0 auto; border: 1.5px solid #333; padding: 36px 44px 30px 44px; position: relative; box-sizing: border-box; }
    .receipt-title { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 10px; letter-spacing: 6px; border-bottom: 1.5px solid #333; padding-bottom: 8px; }
    .serial { position: absolute; top: 36px; right: 44px; font-size: 12px; color: #666; }
    .serial-label { font-weight: bold; }
    .section { margin-bottom: 6px; font-size: 14px; line-height: 1.8; }
    .field-row { display: flex; margin-bottom: 3px; align-items: baseline; }
    .field-label { min-width: 80px; font-weight: bold; font-size: 14px; }
    .field-value { flex: 1; border-bottom: 1px solid #999; padding: 0 6px; font-size: 14px; }
    .amount-table { width: 100%; border-collapse: collapse; margin: 6px 0; }
    .amount-table th, .amount-table td { border: 1px solid #666; padding: 5px 10px; text-align: center; font-size: 13px; }
    .amount-table th { background: #f0f0f0; font-weight: bold; }
    .amount-table .amount-cell { text-align: right; font-family: 'Courier New', monospace; font-size: 14px; }
    .total-row { font-weight: bold; background: #f8f8f8; }
    .chinese-amount { text-align: center; font-size: 14px; margin: 5px 0; padding: 5px; background: #f9f9f9; border: 1px solid #ccc; border-radius: 3px; }
    .chinese-amount span { font-weight: bold; color: #c00; }
    .footer { margin-top: 10px; display: flex; justify-content: space-between; align-items: flex-end; }
    .company { font-size: 16px; font-weight: bold; }
    .date { font-size: 13px; color: #555; }
    .disclaimer { margin-top: 8px; font-size: 10px; color: #999; border-top: 1px dashed #ccc; padding-top: 5px; }`;

  // 列印收據
  const printReceipt = (r: ReceiptItem) => {
    const body = buildReceiptBody(r);
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>服務費收據</title>
    <style>
      ${receiptStyles}
      .page-wrap { padding: 50px 15mm 10mm 15mm; }
      .receipt { width: 180mm; height: 128mm; padding: 10mm 12mm 8mm 12mm; }
      .toolbar { padding: 8px 20px; text-align: center; background: #f5f5f5; border-bottom: 1px solid #ddd; position: fixed; top: 0; left: 0; right: 0; z-index: 100; }
      .toolbar button { padding: 8px 24px; margin: 0 8px; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: bold; }
      .btn-print { background: #1565c0; color: white; }
      .btn-download { background: #2e7d32; color: white; }
      .btn-close { background: #757575; color: white; }
      @media (max-width: 600px) {
        .page-wrap { padding: 50px 5mm 5mm 5mm; }
        .receipt { width: auto; height: auto; padding: 8mm; }
        .toolbar button { display: block; width: 90%; margin: 8px auto; padding: 14px 0; font-size: 18px; }
      }
      @media print { .toolbar { display: none; } .page-wrap { padding: 0 15mm; } }
    </style></head><body>
    <div class="toolbar">
      <button class="btn-print" onclick="window.print()">列印</button>
      <button class="btn-close" onclick="window.close()">關閉視窗</button>
    </div>
    <div class="page-wrap"><div class="receipt">${body}</div></div>
    </body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  // 下載收據為 PDF
  const downloadReceipt = async (r: ReceiptItem) => {
    const body = buildReceiptBody(r);

    // 建立隱藏容器渲染收據
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;background:white;';
    container.innerHTML = `<style>${receiptStyles}</style><div class="receipt">${body}</div>`;
    document.body.appendChild(container);

    try {
      const { default: html2canvas } = await import('html2canvas-pro');
      const { jsPDF } = await import('jspdf');

      const receiptEl = container.querySelector('.receipt') as HTMLElement;
      const canvas = await html2canvas(receiptEl, { scale: 2, backgroundColor: '#ffffff', useCORS: true });

      // A4 橫向放置收據（收據寬 > 高）
      const imgW = canvas.width;
      const imgH = canvas.height;
      const pdfW = 210; // A4 寬 mm
      const pdfH = 297; // A4 高 mm
      const margin = 15;
      const maxW = pdfW - margin * 2;
      const maxH = pdfH - margin * 2;
      const ratio = Math.min(maxW / imgW, maxH / imgH);
      const w = imgW * ratio;
      const h = imgH * ratio;
      const x = (pdfW - w) / 2;
      const y = margin;

      const pdf = new jsPDF('portrait', 'mm', 'a4');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, w, h);

      const caseName = cases.find(c => c.id === r.caseId)?.name || '';
      pdf.save(`收據_${caseName}_${r.serialNumber}.pdf`);
    } catch (err) {
      console.error('PDF 下載失敗:', err);
      toast.error('PDF 下載失敗，請改用列印功能');
    } finally {
      document.body.removeChild(container);
    }
  };

  const getCaseName = (caseId: string) => cases.find(c => c.id === caseId)?.name || '未知';

  return (
    <div className="p-3 sm:p-6">
      <h2 className="text-base sm:text-xl font-bold text-[var(--color-text-primary)] mb-4">收據管理</h2>

      {/* 篩選區 */}
      <div className="warm-card p-3 sm:p-4 mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex-1 min-w-[160px] max-w-[280px]">
          <CaseSearchInput cases={cases} value={filterCaseId} onChange={setFilterCaseId} placeholder="搜尋個案..." />
        </div>
        <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)}
          className="px-2 py-1 border rounded text-sm flex-1 min-w-[120px]" />
        <span className="text-sm">~</span>
        <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)}
          className="px-2 py-1 border rounded text-sm flex-1 min-w-[120px]" />
        <button onClick={fetchReceipts} disabled={loading}
          className="px-4 py-2 btn-primary text-white rounded font-bold text-sm disabled:opacity-50">
          <Search size={14} className="inline mr-1" />{loading ? <><Spinner size="sm" className="mr-1" />查詢中...</> : '查詢'}
        </button>
        <button onClick={openAdd}
          className="px-4 py-2 btn-success text-white rounded font-bold text-sm">
          <Plus size={14} className="inline mr-1" />新增收據
        </button>
      </div>

      {/* 收據列表 */}
      {receipts.length === 0 ? (
        <EmptyState icon={Receipt} title="尚無收據紀錄" description="請新增收據或調整查詢條件" />
      ) : (
        <>
          {/* 手機版：卡片 */}
          <div className="sm:hidden space-y-2">
            {receipts.map(r => (
              <div key={r.id} className="warm-card p-3 border">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-[var(--color-text-primary)]">{getCaseName(r.caseId)}</span>
                  <span className="font-bold text-[var(--color-success)]">NT$ {r.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 text-xs text-[var(--color-text-secondary)] mb-1.5">
                  <span className="font-mono">{r.serialNumber}</span>
                  <span>{r.serviceStartDate} ~ {r.serviceEndDate}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 text-xs text-[var(--color-text-muted)] mb-2">
                  <span>服務費 {r.serviceAmount.toLocaleString()}</span>
                  {r.transportationFee > 0 && <span>車馬費 {r.transportationFee.toLocaleString()}</span>}
                  {r.advanceExpenseTotal > 0 && <span>代墊 {r.advanceExpenseTotal.toLocaleString()}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => printReceipt(r)} className="px-3 py-1 btn-primary text-white rounded text-xs"><Printer size={14} className="inline mr-1" />列印</button>
                  <button onClick={() => downloadReceipt(r)} className="px-3 py-1 btn-success text-white rounded text-xs"><Download size={14} className="inline mr-1" />下載</button>
                  <button onClick={() => openEdit(r)} className="px-3 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"><Pencil size={14} className="inline mr-1" />編輯</button>
                  <button onClick={() => handleDelete(r.id)} className="px-3 py-1 btn-danger text-white rounded text-xs"><Trash2 size={14} className="inline mr-1" />刪除</button>
                </div>
              </div>
            ))}
          </div>
          {/* 桌面版：表格 */}
          <div className="hidden sm:block warm-card overflow-hidden">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>編號</th><th>個案</th><th>服務期間</th><th>服務費</th>
                    <th>車馬費</th><th>代墊</th><th>合計</th><th>收據日期</th><th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map(r => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs">{r.serialNumber}</td>
                      <td>{getCaseName(r.caseId)}</td>
                      <td className="text-xs">{r.serviceStartDate} ~ {r.serviceEndDate}</td>
                      <td className="text-right">{r.serviceAmount.toLocaleString()}</td>
                      <td className="text-right">{r.transportationFee > 0 ? r.transportationFee.toLocaleString() : '-'}</td>
                      <td className="text-right">{r.advanceExpenseTotal > 0 ? r.advanceExpenseTotal.toLocaleString() : '-'}</td>
                      <td className="text-right font-bold text-[var(--color-success)]">{r.totalAmount.toLocaleString()}</td>
                      <td className="text-xs">{r.receiptDate}</td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => printReceipt(r)} className="px-2 py-1 btn-primary text-white rounded text-xs"><Printer size={14} className="inline mr-1" />列印</button>
                          <button onClick={() => downloadReceipt(r)} className="px-2 py-1 btn-success text-white rounded text-xs"><Download size={14} className="inline mr-1" />下載</button>
                          <button onClick={() => openEdit(r)} className="px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"><Pencil size={14} className="inline mr-1" />編輯</button>
                          <button onClick={() => handleDelete(r.id)} className="px-2 py-1 btn-danger text-white rounded text-xs"><Trash2 size={14} className="inline mr-1" />刪除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 新增/編輯 Modal */}
      {showModal && (
        <div className="modal-overlay p-2 sm:p-4">
          <div className="modal-content warm-card w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="p-3 sm:p-5">
              <h3 className="text-base font-bold mb-3">{editingId ? '編輯收據' : '新增收據'}</h3>

              {/* 個案 + 服務期間 + 計算 */}
              <div className="bg-blue-50 border border-blue-200 rounded p-2.5 mb-3">
                <div className="text-xs font-bold text-blue-700 mb-1.5">① 選擇個案與服務期間</div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)]">個案 *</label>
                    <CaseSearchInput cases={cases} value={form.caseId}
                      onChange={id => setForm(f => ({ ...f, caseId: id }))}
                      disabled={!!editingId} placeholder="搜尋個案..." />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)]">開始日期 *</label>
                    <input type="date" value={form.serviceStartDate}
                      onChange={e => setForm(f => ({ ...f, serviceStartDate: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)]">結束日期 *</label>
                    <input type="date" value={form.serviceEndDate}
                      onChange={e => setForm(f => ({ ...f, serviceEndDate: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleCalc} disabled={calculating}
                    className="px-3 py-1 btn-primary text-white rounded text-xs font-bold disabled:opacity-50">
                    {calculating ? <><Spinner size="sm" className="mr-1" />計算中...</> : <><Search size={14} className="inline mr-1" />計算服務金額</>}
                  </button>
                  {calcResult && (
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      → {calcResult.serviceDays} 天 / {calcResult.records.length} 筆 /
                      <span className="font-bold text-[var(--color-success)]"> NT$ {calcResult.serviceAmount.toLocaleString()}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* 收據內容 */}
              <div className="bg-orange-50 border border-orange-200 rounded p-2.5 mb-3">
                <div className="text-xs font-bold text-[var(--color-primary)] mb-1.5">② 收據資訊</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)]">服務地點</label>
                    <input type="text" value={form.serviceLocation}
                      onChange={e => setForm(f => ({ ...f, serviceLocation: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm" placeholder="選填" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)]">派遣公司</label>
                    <input type="text" value={form.dispatchCompany}
                      onChange={e => setForm(f => ({ ...f, dispatchCompany: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)]">收據日期</label>
                    <input type="date" value={form.receiptDate}
                      onChange={e => setForm(f => ({ ...f, receiptDate: e.target.value }))}
                      className="w-full px-2 py-1 border rounded text-sm" />
                  </div>
                </div>
              </div>

              {/* 金額 */}
              <div className="bg-green-50 border border-green-200 rounded p-2.5 mb-3">
                <div className="text-xs font-bold text-[var(--color-success)] mb-1.5">③ 金額明細</div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)]">天數</label>
                    <input type="number" value={form.serviceDays}
                      onChange={e => setForm(f => ({ ...f, serviceDays: parseInt(e.target.value) || 0 }))}
                      className="w-full px-2 py-1 border rounded text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)]">服務費</label>
                    <input type="number" value={form.serviceAmount}
                      onChange={e => {
                        const amt = parseInt(e.target.value) || 0;
                        setForm(f => ({ ...f, serviceAmount: amt, totalAmount: amt + f.transportationFee + f.advanceExpenseTotal }));
                      }}
                      className="w-full px-2 py-1 border rounded text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)]">車馬費</label>
                    <input type="number" value={form.transportationFee}
                      onChange={e => handleTransportChange(e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)]">合計</label>
                    <input type="number" value={form.totalAmount} readOnly
                      className="w-full px-2 py-1 border rounded text-sm bg-green-100 font-bold text-green-800" />
                  </div>
                </div>
                {form.totalAmount > 0 && (
                  <div className="text-center text-xs text-[var(--color-text-secondary)] mt-1.5">
                    新臺幣 <span className="font-bold text-[var(--color-danger)]">{toChineseAmount(form.totalAmount)}</span>
                  </div>
                )}
              </div>

              {/* 代墊費用明細 */}
              {form.advanceExpenseTotal > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded p-2.5 mb-3">
                  <div className="text-xs font-bold text-purple-700 mb-1.5">④ 代墊費用（已核准）</div>
                  <div className="space-y-1">
                    {(() => {
                      try {
                        const items = JSON.parse(form.advanceExpenseItems) as Array<{ type: string; amount: number }>;
                        return items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-[var(--color-text-secondary)]">{item.type}</span>
                            <span className="font-bold">NT$ {item.amount.toLocaleString()}</span>
                          </div>
                        ));
                      } catch { return null; }
                    })()}
                    <div className="flex justify-between text-sm font-bold text-purple-800 border-t border-purple-200 pt-1 mt-1">
                      <span>代墊小計</span>
                      <span>NT$ {form.advanceExpenseTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 備註 */}
              <div className="mb-3">
                <label className="text-xs text-[var(--color-text-secondary)]">備註</label>
                <input type="text" value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className="w-full px-2 py-1 border rounded text-sm" placeholder="選填" />
              </div>

              {/* 按鈕 */}
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-primary-border)]">
                <button onClick={() => setShowModal(false)}
                  className="px-4 py-1.5 bg-[var(--color-text-muted)] text-white rounded text-sm hover:opacity-80">取消</button>
                <button onClick={handleSave} disabled={saving}
                  className="px-5 py-1.5 btn-success text-white rounded font-bold text-sm disabled:opacity-50">
                  {saving ? <><Spinner size="sm" className="mr-1" />儲存中...</> : <><Save size={14} className="inline mr-1" />儲存</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import EmployeeNav from '@/components/EmployeeNav';
import { useToast } from '@/components/Toast';
import EmptyState from '@/components/EmptyState';
import Spinner from '@/components/Spinner';
import { Wallet } from 'lucide-react';

interface ExpenseItem {
  id: string; expenseType: string; amount: number; description: string;
  imageUrl: string | null; status: string; expenseDate: string; createdAt: string;
}

const TYPE_LABELS: Record<string, string> = { meal: '餐費', transport: '車資', advance: '代墊費', other: '其它' };
const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '待審核', color: '#8b7b76', bg: '#f0e6e4' },
  approved: { label: '已通過', color: '#3d7a47', bg: '#e8f5ea' },
  rejected: { label: '已拒絕', color: '#b5403d', bg: '#fce8e8' },
};

export default function ExpensesPage() {
  const router = useRouter();
  const toast = useToast();
  const [caseName, setCaseName] = useState('');
  const [caseId, setCaseId] = useState('');
  const [nurseName, setNurseName] = useState('');
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [expenseType, setExpenseType] = useState('meal');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/clock/status').then(r => r.json()).then(d => {
      setCaseName(d.defaultCaseName || '—');
      setCaseId(d.defaultCaseId || '');
    }).catch(() => {});
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setNurseName(d.name || '');
    }).catch(() => {});
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/expenses');
      const d = await res.json();
      setExpenses(d.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchExpenses(); }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast.error('圖片大小不可超過 4MB'); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId) { toast.error('尚未指定個案'); return; }
    if (!amount || parseInt(amount) <= 0) { toast.error('請輸入正確金額'); return; }
    if (expenseType === 'other' && !description.trim()) { toast.error('選擇「其它」時請填寫說明'); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('caseId', caseId);
      fd.append('expenseType', expenseType);
      fd.append('amount', amount);
      fd.append('description', description);
      fd.append('expenseDate', expenseDate);
      if (imageFile) fd.append('image', imageFile);

      const res = await fetch('/api/expenses', { method: 'POST', body: fd });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || '提交失敗');
        return;
      }
      toast.success('提交成功！');
      setAmount(''); setDescription(''); setImageFile(null); setImagePreview('');
      if (fileRef.current) fileRef.current.value = '';
      fetchExpenses();
    } catch { toast.error('系統錯誤'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <EmployeeNav />

      <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
        {/* 提交表單 */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(180,120,100,0.08)', border: '1px solid #f0ddd8' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', color: '#4a3733' }}>申請代墊費用</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#8b7b76' }}>個案</label>
                <div style={{ padding: '8px 12px', backgroundColor: '#fce8e4', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold', color: '#e8776f' }}>{caseName}</div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#8b7b76' }}>特護</label>
                <div style={{ padding: '8px 12px', backgroundColor: '#fce8e4', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold', color: '#4a3733' }}>{nurseName}</div>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#8b7b76' }}>費用類型 *</label>
              <select value={expenseType} onChange={e => setExpenseType(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #f0ddd8', borderRadius: '10px', fontSize: '14px', color: '#4a3733' }}>
                <option value="meal">餐費</option>
                <option value="transport">車資</option>
                <option value="advance">代墊費</option>
                <option value="other">其它</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#8b7b76' }}>金額 *</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0" min="1" style={{ width: '100%', padding: '8px 12px', border: '1px solid #f0ddd8', borderRadius: '10px', fontSize: '14px', color: '#4a3733' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#8b7b76' }}>費用日期 *</label>
                <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #f0ddd8', borderRadius: '10px', fontSize: '14px', color: '#4a3733' }} />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#8b7b76' }}>說明 {expenseType === 'other' ? '*' : '（選填）'}</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="簡述費用內容" style={{ width: '100%', padding: '8px 12px', border: '1px solid #f0ddd8', borderRadius: '10px', fontSize: '14px', color: '#4a3733' }} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: '#8b7b76' }}>收據照片（選填，最大 4MB）</label>
              <input type="file" accept="image/*" capture="environment" ref={fileRef}
                onChange={handleImageChange}
                style={{ width: '100%', padding: '6px', border: '1px solid #f0ddd8', borderRadius: '10px', fontSize: '13px' }} />
              {imagePreview && (
                <div style={{ marginTop: '8px', position: 'relative', display: 'inline-block' }}>
                  <img src={imagePreview} alt="preview" style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #f0ddd8' }} />
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(''); if (fileRef.current) fileRef.current.value = ''; }}
                    style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#d9534f', color: 'white', fontSize: '12px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                </div>
              )}
            </div>

            <button type="submit" disabled={submitting}
              style={{ width: '100%', padding: '12px', backgroundColor: submitting ? '#b0a09a' : '#e8776f', color: 'white', fontWeight: 'bold', fontSize: '15px', borderRadius: '12px', border: 'none', cursor: submitting ? 'default' : 'pointer', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {submitting ? <Spinner size="sm" /> : '送出申請'}
            </button>
          </form>
        </div>

        {/* 已提交列表 */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 12px rgba(180,120,100,0.08)', border: '1px solid #f0ddd8' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: '#4a3733' }}>我的申請紀錄</h3>
          {loading && <div style={{ textAlign: 'center', padding: '20px' }}><Spinner size="md" /></div>}
          {!loading && expenses.length === 0 && (
            <EmptyState icon={Wallet} title="尚無申請紀錄" description="提交代墊費用後會顯示在這裡" />
          )}
          {expenses.map(exp => {
            const st = STATUS_LABELS[exp.status] || STATUS_LABELS.pending;
            return (
              <div key={exp.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0ddd8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>
                    <span style={{ backgroundColor: '#fce8e4', padding: '2px 6px', borderRadius: '8px', fontSize: '12px', marginRight: '6px', color: '#8b5550' }}>{TYPE_LABELS[exp.expenseType] || exp.expenseType}</span>
                    <span style={{ fontWeight: 'bold', color: '#4a3733' }}>NT$ {exp.amount.toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#8b7b76', marginTop: '2px' }}>
                    {exp.expenseDate} {exp.description && `· ${exp.description}`}
                  </div>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: st.color, padding: '2px 10px', borderRadius: '999px', backgroundColor: st.bg }}>
                  {st.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

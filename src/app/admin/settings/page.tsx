'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { Plus, Save, Trash2, Pencil, Settings as SettingsIcon } from 'lucide-react';
import { SkeletonCard, SkeletonTable } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';

interface RateSettings {
  id: string;
  effectiveDate: string;
  label: string;
  mainDayRate: number;
  mainNightRate: number;
  otherDayRate: number;
  otherNightRate: number;
  fullDayRate24h: number;
  minBillingHours: number;
  remoteAreaSubsidy: number;
  dialysisVisitFee: number;
  dialysisOvertimeRate: number;
}

const defaultForm = {
  effectiveDate: '', label: '',
  mainDayRate: '490', mainNightRate: '530',
  otherDayRate: '550', otherNightRate: '600',
  fullDayRate24h: '12240', minBillingHours: '8',
  remoteAreaSubsidy: '500', dialysisVisitFee: '3000',
  dialysisOvertimeRate: '500',
};

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<RateSettings[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RateSettings | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      setSettings(data.data || []);
    } catch {
      toast.error('載入失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = (rs: RateSettings) => {
    setEditing(rs);
    setForm({
      effectiveDate: rs.effectiveDate,
      label: rs.label,
      mainDayRate: rs.mainDayRate.toString(),
      mainNightRate: rs.mainNightRate.toString(),
      otherDayRate: rs.otherDayRate.toString(),
      otherNightRate: rs.otherNightRate.toString(),
      fullDayRate24h: rs.fullDayRate24h.toString(),
      minBillingHours: rs.minBillingHours.toString(),
      remoteAreaSubsidy: rs.remoteAreaSubsidy.toString(),
      dialysisVisitFee: rs.dialysisVisitFee.toString(),
      dialysisOvertimeRate: rs.dialysisOvertimeRate.toString(),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const body = {
      ...(editing ? { id: editing.id } : {}),
      effectiveDate: form.effectiveDate,
      label: form.label,
      mainDayRate: parseFloat(form.mainDayRate),
      mainNightRate: parseFloat(form.mainNightRate),
      otherDayRate: parseFloat(form.otherDayRate),
      otherNightRate: parseFloat(form.otherNightRate),
      fullDayRate24h: parseFloat(form.fullDayRate24h),
      minBillingHours: parseFloat(form.minBillingHours),
      remoteAreaSubsidy: parseFloat(form.remoteAreaSubsidy),
      dialysisVisitFee: parseFloat(form.dialysisVisitFee),
      dialysisOvertimeRate: parseFloat(form.dialysisOvertimeRate),
    };

    const res = await fetch('/api/admin/settings', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || '儲存失敗');
      return;
    }
    toast.success(editing ? '已更新' : '已新增');
    setShowModal(false);
    fetchSettings();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此費率設定？')) return;
    const res = await fetch(`/api/admin/settings?id=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || '刪除失敗');
      return;
    }
    toast.success('已刪除');
    fetchSettings();
  };

  const F = ({ label, field, unit = '元' }: { label: string; field: string; unit?: string }) => (
    <div className="flex items-center gap-2 mb-1">
      <label className="w-32 sm:w-48 text-xs sm:text-sm font-bold text-[var(--color-text-primary)] shrink-0">{label}</label>
      <input
        type="number"
        value={form[field as keyof typeof form]}
        onChange={e => setForm({ ...form, [field]: e.target.value })}
        className="w-24 sm:w-32 px-2 sm:px-3 py-1.5 sm:py-2 border rounded text-right text-sm"
      />
      <span className="text-xs sm:text-sm text-[var(--color-text-secondary)]">{unit}</span>
    </div>
  );

  return (
    <div className="p-3 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-base sm:text-xl font-bold text-[var(--color-text-primary)]">費率設定</h2>
        <button onClick={openAdd} className="px-3 sm:px-4 py-2 btn-success text-white rounded font-bold text-sm flex items-center gap-1">
          <Plus size={14} />新增費率版本
        </button>
      </div>

      {/* Current settings display */}
      {!loading && settings.map(rs => (
        <div key={rs.id} className="warm-card p-3 sm:p-6 mb-4">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-blue-800">{rs.label}</h3>
              <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">生效日期：{rs.effectiveDate}</p>
            </div>
            <div className="flex gap-1 sm:gap-2">
              <button onClick={() => openEdit(rs)} className="px-2 sm:px-3 py-1 btn-primary text-white rounded text-xs sm:text-sm flex items-center gap-1"><Pencil size={12} />編輯</button>
              <button onClick={() => handleDelete(rs.id)} className="px-2 sm:px-3 py-1 btn-danger text-white rounded text-xs sm:text-sm flex items-center gap-1"><Trash2 size={12} />刪除</button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* 主要地區 */}
            <div>
              <h4 className="font-bold text-orange-700 mb-2 border-b pb-1 text-sm">主要地區（雙北、台中、台南、高雄）</h4>
              <div className="space-y-1.5 text-xs sm:text-sm">
                <div className="flex justify-between"><span>日班 08:00-20:00</span><span className="font-bold">{rs.mainDayRate} 元/時</span></div>
                <div className="flex justify-between"><span>夜班 20:00-08:00</span><span className="font-bold">{rs.mainNightRate} 元/時</span></div>
                <div className="flex justify-between text-[var(--color-text-secondary)]"><span>白班12小時</span><span>{rs.mainDayRate * 12} 元</span></div>
                <div className="flex justify-between text-[var(--color-text-secondary)]"><span>夜班12小時</span><span>{rs.mainNightRate * 12} 元</span></div>
              </div>
            </div>
            {/* 其他地區 */}
            <div>
              <h4 className="font-bold text-orange-700 mb-2 border-b pb-1 text-sm">其他地區</h4>
              <div className="space-y-1.5 text-xs sm:text-sm">
                <div className="flex justify-between"><span>日班 08:00-20:00</span><span className="font-bold">{rs.otherDayRate} 元/時</span></div>
                <div className="flex justify-between"><span>夜班 20:00-08:00</span><span className="font-bold">{rs.otherNightRate} 元/時</span></div>
                <div className="flex justify-between text-[var(--color-text-secondary)]"><span>白班12小時</span><span>{rs.otherDayRate * 12} 元</span></div>
                <div className="flex justify-between text-[var(--color-text-secondary)]"><span>夜班12小時</span><span>{rs.otherNightRate * 12} 元</span></div>
              </div>
            </div>
          </div>

          <div className="mt-3 sm:mt-4 pt-3 border-t">
            <h4 className="font-bold text-orange-700 mb-2 text-sm">其他費率</h4>
            <div className="space-y-1 text-xs sm:text-sm">
              <div className="flex justify-between"><span>24小時薪資</span><span className="font-bold">{rs.fullDayRate24h} 元</span></div>
              <div className="flex justify-between"><span>最低計費時數</span><span className="font-bold">{rs.minBillingHours} 小時</span></div>
              <div className="flex justify-between"><span>偏遠地區每班補貼</span><span className="font-bold">{rs.remoteAreaSubsidy} 元</span></div>
              <div className="flex justify-between"><span>陪伴洗腎/回診</span><span className="font-bold">{rs.dialysisVisitFee} 元/次</span></div>
              <div className="flex justify-between"><span>洗腎超時（超過4h）</span><span className="font-bold">{rs.dialysisOvertimeRate} 元/時</span></div>
            </div>
          </div>

          <div className="mt-3 sm:mt-4 pt-3 border-t">
            <h4 className="font-bold text-orange-700 mb-2 text-sm">特殊倍率（由「特殊狀況」管理）</h4>
            <div className="space-y-1 text-xs sm:text-sm text-[var(--color-text-secondary)]">
              <div className="flex justify-between"><span>除夕~初五</span><span className="font-bold text-[var(--color-danger)]">2 倍</span></div>
              <div className="flex justify-between"><span>颱風/天災</span><span className="font-bold text-[var(--color-danger)]">1.5 倍</span></div>
              <div className="flex justify-between"><span>負壓隔離病房</span><span className="font-bold text-[var(--color-danger)]">1.5 倍</span></div>
              <div className="flex justify-between"><span>出國</span><span className="font-bold text-[var(--color-danger)]">2 倍</span></div>
            </div>
          </div>
        </div>
      ))}

      {loading && (
        <>
          <SkeletonCard />
          <div className="mt-3"><SkeletonCard /></div>
        </>
      )}

      {!loading && settings.length === 0 && (
        <EmptyState icon={SettingsIcon} title="尚無費率設定，請點擊「新增費率版本」" />
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay overflow-y-auto py-4 sm:py-8">
          <div className="warm-card modal-content p-4 sm:p-6 w-full max-w-lg mx-3 space-y-3 sm:space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold">{editing ? '編輯費率' : '新增費率版本'}</h2>

            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2">
                <label className="w-32 sm:w-48 text-xs sm:text-sm font-bold text-[var(--color-text-primary)] shrink-0">生效日期</label>
                <input type="date" value={form.effectiveDate} onChange={e => setForm({...form, effectiveDate: e.target.value})} className="px-2 sm:px-3 py-1.5 sm:py-2 border rounded text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <label className="w-32 sm:w-48 text-xs sm:text-sm font-bold text-[var(--color-text-primary)] shrink-0">說明</label>
                <input value={form.label} onChange={e => setForm({...form, label: e.target.value})} className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 border rounded text-sm" placeholder="例：114年費率" />
              </div>

              <div className="border-t pt-2 sm:pt-3 mt-2 sm:mt-3">
                <h4 className="font-bold text-orange-700 mb-2 text-sm">主要地區時薪</h4>
                <F label="日班 08:00-20:00" field="mainDayRate" unit="元/時" />
                <F label="夜班 20:00-08:00" field="mainNightRate" unit="元/時" />
              </div>

              <div className="border-t pt-2 sm:pt-3">
                <h4 className="font-bold text-orange-700 mb-2 text-sm">其他地區時薪</h4>
                <F label="日班 08:00-20:00" field="otherDayRate" unit="元/時" />
                <F label="夜班 20:00-08:00" field="otherNightRate" unit="元/時" />
              </div>

              <div className="border-t pt-2 sm:pt-3">
                <h4 className="font-bold text-orange-700 mb-2 text-sm">其他費率</h4>
                <F label="24小時薪資" field="fullDayRate24h" />
                <F label="最低計費時數" field="minBillingHours" unit="小時" />
                <F label="偏遠地區每班補貼" field="remoteAreaSubsidy" />
                <F label="陪伴洗腎/回診" field="dialysisVisitFee" />
                <F label="洗腎超時每小時" field="dialysisOvertimeRate" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleSave} className="px-4 sm:px-5 py-2 btn-success text-white rounded text-sm flex items-center gap-1"><Save size={14} />儲存</button>
              <button onClick={() => setShowModal(false)} className="px-4 sm:px-5 py-2 bg-[var(--color-text-muted)] text-white rounded hover:opacity-80 text-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

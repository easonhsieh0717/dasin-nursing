'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/Toast';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import Spinner from '@/components/Spinner';
import EmptyState from '@/components/EmptyState';
import { SkeletonCard } from '@/components/Skeleton';

interface RatePeriod {
  id?: string;
  startTime: string;
  endTime: string;
  billingRate: number;
  nurseRate: number;
}

interface RateProfile {
  id: string;
  name: string;
  periods: RatePeriod[];
}

const DEFAULT_PERIODS: RatePeriod[] = [
  { startTime: '0800', endTime: '2000', billingRate: 490, nurseRate: 441 },
  { startTime: '2000', endTime: '0800', billingRate: 530, nurseRate: 477 },
];

function PeriodRow({
  period,
  idx,
  onChange,
  onRemove,
  canRemove,
}: {
  period: RatePeriod;
  idx: number;
  onChange: (i: number, f: keyof RatePeriod, v: string | number) => void;
  onRemove: (i: number) => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-[var(--color-text-muted)] w-5 text-right">{idx + 1}.</span>
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={period.startTime}
          onChange={e => onChange(idx, 'startTime', e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="0800"
          maxLength={4}
          className="w-16 px-2 py-1 text-center border border-[var(--color-primary-border)] rounded"
        />
        <span className="text-[var(--color-text-muted)]">~</span>
        <input
          type="text"
          value={period.endTime}
          onChange={e => onChange(idx, 'endTime', e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="2000"
          maxLength={4}
          className="w-16 px-2 py-1 text-center border border-[var(--color-primary-border)] rounded"
        />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--color-text-muted)]">請款</span>
        <input
          type="number"
          value={period.billingRate}
          onChange={e => onChange(idx, 'billingRate', Number(e.target.value))}
          min={0}
          className="w-20 px-2 py-1 border border-[var(--color-primary-border)] rounded text-right"
        />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--color-text-muted)]">薪資</span>
        <input
          type="number"
          value={period.nurseRate}
          onChange={e => onChange(idx, 'nurseRate', Number(e.target.value))}
          min={0}
          className="w-20 px-2 py-1 border border-[var(--color-primary-border)] rounded text-right"
        />
      </div>
      {canRemove && (
        <button onClick={() => onRemove(idx)} className="text-[var(--color-danger)] hover:opacity-70">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

function ProfileForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: RateProfile;
  onSave: (name: string, periods: RatePeriod[]) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [periods, setPeriods] = useState<RatePeriod[]>(
    initial?.periods.length ? initial.periods : [...DEFAULT_PERIODS]
  );

  const updatePeriod = (i: number, field: keyof RatePeriod, val: string | number) => {
    setPeriods(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  };
  const removePeriod = (i: number) => setPeriods(prev => prev.filter((_, idx) => idx !== i));
  const addPeriod = () => setPeriods(prev => [...prev, { startTime: '', endTime: '', billingRate: 0, nurseRate: 0 }]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">方案名稱</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="例：新竹曾董、信義楊爺爺"
          className="w-full px-3 py-2 border border-[var(--color-primary-border)] rounded"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">時段費率</label>
          <button onClick={addPeriod} className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline">
            <Plus size={12} />新增時段
          </button>
        </div>
        <div className="bg-[var(--color-warm-50)] rounded-lg p-3 space-y-2">
          <div className="flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)] mb-1 pl-7">
            <span className="w-36">時段（HHMM～HHMM）</span>
            <span className="w-24">請款費率（/hr）</span>
            <span className="w-24">護理師薪資（/hr）</span>
          </div>
          {periods.map((p, i) => (
            <PeriodRow
              key={i}
              period={p}
              idx={i}
              onChange={updatePeriod}
              onRemove={removePeriod}
              canRemove={periods.length > 2}
            />
          ))}
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          時間格式 HHMM，例：0800、2000。跨日時段如 2000~0800 表示夜班。
        </p>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded bg-[var(--color-warm-100)] text-sm">取消</button>
        <button
          onClick={() => onSave(name, periods)}
          disabled={saving || !name.trim()}
          className="px-4 py-2 btn-primary text-white rounded text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Spinner size="sm" /> : <Save size={14} />}
          儲存
        </button>
      </div>
    </div>
  );
}

export default function RateProfilesPage() {
  const toast = useToast();
  const [profiles, setProfiles] = useState<RateProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<RateProfile | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/rate-profiles?withPeriods=true');
      const data = await res.json();
      setProfiles(data.data || []);
    } catch { setProfiles([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const handleSave = async (name: string, periods: RatePeriod[]) => {
    setSaving(true);
    try {
      if (editingProfile) {
        const res = await fetch('/api/admin/rate-profiles', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingProfile.id, name, periods }),
        });
        if (!res.ok) { const d = await res.json(); toast.error(d.error || '更新失敗'); return; }
        toast.success('費率方案已更新');
      } else {
        const res = await fetch('/api/admin/rate-profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, periods }),
        });
        if (!res.ok) { const d = await res.json(); toast.error(d.error || '新增失敗'); return; }
        toast.success('費率方案已新增');
      }
      setShowForm(false);
      setEditingProfile(null);
      fetchProfiles();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`確定刪除費率方案「${name}」？使用此方案的個案將改為標準費率。`)) return;
    const res = await fetch(`/api/admin/rate-profiles?id=${id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('刪除失敗'); return; }
    toast.success('已刪除');
    fetchProfiles();
  };

  const fmtTime = (t: string) => t.length === 4 ? `${t.slice(0, 2)}:${t.slice(2)}` : t;

  return (
    <div className="p-2 sm:p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">彈性費率方案</h2>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setEditingProfile(null); }}
            className="flex items-center gap-2 px-3 py-1.5 btn-primary text-white rounded-xl text-sm font-bold"
          >
            <Plus size={16} />新增方案
          </button>
        )}
      </div>

      <p className="text-sm text-[var(--color-text-muted)] mb-4">
        為特定個案設定多時段費率（例：0800-2000 日班費率、2000-0800 夜班費率）。未設定的個案沿用標準費率設定。
      </p>

      {(showForm || editingProfile) && (
        <div className="warm-card p-4 mb-4">
          <h3 className="font-bold text-[var(--color-primary)] mb-3">{editingProfile ? '編輯費率方案' : '新增費率方案'}</h3>
          <ProfileForm
            initial={editingProfile || undefined}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingProfile(null); }}
            saving={saving}
          />
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && profiles.length === 0 && !showForm && (
        <EmptyState icon={Plus} title="尚未設定任何費率方案" description="點擊「新增方案」為特定個案建立彈性費率" />
      )}

      <div className="space-y-3">
        {profiles.map(profile => (
          <div key={profile.id} className="warm-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[var(--color-text-primary)]">{profile.name}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingProfile(profile); setShowForm(false); }}
                  className="p-1.5 text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] rounded"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDelete(profile.id, profile.name)}
                  className="p-1.5 text-[var(--color-danger)] hover:bg-red-50 rounded"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-[var(--color-text-muted)]">
                    <th className="text-left pb-1 pr-4">時段</th>
                    <th className="text-right pb-1 pr-4">請款費率（/hr）</th>
                    <th className="text-right pb-1">護理師薪資（/hr）</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-primary-border)]">
                  {profile.periods.map((p, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-4 font-medium">{fmtTime(p.startTime)} ~ {fmtTime(p.endTime)}</td>
                      <td className="py-1.5 pr-4 text-right text-[var(--color-primary)] font-bold">${p.billingRate}</td>
                      <td className="py-1.5 text-right text-[var(--color-success)] font-bold">${p.nurseRate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

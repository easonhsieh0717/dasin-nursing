'use client';

import { useState, useEffect } from 'react';

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
  const [settings, setSettings] = useState<RateSettings[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RateSettings | null>(null);
  const [form, setForm] = useState(defaultForm);

  const fetchSettings = async () => {
    const res = await fetch('/api/admin/settings');
    const data = await res.json();
    setSettings(data.data || []);
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

    await fetch('/api/admin/settings', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setShowModal(false);
    fetchSettings();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此費率設定？')) return;
    await fetch(`/api/admin/settings?id=${id}`, { method: 'DELETE' });
    fetchSettings();
  };

  const F = ({ label, field, unit = '元' }: { label: string; field: string; unit?: string }) => (
    <div className="flex items-center gap-2">
      <label className="w-48 text-sm font-bold text-gray-700">{label}</label>
      <input
        type="number"
        value={form[field as keyof typeof form]}
        onChange={e => setForm({ ...form, [field]: e.target.value })}
        className="w-32 px-3 py-2 border rounded text-right"
      />
      <span className="text-sm text-gray-500">{unit}</span>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">費率設定（每年可調整）</h2>
        <button onClick={openAdd} className="px-4 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700">
          新增費率版本
        </button>
      </div>

      {/* Current settings display */}
      {settings.map(rs => (
        <div key={rs.id} className="bg-white rounded-lg shadow p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-blue-800">{rs.label}</h3>
              <p className="text-sm text-gray-500">生效日期：{rs.effectiveDate}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(rs)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">編輯</button>
              <button onClick={() => handleDelete(rs.id)} className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600">刪除</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-orange-700 mb-2 border-b pb-1">主要地區（雙北、台中、台南、高雄）</h4>
              <table className="w-full text-sm">
                <tbody>
                  <tr><td className="py-1">日班 08:00-20:00</td><td className="text-right font-bold">{rs.mainDayRate} 元/時</td></tr>
                  <tr><td className="py-1">夜班 20:00-08:00</td><td className="text-right font-bold">{rs.mainNightRate} 元/時</td></tr>
                  <tr><td className="py-1">白班12小時</td><td className="text-right">{rs.mainDayRate * 12} 元</td></tr>
                  <tr><td className="py-1">夜班12小時</td><td className="text-right">{rs.mainNightRate * 12} 元</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="font-bold text-orange-700 mb-2 border-b pb-1">其他地區</h4>
              <table className="w-full text-sm">
                <tbody>
                  <tr><td className="py-1">日班 08:00-20:00</td><td className="text-right font-bold">{rs.otherDayRate} 元/時</td></tr>
                  <tr><td className="py-1">夜班 20:00-08:00</td><td className="text-right font-bold">{rs.otherNightRate} 元/時</td></tr>
                  <tr><td className="py-1">白班12小時</td><td className="text-right">{rs.otherDayRate * 12} 元</td></tr>
                  <tr><td className="py-1">夜班12小時</td><td className="text-right">{rs.otherNightRate * 12} 元</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t">
            <h4 className="font-bold text-orange-700 mb-2">其他費率</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>24小時薪資：<span className="font-bold">{rs.fullDayRate24h} 元</span></div>
              <div>最低計費時數：<span className="font-bold">{rs.minBillingHours} 小時</span></div>
              <div>偏遠地區每班補貼：<span className="font-bold">{rs.remoteAreaSubsidy} 元</span></div>
              <div>陪伴洗腎/回診：<span className="font-bold">{rs.dialysisVisitFee} 元/次</span></div>
              <div>洗腎超時（超過4小時）：<span className="font-bold">{rs.dialysisOvertimeRate} 元/時</span></div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t">
            <h4 className="font-bold text-orange-700 mb-2">特殊倍率（由「特殊狀況」管理）</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>除夕~初五：<span className="font-bold text-red-600">2 倍</span></div>
              <div>颱風/天災：<span className="font-bold text-red-600">1.5 倍</span></div>
              <div>負壓隔離病房：<span className="font-bold text-red-600">1.5 倍</span></div>
              <div>出國：<span className="font-bold text-red-600">2 倍</span></div>
            </div>
          </div>
        </div>
      ))}

      {settings.length === 0 && (
        <div className="text-center py-12 text-gray-400">尚無費率設定，請點擊「新增費率版本」</div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg space-y-4">
            <h2 className="text-xl font-bold">{editing ? '編輯費率' : '新增費率版本'}</h2>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="w-48 text-sm font-bold text-gray-700">生效日期</label>
                <input type="date" value={form.effectiveDate} onChange={e => setForm({...form, effectiveDate: e.target.value})} className="px-3 py-2 border rounded" />
              </div>
              <div className="flex items-center gap-2">
                <label className="w-48 text-sm font-bold text-gray-700">說明</label>
                <input value={form.label} onChange={e => setForm({...form, label: e.target.value})} className="flex-1 px-3 py-2 border rounded" placeholder="例：114年費率" />
              </div>

              <div className="border-t pt-3 mt-3">
                <h4 className="font-bold text-orange-700 mb-2">主要地區時薪</h4>
                <F label="日班 08:00-20:00" field="mainDayRate" unit="元/時" />
                <F label="夜班 20:00-08:00" field="mainNightRate" unit="元/時" />
              </div>

              <div className="border-t pt-3">
                <h4 className="font-bold text-orange-700 mb-2">其他地區時薪</h4>
                <F label="日班 08:00-20:00" field="otherDayRate" unit="元/時" />
                <F label="夜班 20:00-08:00" field="otherNightRate" unit="元/時" />
              </div>

              <div className="border-t pt-3">
                <h4 className="font-bold text-orange-700 mb-2">其他費率</h4>
                <F label="24小時薪資" field="fullDayRate24h" />
                <F label="最低計費時數" field="minBillingHours" unit="小時" />
                <F label="偏遠地區每班補貼" field="remoteAreaSubsidy" />
                <F label="陪伴洗腎/回診" field="dialysisVisitFee" />
                <F label="洗腎超時每小時" field="dialysisOvertimeRate" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleSave} className="px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700">儲存</button>
              <button onClick={() => setShowModal(false)} className="px-5 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

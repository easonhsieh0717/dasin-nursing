'use client';

import { useState, useEffect, useRef } from 'react';

interface NurseItem { id: string; name: string; account?: string; }

export default function NurseSearchInput({ nurses, value, onChange, disabled, placeholder, className }: {
  nurses: NurseItem[];
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query && !nurses.find(n => n.name === query)
    ? nurses.filter(n => n.name.includes(query) || (n.account && n.account.toLowerCase().includes(query.toLowerCase())))
    : nurses;

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <input
        type="text"
        value={query}
        disabled={disabled}
        placeholder={placeholder || '搜尋特護...'}
        className="w-full px-2 py-1 border rounded text-sm"
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(''); }}
        onFocus={() => setOpen(true)}
      />
      {open && !disabled && (
        <div className="absolute z-50 left-0 right-0 top-full bg-white border border-[var(--color-primary-border)] rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {value && (
            <div
              className="px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-nav-hover-bg)] cursor-pointer border-b border-[var(--color-primary-border)]"
              onClick={() => { onChange(''); setQuery(''); setOpen(false); }}
            >清除選擇</div>
          )}
          {filtered.slice(0, 30).map(n => (
            <div
              key={n.id}
              className={`px-3 py-1.5 text-sm hover:bg-[var(--color-primary-light)] cursor-pointer ${n.name === value ? 'bg-[var(--color-primary-light)] font-bold' : ''}`}
              onClick={() => { onChange(n.name); setQuery(n.name); setOpen(false); }}
            >
              {n.name} {n.account && <span className="text-[var(--color-text-muted)] text-xs">{n.account}</span>}
            </div>
          ))}
          {filtered.length > 30 && (
            <div className="px-3 py-1 text-xs text-[var(--color-text-muted)] text-center">繼續輸入以縮小範圍...</div>
          )}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-[var(--color-text-muted)] text-center">無符合的特護</div>
          )}
        </div>
      )}
    </div>
  );
}

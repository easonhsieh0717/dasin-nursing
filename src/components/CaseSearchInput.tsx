'use client';

import { useState, useEffect, useRef } from 'react';

interface CaseItem { id: string; name: string; code: string; }

export default function CaseSearchInput({ cases, value, onChange, disabled, placeholder, showCode, className }: {
  cases: CaseItem[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showCode?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const c = cases.find(c => c.id === value);
      setQuery(c ? (showCode ? `${c.name}（${c.code}）` : c.name) : '');
    } else {
      setQuery('');
    }
  }, [value, cases, showCode]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query && !cases.find(c => c.name === query || `${c.name}（${c.code}）` === query)
    ? cases.filter(c => c.name.includes(query) || c.code.toLowerCase().includes(query.toLowerCase()))
    : cases;

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <input
        type="text"
        value={query}
        disabled={disabled}
        placeholder={placeholder || '搜尋個案...'}
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
          {filtered.slice(0, 30).map(c => (
            <div
              key={c.id}
              className={`px-3 py-1.5 text-sm hover:bg-[var(--color-primary-light)] cursor-pointer ${c.id === value ? 'bg-[var(--color-primary-light)] font-bold' : ''}`}
              onClick={() => { onChange(c.id); setQuery(showCode ? `${c.name}（${c.code}）` : c.name); setOpen(false); }}
            >
              {c.name} <span className="text-[var(--color-text-muted)] text-xs">{c.code}</span>
            </div>
          ))}
          {filtered.length > 30 && (
            <div className="px-3 py-1 text-xs text-[var(--color-text-muted)] text-center">繼續輸入以縮小範圍...</div>
          )}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-[var(--color-text-muted)] text-center">無符合的個案</div>
          )}
        </div>
      )}
    </div>
  );
}

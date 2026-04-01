'use client';

import { Inbox, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', animation: 'fadeIn 0.4s ease-out' }}>
      <Icon size={48} style={{ color: 'var(--color-text-muted)', margin: '0 auto 12px', opacity: 0.5 }} />
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{title}</div>
      {description && (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{description}</div>
      )}
      {action && (
        <button onClick={action.onClick} className="btn-primary mt-3 text-sm px-4 py-2">
          {action.label}
        </button>
      )}
    </div>
  );
}

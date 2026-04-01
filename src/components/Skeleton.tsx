'use client';

export function SkeletonCard() {
  return (
    <div className="warm-card p-3" style={{ pointerEvents: 'none' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="skeleton" style={{ width: 80, height: 16 }} />
        <div className="skeleton" style={{ width: 60, height: 22 }} />
      </div>
      <div className="skeleton mb-1.5" style={{ width: '90%', height: 12 }} />
      <div className="skeleton mb-1.5" style={{ width: '75%', height: 12 }} />
      <div className="skeleton" style={{ width: '40%', height: 12 }} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i}>
          {Array.from({ length: columns }, (_, j) => (
            <td key={j}>
              <div className="skeleton mx-auto" style={{ width: '70%', height: 14 }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

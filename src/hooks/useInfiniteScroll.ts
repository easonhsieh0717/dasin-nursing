'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  /** API endpoint path, e.g. '/api/admin/records' */
  url: string;
  /** Number of items per page (default 20) */
  pageSize?: number;
  /** Build extra URLSearchParams from current filters */
  buildParams?: () => Record<string, string>;
}

interface UseInfiniteScrollResult<T> {
  data: T[];
  loading: boolean;
  hasMore: boolean;
  total: number;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  refresh: () => void;
}

export function useInfiniteScroll<T extends { id: string }>(
  opts: UseInfiniteScrollOptions,
  deps: unknown[] = [],
): UseInfiniteScrollResult<T> {
  const { url, pageSize = 20 } = opts;

  const [data, setData] = useState<T[]>([]);
  const pageRef = useRef(1);
  const [hasMore, setHasMore] = useState(true);
  const hasMoreRef = useRef(true);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Keep buildParams in a ref to avoid stale closures
  const buildParamsRef = useRef(opts.buildParams);
  buildParamsRef.current = opts.buildParams;

  const doFetch = useCallback(async (pageNum: number, append: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), pageSize: String(pageSize) });
      const extra = buildParamsRef.current?.() || {};
      Object.entries(extra).forEach(([k, v]) => { if (v) params.set(k, v); });
      const res = await fetch(`${url}?${params}`);
      const json = await res.json();
      const newItems: T[] = json.data || [];
      setData(prev => {
        const base = append ? prev : [];
        const existing = new Set(base.map(item => item.id));
        return [...base, ...newItems.filter(item => !existing.has(item.id))];
      });
      setTotal(json.total || 0);
      const more = pageNum < (json.totalPages || 1);
      setHasMore(more);
      hasMoreRef.current = more;
      pageRef.current = pageNum;
    } catch {
      // fetch error — keep existing data
    }
    loadingRef.current = false;
    setLoading(false);
  }, [url, pageSize]);

  const refresh = useCallback(() => {
    pageRef.current = 1;
    loadingRef.current = false;
    hasMoreRef.current = true;
    setData([]);
    setHasMore(true);
    doFetch(1, false);
  }, [doFetch]);

  // Reset on dependency change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, [...deps, refresh]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreRef.current && !loadingRef.current) {
        doFetch(pageRef.current + 1, true);
      }
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [doFetch]);

  return { data, loading, hasMore, total, sentinelRef, refresh };
}

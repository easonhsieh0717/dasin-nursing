/**
 * Supabase Guard Tests
 *
 * Verifies that supabase.ts enforces service key requirement
 * in production and correctly detects Supabase availability.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';

describe('Supabase configuration guard', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('should throw in production with URL but no service key', async () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = '';

    await expect(async () => {
      await import('./supabase');
    }).rejects.toThrow('SUPABASE_SERVICE_KEY is required in production');
  });

  it('should set isSupabase=false when no credentials', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;

    const mod = await import('./supabase');
    expect(mod.isSupabase).toBe(false);
  });

  it('should set isSupabase=true when both credentials provided', async () => {
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key-at-least-32-chars-long-here';

    const mod = await import('./supabase');
    expect(mod.isSupabase).toBe(true);
  });
});

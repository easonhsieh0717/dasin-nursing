/**
 * DB Fail-Fast Tests
 *
 * Verifies that the production guard in db.ts prevents
 * running without Supabase in production/Vercel environments.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';

describe('DB production guard', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
    // Clear module cache so db.ts re-evaluates
    vi.resetModules();
  });

  it('should throw in production without Supabase credentials', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL = '';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;

    await expect(async () => {
      await import('./db');
    }).rejects.toThrow('Supabase is required in production');
  });

  it('should throw on Vercel without Supabase credentials', async () => {
    process.env.NODE_ENV = 'development';
    process.env.VERCEL = '1';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;

    await expect(async () => {
      await import('./db');
    }).rejects.toThrow('Supabase is required in production');
  });

  it('should NOT throw in local development without Supabase', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.VERCEL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;

    // Should not throw — JSON fallback is ok for local dev
    await expect(import('./db')).resolves.toBeDefined();
  });
});

/**
 * Rate Limiter Tests
 *
 * Tests the in-memory fallback rate limiter (dev mode).
 * Supabase-backed limiter is tested via integration tests against real DB.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, clearRateLimit, cleanupExpiredAttempts, _testing } from './rate-limiter';

const { MAX_ATTEMPTS, memoryAttempts } = _testing;

// These tests run without Supabase, so they exercise the in-memory path.

describe('Rate Limiter (in-memory)', () => {
  beforeEach(() => {
    memoryAttempts.clear();
  });

  it('should allow first login attempt', async () => {
    const result = await checkRateLimit('192.168.1.1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(MAX_ATTEMPTS - 1);
  });

  it('should allow up to MAX_ATTEMPTS attempts', async () => {
    const ip = '10.0.0.1';
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const result = await checkRateLimit(ip);
      expect(result.allowed).toBe(true);
    }
  });

  it('should block after MAX_ATTEMPTS exceeded', async () => {
    const ip = '10.0.0.2';
    // Exhaust all attempts
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await checkRateLimit(ip);
    }
    // Next attempt should be blocked
    const result = await checkRateLimit(ip);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should track different IPs independently', async () => {
    const ip1 = '10.0.0.3';
    const ip2 = '10.0.0.4';

    // Exhaust ip1
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await checkRateLimit(ip1);
    }
    const blocked = await checkRateLimit(ip1);
    expect(blocked.allowed).toBe(false);

    // ip2 should still be allowed
    const allowed = await checkRateLimit(ip2);
    expect(allowed.allowed).toBe(true);
    expect(allowed.remaining).toBe(MAX_ATTEMPTS - 1);
  });

  it('should clear rate limit on successful login', async () => {
    const ip = '10.0.0.5';

    // Use 3 attempts
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(ip);
    }

    // Clear on success
    await clearRateLimit(ip);

    // Should be fresh again
    const result = await checkRateLimit(ip);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(MAX_ATTEMPTS - 1);
  });

  it('should reset after time window expires', async () => {
    const ip = '10.0.0.6';

    // Exhaust all attempts
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await checkRateLimit(ip);
    }
    expect((await checkRateLimit(ip)).allowed).toBe(false);

    // Simulate time passing by manipulating the stored record
    const record = memoryAttempts.get(ip);
    if (record) {
      record.firstAttempt = Date.now() - (_testing.LOGIN_WINDOW_MS + 1000);
    }

    // Should be allowed again
    const result = await checkRateLimit(ip);
    expect(result.allowed).toBe(true);
  });

  it('should return decreasing remaining count', async () => {
    const ip = '10.0.0.7';
    const remainingValues: number[] = [];

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const result = await checkRateLimit(ip);
      remainingValues.push(result.remaining);
    }

    // Should be [4, 3, 2, 1, 0] for MAX_ATTEMPTS=5
    for (let i = 0; i < remainingValues.length; i++) {
      expect(remainingValues[i]).toBe(MAX_ATTEMPTS - 1 - i);
    }
  });

  it('should cleanup expired entries', async () => {
    // Add some entries
    await checkRateLimit('expired-1');
    await checkRateLimit('expired-2');
    await checkRateLimit('fresh-1');

    // Make first two expired
    const r1 = memoryAttempts.get('expired-1');
    const r2 = memoryAttempts.get('expired-2');
    if (r1) r1.firstAttempt = Date.now() - (_testing.LOGIN_WINDOW_MS + 1000);
    if (r2) r2.firstAttempt = Date.now() - (_testing.LOGIN_WINDOW_MS + 1000);

    const cleaned = await cleanupExpiredAttempts();
    expect(cleaned).toBe(2);
    expect(memoryAttempts.has('expired-1')).toBe(false);
    expect(memoryAttempts.has('expired-2')).toBe(false);
    expect(memoryAttempts.has('fresh-1')).toBe(true);
  });

  it('MAX_ATTEMPTS should be 5', () => {
    expect(MAX_ATTEMPTS).toBe(5);
  });
});

/**
 * Distributed rate limiter for serverless environments.
 *
 * Production (Supabase):  persists attempts in `login_attempts` table
 *                         → survives cold starts, works across instances.
 * Development (no Supabase): falls back to in-memory Map
 *                         → acceptable for local dev only.
 */
import { supabase, isSupabase } from './supabase';

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

// ===== In-memory fallback (dev only) =====
const memoryAttempts = new Map<string, { count: number; firstAttempt: number }>();

function checkMemory(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = memoryAttempts.get(ip);
  if (!record || now - record.firstAttempt > LOGIN_WINDOW_MS) {
    memoryAttempts.set(ip, { count: 1, firstAttempt: now });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }
  record.count++;
  const remaining = Math.max(0, MAX_ATTEMPTS - record.count);
  return { allowed: record.count <= MAX_ATTEMPTS, remaining };
}

function clearMemory(ip: string): void {
  memoryAttempts.delete(ip);
}

// ===== Supabase-backed (production) =====
async function checkSupabase(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();

  // Count recent attempts for this IP
  const { count, error } = await supabase
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('attempted_at', windowStart);

  if (error) {
    // If table doesn't exist or DB error, allow login but log warning
    console.warn('Rate limiter DB error (allowing login):', error.message);
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }

  const currentCount = (count ?? 0) + 1;
  const remaining = Math.max(0, MAX_ATTEMPTS - currentCount);

  if (currentCount > MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 };
  }

  // Record this attempt
  await supabase.from('login_attempts').insert({ ip, attempted_at: new Date().toISOString() });

  return { allowed: true, remaining };
}

async function clearSupabase(ip: string): Promise<void> {
  await supabase.from('login_attempts').delete().eq('ip', ip);
}

async function cleanupSupabase(): Promise<number> {
  const windowStart = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from('login_attempts')
    .delete()
    .lt('attempted_at', windowStart);
  return count ?? 0;
}

// ===== Public API =====

/**
 * Check if IP is allowed to attempt login.
 * Returns { allowed, remaining } where remaining = attempts left before lockout.
 */
export async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }> {
  if (isSupabase) {
    return checkSupabase(ip);
  }
  return checkMemory(ip);
}

/**
 * Clear rate limit for IP (call on successful login).
 */
export async function clearRateLimit(ip: string): Promise<void> {
  if (isSupabase) {
    return clearSupabase(ip);
  }
  clearMemory(ip);
}

/**
 * Cleanup expired entries. Call from a cron job or scheduled task.
 * Returns number of deleted rows (Supabase) or 0 (memory).
 */
export async function cleanupExpiredAttempts(): Promise<number> {
  if (isSupabase) {
    return cleanupSupabase();
  }
  // Memory cleanup
  const now = Date.now();
  let cleaned = 0;
  for (const [ip, record] of memoryAttempts) {
    if (now - record.firstAttempt > LOGIN_WINDOW_MS) {
      memoryAttempts.delete(ip);
      cleaned++;
    }
  }
  return cleaned;
}

// Exported for testing
export const _testing = {
  MAX_ATTEMPTS,
  LOGIN_WINDOW_MS,
  memoryAttempts,
};

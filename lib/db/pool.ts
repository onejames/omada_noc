import { Pool } from 'pg';

let globalPool: Pool | null = null;
let fallbackToMemory = false;

export function isMemoryFallbackActive(): boolean {
  return fallbackToMemory;
}

export function activateMemoryFallback(reason?: string): void {
  if (!fallbackToMemory) {
    fallbackToMemory = true;
    if (reason) {
      console.warn(`⚠️ [Database] Activating In-Memory Store fallback: ${reason}`);
    }
  }
}

export function resetMemoryFallback(): void {
  fallbackToMemory = false;
}

/**
 * Evaluates whether an error is caused by missing database, authentication mismatch,
 * or connection refusal that should trigger transparent in-memory fallback in dev.
 */
export function isConnectionOrAuthError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as Error).message ? (err as Error).message.toLowerCase() : '';
  const code = (err as { code?: string }).code || '';
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'EHOSTUNREACH' ||
    code === '28P01' || // password authentication failed
    code === '3D000' || // database does not exist
    code === '28000' || // invalid authorization specification
    code === '42P01' || // table does not exist
    msg.includes('connection refused') ||
    msg.includes('connection terminated') ||
    msg.includes('password authentication failed') ||
    msg.includes('authentication failed') ||
    msg.includes('auth failed') ||
    msg.includes('does not exist') ||
    msg.includes('sasl') ||
    msg.includes('no pg_hba') ||
    msg.includes('timeout')
  );
}

/**
 * Returns a singleton PostgreSQL connection pool.
 */
export function getDbPool(): Pool {
  if (!globalPool) {
    const connectionString =
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/noc_dash';

    globalPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    });

    globalPool.on('error', (err) => {
      if (isConnectionOrAuthError(err)) {
        activateMemoryFallback(err.message);
      } else {
        console.error('Unexpected error on idle PostgreSQL client pool:', err);
      }
    });
  }

  return globalPool;
}

/**
 * Closes the database pool (useful for test tear-downs).
 */
export async function closeDbPool(): Promise<void> {
  if (globalPool) {
    await globalPool.end().catch(() => {});
    globalPool = null;
  }
}

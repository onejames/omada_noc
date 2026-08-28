import { getDbPool, activateMemoryFallback } from './pool';
import { hashPassword } from '../auth/password';
import { initMemoryDb } from './memory';

export const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@omadanoc.com';
export const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'AdminPass123!';
export const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin';

/**
 * Idempotently initializes the database schema (PostgreSQL or In-Memory fallback)
 * and seeds the default admin user.
 */
export async function initDb(): Promise<void> {
  try {
    const pool = getDbPool();

    // Create tables
    await pool.query(`
      -- 1. Users Table
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'USER',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- 2. User Profiles Table
      CREATE TABLE IF NOT EXISTS user_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        full_name VARCHAR(100) NOT NULL DEFAULT '',
        job_title VARCHAR(100) DEFAULT '',
        department VARCHAR(100) DEFAULT '',
        avatar_url TEXT DEFAULT '',
        theme VARCHAR(20) DEFAULT 'dark',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- 3. User Device Tags Table
      CREATE TABLE IF NOT EXISTS user_device_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        mac_address VARCHAR(30) NOT NULL,
        device_name VARCHAR(100) DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_user_mac UNIQUE (user_id, mac_address)
      );

      -- 4. User Logins Audit Table
      CREATE TABLE IF NOT EXISTS user_logins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        email VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45) NOT NULL DEFAULT '127.0.0.1',
        user_agent TEXT DEFAULT '',
        login_status VARCHAR(20) NOT NULL,
        failure_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_user_logins_created_at ON user_logins (created_at DESC);

      -- 5. AI Insights History Table (Continuous Memory Engine)
      CREATE TABLE IF NOT EXISTS ai_insights_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        triggered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        health_score INTEGER NOT NULL,
        previous_score INTEGER,
        score_delta INTEGER NOT NULL DEFAULT 0,
        trend_direction VARCHAR(20) NOT NULL,
        executive_summary TEXT NOT NULL,
        resolved_issues JSONB DEFAULT '[]',
        persisting_issues JSONB DEFAULT '[]',
        new_issues JSONB DEFAULT '[]',
        actionable_suggestions JSONB DEFAULT '[]',
        metrics_snapshot JSONB NOT NULL DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at ON ai_insights_history (created_at DESC);
    `);

    // Check if any users exist; if not, seed default admin
    const userCheck = await pool.query('SELECT COUNT(*) as count FROM users');
    const count = parseInt(userCheck.rows[0]?.count || '0', 10);

    if (count === 0) {
      const hashed = await hashPassword(DEFAULT_ADMIN_PASSWORD);
      const insertUserRes = await pool.query(
        `INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, 'ADMIN')
         RETURNING id`,
        [DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_EMAIL, hashed]
      );

      const adminId = insertUserRes.rows[0].id;

      // Seed Profile
      await pool.query(
        `INSERT INTO user_profiles (user_id, full_name, job_title, department, theme)
         VALUES ($1, 'System Administrator', 'Lead NOC Engineer', 'Network Operations', 'dark')`,
        [adminId]
      );

      console.log(`\n======================================================`);
      console.log(`  🎉 Initial Admin Account Seeded (PostgreSQL):`);
      console.log(`  Email:    ${DEFAULT_ADMIN_EMAIL}`);
      console.log(`  Password: ${DEFAULT_ADMIN_PASSWORD}`);
      console.log(`  Role:     ADMIN`);
      console.log(`======================================================\n`);
    }
  } catch (err: unknown) {
    // If PostgreSQL connection or auth fails (e.g. running locally without Postgres or password mismatch in dev),
    // transparently initialize in-memory fallback.
    const msg = (err as Error).message || 'connection failed';
    activateMemoryFallback(msg);
    await initMemoryDb();
  }
}

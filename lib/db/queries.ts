import {
  getDbPool,
  isMemoryFallbackActive,
  activateMemoryFallback,
  resetMemoryFallback,
  isConnectionOrAuthError,
} from './pool';
import {
  UserRecord,
  UserProfile,
  UserDeviceTag,
  UserRole,
  UserWithDetails,
  PaginatedLogins,
} from '@/types/auth';
import {
  memoryFindUserByEmailOrUsername,
  memoryFindUserById,
  memoryCreateUser,
  memoryUpdateUserRole,
  memoryUpdateUserPassword,
  memoryDeleteUser,
  memoryListAllUsersWithDetails,
  memoryGetUserProfile,
  memoryUpsertUserProfile,
  memoryGetUserDeviceTags,
  memoryTagDeviceToUser,
  memoryRemoveDeviceTagFromUser,
  memoryRecordLoginAttempt,
  memoryGetPaginatedLogins,
} from './memory';

export function resetDbFallbackForTests(): void {
  resetMemoryFallback();
}

/**
 * Finds a user by email address or username.
 */
export async function findUserByEmailOrUsername(
  identifier: string
): Promise<(UserRecord & { passwordHash: string }) | null> {
  if (isMemoryFallbackActive()) {
    return (await memoryFindUserByEmailOrUsername(identifier)) as (UserRecord & { passwordHash: string }) | null;
  }

  try {
    const pool = getDbPool();
    const res = await pool.query(
      `SELECT id, username, email, password_hash as "passwordHash", role, created_at as "createdAt", updated_at as "updatedAt"
       FROM users
       WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)
       LIMIT 1`,
      [identifier]
    );

    if (res.rows.length === 0) return null;
    return res.rows[0];
  } catch (err) {
    if (isConnectionOrAuthError(err)) {
      activateMemoryFallback((err as Error).message);
      return (await memoryFindUserByEmailOrUsername(identifier)) as (UserRecord & { passwordHash: string }) | null;
    }
    throw err;
  }
}

/**
 * Finds a user by unique UUID.
 */
export async function findUserById(id: string): Promise<UserRecord | null> {
  if (isMemoryFallbackActive()) {
    return memoryFindUserById(id);
  }

  try {
    const pool = getDbPool();
    const res = await pool.query(
      `SELECT id, username, email, role, created_at as "createdAt", updated_at as "updatedAt"
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    if (res.rows.length === 0) return null;
    return res.rows[0];
  } catch (err) {
    if (isConnectionOrAuthError(err)) {
      activateMemoryFallback((err as Error).message);
      return memoryFindUserById(id);
    }
    throw err;
  }
}

/**
 * Creates a new user with default profile.
 */
export async function createUser(
  username: string,
  email: string,
  passwordHash: string,
  role: UserRole = 'USER',
  fullName: string = ''
): Promise<UserRecord> {
  if (isMemoryFallbackActive()) {
    return memoryCreateUser(username, email, passwordHash, role, fullName);
  }

  try {
    const pool = getDbPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userRes = await client.query(
        `INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, email, role, created_at as "createdAt", updated_at as "updatedAt"`,
        [username, email, passwordHash, role]
      );

      const newUser: UserRecord = userRes.rows[0];

      // Create default profile
      await client.query(
        `INSERT INTO user_profiles (user_id, full_name, theme)
         VALUES ($1, $2, 'dark')`,
        [newUser.id, fullName || username]
      );

      await client.query('COMMIT');
      return newUser;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (err) {
    if (isConnectionOrAuthError(err)) {
      activateMemoryFallback((err as Error).message);
      return memoryCreateUser(username, email, passwordHash, role, fullName);
    }
    throw err;
  }
}

/**
 * Updates a user's role.
 */
export async function updateUserRole(
  id: string,
  role: UserRole
): Promise<UserRecord | null> {
  if (isMemoryFallbackActive()) {
    return memoryUpdateUserRole(id, role);
  }

  try {
    const pool = getDbPool();
    const res = await pool.query(
      `UPDATE users
       SET role = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, username, email, role, created_at as "createdAt", updated_at as "updatedAt"`,
      [role, id]
    );

    if (res.rows.length === 0) return null;
    return res.rows[0];
  } catch (err) {
    if (isConnectionOrAuthError(err)) {
      activateMemoryFallback((err as Error).message);
      return memoryUpdateUserRole(id, role);
    }
    throw err;
  }
}

/**
 * Updates a user's password hash.
 */
export async function updateUserPassword(
  id: string,
  passwordHash: string
): Promise<boolean> {
  if (isMemoryFallbackActive()) {
    return memoryUpdateUserPassword(id, passwordHash);
  }

  try {
    const pool = getDbPool();
    const res = await pool.query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, id]
    );

    return (res.rowCount ?? 0) > 0;
  } catch (err) {
    if (isConnectionOrAuthError(err)) {
      activateMemoryFallback((err as Error).message);
      return memoryUpdateUserPassword(id, passwordHash);
    }
    throw err;
  }
}

/**
 * Deletes a user account.
 */
export async function deleteUser(id: string): Promise<boolean> {
  if (isMemoryFallbackActive()) {
    return memoryDeleteUser(id);
  }

  try {
    const pool = getDbPool();
    const res = await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  } catch (err) {
    if (isConnectionOrAuthError(err)) {
      activateMemoryFallback((err as Error).message);
      return memoryDeleteUser(id);
    }
    throw err;
  }
}

/**
 * Lists all users with their profile and tagged devices.
 */
export async function listAllUsersWithDetails(): Promise<UserWithDetails[]> {
  if (isMemoryFallbackActive()) {
    return memoryListAllUsersWithDetails();
  }

  try {
    const pool = getDbPool();
    const usersRes = await pool.query(
      `SELECT u.id, u.username, u.email, u.role, u.created_at as "createdAt", u.updated_at as "updatedAt",
              p.id as "profileId", p.full_name as "fullName", p.job_title as "jobTitle", p.department, p.avatar_url as "avatarUrl", p.theme
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       ORDER BY u.created_at ASC`
    );

    const tagsRes = await pool.query(
      `SELECT id, user_id as "userId", mac_address as "macAddress", device_name as "deviceName", created_at as "createdAt"
       FROM user_device_tags`
    );

    const tagsByUserId = new Map<string, UserDeviceTag[]>();
    for (const row of tagsRes.rows) {
      const existing = tagsByUserId.get(row.userId) || [];
      existing.push(row);
      tagsByUserId.set(row.userId, existing);
    }

    return usersRes.rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      profile: {
        id: row.profileId || '',
        userId: row.id,
        fullName: row.fullName || '',
        jobTitle: row.jobTitle || '',
        department: row.department || '',
        avatarUrl: row.avatarUrl || '',
        theme: row.theme || 'dark',
        updatedAt: row.updatedAt,
      },
      taggedDevices: tagsByUserId.get(row.id) || [],
    }));
  } catch (err) {
    if (isConnectionOrAuthError(err)) {
      activateMemoryFallback((err as Error).message);
      return memoryListAllUsersWithDetails();
    }
    throw err;
  }
}

/**
 * Retrieves a user's extended profile.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (isMemoryFallbackActive()) {
    return memoryGetUserProfile(userId);
  }

  try {
    const pool = getDbPool();
    const res = await pool.query(
      `SELECT id, user_id as "userId", full_name as "fullName", job_title as "jobTitle", department, avatar_url as "avatarUrl", theme, updated_at as "updatedAt"
       FROM user_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (res.rows.length === 0) return null;
    return res.rows[0];
  } catch (err) {
    if (isConnectionOrAuthError(err)) {
      activateMemoryFallback((err as Error).message);
      return memoryGetUserProfile(userId);
    }
    throw err;
  }
}

/**
 * Upserts a user's profile information.
 */
export async function upsertUserProfile(
  userId: string,
  data: Partial<Omit<UserProfile, 'id' | 'userId' | 'updatedAt'>>
): Promise<UserProfile> {
  if (isMemoryFallbackActive()) {
    return memoryUpsertUserProfile(userId, data);
  }

  try {
    const pool = getDbPool();
    const res = await pool.query(
      `INSERT INTO user_profiles (user_id, full_name, job_title, department, avatar_url, theme, updated_at)
       VALUES ($1, COALESCE($2, ''), COALESCE($3, ''), COALESCE($4, ''), COALESCE($5, ''), COALESCE($6, 'dark'), NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
           job_title = COALESCE(EXCLUDED.job_title, user_profiles.job_title),
           department = COALESCE(EXCLUDED.department, user_profiles.department),
           avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
           theme = COALESCE(EXCLUDED.theme, user_profiles.theme),
           updated_at = NOW()
       RETURNING id, user_id as "userId", full_name as "fullName", job_title as "jobTitle", department, avatar_url as "avatarUrl", theme, updated_at as "updatedAt"`,
      [
        userId,
        data.fullName ?? null,
        data.jobTitle ?? null,
        data.department ?? null,
        data.avatarUrl ?? null,
        data.theme ?? null,
      ]
    );

    return res.rows[0];
  } catch (err) {
    if (isConnectionOrAuthError(err)) {
      activateMemoryFallback((err as Error).message);
      return memoryUpsertUserProfile(userId, data);
    }
    throw err;
  }
}

/**
 * Retrieves all device MAC address tags assigned to a user.
 */
export async function getUserDeviceTags(userId: string): Promise<UserDeviceTag[]> {
  if (isMemoryFallbackActive()) {
    return memoryGetUserDeviceTags(userId);
  }

  try {
    const pool = getDbPool();
    const res = await pool.query(
      `SELECT id, user_id as "userId", mac_address as "macAddress", device_name as "deviceName", created_at as "createdAt"
       FROM user_device_tags
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId]
    );

    return res.rows;
  } catch (err) {
    if (isConnectionOrAuthError(err)) {
      activateMemoryFallback((err as Error).message);
      return memoryGetUserDeviceTags(userId);
    }
    throw err;
  }
}

/**
 * Tags a MAC address to a user.
 */
export async function tagDeviceToUser(
  userId: string,
  macAddress: string,
  deviceName: string = ''
): Promise<UserDeviceTag> {
  if (isMemoryFallbackActive()) {
    return memoryTagDeviceToUser(userId, macAddress, deviceName);
  }

  try {
    const pool = getDbPool();
    const normalizedMac = macAddress.toUpperCase().trim();

    const res = await pool.query(
      `INSERT INTO user_device_tags (user_id, mac_address, device_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, mac_address) DO UPDATE
       SET device_name = EXCLUDED.device_name
       RETURNING id, user_id as "userId", mac_address as "macAddress", device_name as "deviceName", created_at as "createdAt"`,
      [userId, normalizedMac, deviceName]
    );

    return res.rows[0];
  } catch (err) {
    if (isConnectionOrAuthError(err)) {
      activateMemoryFallback((err as Error).message);
      return memoryTagDeviceToUser(userId, macAddress, deviceName);
    }
    throw err;
  }
}

/**
 * Removes a tagged device from a user.
 */
export async function removeDeviceTagFromUser(
  userId: string,
  macAddress: string
): Promise<boolean> {
  if (isMemoryFallbackActive()) {
    return memoryRemoveDeviceTagFromUser(userId, macAddress);
  }

  try {
    const pool = getDbPool();
    const normalizedMac = macAddress.toUpperCase().trim();

    const res = await pool.query(
      `DELETE FROM user_device_tags
       WHERE user_id = $1 AND UPPER(mac_address) = $2`,
      [userId, normalizedMac]
    );

    return (res.rowCount ?? 0) > 0;
  } catch (err) {
    if (isConnectionOrAuthError(err)) {
      activateMemoryFallback((err as Error).message);
      return memoryRemoveDeviceTagFromUser(userId, macAddress);
    }
    throw err;
  }
}

/**
 * Records an authentication attempt into the audit log.
 */
export async function recordLoginAttempt(
  userId: string | null,
  email: string,
  ipAddress: string,
  userAgent: string,
  loginStatus: 'SUCCESS' | 'FAILED',
  failureReason: string | null = null
): Promise<void> {
  if (isMemoryFallbackActive()) {
    return memoryRecordLoginAttempt(userId, email, ipAddress, userAgent, loginStatus, failureReason);
  }

  try {
    const pool = getDbPool();
    await pool.query(
      `INSERT INTO user_logins (user_id, email, ip_address, user_agent, login_status, failure_reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, email, ipAddress, userAgent, loginStatus, failureReason]
    );
  } catch (err) {
    if (isConnectionOrAuthError(err)) {
      activateMemoryFallback((err as Error).message);
      return memoryRecordLoginAttempt(userId, email, ipAddress, userAgent, loginStatus, failureReason);
    }
    // Never crash caller on login audit write failure
    console.error('Failed to write login audit entry:', err);
  }
}

/**
 * Retrieves a paginated list of login audit records (default 10 per page).
 */
export async function getPaginatedLogins(
  page: number = 1,
  pageSize: number = 10
): Promise<PaginatedLogins> {
  if (isMemoryFallbackActive()) {
    return memoryGetPaginatedLogins(page, pageSize);
  }

  try {
    const pool = getDbPool();
    const offset = (page - 1) * pageSize;

    const countRes = await pool.query(`SELECT COUNT(*) as count FROM user_logins`);
    const total = parseInt(countRes.rows[0]?.count || '0', 10);
    const totalPages = Math.ceil(total / pageSize) || 1;

    const rowsRes = await pool.query(
      `SELECT id, user_id as "userId", email, ip_address as "ipAddress", user_agent as "userAgent",
              login_status as "loginStatus", failure_reason as "failureReason", created_at as "createdAt"
       FROM user_logins
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    return {
      items: rowsRes.rows,
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch (err) {
    if (isConnectionOrAuthError(err)) {
      activateMemoryFallback((err as Error).message);
      return memoryGetPaginatedLogins(page, pageSize);
    }
    throw err;
  }
}

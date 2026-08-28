import { UserRecord, UserProfile, UserDeviceTag, UserLoginRecord, UserWithDetails, PaginatedLogins } from '@/types/auth';
import { hashPassword } from '@/lib/auth/password';

export interface InMemoryDbState {
  users: Map<string, UserRecord>;
  profiles: Map<string, UserProfile>;
  deviceTags: Map<string, UserDeviceTag>;
  logins: UserLoginRecord[];
  isSeeded: boolean;
}

const memoryState: InMemoryDbState = {
  users: new Map(),
  profiles: new Map(),
  deviceTags: new Map(),
  logins: [],
  isSeeded: false,
};

/**
 * Initializes the in-memory database store with the default administrator account.
 */
export async function initMemoryDb(): Promise<void> {
  if (memoryState.isSeeded) return;

  const adminId = '00000000-0000-0000-0000-000000000001';
  const now = new Date().toISOString();
  const passwordHash = await hashPassword('AdminPass123!');

  const adminUser: UserRecord = {
    id: adminId,
    username: 'admin',
    email: 'admin@omadanoc.com',
    passwordHash,
    role: 'ADMIN',
    createdAt: now,
    updatedAt: now,
  };

  const adminProfile: UserProfile = {
    id: '00000000-0000-0000-0000-000000000002',
    userId: adminId,
    fullName: 'System Administrator',
    jobTitle: 'Lead NOC Engineer',
    department: 'Network Operations',
    avatarUrl: '',
    theme: 'dark',
    updatedAt: now,
  };

  memoryState.users.set(adminId, adminUser);
  memoryState.profiles.set(adminId, adminProfile);
  memoryState.isSeeded = true;
}

export async function memoryFindUserByEmailOrUsername(identifier: string): Promise<UserRecord | null> {
  await initMemoryDb();
  const lower = identifier.toLowerCase().trim();
  for (const user of memoryState.users.values()) {
    if (user.email.toLowerCase() === lower || user.username.toLowerCase() === lower) {
      return user;
    }
  }
  return null;
}

export async function memoryFindUserById(id: string): Promise<UserRecord | null> {
  await initMemoryDb();
  return memoryState.users.get(id) || null;
}

export async function memoryCreateUser(
  username: string,
  email: string,
  passwordHash: string,
  role: 'ADMIN' | 'USER' = 'USER',
  fullName: string = ''
): Promise<UserRecord> {
  await initMemoryDb();
  const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const user: UserRecord = {
    id,
    username,
    email,
    passwordHash,
    role,
    createdAt: now,
    updatedAt: now,
  };

  const profile: UserProfile = {
    id: `prof-${Date.now()}`,
    userId: id,
    fullName: fullName || username,
    jobTitle: '',
    department: '',
    avatarUrl: '',
    theme: 'dark',
    updatedAt: now,
  };

  memoryState.users.set(id, user);
  memoryState.profiles.set(id, profile);
  return user;
}

export async function memoryUpdateUserRole(id: string, role: 'ADMIN' | 'USER'): Promise<UserRecord | null> {
  await initMemoryDb();
  const user = memoryState.users.get(id);
  if (!user) return null;
  user.role = role;
  user.updatedAt = new Date().toISOString();
  return user;
}

export async function memoryUpdateUserPassword(id: string, newPasswordHash: string): Promise<boolean> {
  await initMemoryDb();
  const user = memoryState.users.get(id);
  if (!user) return false;
  user.passwordHash = newPasswordHash;
  user.updatedAt = new Date().toISOString();
  return true;
}

export async function memoryDeleteUser(id: string): Promise<boolean> {
  await initMemoryDb();
  const user = memoryState.users.get(id);
  if (!user) return false;
  memoryState.users.delete(id);
  memoryState.profiles.delete(id);
  // delete associated device tags
  for (const [tagId, tag] of memoryState.deviceTags.entries()) {
    if (tag.userId === id) {
      memoryState.deviceTags.delete(tagId);
    }
  }
  return true;
}

export async function memoryListAllUsersWithDetails(): Promise<UserWithDetails[]> {
  await initMemoryDb();
  const result: UserWithDetails[] = [];
  for (const user of memoryState.users.values()) {
    const profile = memoryState.profiles.get(user.id);
    const taggedDevices: UserDeviceTag[] = [];
    for (const tag of memoryState.deviceTags.values()) {
      if (tag.userId === user.id) {
        taggedDevices.push(tag);
      }
    }
    result.push({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile,
      taggedDevices,
    });
  }
  return result;
}

export async function memoryGetUserProfile(userId: string): Promise<UserProfile | null> {
  await initMemoryDb();
  return memoryState.profiles.get(userId) || null;
}

export async function memoryUpsertUserProfile(
  userId: string,
  data: Partial<Omit<UserProfile, 'id' | 'userId' | 'updatedAt'>>
): Promise<UserProfile> {
  await initMemoryDb();
  let profile = memoryState.profiles.get(userId);
  const now = new Date().toISOString();

  if (!profile) {
    profile = {
      id: `prof-${Date.now()}`,
      userId,
      fullName: data.fullName || '',
      jobTitle: data.jobTitle || '',
      department: data.department || '',
      avatarUrl: data.avatarUrl || '',
      theme: data.theme || 'dark',
      updatedAt: now,
    };
  } else {
    profile = {
      ...profile,
      ...data,
      updatedAt: now,
    };
  }

  memoryState.profiles.set(userId, profile);
  return profile;
}

export async function memoryGetUserDeviceTags(userId: string): Promise<UserDeviceTag[]> {
  await initMemoryDb();
  const tags: UserDeviceTag[] = [];
  for (const tag of memoryState.deviceTags.values()) {
    if (tag.userId === userId) {
      tags.push(tag);
    }
  }
  return tags;
}

export async function memoryTagDeviceToUser(
  userId: string,
  macAddress: string,
  deviceName: string = ''
): Promise<UserDeviceTag> {
  await initMemoryDb();
  const normalizedMac = macAddress.toUpperCase().trim();
  // Check if exists
  for (const tag of memoryState.deviceTags.values()) {
    if (tag.userId === userId && tag.macAddress === normalizedMac) {
      tag.deviceName = deviceName || tag.deviceName;
      return tag;
    }
  }

  const id = `tag-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const tag: UserDeviceTag = {
    id,
    userId,
    macAddress: normalizedMac,
    deviceName,
    createdAt: new Date().toISOString(),
  };

  memoryState.deviceTags.set(id, tag);
  return tag;
}

export async function memoryRemoveDeviceTagFromUser(userId: string, macAddress: string): Promise<boolean> {
  await initMemoryDb();
  const normalizedMac = macAddress.toUpperCase().trim();
  for (const [tagId, tag] of memoryState.deviceTags.entries()) {
    if (tag.userId === userId && tag.macAddress === normalizedMac) {
      memoryState.deviceTags.delete(tagId);
      return true;
    }
  }
  return false;
}

export async function memoryRecordLoginAttempt(
  userId: string | null,
  email: string,
  ipAddress: string,
  userAgent: string,
  loginStatus: 'SUCCESS' | 'FAILED',
  failureReason: string | null = null
): Promise<void> {
  await initMemoryDb();
  const record: UserLoginRecord = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    userId,
    email,
    ipAddress,
    userAgent,
    loginStatus,
    failureReason,
    createdAt: new Date().toISOString(),
  };
  memoryState.logins.unshift(record); // Prepend to top
}

export async function memoryGetPaginatedLogins(page: number = 1, pageSize: number = 10): Promise<PaginatedLogins> {
  await initMemoryDb();
  const total = memoryState.logins.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (page - 1) * pageSize;
  const items = memoryState.logins.slice(offset, offset + pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
  };
}

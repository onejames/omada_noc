import { describe, it, expect, beforeEach } from 'vitest';
import {
  initMemoryDb,
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
} from '@/lib/db/memory';

describe('In-Memory Database Store (Development Fallback)', () => {
  beforeEach(async () => {
    await initMemoryDb();
  });

  it('initializes and finds default admin user by email or username', async () => {
    const userByEmail = await memoryFindUserByEmailOrUsername('admin@omadanoc.com');
    expect(userByEmail).not.toBeNull();
    expect(userByEmail?.username).toBe('admin');
    expect(userByEmail?.role).toBe('ADMIN');

    const userByUsername = await memoryFindUserByEmailOrUsername('ADMIN');
    expect(userByUsername?.id).toBe(userByEmail?.id);

    const userById = await memoryFindUserById(userByEmail!.id);
    expect(userById?.email).toBe('admin@omadanoc.com');

    const nonExistent = await memoryFindUserByEmailOrUsername('nonexistent@user.com');
    expect(nonExistent).toBeNull();
  });

  it('creates, updates, and deletes users in memory', async () => {
    const newUser = await memoryCreateUser('testuser', 'test@example.com', 'hashed123', 'USER', 'Test Operator');
    expect(newUser.username).toBe('testuser');
    expect(newUser.email).toBe('test@example.com');
    expect(newUser.role).toBe('USER');

    // Update role
    const updated = await memoryUpdateUserRole(newUser.id, 'ADMIN');
    expect(updated?.role).toBe('ADMIN');

    // Update role for non-existent user
    const noRole = await memoryUpdateUserRole('fake-id', 'USER');
    expect(noRole).toBeNull();

    // Update password
    const pwUpdated = await memoryUpdateUserPassword(newUser.id, 'newhash456');
    expect(pwUpdated).toBe(true);

    // Update password for non-existent user
    const noPw = await memoryUpdateUserPassword('fake-id', 'newhash');
    expect(noPw).toBe(false);

    // List all users
    const allUsers = await memoryListAllUsersWithDetails();
    expect(allUsers.length).toBeGreaterThanOrEqual(2);

    // Delete user
    const deleted = await memoryDeleteUser(newUser.id);
    expect(deleted).toBe(true);

    // Delete non-existent user
    const noDel = await memoryDeleteUser('fake-id');
    expect(noDel).toBe(false);

    const check = await memoryFindUserById(newUser.id);
    expect(check).toBeNull();
  });

  it('manages user profiles in memory for existing and new users', async () => {
    const profile = await memoryGetUserProfile('00000000-0000-0000-0000-000000000001');
    expect(profile).not.toBeNull();
    expect(profile?.fullName).toBe('System Administrator');

    const updatedProfile = await memoryUpsertUserProfile('00000000-0000-0000-0000-000000000001', {
      jobTitle: 'Principal NOC Architect',
      department: 'Infrastructure',
    });
    expect(updatedProfile.jobTitle).toBe('Principal NOC Architect');
    expect(updatedProfile.department).toBe('Infrastructure');

    // Upsert profile for a new user without existing profile
    const newProfile = await memoryUpsertUserProfile('brand-new-user-id', {
      fullName: 'New Person',
      jobTitle: 'Junior Ops',
    });
    expect(newProfile.fullName).toBe('New Person');
    // Get non-existent profile
    const nonExistentProfile = await memoryGetUserProfile('completely-fake-id');
    expect(nonExistentProfile).toBeNull();
  });

  it('tags, retrieves, updates existing tags, and removes devices for users', async () => {
    // Check user with zero tags
    const emptyTags = await memoryGetUserDeviceTags('user-with-zero-tags');
    expect(emptyTags).toEqual([]);

    const tag = await memoryTagDeviceToUser('00000000-0000-0000-0000-000000000001', '00:11:22:33:44:55', 'Core Gateway');
    expect(tag.macAddress).toBe('00:11:22:33:44:55');
    expect(tag.deviceName).toBe('Core Gateway');

    // Update existing tag deviceName
    const updatedTag = await memoryTagDeviceToUser('00000000-0000-0000-0000-000000000001', '00:11:22:33:44:55', 'Updated Gateway');
    expect(updatedTag.deviceName).toBe('Updated Gateway');

    const tags = await memoryGetUserDeviceTags('00000000-0000-0000-0000-000000000001');
    expect(tags.some((t) => t.macAddress === '00:11:22:33:44:55')).toBe(true);

    const removed = await memoryRemoveDeviceTagFromUser('00000000-0000-0000-0000-000000000001', '00:11:22:33:44:55');
    expect(removed).toBe(true);

    // Remove non-existent tag
    const removedNonExistent = await memoryRemoveDeviceTagFromUser('00000000-0000-0000-0000-000000000001', '99:99:99:99:99:99');
    expect(removedNonExistent).toBe(false);

    const tagsAfter = await memoryGetUserDeviceTags('00000000-0000-0000-0000-000000000001');
    expect(tagsAfter.some((t) => t.macAddress === '00:11:22:33:44:55')).toBe(false);
  });

  it('records and paginates login audit history in memory', async () => {
    await memoryRecordLoginAttempt(null, 'admin@omadanoc.com', '127.0.0.1', 'Mozilla/5.0', 'SUCCESS', null);
    await memoryRecordLoginAttempt(null, 'unknown@omadanoc.com', '127.0.0.1', 'Mozilla/5.0', 'FAILED', 'Invalid password');

    const logins = await memoryGetPaginatedLogins(1, 10);
    expect(logins.total).toBeGreaterThanOrEqual(2);
    expect(logins.items.length).toBeGreaterThanOrEqual(2);
    expect(logins.items[0].email).toBe('unknown@omadanoc.com');
  });
});

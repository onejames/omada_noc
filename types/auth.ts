export type UserRole = 'ADMIN' | 'USER';

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  fullName: string;
  jobTitle: string;
  department: string;
  avatarUrl: string;
  theme: 'dark' | 'light' | 'system';
  updatedAt: string;
}

export interface UserDeviceTag {
  id: string;
  userId: string;
  macAddress: string;
  deviceName?: string;
  createdAt: string;
}

export interface UserLoginRecord {
  id: string;
  userId: string | null;
  email: string;
  ipAddress: string;
  userAgent: string;
  loginStatus: 'SUCCESS' | 'FAILED';
  failureReason: string | null;
  createdAt: string;
}

export interface SessionPayload {
  userId: string;
  username: string;
  email: string;
  role: UserRole;
  fullName?: string;
  lastActive: number; // epoch ms for sliding 15-min inactivity check
  exp?: number;
}

export interface UserWithDetails extends UserRecord {
  profile?: UserProfile;
  taggedDevices: UserDeviceTag[];
}

export interface PaginatedLogins {
  items: UserLoginRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

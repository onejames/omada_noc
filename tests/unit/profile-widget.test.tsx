import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProfileWidget from '@/app/components/ProfileWidget';

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => '/',
}));

describe('ProfileWidget Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially and then displays user info and opens dropdown', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            authenticated: true,
            user: {
              id: 'u-1',
              username: 'admin',
              email: 'admin@omadanoc.com',
              role: 'ADMIN',
              fullName: 'System Admin',
              jobTitle: 'Lead Engineer',
              department: 'NOC',
            },
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const { unmount } = render(<ProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('System Admin')).toBeInTheDocument();
      expect(screen.getByText('ADMIN')).toBeInTheDocument();
    });

    // Click to open dropdown
    const toggleBtn = screen.getByRole('button', { name: /user profile menu/i });
    fireEvent.click(toggleBtn);

    const telemetryLink = screen.getByText('Telemetry Dashboard');
    const profileLink = screen.getByText('Edit Profile & Password');
    const adminLink = screen.getByText(/user management & audits/i);

    expect(telemetryLink).toBeInTheDocument();
    expect(profileLink).toBeInTheDocument();
    expect(adminLink).toBeInTheDocument();

    // Click links to cover onClick handlers
    fireEvent.click(telemetryLink);
    fireEvent.click(toggleBtn);
    fireEvent.click(profileLink);
    fireEvent.click(toggleBtn);
    fireEvent.click(adminLink);

    // Click outside to close dropdown
    fireEvent.click(toggleBtn);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Telemetry Dashboard')).not.toBeInTheDocument();

    // Open again and click Sign Out
    fireEvent.click(toggleBtn);
    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    });

    unmount();
  });

  it('handles logout failure gracefully', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            authenticated: true,
            user: { id: 'u-1', username: 'admin', role: 'ADMIN' },
          }),
        };
      }
      if (url.includes('/api/auth/logout')) {
        throw new Error('Logout network error');
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    render(<ProfileWidget />);
    await waitFor(() => {
      expect(screen.getByText('admin')).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole('button', { name: /user profile menu/i });
    fireEvent.click(toggleBtn);
    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('redirects to /login when /api/auth/me returns 401 on protected page', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ authenticated: false, user: null }),
    });

    render(<ProfileWidget />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('renders Sign In link when user is unauthenticated on login page', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ authenticated: false, user: null }),
    });

    render(<ProfileWidget />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
    });
  });

  it('renders custom avatar image when avatarUrl is present and handles fetch error', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    render(<ProfileWidget />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        authenticated: true,
        user: {
          id: 'u-2',
          username: 'custom_avatar_user',
          email: 'avatar@test.com',
          role: 'USER',
          avatarUrl: 'https://example.com/avatar.png',
        },
      }),
    });

    render(<ProfileWidget />);

    await waitFor(() => {
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });

  it('renders with align="left" configuration', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        authenticated: true,
        user: { id: 'u-3', username: 'left_align', role: 'ADMIN' },
      }),
    });

    render(<ProfileWidget align="left" />);

    await waitFor(() => {
      expect(screen.getByText('left_align')).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole('button', { name: /user profile menu/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByText('Telemetry Dashboard')).toBeInTheDocument();
  });

  it('renders initials properly when fullName is empty and user is standard USER', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        authenticated: true,
        user: { id: 'u-4', username: 'guest_user', role: 'USER', fullName: '' },
      }),
    });

    render(<ProfileWidget />);

    await waitFor(() => {
      expect(screen.getByText('G')).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole('button', { name: /user profile menu/i });
    fireEvent.click(toggleBtn);
    const dashLink = screen.getByText('Telemetry Dashboard');
    fireEvent.click(dashLink);
  });

  it('tests getInitials utility function', async () => {
    const { getInitials } = await import('@/app/components/ProfileWidget');
    expect(getInitials('John Doe')).toBe('JD');
    expect(getInitials('Alice')).toBe('A');
    expect(getInitials('')).toBe('U');
    expect(getInitials('  First   Last  ')).toBe('FL');
  });
});

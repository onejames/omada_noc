import React from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import InactivityTracker from '@/app/components/InactivityTracker';

const mockPush = vi.fn();
const mockRefresh = vi.fn();
let mockPathname = '/';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => mockPathname,
}));

describe('InactivityTracker Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockPathname = '/';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers inactivity logout after 15 minutes of user silence and redirects via router', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    render(<InactivityTracker />);

    // Advance time by 14 minutes (no timeout yet)
    await act(async () => {
      vi.advanceTimersByTime(14 * 60 * 1000);
    });
    expect(global.fetch).not.toHaveBeenCalled();

    // User moves mouse (resets timer)
    fireEvent.mouseMove(window);

    // Advance another 10 minutes
    await act(async () => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });
    expect(global.fetch).not.toHaveBeenCalled();

    // Advance remaining 5+ minutes (total 15 min without activity)
    await act(async () => {
      vi.advanceTimersByTime(6 * 60 * 1000);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    expect(mockPush).toHaveBeenCalledWith('/login?reason=inactivity');
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('does nothing and clears timer when already on /login route', async () => {
    mockPathname = '/login';
    global.fetch = vi.fn();

    render(<InactivityTracker />);

    await act(async () => {
      vi.advanceTimersByTime(20 * 60 * 1000);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

import React from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import InactivityTracker from '@/app/components/InactivityTracker';

describe('InactivityTracker Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers inactivity logout after 15 minutes of user silence', async () => {
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
  });
});

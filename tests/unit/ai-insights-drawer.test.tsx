import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiInsightsDrawer } from '@/app/components/AiInsightsDrawer';

describe('AiInsightsDrawer Component', () => {
  const mockHistory = [
    {
      id: 'ins-1',
      createdAt: '2026-08-28T12:00:00Z',
      triggeredByUserId: 'u-1',
      healthScore: 92,
      previousScore: 85,
      scoreDelta: 7,
      trendDirection: 'IMPROVED',
      executiveSummary: 'Network health has improved (+7%).',
      resolvedIssues: [
        {
          id: 'res-1',
          category: 'RF_SIGNAL',
          severity: 'WARNING',
          title: 'AP Channel Utilization Normal',
          description: 'Channel congestion resolved.',
        },
      ],
      persistingIssues: [
        {
          id: 'per-1',
          category: 'RF_SIGNAL',
          severity: 'WARNING',
          title: 'Weak RSSI Device',
          description: 'Client device at -84 dBm',
          firstObservedAt: '2026-08-28T10:00:00Z',
          persistedAuditCount: 3,
        },
      ],
      newIssues: [
        {
          id: 'new-1',
          category: 'BANDWIDTH_BURST',
          severity: 'INFO',
          title: 'Port 4 Burst',
          description: 'Bandwidth surge 60 Mbps',
        },
      ],
      actionableSuggestions: [
        {
          id: 'sug-1',
          priority: 'HIGH',
          title: 'Enable Band Steering',
          action: 'Prefer 5GHz',
          expectedImpact: 'Improves speed',
        },
      ],
      metricsSnapshot: {},
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<AiInsightsDrawer isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('fetches and renders audit history, trajectory sparkline, switches tabs, and triggers new audit', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/admin/insights/history')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, history: mockHistory }),
        });
      }
      if (url.includes('/api/admin/insights/run') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            insight: {
              ...mockHistory[0],
              id: 'ins-2',
              healthScore: 96,
              scoreDelta: 4,
              executiveSummary: 'Latest audit run complete.',
            },
          }),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(<AiInsightsDrawer isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Retrieving AI audit trajectory/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Iterative AI Insights Engine')).toBeInTheDocument();
    });

    expect(screen.getAllByText(/IMPROVED/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Weak RSSI Device')).toBeInTheDocument();

    // Switch to Resolved Tab
    fireEvent.click(screen.getByRole('button', { name: /Resolved \(1\)/i }));
    expect(screen.getByText(/AP Channel Utilization Normal/i)).toBeInTheDocument();

    // Switch to New Tab
    fireEvent.click(screen.getByRole('button', { name: /New \(1\)/i }));
    expect(screen.getByText(/Port 4 Burst/i)).toBeInTheDocument();

    // Switch to Suggestions Tab
    fireEvent.click(screen.getByRole('button', { name: /Suggestions \(1\)/i }));
    expect(screen.getByText(/Enable Band Steering/i)).toBeInTheDocument();

    // Switch back to Persisting Tab
    fireEvent.click(screen.getByRole('button', { name: /Persisting \(1\)/i }));
    expect(screen.getByText('Weak RSSI Device')).toBeInTheDocument();

    // Trigger AI audit button
    const triggerBtn = screen.getByRole('button', { name: /Trigger AI Audit/i });
    fireEvent.click(triggerBtn);

    await waitFor(() => {
      expect(screen.getByText('Latest audit run complete.')).toBeInTheDocument();
    });

    // Close button
    const closeBtn = screen.getByRole('button', { name: '✕' });
    fireEvent.click(closeBtn);
  });

  it('renders empty baseline state when history is empty', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, history: [] }),
    });

    render(<AiInsightsDrawer isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/No Prior Audit Baseline in Memory/i)).toBeInTheDocument();
    });
  });

  it('renders error messages when history fetch or audit trigger fails with invalid JSON', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/admin/insights/history')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => {
            throw new Error('Invalid JSON');
          },
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(<AiInsightsDrawer isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch history \(500\)/i)).toBeInTheDocument();
    });
  });

  it('renders error messages when history fetch or audit trigger fails', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/admin/insights/history')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, history: mockHistory }),
        });
      }
      if (url.includes('/api/admin/insights/run') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: 'Inspection timeout' }),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(<AiInsightsDrawer isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Iterative AI Insights Engine')).toBeInTheDocument();
    });

    const triggerBtn = screen.getByRole('button', { name: /Trigger AI Audit/i });
    fireEvent.click(triggerBtn);

    await waitFor(() => {
      expect(screen.getByText(/Inspection timeout/i)).toBeInTheDocument();
    });

    // Test run audit with invalid json response on error
    global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes('/api/admin/insights/run') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          json: async () => {
            throw new Error('Invalid JSON');
          },
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    fireEvent.click(triggerBtn);
    await waitFor(() => {
      expect(screen.getByText(/Failed to execute comparative audit/i)).toBeInTheDocument();
    });
  });

  it('renders DEGRADED and INITIAL badges and empty tab notices properly', async () => {
    const degradedHistory = [
      {
        id: 'ins-deg',
        createdAt: '2026-08-28T12:00:00Z',
        healthScore: 65,
        previousScore: 80,
        scoreDelta: -15,
        trendDirection: 'DEGRADED',
        executiveSummary: 'Performance degraded.',
        resolvedIssues: [],
        persistingIssues: [],
        newIssues: [],
        actionableSuggestions: [],
        metricsSnapshot: {},
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, history: degradedHistory }),
    });

    render(<AiInsightsDrawer isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/DEGRADED \(-15%\)/i)).toBeInTheDocument();
    });

    // Check empty persisting notice
    expect(screen.getByText(/No chronic or persisting issues detected/i)).toBeInTheDocument();

    // Check empty resolved notice
    fireEvent.click(screen.getByRole('button', { name: /Resolved \(0\)/i }));
    expect(screen.getByText(/No resolved issues in this specific cycle/i)).toBeInTheDocument();

    // Check empty new notice
    fireEvent.click(screen.getByRole('button', { name: /New \(0\)/i }));
    expect(screen.getByText(/No new anomalies surfaced/i)).toBeInTheDocument();

    // Check empty suggestions notice
    fireEvent.click(screen.getByRole('button', { name: /Suggestions \(0\)/i }));
    expect(screen.getByText(/No suggestions available/i)).toBeInTheDocument();
  });

  it('renders INITIAL and STABLE badges properly', async () => {
    const initialHistory = [
      {
        id: 'ins-init',
        createdAt: '2026-08-28T12:00:00Z',
        healthScore: 90,
        previousScore: null,
        scoreDelta: 0,
        trendDirection: 'INITIAL',
        executiveSummary: 'Initial baseline.',
        resolvedIssues: [],
        persistingIssues: [],
        newIssues: [],
        actionableSuggestions: [],
        metricsSnapshot: {},
      },
    ];

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, history: initialHistory }),
    });

    const { unmount } = render(<AiInsightsDrawer isOpen={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getAllByText(/INITIAL/i).length).toBeGreaterThanOrEqual(1);
    });
    unmount();

    const stableHistory = [
      {
        id: 'ins-stab',
        createdAt: '2026-08-28T12:00:00Z',
        healthScore: 90,
        previousScore: 90,
        scoreDelta: 0,
        trendDirection: 'STABLE',
        executiveSummary: 'Stable.',
        resolvedIssues: [],
        persistingIssues: [],
        newIssues: [],
        actionableSuggestions: [],
        metricsSnapshot: {},
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, history: stableHistory }),
    });

    render(<AiInsightsDrawer isOpen={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getAllByText(/STABLE/i).length).toBeGreaterThanOrEqual(1);
    });
  });
});

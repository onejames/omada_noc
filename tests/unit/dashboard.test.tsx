import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Dashboard from '@/app/components/Dashboard';
import { TelemetryResponse } from '@/types/omada';

const mockInitialData: TelemetryResponse = {
  status: {
    controllerOnline: true,
    omadacId: 'omada-abc-123456789',
    siteId: 'site-hex-123',
    siteName: 'Headquarters',
    totalClients: 4,
    wirelessClients: 2,
    wiredClients: 2,
    totalActivityRate: 1048576,
    totalTrafficDown: 50000000,
    totalTrafficUp: 20000000,
    lastUpdated: '2026-08-26T00:00:00.000Z',
    error: null,
  },
  topClients: [
    {
      mac: 'AA-BB-CC-DD-EE-01',
      name: 'MacBook Pro',
      hostName: 'macbook-pro.local',
      ip: '192.168.1.10',
      wireless: true,
      ssid: 'Corp-WiFi',
      apName: 'AP-Lobby',
      rssi: -55,
      activity: 524288,
      trafficDown: 30000000,
      trafficUp: 10000000,
      uptime: 7200,
      guest: false,
    },
    {
      mac: 'AA-BB-CC-DD-EE-02',
      name: 'Core Server',
      ip: '192.168.1.20',
      wireless: false,
      switchName: 'Core-Switch',
      port: 8,
      activity: 524288,
      trafficDown: 20000000,
      trafficUp: 10000000,
      uptime: 86400,
      guest: false,
    },
    {
      mac: 'AA-BB-CC-DD-EE-03',
      name: 'Executive iPad',
      ip: '192.168.1.30',
      wireless: true,
      ssid: 'Corp-WiFi',
      rssi: -72,
      activity: 0,
      trafficDown: 1000000,
      trafficUp: 200000,
      uptime: 1800,
      guest: false,
    },
    {
      mac: 'AA-BB-CC-DD-EE-04',
      name: undefined,
      hostName: 'guest-phone.local',
      ip: '192.168.1.40',
      wireless: true,
      ssid: 'Guest-WiFi',
      activity: 0,
      trafficDown: 500000,
      trafficUp: 100000,
      uptime: 600,
      guest: true,
    },
  ],
};

describe('Dashboard Client Component', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ authenticated: false, user: null }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => mockInitialData,
      };
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('renders dashboard headers, status pill, and client table with metric cards', () => {
    render(<Dashboard initialData={mockInitialData} />);

    expect(screen.getByText(/Omada NOC Telemetry/i)).toBeInTheDocument();
    expect(screen.getByText(/MCP Bridge/i)).toBeInTheDocument();
    expect(screen.getByText(/Headquarters/i)).toBeInTheDocument();
    expect(screen.getByText(/ID: omada-ab/i)).toBeInTheDocument();
    expect(screen.getByText(/Controller Online/i)).toBeInTheDocument();

    expect(screen.getByText('MacBook Pro')).toBeInTheDocument();
    expect(screen.getByText('Core Server')).toBeInTheDocument();
    expect(screen.getByText('Executive iPad')).toBeInTheDocument();
    expect(screen.getByText('guest-phone.local')).toBeInTheDocument();
  });

  it('handles status with missing siteName and missing omadacId', () => {
    const dataWithoutSiteName: TelemetryResponse = {
      status: {
        controllerOnline: true,
        omadacId: null,
        siteId: 'site-default',
        siteName: undefined,
        totalClients: 0,
        wirelessClients: 0,
        wiredClients: 0,
        totalActivityRate: 0,
        totalTrafficDown: 0,
        totalTrafficUp: 0,
        lastUpdated: '2026-08-26T00:00:00.000Z',
        error: null,
      },
      topClients: [],
    };

    render(<Dashboard initialData={dataWithoutSiteName} />);
    expect(screen.getByText('site-default')).toBeInTheDocument();
  });

  it('filters clients when typing in search input across hostName, MAC, and SSID', async () => {
    render(<Dashboard initialData={mockInitialData} />);

    const searchInput = screen.getByPlaceholderText(/search by device, ip, mac, or ssid/i);

    // Search by hostname
    fireEvent.change(searchInput, { target: { value: 'macbook-pro' } });
    expect(screen.getByText('MacBook Pro')).toBeInTheDocument();
    expect(screen.queryByText('Core Server')).not.toBeInTheDocument();

    // Search by MAC
    fireEvent.change(searchInput, { target: { value: 'EE-02' } });
    expect(screen.getByText('Core Server')).toBeInTheDocument();
    expect(screen.queryByText('MacBook Pro')).not.toBeInTheDocument();

    // Search by SSID
    fireEvent.change(searchInput, { target: { value: 'Guest-WiFi' } });
    expect(screen.getByText('guest-phone.local')).toBeInTheDocument();
    expect(screen.queryByText('MacBook Pro')).not.toBeInTheDocument();

    // Search unmatched
    fireEvent.change(searchInput, { target: { value: 'nonexistent-device' } });
    expect(screen.getByText(/no client telemetry records found/i)).toBeInTheDocument();
  });

  it('filters clients by medium (All, Wireless, Wired)', () => {
    render(<Dashboard initialData={mockInitialData} />);

    // Click Wireless tab
    const wirelessTab = screen.getByRole('button', { name: /^wireless/i });
    fireEvent.click(wirelessTab);
    expect(screen.getByText('MacBook Pro')).toBeInTheDocument();
    expect(screen.queryByText('Core Server')).not.toBeInTheDocument();

    // Click Wired tab
    const wiredTab = screen.getByRole('button', { name: /^wired/i });
    fireEvent.click(wiredTab);
    expect(screen.getByText('Core Server')).toBeInTheDocument();
    expect(screen.queryByText('MacBook Pro')).not.toBeInTheDocument();

    // Click All tab
    const allTab = screen.getByRole('button', { name: /^all/i });
    fireEvent.click(allTab);
    expect(screen.getByText('MacBook Pro')).toBeInTheDocument();
    expect(screen.getByText('Core Server')).toBeInTheDocument();
  });

  it('sorts clients when changing sort option between activity, traffic, and uptime', () => {
    render(<Dashboard initialData={mockInitialData} />);

    const sortSelect = screen.getByRole('combobox', { name: /sort clients by/i });

    // Sort by traffic
    fireEvent.change(sortSelect, { target: { value: 'traffic' } });
    expect(sortSelect).toHaveValue('traffic');

    // Sort by uptime
    fireEvent.change(sortSelect, { target: { value: 'uptime' } });
    expect(sortSelect).toHaveValue('uptime');

    // Sort by activity
    fireEvent.change(sortSelect, { target: { value: 'activity' } });
    expect(sortSelect).toHaveValue('activity');
  });

  it('handles manual refresh and updates data', async () => {
    const updatedData: TelemetryResponse = {
      status: {
        ...mockInitialData.status,
        totalClients: 5,
        totalActivityRate: 2097152,
      },
      topClients: mockInitialData.topClients,
    };

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/auth/me')) {
        return { ok: true, status: 200, json: async () => ({ authenticated: false }) };
      }
      return { ok: true, status: 200, json: async () => updatedData };
    });

    render(<Dashboard initialData={mockInitialData} />);

    const refreshBtn = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/telemetry'));
    });
  });

  it('handles refresh failure with error json response and network exception', async () => {
    // 1. HTTP error response
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/auth/me')) {
        return { ok: true, status: 200, json: async () => ({ authenticated: false }) };
      }
      return {
        ok: false,
        status: 503,
        json: async () => ({ error: 'Controller communication timed out' }),
      };
    });

    render(<Dashboard initialData={mockInitialData} />);

    const refreshBtn = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(screen.getByText(/Controller Offline/i)).toBeInTheDocument();
      expect(screen.getByText(/Controller communication timed out/i)).toBeInTheDocument();
    });

    // 2. Network rejection
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/auth/me')) {
        return { ok: true, status: 200, json: async () => ({ authenticated: false }) };
      }
      throw new Error('Network disconnected');
    });

    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(screen.getByText(/Network disconnected/i)).toBeInTheDocument();
    });
  });

  it('triggers auto-refresh on timer and allows changing intervals or pausing', async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/auth/me')) {
        return { ok: true, status: 200, json: async () => ({ authenticated: false }) };
      }
      return { ok: true, status: 200, json: async () => mockInitialData };
    });

    render(<Dashboard initialData={mockInitialData} />);

    const pollingSelect = screen.getByRole('combobox', { name: /polling interval/i });
    // Switch to 5s
    fireEvent.change(pollingSelect, { target: { value: '5' } });

    // Advance timers by 5s
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/telemetry'));

    // Pause polling (0)
    fireEvent.change(pollingSelect, { target: { value: '0' } });
    const callCountBefore = (global.fetch as any).mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(15000);
    });

    expect((global.fetch as any).mock.calls.length).toBe(callCountBefore);
  });

  it('renders offline warning banner when initial status is offline and allows dismissal and retry', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockInitialData,
    });

    const offlineData: TelemetryResponse = {
      status: {
        controllerOnline: false,
        omadacId: null,
        siteId: 'site-hex-123',
        siteName: 'Headquarters',
        totalClients: 0,
        wirelessClients: 0,
        wiredClients: 0,
        totalActivityRate: 0,
        totalTrafficDown: 0,
        totalTrafficUp: 0,
        lastUpdated: '2026-08-26T00:00:00.000Z',
        error: 'Host unreachable',
      },
      topClients: [],
    };

    render(<Dashboard initialData={offlineData} />);
    expect(screen.getByText(/Controller Offline/i)).toBeInTheDocument();
    expect(screen.getByText(/Host unreachable/i)).toBeInTheDocument();

    // Click retry
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/telemetry'));

    // Click dismiss button
    const dismissBtn = screen.getByRole('button', { name: /dismiss connection notice/i });
    fireEvent.click(dismissBtn);
    expect(screen.queryByText(/Host unreachable/i)).not.toBeInTheDocument();
  });

  it('opens executive reports modal, admin AI insights drawer, and docs modal when buttons are clicked', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            authenticated: true,
            user: { id: 'u1', username: 'admin', role: 'ADMIN' },
          }),
        });
      }
      if (url.includes('/api/reports/summary')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, report: null }),
        });
      }
      if (url.includes('/api/admin/insights/history')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, history: [] }),
        });
      }
      if (url.includes('/api/docs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            total: 1,
            docs: [
              {
                slug: 'prd',
                filename: 'PRD.md',
                title: 'Product Requirements Document',
                category: 'Product & Strategy',
                excerpt: 'PRD details',
                content: '# PRD\n\nDetails',
                size: 1024,
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<Dashboard initialData={mockInitialData} />);

    // Wait for auth/me to resolve and set role to ADMIN
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /AI Insights/i })[0]).toBeInTheDocument();
    });

    // Click Executive Report button from navigation strip
    const reportBtns = screen.getAllByRole('button', { name: /Executive Report/i });
    fireEvent.click(reportBtns[0]);

    // Modal should be open
    expect(screen.getByText(/Executive Telemetry & SLA Report/i)).toBeInTheDocument();

    // Click AI Insights button
    const aiBtns = screen.getAllByRole('button', { name: /AI Insights/i });
    fireEvent.click(aiBtns[0]);

    // Drawer should be open
    expect(screen.getByText(/Iterative AI Insights Engine/i)).toBeInTheDocument();

    // Click Docs button
    const docsBtns = screen.getAllByRole('button', { name: /Docs/i });
    fireEvent.click(docsBtns[0]);

    // Docs modal should be open
    await waitFor(() => {
      expect(screen.getByText(/System Documentation & Architecture Dossier/i)).toBeInTheDocument();
    });

    // Test controls under search bar
    const genReportBtn = screen.getByRole('button', { name: /Generate Executive PDF Report/i });
    fireEvent.click(genReportBtn);

    const auditBtn = screen.getByRole('button', { name: /AI Continuous Health Audit/i });
    fireEvent.click(auditBtn);

    const viewDocsBtn = screen.getByRole('button', { name: /View System Specs & Docs/i });
    fireEvent.click(viewDocsBtn);

    // Close buttons
    const closeButtons = screen.getAllByRole('button', { name: '✕' });
    closeButtons.forEach((btn) => fireEvent.click(btn));
  });
});

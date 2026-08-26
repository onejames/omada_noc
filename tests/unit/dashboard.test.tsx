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
      name: 'Guest Phone',
      ip: '192.168.1.30',
      wireless: true,
      ssid: 'Guest-WiFi',
      activity: 0,
      trafficDown: 0,
      trafficUp: 0,
      uptime: 1800,
      guest: true,
    },
    {
      mac: 'AA-BB-CC-DD-EE-04',
      name: undefined,
      hostName: undefined,
      ip: '192.168.1.40',
      wireless: false,
      switchName: undefined,
      port: undefined,
      activity: 0,
      trafficDown: 0,
      trafficUp: 0,
      uptime: 0,
      guest: false,
    },
  ],
  allClients: [
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
      name: 'Guest Phone',
      ip: '192.168.1.30',
      wireless: true,
      ssid: 'Guest-WiFi',
      activity: 0,
      trafficDown: 0,
      trafficUp: 0,
      uptime: 1800,
      guest: true,
    },
    {
      mac: 'AA-BB-CC-DD-EE-04',
      name: undefined,
      hostName: undefined,
      ip: '192.168.1.40',
      wireless: false,
      switchName: undefined,
      port: undefined,
      activity: 0,
      trafficDown: 0,
      trafficUp: 0,
      uptime: 0,
      guest: false,
    },
  ],
};

describe('Dashboard Client Component', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('renders dashboard headers, status pill, and client table with metric cards', () => {
    render(<Dashboard initialData={mockInitialData} />);

    expect(screen.getByText('Omada NOC Telemetry')).toBeInTheDocument();
    expect(screen.getByText('Headquarters')).toBeInTheDocument();
    expect(screen.getByText('Controller Online')).toBeInTheDocument();
    expect(screen.getByText('MacBook Pro')).toBeInTheDocument();
    expect(screen.getByText('macbook-pro.local')).toBeInTheDocument();
    expect(screen.getByText('Core Server')).toBeInTheDocument();
    expect(screen.getByText('Guest Phone')).toBeInTheDocument();
    expect(screen.getByText('Guest')).toBeInTheDocument();
    expect(screen.getByText('Unnamed Device')).toBeInTheDocument();
    expect(screen.getByText(/AP-Lobby/)).toBeInTheDocument();
    expect(screen.getByText(/Core-Switch/)).toBeInTheDocument();
  });

  it('handles status with missing siteName and missing omadacId', () => {
    const customData: TelemetryResponse = {
      status: {
        controllerOnline: true,
        omadacId: null,
        siteId: 'site-only-id',
        siteName: undefined,
        totalClients: 0,
        wirelessClients: 0,
        wiredClients: 0,
        totalActivityRate: 0,
        totalTrafficDown: 0,
        totalTrafficUp: 0,
        lastUpdated: new Date().toISOString(),
      },
      topClients: [],
    };

    render(<Dashboard initialData={customData} />);
    expect(screen.getByText('site-only-id')).toBeInTheDocument();
  });

  it('filters clients when typing in search input across hostName, MAC, and SSID', () => {
    render(<Dashboard initialData={mockInitialData} />);

    const searchInput = screen.getByPlaceholderText(/Search by device/i);
    
    // Search by hostName
    fireEvent.change(searchInput, { target: { value: 'macbook-pro.local' } });
    expect(screen.getByText('MacBook Pro')).toBeInTheDocument();
    expect(screen.queryByText('Core Server')).not.toBeInTheDocument();

    // Search by MAC
    fireEvent.change(searchInput, { target: { value: 'EE-02' } });
    expect(screen.getByText('Core Server')).toBeInTheDocument();

    // Search by SSID
    fireEvent.change(searchInput, { target: { value: 'Guest-WiFi' } });
    expect(screen.getByText('Guest Phone')).toBeInTheDocument();

    // Search query with no match
    fireEvent.change(searchInput, { target: { value: 'NonExistent' } });
    expect(screen.getByText(/No clients matched filter "NonExistent"/i)).toBeInTheDocument();
  });

  it('filters clients by medium (All, Wireless, Wired)', () => {
    render(<Dashboard initialData={mockInitialData} />);

    const wirelessBtn = screen.getByRole('button', { name: /Wireless/i });
    const wiredBtn = screen.getByRole('button', { name: /Wired/i });
    const allBtn = screen.getByRole('button', { name: /All/i });

    // Filter Wireless
    fireEvent.click(wirelessBtn);
    expect(screen.getByText('MacBook Pro')).toBeInTheDocument();
    expect(screen.getByText('Guest Phone')).toBeInTheDocument();
    expect(screen.queryByText('Core Server')).not.toBeInTheDocument();

    // Filter Wired
    fireEvent.click(wiredBtn);
    expect(screen.getByText('Core Server')).toBeInTheDocument();
    expect(screen.queryByText('MacBook Pro')).not.toBeInTheDocument();

    // Filter All
    fireEvent.click(allBtn);
    expect(screen.getByText('MacBook Pro')).toBeInTheDocument();
    expect(screen.getByText('Core Server')).toBeInTheDocument();
  });

  it('sorts clients when changing sort option between activity, traffic, and uptime', () => {
    render(<Dashboard initialData={mockInitialData} />);

    const sortSelect = screen.getByRole('combobox', { name: /sort clients by/i });
    
    // Sort by traffic
    fireEvent.change(sortSelect, { target: { value: 'traffic' } });
    expect(sortSelect).toHaveValue('traffic');
    expect(screen.getByText('Core Server')).toBeInTheDocument();

    // Sort by uptime
    fireEvent.change(sortSelect, { target: { value: 'uptime' } });
    expect(sortSelect).toHaveValue('uptime');
    expect(screen.getByText('Core Server')).toBeInTheDocument();

    // Sort by activity
    fireEvent.change(sortSelect, { target: { value: 'activity' } });
    expect(sortSelect).toHaveValue('activity');
    expect(screen.getByText('MacBook Pro')).toBeInTheDocument();
  });

  it('handles manual refresh and updates data', async () => {
    const updatedData: TelemetryResponse = {
      ...mockInitialData,
      status: {
        ...mockInitialData.status,
        totalClients: 4,
      },
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => updatedData,
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
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: 'Controller communication timed out' }),
    });

    render(<Dashboard initialData={mockInitialData} />);

    const refreshBtn = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(screen.getByText(/Controller Offline/i)).toBeInTheDocument();
      expect(screen.getByText(/Controller communication timed out/i)).toBeInTheDocument();
    });

    // 2. Network rejection
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network disconnected'));
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(screen.getByText(/Network disconnected/i)).toBeInTheDocument();
    });
  });

  it('triggers auto-refresh on timer and allows changing intervals or pausing', async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockInitialData,
    });

    render(<Dashboard initialData={mockInitialData} />);

    const pollingSelect = screen.getByRole('combobox', { name: /polling interval/i });
    // Switch to 5s
    fireEvent.change(pollingSelect, { target: { value: '5' } });

    // Advance timers by 5s
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(global.fetch).toHaveBeenCalled();

    // Pause polling
    fireEvent.change(pollingSelect, { target: { value: '0' } });
    global.fetch = vi.fn();

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('renders offline warning banner when initial status is offline', () => {
    const offlineData: TelemetryResponse = {
      status: {
        controllerOnline: false,
        omadacId: null,
        siteId: 'Default',
        totalClients: 0,
        wirelessClients: 0,
        wiredClients: 0,
        totalActivityRate: 0,
        totalTrafficDown: 0,
        totalTrafficUp: 0,
        lastUpdated: new Date().toISOString(),
        error: 'Refused connection',
      },
      topClients: [],
    };

    render(<Dashboard initialData={offlineData} />);
    expect(screen.getByText('Controller Offline')).toBeInTheDocument();
    expect(screen.getByText(/Refused connection/i)).toBeInTheDocument();
    expect(screen.getByText(/No client telemetry records found/i)).toBeInTheDocument();
  });
});

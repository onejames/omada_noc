import { describe, it, expect, vi, beforeEach } from 'vitest';
import Page from '@/app/page';
import * as omadaClientModule from '@/lib/omada/client';

describe('Server Page (app/page.tsx)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Dashboard with initial data when controller is online', async () => {
    const mockStatus = {
      controllerOnline: true,
      omadacId: 'id-123',
      siteId: 'site-123',
      totalClients: 1,
      wirelessClients: 1,
      wiredClients: 0,
      totalActivityRate: 100,
      totalTrafficDown: 1000,
      totalTrafficUp: 500,
      lastUpdated: new Date().toISOString(),
    };

    const mockClients = [
      { mac: '01', name: 'Device 1', ip: '192.168.1.10', wireless: true },
    ];

    const mockClientInstance = {
      getNetworkStatus: vi.fn().mockResolvedValue(mockStatus),
      getActiveClients: vi.fn().mockResolvedValue(mockClients),
    };

    vi.spyOn(omadaClientModule, 'getOmadaClient').mockReturnValue(mockClientInstance as any);

    const jsx = await Page();
    expect(jsx).toBeDefined();
    expect(jsx.props.initialData.status.controllerOnline).toBe(true);
    expect(jsx.props.initialData.topClients).toHaveLength(1);
  });

  it('handles getActiveClients error when controller is online gracefully', async () => {
    const mockStatus = {
      controllerOnline: true,
      omadacId: 'id-123',
      siteId: 'site-123',
      totalClients: 0,
      wirelessClients: 0,
      wiredClients: 0,
      totalActivityRate: 0,
      totalTrafficDown: 0,
      totalTrafficUp: 0,
      lastUpdated: new Date().toISOString(),
    };

    const mockClientInstance = {
      getNetworkStatus: vi.fn().mockResolvedValue(mockStatus),
      getActiveClients: vi.fn().mockRejectedValue(new Error('Fetch failed')),
    };

    vi.spyOn(omadaClientModule, 'getOmadaClient').mockReturnValue(mockClientInstance as any);

    const jsx = await Page();
    expect(jsx).toBeDefined();
    expect(jsx.props.initialData.topClients).toEqual([]);
  });

  it('renders Dashboard with offline status when controller is offline', async () => {
    const mockStatus = {
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
      error: 'Controller unreachable',
    };

    const mockClientInstance = {
      getNetworkStatus: vi.fn().mockResolvedValue(mockStatus),
      getActiveClients: vi.fn(),
    };

    vi.spyOn(omadaClientModule, 'getOmadaClient').mockReturnValue(mockClientInstance as any);

    const jsx = await Page();
    expect(jsx).toBeDefined();
    expect(jsx.props.initialData.status.controllerOnline).toBe(false);
    expect(mockClientInstance.getActiveClients).not.toHaveBeenCalled();
  });
});

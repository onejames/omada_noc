import { describe, it, expect, vi, beforeEach } from 'vitest';
import Page from '@/app/page';
import * as omadaClientModule from '@/lib/omada/client';
import * as sessionModule from '@/lib/auth/session';
import * as dbQueries from '@/lib/db/queries';
import * as navigationModule from 'next/navigation';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('Server Page (app/page.tsx)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(dbQueries, 'findUserById').mockResolvedValue({
      id: 'u-admin',
      username: 'admin',
      email: 'admin@omadanoc.com',
      role: 'ADMIN',
      createdAt: '',
      updatedAt: '',
    });
  });

  it('redirects to /login if user is unauthenticated', async () => {
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(null);

    await Page();
    expect(navigationModule.redirect).toHaveBeenCalledWith('/login');
  });

  it('redirects to /login if session user is no longer found in the database', async () => {
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
      userId: 'u-deleted',
      username: 'ghost',
      email: 'ghost@test.com',
      role: 'USER',
      lastActive: Date.now(),
    });
    vi.spyOn(dbQueries, 'findUserById').mockResolvedValue(null);

    await Page();
    expect(navigationModule.redirect).toHaveBeenCalledWith('/login');
  });

  it('renders Dashboard with initial data for authenticated admin', async () => {
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
      userId: 'u-admin',
      username: 'admin',
      email: 'admin@omadanoc.com',
      role: 'ADMIN',
      lastActive: Date.now(),
    });

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
      { mac: '01', name: 'Device 1', ip: '192.168.1.10', wireless: true, ssid: 'Farm-WiFi', vlanId: 1 },
    ];

    const mockClientInstance = {
      getNetworkStatus: vi.fn().mockResolvedValue(mockStatus),
      getActiveClients: vi.fn().mockResolvedValue(mockClients),
      getTopology: vi.fn().mockResolvedValue([{ type: 'gateway', name: 'G1' }]),
      getLanNetworks: vi.fn().mockResolvedValue([{ id: '1', name: 'Default', vlan: 1 }]),
      getSsids: vi.fn().mockResolvedValue([{ id: 's1', name: 'Farm-WiFi' }]),
      getPoeBudgets: vi.fn().mockResolvedValue([]),
    };

    vi.spyOn(omadaClientModule, 'getOmadaClient').mockReturnValue(mockClientInstance as any);

    const jsx = await Page();
    expect(jsx).toBeDefined();
    expect(jsx!.props.initialData.status.controllerOnline).toBe(true);
    expect(jsx!.props.initialData.topClients).toHaveLength(1);
    expect(jsx!.props.initialData.networks).toHaveLength(1);
    expect(jsx!.props.initialData.ssids).toHaveLength(1);
  });

  it('scopes telemetry and recalculates KPIs for regular users with tagged devices', async () => {
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
      userId: 'u-regular',
      username: 'jdoe',
      email: 'jdoe@test.com',
      role: 'USER',
      lastActive: Date.now(),
    });

    vi.spyOn(dbQueries, 'getUserDeviceTags').mockResolvedValue([
      {
        id: 'tag-1',
        userId: 'u-regular',
        macAddress: '01',
        deviceName: 'My Laptop',
        createdAt: '',
      },
    ]);

    const mockStatus = {
      controllerOnline: true,
      omadacId: 'id-123',
      siteId: 'site-123',
      totalClients: 2,
      wirelessClients: 1,
      wiredClients: 1,
      totalActivityRate: 300,
      totalTrafficDown: 3000,
      totalTrafficUp: 1500,
      lastUpdated: new Date().toISOString(),
    };

    const mockClients = [
      { mac: '01', name: 'My Laptop', wireless: true, activity: 100, trafficDown: 1000, trafficUp: 500 },
      { mac: '02', name: 'Other Device', wireless: false, activity: 200, trafficDown: 2000, trafficUp: 1000 },
    ];

    const mockClientInstance = {
      getNetworkStatus: vi.fn().mockResolvedValue(mockStatus),
      getActiveClients: vi.fn().mockResolvedValue(mockClients),
    };

    vi.spyOn(omadaClientModule, 'getOmadaClient').mockReturnValue(mockClientInstance as any);

    const jsx = await Page();
    expect(jsx).toBeDefined();
    expect(jsx!.props.initialData.topClients).toHaveLength(1);
    expect(jsx!.props.initialData.topClients[0].mac).toBe('01');
    expect(jsx!.props.initialData.status.totalClients).toBe(1);
  });

  it('handles getActiveClients error when controller is online gracefully', async () => {
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
      userId: 'u-admin',
      username: 'admin',
      email: 'admin@omadanoc.com',
      role: 'ADMIN',
      lastActive: Date.now(),
    });

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
    expect(jsx!.props.initialData.topClients).toEqual([]);
  });

  it('renders Dashboard with offline status when controller is offline', async () => {
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
      userId: 'u-admin',
      username: 'admin',
      email: 'admin@omadanoc.com',
      role: 'ADMIN',
      lastActive: Date.now(),
    });

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
    expect(jsx!.props.initialData.status.controllerOnline).toBe(false);
    expect(mockClientInstance.getActiveClients).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/telemetry/route';
import * as omadaClientModule from '@/lib/omada/client';
import * as sessionModule from '@/lib/auth/session';
import * as dbQueries from '@/lib/db/queries';

describe('API Route: /api/telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with telemetry summary and sorted clients when controller is online', async () => {
    const mockClients = [
      { mac: '01', activity: 100, trafficDown: 1000, trafficUp: 500, uptime: 100 },
      { mac: '02', activity: 500, trafficDown: 5000, trafficUp: 2000, uptime: 200 },
    ];

    const mockStatus = {
      controllerOnline: true,
      omadacId: 'id-123',
      siteId: 'site-123',
      siteName: 'Default',
      totalClients: 2,
      wirelessClients: 1,
      wiredClients: 1,
      totalActivityRate: 600,
      totalTrafficDown: 6000,
      totalTrafficUp: 2500,
      lastUpdated: new Date().toISOString(),
      error: null,
    };

    const mockClientInstance = {
      getNetworkStatus: vi.fn().mockResolvedValue(mockStatus),
      getActiveClients: vi.fn().mockResolvedValue(mockClients),
    };

    vi.spyOn(omadaClientModule, 'getOmadaClient').mockReturnValue(mockClientInstance as any);
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(null);

    // Test activity sorting (default) and all=true
    const req1 = new Request('http://localhost:3000/api/telemetry?limit=10&all=true&sort=activity');
    const res1 = await GET(req1);
    expect(res1.status).toBe(200);
    expect(res1.headers.get('Cache-Control')).toContain('no-store');

    const json1 = await res1.json();
    expect(json1.status.controllerOnline).toBe(true);
    expect(json1.topClients[0].mac).toBe('02'); // higher activity
    expect(json1.allClients).toHaveLength(2);

    // Test traffic sorting without all query param (includeAll = false)
    const req2 = new Request('http://localhost:3000/api/telemetry?sort=traffic');
    const res2 = await GET(req2);
    const json2 = await res2.json();
    expect(json2.topClients[0].mac).toBe('02');
    expect(json2.allClients).toBeUndefined();

    // Test uptime sorting without any other params
    const req3 = new Request('http://localhost:3000/api/telemetry?sort=uptime');
    const res3 = await GET(req3);
    const json3 = await res3.json();
    expect(json3.topClients[0].mac).toBe('02');

    // Test fallback sort branch
    const req4 = new Request('http://localhost:3000/api/telemetry?sort=unknown');
    const res4 = await GET(req4);
    const json4 = await res4.json();
    expect(json4.topClients).toHaveLength(2);
  });

  it('scopes telemetry and recalculates KPIs for regular users with tagged devices', async () => {
    const mockClients = [
      { mac: 'AA:BB:CC:DD:EE:01', wireless: true, activity: 100, trafficDown: 1000, trafficUp: 500 },
      { mac: 'AA:BB:CC:DD:EE:02', wireless: false, activity: 200, trafficDown: 2000, trafficUp: 1000 },
      { mac: 'AA:BB:CC:DD:EE:03', wireless: true, activity: 300, trafficDown: 3000, trafficUp: 1500 },
    ];

    const mockStatus = {
      controllerOnline: true,
      omadacId: 'id-123',
      siteId: 'site-123',
      siteName: 'Default',
      totalClients: 3,
      wirelessClients: 2,
      wiredClients: 1,
      totalActivityRate: 600,
      totalTrafficDown: 6000,
      totalTrafficUp: 3000,
      lastUpdated: new Date().toISOString(),
      error: null,
    };

    const mockClientInstance = {
      getNetworkStatus: vi.fn().mockResolvedValue(mockStatus),
      getActiveClients: vi.fn().mockResolvedValue(mockClients),
    };

    vi.spyOn(omadaClientModule, 'getOmadaClient').mockReturnValue(mockClientInstance as any);
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue({
      userId: 'user-regular',
      username: 'jdoe',
      email: 'jdoe@test.com',
      role: 'USER',
      lastActive: Date.now(),
    });

    vi.spyOn(dbQueries, 'getUserDeviceTags').mockResolvedValue([
      {
        id: 't-1',
        userId: 'user-regular',
        macAddress: 'AA:BB:CC:DD:EE:01',
        deviceName: 'Work Laptop',
        createdAt: '',
      },
    ]);

    const req = new Request('http://localhost:3000/api/telemetry?all=true');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.topClients).toHaveLength(1);
    expect(json.topClients[0].mac).toBe('AA:BB:CC:DD:EE:01');
    expect(json.status.totalClients).toBe(1);
    expect(json.status.wirelessClients).toBe(1);
    expect(json.status.wiredClients).toBe(0);
    expect(json.status.totalActivityRate).toBe(100);
    expect(json.status.totalTrafficDown).toBe(1000);
  });

  it('returns 503 when controller is offline', async () => {
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
      error: 'Connection timeout',
    };

    const mockClientInstance = {
      getNetworkStatus: vi.fn().mockResolvedValue(mockStatus),
    };

    vi.spyOn(omadaClientModule, 'getOmadaClient').mockReturnValue(mockClientInstance as any);

    const req = new Request('http://localhost:3000/api/telemetry');
    const res = await GET(req);
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.status.controllerOnline).toBe(false);
    expect(json.topClients).toEqual([]);
  });

  it('handles errors when getActiveClients throws within online check', async () => {
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
      getActiveClients: vi.fn().mockRejectedValue(new Error('Site error')),
    };

    vi.spyOn(omadaClientModule, 'getOmadaClient').mockReturnValue(mockClientInstance as any);

    const req = new Request('http://localhost:3000/api/telemetry');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.topClients).toEqual([]);
  });

  it('handles top-level fatal exception and returns 500', async () => {
    vi.spyOn(omadaClientModule, 'getOmadaClient').mockImplementation(() => {
      throw new Error('Fatal client init failure');
    });

    const req = new Request('http://localhost:3000/api/telemetry');
    const res = await GET(req);
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toBe('Fatal client init failure');
    expect(json.status.controllerOnline).toBe(false);
  });
});

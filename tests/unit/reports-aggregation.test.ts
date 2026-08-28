import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getReportSummary } from '@/lib/reports/aggregation';
import * as dbQueries from '@/lib/db/queries';

describe('Reports Aggregation Engine (lib/reports/aggregation.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates live telemetry, hardware inventory, and user data into an executive summary', async () => {
    const mockClient = {
      getNetworkStatus: vi.fn().mockResolvedValue({
        siteName: 'The Farm',
        uptime: 864000,
        totalClients: 3,
        wirelessClients: 2,
        wiredClients: 1,
      }),
      getActiveClients: vi.fn().mockResolvedValue({
        clients: [
          {
            mac: 'AA:BB:CC:DD:EE:01',
            name: 'MacBook-Pro',
            ip: '192.168.1.100',
            wireless: true,
            ssid: 'Farm-WiFi',
            apName: 'EAP-Main',
            channel: 36, // 5GHz
            rssi: -55,   // Excellent
            activity: 2500000, // 20 Mbps
            rxRate: 1500000,
            txRate: 1000000,
            trafficDown: 500000000,
            trafficUp: 200000000,
            uptime: 3600,
          },
          {
            mac: 'AA:BB:CC:DD:EE:02',
            name: 'iPhone-15',
            ip: '192.168.1.101',
            wireless: true,
            ssid: 'Farm-WiFi',
            apName: 'EAP-Barn',
            channel: 6,  // 2.4GHz
            rssi: -85,   // Poor
            activity: 500000,
            rxRate: 300000,
            txRate: 200000,
            trafficDown: 100000000,
            trafficUp: 50000000,
            uptime: 1800,
          },
          {
            mac: 'AA:BB:CC:DD:EE:03',
            name: 'Workstation-LAN',
            ip: '192.168.1.50',
            wireless: false,
            switchName: 'Core-Switch',
            port: 4,
            activity: 10000000, // 80 Mbps
            rxRate: 6000000,
            txRate: 4000000,
            trafficDown: 2000000000,
            trafficUp: 1000000000,
            uptime: 7200,
          },
        ],
        total: 3,
      }),
      getDevices: vi.fn().mockResolvedValue([
        { mac: '00:11:22:33:44:01', name: 'EAP-Main', type: 'ap', status: 1 },
        { mac: '00:11:22:33:44:02', name: 'EAP-Barn', type: 'ap', status: 1 },
        { mac: '00:11:22:33:44:03', name: 'Core-Switch', type: 'switch', status: 1 },
        { mac: '00:11:22:33:44:04', name: 'Gateway-WAN', type: 'gateway', status: 1 },
      ]),
    };

    vi.spyOn(dbQueries, 'listAllUsersWithDetails').mockResolvedValue([
      {
        id: 'u-1',
        username: 'admin',
        email: 'admin@omadanoc.com',
        role: 'ADMIN',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        profile: {
          id: 'p-1',
          userId: 'u-1',
          fullName: 'System Admin',
          jobTitle: 'Lead',
          department: 'NOC',
          avatarUrl: '',
          theme: 'dark',
          updatedAt: '',
        },
        taggedDevices: [
          { id: 't-1', userId: 'u-1', macAddress: 'AA:BB:CC:DD:EE:01', createdAt: '' },
          { id: 't-2', userId: 'u-1', macAddress: 'AA:BB:CC:DD:EE:02', createdAt: '' },
        ],
      },
    ]);

    vi.spyOn(dbQueries, 'getPaginatedLogins').mockResolvedValue({
      items: [
        {
          id: 'l-1',
          userId: 'u-1',
          email: 'admin@omadanoc.com',
          ipAddress: '127.0.0.1',
          userAgent: 'TestAgent',
          loginStatus: 'SUCCESS',
          failureReason: null,
          createdAt: '2026-08-28T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 100,
      totalPages: 1,
    });

    const report = await getReportSummary(mockClient as any);

    expect(report.siteName).toBe('The Farm');
    expect(report.infrastructure.totalClients).toBe(3);
    expect(report.infrastructure.wirelessClients).toBe(2);
    expect(report.infrastructure.wiredClients).toBe(1);
    expect(report.infrastructure.totalAps).toBe(2);
    expect(report.infrastructure.totalSwitches).toBe(1);
    expect(report.infrastructure.totalGateways).toBe(1);
    expect(report.infrastructure.freq5gClients).toBe(1);
    expect(report.infrastructure.freq2gClients).toBe(1);

    expect(report.topActiveDevices[0].name).toBe('Workstation-LAN');
    expect(report.topActiveDevices[0].currentRateMbps).toBe(80);
    expect(report.topVolumeDevices[0].name).toBe('Workstation-LAN');

    expect(report.rfDistribution.excellent).toBe(1);
    expect(report.rfDistribution.poor).toBe(1);
    expect(report.rfDistribution.totalWireless).toBe(2);

    expect(report.topActiveUsers[0].username).toBe('admin');
    expect(report.topActiveUsers[0].taggedDevicesCount).toBe(2);

    expect(report.securitySummary.authSuccessRate24h).toBe(100);
    expect(report.securitySummary.totalLogins24h).toBe(1);
  });

  it('penalizes health score on offline devices and failed logins, and handles RF mid-tier signals', async () => {
    const mockClient = {
      getNetworkStatus: vi.fn().mockResolvedValue(null),
      getActiveClients: vi.fn().mockResolvedValue({
        clients: [
          { mac: 'C1', wireless: true, channel: 6, signalLevel: -65 }, // Good
          { mac: 'C2', wireless: true, channel: 6, signalLevel: -75 }, // Fair
        ],
        total: 2,
      }),
      getDevices: vi.fn().mockResolvedValue([
        { mac: 'AP-1', name: 'AP-1', type: 'ap', status: 0 }, // Offline!
      ]),
    };

    vi.spyOn(dbQueries, 'listAllUsersWithDetails').mockResolvedValue([]);
    vi.spyOn(dbQueries, 'getPaginatedLogins').mockResolvedValue({
      items: Array(8).fill({ loginStatus: 'FAILED' }) as any,
      total: 8,
      page: 1,
      pageSize: 100,
      totalPages: 1,
    });

    const report = await getReportSummary(mockClient as any);

    expect(report.siteName).toBe('The Farm');
    expect(report.rfDistribution.good).toBe(1);
    expect(report.rfDistribution.fair).toBe(1);
    expect(report.networkHealthScore).toBeLessThan(90);
    expect(report.securitySummary.failedLogins24h).toBe(8);
  });
});

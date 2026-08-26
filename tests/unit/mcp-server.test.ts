import { describe, it, expect, vi, beforeEach } from 'vitest';
import { server, omadaClient, startMcpServer } from '@/mcp/server';

describe('MCP Server Bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('server initialization & export', () => {
    it('initializes McpServer instance with registered tools', () => {
      expect(server).toBeDefined();
    });

    it('connects to stdio transport via startMcpServer', async () => {
      const connectSpy = vi.spyOn(server, 'connect').mockResolvedValue(undefined as any);
      await startMcpServer();
      expect(connectSpy).toHaveBeenCalled();
    });
  });

  describe('Tool: get_network_status', () => {
    it('returns formatted status markdown when controller is online', async () => {
      const mockStatus = {
        controllerOnline: true,
        omadacId: 'omada-id-456',
        siteId: 'site-hex-789',
        siteName: 'Main Campus',
        totalClients: 10,
        wirelessClients: 7,
        wiredClients: 3,
        totalActivityRate: 2097152, // 2 MB/s
        totalTrafficDown: 104857600, // 100 MB
        totalTrafficUp: 52428800, // 50 MB
        lastUpdated: '2026-08-26T12:00:00Z',
        error: null,
      };

      vi.spyOn(omadaClient, 'getNetworkStatus').mockResolvedValue(mockStatus);

      const toolHandler = (server as any)._registeredTools?.get_network_status?.handler;
      expect(toolHandler).toBeDefined();

      const result = await toolHandler({});
      expect(result.content[0].text).toContain('Omada Network Status');
      expect(result.content[0].text).toContain('Controller Status:** Online ✅');
      expect(result.content[0].text).toContain('Main Campus');
      expect(result.content[0].text).toContain('10');
      expect(result.content[0].text).toContain('7');
      expect(result.content[0].text).toContain('3');
      expect(result.content[0].text).toContain('2 MB/s');
    });

    it('handles online status with missing omadacId or missing siteName', async () => {
      const mockStatus = {
        controllerOnline: true,
        omadacId: null,
        siteId: 'Default',
        siteName: undefined,
        totalClients: 0,
        wirelessClients: 0,
        wiredClients: 0,
        totalActivityRate: 0,
        totalTrafficDown: 0,
        totalTrafficUp: 0,
        lastUpdated: '2026-08-26T12:00:00Z',
        error: null,
      };

      vi.spyOn(omadaClient, 'getNetworkStatus').mockResolvedValue(mockStatus as any);

      const toolHandler = (server as any)._registeredTools?.get_network_status?.handler;
      const result = await toolHandler({});
      expect(result.content[0].text).toContain('Controller ID:** N/A');
      expect(result.content[0].text).toContain('Active Site:** Default');
    });

    it('returns warning markdown when controller is offline', async () => {
      const mockStatus = {
        controllerOnline: false,
        omadacId: null,
        siteId: 'Default',
        siteName: 'Default',
        totalClients: 0,
        wirelessClients: 0,
        wiredClients: 0,
        totalActivityRate: 0,
        totalTrafficDown: 0,
        totalTrafficUp: 0,
        lastUpdated: '2026-08-26T12:00:00Z',
        error: 'Host unreachable',
      };

      vi.spyOn(omadaClient, 'getNetworkStatus').mockResolvedValue(mockStatus);

      const toolHandler = (server as any)._registeredTools?.get_network_status?.handler;
      const result = await toolHandler({});
      expect(result.content[0].text).toContain('⚠️ Omada Controller is currently offline');
      expect(result.content[0].text).toContain('Host unreachable');
    });

    it('returns error object when getNetworkStatus throws an exception', async () => {
      vi.spyOn(omadaClient, 'getNetworkStatus').mockRejectedValue(new Error('Fatal RPC failure'));

      const toolHandler = (server as any)._registeredTools?.get_network_status?.handler;
      const result = await toolHandler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error querying network status: Fatal RPC failure');
    });
  });

  describe('Tool: get_active_clients', () => {
    const mockClients = [
      {
        mac: 'AA-BB-CC-DD-EE-01',
        name: 'Work Laptop',
        ip: '192.168.1.100',
        wireless: true,
        ssid: 'Office-Staff',
        rssi: -48,
        apName: 'AP-Floor-2',
        activity: 1048576,
        trafficDown: 20000000,
        trafficUp: 5000000,
        uptime: 18000,
      },
      {
        mac: 'AA-BB-CC-DD-EE-02',
        name: 'Core NAS',
        ip: '192.168.1.200',
        wireless: false,
        switchName: 'Core-SW-01',
        port: 12,
        activity: 5242880,
        trafficDown: 500000000,
        trafficUp: 200000000,
        uptime: 864000,
      },
      {
        mac: 'AA-BB-CC-DD-EE-03',
        name: undefined,
        hostName: undefined,
        ip: '',
        wireless: false,
        switchName: undefined,
        port: undefined,
        activity: 0,
        trafficDown: 0,
        trafficUp: 0,
        uptime: 0,
      },
      {
        mac: 'AA-BB-CC-DD-EE-04',
        name: undefined,
        hostName: 'wireless-device.local',
        ip: '192.168.1.105',
        wireless: true,
        ssid: undefined,
        rssi: undefined,
        apName: undefined,
        activity: 500,
        trafficDown: 100,
        trafficUp: 100,
        uptime: 60,
      },
    ];

    it('returns active clients formatted with wireless and wired metadata', async () => {
      vi.spyOn(omadaClient, 'getActiveClients').mockResolvedValue(mockClients);

      const toolHandler = (server as any)._registeredTools?.get_active_clients?.handler;
      expect(toolHandler).toBeDefined();

      const result = await toolHandler({ connection_type: 'all', sort_by: 'activity', limit: 10 });
      expect(result.content[0].text).toContain('Active Clients (4 returned');
      expect(result.content[0].text).toContain('Work Laptop');
      expect(result.content[0].text).toContain('Office-Staff');
      expect(result.content[0].text).toContain('AP-Floor-2');
      expect(result.content[0].text).toContain('Core NAS');
      expect(result.content[0].text).toContain('Core-SW-01');
      expect(result.content[0].text).toContain('Port: 12');
      expect(result.content[0].text).toContain('Unnamed Device');
      expect(result.content[0].text).toContain('wireless-device.local');
    });

    it('sorts and filters by connection_type wireless and sort_by traffic', async () => {
      vi.spyOn(omadaClient, 'getActiveClients').mockResolvedValue(mockClients);
      const toolHandler = (server as any)._registeredTools?.get_active_clients?.handler;

      const wirelessRes = await toolHandler({ connection_type: 'wireless', sort_by: 'traffic', limit: 10 });
      expect(wirelessRes.content[0].text).toContain('Work Laptop');
      expect(wirelessRes.content[0].text).not.toContain('Core NAS');
    });

    it('sorts and filters by connection_type wired and sort_by uptime', async () => {
      vi.spyOn(omadaClient, 'getActiveClients').mockResolvedValue(mockClients);
      const toolHandler = (server as any)._registeredTools?.get_active_clients?.handler;

      const wiredRes = await toolHandler({ connection_type: 'wired', sort_by: 'uptime', limit: 10 });
      expect(wiredRes.content[0].text).toContain('Core NAS');
      expect(wiredRes.content[0].text).not.toContain('Work Laptop');
    });

    it('handles empty results and returns descriptive message', async () => {
      vi.spyOn(omadaClient, 'getActiveClients').mockResolvedValue([]);
      const toolHandler = (server as any)._registeredTools?.get_active_clients?.handler;

      const result = await toolHandler({ connection_type: 'wireless' });
      expect(result.content[0].text).toContain('No connected clients found matching filter criteria');
    });

    it('handles exceptions and returns error object', async () => {
      vi.spyOn(omadaClient, 'getActiveClients').mockRejectedValue(new Error('Auth token invalid'));
      const toolHandler = (server as any)._registeredTools?.get_active_clients?.handler;

      const result = await toolHandler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error retrieving active clients: Auth token invalid');
    });
  });
});

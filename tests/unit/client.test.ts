import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OmadaClient, getOmadaClient } from '@/lib/omada/client';

describe('OmadaClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('constructor & configuration', () => {
    it('initializes with default environment fallback values', () => {
      const client = new OmadaClient();
      expect(client).toBeDefined();
    });

    it('initializes with custom configuration options and disables insecure SSL flag', () => {
      const client = new OmadaClient({
        baseUrl: 'https://omada.local:8043/',
        username: 'custom_user',
        password: 'custom_pass',
        siteNameOrId: 'Branch-1',
        allowInsecureSsl: false,
      });
      expect(client).toBeDefined();
    });
  });

  describe('login', () => {
    it('successfully discovers omadacId and authenticates', async () => {
      const mockFetch = vi.fn();

      // 1. /api/info
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          errorCode: 0,
          msg: 'Success',
          result: { omadacId: 'mock-omadac-id-123' },
        }),
      });

      // 2. /api/v2/login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (header: string) =>
            header.toLowerCase() === 'set-cookie'
              ? 'TPEAP_SESSIONID=sess_12345; Path=/; Secure; HttpOnly'
              : null,
        },
        json: async () => ({
          errorCode: 0,
          msg: 'Success',
          result: { token: 'mock-csrf-token-abc', role: 1 },
        }),
      });

      global.fetch = mockFetch;

      const client = new OmadaClient({ baseUrl: 'https://127.0.0.1:8043' });
      await client.login();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toBe('https://127.0.0.1:8043/api/info');
      expect(mockFetch.mock.calls[1][0]).toBe('https://127.0.0.1:8043/mock-omadac-id-123/api/v2/login');

      // Subsequent login should be a no-op when not forced
      await client.login();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('deduplicates concurrent login requests', async () => {
      const mockFetch = vi.fn();

      mockFetch.mockImplementation(async (url: string) => {
        if (url.endsWith('/api/info')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ errorCode: 0, result: { omadacId: 'omada-123' } }),
          };
        }
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'TPEAP_SESSIONID=sess_123;' },
          json: async () => ({ errorCode: 0, result: { token: 'token-123' } }),
        };
      });

      global.fetch = mockFetch;

      const client = new OmadaClient();
      await Promise.all([client.login(), client.login(), client.login()]);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws error when /api/info fails or returns non-zero error code', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const client = new OmadaClient();
      await expect(client.login()).rejects.toThrow(/Failed to reach Omada Controller info endpoint/);

      // Test errorCode != 0
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ errorCode: -1001, msg: 'Invalid info request' }),
      });

      const client2 = new OmadaClient();
      await expect(client2.login()).rejects.toThrow(/Omada Info Error: Invalid info request/);
    });

    it('throws error when /api/v2/login fails or returns invalid credentials', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ errorCode: 0, result: { omadacId: 'omada-123' } }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
        });

      global.fetch = mockFetch;

      const client = new OmadaClient();
      await expect(client.login()).rejects.toThrow(/Omada Login HTTP error: 403/);

      const mockFetch2 = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ errorCode: 0, result: { omadacId: 'omada-123' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ errorCode: -1002, msg: 'Bad credentials' }),
        });

      global.fetch = mockFetch2;
      const client2 = new OmadaClient();
      await expect(client2.login()).rejects.toThrow(/Omada Login Failed: Bad credentials/);
    });

    it('detects HTML responses in safeParseJson and formats a friendly error with page title', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'text/html' },
        text: async () => '<!DOCTYPE html><html><head><title>Omada Controller Web UI</title></head><body>Login</body></html>',
      });

      global.fetch = mockFetch;
      const client = new OmadaClient({ baseUrl: 'https://192.168.100.2:8043' });
      await expect(client.login()).rejects.toThrow(/returned HTML \("Omada Controller Web UI"\) instead of JSON/);
    });

    it('handles invalid JSON strings and unparseable responses in safeParseJson', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => 'Not A Valid JSON Payload',
      });

      global.fetch = mockFetch;
      const client = new OmadaClient({ baseUrl: 'https://192.168.100.2:8043' });
      await expect(client.login()).rejects.toThrow(/Invalid JSON received from Omada Controller/);

      // Unparseable response object without text or json
      const mockFetch2 = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
      });

      global.fetch = mockFetch2;
      const client2 = new OmadaClient({ baseUrl: 'https://192.168.100.2:8043' });
      await expect(client2.login()).rejects.toThrow(/cannot be parsed as JSON/);
    });

    it('automatically discovers and falls back to :8043 if port was omitted in baseUrl', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url === 'https://192.168.100.2/api/info') {
          // Standard :443 returns HTML
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'text/html' },
            text: async () => '<!DOCTYPE html><html><head><title>Router</title></head></html>',
          };
        }
        if (url === 'https://192.168.100.2:8043/api/info') {
          // Port 8043 returns valid omadacId
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            text: async () => JSON.stringify({ errorCode: 0, result: { omadacId: 'discovered-omada-8043' } }),
          };
        }
        if (url.includes('/api/v2/login')) {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'TPOMADA_SESSIONID=sess_8043;' },
            text: async () => JSON.stringify({ errorCode: 0, result: { token: 'token-8043' } }),
          };
        }
        return { ok: false, status: 404 };
      });

      global.fetch = mockFetch;
      const client = new OmadaClient({ baseUrl: '192.168.100.2' });
      await client.login();
      expect(client).toBeDefined();
    });
  });

  describe('sites and site resolution', () => {
    it('fetches sites array directly from /api/v2/sites and resolves by exact siteId', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/info')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: { omadacId: 'omada-123' } }) };
        }
        if (url.endsWith('/api/v2/login')) {
          return { ok: true, status: 200, headers: { get: () => 'TPEAP_SESSIONID=sess_123;' }, json: async () => ({ errorCode: 0, result: { token: 'token-123' } }) };
        }
        if (url.includes('/api/v2/sites')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              errorCode: 0,
              result: [
                { siteId: 'hexsite123', name: 'Default', siteKey: 'default' },
                { siteId: 'hexsite456', name: 'Branch 2', siteKey: 'branch-2' },
              ],
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      global.fetch = mockFetch;

      const client = new OmadaClient({ siteNameOrId: 'hexsite456' });
      const resolvedId = await client.getResolvedSiteId();
      expect(resolvedId).toBe('hexsite456');

      const client2 = new OmadaClient({ siteNameOrId: 'UnknownSite' });
      const resolvedFallbackId = await client2.getResolvedSiteId();
      expect(resolvedFallbackId).toBe('hexsite123');
    });

    it('fetches sites wrapped in data object and matches by siteKey', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/info')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: { omadacId: 'omada-123' } }) };
        }
        if (url.endsWith('/api/v2/login')) {
          return { ok: true, status: 200, headers: { get: () => 'TPEAP_SESSIONID=sess_123;' }, json: async () => ({ errorCode: 0, result: { token: 'token-123' } }) };
        }
        if (url.includes('/api/v2/sites')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              errorCode: 0,
              result: {
                data: [
                  { siteId: 'hexsite999', name: 'Headquarters', siteKey: 'hq' },
                ],
              },
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      global.fetch = mockFetch;

      const client = new OmadaClient({ siteNameOrId: 'hq' });
      const resolvedId = await client.getResolvedSiteId();
      expect(resolvedId).toBe('hexsite999');
    });

    it('falls back to /api/v2/users/current when /api/v2/sites fails', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/info')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: { omadacId: 'omada-123' } }) };
        }
        if (url.endsWith('/api/v2/login')) {
          return { ok: true, status: 200, headers: { get: () => 'TPEAP_SESSIONID=sess_123;' }, json: async () => ({ errorCode: 0, result: { token: 'token-123' } }) };
        }
        if (url.endsWith('/api/v2/sites')) {
          return { ok: false, status: 403, statusText: 'Forbidden' };
        }
        if (url.includes('/api/v2/users/current')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              errorCode: 0,
              result: {
                sites: [{ siteId: 'userSite123', name: 'User Default' }],
              },
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      global.fetch = mockFetch;

      const client = new OmadaClient();
      const sites = await client.getSites();
      expect(sites).toHaveLength(1);
      expect(sites[0].siteId).toBe('userSite123');
    });

    it('falls back to siteNameOrId when site list is completely empty', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/info')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: { omadacId: 'omada-123' } }) };
        }
        if (url.endsWith('/api/v2/login')) {
          return { ok: true, status: 200, headers: { get: () => 'TPEAP_SESSIONID=sess_123;' }, json: async () => ({ errorCode: 0, result: { token: 'token-123' } }) };
        }
        throw new Error('Network error');
      });

      global.fetch = mockFetch;

      const client = new OmadaClient({ siteNameOrId: 'fallback-site-id' });
      const resolvedId = await client.getResolvedSiteId();
      expect(resolvedId).toBe('fallback-site-id');
    });
  });

  describe('getActiveClients & getTopClients', () => {
    const mockClientDevices = [
      {
        mac: 'AA-BB-CC-DD-EE-01',
        name: 'MacBook Pro',
        ip: '192.168.1.50',
        wireless: true,
        ssid: 'CorpNet',
        activity: 102400,
        trafficDown: 5000000,
        trafficUp: 1000000,
        uptime: 3600,
        rssi: -65,
      },
      {
        mac: 'AA-BB-CC-DD-EE-02',
        name: 'Workstation',
        ip: '192.168.1.51',
        wireless: false,
        port: 4,
        activity: 512000,
        trafficDown: 20000000,
        trafficUp: 5000000,
        uptime: 7200,
      },
      {
        mac: 'AA-BB-CC-DD-EE-03',
        name: 'IoT Sensor',
        ip: '192.168.1.52',
        wireless: true,
        ssid: 'IoTNet',
        activity: undefined,
        trafficDown: undefined,
        trafficUp: undefined,
        uptime: undefined,
        rssi: -85,
      },
    ];

    it('retrieves active clients from paginated structure and calculates top clients by activity', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/info')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: { omadacId: 'omada-123' } }) };
        }
        if (url.endsWith('/api/v2/login')) {
          return { ok: true, status: 200, headers: { get: () => 'TPEAP_SESSIONID=sess_123;' }, json: async () => ({ errorCode: 0, result: { token: 'token-123' } }) };
        }
        if (url.includes('/api/v2/sites') && !url.includes('/clients')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: [{ siteId: 'site-hex-123', name: 'Default' }] }) };
        }
        if (url.includes('/clients')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              errorCode: 0,
              result: {
                totalRows: 3,
                currentPage: 1,
                currentSize: 3,
                data: mockClientDevices,
              },
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      global.fetch = mockFetch;

      const client = new OmadaClient();
      const clients = await client.getActiveClients();
      expect(clients).toHaveLength(3);

      const topByActivity = await client.getTopClients(2, 'activity');
      expect(topByActivity).toHaveLength(2);
      expect(topByActivity[0].name).toBe('Workstation');
      expect(topByActivity[1].name).toBe('MacBook Pro');
    });

    it('returns empty array when getActiveClients returns non-array and non-data result', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/info')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: { omadacId: 'omada-123' } }) };
        }
        if (url.endsWith('/api/v2/login')) {
          return { ok: true, status: 200, headers: { get: () => 'TPEAP_SESSIONID=sess_123;' }, json: async () => ({ errorCode: 0, result: { token: 'token-123' } }) };
        }
        if (url.includes('/api/v2/sites') && !url.includes('/clients')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: [{ siteId: 'site-hex-123', name: 'Default' }] }) };
        }
        if (url.includes('/clients')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              errorCode: 0,
              result: null,
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      global.fetch = mockFetch;

      const client = new OmadaClient();
      const clients = await client.getActiveClients();
      expect(clients).toEqual([]);
    });

    it('sorts top clients by traffic and uptime', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/info')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: { omadacId: 'omada-123' } }) };
        }
        if (url.endsWith('/api/v2/login')) {
          return { ok: true, status: 200, headers: { get: () => 'TPEAP_SESSIONID=sess_123;' }, json: async () => ({ errorCode: 0, result: { token: 'token-123' } }) };
        }
        if (url.includes('/api/v2/sites') && !url.includes('/clients')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: [{ siteId: 'site-hex-123', name: 'Default' }] }) };
        }
        if (url.includes('/clients')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              errorCode: 0,
              result: mockClientDevices,
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      global.fetch = mockFetch;

      const client = new OmadaClient();
      const topByTraffic = await client.getTopClients(3, 'traffic');
      expect(topByTraffic[0].name).toBe('Workstation');

      const topByUptime = await client.getTopClients(3, 'uptime');
      expect(topByUptime[0].name).toBe('Workstation');
    });

    it('handles token expiration (-30000) by re-authenticating and retrying', async () => {
      let clientCallCount = 0;
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/info')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: { omadacId: 'omada-123' } }) };
        }
        if (url.endsWith('/api/v2/login')) {
          return { ok: true, status: 200, headers: { get: () => 'TPEAP_SESSIONID=sess_123;' }, json: async () => ({ errorCode: 0, result: { token: 'token-123' } }) };
        }
        if (url.includes('/api/v2/sites') && !url.includes('/clients')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: [{ siteId: 'site-hex-123', name: 'Default' }] }) };
        }
        if (url.includes('/clients')) {
          clientCallCount++;
          if (clientCallCount === 1) {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                errorCode: -30000,
                msg: 'Token expired',
              }),
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              errorCode: 0,
              result: mockClientDevices,
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      global.fetch = mockFetch;

      const client = new OmadaClient();
      const clients = await client.getActiveClients();
      expect(clients).toHaveLength(3);
    });

    it('handles HTTP 401 by re-authenticating and retrying', async () => {
      let clientCallCount = 0;
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/info')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: { omadacId: 'omada-123' } }) };
        }
        if (url.endsWith('/api/v2/login')) {
          return { ok: true, status: 200, headers: { get: () => 'TPEAP_SESSIONID=sess_123;' }, json: async () => ({ errorCode: 0, result: { token: 'token-123' } }) };
        }
        if (url.includes('/api/v2/sites') && !url.includes('/clients')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: [{ siteId: 'site-hex-123', name: 'Default' }] }) };
        }
        if (url.includes('/clients')) {
          clientCallCount++;
          if (clientCallCount === 1) {
            return {
              ok: false,
              status: 401,
              statusText: 'Unauthorized',
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              errorCode: 0,
              result: mockClientDevices,
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      global.fetch = mockFetch;

      const client = new OmadaClient();
      const clients = await client.getActiveClients();
      expect(clients).toHaveLength(3);
    });

    it('throws error when client API returns non-zero error code', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/info')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: { omadacId: 'omada-123' } }) };
        }
        if (url.endsWith('/api/v2/login')) {
          return { ok: true, status: 200, headers: { get: () => 'TPEAP_SESSIONID=sess_123;' }, json: async () => ({ errorCode: 0, result: { token: 'token-123' } }) };
        }
        if (url.includes('/api/v2/sites') && !url.includes('/clients')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: [{ siteId: 'site-hex-123', name: 'Default' }] }) };
        }
        if (url.includes('/clients')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              errorCode: -1,
              msg: 'Site not found',
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      global.fetch = mockFetch;

      const client = new OmadaClient();
      await expect(client.getActiveClients()).rejects.toThrow(/Failed to retrieve clients: Site not found/);
    });
  });

  describe('getDevices, getClientDetail, getWirelessHealth, and getNetworkHealthAudit', () => {
    const mockDevicesList = [
      {
        mac: '3C-64-CF-9E-F6-CC',
        name: 'West AP',
        type: 'ap',
        model: 'EAP670',
        ip: '192.168.100.22',
        status: 14,
        clientNum: 28,
        cpuUtil: 85,
        memUtil: 65,
      },
      {
        mac: '3C-64-CF-9E-F6-DD',
        name: 'East AP',
        type: 'ap',
        model: 'EAP670',
        ip: '192.168.100.23',
        status: 14,
        clientNum: 2,
        cpuUtil: 10,
        memUtil: 50,
      },
      {
        mac: '30-68-93-E8-29-54',
        name: 'Core Switch',
        type: 'switch',
        model: 'SG2218P',
        ip: '192.168.100.3',
        status: 15, // isolated
        clientNum: 5,
        cpuUtil: 12,
        memUtil: 45,
      },
    ];

    const mockClients = [
      {
        mac: 'AA-BB-CC-DD-EE-01',
        name: 'Master Bedroom TV',
        ip: '192.168.100.46',
        wireless: true,
        ssid: 'TheFarmStrlnk',
        apName: 'West AP',
        rssi: -82,
        signalLevel: 20,
        activity: 100000,
        trafficDown: 5000000,
        trafficUp: 1000000,
        uptime: 86400,
      },
      {
        mac: 'AA-BB-CC-DD-EE-02',
        name: 'Ian iPhone',
        ip: '192.168.100.74',
        wireless: true,
        ssid: 'TheFarmStrlnk',
        apName: 'West AP',
        rssi: -60,
        signalLevel: 75,
        activity: 50000,
        trafficDown: 2000000,
        trafficUp: 500000,
        uptime: 3600,
      },
    ];

    it('fetches and filters network infrastructure devices', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/info')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: { omadacId: 'omada-123' } }) };
        }
        if (url.endsWith('/api/v2/login')) {
          return { ok: true, status: 200, headers: { get: () => 'TPEAP_SESSIONID=sess_123;' }, json: async () => ({ errorCode: 0, result: { token: 'token-123' } }) };
        }
        if (url.includes('/api/v2/sites') && !url.includes('/devices')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: [{ siteId: 'site-hex-123', name: 'Default' }] }) };
        }
        if (url.includes('/devices')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              errorCode: 0,
              result: mockDevicesList,
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      global.fetch = mockFetch;

      const client = new OmadaClient();
      const allDevices = await client.getDevices('all');
      expect(allDevices).toHaveLength(3);

      const apDevices = await client.getDevices('ap');
      expect(apDevices).toHaveLength(2);

      const switchDevices = await client.getDevices('switch');
      expect(switchDevices).toHaveLength(1);
    });

    it('looks up a client by IP, MAC, or name via getClientDetail', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/info')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: { omadacId: 'omada-123' } }) };
        }
        if (url.endsWith('/api/v2/login')) {
          return { ok: true, status: 200, headers: { get: () => 'TPEAP_SESSIONID=sess_123;' }, json: async () => ({ errorCode: 0, result: { token: 'token-123' } }) };
        }
        if (url.includes('/api/v2/sites') && !url.includes('/clients')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: [{ siteId: 'site-hex-123', name: 'Default' }] }) };
        }
        if (url.includes('/clients')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              errorCode: 0,
              result: mockClients,
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      global.fetch = mockFetch;

      const client = new OmadaClient();
      const byIp = await client.getClientDetail('192.168.100.46');
      expect(byIp?.name).toBe('Master Bedroom TV');

      const byMac = await client.getClientDetail('AA:BB:CC:DD:EE:02');
      expect(byMac?.name).toBe('Ian iPhone');

      const byName = await client.getClientDetail('master bedroom');
      expect(byName).toBeDefined();

      const notFound = await client.getClientDetail('999.999.999.999');
      expect(notFound).toBeNull();
    });

    it('calculates wireless health summary and network health audit with recommendations', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/info')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: { omadacId: 'omada-123' } }) };
        }
        if (url.endsWith('/api/v2/login')) {
          return { ok: true, status: 200, headers: { get: () => 'TPEAP_SESSIONID=sess_123;' }, json: async () => ({ errorCode: 0, result: { token: 'token-123' } }) };
        }
        if (url.includes('/api/v2/sites') && !url.includes('/clients') && !url.includes('/devices')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: [{ siteId: 'site-hex-123', name: 'Default' }] }) };
        }
        if (url.includes('/devices')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              errorCode: 0,
              result: mockDevicesList,
            }),
          };
        }
        if (url.includes('/clients')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              errorCode: 0,
              result: mockClients,
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      global.fetch = mockFetch;

      const client = new OmadaClient();
      const health = await client.getWirelessHealth();
      expect(health.totalWirelessClients).toBe(2);
      expect(health.weakSignalCount).toBe(1);
      expect(health.criticalSignalCount).toBe(1);

      const audit = await client.getNetworkHealthAudit();
      expect(audit.healthScore).toBeLessThan(100);
      expect(audit.alerts.length).toBeGreaterThan(0);
      expect(audit.warnings.length).toBeGreaterThan(0);
      expect(audit.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('getNetworkStatus', () => {
    it('computes aggregated network metrics when online', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/api/info')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: { omadacId: 'omada-123' } }) };
        }
        if (url.endsWith('/api/v2/login')) {
          return { ok: true, status: 200, headers: { get: () => 'TPEAP_SESSIONID=sess_123;' }, json: async () => ({ errorCode: 0, result: { token: 'token-123' } }) };
        }
        if (url.includes('/api/v2/sites') && !url.includes('/clients')) {
          return { ok: true, status: 200, json: async () => ({ errorCode: 0, result: [{ siteId: 'site-hex-123', name: 'HQ' }] }) };
        }
        if (url.includes('/clients')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              errorCode: 0,
              result: [
                { mac: '01', wireless: true, activity: 100, trafficDown: 1000, trafficUp: 500 },
                { mac: '02', wireless: false, activity: 200, trafficDown: 2000, trafficUp: 800 },
              ],
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      global.fetch = mockFetch;

      const client = new OmadaClient({ siteNameOrId: 'HQ' });
      const status = await client.getNetworkStatus();

      expect(status.controllerOnline).toBe(true);
      expect(status.totalClients).toBe(2);
      expect(status.wirelessClients).toBe(1);
      expect(status.wiredClients).toBe(1);
      expect(status.totalActivityRate).toBe(300);
      expect(status.totalTrafficDown).toBe(3000);
      expect(status.totalTrafficUp).toBe(1300);
      expect(status.error).toBeNull();
    });

    it('returns offline error status when connection fails', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Connection refused to controller'));

      const client = new OmadaClient();
      const status = await client.getNetworkStatus();

      expect(status.controllerOnline).toBe(false);
      expect(status.totalClients).toBe(0);
      expect(status.error).toBe('Connection refused to controller');
    });

    it('handles non-Error thrown values in getNetworkStatus catch block', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce('String exception');

      const client = new OmadaClient();
      const status = await client.getNetworkStatus();

      expect(status.controllerOnline).toBe(false);
      expect(status.error).toBe('Unknown connection error');
    });
  });

  describe('getOmadaClient singleton', () => {
    it('returns a singleton instance', () => {
      const instance1 = getOmadaClient();
      const instance2 = getOmadaClient();
      expect(instance1).toBe(instance2);
    });
  });
});

import {
  OmadaApiResponse,
  OmadaInfoResult,
  OmadaLoginResult,
  OmadaSiteItem,
  OmadaClientDevice,
  OmadaClientsPageResult,
  NetworkStatusSummary,
} from '@/types/omada';
import fs from 'fs';
import path from 'path';

// Automatically load .env.local in environments where Next.js or dotenv hasn't already loaded it (e.g. standalone scripts, CLI)
if (typeof process !== 'undefined' && !process.env.OMADA_URL) {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envPath);
    }
  } catch {
    // Ignore error if loading env file fails
  }
}

export interface OmadaConfig {
  baseUrl?: string;
  username?: string;
  password?: string;
  siteNameOrId?: string;
  allowInsecureSsl?: boolean;
}

export class OmadaClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private siteNameOrId: string;
  private allowInsecureSsl: boolean;

  private omadacId: string | null = null;
  private token: string | null = null;
  private cookie: string | null = null;
  private resolvedSiteId: string | null = null;
  private resolvedSiteName: string = 'Default';
  private loginPromise: Promise<void> | null = null;

  constructor(config?: OmadaConfig) {
    let rawUrl = config?.baseUrl || process.env.OMADA_URL || 'https://192.168.100.2';
    if (!/^https?:\/\//i.test(rawUrl)) {
      rawUrl = `https://${rawUrl}`;
    }
    this.baseUrl = rawUrl.replace(/\/+$/, '');

    this.username = config?.username || process.env.OMADA_USER || 'admin';
    this.password = config?.password || process.env.OMADA_PASS || 'password';
    this.siteNameOrId = config?.siteNameOrId || process.env.OMADA_SITE || 'Default';
    this.allowInsecureSsl = config?.allowInsecureSsl ?? (process.env.OMADA_ALLOW_INSECURE_SSL !== 'false');

    if (this.allowInsecureSsl && typeof process !== 'undefined') {
      // Allows self-signed certificates common in physical hardware / local controller setups
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
  }

  private getHeaders(customHeaders?: Record<string, string>): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...customHeaders,
    };

    if (this.token) {
      headers['Csrf-Token'] = this.token;
    }
    if (this.cookie) {
      headers['Cookie'] = this.cookie;
    }

    return headers;
  }

  /**
   * Performs the Omada v5 authentication handshake:
   * 1. GET /api/info -> discovers omadacId
   * 2. POST /{omadacId}/api/v2/login -> retrieves CSRF token & session cookie
   */
  async login(force = false): Promise<void> {
    if (!force && this.token && this.cookie && this.omadacId) {
      return;
    }

    // Deduplicate concurrent login requests
    if (this.loginPromise) {
      return this.loginPromise;
    }

    this.loginPromise = (async () => {
      try {
        // Step 1: Discover Controller ID
        const infoRes = await fetch(`${this.baseUrl}/api/info`, {
          method: 'GET',
          headers: this.getHeaders(),
          cache: 'no-store',
        });

        if (!infoRes.ok) {
          throw new Error(`Failed to reach Omada Controller info endpoint at ${this.baseUrl}/api/info (${infoRes.status} ${infoRes.statusText})`);
        }

        const infoData = (await infoRes.json()) as OmadaApiResponse<OmadaInfoResult>;
        if (infoData.errorCode !== 0 || !infoData.result?.omadacId) {
          throw new Error(`Omada Info Error: ${infoData.msg || 'Missing omadacId in response'}`);
        }

        this.omadacId = infoData.result.omadacId;

        // Step 2: Login to obtain token and session cookie
        const loginUrl = `${this.baseUrl}/${this.omadacId}/api/v2/login`;
        const loginRes = await fetch(loginUrl, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            username: this.username,
            password: this.password,
          }),
          cache: 'no-store',
        });

        if (!loginRes.ok) {
          throw new Error(`Omada Login HTTP error: ${loginRes.status} ${loginRes.statusText}`);
        }

        const loginData = (await loginRes.json()) as OmadaApiResponse<OmadaLoginResult>;
        if (loginData.errorCode !== 0 || !loginData.result?.token) {
          throw new Error(`Omada Login Failed: ${loginData.msg || `Error code ${loginData.errorCode}`}`);
        }

        this.token = loginData.result.token;

        // Extract session cookie (e.g. TPOMADA_SESSIONID or TPEAP_SESSIONID)
        const setCookieHeader = loginRes.headers.get('set-cookie');
        if (setCookieHeader) {
          this.cookie = setCookieHeader.split(';')[0];
        }

        // Reset resolved site so it re-verifies against the new session
        this.resolvedSiteId = null;
      } finally {
        this.loginPromise = null;
      }
    })();

    return this.loginPromise;
  }

  /**
   * Authenticated fetch with automatic token expiration recovery (retry on 401 / session timeout)
   */
  private async authenticatedFetch<T>(endpoint: string, options: RequestInit = {}): Promise<OmadaApiResponse<T>> {
    await this.login();

    const url = `${this.baseUrl}/${this.omadacId}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    let res = await fetch(url, {
      ...options,
      headers: this.getHeaders(options.headers as Record<string, string>),
      cache: 'no-store',
    });

    // Check for HTTP 401 or auth failures
    if (res.status === 401) {
      await this.login(true);
      res = await fetch(url, {
        ...options,
        headers: this.getHeaders(options.headers as Record<string, string>),
        cache: 'no-store',
      });
    }

    if (!res.ok) {
      throw new Error(`Omada API request failed: ${res.status} ${res.statusText} at ${endpoint}`);
    }

    const data = (await res.json()) as OmadaApiResponse<T>;

    // Handle Omada specific session expiration error codes (e.g., -30000 or -30001 or -39000)
    if (data.errorCode === -30000 || data.errorCode === -30001 || data.errorCode === -39000) {
      await this.login(true);
      const retryRes = await fetch(url, {
        ...options,
        headers: this.getHeaders(options.headers as Record<string, string>),
        cache: 'no-store',
      });
      return (await retryRes.json()) as OmadaApiResponse<T>;
    }

    return data;
  }

  /**
   * Query all accessible sites on the controller
   */
  async getSites(): Promise<OmadaSiteItem[]> {
    try {
      const response = await this.authenticatedFetch<
        OmadaSiteItem[] | { data: Array<{ id?: string; siteId?: string; name: string; siteKey?: string }> }
      >('/api/v2/sites?currentPage=1&currentPageSize=100');

      if (response.errorCode === 0 && response.result) {
        let rawList: Array<{ id?: string; siteId?: string; name: string; siteKey?: string }> = [];
        if (Array.isArray(response.result)) {
          rawList = response.result;
        } else if (Array.isArray((response.result as { data: Array<{ id?: string; siteId?: string; name: string; siteKey?: string }> }).data)) {
          rawList = (response.result as { data: Array<{ id?: string; siteId?: string; name: string; siteKey?: string }> }).data;
        }

        return rawList.map((s) => ({
          siteId: s.id || s.siteId || '',
          name: s.name,
          siteKey: s.siteKey,
        }));
      }
    } catch {
      // If /sites is restricted or unavailable, fallback to current user sites
      try {
        const userRes = await this.authenticatedFetch<{ sites?: Array<{ id?: string; siteId?: string; name: string }> }>('/api/v2/users/current');
        if (userRes.errorCode === 0 && userRes.result?.sites) {
          return userRes.result.sites.map((s) => ({
            siteId: s.id || s.siteId || '',
            name: s.name,
          }));
        }
      } catch {
        // Fallback
      }
    }
    return [];
  }

  /**
   * Resolves the configured site name/ID to the internal Omada siteId
   */
  async getResolvedSiteId(): Promise<string> {
    if (this.resolvedSiteId) {
      return this.resolvedSiteId;
    }

    const sites = await this.getSites();
    if (sites && sites.length > 0) {
      // Find matching site by ID or name
      const matched = sites.find(
        (s) =>
          s.siteId === this.siteNameOrId ||
          s.name?.toLowerCase() === this.siteNameOrId.toLowerCase() ||
          s.siteKey?.toLowerCase() === this.siteNameOrId.toLowerCase()
      );

      if (matched) {
        this.resolvedSiteId = matched.siteId;
        this.resolvedSiteName = matched.name;
        return this.resolvedSiteId;
      }

      // If no exact match, fallback to first available site
      this.resolvedSiteId = sites[0].siteId;
      this.resolvedSiteName = sites[0].name;
      return this.resolvedSiteId;
    }

    // Default fallback
    this.resolvedSiteId = this.siteNameOrId;
    return this.resolvedSiteId;
  }

  /**
   * Fetches active connected clients from Omada controller
   */
  async getActiveClients(): Promise<OmadaClientDevice[]> {
    const siteId = await this.getResolvedSiteId();
    const endpoint = `/api/v2/sites/${encodeURIComponent(siteId)}/clients?currentPage=1&currentPageSize=1000&filters.active=true`;

    let res: OmadaApiResponse<OmadaClientsPageResult | OmadaClientDevice[]>;
    try {
      res = await this.authenticatedFetch<OmadaClientsPageResult | OmadaClientDevice[]>(endpoint);
    } catch {
      // Fallback without filters.active in case of older firmware
      const fallbackEndpoint = `/api/v2/sites/${encodeURIComponent(siteId)}/clients?currentPage=1&currentPageSize=1000`;
      res = await this.authenticatedFetch<OmadaClientsPageResult | OmadaClientDevice[]>(fallbackEndpoint);
    }

    if (res.errorCode !== 0) {
      throw new Error(`Failed to retrieve clients: ${res.msg} (code ${res.errorCode})`);
    }

    if (Array.isArray(res.result)) {
      return res.result;
    }

    if (res.result && Array.isArray((res.result as OmadaClientsPageResult).data)) {
      return (res.result as OmadaClientsPageResult).data;
    }

    return [];
  }

  /**
   * Computes a structured network telemetry status summary
   */
  async getNetworkStatus(): Promise<NetworkStatusSummary> {
    try {
      await this.login();
      const siteId = await this.getResolvedSiteId();
      const clients = await this.getActiveClients();

      const wirelessClients = clients.filter((c) => c.wireless).length;
      const wiredClients = clients.filter((c) => !c.wireless).length;
      
      const totalActivityRate = clients.reduce((sum, c) => sum + (c.activity || 0), 0);
      const totalTrafficDown = clients.reduce((sum, c) => sum + (c.trafficDown || 0), 0);
      const totalTrafficUp = clients.reduce((sum, c) => sum + (c.trafficUp || 0), 0);

      return {
        controllerOnline: true,
        omadacId: this.omadacId,
        siteId,
        siteName: this.resolvedSiteName,
        totalClients: clients.length,
        wirelessClients,
        wiredClients,
        totalActivityRate,
        totalTrafficDown,
        totalTrafficUp,
        lastUpdated: new Date().toISOString(),
        error: null,
      };
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : 'Unknown connection error';
      return {
        controllerOnline: false,
        omadacId: this.omadacId,
        siteId: this.siteNameOrId,
        siteName: this.resolvedSiteName,
        totalClients: 0,
        wirelessClients: 0,
        wiredClients: 0,
        totalActivityRate: 0,
        totalTrafficDown: 0,
        totalTrafficUp: 0,
        lastUpdated: new Date().toISOString(),
        error: errMessage,
      };
    }
  }

  /**
   * Retrieves top clients sorted by real-time activity (bytes/sec) or total traffic
   */
  async getTopClients(limit = 10, sortBy: 'activity' | 'traffic' | 'uptime' = 'activity'): Promise<OmadaClientDevice[]> {
    const clients = await this.getActiveClients();

    const sorted = [...clients].sort((a, b) => {
      if (sortBy === 'traffic') {
        const aTraffic = (a.trafficDown || 0) + (a.trafficUp || 0);
        const bTraffic = (b.trafficDown || 0) + (b.trafficUp || 0);
        return bTraffic - aTraffic;
      }
      if (sortBy === 'uptime') {
        return (b.uptime || 0) - (a.uptime || 0);
      }
      return (b.activity || 0) - (a.activity || 0);
    });

    return sorted.slice(0, limit);
  }
}

// Global cached client instance for server-side Next.js route handlers & MCP tools
let globalOmadaClient: OmadaClient | null = null;

export function getOmadaClient(): OmadaClient {
  if (!globalOmadaClient) {
    globalOmadaClient = new OmadaClient();
  }
  return globalOmadaClient;
}

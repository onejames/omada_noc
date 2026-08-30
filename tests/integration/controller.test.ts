import { describe, it, expect } from 'vitest';
import { OmadaClient } from '@/lib/omada/client';

describe('Omada Controller Integration Test', () => {
  it('instantiates and attempts connection to configured controller', async () => {
    const client = new OmadaClient();
    
    // We execute getNetworkStatus() which will either succeed against a live controller
    // or return a structured offline status if the controller is unreachable in CI/test environments
    const status = await client.getNetworkStatus();
    
    expect(status).toBeDefined();
    expect(typeof status.controllerOnline).toBe('boolean');
    expect(typeof status.siteId).toBe('string');
    expect(typeof status.totalClients).toBe('number');
    expect(typeof status.totalActivityRate).toBe('number');
    expect(typeof status.lastUpdated).toBe('string');

    if (status.controllerOnline) {
      expect(status.omadacId).toBeTruthy();
      expect(status.totalClients).toBeGreaterThanOrEqual(0);
      const clients = await client.getActiveClients();
      expect(Array.isArray(clients)).toBe(true);
    } else {
      expect(status.error).toBeDefined();
    }
  }, 30000);
});

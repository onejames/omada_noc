import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runComparativeAiInsight } from '@/lib/ai/insights';
import * as dbQueries from '@/lib/db/queries';

describe('Iterative AI Insights Engine (lib/ai/insights.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('establishes initial baseline when no prior audit history exists (Cold Start)', async () => {
    vi.spyOn(dbQueries, 'getRecentAiInsights').mockResolvedValue([]);
    vi.spyOn(dbQueries, 'saveAiInsight').mockImplementation(async (data: any) => ({
      ...data,
      id: 'insight-1',
      createdAt: '2026-08-28T12:00:00Z',
    }));

    const mockClient = {
      getNetworkStatus: vi.fn().mockResolvedValue({ siteName: 'The Farm' }),
      getActiveClients: vi.fn().mockResolvedValue({
        clients: [
          {
            mac: 'AA:BB:CC:DD:EE:01',
            name: 'Client-1',
            wireless: true,
            rssi: -50,
            channel: 36,
          },
        ],
        total: 1,
      }),
      getDevices: vi.fn().mockResolvedValue([
        { mac: '00:11:22:33:44:01', name: 'AP-1', type: 'ap', status: 1 },
      ]),
    };

    const insight = await runComparativeAiInsight('user-1', mockClient as any);

    expect(insight.trendDirection).toBe('INITIAL');
    expect(insight.previousScore).toBeNull();
    expect(insight.scoreDelta).toBe(0);
    expect(insight.executiveSummary).toContain('Initial diagnostic benchmark');
    expect(insight.actionableSuggestions[0].id).toBe('sug-opt-routine');
  });

  it('detects persisting and resolved issues against previous baseline audits', async () => {
    const previousAudit: any = {
      id: 'insight-prev',
      createdAt: '2026-08-28T10:00:00Z',
      healthScore: 78,
      newIssues: [
        {
          id: 'rf-weak-AABBCCDDEE02',
          category: 'RF_SIGNAL',
          severity: 'WARNING',
          title: 'Sub-Optimal RF Signal (Client-Weak)',
          description: 'Weak signal -85 dBm',
        },
        {
          id: 'dev-offline-001122334402',
          category: 'DEVICE_OFFLINE',
          severity: 'CRITICAL',
          title: 'Infrastructure Node Offline (AP-Barn)',
          description: 'Device offline',
        },
      ],
      persistingIssues: [],
    };

    vi.spyOn(dbQueries, 'getRecentAiInsights').mockResolvedValue([previousAudit]);
    vi.spyOn(dbQueries, 'saveAiInsight').mockImplementation(async (data: any) => ({
      ...data,
      id: 'insight-2',
      createdAt: '2026-08-28T12:00:00Z',
    }));

    const mockClient = {
      getNetworkStatus: vi.fn().mockResolvedValue({ siteName: 'The Farm' }),
      getActiveClients: vi.fn().mockResolvedValue({
        clients: [
          {
            mac: 'AA:BB:CC:DD:EE:02',
            name: 'Client-Weak',
            wireless: true,
            rssi: -86,
            channel: 6,
          },
        ],
        total: 1,
      }),
      getDevices: vi.fn().mockResolvedValue([
        { mac: '00:11:22:33:44:01', name: 'AP-1', type: 'ap', status: 1 },
        { mac: '00:11:22:33:44:02', name: 'AP-Barn', type: 'ap', status: 1 },
      ]),
    };

    const insight = await runComparativeAiInsight('user-1', mockClient as any);

    expect(insight.trendDirection).toBe('IMPROVED');
    expect(insight.healthScore).toBeGreaterThan(previousAudit.healthScore);
    expect(insight.resolvedIssues.length).toBe(1);
    expect(insight.resolvedIssues[0].id).toBe('dev-offline-001122334402');
    expect(insight.persistingIssues.length).toBe(1);
    expect(insight.persistingIssues[0].id).toBe('rf-weak-AABBCCDDEE02');
    expect(insight.persistingIssues[0].persistedAuditCount).toBe(2);
    expect(insight.actionableSuggestions.some((s) => s.id === 'sug-rf-roam')).toBe(true);
  });

  it('detects degraded performance, offline nodes, 2.4GHz saturation, and bandwidth bursts', async () => {
    const previousAudit: any = {
      id: 'insight-perfect',
      createdAt: '2026-08-28T10:00:00Z',
      healthScore: 100,
      newIssues: [],
      persistingIssues: [],
    };

    vi.spyOn(dbQueries, 'getRecentAiInsights').mockResolvedValue([previousAudit]);
    vi.spyOn(dbQueries, 'saveAiInsight').mockImplementation(async (data: any) => ({
      ...data,
      id: 'insight-3',
      createdAt: '2026-08-28T12:00:00Z',
    }));

    // 7 clients on 2.4GHz (>65% saturation), 1 with >50Mbps activity burst, 1 offline AP
    const mockClients = [
      { mac: 'C1', wireless: true, channel: 1, activity: 7000000 }, // ~56 Mbps burst
      { mac: 'C2', wireless: true, channel: 6, activity: 1000 },
      { mac: 'C3', wireless: true, channel: 11, activity: 1000 },
      { mac: 'C4', wireless: true, channel: 1, activity: 1000 },
      { mac: 'C5', wireless: true, channel: 6, activity: 1000 },
      { mac: 'C6', wireless: true, channel: 11, activity: 1000 },
      { mac: 'C7', wireless: true, channel: 6, activity: 1000 },
    ];

    const mockClient = {
      getNetworkStatus: vi.fn().mockResolvedValue({ siteName: 'The Farm' }),
      getActiveClients: vi.fn().mockResolvedValue({ clients: mockClients, total: 7 }),
      getDevices: vi.fn().mockResolvedValue([
        { mac: 'AP-OFF', name: 'AP-West', type: 'ap', status: 0 }, // Offline!
      ]),
    };

    const insight = await runComparativeAiInsight('user-1', mockClient as any);

    expect(insight.trendDirection).toBe('DEGRADED');
    expect(insight.healthScore).toBeLessThan(previousAudit.healthScore);
    expect(insight.newIssues.some((i) => i.category === 'DEVICE_OFFLINE')).toBe(true);
    expect(insight.newIssues.some((i) => i.category === 'CHANNEL_CONGESTION')).toBe(true);
    expect(insight.newIssues.some((i) => i.category === 'BANDWIDTH_BURST')).toBe(true);
    expect(insight.actionableSuggestions.some((s) => s.id === 'sug-crit-offline')).toBe(true);
    expect(insight.actionableSuggestions.some((s) => s.id === 'sug-band-steering')).toBe(true);
  });

  it('detects stable trend when score change is within ±2', async () => {
    const previousAudit: any = {
      id: 'insight-stable-prev',
      createdAt: '2026-08-28T10:00:00Z',
      healthScore: 98,
      newIssues: [],
      persistingIssues: [],
    };

    vi.spyOn(dbQueries, 'getRecentAiInsights').mockResolvedValue([previousAudit]);
    vi.spyOn(dbQueries, 'saveAiInsight').mockImplementation(async (data: any) => ({
      ...data,
      id: 'insight-4',
      createdAt: '2026-08-28T12:00:00Z',
    }));

    const mockClient = {
      getNetworkStatus: vi.fn().mockResolvedValue({ siteName: 'The Farm' }),
      getActiveClients: vi.fn().mockResolvedValue({
        clients: [
          { mac: 'C1', wireless: true, channel: 36, rssi: -55, activity: 1000 },
        ],
        total: 1,
      }),
      getDevices: vi.fn().mockResolvedValue([
        { mac: 'AP-1', name: 'AP-1', type: 'ap', status: 1 },
      ]),
    };

    const insight = await runComparativeAiInsight('user-1', mockClient as any);

    expect(insight.trendDirection).toBe('STABLE');
    expect(insight.executiveSummary).toContain('remains stable');
  });

  it('correctly recognizes IoT clients and avoids false-positive 2.4 GHz congestion warnings', async () => {
    vi.spyOn(dbQueries, 'getRecentAiInsights').mockResolvedValue([]);
    vi.spyOn(dbQueries, 'saveAiInsight').mockImplementation(async (data: any) => ({
      ...data,
      id: 'insight-iot',
      createdAt: '2026-08-28T12:00:00Z',
    }));

    // 6 clients on 2.4GHz on VLAN 20 / IoT SSID
    const mockIotClients = [
      { mac: '40:9B:CD:01', name: 'Ring Front Cam', wireless: true, channel: 1, vlanId: 20, ssid: 'TheFarmIot' },
      { mac: '24:DC:AA:02', name: 'Shelly Smart Plug', wireless: true, channel: 6, vlanId: 20, ssid: 'TheFarmIot' },
      { mac: 'EC:FA:BB:03', name: 'ESP32 Sensor', wireless: true, channel: 11, vlanId: 20, ssid: 'TheFarmIot' },
      { mac: 'B0:72:CC:04', name: 'Alexa Echo Dot', wireless: true, channel: 1, vlanId: 20, ssid: 'TheFarmAlexa' },
      { mac: '11:22:33:05', name: 'Schlage Smart Lock', wireless: true, channel: 6, vlanId: 20, ssid: 'TheFarmIot' },
      { mac: '11:22:33:06', name: 'Kasa Light Switch', wireless: true, channel: 11, vlanId: 20, ssid: 'TheFarmIot' },
      { mac: 'AA:BB:CC:07', name: 'MacBook Pro 16', wireless: true, channel: 36, vlanId: 1, ssid: 'TheFarmStrlnk' },
    ];

    const mockClient = {
      getNetworkStatus: vi.fn().mockResolvedValue({ siteName: 'The Farm' }),
      getActiveClients: vi.fn().mockResolvedValue({ clients: mockIotClients, total: 7 }),
      getDevices: vi.fn().mockResolvedValue([{ mac: 'AP-1', name: 'AP-1', type: 'ap', status: 1 }]),
      getLanNetworks: vi.fn().mockResolvedValue([{ id: 'net-20', name: 'Smart Home (IoT)', vlan: 20 }]),
      getSsids: vi.fn().mockResolvedValue([{ id: 'ssid-iot', name: 'TheFarmIot', bandText: '2.4G' }]),
      getWanStatus: vi.fn().mockResolvedValue({ primaryWan: { latencyMs: 24, online: true } }),
      getPoeBudgets: vi.fn().mockResolvedValue([{ name: 'SG2218P', poeRemain: 124 }]),
    };

    const insight = await runComparativeAiInsight('user-1', mockClient as any);

    // Verify it is NOT flagged as a WARNING channel congestion, but as an INFO expected IoT segregation
    expect(insight.newIssues.some((i) => i.id === 'rf-2g-iot-segregated' && i.severity === 'INFO')).toBe(true);
    expect(insight.newIssues.some((i) => i.id === 'rf-2g-saturation')).toBe(false);

    // Verify 3-part narration was generated
    expect(insight.narration).toBeDefined();
    expect(insight.narration?.historyContext).toBeDefined();
    expect(insight.narration?.deltaChanges).toBeDefined();
    expect(insight.narration?.currentStatus).toContain('IoT/smart home clients are cleanly segregated');
    expect(insight.narration?.fullNarrative).toContain(insight.narration?.currentStatus);
  });

  it('executes runDeepSeekAgentInsight with Ollama neural generation and extracts Chain-of-Thought', async () => {
    const { runDeepSeekAgentInsight } = await import('@/lib/ai/insights');
    vi.spyOn(dbQueries, 'getRecentAiInsights').mockResolvedValue([]);
    vi.spyOn(dbQueries, 'saveAiInsight').mockImplementation(async (data: any) => ({
      ...data,
      id: 'insight-deepseek-1',
      createdAt: '2026-08-28T12:00:00Z',
    }));

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/generate')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            model: 'deepseek-r1:7b',
            response: `<think>
Analyzing clients: 2 clients connected, 1 on 5GHz, 1 on 2.4GHz IoT.
Everything is optimal.
</think>
{
  "healthScore": 95,
  "trendDirection": "IMPROVED",
  "executiveSummary": "DeepSeek-R1 verified healthy network conditions.",
  "narration": {
    "historyContext": "Baseline is stable.",
    "deltaChanges": "+1 device joined IoT VLAN.",
    "currentStatus": "Optimal posture."
  },
  "issues": [
    {
      "id": "deepseek-iss-1",
      "category": "RF_SIGNAL",
      "severity": "INFO",
      "title": "Clean Spectrum",
      "description": "5GHz is cleanly utilized."
    }
  ],
  "suggestions": [
    {
      "id": "deepseek-sug-1",
      "priority": "LOW",
      "title": "Maintain Baseline",
      "action": "No immediate remediation required.",
      "expectedImpact": "Continued high throughput."
    }
  ]
}`,
          }),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    const mockClient = {
      getNetworkStatus: vi.fn().mockResolvedValue({ siteName: 'The Farm' }),
      getActiveClients: vi.fn().mockResolvedValue([
        { mac: 'AA:11', name: 'Workstation', wireless: true, channel: 36 },
      ]),
      getDevices: vi.fn().mockResolvedValue([{ mac: 'AP-1', name: 'AP-1', type: 'ap', status: 1 }]),
      getLanNetworks: vi.fn().mockResolvedValue([{ id: 'net-20', name: 'IoT', vlan: 20 }]),
      getSsids: vi.fn().mockResolvedValue([{ id: 's1', name: 'TheFarmIot', bandText: '2.4G' }]),
    };

    const insight = await runDeepSeekAgentInsight('user-admin', mockClient as any);

    expect(insight.engineType).toBe('DEEPSEEK_AGENT');
    expect(insight.llmModel).toBe('deepseek-r1:7b');
    expect(insight.thinkingProcess).toContain('Analyzing clients');
    expect(insight.healthScore).toBe(95);
    expect(insight.executiveSummary).toContain('DeepSeek-R1 verified');
    expect(insight.narration?.currentStatus).toBe('Optimal posture.');
  });

  it('tests isIotClient helper directly across VLANs, SSIDs, and vendor keywords', async () => {
    const { isIotClient } = await import('@/lib/ai/insights');
    const networks = [
      { id: '1', name: 'Management', vlan: 1, gatewaySubnet: '192.168.1.1/24', dhcpEnable: true },
      { id: '2', name: 'IoT Devices', vlan: 30, gatewaySubnet: '192.168.30.1/24', dhcpEnable: true },
    ];

    expect(isIotClient({ mac: 'AA:11', vlanId: 20 } as any)).toBe(true);
    expect(isIotClient({ mac: 'AA:11', vlanId: 50 } as any)).toBe(true);
    expect(isIotClient({ mac: 'AA:11', vlanId: 30 } as any, networks as any)).toBe(true);
    expect(isIotClient({ mac: 'AA:11', ssid: 'iot-dmz' } as any)).toBe(true);
    expect(isIotClient({ mac: '40:9B:CD:11' } as any)).toBe(true);
    expect(isIotClient({ mac: 'B0:72:00:11' } as any)).toBe(true);
    expect(isIotClient({ mac: '24:DC:00:11' } as any)).toBe(true);
    expect(isIotClient({ mac: 'EC:FA:00:11' } as any)).toBe(true);
    expect(isIotClient({ mac: 'AA:11', name: 'Philips Hue Bridge' } as any)).toBe(true);
    expect(isIotClient({ mac: 'AA:11', name: 'Feit Smart Bulb' } as any)).toBe(true);
    expect(isIotClient({ mac: 'AA:11', name: 'Sonoff Relay' } as any)).toBe(true);
    expect(isIotClient({ mac: 'AA:11', name: 'Wemo Mini' } as any)).toBe(true);
    expect(isIotClient({ mac: 'AA:11', name: 'MacBook Pro' } as any)).toBe(false);
  });
});

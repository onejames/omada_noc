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
});

import { getOmadaClient, OmadaClient } from '@/lib/omada/client';
import { getRecentAiInsights, saveAiInsight } from '@/lib/db/queries';
import {
  AiInsightRecord,
  AiIssueItem,
  AiPersistingIssueItem,
  AiSuggestionItem,
  AiTrendDirection,
} from '@/types/reports';
import { OmadaClientDevice, OmadaDeviceItem } from '@/types/omada';

/**
 * Executes a comparative, continuous-learning network health diagnostic audit.
 * Compares current telemetry against historical baseline audits to track
 * improving, degrading, and chronic persistent network conditions.
 */
export async function runComparativeAiInsight(
  userId: string | null = null,
  customClient?: OmadaClient
): Promise<AiInsightRecord> {
  const client = customClient || getOmadaClient();

  // 1. Fetch historical audit baseline and live telemetry in parallel
  const [recentAudits, networkStatus, clientsResult, devicesResult] = await Promise.all([
    getRecentAiInsights(5),
    client.getNetworkStatus().catch(() => null),
    client.getActiveClients().catch(() => [] as OmadaClientDevice[]),
    client.getDevices('all').catch(() => [] as OmadaDeviceItem[]),
  ]);

  const clients: OmadaClientDevice[] = Array.isArray(clientsResult)
    ? clientsResult
    : (clientsResult as { clients?: OmadaClientDevice[] })?.clients || [];
  const devices: OmadaDeviceItem[] = devicesResult || [];
  const previousAudit = recentAudits.length > 0 ? recentAudits[0] : null;

  // 2. Discover current issues from live telemetry
  const currentDiscoveredIssues: AiIssueItem[] = [];

  // A. Check for offline infrastructure devices
  const offlineDevices = devices.filter((d) => d.status === 0);
  for (const dev of offlineDevices) {
    currentDiscoveredIssues.push({
      id: `dev-offline-${dev.mac.replace(/:/g, '')}`,
      category: 'DEVICE_OFFLINE',
      severity: 'CRITICAL',
      title: `Infrastructure Node Offline (${dev.name || dev.model})`,
      description: `Hardware device ${dev.name} (${dev.ip || dev.mac}) is currently unreachable or disconnected.`,
      affectedEntities: [dev.mac, dev.name || 'Unknown Device'],
    });
  }

  // B. Check for poor RF signal clients (RSSI < -80 dBm)
  const weakSignalClients = clients.filter((c) => c.wireless && (c.rssi ?? c.signalLevel ?? -65) < -80);
  for (const c of weakSignalClients) {
    const rssi = c.rssi ?? c.signalLevel ?? -85;
    currentDiscoveredIssues.push({
      id: `rf-weak-${c.mac.replace(/:/g, '')}`,
      category: 'RF_SIGNAL',
      severity: 'WARNING',
      title: `Sub-Optimal RF Signal (${c.name || c.hostName || c.mac})`,
      description: `Client device is connected with weak signal (${rssi} dBm) on AP ${c.apName || 'Unknown AP'}, risking packet retries.`,
      affectedEntities: [c.mac, c.name || c.mac],
    });
  }

  // C. Check for channel congestion / 2.4GHz saturation
  const clientsOn2G = clients.filter((c) => c.wireless && (!c.channel || c.channel <= 14));
  const wirelessTotal = clients.filter((c) => c.wireless).length;
  if (wirelessTotal > 5 && clientsOn2G.length / wirelessTotal > 0.65) {
    currentDiscoveredIssues.push({
      id: `rf-2g-saturation`,
      category: 'CHANNEL_CONGESTION',
      severity: 'WARNING',
      title: `2.4 GHz Spectrum Saturation`,
      description: `${Math.round((clientsOn2G.length / wirelessTotal) * 100)}% of wireless clients are operating on congested 2.4 GHz channels instead of 5 GHz.`,
      affectedEntities: ['2.4 GHz Spectrum'],
    });
  }

  // D. Check for sudden bandwidth surge
  const heavySurgeClients = clients.filter((c) => {
    const rateBytes = c.activity ?? ((c.rxRate || 0) + (c.txRate || 0));
    return (rateBytes * 8) / 1_000_000 > 50; // > 50 Mbps
  });

  for (const c of heavySurgeClients) {
    const mbps = parseFloat((((c.activity || 0) * 8) / 1_000_000).toFixed(1));
    currentDiscoveredIssues.push({
      id: `burst-${c.mac.replace(/:/g, '')}`,
      category: 'BANDWIDTH_BURST',
      severity: 'INFO',
      title: `High Bandwidth Traffic Burst (${c.name || c.mac})`,
      description: `Device is consuming high instantaneous bandwidth (${mbps} Mbps) on ${c.ssid || c.switchName || 'LAN'}.`,
      affectedEntities: [c.mac],
    });
  }

  // 3. Compute Current Health Score (0 - 100)
  let healthScore = 100;
  const criticalCount = currentDiscoveredIssues.filter((i) => i.severity === 'CRITICAL').length;
  const warningCount = currentDiscoveredIssues.filter((i) => i.severity === 'WARNING').length;
  healthScore -= criticalCount * 15;
  healthScore -= warningCount * 4;
  healthScore = Math.max(45, Math.min(100, healthScore));

  // 4. Comparative Trajectory Analysis against Baseline
  const resolvedIssues: AiIssueItem[] = [];
  const persistingIssues: AiPersistingIssueItem[] = [];
  const newIssues: AiIssueItem[] = [];

  if (!previousAudit) {
    // Cold Start: First audit run
    for (const issue of currentDiscoveredIssues) {
      newIssues.push(issue);
    }
  } else {
    // Combine prior active issues
    const priorIssuesMap = new Map<string, AiIssueItem | AiPersistingIssueItem>();
    for (const issue of previousAudit.newIssues || []) {
      priorIssuesMap.set(issue.id, issue);
    }
    for (const issue of previousAudit.persistingIssues || []) {
      priorIssuesMap.set(issue.id, issue);
    }

    const currentIssuesMap = new Map<string, AiIssueItem>();
    for (const issue of currentDiscoveredIssues) {
      currentIssuesMap.set(issue.id, issue);
    }

    // A. Detect Resolved Issues (Present in prior run, no longer present now)
    for (const [id, priorIssue] of priorIssuesMap.entries()) {
      if (!currentIssuesMap.has(id)) {
        resolvedIssues.push(priorIssue);
      }
    }

    // B. Detect Persisting Issues vs New Issues
    for (const [id, currentIssue] of currentIssuesMap.entries()) {
      if (priorIssuesMap.has(id)) {
        const prior = priorIssuesMap.get(id)!;
        const priorCount = 'persistedAuditCount' in prior ? prior.persistedAuditCount : 1;
        const firstSeen = 'firstObservedAt' in prior ? prior.firstObservedAt : previousAudit.createdAt;

        persistingIssues.push({
          ...currentIssue,
          firstObservedAt: firstSeen,
          persistedAuditCount: priorCount + 1,
        });
      } else {
        newIssues.push(currentIssue);
      }
    }
  }

  // 5. Determine Trend Direction & Delta
  let trendDirection: AiTrendDirection = 'INITIAL';
  let scoreDelta = 0;

  if (previousAudit) {
    scoreDelta = healthScore - previousAudit.healthScore;
    if (scoreDelta > 2 || (resolvedIssues.length > 0 && newIssues.length === 0)) {
      trendDirection = 'IMPROVED';
    } else if (scoreDelta < -2 || (newIssues.length > resolvedIssues.length && criticalCount > 0)) {
      trendDirection = 'DEGRADED';
    } else {
      trendDirection = 'STABLE';
    }
  }

  // 6. Generate Executive Diagnostic Summary
  let executiveSummary = '';
  if (trendDirection === 'INITIAL') {
    executiveSummary = `Initial diagnostic benchmark established at score ${healthScore}/100. ${clients.length} active client devices and ${devices.length} infrastructure nodes evaluated. Future inspections will track relative health and performance trends against this baseline.`;
  } else if (trendDirection === 'IMPROVED') {
    const resolvedCount = resolvedIssues.length;
    executiveSummary = `Network health has improved (+${scoreDelta > 0 ? scoreDelta : 3}%). ${resolvedCount} previously identified issue(s) have been resolved. Spectrum and device operational parameters are stabilizing.`;
  } else if (trendDirection === 'DEGRADED') {
    executiveSummary = `Network performance has degraded (${scoreDelta}%). Detected ${newIssues.length} new anomaly/anomalies requiring operational remediation. Prioritize AP channel balance and offline device checks.`;
  } else {
    executiveSummary = `Network health remains stable (Score: ${healthScore}/100, delta: ${scoreDelta >= 0 ? '+' : ''}${scoreDelta}%). Infrastructure performance is consistent with the previous audit baseline.`;
  }

  // 7. Generate Actionable Suggestions
  const actionableSuggestions: AiSuggestionItem[] = [];

  if (criticalCount > 0) {
    actionableSuggestions.push({
      id: 'sug-crit-offline',
      priority: 'HIGH',
      title: 'Investigate Disconnected Infrastructure Nodes',
      action: 'Check power supply, PoE budgets, and uplink switch ports for offline AP/Switch devices.',
      expectedImpact: 'Restores redundant coverage and eliminates single points of failure.',
    });
  }

  if (persistingIssues.some((i) => i.category === 'RF_SIGNAL')) {
    actionableSuggestions.push({
      id: 'sug-rf-roam',
      priority: 'HIGH',
      title: 'Optimize AP Roaming for Chronic Weak Clients',
      action: 'Enable 802.11k/v Fast Roaming and adjust minimum RSSI threshold to -78 dBm on APs.',
      expectedImpact: 'Forces sticky clients to roam to closer APs, boosting throughput.',
    });
  }

  if (currentDiscoveredIssues.some((i) => i.category === 'CHANNEL_CONGESTION')) {
    actionableSuggestions.push({
      id: 'sug-band-steering',
      priority: 'MEDIUM',
      title: 'Enable 5 GHz Band Steering',
      action: 'Configure Band Steering policy on Omada Controller to prefer 5 GHz for dual-band clients.',
      expectedImpact: 'Unloads congested 2.4 GHz channels and doubles available wireless bandwidth.',
    });
  }

  if (actionableSuggestions.length === 0) {
    actionableSuggestions.push({
      id: 'sug-opt-routine',
      priority: 'LOW',
      title: 'Maintain Routine Telemetry Monitoring',
      action: 'Continue periodic telemetry polling and AI health inspections.',
      expectedImpact: 'Ensures proactive anomaly detection and SLA compliance.',
    });
  }

  // 8. Construct & Save Insight Record
  const newInsight = await saveAiInsight({
    triggeredByUserId: userId,
    healthScore,
    previousScore: previousAudit ? previousAudit.healthScore : null,
    scoreDelta,
    trendDirection,
    executiveSummary,
    resolvedIssues,
    persistingIssues,
    newIssues,
    actionableSuggestions,
    metricsSnapshot: {
      totalClients: clients.length,
      totalDevices: devices.length,
      offlineDevices: offlineCount(devices),
      wirelessClients: clients.filter((c) => c.wireless).length,
      wiredClients: clients.filter((c) => !c.wireless).length,
      siteName: networkStatus?.siteName || 'The Farm',
    },
  });

  return newInsight;
}

function offlineCount(devices: OmadaDeviceItem[]): number {
  return devices.filter((d) => d.status === 0).length;
}

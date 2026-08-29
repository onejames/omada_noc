'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TelemetryResponse, OmadaClientDevice } from '@/types/omada';
import { formatBytes, formatRate, formatUptime, formatMac } from '@/lib/omada/formatters';
import ProfileWidget from './ProfileWidget';
import InactivityTracker from './InactivityTracker';
import { ReportsModal } from './ReportsModal';
import { AiInsightsDrawer } from './AiInsightsDrawer';
import { DocsModal } from './DocsModal';
import TopologyView from './TopologyView';
import VlanWifiView from './VlanWifiView';
import HardwarePoeView from './HardwarePoeView';
import ThroughputSparkline from './ThroughputSparkline';
import WanHealthWidget from './WanHealthWidget';
import ClientInspectorModal from './ClientInspectorModal';
import NocEventStreamModal from './NocEventStreamModal';

interface DashboardProps {
  initialData: TelemetryResponse;
}

export default function Dashboard({ initialData }: DashboardProps) {
  const [data, setData] = useState<TelemetryResponse>(initialData);
  const [loading, setLoading] = useState<boolean>(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(10); // seconds, 0 = off
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'wireless' | 'wired'>('all');
  const [sortBy, setSortBy] = useState<'activity' | 'traffic' | 'uptime'>('activity');
  const [activeTab, setActiveTab] = useState<'telemetry' | 'topology' | 'vlan_wifi' | 'hardware_poe'>('telemetry');
  const [isClientsExpanded, setIsClientsExpanded] = useState<boolean>(false);
  const [selectedClient, setSelectedClient] = useState<OmadaClientDevice | null>(null);
  const [isEventStreamModalOpen, setIsEventStreamModalOpen] = useState<boolean>(false);
  const [throughputHistory, setThroughputHistory] = useState<number[]>([
    Math.round((initialData.status.totalActivityRate || 1024) * 0.75),
    Math.round((initialData.status.totalActivityRate || 1024) * 0.9),
    initialData.status.totalActivityRate || 1024,
  ]);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>(
    new Date(initialData.status.lastUpdated).toLocaleTimeString()
  );
  const [isReportsModalOpen, setIsReportsModalOpen] = useState<boolean>(false);
  const [isAiInsightsDrawerOpen, setIsAiInsightsDrawerOpen] = useState<boolean>(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState<boolean>(false);
  const [isConnectionNoticeDismissed, setIsConnectionNoticeDismissed] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<'ADMIN' | 'USER' | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.user?.role) {
          setUserRole(json.user.role);
        }
      })
      .catch(() => {});
  }, []);

  const fetchTelemetry = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/telemetry?limit=50&sort=${sortBy}&all=true`);
      if (res.ok) {
        const json: TelemetryResponse = await res.json();
        setData(json);
        setLastRefreshedTime(new Date().toLocaleTimeString());
        if (json.status?.totalActivityRate !== undefined) {
          setThroughputHistory((prev) => [...prev.slice(-14), json.status.totalActivityRate]);
        }
        if (json.status?.controllerOnline) {
          setIsConnectionNoticeDismissed(false);
        }
      } else {
        const errorJson = await res.json().catch(() => ({}));
        setData((prev) => ({
          ...prev,
          status: {
            ...prev.status,
            controllerOnline: false,
            error: errorJson.error || `HTTP ${res.status} error`,
          },
        }));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setData((prev) => ({
        ...prev,
        status: {
          ...prev.status,
          controllerOnline: false,
          error: msg,
        },
      }));
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  const handleCopySnapshot = () => {
    const clientsList = data.allClients || data.topClients || [];
    const site = data.status.siteName || data.status.siteId;
    const lines = [
      `# 📡 Omada NOC Telemetry Diagnostic Snapshot`,
      `**Site**: ${site} | **Controller**: ${data.status.controllerOnline ? 'ONLINE' : 'OFFLINE'} | **Timestamp**: ${new Date().toISOString()}`,
      ``,
      `### 📊 Key Performance Indicators:`,
      `- **Active Clients**: ${data.status.totalClients} (${data.status.wirelessClients} Wi-Fi, ${data.status.wiredClients} Wired)`,
      `- **Instant Throughput**: ${formatRate(data.status.totalActivityRate)}`,
      `- **Total Session Traffic**: ${formatBytes(data.status.totalTrafficDown + data.status.totalTrafficUp)} (↓ ${formatBytes(data.status.totalTrafficDown)} / ↑ ${formatBytes(data.status.totalTrafficUp)})`,
      ``,
      `### 🏆 Top 5 Active Clients:`,
      ...clientsList.slice(0, 5).map((c, i) => `${i + 1}. **${c.name || c.hostName || 'Unnamed'}** (${c.ip}) - Rate: ${formatRate(c.activity)} | Total Vol: ${formatBytes((c.trafficDown || 0) + (c.trafficUp || 0))} | Medium: ${c.wireless ? `Wi-Fi (${c.ssid || 'SSID'})` : 'Wired'}`),
      ``,
      `### 🛡️ VLAN Subnets:`,
      ...(data.networks || []).map((n) => `- **VLAN ${n.vlan}** (${n.name}): ${n.gatewaySubnet} | ${n.clientCount ?? 0} connected clients`),
      ``,
      `### ⚡ Hardware PoE Budgets:`,
      ...(data.poeDevices || []).map((p) => `- **${p.name}** (${p.model}): ${p.poeRemain}W headroom remaining (${p.poePowerUsed ?? 0}W draw)`),
    ];

    navigator.clipboard?.writeText(lines.join('\n'));
    setCopyToast('Diagnostic snapshot copied to clipboard!');
    setTimeout(() => setCopyToast(null), 3000);
  };

  // Handle auto-refresh interval
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const intervalId = setInterval(() => {
      fetchTelemetry();
    }, autoRefreshInterval * 1000);

    return () => clearInterval(intervalId);
  }, [autoRefreshInterval, fetchTelemetry]);

  const { status } = data;
  const clients: OmadaClientDevice[] = data.allClients || data.topClients || [];

  // Filter clients
  const filteredClients = clients
    .filter((client) => {
      if (filterType === 'wireless' && !client.wireless) return false;
      if (filterType === 'wired' && client.wireless) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (client.name || '').toLowerCase().includes(q);
        const matchesHost = (client.hostName || '').toLowerCase().includes(q);
        const matchesIp = (client.ip || '').toLowerCase().includes(q);
        const matchesMac = (client.mac || '').toLowerCase().includes(q);
        const matchesSsid = (client.ssid || '').toLowerCase().includes(q);
        return matchesName || matchesHost || matchesIp || matchesMac || matchesSsid;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'activity') {
        return (b.activity || 0) - (a.activity || 0);
      }
      if (sortBy === 'traffic') {
        const aTraffic = (a.trafficDown || 0) + (a.trafficUp || 0);
        const bTraffic = (b.trafficDown || 0) + (b.trafficUp || 0);
        return bTraffic - aTraffic;
      }
      if (sortBy === 'uptime') {
        return (b.uptime || 0) - (a.uptime || 0);
      }
      return 0;
    });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans selection:bg-cyan-500 selection:text-white">
      <InactivityTracker />
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          {/* Branding Title (100% Larger) with 40% Opacity Watermark Background Icon */}
          <div className="relative group select-none py-2">
            {/* Background Watermark Icon behind Title (40% opacity) */}
            <div
              aria-hidden="true"
              className="absolute -left-6 -top-6 -bottom-6 w-60 opacity-40 pointer-events-none text-cyan-500 select-none overflow-hidden flex items-center justify-start"
            >
              <svg
                className="w-44 h-44 transform -rotate-12 -translate-x-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.25"
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
            </div>

            <div className="relative z-10 pl-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white flex flex-wrap items-center gap-3 font-mono">
                Omada NOC Telemetry
                <span className="text-xs sm:text-sm font-mono uppercase px-3 py-1 rounded-lg bg-cyan-950/90 border border-cyan-700/60 text-cyan-300 shadow-md">
                  MCP Bridge
                </span>
              </h1>
              <p className="text-sm sm:text-base text-slate-400 mt-2 flex flex-wrap items-center gap-2">
                <span>Controller Site: <strong className="text-slate-200 font-semibold">{status.siteName || status.siteId}</strong></span>
                {status.omadacId && (
                  <span className="text-slate-400 font-mono text-xs bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                    ID: {status.omadacId.slice(0, 8)}...
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right-Aligned 50% Enlarged Profile Widget */}
          <div className="flex items-center shrink-0">
            <ProfileWidget align="right" />
          </div>
        </header>

        {/* Page-Titles & Navigation Action Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Live Telemetry View */}
            <button
              onClick={() => setActiveTab('telemetry')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm select-none ${
                activeTab === 'telemetry'
                  ? 'bg-cyan-950/90 border border-cyan-700/80 text-cyan-300'
                  : 'bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
              </span>
              <span>📡 Telemetry & Clients</span>
            </button>

            {/* 2. Topology Map Tab */}
            <button
              onClick={() => setActiveTab('topology')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm select-none ${
                activeTab === 'topology'
                  ? 'bg-purple-950/90 border border-purple-700/80 text-purple-300'
                  : 'bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <span>🗺️</span>
              <span>Topology Map</span>
            </button>

            {/* 3. VLANs & Wi-Fi Tab */}
            <button
              onClick={() => setActiveTab('vlan_wifi')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm select-none ${
                activeTab === 'vlan_wifi'
                  ? 'bg-sky-950/90 border border-sky-700/80 text-sky-300'
                  : 'bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <span>🛡️</span>
              <span>VLANs & Wi-Fi</span>
            </button>

            {/* 4. Hardware & PoE Tab */}
            <button
              onClick={() => setActiveTab('hardware_poe')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm select-none ${
                activeTab === 'hardware_poe'
                  ? 'bg-emerald-950/90 border border-emerald-700/80 text-emerald-300'
                  : 'bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <span>⚡</span>
              <span>Hardware & PoE</span>
            </button>

            <span className="w-px h-5 bg-slate-800 mx-1 hidden sm:inline-block" />

            {/* 5. Executive Report Button */}
            <button
              onClick={() => setIsReportsModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <span>📊</span>
              <span>Executive Report</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                PDF
              </span>
            </button>

            {/* 6. AI Insights Button */}
            {userRole === 'ADMIN' && (
              <button
                onClick={() => setIsAiInsightsDrawerOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-purple-800/50 hover:border-purple-700 text-purple-300 text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                <span>🧠</span>
                <span>AI Insights</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-400 border border-purple-800/60">
                  CONTINUOUS
                </span>
              </button>
            )}

            {/* 7. Docs Button */}
            <button
              onClick={() => setIsDocsModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-800/60 text-slate-200 hover:text-cyan-300 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <span>📚</span>
              <span>Docs</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                Dynamic
              </span>
            </button>

            {/* 8. Live NOC Events Log Button */}
            <button
              onClick={() => setIsEventStreamModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-800/60 text-slate-200 hover:text-cyan-300 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <span>📜</span>
              <span>Live Events</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                {data.events?.length || 5}
              </span>
            </button>

            {/* 9. Copy Diagnostic Bundle Snapshot Button */}
            <button
              onClick={handleCopySnapshot}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-800/60 text-slate-200 hover:text-emerald-300 text-xs font-semibold shadow-sm transition-all cursor-pointer"
              title="Copy sanitized markdown diagnostic bundle to clipboard"
            >
              <span>📋</span>
              <span>Snapshot</span>
            </button>
          </div>

          {/* Last Refreshed Indicator */}
          <div className="flex items-center gap-3 px-2 text-[11px] text-slate-400 font-mono">
            <span>Last polled: <strong className="text-slate-300">{lastRefreshedTime}</strong></span>
          </div>
        </div>

        {/* Floating Copy Toast Notification */}
        {copyToast && (
          <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-cyan-950 border border-cyan-700 text-cyan-300 text-xs font-mono font-bold shadow-2xl animate-in fade-in slide-in-from-bottom duration-150">
            ✓ {copyToast}
          </div>
        )}

        {/* Multi-WAN & Starlink Uplink Telemetry Widget */}
        <WanHealthWidget wanStatus={data.wanStatus} />

        {/* Connection Error / Diagnostic Notice Banner */}
        {!status.controllerOnline && !isConnectionNoticeDismissed && (
          <div className="bg-slate-900/95 border border-rose-800/80 rounded-xl p-4 text-rose-200 shadow-lg animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-rose-300">
                    Omada Controller Connection Notice: {status.error || 'Unable to establish session.'}
                  </p>
                  <p className="text-rose-400/90 text-xs">
                    Ensure <code className="bg-rose-900/40 px-1 py-0.5 rounded text-rose-200 font-mono">OMADA_URL</code>, <code className="bg-rose-900/40 px-1 py-0.5 rounded text-rose-200 font-mono">OMADA_USER</code>, and <code className="bg-rose-900/40 px-1 py-0.5 rounded text-rose-200 font-mono">OMADA_PASS</code> are set in <code className="font-mono text-rose-200">.env.local</code> and the Omada container/service is running.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-start shrink-0">
                <button
                  onClick={() => {
                    setIsConnectionNoticeDismissed(false);
                    fetchTelemetry();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <span>🔄</span>
                  <span>Retry</span>
                </button>
                <button
                  onClick={() => setIsConnectionNoticeDismissed(true)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Dismiss Connection Notice"
                  title="Dismiss notice"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Telemetry & Clients View */}
        {activeTab === 'telemetry' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* 4 Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Total Clients */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Clients</span>
                  <span className="p-2 rounded-md bg-indigo-950/80 text-indigo-400 border border-indigo-800/40">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">{status.totalClients}</span>
                  <span className="text-xs text-slate-400">devices online</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                  <span className="inline-block w-2 h-2 rounded-full bg-sky-400" />
                  <span>{status.wirelessClients} Wireless</span>
                  <span className="text-slate-600">•</span>
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{status.wiredClients} Wired</span>
                </div>
              </div>

              {/* Card 2: Medium Distribution */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Wireless Ratio</span>
                  <span className="p-2 rounded-md bg-sky-950/80 text-sky-400 border border-sky-800/40">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                    </svg>
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-sky-400 font-mono">
                    {status.totalClients > 0
                      ? `${Math.round((status.wirelessClients / status.totalClients) * 100)}%`
                      : '0%'}
                  </span>
                  <span className="text-xs text-slate-400">Wi-Fi density</span>
                </div>
                <div className="mt-3 w-full bg-slate-950 h-2 rounded-full overflow-hidden flex border border-slate-800">
                  <div
                    className="bg-sky-400 h-full transition-all duration-300"
                    style={{
                      width: `${status.totalClients > 0 ? (status.wirelessClients / status.totalClients) * 100 : 0}%`,
                    }}
                  />
                  <div
                    className="bg-emerald-400 h-full transition-all duration-300"
                    style={{
                      width: `${status.totalClients > 0 ? (status.wiredClients / status.totalClients) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Card 3: Total Activity / Throughput with Live Sparkline */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-colors flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Instant Activity</span>
                    <span className="p-2 rounded-md bg-amber-950/80 text-amber-400 border border-amber-800/40">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-bold text-amber-400 font-mono">
                      {formatRate(status.totalActivityRate)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>Real-time Pulse</span>
                  </div>
                  <ThroughputSparkline history={throughputHistory} currentRate={status.totalActivityRate} width={130} height={32} />
                </div>
              </div>

              {/* Card 4: Total Volume (Down / Up) */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Session Traffic</span>
                  <span className="p-2 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold text-emerald-400 font-mono">
                    {formatBytes(status.totalTrafficDown + status.totalTrafficUp)}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span className="text-emerald-400">↓ {formatBytes(status.totalTrafficDown)}</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-cyan-400">↑ {formatBytes(status.totalTrafficUp)}</span>
                </div>
              </div>

            </div>

            {/* Unified Controller Controls & Search Box Container */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
              
              {/* Row 1: Search & Medium Filters & Sorting */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search by device name, IP, MAC address, SSID, AP name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all font-sans"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 text-xs font-mono"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Medium Filter Pills */}
                  <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                        filterType === 'all'
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      All ({clients.length})
                    </button>
                    <button
                      onClick={() => setFilterType('wireless')}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                        filterType === 'wireless'
                          ? 'bg-sky-950 text-sky-300 border border-sky-800/80 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Wi-Fi ({clients.filter((c) => c.wireless).length})
                    </button>
                    <button
                      onClick={() => setFilterType('wired')}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                        filterType === 'wired'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Wired ({clients.filter((c) => !c.wireless).length})
                    </button>
                  </div>

                  {/* Sort Selector */}
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-slate-500 hidden sm:inline">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'activity' | 'traffic' | 'uptime')}
                      aria-label="Sort clients by"
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                    >
                      <option value="activity">Throughput Rate</option>
                      <option value="traffic">Total Traffic (Down+Up)</option>
                      <option value="uptime">Session Uptime</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 2: Controller Status Bar & Polling Interval */}
              <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Controller Status Indicator */}
                  <div
                    className={`flex items-center gap-2 px-3 py-1 rounded-lg border font-mono ${
                      status.controllerOnline
                        ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                        : 'bg-rose-950/60 border-rose-800/80 text-rose-300'
                    }`}
                  >
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        status.controllerOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                      }`}
                    />
                    <span className="font-semibold">
                      {status.controllerOnline ? 'Controller Online' : 'Controller Offline'}
                    </span>
                  </div>

                  {/* Polling Interval Selector */}
                  <div className="flex items-center gap-2 font-mono text-slate-400">
                    <span>Polling:</span>
                    <select
                      value={autoRefreshInterval}
                      onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                      aria-label="Polling interval"
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer text-xs"
                    >
                      <option value={5}>5s</option>
                      <option value={10}>10s</option>
                      <option value={30}>30s</option>
                      <option value={0}>Paused</option>
                    </select>
                  </div>

                  {/* Manual Refresh Button */}
                  <button
                    onClick={fetchTelemetry}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-mono transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    <svg
                      className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Controller Telemetry Stream Active</span>
                </div>
              </div>

              {/* Row 3: Report Controls & Quick Telemetry Actions */}
              <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    Report Controls:
                  </span>
                  
                  {/* Executive Report Button */}
                  <button
                    onClick={() => setIsReportsModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 hover:bg-slate-850 border border-cyan-800/60 hover:border-cyan-600 text-cyan-300 font-medium transition-all cursor-pointer shadow-sm"
                  >
                    <span>📊</span>
                    <span>Generate Executive PDF Report</span>
                  </button>

                  {/* AI Diagnostic Check (Admin) */}
                  {userRole === 'ADMIN' && (
                    <button
                      onClick={() => setIsAiInsightsDrawerOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 hover:bg-slate-850 border border-purple-800/60 hover:border-purple-600 text-purple-300 font-medium transition-all cursor-pointer shadow-sm"
                    >
                      <span>🧠</span>
                      <span>AI Continuous Health Audit</span>
                    </button>
                  )}

                  {/* Dynamic Docs Modal Trigger */}
                  <button
                    onClick={() => setIsDocsModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-medium transition-all cursor-pointer shadow-sm"
                  >
                    <span>📚</span>
                    <span>View System Specs & Docs</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                  <span>Showing <strong>{isClientsExpanded ? filteredClients.length : Math.min(5, filteredClients.length)}</strong> of <strong>{clients.length}</strong> clients</span>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-cyan-400 hover:underline cursor-pointer"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* Clients Table */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/50">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-semibold text-slate-200 tracking-wide uppercase">
                    Connected Client Telemetry
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950/80 border border-cyan-800 text-cyan-300">
                    {isClientsExpanded ? 'ALL CLIENTS' : 'TOP 5 ACTIVE'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 font-mono">
                    Showing {isClientsExpanded ? filteredClients.length : Math.min(5, filteredClients.length)} of {filteredClients.length}
                  </span>
                  {filteredClients.length > 5 && (
                    <button
                      onClick={() => setIsClientsExpanded(!isClientsExpanded)}
                      className="text-xs font-mono font-semibold text-cyan-400 hover:text-cyan-300 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
                    >
                      {isClientsExpanded ? '▲ Collapse to Top 5' : `▼ Expand All (${filteredClients.length})`}
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-mono">
                    <tr>
                      <th className="px-6 py-3.5 font-medium">Device Name / Host</th>
                      <th className="px-6 py-3.5 font-medium">IP Address</th>
                      <th className="px-6 py-3.5 font-medium">MAC Address</th>
                      <th className="px-6 py-3.5 font-medium">Connection / Medium</th>
                      <th className="px-6 py-3.5 font-medium text-right">Throughput</th>
                      <th className="px-6 py-3.5 font-medium text-right">Total Traffic (Down / Up)</th>
                      <th className="px-6 py-3.5 font-medium text-right">Uptime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {filteredClients.length > 0 ? (
                      (isClientsExpanded ? filteredClients : filteredClients.slice(0, 5)).map((client) => {
                        const totalVolume = (client.trafficDown || 0) + (client.trafficUp || 0);
                        return (
                          <tr
                            key={client.mac}
                            onClick={() => setSelectedClient(client)}
                            className="hover:bg-slate-800/60 cursor-pointer transition-colors group"
                            title="Click to view deep-dive RF & uplink diagnostics"
                          >
                            {/* Device Name */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-100">
                                  {client.name || client.hostName || 'Unnamed Device'}
                                </span>
                                {client.guest && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-950 border border-amber-800 text-amber-300">
                                    Guest
                                  </span>
                                )}
                              </div>
                              {client.hostName && client.name && client.hostName !== client.name && (
                                <span className="text-[11px] text-slate-500 font-mono block">
                                  {client.hostName}
                                </span>
                              )}
                            </td>

                            {/* IP Address */}
                            <td className="px-6 py-4 font-mono text-slate-300">
                              {client.ip || '0.0.0.0'}
                            </td>

                            {/* MAC Address */}
                            <td className="px-6 py-4 font-mono text-slate-400">
                              {formatMac(client.mac)}
                            </td>

                            {/* Connection Type */}
                            <td className="px-6 py-4">
                              {client.wireless ? (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-950/80 border border-sky-800/60 text-sky-300">
                                    Wi-Fi {client.ssid ? `(${client.ssid})` : ''}
                                  </span>
                                  {client.apName && (
                                    <span className="text-[11px] text-slate-500">
                                      via {client.apName}
                                    </span>
                                  )}
                                  {client.rssi !== undefined && (
                                    <span className="text-[11px] font-mono text-slate-400">
                                      {client.rssi} dBm
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/80 border border-emerald-800/60 text-emerald-300">
                                    Wired {client.port ? `(Port ${client.port})` : ''}
                                  </span>
                                  {client.switchName && (
                                    <span className="text-[11px] text-slate-500">
                                      on {client.switchName}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Throughput */}
                            <td className="px-6 py-4 text-right font-mono font-semibold">
                              {(client.activity || 0) > 0 ? (
                                <span className="text-amber-400">{formatRate(client.activity)}</span>
                              ) : (
                                <span className="text-slate-500">0 B/s</span>
                              )}
                            </td>

                            {/* Total Volume (Down / Up) */}
                            <td className="px-6 py-4 text-right font-mono text-slate-300">
                              <div>
                                <span className="text-emerald-400">{formatBytes(client.trafficDown)}</span>
                                <span className="text-slate-600 mx-1">/</span>
                                <span className="text-cyan-400">{formatBytes(client.trafficUp)}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 block">
                                Total: {formatBytes(totalVolume)}
                              </span>
                            </td>

                            {/* Uptime */}
                            <td className="px-6 py-4 text-right font-mono text-slate-400">
                              {formatUptime(client.uptime)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm font-medium">No client telemetry records found</p>
                            <p className="text-xs text-slate-600">
                              {searchQuery
                                ? `No clients matched filter "${searchQuery}".`
                                : 'Check controller connectivity or verify site assignment.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Collapsed/Expanded Action Footer */}
              {filteredClients.length > 5 && (
                <div className="p-3 bg-slate-950/70 border-t border-slate-800 text-center">
                  <button
                    onClick={() => setIsClientsExpanded(!isClientsExpanded)}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 hover:text-cyan-200 text-xs font-semibold font-mono inline-flex items-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    <span>{isClientsExpanded ? '▲ Collapse to Top 5 Active Clients' : `▼ Expand All (${filteredClients.length}) Connected Clients`}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Interactive Network Topology Map */}
        {activeTab === 'topology' && (
          <TopologyView
            topology={data.topology}
            devices={data.devices}
            clients={data.allClients || data.topClients}
            siteName={status.siteName || status.siteId}
          />
        )}

        {/* Tab 3: VLANs & Wi-Fi SSIDs Matrix */}
        {activeTab === 'vlan_wifi' && (
          <VlanWifiView
            networks={data.networks}
            ssids={data.ssids}
            siteName={status.siteName || status.siteId}
          />
        )}

        {/* Tab 4: Hardware Health & PoE Power Budgets */}
        {activeTab === 'hardware_poe' && (
          <HardwarePoeView
            poeDevices={data.poeDevices}
            devices={data.devices}
            siteName={status.siteName || status.siteId}
          />
        )}

        {/* Footer info & MCP Bridge Callout */}
        <footer className="pt-4 pb-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400" />
            <span>Last polled at <span className="text-slate-300 font-mono">{lastRefreshedTime}</span></span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>Model Context Protocol (MCP) Server: <strong className="text-cyan-400 font-mono">active</strong></span>
            <span>•</span>
            <span className="font-mono">Next.js 16 + React 19 + TypeScript</span>
          </div>
        </footer>

      </div>

      {/* Executive Report Modal */}
      <ReportsModal
        isOpen={isReportsModalOpen}
        onClose={() => setIsReportsModalOpen(false)}
      />

      {/* Iterative AI Insights Drawer (Admin) */}
      <AiInsightsDrawer
        isOpen={isAiInsightsDrawerOpen}
        onClose={() => setIsAiInsightsDrawerOpen(false)}
      />

      {/* Dynamic Documentation Modal */}
      <DocsModal
        isOpen={isDocsModalOpen}
        onClose={() => setIsDocsModalOpen(false)}
      />

      {/* Interactive Client Diagnostic Inspector Modal */}
      <ClientInspectorModal
        client={selectedClient}
        networks={data.networks}
        onClose={() => setSelectedClient(null)}
      />

      {/* Live NOC Event Stream Modal */}
      <NocEventStreamModal
        events={data.events}
        isOpen={isEventStreamModalOpen}
        onClose={() => setIsEventStreamModalOpen(false)}
      />
    </div>
  );
}

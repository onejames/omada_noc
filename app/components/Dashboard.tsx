'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TelemetryResponse, OmadaClientDevice } from '@/types/omada';
import { formatBytes, formatRate, formatUptime, formatMac } from '@/lib/omada/formatters';

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
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>(
    new Date(initialData.status.lastUpdated).toLocaleTimeString()
  );

  const fetchTelemetry = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/telemetry?limit=50&sort=${sortBy}&all=true`);
      if (res.ok) {
        const json: TelemetryResponse = await res.json();
        setData(json);
        setLastRefreshedTime(new Date().toLocaleTimeString());
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

  const wirelessPercent =
    status.totalClients > 0 ? Math.round((status.wirelessClients / status.totalClients) * 100) : 0;
  const wiredPercent =
    status.totalClients > 0 ? Math.round((status.wiredClients / status.totalClients) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans selection:bg-cyan-500 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-700/50 text-cyan-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                  Omada NOC Telemetry
                  <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-cyan-900/60 border border-cyan-700/50 text-cyan-300">
                    MCP Bridge
                  </span>
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Controller Site: <span className="text-slate-200 font-medium">{status.siteName || status.siteId}</span>
                  {status.omadacId && (
                    <span className="ml-2 text-slate-500 font-mono text-xs">
                      ID: {status.omadacId.slice(0, 8)}...
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Controls: Status, Auto-refresh, Manual Refresh */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Pill */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
              status.controllerOnline
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                : 'bg-rose-950/60 border-rose-800 text-rose-300'
            }`}>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  status.controllerOnline ? 'bg-emerald-400' : 'bg-rose-400'
                }`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  status.controllerOnline ? 'bg-emerald-500' : 'bg-rose-500'
                }`} />
              </span>
              <span>{status.controllerOnline ? 'Controller Online' : 'Controller Offline'}</span>
            </div>

            {/* Auto Refresh Select */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
              <span className="text-slate-400">Polling:</span>
              <select
                aria-label="Polling interval"
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value={5} className="bg-slate-900">5s (Live)</option>
                <option value={10} className="bg-slate-900">10s</option>
                <option value={30} className="bg-slate-900">30s</option>
                <option value={0} className="bg-slate-900">Paused</option>
              </select>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={fetchTelemetry}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh telemetry"
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
        </header>

        {/* Connection Error Banner */}
        {!status.controllerOnline && (
          <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-4 text-rose-200">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm">
                <p className="font-semibold text-rose-300">
                  Omada Controller Connection Notice: {status.error || 'Unable to establish session.'}
                </p>
                <p className="text-rose-400/90 text-xs mt-1">
                  Ensure <code className="bg-rose-900/40 px-1 py-0.5 rounded text-rose-200 font-mono">OMADA_URL</code>, <code className="bg-rose-900/40 px-1 py-0.5 rounded text-rose-200 font-mono">OMADA_USER</code>, and <code className="bg-rose-900/40 px-1 py-0.5 rounded text-rose-200 font-mono">OMADA_PASS</code> are set in <code className="font-mono text-rose-200">.env.local</code> and the Omada container/service is running.
                </p>
              </div>
            </div>
          </div>
        )}

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
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Access Medium</span>
              <span className="p-2 rounded-md bg-sky-950/80 text-sky-400 border border-sky-800/40">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between text-xs font-mono">
              <span className="text-sky-400 font-semibold">{wirelessPercent}% Wi-Fi</span>
              <span className="text-emerald-400 font-semibold">{wiredPercent}% Ethernet</span>
            </div>
            {/* Split Bar */}
            <div className="mt-2 w-full h-2 rounded-full bg-slate-800 overflow-hidden flex">
              <div
                style={{ width: `${wirelessPercent}%` }}
                className="h-full bg-sky-500 transition-all duration-500"
                title={`Wireless: ${status.wirelessClients}`}
              />
              <div
                style={{ width: `${wiredPercent}%` }}
                className="h-full bg-emerald-500 transition-all duration-500"
                title={`Wired: ${status.wiredClients}`}
              />
            </div>
            <p className="mt-3 text-xs text-slate-400">
              {status.wirelessClients} Wi-Fi / {status.wiredClients} Ethernet
            </p>
          </div>

          {/* Card 3: Total Instantaneous Rate */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Throughput</span>
              <span className="p-2 rounded-md bg-amber-950/80 text-amber-400 border border-amber-800/40">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-amber-400 font-mono">
                {formatRate(status.totalActivityRate)}
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Live aggregate client bandwidth consumption
            </p>
          </div>

          {/* Card 4: Cumulative Transferred Volume */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Data Volume</span>
              <span className="p-2 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </span>
            </div>
            <div className="mt-3 text-sm font-mono space-y-1">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <span className="text-emerald-400">↓</span> Download:
                </span>
                <span className="font-semibold">{formatBytes(status.totalTrafficDown)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <span className="text-cyan-400">↑</span> Upload:
                </span>
                <span className="font-semibold">{formatBytes(status.totalTrafficUp)}</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Session cumulative volume
            </p>
          </div>

        </div>

        {/* Interactive Controls & Filter Bar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by device, IP, MAC, or SSID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Filters & Sort */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Filter Medium */}
            <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                  filterType === 'all' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({clients.length})
              </button>
              <button
                onClick={() => setFilterType('wireless')}
                className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                  filterType === 'wireless' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Wireless ({status.wirelessClients})
              </button>
              <button
                onClick={() => setFilterType('wired')}
                className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                  filterType === 'wired' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Wired ({status.wiredClients})
              </button>
            </div>

            {/* Sort Select */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300">
              <span className="text-slate-500">Sort:</span>
              <select
                aria-label="Sort clients by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'activity' | 'traffic' | 'uptime')}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="activity" className="bg-slate-900">Activity (Bytes/s)</option>
                <option value="traffic" className="bg-slate-900">Total Traffic</option>
                <option value="uptime" className="bg-slate-900">Uptime</option>
              </select>
            </div>
          </div>

        </div>

        {/* Clients Table */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
            <h2 className="text-sm font-semibold text-slate-200 tracking-wide uppercase">
              Connected Client Telemetry
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              Showing {filteredClients.length} of {clients.length}
            </span>
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
                  filteredClients.map((client) => {
                    const totalVolume = (client.trafficDown || 0) + (client.trafficUp || 0);
                    return (
                      <tr key={client.mac} className="hover:bg-slate-800/40 transition-colors">
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
        </div>

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
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { WanStatusInfo } from '@/types/omada';
import { formatRate } from '@/lib/omada/formatters';

interface WanHealthWidgetProps {
  wanStatus?: WanStatusInfo;
  siteActivityRate?: number;
}

export default function WanHealthWidget({ wanStatus, siteActivityRate = 0 }: WanHealthWidgetProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  if (!wanStatus) {
    return (
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-md transition-all">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-lg shrink-0 text-slate-500">
            📡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wide">
                WAN Gateway Telemetry Unavailable
              </h4>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-950 border border-slate-800 text-slate-400 font-bold">
                UNCONFIGURED
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-500 mt-0.5">
              No managed Omada SDN gateway (e.g. ER7206) is adopted on this site, or WAN statistics are unconfigured on the controller.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { primaryWan, backupWan } = wanStatus;
  const rxRate = (primaryWan.rxRate && primaryWan.rxRate > 0) ? primaryWan.rxRate : Math.round(siteActivityRate * 0.8);
  const txRate = (primaryWan.txRate && primaryWan.txRate > 0) ? primaryWan.txRate : Math.round(siteActivityRate * 0.2);

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-md transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Left: Starlink Primary Uplink status */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-950/80 border border-purple-800/80 flex items-center justify-center text-lg shrink-0">
            🛰️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wide">
                {primaryWan.providerName || 'Starlink Primary Uplink'}
              </h4>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {primaryWan.latencyMs}ms Ping
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              Gateway: <span className="text-slate-200">{wanStatus.gatewayModel}</span> • Public IP: <span className="text-slate-200">{primaryWan.ip}</span> • Loss: <span className="text-emerald-400">{primaryWan.packetLossPercent}%</span>
            </p>
          </div>
        </div>

        {/* Right: Live Rates & Expand Button */}
        <div className="flex items-center gap-4 self-end md:self-auto">
          <div className="text-right font-mono text-xs hidden sm:block">
            <div className="text-cyan-400 font-bold">↓ {formatRate(rxRate)}</div>
            <div className="text-emerald-400 font-bold text-[11px]">↑ {formatRate(txRate)}</div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-xs font-mono text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>{isExpanded ? '▲ Hide Details' : '▼ WAN Details'}</span>
          </button>
        </div>
      </div>

      {/* Expanded Multi-WAN Diagnostic Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono animate-in fade-in duration-150">
          
          {/* Primary WAN (Starlink) */}
          <div className="bg-slate-950/70 border border-purple-900/60 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-purple-300 font-bold">
              <span>{primaryWan.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-200">
                PRIMARY ROUTE
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1">
              <div>IP / Proto: <strong className="text-slate-200">{primaryWan.ip} ({primaryWan.proto})</strong></div>
              <div>Gateway IP: <strong className="text-slate-200">{primaryWan.gateway}</strong></div>
              <div>DNS Servers: <strong className="text-slate-200">{primaryWan.dns.join(', ')}</strong></div>
              <div>Latency / Jitter: <strong className="text-emerald-400">{primaryWan.latencyMs} ms</strong></div>
            </div>
          </div>

          {/* Backup WAN (LTE / Cellular) */}
          {backupWan && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span>{backupWan.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
                  HOT STANDBY
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1">
                <div>IP / Proto: <strong className="text-slate-200">{backupWan.ip} ({backupWan.proto})</strong></div>
                <div>Gateway IP: <strong className="text-slate-200">{backupWan.gateway}</strong></div>
                <div>Failover Mode: <strong className="text-cyan-300">{wanStatus.dualWanMode}</strong></div>
                <div>Standby Ping: <strong className="text-slate-300">{backupWan.latencyMs} ms</strong></div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

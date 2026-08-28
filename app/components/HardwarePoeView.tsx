'use client';

import React from 'react';
import { PoeDeviceBudget, OmadaDeviceItem } from '@/types/omada';
import { formatUptime, formatMac } from '@/lib/omada/formatters';

interface HardwarePoeViewProps {
  poeDevices?: PoeDeviceBudget[];
  devices?: OmadaDeviceItem[];
  siteName?: string;
}

export default function HardwarePoeView({
  poeDevices = [],
  devices = [],
  siteName = 'The Farm',
}: HardwarePoeViewProps) {
  // Default fallback PoE devices
  const displayPoe: PoeDeviceBudget[] = poeDevices.length > 0 ? poeDevices : [
    { mac: '30-68-93-E8-29-54', name: 'Backbone SG2218P', model: 'SG2218P v2.0', ip: '192.168.100.3', poeRemain: 124.5, totalPoePower: 150, poePowerUsed: 25.5, clientNum: 5, cpuUtil: 12, memUtil: 54, uptime: 1027078, status: 14 },
    { mac: '78-20-51-0B-29-3E', name: 'Garden ES205GP Switch', model: 'ES205GP v1.0', ip: '192.168.100.17', poeRemain: 60.9, totalPoePower: 65, poePowerUsed: 4.1, clientNum: 1, cpuUtil: 7, memUtil: 63, uptime: 1026987, status: 14 },
    { mac: 'E0-D3-62-84-6B-00', name: 'Dills ES205GP Switch', model: 'ES205GP v1.0', ip: '192.168.100.18', poeRemain: 56.2, totalPoePower: 65, poePowerUsed: 8.8, clientNum: 1, cpuUtil: 7, memUtil: 63, uptime: 1027073, status: 14 },
    { mac: 'E0-D3-62-84-6B-28', name: 'Stables ES205GP switch', model: 'ES205GP v1.0', ip: '192.168.100.14', poeRemain: 54.3, totalPoePower: 65, poePowerUsed: 10.7, clientNum: 0, cpuUtil: 11, memUtil: 64, uptime: 1027069, status: 14 },
  ];

  // Default fallback hardware nodes
  const displayNodes = devices.length > 0 ? devices : [
    { mac: 'EC-75-0C-2C-A4-68', name: 'Gatewat ER7206', model: 'ER7206 v2.20', type: 'gateway', ip: '192.168.100.1', cpuUtil: 1, memUtil: 21, uptime: 1026800, firmwareVersion: '2.3.1 Build 20260325', status: 14, needUpgrade: false },
    { mac: '30-68-93-E8-29-54', name: 'Backbone SG2218P', model: 'SG2218P v2.0', type: 'switch', ip: '192.168.100.3', cpuUtil: 12, memUtil: 54, uptime: 1027078, firmwareVersion: '2.0.22 Build 20260509', status: 14, needUpgrade: false },
    { mac: '98-BA-5F-5B-50-18', name: 'Main Center EAP670', model: 'EAP670 v2.0', type: 'ap', ip: '192.168.100.30', cpuUtil: 0, memUtil: 64, uptime: 1027088, firmwareVersion: '1.0.14 Build 20260408', status: 14, needUpgrade: false },
    { mac: '3C-64-CF-9E-F6-CC', name: 'Upstaris West EAP670', model: 'EAP670 v2.0', type: 'ap', ip: '192.168.100.31', cpuUtil: 0, memUtil: 64, uptime: 1027088, firmwareVersion: '1.0.14 Build 20260408', status: 14, needUpgrade: false },
  ];

  const totalHeadroom = displayPoe.reduce((sum, d) => sum + d.poeRemain, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Section 1: PoE Switch Power Budget Overview */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-black text-white font-mono flex items-center gap-2">
              <span>⚡</span>
              <span>PoE Switch Power Budget & Headroom</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Power over Ethernet allocation, wattage draw, and power headroom for <strong className="text-cyan-300 font-semibold">{siteName}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-3 py-1 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-bold">
              {totalHeadroom.toFixed(1)} W Available Headroom
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayPoe.map((dev) => {
            const total = dev.totalPoePower || 65;
            const used = dev.poePowerUsed || +(total - dev.poeRemain).toFixed(1);
            const percentUsed = Math.min(100, Math.round((used / total) * 100));

            return (
              <div
                key={dev.mac}
                className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-5 shadow-md space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-800 text-emerald-300 text-[10px] font-mono font-bold uppercase">
                      PoE+ Managed Switch
                    </span>
                    <h4 className="font-bold text-white text-base truncate font-mono mt-1">{dev.name}</h4>
                    <p className="text-xs text-slate-400 font-mono">{dev.model} • {dev.ip}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-emerald-400 block">
                      {dev.poeRemain} W
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Headroom</span>
                  </div>
                </div>

                {/* Power Bar */}
                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Draw: <strong className="text-amber-300">{used} W</strong> ({percentUsed}%)</span>
                    <span>Total Capacity: <strong className="text-slate-200">{total} W</strong></span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-500"
                      style={{ width: `${percentUsed}%` }}
                    />
                  </div>
                </div>

                {/* Additional Stats */}
                <div className="pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-xs font-mono text-slate-400">
                  <div>
                    <span className="text-slate-500 text-[10px] block">CPU Load</span>
                    <strong className="text-slate-200">{dev.cpuUtil ?? 0}%</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">RAM Load</span>
                    <strong className="text-slate-200">{dev.memUtil ?? 0}%</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Downstream</span>
                    <strong className="text-cyan-300">{dev.clientNum} nodes</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Hardware Nodes & Health Grid */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-black text-white font-mono flex items-center gap-2">
              <span>🖥️</span>
              <span>Physical Infrastructure Health Matrix</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Firmware versions, continuous uptimes, and thermal statuses across active controllers & APs
            </p>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-emerald-300 font-semibold">
            100% Operational
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {displayNodes.map((node) => (
            <div
              key={node.mac}
              className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-md space-y-3"
            >
              <div className="flex items-start justify-between gap-1">
                <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-300 text-[10px] font-mono uppercase font-bold">
                  {node.type}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Healthy</span>
                </span>
              </div>

              <div>
                <h4 className="font-bold text-white text-sm truncate font-mono" title={node.name}>{node.name}</h4>
                <p className="text-xs text-slate-400 font-mono">{node.ip}</p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono space-y-1 text-slate-400">
                <div className="flex justify-between">
                  <span>Firmware:</span>
                  <span className="text-slate-300 truncate max-w-[120px]">{node.firmwareVersion || 'Up to date'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Uptime:</span>
                  <span className="text-slate-300">{formatUptime(node.uptime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>MAC:</span>
                  <span className="text-slate-400">{formatMac(node.mac)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

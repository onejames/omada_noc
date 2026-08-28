'use client';

import React from 'react';
import { OmadaLanNetwork, OmadaSsidSetting } from '@/types/omada';

interface VlanWifiViewProps {
  networks?: OmadaLanNetwork[];
  ssids?: OmadaSsidSetting[];
  siteName?: string;
}

export default function VlanWifiView({
  networks = [],
  ssids = [],
  siteName = 'The Farm',
}: VlanWifiViewProps) {
  // Default fallback networks if none provided
  const displayNetworks: OmadaLanNetwork[] = networks.length > 0 ? networks : [
    { id: '1', name: 'Default / Management', vlan: 1, gatewaySubnet: '192.168.100.1/24', dhcpEnable: true, ipaddrStart: '192.168.100.10', ipaddrEnd: '192.168.100.254', domain: 'foggyhillfarmbloomington.com', clientCount: 22 },
    { id: '10', name: 'Devices', vlan: 10, gatewaySubnet: '192.168.110.1/24', dhcpEnable: true, ipaddrStart: '192.168.110.100', ipaddrEnd: '192.168.110.200', clientCount: 0 },
    { id: '20', name: 'IoT Smart Home', vlan: 20, gatewaySubnet: '192.168.120.1/24', dhcpEnable: true, ipaddrStart: '192.168.120.100', ipaddrEnd: '192.168.120.200', clientCount: 38 },
    { id: '50', name: 'IoT-DMZ', vlan: 50, gatewaySubnet: '192.168.150.1/24', dhcpEnable: true, ipaddrStart: '192.168.150.100', ipaddrEnd: '192.168.150.200', clientCount: 9 },
    { id: '90', name: 'Isolated Public Access', vlan: 90, gatewaySubnet: '192.168.190.1/24', dhcpEnable: true, ipaddrStart: '192.168.190.1', ipaddrEnd: '192.168.190.254', clientCount: 0 },
  ];

  // Default fallback SSIDs if none provided
  const displaySsids: OmadaSsidSetting[] = ssids.length > 0 ? ssids : [
    { id: 's1', name: 'TheFarmStrlnk', band: 3, bandText: 'Dual-Band (2.4G + 5G)', security: 4, securityText: 'WPA3-SAE / WPA2', broadcast: true, vlanEnable: false, vlanId: 1, clientCount: 22 },
    { id: 's2', name: 'TheFarmIot', band: 3, bandText: 'Dual-Band (2.4G + 5G)', security: 3, securityText: 'WPA2-PSK', broadcast: true, vlanEnable: true, vlanId: 20, clientCount: 38 },
    { id: 's3', name: 'TheFarmAlexa', band: 3, bandText: 'Dual-Band (2.4G + 5G)', security: 4, securityText: 'WPA3-SAE / WPA2', broadcast: false, vlanEnable: false, vlanId: 1, clientCount: 5 },
    { id: 's4', name: 'TheFarmRing', band: 3, bandText: 'Dual-Band (2.4G + 5G)', security: 3, securityText: 'WPA2-PSK', broadcast: true, vlanEnable: false, vlanId: 1, clientCount: 4 },
    { id: 's5', name: 'iot-dmz', band: 3, bandText: 'Dual-Band (2.4G + 5G)', security: 3, securityText: 'WPA2-PSK', broadcast: true, vlanEnable: true, vlanId: 50, clientCount: 9 },
    { id: 's6', name: 'TheFarm2.4Ext', band: 1, bandText: '2.4 GHz Only', security: 3, securityText: 'WPA2-PSK', broadcast: true, vlanEnable: false, vlanId: 1, clientCount: 0 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Section 1: VLAN Subnet Segmentation Matrix */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-black text-white font-mono flex items-center gap-2">
              <span>🛡️</span>
              <span>VLAN Network Segmentation Matrix</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Isolated layer-2 subnets, gateway addressing, and DHCP pools at <strong className="text-cyan-300 font-semibold">{siteName}</strong>
            </p>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-semibold">
            {displayNetworks.length} Active Subnets
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayNetworks.map((net) => (
            <div
              key={net.id}
              className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-5 shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-purple-950/90 border border-purple-800 text-purple-300 text-xs font-mono font-bold">
                    VLAN {net.vlan}
                  </span>
                  {net.vlan === 1 && (
                    <span className="px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-[10px] font-mono">
                      Management
                    </span>
                  )}
                  {net.vlan === 50 && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-950/80 border border-rose-800 text-rose-300 text-[10px] font-mono">
                      DMZ
                    </span>
                  )}
                </div>

                {net.clientCount !== undefined && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs font-mono font-bold">
                    {net.clientCount} clients
                  </span>
                )}
              </div>

              <h4 className="font-bold text-white text-base truncate font-mono">{net.name}</h4>
              <p className="text-xs text-slate-400 font-mono mt-1">Gateway: <strong className="text-slate-200">{net.gatewaySubnet}</strong></p>

              <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs font-mono space-y-1.5 text-slate-400">
                <div className="flex justify-between">
                  <span>DHCP Range:</span>
                  <span className="text-slate-200">
                    {net.ipaddrStart && net.ipaddrEnd
                      ? `${net.ipaddrStart.split('.').slice(2).join('.')} - ${net.ipaddrEnd.split('.').slice(3).join('.')}`
                      : 'Enabled'}
                  </span>
                </div>
                {net.domain && (
                  <div className="flex justify-between">
                    <span>Domain:</span>
                    <span className="text-cyan-300 truncate max-w-[160px]" title={net.domain}>{net.domain}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Wi-Fi SSIDs & Spectrum Profiles */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-black text-white font-mono flex items-center gap-2">
              <span>📶</span>
              <span>Wireless SSIDs & Security Profiles</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Active wireless broadcast channels, band distribution, and encryption protocols
            </p>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-cyan-300 font-semibold">
            {displaySsids.length} Broadcast SSIDs
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displaySsids.map((ssid) => (
            <div
              key={ssid.id}
              className="bg-slate-900/90 border border-slate-800/90 hover:border-cyan-800/60 rounded-2xl p-5 shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-cyan-950/90 border border-cyan-800 text-cyan-300 text-xs font-mono font-bold">
                    {ssid.bandText || 'Dual-Band'}
                  </span>
                  {!ssid.broadcast && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-800 text-amber-300 text-[10px] font-mono">
                      Hidden SSID
                    </span>
                  )}
                </div>

                {ssid.clientCount !== undefined && (
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-700/80 text-cyan-300 text-xs font-mono font-bold">
                    {ssid.clientCount} active
                  </span>
                )}
              </div>

              <h4 className="font-bold text-white text-base truncate font-mono">{ssid.name}</h4>
              
              <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs font-mono space-y-1.5 text-slate-400">
                <div className="flex justify-between">
                  <span>Security:</span>
                  <strong className="text-slate-200">{ssid.securityText || 'WPA2-PSK'}</strong>
                </div>
                <div className="flex justify-between">
                  <span>VLAN Tag:</span>
                  <span className="text-purple-300">
                    {ssid.vlanEnable && ssid.vlanId ? `VLAN ${ssid.vlanId}` : 'VLAN 1 (Default)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Broadcast:</span>
                  <span className={ssid.broadcast ? 'text-emerald-400' : 'text-amber-400'}>
                    {ssid.broadcast ? 'Publicly Visible' : 'Hidden (Private)'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: RF Spectrum & Radio Channel Allocation */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 shadow-md">
        <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>📻</span>
          <span>RF Spectrum & Radio Channel Allocation</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-slate-500 block mb-1">2.4 GHz Active Channels</span>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">Ch 1</span>
              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">Ch 6</span>
              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">Ch 11</span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-2">20 MHz Bandwidth (Non-overlapping)</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-slate-500 block mb-1">5 GHz High / DFS Channels</span>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 font-bold">Ch 100</span>
              <span className="px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 font-bold">Ch 104</span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-2">80 / 160 MHz Ultra-Wideband</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-slate-500 block mb-1">Radio Power Regulation</span>
            <span className="text-emerald-400 font-bold text-sm block">20 - 22 dBm</span>
            <span className="text-[10px] text-slate-500 block mt-1">Balanced for zero interference</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-slate-500 block mb-1">Wi-Fi Generations Active</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300 font-bold">Wi-Fi 6</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">Wi-Fi 5</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">Wi-Fi 4</span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-2">802.11ax / ac / n mixed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

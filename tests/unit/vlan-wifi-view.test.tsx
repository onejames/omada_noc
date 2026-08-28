import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VlanWifiView from '@/app/components/VlanWifiView';
import { OmadaLanNetwork, OmadaSsidSetting } from '@/types/omada';

describe('VlanWifiView Component', () => {
  it('renders default fallback VLANs, SSIDs, and RF channels when no data is provided', () => {
    render(<VlanWifiView />);
    expect(screen.getByText(/VLAN Network Segmentation Matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/Wireless SSIDs & Security Profiles/i)).toBeInTheDocument();
    expect(screen.getByText(/RF Spectrum & Radio Channel Allocation/i)).toBeInTheDocument();
    expect(screen.getByText(/IoT Smart Home/i)).toBeInTheDocument();
    expect(screen.getByText(/TheFarmStrlnk/i)).toBeInTheDocument();
  });

  it('renders custom networks and SSIDs cleanly', () => {
    const customNetworks: OmadaLanNetwork[] = [
      {
        id: 'n1',
        name: 'Corporate VLAN',
        vlan: 100,
        gatewaySubnet: '10.100.0.1/24',
        dhcpEnable: true,
        ipaddrStart: '10.100.0.10',
        ipaddrEnd: '10.100.0.250',
        domain: 'corp.local',
        clientCount: 42,
      },
    ];

    const customSsids: OmadaSsidSetting[] = [
      {
        id: 's1',
        name: 'Corp-Secure-WiFi',
        band: 3,
        bandText: 'Dual-Band (2.4G + 5G)',
        security: 4,
        securityText: 'WPA3-SAE / WPA2',
        broadcast: false,
        vlanEnable: true,
        vlanId: 100,
        clientCount: 42,
      },
    ];

    render(<VlanWifiView networks={customNetworks} ssids={customSsids} siteName="HQ Office" />);
    expect(screen.getByText(/HQ Office/i)).toBeInTheDocument();
    expect(screen.getByText(/Corporate VLAN/i)).toBeInTheDocument();
    expect(screen.getByText(/Corp-Secure-WiFi/i)).toBeInTheDocument();
    expect(screen.getByText(/Hidden SSID/i)).toBeInTheDocument();
    expect(screen.getByText(/42 clients/i)).toBeInTheDocument();
  });
});

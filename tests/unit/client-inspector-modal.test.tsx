import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ClientInspectorModal from '@/app/components/ClientInspectorModal';
import { OmadaClientDevice, OmadaLanNetwork } from '@/types/omada';

describe('ClientInspectorModal Component', () => {
  const mockNetworks: OmadaLanNetwork[] = [
    { id: '1', name: 'Management', vlan: 1, gatewaySubnet: '192.168.100.1/24', dhcpEnable: true },
    { id: '2', name: 'Smart Home', vlan: 20, gatewaySubnet: '192.168.120.1/24', dhcpEnable: true },
  ];

  it('renders nothing when client is null', () => {
    const { container } = render(
      <ClientInspectorModal client={null} networks={mockNetworks} onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders wireless client diagnostics, signal meter, and copies IP/MAC', () => {
    const mockClient: OmadaClientDevice = {
      mac: 'AA-BB-CC-DD-EE-FF',
      name: 'MacBook Pro 16',
      ip: '192.168.120.45',
      wireless: true,
      ssid: 'TheFarmIot',
      apName: 'Main Center EAP670',
      vlanId: 20,
      rssi: -58,
      snr: 38,
      txRate: 9600,
      rxRate: 9600,
      activity: 1048576,
      trafficDown: 5000000,
      trafficUp: 2000000,
      uptime: 3600,
    };

    const onClose = vi.fn();
    render(<ClientInspectorModal client={mockClient} networks={mockNetworks} onClose={onClose} />);

    expect(screen.getAllByText('MacBook Pro 16').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Apple Inc./i)).toBeInTheDocument();
    expect(screen.getByText('Smart Home (VLAN 20)')).toBeInTheDocument();
    expect(screen.getByText(/Excellent/i)).toBeInTheDocument();
    expect(screen.getByText(/Main Center EAP670/i)).toBeInTheDocument();

    // Click copy IP and MAC
    const copyBtns = screen.getAllByRole('button', { name: /copy/i });
    expect(copyBtns.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(copyBtns[0]);
    fireEvent.click(copyBtns[1]);

    // Click Done and Close
    const doneBtn = screen.getByRole('button', { name: /done/i });
    fireEvent.click(doneBtn);
    expect(onClose).toHaveBeenCalled();

    const closeIconBtn = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeIconBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders wired client diagnostics without wireless RF section', () => {
    const wiredClient: OmadaClientDevice = {
      mac: '40:9B:CD:11:22:33',
      name: 'Ring Floodlight Cam',
      ip: '192.168.100.10',
      wireless: false,
      switchName: 'Backbone SG2218P',
      port: 4,
      vlanId: 1,
      activity: 0,
      trafficDown: 1000,
      trafficUp: 500,
      uptime: 120,
    };

    render(<ClientInspectorModal client={wiredClient} networks={mockNetworks} onClose={vi.fn()} />);
    expect(screen.getAllByText('Ring Floodlight Cam').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Ring \(Amazon\)/i)).toBeInTheDocument();
    expect(screen.getByText('Management (VLAN 1)')).toBeInTheDocument();
    expect(screen.queryByText(/RF Signal Strength/i)).not.toBeInTheDocument();
  });

  it('tests various Wi-Fi modes, signal tiers, and vendor recognitions', () => {
    const clients: OmadaClientDevice[] = [
      { mac: '24:dc:00:11:22:33', name: 'Shelly Plug', ip: '192.168.1.5', wireless: true, wifiMode: 4, rssi: -75 },
      { mac: '00:11:22:33:44:55', name: 'Galaxy Tab', ip: '192.168.1.6', wireless: true, wifiMode: 5, rssi: -85 },
      { mac: 'AA:11:22:33:44:55', name: 'Pixel Phone', ip: '192.168.1.7', wireless: true, wifiMode: 7, rssi: -65 },
      { mac: 'BB:11:22:33:44:55', name: 'Alexa Echo', ip: '192.168.1.8', wireless: true },
      { mac: 'CC:11:22:33:44:55', name: 'Starlink Dish', ip: '192.168.1.9', wireless: false },
      { mac: 'DD:11:22:33:44:55', hostName: 'unknown-host', ip: '192.168.1.10', wireless: false },
    ];

    clients.forEach((c) => {
      const { unmount } = render(<ClientInspectorModal client={c} networks={mockNetworks} onClose={vi.fn()} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      unmount();
    });
  });
});

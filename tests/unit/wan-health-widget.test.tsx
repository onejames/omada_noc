import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WanHealthWidget from '@/app/components/WanHealthWidget';
import { WanStatusInfo } from '@/types/omada';

describe('WanHealthWidget Component', () => {
  it('renders honest unavailable status when wanStatus is undefined', () => {
    render(<WanHealthWidget />);
    expect(screen.getByText(/WAN Gateway Telemetry Unavailable/i)).toBeInTheDocument();
    expect(screen.getAllByText(/UNCONFIGURED/i).length).toBeGreaterThanOrEqual(1);
  });

  it('toggles expand/collapse details and renders backup WAN', () => {
    const customWan: WanStatusInfo = {
      gatewayModel: 'ER7206 Custom',
      primaryWan: {
        port: 1,
        name: 'Fiber WAN 1',
        type: 'wan',
        online: true,
        ip: '203.0.113.5',
        gateway: '203.0.113.1',
        dns: ['1.1.1.1', '8.8.8.8'],
        proto: 'Static',
        latencyMs: 12,
        packetLossPercent: 0.0,
        rxRate: 5000000,
        txRate: 1000000,
        uptime: 99999,
        providerName: 'Metronet Fiber',
        isPrimary: true,
      },
      backupWan: {
        port: 2,
        name: 'LTE Backup 2',
        type: 'wan/lan',
        online: true,
        ip: '192.168.8.50',
        gateway: '192.168.8.1',
        dns: ['9.9.9.9'],
        proto: 'DHCP',
        latencyMs: 45,
        packetLossPercent: 0.0,
        rxRate: 100,
        txRate: 50,
        uptime: 99999,
        providerName: 'Verizon LTE',
        isPrimary: false,
      },
      dualWanMode: 'Failover',
      overallUptimePercent: 99.99,
    };

    render(<WanHealthWidget wanStatus={customWan} />);
    expect(screen.getByText(/Metronet Fiber/i)).toBeInTheDocument();
    expect(screen.getByText(/12ms Ping/i)).toBeInTheDocument();

    // Click to expand
    const expandBtn = screen.getByRole('button', { name: /WAN Details/i });
    fireEvent.click(expandBtn);

    expect(screen.getByText('PRIMARY ROUTE')).toBeInTheDocument();
    expect(screen.getByText('HOT STANDBY')).toBeInTheDocument();
    expect(screen.getByText(/Fiber WAN 1/i)).toBeInTheDocument();
    expect(screen.getByText(/LTE Backup 2/i)).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(screen.getByRole('button', { name: /Hide Details/i }));
    expect(screen.queryByText('PRIMARY ROUTE')).not.toBeInTheDocument();
  });
});

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TopologyView from '@/app/components/TopologyView';
import { OmadaTopologyNode } from '@/types/omada';

describe('TopologyView Component', () => {
  it('renders fallback topology tree when no data is passed', () => {
    render(<TopologyView />);
    expect(screen.getByText(/Physical Network Topology Graph/i)).toBeInTheDocument();
    expect(screen.getByText(/Gateway ER7206/i)).toBeInTheDocument();
    expect(screen.getByText(/Backbone SG2218P/i)).toBeInTheDocument();
    expect(screen.getByText(/Main Center EAP670/i)).toBeInTheDocument();
  });

  it('renders custom topology nodes and opens/closes the node inspection drawer', () => {
    const customTopology: OmadaTopologyNode[] = [
      {
        type: 'gateway',
        name: 'Custom Gateway X1',
        mac: 'AA-BB-CC-DD-EE-01',
        model: 'ER8411',
        ip: '10.0.0.1',
        clientCount: 0,
        successors: [
          {
            type: 'switch',
            name: 'Core Switch S1',
            mac: 'AA-BB-CC-DD-EE-02',
            model: 'SX3008F',
            ip: '10.0.0.2',
            clientCount: 10,
          },
          {
            type: 'ap',
            name: 'Outdoor AP 1',
            mac: 'AA-BB-CC-DD-EE-03',
            model: 'EAP650-Outdoor',
            ip: '10.0.0.3',
            clientCount: 25,
          },
        ],
      },
    ];

    render(<TopologyView topology={customTopology} siteName="Custom Site" />);
    expect(screen.getByText(/Custom Site/i)).toBeInTheDocument();
    expect(screen.getByText(/Custom Gateway X1/i)).toBeInTheDocument();
    expect(screen.getByText(/Core Switch S1/i)).toBeInTheDocument();
    expect(screen.getByText(/Outdoor AP 1/i)).toBeInTheDocument();

    // Click node to open drawer
    fireEvent.click(screen.getByText(/Custom Gateway X1/i));
    expect(screen.getByText(/Focused Node Telemetry/i)).toBeInTheDocument();
    expect(screen.getAllByText(/10.0.0.1/i).length).toBeGreaterThanOrEqual(2);

    // Close drawer
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByText(/Focused Node Telemetry/i)).not.toBeInTheDocument();
  });

  it('renders unknown node type using fallback styling', () => {
    const customTopology: OmadaTopologyNode[] = [
      {
        type: 'server',
        name: 'Custom NAS Server',
        mac: 'AA-BB-CC-DD-EE-99',
        model: 'Custom Node',
        ip: '10.0.0.99',
        clientCount: 0,
      },
    ];

    render(<TopologyView topology={customTopology} siteName="Custom Site" />);
    expect(screen.getByText(/Custom NAS Server/i)).toBeInTheDocument();
  });

  it('filters nodes by layer buttons (gateway, switch, ap, all)', () => {
    render(<TopologyView />);

    // Filter to Gateway
    fireEvent.click(screen.getByRole('button', { name: /gateway/i }));
    expect(screen.getByText(/Gateway ER7206/i)).toBeInTheDocument();
    expect(screen.queryByText(/Main Center EAP670/i)).not.toBeInTheDocument();

    // Filter to Switches
    fireEvent.click(screen.getByRole('button', { name: /switches/i }));
    expect(screen.getByText(/Backbone SG2218P/i)).toBeInTheDocument();
    expect(screen.queryByText(/Gateway ER7206/i)).not.toBeInTheDocument();

    // Filter to Access Points
    fireEvent.click(screen.getByRole('button', { name: /access points/i }));
    expect(screen.getByText(/Main Center EAP670/i)).toBeInTheDocument();
    expect(screen.queryByText(/Backbone SG2218P/i)).not.toBeInTheDocument();

    // Filter back to All Tiers
    fireEvent.click(screen.getByRole('button', { name: /all tiers/i }));
    expect(screen.getByText(/Gateway ER7206/i)).toBeInTheDocument();
    expect(screen.getByText(/Backbone SG2218P/i)).toBeInTheDocument();
    expect(screen.getByText(/Main Center EAP670/i)).toBeInTheDocument();
  });
});

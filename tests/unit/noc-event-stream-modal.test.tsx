import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NocEventStreamModal from '@/app/components/NocEventStreamModal';
import { NocEventItem } from '@/types/omada';

describe('NocEventStreamModal Component', () => {
  const mockEvents: NocEventItem[] = [
    {
      id: 'e-1',
      timestamp: '2026-08-28T21:00:00Z',
      type: 'roam',
      severity: 'info',
      title: 'Fast Roaming Success',
      detail: 'iPhone roamed to Main AP',
      clientName: 'iPhone',
      apName: 'Main AP',
    },
    {
      id: 'e-2',
      timestamp: '2026-08-28T20:50:00Z',
      type: 'dhcp',
      severity: 'success',
      title: 'DHCP Lease Granted',
      detail: 'Smart Plug assigned 192.168.120.10',
      clientName: 'Smart Plug',
    },
    {
      id: 'e-3',
      timestamp: '2026-08-28T20:40:00Z',
      type: 'alert',
      severity: 'warning',
      title: 'Heavy Download Detected',
      detail: 'MacBook downloaded 4GB',
      clientName: 'MacBook',
    },
  ];

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <NocEventStreamModal events={mockEvents} isOpen={false} onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders events list and filters by type and text query', () => {
    const onClose = vi.fn();
    render(<NocEventStreamModal events={mockEvents} isOpen={true} onClose={onClose} />);

    expect(screen.getByText('Live NOC Event Stream')).toBeInTheDocument();
    expect(screen.getByText('Fast Roaming Success')).toBeInTheDocument();
    expect(screen.getByText('DHCP Lease Granted')).toBeInTheDocument();

    // Filter to Roaming
    fireEvent.click(screen.getByRole('button', { name: /Roaming/i }));
    expect(screen.getByText('Fast Roaming Success')).toBeInTheDocument();
    expect(screen.queryByText('DHCP Lease Granted')).not.toBeInTheDocument();

    // Filter to DHCP
    fireEvent.click(screen.getByRole('button', { name: /DHCP/i }));
    expect(screen.getByText('DHCP Lease Granted')).toBeInTheDocument();
    expect(screen.queryByText('Fast Roaming Success')).not.toBeInTheDocument();

    // Filter to Alerts
    fireEvent.click(screen.getByRole('button', { name: /Alerts/i }));
    expect(screen.getByText('Heavy Download Detected')).toBeInTheDocument();
    expect(screen.queryByText('Fast Roaming Success')).not.toBeInTheDocument();

    // Filter back to All Events
    fireEvent.click(screen.getByRole('button', { name: /All Events/i }));
    expect(screen.getByText('Fast Roaming Success')).toBeInTheDocument();

    // Search query
    const searchInput = screen.getByPlaceholderText(/Filter event log/i);
    fireEvent.change(searchInput, { target: { value: 'iPhone' } });
    expect(screen.getByText('Fast Roaming Success')).toBeInTheDocument();
    expect(screen.queryByText('DHCP Lease Granted')).not.toBeInTheDocument();

    // Search unmatched
    fireEvent.change(searchInput, { target: { value: 'nonexistent-query' } });
    expect(screen.getByText(/No matching NOC events found/i)).toBeInTheDocument();

    // Close buttons
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders critical severity and handles search by detail and apName', () => {
    const events: NocEventItem[] = [
      {
        id: 'e-crit',
        timestamp: 'invalid-time',
        type: 'alert',
        severity: 'critical',
        title: 'Switch Port Down',
        detail: 'Port 8 link lost',
        apName: 'Arena AP',
      },
    ];

    render(<NocEventStreamModal events={events} isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Switch Port Down')).toBeInTheDocument();
    expect(screen.getByText('Port 8 link lost')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Filter event log/i);
    fireEvent.change(searchInput, { target: { value: 'Arena AP' } });
    expect(screen.getByText('Switch Port Down')).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Port 8' } });
    expect(screen.getByText('Switch Port Down')).toBeInTheDocument();
  });
});

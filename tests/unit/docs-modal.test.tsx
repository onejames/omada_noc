import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocsModal } from '@/app/components/DocsModal';

describe('DocsModal Component (app/components/DocsModal.tsx)', () => {
  const mockDocs = [
    {
      slug: 'prd',
      filename: 'PRD.md',
      title: 'Product Requirements Document',
      category: 'Product & Strategy',
      excerpt: 'Requirements overview for the NOC dashboard.',
      content: '# Product Requirements Document\n\nFull PRD text here.',
      size: 4096,
      updatedAt: new Date().toISOString(),
    },
    {
      slug: 'authentication',
      filename: 'authentication.md',
      title: 'Security & RBAC Architecture',
      category: 'Security & RBAC',
      excerpt: 'JWT tokens and secure cookie transport.',
      content: '# Security & RBAC Architecture\n\nAuthentication guide details.',
      size: 2048,
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<DocsModal isOpen={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('fetches and displays compiled docs, searches, switches docs, and copies content', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        total: 2,
        docs: mockDocs,
      }),
    });

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    const mockOnClose = vi.fn();
    render(<DocsModal isOpen={true} onClose={mockOnClose} />);

    // Wait for documents to load
    await waitFor(() => {
      expect(screen.getByText(/2 COMPILED PAGES/i)).toBeInTheDocument();
      expect(screen.getAllByText('Product Requirements Document')[0]).toBeInTheDocument();
    });

    // Content of first doc is active
    expect(screen.getByText(/Full PRD text here/i)).toBeInTheDocument();

    // Click second doc in sidebar
    const authDocBtn = screen.getByText('Security & RBAC Architecture');
    fireEvent.click(authDocBtn);

    await waitFor(() => {
      expect(screen.getByText(/Authentication guide details/i)).toBeInTheDocument();
    });

    // Copy markdown content
    const copyBtn = screen.getByRole('button', { name: /copy markdown/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByText(/copied/i)).toBeInTheDocument();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        '# Security & RBAC Architecture\n\nAuthentication guide details.'
      );
    });

    // Filter docs using search input
    const searchInput = screen.getByPlaceholderText(/search documentation/i);
    fireEvent.change(searchInput, { target: { value: 'Product' } });

    expect(screen.getByRole('button', { name: /Product Requirements Document/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Security & RBAC Architecture/i })).not.toBeInTheDocument();

    // Search for non-existent doc
    fireEvent.change(searchInput, { target: { value: 'nonexistent-query-xyz' } });
    expect(screen.getByText(/no documents found/i)).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /close documentation modal/i });
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('handles fetch failure and renders error message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Failed to access disk storage' }),
    });

    render(<DocsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/failed to access disk storage/i)).toBeInTheDocument();
    });
  });

  it('handles network throw error gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    render(<DocsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/network offline/i)).toBeInTheDocument();
    });
  });
});

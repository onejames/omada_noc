import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LoginPage from '@/app/(auth)/login/page';

const mockPush = vi.fn();
const mockRefresh = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => mockSearchParams,
}));

describe('LoginPage and MatrixAuthOverlay Component', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    mockSearchParams = new URLSearchParams();
    // Mock HTMLCanvasElement getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      fillRect: vi.fn(),
      fillText: vi.fn(),
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
  });

  it('renders login form, supports onFocus text selection, and populates demo credentials on click in dev mode', () => {
    (process.env as any).NODE_ENV = 'development';
    render(<LoginPage />);

    expect(screen.getByText('OMADA')).toBeInTheDocument();
    const emailInput = screen.getByPlaceholderText('admin@omadanoc.com');
    const passInput = screen.getByPlaceholderText('••••••••••••');

    // Test onFocus auto-selection
    const selectSpy = vi.spyOn(passInput as HTMLInputElement, 'select');
    fireEvent.focus(passInput);
    expect(selectSpy).toHaveBeenCalled();

    // Click demo fill button
    const demoBtn = screen.getByRole('button', { name: /admin@omadanoc\.com • AdminPass123!/i });
    expect(demoBtn).toBeInTheDocument();
    fireEvent.click(demoBtn);

    expect(emailInput).toHaveValue('admin@omadanoc.com');
    expect(passInput).toHaveValue('AdminPass123!');
  });

  it('hides dev demo credentials button when NODE_ENV is production', () => {
    (process.env as any).NODE_ENV = 'production';
    render(<LoginPage />);

    expect(screen.queryByText(/Development Administrator Credentials:/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /admin@omadanoc\.com • AdminPass123!/i })).not.toBeInTheDocument();
  });

  it('displays session timeout notice when reason=inactivity', () => {
    mockSearchParams = new URLSearchParams('reason=inactivity');
    render(<LoginPage />);

    expect(screen.getByText('Session Timeout')).toBeInTheDocument();
    expect(screen.getByText(/automatically signed out after 15 minutes/i)).toBeInTheDocument();
  });

  it('handles successful login and triggers 3-second matrix stream overlay', async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, user: { role: 'ADMIN' } }),
    });

    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText('admin@omadanoc.com');
    const passInput = screen.getByPlaceholderText('••••••••••••');
    const submitBtn = screen.getByRole('button', { name: /sign in to dashboard/i });

    fireEvent.change(emailInput, { target: { value: 'admin@omadanoc.com' } });
    fireEvent.change(passInput, { target: { value: 'AdminPass123!' } });

    fireEvent.click(submitBtn);

    // Matrix overlay appears
    expect(screen.getByTestId('matrix-auth-overlay')).toBeInTheDocument();
    expect(screen.getByText(/AUTHENTICATING/i)).toBeInTheDocument();

    // Advance time through intermediate stages and past 3000ms animation
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('handles login failure and hides matrix overlay with error message', async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid email or password' }),
    });

    render(<LoginPage />);

    const emailInput = screen.getByPlaceholderText('admin@omadanoc.com');
    const passInput = screen.getByPlaceholderText('••••••••••••');
    const submitBtn = screen.getByRole('button', { name: /sign in to dashboard/i });

    fireEvent.change(emailInput, { target: { value: 'admin@omadanoc.com' } });
    fireEvent.change(passInput, { target: { value: 'WrongPass' } });

    fireEvent.click(submitBtn);

    // Matrix overlay appears
    expect(screen.getByTestId('matrix-auth-overlay')).toBeInTheDocument();

    // Advance past 3000ms animation
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByTestId('matrix-auth-overlay')).not.toBeInTheDocument();
    expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
  });
});

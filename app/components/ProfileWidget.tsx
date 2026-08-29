'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

interface UserInfo {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
  fullName?: string;
  jobTitle?: string;
  department?: string;
  avatarUrl?: string;
}

interface ProfileWidgetProps {
  align?: 'left' | 'right';
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name[0] || 'U').toUpperCase();
}

export default function ProfileWidget({ align = 'right' }: ProfileWidgetProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  let router: ReturnType<typeof useRouter> | null = null;
  let pathname: string | null = null;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    pathname = usePathname();
  } catch {
    // Graceful fallback during isolated unit testing
  }

  // Fetch current user session
  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUser(data.user);
          }
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Proceed
    } finally {
      setUser(null);
      router?.push?.('/login');
      router?.refresh?.();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-1.5 animate-pulse" data-testid="profile-widget-loading">
        <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="px-3.5 py-2 text-xs font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/80 rounded-xl hover:bg-cyan-900/70 transition-colors shadow-sm"
      >
        Sign In
      </Link>
    );
  }

  const initials = getInitials(user.fullName || user.username || 'U');
  const alignmentClass = align === 'left' ? 'left-0' : 'right-0';

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-1.5 rounded-full bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/40 cursor-pointer shadow-md"
        aria-expanded={isOpen}
        aria-label="User Profile Menu"
        title={`${user.fullName || user.username} (${user.role})`}
      >
        {/* Enlarged Avatar / Initials Badge with Status Ring */}
        <div className="relative">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.fullName || user.username}
              className="w-14 h-14 rounded-full object-cover border border-cyan-500/50"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 text-white font-black text-lg flex items-center justify-center shadow-inner">
              {initials}
            </div>
          )}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-slate-900 ${
              user.role === 'ADMIN' ? 'bg-amber-400' : 'bg-cyan-400'
            }`}
          />
        </div>

        {/* Screen Reader Label for accessibility & tests */}
        <span className="sr-only">{user.fullName || user.username}</span>
        <span className="sr-only">{user.role}</span>

        <svg
          className={`w-4 h-4 text-slate-400 mr-1.5 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={`absolute ${alignmentClass} mt-2 w-60 rounded-xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-md z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150`}>
          <div className="px-3.5 py-2 border-b border-slate-800/80">
            <p className="text-xs font-bold text-slate-200">{user.fullName || user.username}</p>
            <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
            {user.jobTitle && (
              <p className="text-[10px] text-cyan-400/90 mt-0.5 font-medium">
                {user.jobTitle} {user.department ? `• ${user.department}` : ''}
              </p>
            )}
          </div>

          <div className="py-1">
            <Link
              href="/"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-3.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800/70 hover:text-white transition-colors"
            >
              <span className="mr-2 text-sm">📊</span> Telemetry Dashboard
            </Link>

            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-3.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800/70 hover:text-white transition-colors"
            >
              <span className="mr-2 text-sm">⚙️</span> Edit Profile & Password
            </Link>

            {user.role === 'ADMIN' && (
              <Link
                href="/admin/users"
                onClick={() => setIsOpen(false)}
                className="flex items-center px-3.5 py-1.5 text-xs text-amber-300 hover:bg-amber-950/40 transition-colors"
              >
                <span className="mr-2 text-sm">👥</span> User Management & Audits
              </Link>
            )}
          </div>

          <div className="pt-1 border-t border-slate-800/80">
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-3.5 py-1.5 text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors text-left cursor-pointer"
            >
              <span className="mr-2 text-sm">🚪</span> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

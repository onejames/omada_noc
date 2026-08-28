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

export default function ProfileWidget() {
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
      if (router) {
        router.push('/login');
        router.refresh();
      } else {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/login';
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 animate-pulse" data-testid="profile-widget-loading">
        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700"></div>
        <div className="w-20 h-4 bg-slate-800 rounded"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="px-3 py-1.5 text-xs font-semibold text-cyan-400 bg-cyan-950/40 border border-cyan-800/60 rounded-lg hover:bg-cyan-900/50 transition-colors"
      >
        Sign In
      </Link>
    );
  }

  const initials = (user.fullName || user.username || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
        aria-expanded={isOpen}
        aria-label="User Profile Menu"
      >
        {/* Avatar or Initials Badge */}
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.fullName || user.username}
            className="w-7 h-7 rounded-full object-cover border border-cyan-500/50"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-inner">
            {initials}
          </div>
        )}

        <div className="text-left hidden sm:block">
          <div className="text-xs font-semibold text-slate-200 leading-tight">
            {user.fullName || user.username}
          </div>
          <div className="flex items-center space-x-1 mt-0.5">
            <span
              className={`inline-block px-1.5 py-0.2 text-[10px] font-bold rounded tracking-wider uppercase ${
                user.role === 'ADMIN'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              }`}
            >
              {user.role}
            </span>
          </div>
        </div>

        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
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
        <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-md z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 py-2.5 border-b border-slate-800/80">
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
              className="flex items-center px-4 py-2 text-xs text-slate-300 hover:bg-slate-800/70 hover:text-white transition-colors"
            >
              <span className="mr-2.5 text-sm">📊</span> Telemetry Dashboard
            </Link>

            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center px-4 py-2 text-xs text-slate-300 hover:bg-slate-800/70 hover:text-white transition-colors"
            >
              <span className="mr-2.5 text-sm">⚙️</span> Edit Profile & Password
            </Link>

            {user.role === 'ADMIN' && (
              <Link
                href="/admin/users"
                onClick={() => setIsOpen(false)}
                className="flex items-center px-4 py-2 text-xs text-amber-300 hover:bg-amber-950/40 transition-colors"
              >
                <span className="mr-2.5 text-sm">👥</span> User Management & Audits
              </Link>
            )}
          </div>

          <div className="pt-1 border-t border-slate-800/80">
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-2 text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors text-left"
            >
              <span className="mr-2.5 text-sm">🚪</span> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

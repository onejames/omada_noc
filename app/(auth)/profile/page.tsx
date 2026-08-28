'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ProfileWidget from '@/app/components/ProfileWidget';
import InactivityTracker from '@/app/components/InactivityTracker';

interface UserProfileData {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
  fullName: string;
  jobTitle: string;
  department: string;
  avatarUrl: string;
  theme: 'dark' | 'light' | 'system';
  taggedDevices: Array<{
    id: string;
    macAddress: string;
    deviceName?: string;
    createdAt: string;
  }>;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (data.authenticated && data.user) {
          setProfile(data.user);
          setFullName(data.user.fullName || '');
          setJobTitle(data.user.jobTitle || '');
          setDepartment(data.user.department || '');
          setAvatarUrl(data.user.avatarUrl || '');
          setTheme(data.user.theme || 'dark');
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    if (newPassword && newPassword !== confirmPassword) {
      setErrorMsg('New password and confirm password do not match.');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          jobTitle,
          department,
          avatarUrl,
          theme,
          ...(newPassword && { currentPassword, newPassword }),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setSuccessMsg('Profile and preferences updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating profile';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      <InactivityTracker />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="flex items-center space-x-2 text-slate-400 hover:text-cyan-400 text-xs font-semibold transition-colors"
            >
              <span>← Back to Dashboard</span>
            </Link>
            <span className="text-slate-700">|</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm">👤</span>
              <span className="font-bold text-sm text-slate-200">User Profile & Account</span>
            </div>
          </div>
          <ProfileWidget align="right" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight text-white font-mono">Account Profile</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your personal credentials, contact details, display preferences, and view tagged hardware devices.
          </p>
        </div>

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2.5">
            <span>✅</span>
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2.5">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Card 1: Profile Information */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl">
            <h2 className="text-sm font-bold text-slate-200 mb-4 flex items-center space-x-2">
              <span>📇</span>
              <span>Personal Information</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Username</label>
                <input
                  type="text"
                  disabled
                  value={profile?.username || ''}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-400 text-xs cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email Address</label>
                <input
                  type="text"
                  disabled
                  value={profile?.email || ''}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-400 text-xs cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Lead Engineer"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Job Title</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Network & Software Engineer"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Department / Organization</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Global NOC Operations"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Avatar Image URL</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/60"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Security & Password Change */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl">
            <h2 className="text-sm font-bold text-slate-200 mb-2 flex items-center space-x-2">
              <span>🔒</span>
              <span>Change Password</span>
            </h2>
            <p className="text-[11px] text-slate-400 mb-4">
              Leave these fields blank if you do not wish to change your current password.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/60"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Tagged Hardware Devices */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl">
            <h2 className="text-sm font-bold text-slate-200 mb-2 flex items-center space-x-2">
              <span>🏷️</span>
              <span>Assigned Hardware Devices ({profile?.taggedDevices.length || 0})</span>
            </h2>
            <p className="text-[11px] text-slate-400 mb-4">
              {profile?.role === 'ADMIN'
                ? 'As an Administrator, you have global visibility over all network devices across the controller.'
                : profile?.taggedDevices && profile.taggedDevices.length > 0
                ? 'Your telemetry dashboard is scoped to only display metrics for these assigned devices.'
                : 'No devices currently tagged to your user account. Under default policy, you have full visibility over all devices.'}
            </p>

            {profile?.taggedDevices && profile.taggedDevices.length > 0 ? (
              <div className="divide-y divide-slate-800/60 border border-slate-800 rounded-xl overflow-hidden">
                {profile.taggedDevices.map((device) => (
                  <div key={device.id} className="p-3 bg-slate-950/60 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{device.deviceName || 'Tagged Device'}</p>
                      <p className="text-[11px] font-mono text-cyan-400 mt-0.5">{device.macAddress}</p>
                    </div>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">
                      Tagged: {new Date(device.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all"
            >
              {saving ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

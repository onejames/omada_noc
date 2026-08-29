'use client';

import React, { useState } from 'react';
import { NocEventItem } from '@/types/omada';

interface NocEventStreamModalProps {
  events?: NocEventItem[];
  isOpen: boolean;
  onClose: () => void;
}

export default function NocEventStreamModal({
  events = [],
  isOpen,
  onClose,
}: NocEventStreamModalProps) {
  const [filterType, setFilterType] = useState<'all' | 'roam' | 'dhcp' | 'alert' | 'poe' | 'system'>('all');
  const [search, setSearch] = useState<string>('');

  if (!isOpen) return null;

  const filteredEvents = events.filter((e) => {
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q) ||
        (e.clientName || '').toLowerCase().includes(q) ||
        (e.apName || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { badge: 'bg-rose-950/80 border-rose-800 text-rose-300', icon: '🚨' };
      case 'warning':
        return { badge: 'bg-amber-950/80 border-amber-800 text-amber-300', icon: '⚠️' };
      case 'success':
        return { badge: 'bg-emerald-950/80 border-emerald-800 text-emerald-300', icon: '✅' };
      default:
        return { badge: 'bg-cyan-950/80 border-cyan-800 text-cyan-300', icon: 'ℹ️' };
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Live NOC Event Stream"
        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-3xl w-full shadow-2xl space-y-5 max-h-[90vh] flex flex-col relative overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-xl shrink-0">
              📜
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white font-mono">Live NOC Event Stream</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  REAL-TIME
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Real-time 802.11 roaming, DHCP leases, PoE budgets, and security anomalies
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-700 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-cyan-950 border-cyan-700 text-cyan-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All Events ({events.length})
            </button>
            <button
              onClick={() => setFilterType('roam')}
              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                filterType === 'roam'
                  ? 'bg-purple-950 border-purple-700 text-purple-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              🔄 Roaming
            </button>
            <button
              onClick={() => setFilterType('dhcp')}
              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                filterType === 'dhcp'
                  ? 'bg-emerald-950 border-emerald-700 text-emerald-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              🌐 DHCP
            </button>
            <button
              onClick={() => setFilterType('alert')}
              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                filterType === 'alert'
                  ? 'bg-amber-950 border-amber-700 text-amber-300 font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              ⚠️ Alerts
            </button>
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter event log..."
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-full sm:w-48"
          />
        </div>

        {/* Event List */}
        <div className="overflow-y-auto space-y-3 pr-1 flex-1">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-mono text-xs">
              No matching NOC events found for current filter.
            </div>
          ) : (
            filteredEvents.map((evt) => {
              const style = getSeverityStyle(evt.severity);
              return (
                <div
                  key={evt.id}
                  className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-1.5 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span>{style.icon}</span>
                      <span className="font-bold text-white font-mono text-xs">{evt.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${style.badge}`}>
                        {evt.type.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {formatTimestamp(evt.timestamp)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 font-mono pl-6">{evt.detail}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 shrink-0 text-xs font-mono text-slate-400">
          <span>Showing {filteredEvents.length} events</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

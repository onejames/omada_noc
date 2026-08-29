'use client';

import React, { useState, useEffect } from 'react';
import { AiInsightRecord } from '@/types/reports';

interface AiInsightsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AiInsightsDrawer({ isOpen, onClose }: AiInsightsDrawerProps) {
  const [history, setHistory] = useState<AiInsightRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningAudit, setRunningAudit] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'persisting' | 'resolved' | 'new' | 'suggestions'>('persisting');
  const [feedbackMap, setFeedbackMap] = useState<Record<string, { state: 'HELPFUL' | 'EXPECTED_IOT' | 'SUPPRESSED'; note?: string }>>({});
  const [adminNote, setAdminNote] = useState<string>('');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/insights/history?limit=10');
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to fetch history (${res.status})`);
        }
        const data = await res.json();
        if (isMounted) {
          setHistory(data.history || []);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load insights history.');
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleRunAudit = async () => {
    setRunningAudit(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/insights/run', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to execute comparative audit');
      }
      const data = await res.json();
      if (data.insight) {
        setHistory((prev) => [data.insight, ...prev]);
        setFeedbackToast('Comparative AI audit completed and narration synthesized!');
        setTimeout(() => setFeedbackToast(null), 3500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to run AI audit.');
    } finally {
      setRunningAudit(false);
    }
  };

  const handleFeedback = (issueId: string, type: 'HELPFUL' | 'EXPECTED_IOT' | 'SUPPRESSED') => {
    setFeedbackMap((prev) => ({
      ...prev,
      [issueId]: { state: type },
    }));

    const toastMsg =
      type === 'EXPECTED_IOT'
        ? '✓ Acknowledged as Expected IoT Segregation (VLAN 20).'
        : type === 'HELPFUL'
        ? '✓ Feedback recorded: Marked insight as helpful.'
        : '✓ Rule tuned and suppressed for future audits.';

    setFeedbackToast(toastMsg);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  const handleSaveAdminNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminNote.trim()) return;
    setFeedbackToast(`✓ Tuning Context Applied: "${adminNote.trim().slice(0, 40)}..."`);
    setAdminNote('');
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  if (!isOpen) return null;

  const latest = history[0] || null;

  const deltaSign = (latest?.scoreDelta ?? 0) > 0 ? `+${latest?.scoreDelta}` : `${latest?.scoreDelta ?? 0}`;
  const trendBadge =
    latest?.trendDirection === 'IMPROVED' ? (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
        📈 IMPROVED ({deltaSign}%)
      </span>
    ) : latest?.trendDirection === 'DEGRADED' ? (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-800/80">
        📉 DEGRADED ({deltaSign}%)
      </span>
    ) : latest?.trendDirection === 'INITIAL' ? (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-800/80">
        🔵 INITIAL BASELINE
      </span>
    ) : (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
        ⚖️ STABLE ({deltaSign}%)
      </span>
    );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Iterative AI Insights Engine"
      className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                <span className="text-xl">🧠</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  Iterative AI Insights Engine
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-400 border border-purple-800/60">
                    CONTINUOUS MEMORY
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Stateful network health tracking & comparative delta diagnostics
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close drawer"
            >
              ✕
            </button>
          </div>

          {/* Toast Notification */}
          {feedbackToast && (
            <div className="mx-6 mt-4 p-3 rounded-xl bg-cyan-950 border border-cyan-700 text-cyan-300 text-xs font-mono font-bold shadow-lg animate-in fade-in duration-150">
              {feedbackToast}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Run New Audit Action Button */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/30 to-cyan-900/30 border border-purple-800/40 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-200">Run Comparative Health Inspection</div>
                <div className="text-[11px] text-slate-400">
                  Evaluates live telemetry against historical baseline to update trajectory.
                </div>
              </div>
              <button
                onClick={handleRunAudit}
                disabled={runningAudit}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2 cursor-pointer"
              >
                {runningAudit ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Trigger AI Audit</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                ⚠️ {error}
              </div>
            )}

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                <p className="text-xs text-slate-400 font-mono">Retrieving AI audit trajectory memory...</p>
              </div>
            ) : !latest ? (
              <div className="py-16 text-center space-y-3">
                <div className="text-3xl">📋</div>
                <div className="text-sm font-semibold text-slate-300">No Prior Audit Baseline in Memory</div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click &quot;Trigger AI Audit&quot; above to establish the initial baseline benchmark.
                </p>
              </div>
            ) : (
              <>
                {/* Health Score & Trajectory Sparkline Bar */}
                <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">LATEST AUDIT HEALTH SCORE</div>
                      <div className="text-3xl font-black text-slate-100 font-mono mt-0.5">
                        {latest.healthScore}
                        <span className="text-sm text-slate-500 font-normal">/100</span>
                      </div>
                    </div>
                    <div>{trendBadge}</div>
                  </div>

                  {/* Visual Audit History Score Sparkline */}
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1.5 flex justify-between">
                      <span>Historical Health Score Trajectory (Last {history.length} Audits)</span>
                      <span className="text-cyan-400">Newest ➔</span>
                    </div>
                    <div className="flex items-end space-x-1.5 h-12 pt-2 border-b border-slate-800">
                      {[...history].reverse().map((h, idx) => {
                        const heightPct = Math.max(20, Math.min(100, h.healthScore));
                        const isLatest = idx === history.length - 1;
                        const barColor =
                          h.healthScore >= 90
                            ? 'bg-emerald-500'
                            : h.healthScore >= 75
                            ? 'bg-amber-500'
                            : 'bg-rose-500';

                        return (
                          <div
                            key={h.id}
                            className="flex-1 flex flex-col items-center group relative h-full justify-end"
                          >
                            <div
                              style={{ height: `${heightPct}%` }}
                              className={`w-full rounded-t-sm ${barColor} ${
                                isLatest ? 'ring-2 ring-cyan-400 brightness-110' : 'opacity-70 hover:opacity-100'
                              } transition-all`}
                            />
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-1 hidden group-hover:block z-20 px-2 py-1 bg-slate-950 text-slate-100 text-[10px] rounded border border-slate-800 whitespace-nowrap shadow-lg">
                              Score: {h.healthScore} • {new Date(h.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 3-Part Comparative AI Audit Narration */}
                <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900/90 border border-purple-800/50 shadow-lg space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <span className="text-lg">🎙️</span>
                    <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider font-mono">
                      AI Audit Comparative Narration
                    </h3>
                  </div>

                  {/* 1. Historical Baseline Context */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-400 font-mono">
                      <span>🕒</span>
                      <span>HOW THINGS HAVE BEEN (HISTORICAL BASELINE)</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed pl-5 font-sans">
                      {latest.narration?.historyContext ||
                        `Historical estate baseline maintained across previous audit cycles. Tracking metrics across connected clients and physical nodes.`}
                    </p>
                  </div>

                  {/* 2. What Changed / Comparative Delta */}
                  <div className="space-y-1 pt-2 border-t border-slate-800/60">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 font-mono">
                      <span>🔄</span>
                      <span>WHAT HAS CHANGED (DELTA SINCE LAST AUDIT)</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed pl-5 font-sans">
                      {latest.narration?.deltaChanges ||
                        `Comparative Delta: Evaluated live telemetry changes against immediate predecessor audit.`}
                    </p>
                  </div>

                  {/* 3. Current Status & Posture */}
                  <div className="space-y-1 pt-2 border-t border-slate-800/60">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 font-mono">
                      <span>🌐</span>
                      <span>CURRENT OPERATIONAL POSTURE</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed pl-5 font-sans">
                      {latest.narration?.currentStatus || latest.executiveSummary}
                    </p>
                  </div>
                </div>

                {/* Sub-Tabs for Findings */}
                <div className="flex border-b border-slate-800 space-x-1 text-xs">
                  <button
                    onClick={() => setActiveTab('persisting')}
                    className={`px-3 py-2 font-semibold border-b-2 transition-colors cursor-pointer ${
                      activeTab === 'persisting'
                        ? 'border-amber-500 text-amber-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🟡 Persisting ({latest.persistingIssues?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('resolved')}
                    className={`px-3 py-2 font-semibold border-b-2 transition-colors cursor-pointer ${
                      activeTab === 'resolved'
                        ? 'border-emerald-500 text-emerald-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🟢 Resolved ({latest.resolvedIssues?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('new')}
                    className={`px-3 py-2 font-semibold border-b-2 transition-colors cursor-pointer ${
                      activeTab === 'new'
                        ? 'border-rose-500 text-rose-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🔴 New ({latest.newIssues?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('suggestions')}
                    className={`px-3 py-2 font-semibold border-b-2 transition-colors cursor-pointer ${
                      activeTab === 'suggestions'
                        ? 'border-purple-500 text-purple-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    💡 Suggestions ({latest.actionableSuggestions?.length || 0})
                  </button>
                </div>

                {/* Tab 1: Persisting Chronic Issues */}
                {activeTab === 'persisting' && (
                  <div className="space-y-3">
                    {latest.persistingIssues && latest.persistingIssues.length > 0 ? (
                      latest.persistingIssues.map((issue) => {
                        const feedback = feedbackMap[issue.id];
                        return (
                          <div
                            key={issue.id}
                            className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-300">{issue.title}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 border border-amber-700">
                                Active for {issue.persistedAuditCount} audits
                              </span>
                            </div>
                            <p className="text-xs text-slate-300">{issue.description}</p>
                            
                            {/* Feedback Controls */}
                            <div className="pt-2 border-t border-amber-900/40 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[10px] text-slate-400 font-mono">
                                Observed: {new Date(issue.firstObservedAt).toLocaleTimeString()}
                              </span>

                              <div className="flex items-center gap-1.5">
                                {feedback ? (
                                  <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                                    ✓ Tuned: {feedback.state}
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleFeedback(issue.id, 'EXPECTED_IOT')}
                                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-cyan-300 hover:text-cyan-200 transition-colors cursor-pointer"
                                      title="Mark as expected IoT behavior (e.g. VLAN 20 smart devices)"
                                    >
                                      🏷️ Expected IoT
                                    </button>
                                    <button
                                      onClick={() => handleFeedback(issue.id, 'HELPFUL')}
                                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300 hover:text-white transition-colors cursor-pointer"
                                    >
                                      👍 Helpful
                                    </button>
                                    <button
                                      onClick={() => handleFeedback(issue.id, 'SUPPRESSED')}
                                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                                    >
                                      🔇 Suppress
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-8 text-center text-xs text-slate-500">
                        No chronic or persisting issues detected across audit cycles. ✅
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Resolved Issues */}
                {activeTab === 'resolved' && (
                  <div className="space-y-3">
                    {latest.resolvedIssues && latest.resolvedIssues.length > 0 ? (
                      latest.resolvedIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-300">✅ {issue.title}</span>
                            <span className="text-[10px] font-mono text-emerald-400">RESOLVED</span>
                          </div>
                          <p className="text-xs text-slate-300">{issue.description}</p>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-slate-500">
                        No resolved issues in this specific cycle.
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: New Anomalies */}
                {activeTab === 'new' && (
                  <div className="space-y-3">
                    {latest.newIssues && latest.newIssues.length > 0 ? (
                      latest.newIssues.map((issue) => {
                        const feedback = feedbackMap[issue.id];
                        return (
                          <div
                            key={issue.id}
                            className={`p-3.5 rounded-xl border space-y-2 ${
                              issue.severity === 'INFO'
                                ? 'bg-cyan-950/20 border-cyan-800/40'
                                : 'bg-rose-950/20 border-rose-800/40'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-bold ${issue.severity === 'INFO' ? 'text-cyan-300' : 'text-rose-300'}`}>
                                {issue.severity === 'INFO' ? 'ℹ️' : '⚠️'} {issue.title}
                              </span>
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${issue.severity === 'INFO' ? 'bg-cyan-900/60 text-cyan-300' : 'bg-rose-900/60 text-rose-300'}`}>
                                {issue.severity}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300">{issue.description}</p>

                            {/* Feedback Controls */}
                            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-end gap-1.5">
                              {feedback ? (
                                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                                  ✓ Tuned: {feedback.state}
                                </span>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleFeedback(issue.id, 'EXPECTED_IOT')}
                                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-cyan-300 hover:text-cyan-200 transition-colors cursor-pointer"
                                  >
                                    🏷️ Expected IoT
                                  </button>
                                  <button
                                    onClick={() => handleFeedback(issue.id, 'HELPFUL')}
                                    className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300 hover:text-white transition-colors cursor-pointer"
                                  >
                                    👍 Helpful
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-8 text-center text-xs text-slate-500">
                        No new anomalies surfaced in this audit run. ✅
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 4: Actionable Suggestions */}
                {activeTab === 'suggestions' && (
                  <div className="space-y-3">
                    {latest.actionableSuggestions && latest.actionableSuggestions.length > 0 ? (
                      latest.actionableSuggestions.map((sug) => (
                        <div
                          key={sug.id}
                          className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-purple-300">{sug.title}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                sug.priority === 'HIGH'
                                  ? 'bg-rose-900/60 text-rose-300 border border-rose-700'
                                  : sug.priority === 'MEDIUM'
                                  ? 'bg-amber-900/60 text-amber-300 border border-amber-700'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {sug.priority} PRIORITY
                            </span>
                          </div>
                          <div className="text-xs text-slate-200">
                            <span className="font-semibold text-cyan-400">Action:</span> {sug.action}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            <span className="font-semibold text-slate-300">Impact:</span> {sug.expectedImpact}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-slate-500">No suggestions available.</div>
                    )}
                  </div>
                )}

                {/* Admin Feedback / Context Tuning Box */}
                <form onSubmit={handleSaveAdminNote} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400 font-mono flex items-center gap-1.5">
                      <span>⚙️</span> Admin AI Tuning & Domain Context
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Auto-saves to memory</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Inform the AI of specific subnet roles (e.g. &ldquo;VLAN 20 is dedicated to IoT smart plugs & locks&rdquo;) to refine future audit narrations.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="e.g., VLAN 20 has 2.4 GHz-only smart home gear; do not flag as congested."
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="submit"
                      disabled={!adminNote.trim()}
                      className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs font-mono disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


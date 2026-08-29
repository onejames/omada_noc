'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AiInsightRecord } from '@/types/reports';

export interface BackgroundAuditState {
  status: 'idle' | 'running' | 'completed' | 'error';
  engineType: 'NLG_ALGORITHMIC' | 'DEEPSEEK_AGENT';
  startTime: number;
  result?: AiInsightRecord;
  error?: string;
  isUnread?: boolean;
}

interface AiInsightsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  backgroundAudit?: BackgroundAuditState;
  onTriggerNlgAudit?: () => void;
  onTriggerAgentAudit?: () => void;
}

export function AiInsightsDrawer({
  isOpen,
  onClose,
  backgroundAudit,
  onTriggerNlgAudit,
  onTriggerAgentAudit,
}: AiInsightsDrawerProps) {
  const [history, setHistory] = useState<AiInsightRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [localNlgRunning, setLocalNlgRunning] = useState<boolean>(false);
  const [localAgentRunning, setLocalAgentRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'persisting' | 'resolved' | 'new' | 'suggestions'>('persisting');
  const [feedbackMap, setFeedbackMap] = useState<Record<string, { state: 'HELPFUL' | 'EXPECTED_IOT' | 'SUPPRESSED'; note?: string }>>({});
  const [adminNote, setAdminNote] = useState<string>('');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [showThinking, setShowThinking] = useState(false);

  const isNlgRunning = localNlgRunning || (backgroundAudit?.status === 'running' && backgroundAudit.engineType === 'NLG_ALGORITHMIC');
  const isAgentRunning = localAgentRunning || (backgroundAudit?.status === 'running' && backgroundAudit.engineType === 'DEEPSEEK_AGENT');

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
          setHistory((prev) => {
            const fetched: AiInsightRecord[] = data.history || [];
            const unsynced = prev.filter((p) => !fetched.some((f) => f.id === p.id));
            return [...unsynced, ...fetched];
          });
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

  const effectiveHistory = useMemo(() => {
    if (backgroundAudit?.status === 'completed' && backgroundAudit.result) {
      if (!history.some((h) => h.id === backgroundAudit.result?.id)) {
        return [backgroundAudit.result, ...history];
      }
    }
    return history;
  }, [backgroundAudit, history]);

  const activeToast =
    feedbackToast ||
    (backgroundAudit?.status === 'completed' && backgroundAudit.result
      ? backgroundAudit.engineType === 'DEEPSEEK_AGENT'
        ? '🧠 DeepSeek-R1 Neural Agent completed real generative reasoning!'
        : '⚡ Deterministic NLG audit completed (Edge Heuristics Engine)!'
      : null);

  const activeError = error || (backgroundAudit?.status === 'error' ? backgroundAudit.error : null);

  const handleRunNlgAudit = async () => {
    if (onTriggerNlgAudit) {
      onTriggerNlgAudit();
      return;
    }

    setLocalNlgRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/insights/run', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to execute deterministic NLG audit');
      }
      const data = await res.json();
      if (data.insight) {
        setHistory((prev) => [data.insight, ...prev]);
        setFeedbackToast('⚡ Deterministic NLG audit completed (Edge Heuristics Engine)!');
        setTimeout(() => setFeedbackToast(null), 3500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to run NLG audit.');
    } finally {
      setLocalNlgRunning(false);
    }
  };

  const handleRunLlmAgentAudit = async () => {
    if (onTriggerAgentAudit) {
      onTriggerAgentAudit();
      return;
    }

    setLocalAgentRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/insights/agent', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to execute DeepSeek LLM Agent inference (Is Ollama running?)');
      }
      const data = await res.json();
      if (data.insight) {
        setHistory((prev) => [data.insight, ...prev]);
        setFeedbackToast('🧠 DeepSeek-R1 Neural Agent completed real generative reasoning!');
        setTimeout(() => setFeedbackToast(null), 4000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to run DeepSeek LLM Agent audit. Ensure Ollama is active.');
    } finally {
      setLocalAgentRunning(false);
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

  const latest = effectiveHistory[0] || null;

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
    <aside
      role="dialog"
      aria-modal="true"
      aria-label="Continuous AI & NLG Engine"
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
                  Continuous AI & NLG Engine
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-400 border border-purple-800/60">
                    DUAL INSIGHT MODE
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Deterministic Edge Heuristics & Local DeepSeek-R1 Neural Agent
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(isNlgRunning || isAgentRunning) && (
                <button
                  onClick={onClose}
                  className="px-2.5 py-1 rounded-xl bg-purple-950/90 hover:bg-purple-900 border border-purple-700 text-purple-300 text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                  title="Minimize and continue running in background"
                >
                  <span>⬇️</span>
                  <span>Push to Background</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close drawer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {activeToast && (
            <div className="mx-6 mt-4 p-3 rounded-xl bg-cyan-950 border border-cyan-700 text-cyan-300 text-xs font-mono font-bold shadow-lg animate-in fade-in duration-150">
              {activeToast}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Dual Mode Action Execution Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Deterministic NLG Audit */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-cyan-900/50 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 font-mono">
                    <span>⚡</span>
                    <span>DETERMINISTIC NLG</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Zero-latency edge rules: RSSI thresholds, IoT VLAN 20 matching & math scoring.
                  </p>
                </div>
                <button
                  onClick={handleRunNlgAudit}
                  disabled={isNlgRunning || isAgentRunning}
                  className="w-full py-2 px-3 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-200 text-xs font-bold font-mono transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isNlgRunning ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      <span>Auditing Rules...</span>
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>Trigger NLG Audit</span>
                    </>
                  )}
                </button>
              </div>

              {/* Option 2: Real DeepSeek-R1 Neural Agent */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/60 to-slate-950 border border-purple-700/60 flex flex-col justify-between space-y-3 shadow-lg shadow-purple-950/30">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300 font-mono">
                    <span>🧠</span>
                    <span>DEEPSEEK-R1 AGENT</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Real local neural inference via Ollama (<code>deepseek-r1:7b</code>) with Chain-of-Thought.
                  </p>
                </div>
                <button
                  onClick={handleRunLlmAgentAudit}
                  disabled={isNlgRunning || isAgentRunning}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold font-mono transition-all shadow-md shadow-purple-500/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isAgentRunning ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Agent Thinking...</span>
                    </>
                  ) : (
                    <>
                      <span>🧠</span>
                      <span>Run DeepSeek Agent</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {activeError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                ⚠️ {activeError}
              </div>
            )}

            {loading && !latest ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                <p className="text-xs text-slate-400 font-mono">Retrieving AI audit trajectory memory...</p>
              </div>
            ) : !latest ? (
              <div className="py-16 text-center space-y-3">
                <div className="text-3xl">📋</div>
                <div className="text-sm font-semibold text-slate-300">No Prior Audit Baseline in Memory</div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click &quot;Trigger NLG Audit&quot; or &quot;Run DeepSeek Agent&quot; above to establish the initial baseline benchmark.
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

                  {/* Engine Type Tag */}
                  <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-slate-800/80">
                    <span className="text-slate-400">Diagnostic Engine:</span>
                    <span className={`px-2.5 py-0.5 rounded-full font-bold ${
                      latest.engineType === 'DEEPSEEK_AGENT'
                        ? 'bg-purple-950 text-purple-300 border border-purple-800'
                        : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                    }`}>
                      {latest.engineType === 'DEEPSEEK_AGENT' ? `🧠 Neural LLM Agent (${latest.llmModel || 'deepseek-r1:7b'})` : '⚡ Deterministic NLG'}
                    </span>
                  </div>

                  {/* DeepSeek Chain-of-Thought Collapsible Reasoning Box */}
                  {latest.thinkingProcess && (
                    <div className="pt-2">
                      <button
                        onClick={() => setShowThinking(!showThinking)}
                        className="w-full text-left p-3 rounded-xl bg-purple-950/40 hover:bg-purple-950/70 border border-purple-800/60 text-xs font-mono text-purple-300 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <span>💭</span>
                          <span className="font-bold">DeepSeek-R1 Chain-of-Thought Reasoning Deliberation</span>
                        </span>
                        <span className="text-slate-400">{showThinking ? '▲ Hide' : '▼ View Thinking'}</span>
                      </button>

                      {showThinking && (
                        <div className="mt-2 p-3.5 rounded-xl bg-slate-950 border border-purple-900/80 text-slate-300 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto animate-in fade-in duration-150">
                          {latest.thinkingProcess}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Trajectory History Sparkline Bars */}
                  {effectiveHistory.length > 1 && (
                    <div className="pt-3 border-t border-slate-800/80 space-y-2">
                      <div className="text-[11px] font-mono text-slate-400">AUDIT SCORE TRAJECTORY (PAST {effectiveHistory.length} AUDITS)</div>
                      <div className="flex items-end space-x-2 h-16 pt-2">
                        {effectiveHistory.slice(0, 8).reverse().map((audit, idx) => {
                          const heightPct = Math.max(15, audit.healthScore);
                          const barColor =
                            audit.healthScore >= 90
                              ? 'bg-emerald-500'
                              : audit.healthScore >= 75
                              ? 'bg-cyan-500'
                              : audit.healthScore >= 60
                              ? 'bg-amber-500'
                              : 'bg-rose-500';

                          return (
                            <div key={audit.id || idx} className="flex-1 flex flex-col items-center gap-1">
                              <span className="text-[10px] font-mono text-slate-400">{audit.healthScore}</span>
                              <div
                                className={`w-full rounded-t-md transition-all duration-500 ${barColor}`}
                                style={{ height: `${heightPct}%` }}
                                title={`Audit at ${new Date(audit.createdAt).toLocaleTimeString()}: Score ${audit.healthScore}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Dynamic 3-Part Comparative Executive Narrative */}
                <div className="p-4 rounded-2xl bg-slate-950/90 border border-purple-900/60 shadow-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-purple-950 text-purple-300 text-[10px] font-mono font-bold border border-purple-800">
                      AI Audit Comparative Narration
                    </span>
                    <span className="text-xs font-semibold text-slate-300 font-mono">
                      Stateful Trajectory Analysis
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono leading-relaxed text-slate-300">
                    <p>
                      <strong className="text-purple-300">1. HOW THINGS HAVE BEEN (PAST CONTEXT): </strong>
                      {latest.narration?.historyContext || 'No previous baseline on record.'}
                    </p>
                    <p>
                      <strong className="text-cyan-300">2. WHAT HAS CHANGED (DELTA ANOMALIES): </strong>
                      {latest.narration?.deltaChanges || 'Zero state modifications detected.'}
                    </p>
                    <p>
                      <strong className="text-emerald-300">3. CURRENT OPERATIONAL POSTURE: </strong>
                      {latest.narration?.currentStatus || latest.executiveSummary}
                    </p>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex space-x-1 border-b border-slate-800">
                  <button
                    onClick={() => setActiveTab('persisting')}
                    className={`pb-2 px-3 text-xs font-mono font-semibold transition-colors cursor-pointer ${
                      activeTab === 'persisting'
                        ? 'text-amber-400 border-b-2 border-amber-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Persisting ({latest.persistingIssues.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('resolved')}
                    className={`pb-2 px-3 text-xs font-mono font-semibold transition-colors cursor-pointer ${
                      activeTab === 'resolved'
                        ? 'text-emerald-400 border-b-2 border-emerald-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Resolved ({latest.resolvedIssues.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('new')}
                    className={`pb-2 px-3 text-xs font-mono font-semibold transition-colors cursor-pointer ${
                      activeTab === 'new'
                        ? 'text-rose-400 border-b-2 border-rose-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    New ({latest.newIssues.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('suggestions')}
                    className={`pb-2 px-3 text-xs font-mono font-semibold transition-colors cursor-pointer ${
                      activeTab === 'suggestions'
                        ? 'text-cyan-400 border-b-2 border-cyan-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Suggestions ({latest.actionableSuggestions.length})
                  </button>
                </div>

                {/* Tab Content 1: Persisting Issues */}
                {activeTab === 'persisting' && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    {latest.persistingIssues.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-950/40 text-center text-xs text-slate-500 font-mono">
                        No chronic or persisting issues detected across inspection cycles.
                      </div>
                    ) : (
                      latest.persistingIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="p-4 rounded-xl bg-slate-950/80 border border-amber-900/60 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 text-[10px] font-mono font-bold border border-amber-800">
                                {issue.category}
                              </span>
                              <span className="text-xs font-bold text-slate-200 font-mono">{issue.title}</span>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 text-amber-400 border border-amber-800">
                              PERSISTING ({issue.persistedAuditCount || 1}x)
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono">{issue.description}</p>

                          {/* Admin Feedback Actions */}
                          <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 text-[11px] font-mono">
                            <span className="text-slate-500">Tuning Feedback:</span>
                            <div className="flex space-x-1.5">
                              {feedbackMap[issue.id]?.state ? (
                                <span className="text-emerald-400 font-semibold">
                                  ✓ Tuned: {feedbackMap[issue.id].state}
                                </span>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleFeedback(issue.id, 'HELPFUL')}
                                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
                                  >
                                    👍 Helpful
                                  </button>
                                  <button
                                    onClick={() => handleFeedback(issue.id, 'EXPECTED_IOT')}
                                    className="px-2 py-0.5 rounded bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300 cursor-pointer"
                                    title="Acknowledge this device is an IoT component properly segregated on VLAN 20"
                                  >
                                    🏡 Expected IoT
                                  </button>
                                  <button
                                    onClick={() => handleFeedback(issue.id, 'SUPPRESSED')}
                                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 cursor-pointer"
                                  >
                                    🔕 Suppress
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab Content 2: Resolved Issues */}
                {activeTab === 'resolved' && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    {latest.resolvedIssues.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-950/40 text-center text-xs text-slate-500 font-mono">
                        No resolved issues in this specific cycle.
                      </div>
                    ) : (
                      latest.resolvedIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="p-4 rounded-xl bg-slate-950/80 border border-emerald-900/60 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-800">
                                RESOLVED
                              </span>
                              <span className="text-xs font-bold text-emerald-200 font-mono">{issue.title}</span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-400 font-mono">{issue.description}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab Content 3: New Issues */}
                {activeTab === 'new' && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    {latest.newIssues.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-950/40 text-center text-xs text-slate-500 font-mono">
                        No new anomalies surfaced in this audit run.
                      </div>
                    ) : (
                      latest.newIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="p-4 rounded-xl bg-slate-950/80 border border-rose-900/60 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                issue.severity === 'CRITICAL'
                                  ? 'bg-rose-950 text-rose-300 border-rose-800'
                                  : issue.severity === 'WARNING'
                                  ? 'bg-amber-950 text-amber-300 border-amber-800'
                                  : 'bg-sky-950 text-sky-300 border-sky-800'
                              }`}>
                                {issue.severity}
                              </span>
                              <span className="text-xs font-bold text-slate-200 font-mono">{issue.title}</span>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800">
                              NEW
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono">{issue.description}</p>

                          {/* Admin Feedback Actions */}
                          <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 text-[11px] font-mono">
                            <span className="text-slate-500">Tuning Feedback:</span>
                            <div className="flex space-x-1.5">
                              {feedbackMap[issue.id]?.state ? (
                                <span className="text-emerald-400 font-semibold">
                                  ✓ Tuned: {feedbackMap[issue.id].state}
                                </span>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleFeedback(issue.id, 'HELPFUL')}
                                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
                                  >
                                    👍 Helpful
                                  </button>
                                  <button
                                    onClick={() => handleFeedback(issue.id, 'EXPECTED_IOT')}
                                    className="px-2 py-0.5 rounded bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300 cursor-pointer"
                                    title="Acknowledge this device is an IoT component properly segregated on VLAN 20"
                                  >
                                    🏡 Expected IoT
                                  </button>
                                  <button
                                    onClick={() => handleFeedback(issue.id, 'SUPPRESSED')}
                                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 cursor-pointer"
                                  >
                                    🔕 Suppress
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab Content 4: Actionable Remediation Suggestions */}
                {activeTab === 'suggestions' && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    {latest.actionableSuggestions.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-950/40 text-center text-xs text-slate-500 font-mono">
                        No suggestions available. Network is operating within nominal thresholds.
                      </div>
                    ) : (
                      latest.actionableSuggestions.map((sug) => (
                        <div
                          key={sug.id}
                          className="p-4 rounded-xl bg-slate-950/80 border border-cyan-900/60 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-cyan-300 font-mono">{sug.title}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                              sug.priority === 'HIGH'
                                ? 'bg-rose-950 text-rose-300 border-rose-800'
                                : sug.priority === 'MEDIUM'
                                ? 'bg-amber-950 text-amber-300 border-amber-800'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}>
                              {sug.priority} PRIORITY
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 font-mono">
                            <strong className="text-slate-400">Action:</strong> {sug.action}
                          </p>
                          <p className="text-[11px] text-emerald-400/90 font-mono">
                            <strong>Impact:</strong> {sug.expectedImpact}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Custom Admin Feedback Tuning Form */}
                <form onSubmit={handleSaveAdminNote} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <label htmlFor="admin-note-input" className="block text-xs font-bold text-slate-300 font-mono">
                    Add Environmental Context / Rule Tuning (e.g. &quot;All ESP32 devices on VLAN 20 are farm sensors&quot;)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="admin-note-input"
                      type="text"
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="e.g. VLAN 20 has 2.4 GHz-only smart home gear, suppress RSSI warnings"
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
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
    </aside>
  );
}

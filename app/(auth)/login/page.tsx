'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Matrix Digital Stream Animation Overlay
 */
function MatrixAuthOverlay({ stage }: { stage: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = '0123456789ABCDEF0101OMADANOCSECURETOKEN::><+=*/$#@';
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array.from({ length: columns }, () => Math.floor(Math.random() * -50));

    let animationFrameId: number;

    const render = () => {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#06b6d4'; // Cyan matrix glow
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Head of stream is brighter white/cyan
        if (Math.random() > 0.85) {
          ctx.fillStyle = '#a5f3fc';
        } else {
          ctx.fillStyle = '#0891b2';
        }

        ctx.fillText(text, x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    const handleResize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      data-testid="matrix-auth-overlay"
      className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-200"
    >
      <canvas ref={canvasRef} className="absolute inset-0 opacity-40" />

      {/* Cyber HUD Terminal */}
      <div className="relative z-10 w-11/12 max-w-md p-8 rounded-2xl bg-slate-900/90 border border-cyan-500/40 shadow-[0_0_50px_rgba(6,182,212,0.25)] backdrop-blur-2xl text-center font-mono">
        {/* Animated Cyber Radar Spinner */}
        <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-500/40 animate-[spin_6s_linear_infinite]" />
          {/* Middle pulsing ring */}
          <div className="absolute inset-2 rounded-full border border-cyan-400/60 animate-ping opacity-25" />
          {/* Inner fast spinner */}
          <div className="absolute inset-3 rounded-full border-2 border-transparent border-t-cyan-400 border-r-cyan-300 animate-[spin_1s_linear_infinite]" />
          {/* Center icon */}
          <div className="text-2xl animate-pulse">📡</div>
        </div>

        <h3 className="text-lg font-bold text-white tracking-widest uppercase mb-1 flex items-center justify-center space-x-2">
          <span>AUTHENTICATING</span>
          <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse" />
        </h3>
        <p className="text-xs text-cyan-400 font-semibold mb-4">OMADA NOC • ENCRYPTED GATEWAY</p>

        {/* Dynamic Matrix Console Log Stream */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 text-left text-[11px] text-slate-300 space-y-1.5 shadow-inner">
          <div className="flex items-center text-emerald-400 font-semibold">
            <span className="mr-2">✔</span> [TLS 1.3] HANDSHAKE ESTABLISHED
          </div>
          <div className="flex items-center text-cyan-300">
            <span className="mr-2">▶</span> {stage}
          </div>
          <div className="text-slate-500 text-[10px] truncate">
            KEY_HASH: 7a8f9c2e0b...4d1e8a93 / SESSION_CIPHER: AES-GCM-256
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center space-x-2 text-[11px] text-slate-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>Verifying cryptographic signature & role permissions...</span>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authStage, setAuthStage] = useState('VERIFYING CREDENTIALS...');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setAuthStage('VERIFYING ENCRYPTED CREDENTIALS & HASH...');

    const stageTimer1 = setTimeout(() => {
      setAuthStage('EVALUATING RBAC POLICIES & DEVICE MATRIX...');
    }, 900);

    const stageTimer2 = setTimeout(() => {
      setAuthStage('AUTHORIZING NOC CONTROLLER BRIDGE & MCP TOOLS...');
    }, 1800);

    const stageTimer3 = setTimeout(() => {
      setAuthStage('ACCESS GRANTED • INITIALIZING NOC TELEMETRY...');
    }, 2600);

    try {
      // 3000ms (3 seconds) delay for immersive, full Matrix authorization stream
      const minDelayPromise = new Promise((resolve) => setTimeout(resolve, 3000));

      const [res] = await Promise.all([
        fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password }),
        }),
        minDelayPromise,
      ]);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setAuthStage('ACCESS GRANTED • REDIRECTING TO DASHBOARD...');

      // Small 200ms buffer to show final access granted
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 200);
    } catch (err: unknown) {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      setLoading(false);
    }
  };

  // Only show development demo credentials helper when in non-production or explicitly enabled
  const isDevMode = process.env.NODE_ENV !== 'production';
  const showDevHelper = isDevMode && process.env.NEXT_PUBLIC_SHOW_DEV_CREDENTIALS !== 'false';
  const devDemoEmail = process.env.NEXT_PUBLIC_DEFAULT_ADMIN_EMAIL || 'admin@omadanoc.com';
  const devDemoPassword = process.env.NEXT_PUBLIC_DEFAULT_ADMIN_PASSWORD || 'AdminPass123!';

  const handleFillDemoAdmin = () => {
    setIdentifier(devDemoEmail);
    setPassword(devDemoPassword);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Full-screen Matrix Authorization Animation */}
      {loading && <MatrixAuthOverlay stage={authStage} />}

      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-cyan-600/10 to-blue-600/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex items-center justify-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <span className="text-xl">📡</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white font-mono">
            OMADA<span className="text-cyan-400">.NOC</span>
          </h1>
        </div>
        <h2 className="text-center text-sm font-medium text-slate-400">
          Network Operations Center • Secure Access Portal
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="bg-slate-900/90 py-8 px-6 shadow-2xl rounded-2xl border border-slate-800 backdrop-blur-xl sm:px-10">
          {reason === 'inactivity' && (
            <div className="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-2.5">
              <span className="text-base leading-none">⏱️</span>
              <div>
                <p className="font-semibold">Session Timeout</p>
                <p className="text-amber-300/80 mt-0.5">
                  You were automatically signed out after 15 minutes of inactivity for security.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2.5">
              <span className="text-base leading-none">⚠️</span>
              <div>
                <p className="font-semibold">Authentication Error</p>
                <p className="text-rose-300/80 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="identifier" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email or Username
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                value={identifier}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin@omadanoc.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/60 transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/60 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-lg shadow-cyan-500/20 text-sm font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              Sign In to Dashboard
            </button>
          </form>

          {/* Quick Demo Fill Helper (Visible only in Development) */}
          {showDevHelper && (
            <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
              <p className="text-[11px] text-slate-400 mb-2">Development Administrator Credentials:</p>
              <button
                type="button"
                onClick={handleFillDemoAdmin}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-cyan-700/50 transition-all cursor-pointer"
              >
                {devDemoEmail} • {devDemoPassword}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

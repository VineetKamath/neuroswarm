import React, { useState } from 'react';
import { ArrowRight, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DEMO_ACCOUNTS, Logo } from '../components/Shell';
import { Avatar, ErrorNote, Spinner, cx } from '../components/ui';

const ALGOS = [
  { k: 'Genetic Algorithm', d: 'evolves search ranking & task triage', c: '#7c6cf2' },
  { k: 'Particle Swarm', d: 'races the GA on ranking weights', c: '#22b8e0' },
  { k: 'Artificial Immune System', d: 'catches mistyped vital signs', c: '#f0527a' },
  { k: 'Binary GA', d: 'compresses embeddings 384 → ~140 dims', c: '#2fbf71' },
  { k: 'Ant Colony', d: 'routes each query to the right notes', c: '#f5a524' },
];

export function LoginPage() {
  const { login, sessionExpired } = useAuth();
  const [email, setEmail] = useState(DEMO_ACCOUNTS[1].email);
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e, acc) => {
    e?.preventDefault();
    setBusy(true); setError('');
    try {
      await login(acc?.email || email, acc ? 'password123' : password);
      window.location.hash = '#/dashboard';
    } catch (err) {
      setError(err.response?.data?.detail || 'Cannot reach the server. Is the backend running on port 8000?');
    } finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      {/* ---- story panel ---- */}
      <div className="relative hidden overflow-hidden bg-[#0b1222] p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: 'radial-gradient(600px 300px at 20% 10%, rgba(31,170,156,.35), transparent 60%), radial-gradient(500px 300px at 90% 90%, rgba(124,108,242,.3), transparent 60%)' }} />
        <div className="relative"><Logo dark /></div>
        <div className="relative mt-auto max-w-lg">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-200">
            <Sparkles className="h-3.5 w-3.5" /> Bio-Inspired Algorithms · Course Project
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Five decisions in a hospital,<br />made by algorithms <span className="text-brand-300">borrowed from nature.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Evolution, swarms, immune cells and ant colonies tune how NeuroSwarm searches patient notes,
            orders the nurse's queue, and catches data-entry errors, measured against hand-written baselines.
          </p>
          <div className="mt-8 space-y-2.5">
            {ALGOS.map((a) => (
              <div key={a.k} className="flex items-center gap-3 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.c, boxShadow: `0 0 12px ${a.c}` }} />
                <span className="font-semibold text-slate-100">{a.k}</span>
                <span className="text-slate-500">, {a.d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- sign-in ---- */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md anim-up">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Pick a demo account or enter credentials.</p>

          {sessionExpired && <div className="mt-4"><ErrorNote>Your session expired. Please sign in again.</ErrorNote></div>}

          <div className="mt-6 grid gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a.email} disabled={busy} onClick={(e) => submit(e, a)}
                className={cx('group flex items-center gap-3 rounded-2xl border bg-white px-3.5 py-3 text-left transition hover:border-brand-300 hover:shadow-md',
                  email === a.email ? 'border-brand-300' : 'border-slate-200')}>
                <Avatar name={a.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-800">{a.name}</div>
                  <div className="truncate text-xs text-slate-500">{a.title}</div>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{a.role}</span>
                <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
              </button>
            ))}
          </div>

          <div className="my-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-slate-400">
            <div className="h-px flex-1 bg-slate-200" /> or <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@neuroswarm.health" required />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-primary w-full py-2.5" disabled={busy}>
              {busy ? <Spinner /> : 'Sign in'}
            </button>
          </form>
          <p className="mt-6 flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" /> All demo accounts use the password <code className="font-mono">password123</code>
          </p>
        </div>
      </div>
    </div>
  );
}

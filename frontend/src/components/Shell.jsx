import React, { useState } from 'react';
import {
  LayoutDashboard, Users, ClipboardList, FlaskConical, ShieldCheck, LogOut, Menu, X, ChevronDown, Dna,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../lib/router';
import { Avatar, cx } from './ui';

export const DEMO_ACCOUNTS = [
  { role: 'ADMIN', email: 'admin@neuroswarm.health', name: 'Dr. Kavitha Raghunathan', title: 'Hospital Administrator' },
  { role: 'DOCTOR', email: 'dr.sharma@neuroswarm.health', name: 'Dr. Arvind Sharma', title: 'Cardiology & Critical Care' },
  { role: 'DOCTOR', email: 'dr.iyer@neuroswarm.health', name: 'Dr. Lakshmi Iyer', title: 'Internal Medicine & Pulmonology' },
  { role: 'NURSE', email: 'nurse.priya@neuroswarm.health', name: 'Priya Nair, RN', title: 'Cardiology Step-down' },
  { role: 'NURSE', email: 'nurse.arjun@neuroswarm.health', name: 'Arjun Hegde', title: 'Pulmonology & General Medicine' },
];

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'patients', label: 'Patients', icon: Users },
  { key: 'tasks', label: 'Care Tasks', icon: ClipboardList },
  { key: 'biolab', label: 'Bio-Lab', icon: FlaskConical, accent: true },
  { key: 'staff', label: 'Staff & System', icon: ShieldCheck, roles: ['ADMIN'] },
];

export const Logo = ({ dark = false }) => (
  <div className="flex items-center gap-2.5">
    <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-lg shadow-brand-900/20">
      <Dna className="h-5 w-5" />
    </div>
    <div className="leading-tight">
      <div className={cx('text-[15px] font-bold tracking-tight', dark ? 'text-white' : 'text-slate-900')}>NeuroSwarm</div>
      <div className={cx('text-[10px] font-medium', dark ? 'text-slate-400' : 'text-slate-500')}>Bio-inspired clinical intelligence</div>
    </div>
  </div>
);

function SidebarBody({ active, onNavigate }) {
  const { user, role, logout } = useAuth();
  return (
    <div className="flex h-full flex-col bg-[#0b1222] text-slate-300">
      <div className="px-5 pb-6 pt-5"><Logo dark /></div>
      <nav className="flex-1 space-y-1 px-3">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</div>
        {NAV.filter((n) => !n.roles || n.roles.includes(role)).map((n) => {
          const on = active === n.key;
          return (
            <button key={n.key} onClick={() => onNavigate(n.key)}
              className={cx('group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                on ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100')}>
              <n.icon className={cx('h-[18px] w-[18px]', on ? 'text-brand-300' : n.accent ? 'text-violet-300' : '')} />
              <span className="flex-1 text-left">{n.label}</span>
              {n.accent && <span className="rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-200">5 algos</span>}
            </button>
          );
        })}
      </nav>

      <div className="mx-3 mb-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Optimizers live</div>
        <div className="flex flex-wrap gap-1.5">
          {[['GA', '#7c6cf2'], ['PSO', '#22b8e0'], ['AIS', '#f0527a'], ['Bin-GA', '#2fbf71'], ['ACO', '#f5a524']].map(([k, c]) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />{k}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-white/5 px-4 py-4">
        <Avatar name={user?.full_name || ''} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-white">{user?.full_name}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">{role}</div>
        </div>
        <button onClick={logout} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white" title="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function RoleSwitcher() {
  const { user, login } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pick = async (acc) => {
    setBusy(true);
    try { await login(acc.email, 'password123'); navigate('dashboard'); } finally { setBusy(false); setOpen(false); }
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn btn-outline btn-sm">
        <span className="hidden sm:inline">Demo: switch user</span><span className="sm:hidden">Switch</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="card absolute right-0 z-40 mt-2 w-72 p-1.5 anim-pop">
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a.email} disabled={busy} onClick={() => pick(a)}
                className={cx('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-slate-50',
                  user?.email === a.email && 'bg-brand-50')}>
                <Avatar name={a.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-slate-800">{a.name}</div>
                  <div className="truncate text-[11px] text-slate-500">{a.title}</div>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{a.role}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Shell({ active, children, wide = false, routeKey }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const go = (key) => { setMobileOpen(false); navigate(key); };
  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">
        <SidebarBody active={active} onNavigate={go} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 anim-slide">
            <SidebarBody active={active} onNavigate={go} />
            <button className="absolute right-3 top-5 text-slate-400" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button className="btn btn-ghost btn-sm lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
            <div className="lg:hidden"><Logo /></div>
            <div className="hidden items-center gap-2 text-xs text-slate-500 lg:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Extractive retrieval · no language model in the loop
            </div>
          </div>
          <RoleSwitcher />
        </header>
        <main key={routeKey} className={cx('page-in mx-auto w-full flex-1 px-4 py-6 sm:px-6 lg:py-8', wide ? 'max-w-[1600px]' : 'max-w-[1320px]')}>
          {children}
        </main>
      </div>
    </div>
  );
}

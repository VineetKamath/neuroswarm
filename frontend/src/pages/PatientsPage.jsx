import React, { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus, LayoutGrid, List, HeartPulse, ClipboardList } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../lib/router';
import { PatientModal } from '../components/forms';
import { PageHeader, StatusBadge, Avatar, Skeleton, EmptyState, Tabs, ageFrom, cx } from '../components/ui';

const STATUSES = ['ALL', 'CRITICAL', 'ADMITTED', 'STABLE'];

function VitalsChips({ v }) {
  if (!v) return <span className="text-xs text-slate-400">No vitals yet</span>;
  const chip = (label, val, warn) => (
    <span className={cx('rounded-md px-1.5 py-0.5 font-mono text-[11px]', warn ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600')}>
      {label} {val}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-1">
      {chip('HR', v.heart_rate, v.heart_rate > 110 || v.heart_rate < 50)}
      {chip('BP', `${v.bp_systolic}/${v.bp_diastolic}`, v.bp_systolic > 170 || v.bp_systolic < 95)}
      {chip('SpO₂', v.o2_saturation, v.o2_saturation < 92)}
      {chip('T', v.temp_celsius, v.temp_celsius >= 38)}
    </div>
  );
}

export function PatientsPage() {
  const { role } = useAuth();
  const [patients, setPatients] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const [ward, setWard] = useState('ALL');
  const [view, setView] = useState('grid');
  const [adding, setAdding] = useState(false);

  const load = () => api.get('/patients').then((r) => setPatients(r.data)).catch(() => setPatients([]));
  useEffect(() => { load(); }, []);

  const wards = useMemo(() => ['ALL', ...new Set((patients || []).map((p) => p.ward).filter(Boolean))], [patients]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (patients || [])
      .filter((p) => status === 'ALL' || p.status === status)
      .filter((p) => ward === 'ALL' || p.ward === ward)
      .filter((p) => !s || `${p.first_name} ${p.last_name} ${p.mrn} ${p.primary_diagnosis}`.toLowerCase().includes(s))
      .sort((a, b) => (a.status === 'CRITICAL' ? -1 : 0) - (b.status === 'CRITICAL' ? -1 : 0));
  }, [patients, q, status, ward]);

  const counts = useMemo(() => {
    const c = { ALL: patients?.length || 0 };
    (patients || []).forEach((p) => { c[p.status] = (c[p.status] || 0) + 1; });
    return c;
  }, [patients]);

  return (
    <div className="anim-up">
      <PageHeader eyebrow="Census" title="Patients"
        subtitle="Every chart has a retrieval assistant that answers only from that patient's own record."
        actions={role !== 'NURSE' && <button className="btn btn-primary" onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" />Admit patient</button>} />

      <div className="card mb-5 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input border-transparent bg-slate-50 pl-9" placeholder="Search name, MRN or diagnosis…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Tabs value={status} onChange={setStatus} tabs={STATUSES.map((s) => ({ value: s, label: s === 'ALL' ? 'All' : s[0] + s.slice(1).toLowerCase(), count: counts[s] || 0 }))} />
        <select className="input w-auto" value={ward} onChange={(e) => setWard(e.target.value)}>
          {wards.map((w) => <option key={w} value={w}>{w === 'ALL' ? 'All wards' : w}</option>)}
        </select>
        <div className="flex rounded-xl bg-slate-100 p-1">
          {[['grid', LayoutGrid], ['list', List]].map(([v, I]) => (
            <button key={v} onClick={() => setView(v)} className={cx('rounded-lg p-1.5', view === v ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400')}><I className="h-4 w-4" /></button>
          ))}
        </div>
      </div>

      {patients === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card"><EmptyState title="No patients match" hint="Try clearing the filters." /></div>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <button key={p.id} onClick={() => navigate(`patients/${p.id}`)}
              className={cx('card group flex flex-col gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg',
                p.status === 'CRITICAL' && 'ring-1 ring-rose-200')}>
              <div className="flex items-start gap-3">
                <Avatar name={`${p.first_name} ${p.last_name}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-900 group-hover:text-brand-700">{p.first_name} {p.last_name}</div>
                  <div className="text-xs text-slate-500">{ageFrom(p.date_of_birth)}y · {p.gender} · <span className="font-mono">{p.mrn}</span></div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="line-clamp-2 min-h-[2.5rem] text-xs text-slate-600">{p.primary_diagnosis}</div>
              <VitalsChips v={p.latest_vitals} />
              <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
                <span>{p.ward} · Room {p.room_number || '-'}</span>
                <span className="inline-flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" />{p.pending_tasks_count} open</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
              <tr><th className="px-4 py-3 font-semibold">Patient</th><th className="px-4 py-3 font-semibold">Diagnosis</th><th className="px-4 py-3 font-semibold">Ward</th><th className="px-4 py-3 font-semibold"><HeartPulse className="inline h-3.5 w-3.5" /> Latest vitals</th><th className="px-4 py-3 font-semibold">Tasks</th><th className="px-4 py-3 font-semibold">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <tr key={p.id} onClick={() => navigate(`patients/${p.id}`)} className="cursor-pointer hover:bg-slate-50/70">
                  <td className="px-4 py-3"><div className="flex items-center gap-2.5"><Avatar name={`${p.first_name} ${p.last_name}`} size="sm" /><div><div className="font-semibold text-slate-800">{p.first_name} {p.last_name}</div><div className="font-mono text-[11px] text-slate-400">{p.mrn}</div></div></div></td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-600">{p.primary_diagnosis}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{p.ward}<div className="text-slate-400">Room {p.room_number}</div></td>
                  <td className="px-4 py-3"><VitalsChips v={p.latest_vitals} /></td>
                  <td className="px-4 py-3 font-mono text-xs">{p.pending_tasks_count}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PatientModal open={adding} onClose={() => setAdding(false)} onSaved={(p) => { load(); if (p?.id) navigate(`patients/${p.id}`); }} />
    </div>
  );
}

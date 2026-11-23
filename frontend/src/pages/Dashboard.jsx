import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, AlertTriangle, ClipboardList, ShieldAlert, ArrowRight, Activity, Dna, CheckCircle2, Play, Clock,
} from 'lucide-react';
import api from '../api/axios';
import { bioApi } from '../api/bio';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../lib/router';
import {
  PageHeader, StatCard, StatusBadge, PriorityBadge, Badge, EmptyState, Skeleton, Avatar, fmtRelative, ageFrom, cx,
} from '../components/ui';

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

function Panel({ title, subtitle, action, children, className }) {
  return (
    <section className={cx('card overflow-hidden', className)}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function TaskQueue({ tasks, onUpdate, compact }) {
  if (!tasks.length) return <EmptyState icon={CheckCircle2} title="Queue is clear" hint="No open care tasks." />;
  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((t, i) => {
        const overdue = t.overdue_hours > 0;
        return (
          <li key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/60">
            <div className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
              i === 0 ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500')}>{i + 1}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold text-slate-800">{t.title}</span>
                <PriorityBadge priority={t.priority} />
                {overdue && <Badge tone="rose"><Clock className="h-3 w-3" />overdue {Math.round(t.overdue_hours)}h</Badge>}
              </div>
              <button onClick={() => navigate(`patients/${t.patient_id}`)} className="mt-0.5 truncate text-xs text-slate-500 hover:text-brand-700">
                {t.patient_name} · {t.patient_room || '-'}{!compact && t.assigned_nurse_name ? ` · ${t.assigned_nurse_name}` : ''}
              </button>
            </div>
            {t.urgency_score != null && (
              <div className="hidden text-right sm:block">
                <div className="font-mono text-xs font-semibold text-violet-700">{t.urgency_score.toFixed(3)}</div>
                <div className="text-[10px] text-slate-400">GA urgency</div>
              </div>
            )}
            {onUpdate && (
              t.status === 'PENDING'
                ? <button className="btn btn-outline btn-sm" onClick={() => onUpdate(t.id, 'IN_PROGRESS')}><Play className="h-3 w-3" />Start</button>
                : <button className="btn btn-primary btn-sm" onClick={() => onUpdate(t.id, 'COMPLETED')}><CheckCircle2 className="h-3 w-3" />Done</button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AlertList({ findings }) {
  if (!findings) return <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>;
  if (!findings.length) return <EmptyState icon={ShieldAlert} title="No suspicious readings" hint="Every recent vital passed the immune checkpoint." />;
  return (
    <ul className="divide-y divide-slate-100">
      {findings.slice(0, 6).map((f) => (
        <li key={f.vital_id} className="flex items-start gap-3 px-5 py-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600"><ShieldAlert className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <button onClick={() => navigate(`patients/${f.patient_id}`)} className="text-sm font-semibold text-slate-800 hover:text-brand-700">{f.patient_name}</button>
            <div className="line-clamp-2 text-xs text-slate-500">{f.explanation}</div>
          </div>
          <span className="font-mono text-[11px] text-slate-400">{fmtRelative(f.recorded_at)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Dashboard() {
  const { user, role } = useAuth();
  const [patients, setPatients] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [status, setStatus] = useState(null);

  const load = () => {
    api.get('/patients').then((r) => setPatients(r.data)).catch(() => setPatients([]));
    api.get('/tasks').then((r) => setTasks(r.data)).catch(() => setTasks([]));
    bioApi.anomalies(12).then((d) => setAlerts(d.findings || [])).catch(() => setAlerts([]));
    bioApi.status().then(setStatus).catch(() => setStatus(null));
  };
  useEffect(load, []);

  const open = useMemo(() => (tasks || []).filter((t) => ['PENDING', 'IN_PROGRESS'].includes(t.status)), [tasks]);
  const mine = useMemo(() => (role === 'NURSE' ? open.filter((t) => t.assigned_nurse_id === user?.id) : open), [open, role, user]);
  const critical = (patients || []).filter((p) => p.status === 'CRITICAL');
  const overdue = open.filter((t) => t.overdue_hours > 0);

  const wards = useMemo(() => {
    const m = {};
    (patients || []).forEach((p) => { m[p.ward || 'General'] = (m[p.ward || 'General'] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [patients]);
  const maxWard = Math.max(1, ...wards.map(([, n]) => n));

  const updateTask = async (id, s) => {
    await api.patch(`/tasks/${id}/status`, { status: s });
    api.get('/tasks').then((r) => setTasks(r.data));
  };

  const firstName = (user?.full_name || '').replace(/^Dr\.\s*/, '').split(/[ ,]/)[0];
  const algos = status?.algorithms ? Object.values(status.algorithms) : [];
  const loading = patients === null || tasks === null;

  return (
    <div className="anim-up">
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${greet()}, ${role === 'DOCTOR' ? 'Dr. ' : ''}${firstName}`}
        subtitle={role === 'NURSE'
          ? 'Your queue is ordered by a Genetic-Algorithm policy that learned how charge nurses triage.'
          : 'Ward overview, searches, task order and vital-sign checks are tuned by bio-inspired optimizers.'}
        actions={<button className="btn btn-dark" onClick={() => navigate('biolab')}><Dna className="h-4 w-4" />Open Bio-Lab</button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Patients on census" value={patients?.length ?? '-'} hint={`${wards.length} wards`} icon={Users} loading={loading} />
        <StatCard label="Critical" value={critical.length} hint="Need closest watch" icon={AlertTriangle} tone="rose" loading={loading} />
        <StatCard label={role === 'NURSE' ? 'My open tasks' : 'Open care tasks'} value={mine.length} hint={`${overdue.length} overdue across ward`} icon={ClipboardList} tone="violet" loading={loading} />
        <StatCard label="Immune-system flags" value={alerts?.length ?? '-'} hint="Suspicious vitals entries" icon={ShieldAlert} tone="amber" loading={alerts === null} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <Panel
          title={role === 'NURSE' ? 'My task queue' : 'Ward task queue'}
          subtitle="Ordered by the GA triage policy, not just by due time"
          action={<button className="btn btn-ghost btn-sm" onClick={() => navigate('tasks')}>All tasks <ArrowRight className="h-3.5 w-3.5" /></button>}
        >
          {loading ? <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            : <TaskQueue tasks={mine.slice(0, 7)} onUpdate={role === 'NURSE' ? updateTask : null} compact={role === 'NURSE'} />}
        </Panel>

        <Panel title="Data-entry alerts" subtitle="Vitals the immune system thinks are typos">
          <AlertList findings={alerts} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <Panel title="Critical patients" subtitle="Tap a patient to open the chart and the retrieval assistant"
          action={<button className="btn btn-ghost btn-sm" onClick={() => navigate('patients')}>All patients <ArrowRight className="h-3.5 w-3.5" /></button>}>
          {loading ? <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div> : critical.length === 0
            ? <EmptyState icon={Activity} title="No critical patients" /> : (
              <ul className="divide-y divide-slate-100">
                {critical.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <button onClick={() => navigate(`patients/${p.id}`)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50/60">
                      <Avatar name={`${p.first_name} ${p.last_name}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-800">{p.first_name} {p.last_name}
                          <span className="ml-2 text-xs font-normal text-slate-400">{ageFrom(p.date_of_birth)}y · {p.gender?.[0]}</span></div>
                        <div className="truncate text-xs text-slate-500">{p.primary_diagnosis}</div>
                      </div>
                      {p.latest_vitals && (
                        <div className="hidden gap-4 text-right font-mono text-xs text-slate-600 md:flex">
                          <span>HR {p.latest_vitals.heart_rate}</span>
                          <span>BP {p.latest_vitals.bp_systolic}/{p.latest_vitals.bp_diastolic}</span>
                          <span>SpO₂ {p.latest_vitals.o2_saturation}</span>
                        </div>
                      )}
                      <StatusBadge status={p.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Census by ward">
            <div className="space-y-2.5 p-5">
              {wards.map(([w, n]) => (
                <div key={w} className="flex items-center gap-3 text-xs">
                  <span className="w-32 shrink-0 truncate font-medium text-slate-600">{w}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(n / maxWard) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right font-mono text-slate-500">{n}</span>
                </div>
              ))}
              {!wards.length && <Skeleton className="h-24" />}
            </div>
          </Panel>
          <Panel title="Optimizers serving traffic">
            <ul className="divide-y divide-slate-100">
              {algos.map((a) => (
                <li key={a.name} className="flex items-center justify-between gap-3 px-5 py-2.5 text-xs">
                  <div>
                    <div className="font-semibold text-slate-700">{a.name}</div>
                    <div className="text-slate-400">{a.family}</div>
                  </div>
                  <Badge tone={a.active ? 'emerald' : 'slate'}>{a.active ? 'live' : 'baseline'}</Badge>
                </li>
              ))}
              {!algos.length && <li className="p-5"><Skeleton className="h-20" /></li>}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

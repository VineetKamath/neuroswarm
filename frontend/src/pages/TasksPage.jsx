import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Play, Clock, Dna, ArrowRight, ListOrdered } from 'lucide-react';
import api from '../api/axios';
import { bioApi } from '../api/bio';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../lib/router';
import { PageHeader, PriorityBadge, TaskStatusBadge, Badge, Tabs, Skeleton, EmptyState, fmtDateTime, cx } from '../components/ui';

function CompareColumn({ title, subtitle, rows, tone, other }) {
  const otherIdx = Object.fromEntries((other || []).map((r, i) => [r.task_id, i]));
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-baseline justify-between">
        <div className={cx('text-xs font-bold', tone === 'ga' ? 'text-violet-700' : 'text-slate-500')}>{title}</div>
        <div className="text-[10px] text-slate-400">{subtitle}</div>
      </div>
      <ol className="space-y-1.5">
        {rows.map((r, i) => {
          const moved = otherIdx[r.task_id] != null ? otherIdx[r.task_id] - i : null;
          return (
            <li key={r.task_id} className={cx('flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs',
              tone === 'ga' ? 'border-violet-100 bg-violet-50/40' : 'border-slate-100 bg-slate-50/60')}>
              <span className="w-4 font-mono text-slate-400">{i + 1}</span>
              <PriorityBadge priority={r.priority} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-slate-700">{r.title}</div>
                <div className="truncate text-[10px] text-slate-400">{r.patient_name} · acuity {r.acuity}{r.overdue_hours > 0 ? ` · overdue ${r.overdue_hours}h` : ''}</div>
              </div>
              {tone === 'ga' && moved != null && moved !== 0 && (
                <span className={cx('font-mono text-[10px] font-bold', moved > 0 ? 'text-emerald-600' : 'text-rose-500')}>{moved > 0 ? `▲${moved}` : `▼${-moved}`}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function TasksPage() {
  const { role, user } = useAuth();
  const [tasks, setTasks] = useState(null);
  const [filter, setFilter] = useState('open');
  const [scope, setScope] = useState(role === 'NURSE' ? 'mine' : 'all');
  const [cmp, setCmp] = useState(null);

  const load = () => api.get('/tasks').then((r) => setTasks(r.data)).catch(() => setTasks([]));
  useEffect(() => { load(); bioApi.taskRanking(8).then(setCmp).catch(() => setCmp(null)); }, []);

  const shown = useMemo(() => (tasks || [])
    .filter((t) => (filter === 'open' ? ['PENDING', 'IN_PROGRESS'].includes(t.status) : filter === 'done' ? t.status === 'COMPLETED' : true))
    .filter((t) => scope === 'all' || t.assigned_nurse_id === user?.id), [tasks, filter, scope, user]);

  const update = async (id, status) => { await api.patch(`/tasks/${id}/status`, { status }); load(); };

  return (
    <div className="anim-up">
      <PageHeader eyebrow="Nursing" title="Care tasks"
        subtitle="Open tasks are ordered by a GA policy that looks at priority, how sick the patient is, how overdue the task is, and what kind of task it is." />

      {cmp?.baseline?.length > 0 && (
        <div className="card mb-6 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700"><ListOrdered className="h-4 w-4" /></div>
              <div>
                <div className="text-sm font-bold text-slate-900">Same ward, two orderings</div>
                <div className="text-xs text-slate-500">Old SQL sort vs the evolved triage policy, top 8 of {cmp.total_open_tasks} open tasks</div>
              </div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('biolab/ga')}><Dna className="h-3.5 w-3.5" />How the GA learned this <ArrowRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row">
            <CompareColumn title="Baseline" subtitle="ORDER BY due_time, priority" rows={cmp.baseline} />
            <CompareColumn title="Genetic Algorithm" subtitle="▲▼ = places moved vs baseline" rows={cmp.optimized} tone="ga" other={cmp.baseline} />
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <Tabs value={filter} onChange={setFilter} tabs={[{ value: 'open', label: 'Open' }, { value: 'done', label: 'Completed' }, { value: 'all', label: 'All' }]} />
          {role === 'NURSE' && <Tabs value={scope} onChange={setScope} tabs={[{ value: 'mine', label: 'Assigned to me' }, { value: 'all', label: 'Whole ward' }]} />}
        </div>
        {tasks === null ? <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          : shown.length === 0 ? <EmptyState icon={CheckCircle2} title="Nothing here" /> : (
            <ul className="divide-y divide-slate-100">
              {shown.map((t, i) => (
                <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className={cx('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold',
                      filter === 'open' && i < 3 ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500')}>{i + 1}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cx('text-sm font-semibold', t.status === 'COMPLETED' ? 'text-slate-400 line-through' : 'text-slate-800')}>{t.title}</span>
                        <PriorityBadge priority={t.priority} />
                        {t.task_category && <Badge tone="slate">{t.task_category}</Badge>}
                        {t.overdue_hours > 0 && t.status !== 'COMPLETED' && <Badge tone="rose"><Clock className="h-3 w-3" />{Math.round(t.overdue_hours)}h overdue</Badge>}
                      </div>
                      <button onClick={() => navigate(`patients/${t.patient_id}`)} className="text-xs text-slate-500 hover:text-brand-700">
                        {t.patient_name} · {t.patient_room} · due {fmtDateTime(t.due_time)} · {t.assigned_nurse_name || 'Floor pool'}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-9 sm:pl-0">
                    {t.urgency_score != null && t.status !== 'COMPLETED' && (
                      <div className="w-20">
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, t.urgency_score * 100)}%` }} /></div>
                        <div className="mt-0.5 font-mono text-[10px] text-slate-400">urgency {t.urgency_score.toFixed(2)}</div>
                      </div>
                    )}
                    <TaskStatusBadge status={t.status} />
                    {t.status === 'PENDING' && <button className="btn btn-outline btn-sm" onClick={() => update(t.id, 'IN_PROGRESS')}><Play className="h-3 w-3" />Start</button>}
                    {t.status === 'IN_PROGRESS' && <button className="btn btn-primary btn-sm" onClick={() => update(t.id, 'COMPLETED')}><CheckCircle2 className="h-3 w-3" />Complete</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
      </div>
    </div>
  );
}

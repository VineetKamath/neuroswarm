import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, AlertTriangle, FileText, HeartPulse, ClipboardList, Plus, Phone, Droplet, BedDouble, CalendarDays, ShieldAlert,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { navigate } from '../lib/router';
import { Assistant } from '../components/Assistant';
import { NoteModal, VitalsModal, TaskModal } from '../components/forms';
import {
  Avatar, Badge, EmptyState, PriorityBadge, Skeleton, Sparkline, StatusBadge, TaskStatusBadge, Tabs, ageFrom, fmtDateTime, fmtRelative, cx,
} from '../components/ui';

const VITALS = [
  { k: 'heart_rate', label: 'Heart rate', unit: 'bpm', color: '#f0527a', bad: (v) => v > 110 || v < 50 },
  { k: 'bp_systolic', label: 'Systolic BP', unit: 'mmHg', color: '#7c6cf2', bad: (v) => v > 170 || v < 95, extra: (r) => `/${r.bp_diastolic}` },
  { k: 'o2_saturation', label: 'SpO₂', unit: '%', color: '#22b8e0', bad: (v) => v < 92 },
  { k: 'temp_celsius', label: 'Temperature', unit: '°C', color: '#f5a524', bad: (v) => v >= 38 },
  { k: 'resp_rate', label: 'Resp. rate', unit: '/min', color: '#2fbf71', bad: (v) => v > 24 },
  { k: 'blood_glucose', label: 'Glucose', unit: 'mg/dL', color: '#64748b', bad: (v) => v > 250 || v < 70 },
];

const SOAP = [['chief_complaint', 'Chief complaint'], ['subjective', 'Subjective'], ['objective', 'Objective'], ['assessment', 'Assessment'], ['plan', 'Plan']];

function NoteCard({ note }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative pl-6">
      <div className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500 ring-2 ring-brand-100" />
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <button onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center gap-2 text-left">
          <Badge tone="brand">{note.note_type}</Badge>
          <span className="text-sm font-semibold text-slate-800">{note.title}</span>
          <span className="ml-auto text-[11px] text-slate-400">{fmtDateTime(note.created_at)} · {note.author_name}</span>
        </button>
        {!open && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{note.assessment || note.content}</p>}
        {open && (
          <div className="mt-3 grid gap-2.5 anim-in md:grid-cols-2">
            {SOAP.filter(([k]) => note[k]).map(([k, label]) => (
              <div key={k} className={cx('rounded-xl bg-slate-50 p-3', (k === 'chief_complaint') && 'md:col-span-2')}>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{note[k]}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function PatientDetailPage({ patientId }) {
  const { role } = useAuth();
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('notes');
  const [modal, setModal] = useState(null);

  const load = () => api.get(`/patients/${patientId}`).then((r) => setP(r.data)).catch(() => setError('Patient not found.'));
  useEffect(() => { setP(null); load(); }, [patientId]); // eslint-disable-line

  const series = useMemo(() => [...(p?.vital_signs || [])].reverse(), [p]);
  const latest = p?.vital_signs?.[0];
  const openTasks = (p?.care_tasks || []).filter((t) => ['PENDING', 'IN_PROGRESS'].includes(t.status));

  if (error) return <div className="card"><EmptyState title={error} action={<button className="btn btn-outline btn-sm" onClick={() => navigate('patients')}>Back</button>} /></div>;
  if (!p) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;

  const name = `${p.first_name} ${p.last_name}`;
  const noAllergy = !p.allergies || /no known/i.test(p.allergies);

  return (
    <div className="anim-up">
      <button onClick={() => navigate('patients')} className="btn btn-ghost btn-sm -ml-2 mb-3"><ArrowLeft className="h-4 w-4" />Patients</button>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-6">
          {/* header */}
          <div className="card overflow-hidden">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
              <Avatar name={name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">{name}</h1>
                  <StatusBadge status={p.status} />
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">{p.mrn}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>{ageFrom(p.date_of_birth)} yrs · {p.gender}</span>
                  <span className="inline-flex items-center gap-1"><Droplet className="h-3.5 w-3.5" />{p.blood_group || '-'}</span>
                  <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{p.ward} · {p.room_number}</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />Admitted {fmtRelative(p.admission_date)}</span>
                </div>
                <p className="mt-3 text-sm font-medium text-slate-800">{p.primary_diagnosis}</p>
                {p.medical_history && <p className="mt-1 text-xs text-slate-500">{p.medical_history}</p>}
              </div>
            </div>
            <div className="grid border-t border-slate-100 sm:grid-cols-2">
              <div className={cx('flex items-start gap-2.5 px-5 py-3', noAllergy ? 'bg-slate-50/60' : 'bg-rose-50/70')}>
                <AlertTriangle className={cx('mt-0.5 h-4 w-4 shrink-0', noAllergy ? 'text-slate-400' : 'text-rose-600')} />
                <div>
                  <div className={cx('text-[10px] font-bold uppercase tracking-wider', noAllergy ? 'text-slate-400' : 'text-rose-500')}>Allergies</div>
                  <div className={cx('text-xs font-semibold', noAllergy ? 'text-slate-600' : 'text-rose-800')}>{p.allergies || 'None recorded'}</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 border-t border-slate-100 px-5 py-3 sm:border-l sm:border-t-0">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Emergency contact</div>
                  <div className="text-xs font-semibold text-slate-700">{p.emergency_contact || '-'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* vitals strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
            {VITALS.map((v) => {
              const val = latest?.[v.k];
              const bad = val != null && v.bad(val);
              return (
                <div key={v.k} className={cx('card p-3', bad && 'ring-1 ring-rose-200')}>
                  <div className="text-[11px] font-medium text-slate-500">{v.label}</div>
                  <div className="mt-0.5 flex items-baseline gap-1">
                    <span className={cx('text-lg font-bold', bad ? 'text-rose-600' : 'text-slate-900')}>{val ?? '-'}{val != null && v.extra ? v.extra(latest) : ''}</span>
                    <span className="text-[10px] text-slate-400">{v.unit}</span>
                  </div>
                  <div className="mt-1"><Sparkline values={series.map((r) => r[v.k])} color={v.color} width={140} height={28} /></div>
                </div>
              );
            })}
          </div>

          {/* tabs */}
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <Tabs value={tab} onChange={setTab} tabs={[
                { value: 'notes', label: 'Notes', icon: FileText, count: p.clinical_notes.length },
                { value: 'vitals', label: 'Vitals', icon: HeartPulse, count: p.vital_signs.length },
                { value: 'tasks', label: 'Tasks', icon: ClipboardList, count: openTasks.length },
              ]} />
              <div className="flex gap-2">
                {tab === 'notes' && role !== 'ADMIN' && <button className="btn btn-primary btn-sm" onClick={() => setModal('note')}><Plus className="h-3.5 w-3.5" />Note</button>}
                {tab === 'vitals' && <button className="btn btn-primary btn-sm" onClick={() => setModal('vitals')}><Plus className="h-3.5 w-3.5" />Record vitals</button>}
                {tab === 'tasks' && role !== 'NURSE' && <button className="btn btn-primary btn-sm" onClick={() => setModal('task')}><Plus className="h-3.5 w-3.5" />Assign task</button>}
              </div>
            </div>

            <div className="p-4">
              {tab === 'notes' && (p.clinical_notes.length ? (
                <div className="relative space-y-3 before:absolute before:bottom-2 before:left-[4px] before:top-2 before:w-px before:bg-slate-200">
                  {p.clinical_notes.map((n) => <NoteCard key={n.id} note={n} />)}
                </div>
              ) : <EmptyState icon={FileText} title="No notes yet" />)}

              {tab === 'vitals' && (p.vital_signs.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-slate-400">
                      <tr>{['Recorded', 'HR', 'BP', 'RR', 'Temp', 'SpO₂', 'Glucose', 'Note'].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {p.vital_signs.map((v) => {
                        const qa = (v.notes || '').startsWith('[QA]');
                        return (
                          <tr key={v.id} className={qa ? 'bg-rose-50/60' : ''}>
                            <td className="px-3 py-2 font-sans text-slate-500">{fmtDateTime(v.recorded_at)}</td>
                            <td className="px-3 py-2">{v.heart_rate}</td>
                            <td className="px-3 py-2">{v.bp_systolic}/{v.bp_diastolic}</td>
                            <td className="px-3 py-2">{v.resp_rate}</td>
                            <td className="px-3 py-2">{v.temp_celsius}</td>
                            <td className="px-3 py-2">{v.o2_saturation}</td>
                            <td className="px-3 py-2">{v.blood_glucose}</td>
                            <td className="max-w-[220px] truncate px-3 py-2 font-sans text-slate-500" title={v.notes}>
                              {qa && <ShieldAlert className="mr-1 inline h-3.5 w-3.5 text-rose-500" />}{v.notes?.replace('[QA] ', '')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState icon={HeartPulse} title="No vitals yet" />)}

              {tab === 'tasks' && (p.care_tasks.length ? (
                <ul className="divide-y divide-slate-100">
                  {p.care_tasks.map((t) => (
                    <li key={t.id} className="flex items-start gap-3 py-3">
                      <PriorityBadge priority={t.priority} />
                      <div className="min-w-0 flex-1">
                        <div className={cx('text-sm font-semibold', t.status === 'COMPLETED' ? 'text-slate-400 line-through' : 'text-slate-800')}>{t.title}</div>
                        {t.description && <div className="text-xs text-slate-500">{t.description}</div>}
                        <div className="mt-1 text-[11px] text-slate-400">Due {fmtDateTime(t.due_time)} · {t.assigned_nurse_name || 'Floor pool'}</div>
                      </div>
                      <TaskStatusBadge status={t.status} />
                    </li>
                  ))}
                </ul>
              ) : <EmptyState icon={ClipboardList} title="No tasks" />)}
            </div>
          </div>
        </div>

        <Assistant patient={p} className="h-[calc(100vh-8rem)] min-h-[560px] xl:sticky xl:top-20" />
      </div>

      <NoteModal open={modal === 'note'} onClose={() => setModal(null)} patient={p} onSaved={load} />
      <VitalsModal open={modal === 'vitals'} onClose={() => setModal(null)} patient={p} onSaved={load} />
      <TaskModal open={modal === 'task'} onClose={() => setModal(null)} patient={p} onSaved={load} />
    </div>
  );
}

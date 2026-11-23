import React, { useEffect, useRef, useState } from 'react';
import { FileText, HeartPulse, ClipboardPlus, UserPlus, ShieldAlert, ShieldCheck, UserCog } from 'lucide-react';
import api from '../api/axios';
import { Modal, Field, ErrorNote, Spinner, cx } from './ui';

const useForm = (initial) => {
  const [form, setForm] = useState(initial);
  const bind = (name) => ({ name, value: form[name] ?? '', onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });
  return [form, setForm, bind];
};

const errText = (err, fallback) => {
  const d = err?.response?.data?.detail;
  if (Array.isArray(d)) return d.map((x) => x.msg).join('; ');
  return d || fallback;
};

function Footer({ onClose, busy, label, form }) {
  return (
    <>
      <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
      <button type="submit" form={form} className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : label}</button>
    </>
  );
}

/* ------------------------------------------------------------- note ---- */
export function NoteModal({ open, onClose, patient, onSaved }) {
  const empty = { title: '', note_type: 'PROGRESS', chief_complaint: '', subjective: '', objective: '', assessment: '', plan: '' };
  const [form, setForm, bind] = useForm(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setForm(empty); setError(''); } }, [open]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    const content = [['Chief complaint', form.chief_complaint], ['Subjective', form.subjective], ['Objective', form.objective],
      ['Assessment', form.assessment], ['Plan', form.plan]].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n\n');
    try {
      await api.post('/notes', {
        patient_id: patient.id, title: form.title, note_type: form.note_type,
        chief_complaint: form.chief_complaint || null, subjective: form.subjective || null,
        objective: form.objective || null, assessment: form.assessment || null, plan: form.plan || null,
        content: content || form.title,
      });
      onSaved?.(); onClose();
    } catch (err) { setError(errText(err, 'Could not save the note.')); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} icon={FileText} size="lg" title="New clinical note"
      subtitle={`${patient?.first_name} ${patient?.last_name} · indexed per SOAP section for retrieval`}
      footer={<Footer onClose={onClose} busy={busy} label="Save note" form="note-form" />}>
      <form id="note-form" onSubmit={submit} className="space-y-4">
        <ErrorNote>{error}</ErrorNote>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Title" className="sm:col-span-2"><input className="input" required {...bind('title')} placeholder="e.g. Day 3 progress review" /></Field>
          <Field label="Note type">
            <select className="input" {...bind('note_type')}>
              {['PROGRESS', 'SOAP', 'ADMISSION', 'CONSULT', 'PROCEDURE', 'DISCHARGE'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Chief complaint"><input className="input" {...bind('chief_complaint')} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subjective"><textarea rows={3} className="input" {...bind('subjective')} placeholder="What the patient reports" /></Field>
          <Field label="Objective"><textarea rows={3} className="input" {...bind('objective')} placeholder="Vitals, exam, labs, imaging" /></Field>
          <Field label="Assessment"><textarea rows={3} className="input" {...bind('assessment')} placeholder="Diagnosis / impression" /></Field>
          <Field label="Plan"><textarea rows={3} className="input" {...bind('plan')} placeholder="Medications, orders, follow-up" /></Field>
        </div>
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------- vitals ---- */
const VITAL_FIELDS = [
  ['heart_rate', 'Heart rate', 'bpm', '78'], ['bp_systolic', 'Systolic BP', 'mmHg', '122'],
  ['bp_diastolic', 'Diastolic BP', 'mmHg', '78'], ['resp_rate', 'Resp. rate', '/min', '16'],
  ['temp_celsius', 'Temperature', '°C', '36.8'], ['o2_saturation', 'SpO₂', '%', '97'],
  ['blood_glucose', 'Glucose', 'mg/dL', '110'],
];

export function VitalsModal({ open, onClose, patient, onSaved }) {
  const [form, setForm, bind] = useForm({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [verdict, setVerdict] = useState(null);
  useEffect(() => { if (open) { setForm({}); setError(''); setVerdict(null); } }, [open]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    const payload = { patient_id: patient.id, notes: form.notes || null };
    VITAL_FIELDS.forEach(([k]) => { if (form[k] !== undefined && form[k] !== '') payload[k] = Number(form[k]); });
    try {
      const res = await api.post('/vitals', payload);
      onSaved?.();
      setVerdict(res.data.anomaly || { is_anomalous: false });
    } catch (err) { setError(errText(err, 'Could not record vitals.')); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} icon={HeartPulse} title="Record vital signs"
      subtitle="Every set passes the Artificial Immune System checkpoint on intake"
      footer={verdict ? <button className="btn btn-primary" onClick={onClose}>Done</button>
        : <Footer onClose={onClose} busy={busy} label="Record & check" form="vitals-form" />}>
      {verdict ? (
        <div className={cx('rounded-2xl border p-4 anim-pop', verdict.is_anomalous ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50')}>
          <div className="flex items-center gap-2 text-sm font-bold">
            {verdict.is_anomalous ? <ShieldAlert className="h-5 w-5 text-rose-600" /> : <ShieldCheck className="h-5 w-5 text-emerald-600" />}
            <span className={verdict.is_anomalous ? 'text-rose-800' : 'text-emerald-800'}>
              {verdict.is_anomalous ? 'Flagged by the immune checkpoint' : 'Recognised as "self", reading accepted'}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            {verdict.explanation || 'No detector bound this reading; it sits inside the learned normal region.'}
          </p>
          {verdict.suspect_features?.length > 0 && (
            <p className="mt-2 text-xs text-rose-700">Suspect fields: <b>{verdict.suspect_features.join(', ')}</b></p>
          )}
        </div>
      ) : (
        <form id="vitals-form" onSubmit={submit} className="space-y-4">
          <ErrorNote>{error}</ErrorNote>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {VITAL_FIELDS.map(([k, label, unit, ph]) => (
              <Field key={k} label={`${label} (${unit})`}>
                <input className="input font-mono" type="number" step="any" placeholder={ph} {...bind(k)} />
              </Field>
            ))}
          </div>
          <Field label="Nursing note"><input className="input" {...bind('notes')} placeholder="Optional context" /></Field>
          <p className="text-[11px] text-slate-400">Tip: try a typo such as heart rate <b>180</b> instead of 81, or a temperature in °F, and watch the checkpoint react.</p>
        </form>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------- task ---- */
export function TaskModal({ open, onClose, patient, onSaved }) {
  const [form, setForm, bind] = useForm({});
  const [nurses, setNurses] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    const due = new Date(Date.now() + 2 * 36e5); due.setMinutes(0, 0, 0);
    const local = new Date(due.getTime() - due.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    setForm({ title: '', description: '', priority: 'MEDIUM', due_time: local, assigned_nurse_id: '' });
    setError('');
    api.get('/staff/nurses').then((r) => setNurses(r.data)).catch(() => setNurses([]));
  }, [open]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api.post('/tasks', {
        patient_id: patient.id, title: form.title, description: form.description || null, priority: form.priority,
        due_time: form.due_time ? new Date(form.due_time).toISOString() : null,
        assigned_nurse_id: form.assigned_nurse_id ? Number(form.assigned_nurse_id) : null,
      });
      onSaved?.(); onClose();
    } catch (err) { setError(errText(err, 'Could not create the task.')); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} icon={ClipboardPlus} title="Assign care task"
      subtitle={`${patient?.first_name} ${patient?.last_name} · position in queue decided by the GA policy`}
      footer={<Footer onClose={onClose} busy={busy} label="Assign task" form="task-form" />}>
      <form id="task-form" onSubmit={submit} className="space-y-4">
        <ErrorNote>{error}</ErrorNote>
        <Field label="Task"><input className="input" required {...bind('title')} placeholder="e.g. Administer IV antibiotic dose" /></Field>
        <Field label="Instructions"><textarea rows={2} className="input" {...bind('description')} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Priority">
            <select className="input" {...bind('priority')}>{['STAT', 'HIGH', 'MEDIUM', 'LOW'].map((p) => <option key={p}>{p}</option>)}</select>
          </Field>
          <Field label="Due"><input type="datetime-local" className="input" {...bind('due_time')} /></Field>
          <Field label="Nurse">
            <select className="input" {...bind('assigned_nurse_id')}>
              <option value="">Floor pool</option>
              {nurses.map((n) => <option key={n.id} value={n.id}>{n.full_name}</option>)}
            </select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------- patient ---- */
export function PatientModal({ open, onClose, onSaved }) {
  const [form, setForm, bind] = useForm({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) {
      setForm({ mrn: `NS-${Math.floor(7000 + Math.random() * 2000)}`, first_name: '', last_name: '', date_of_birth: '', age: '', gender: 'Female',
        blood_group: 'O+', ward: 'General Medicine', room_number: '', status: 'ADMITTED', primary_diagnosis: '', allergies: '', medical_history: '', emergency_contact: '' });
      setError('');
    }
  }, [open]); // eslint-disable-line

  const topRef = useRef(null);
  const fail = (msg) => { setError(msg); topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const submit = async (e) => {
    e.preventDefault();
    // Our own checks, shown at the top of the form, instead of the browser's
    // small tooltip that can be hidden inside the scrolling dialog.
    const missing = [];
    if (!form.first_name?.trim()) missing.push('first name');
    if (!form.mrn?.trim()) missing.push('MRN');
    if (!form.date_of_birth && !form.age) missing.push('date of birth or age');
    if (missing.length) { fail(`Please fill in: ${missing.join(', ')}.`); return; }
    const age = Number(form.age);
    if (!form.date_of_birth && (!Number.isFinite(age) || age < 0 || age > 120)) { fail('Age must be a number between 0 and 120.'); return; }

    const { age: _age, ...rest } = form;
    const payload = {
      ...rest,
      first_name: form.first_name.trim(),
      last_name: (form.last_name || '').trim(),
      // Only an age was given: store 1 January of the birth year.
      date_of_birth: form.date_of_birth || `${new Date().getFullYear() - Math.round(age)}-01-01`,
    };
    setBusy(true); setError('');
    try { const r = await api.post('/patients', payload); onSaved?.(r.data); onClose(); }
    catch (err) { fail(errText(err, 'Could not admit the patient. Check that the server is running.')); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} icon={UserPlus} size="lg" title="Admit patient"
      footer={<Footer onClose={onClose} busy={busy} label="Admit" form="patient-form" />}>
      <form id="patient-form" onSubmit={submit} noValidate className="space-y-4">
        <div ref={topRef}><ErrorNote>{error}</ErrorNote></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="First name *"><input className="input" {...bind('first_name')} /></Field>
          <Field label="Last name (optional)"><input className="input" {...bind('last_name')} /></Field>
          <Field label="MRN *"><input className="input font-mono" {...bind('mrn')} /></Field>
          <Field label="Date of birth" hint="or fill in age instead"><input type="date" className="input" {...bind('date_of_birth')} /></Field>
          <Field label="Age (years)" hint="used if no date of birth"><input type="number" min="0" max="120" className="input" {...bind('age')} placeholder="e.g. 45" /></Field>
          <Field label="Gender"><select className="input" {...bind('gender')}><option>Female</option><option>Male</option><option>Other</option></select></Field>
          <Field label="Blood group"><select className="input" {...bind('blood_group')}>{['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="Ward"><select className="input" {...bind('ward')}>{['General Medicine', 'Cardiology', 'Pulmonology', 'Neurology', 'Internal Medicine', 'Post-Surgical 3C'].map((w) => <option key={w}>{w}</option>)}</select></Field>
          <Field label="Room"><input className="input" {...bind('room_number')} /></Field>
          <Field label="Status"><select className="input" {...bind('status')}>{['ADMITTED', 'CRITICAL', 'STABLE'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        </div>
        <Field label="Primary diagnosis"><input className="input" {...bind('primary_diagnosis')} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Allergies"><input className="input" {...bind('allergies')} placeholder="e.g. Penicillin, rash" /></Field>
          <Field label="Emergency contact"><input className="input" {...bind('emergency_contact')} placeholder="Name (relation) - +91 ..." /></Field>
        </div>
        <Field label="Medical history"><textarea rows={2} className="input" {...bind('medical_history')} /></Field>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------ staff ---- */
export function StaffModal({ open, onClose, onSaved }) {
  const [form, setForm, bind] = useForm({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setForm({ full_name: '', email: '', role: 'NURSE', department: '', password: 'password123' }); setError(''); } }, [open]); // eslint-disable-line
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await api.post('/staff', form); onSaved?.(); onClose(); }
    catch (err) { setError(errText(err, 'Could not create the account.')); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} icon={UserCog} title="Add staff account"
      footer={<Footer onClose={onClose} busy={busy} label="Create account" form="staff-form" />}>
      <form id="staff-form" onSubmit={submit} className="space-y-4">
        <ErrorNote>{error}</ErrorNote>
        <Field label="Full name"><input className="input" required {...bind('full_name')} /></Field>
        <Field label="Email"><input type="email" className="input" required {...bind('email')} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role"><select className="input" {...bind('role')}>{['NURSE', 'DOCTOR', 'ADMIN'].map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="Department"><input className="input" {...bind('department')} /></Field>
        </div>
        <Field label="Initial password"><input className="input font-mono" required {...bind('password')} /></Field>
      </form>
    </Modal>
  );
}

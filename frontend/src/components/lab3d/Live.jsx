import React, { useEffect, useState } from 'react';
import { Play, ShieldAlert, ShieldCheck, Route, ArrowUp, ArrowDown } from 'lucide-react';
import api from '../../api/axios';
import { bioApi } from '../../api/bio';
import { Badge, PriorityBadge, Spinner, RichText, cx } from '../ui';

const PATIENTS = [
  { id: 1, name: 'Kamala Sundaram, heart failure', qs: ['What diuretic and dose was prescribed?', 'What was the ejection fraction on echo?', 'Why was Lisinopril avoided?'] },
  { id: 2, name: 'Rajesh Yadav, pneumonia', qs: ['What bacteria grew in the sputum culture?', 'Which antibiotics were started?', 'What did the chest X-ray show?'] },
  { id: 3, name: 'Sneha Kulkarni, appendectomy', qs: ['What pain medication is she on?', 'When is discharge planned?'] },
  { id: 4, name: 'Irfan Khan, hypertensive AKI', qs: ['What was the creatinine?', 'Which antihypertensives were started?'] },
];

function Frame({ title, subtitle, children, action }) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><span className="h-2 w-2 rounded-full bg-emerald-500" />{title}</div>
          {subtitle && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function QueryPicker({ pid, setPid, q, setQ, onRun, busy }) {
  const p = PATIENTS.find((x) => x.id === pid);
  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        <select className="input w-auto" value={pid} onChange={(e) => { const np = PATIENTS.find((x) => x.id === Number(e.target.value)); setPid(np.id); setQ(np.qs[0]); }}>
          {PATIENTS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <input className="input min-w-[240px] flex-1" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-primary" onClick={onRun} disabled={busy}>{busy ? <Spinner /> : <><Play className="h-3.5 w-3.5" />Run</>}</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {p.qs.map((s) => <button key={s} onClick={() => setQ(s)} className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-600 hover:border-brand-300">{s}</button>)}
      </div>
    </div>
  );
}

export function RankingLive() {
  const [pid, setPid] = useState(1);
  const [q, setQ] = useState(PATIENTS[0].qs[0]);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); try { setRes(await bioApi.compareRanking(pid, q)); } finally { setBusy(false); } };
  useEffect(() => { run(); }, []); // eslint-disable-line
  const col = (title, rows, tone, other) => (
    <div className="min-w-0 flex-1">
      <div className={cx('mb-2 text-xs font-bold', tone === 'ga' ? 'text-violet-700' : 'text-slate-500')}>{title}</div>
      <ol className="space-y-1.5">
        {rows.map((r, i) => {
          const was = other ? other.findIndex((o) => o.note_id === r.note_id && o.section === r.section) : -1;
          return (
            <li key={`${r.note_id}-${r.section}`} className={cx('rounded-xl border p-2.5 text-xs', tone === 'ga' ? 'border-violet-100 bg-violet-50/50' : 'border-slate-100 bg-slate-50/70')}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-400">{i + 1}</span>
                <span className="truncate font-semibold text-slate-700">{r.section}</span>
                <span className="truncate text-[10px] text-slate-400">{r.note_title}</span>
                {tone === 'ga' && was >= 0 && was !== i && (
                  <span className={cx('ml-auto flex items-center font-mono text-[10px] font-bold', was > i ? 'text-emerald-600' : 'text-rose-500')}>
                    {was > i ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{Math.abs(was - i)}
                  </span>
                )}
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] text-slate-500">{r.preview}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
  return (
    <Frame title="Live: the real assistant, old ranking vs evolved ranking" subtitle="Uses POST /api/bio/compare-ranking on the real notes. Same results, two different orders.">
      <QueryPicker pid={pid} setPid={setPid} q={q} setQ={setQ} onRun={run} busy={busy} />
      {res && (
        <div className="flex flex-col gap-4 lg:flex-row">
          {col('Old system, similarity only', res.baseline)}
          {col('Evolved recipe (GA / PSO)', res.optimized, 'ga', res.baseline)}
        </div>
      )}
    </Frame>
  );
}

export function TasksLive() {
  const [res, setRes] = useState(null);
  useEffect(() => { bioApi.taskRanking(6).then(setRes).catch(() => {}); }, []);
  if (!res?.baseline?.length) return null;
  const col = (title, rows, ga) => (
    <div className="min-w-0 flex-1">
      <div className={cx('mb-2 text-xs font-bold', ga ? 'text-violet-700' : 'text-slate-500')}>{title}</div>
      <ol className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.task_id} className={cx('flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs', ga ? 'border-violet-100 bg-violet-50/50' : 'border-slate-100 bg-slate-50/70')}>
            <span className="font-mono text-slate-400">{i + 1}</span><PriorityBadge priority={r.priority} />
            <div className="min-w-0"><div className="truncate font-semibold text-slate-700">{r.title}</div>
              <div className="truncate text-[10px] text-slate-400">{r.patient_name} · {r.acuity}{r.overdue_hours > 0 ? ` · ${r.overdue_hours}h overdue` : ''}</div></div>
          </li>
        ))}
      </ol>
    </div>
  );
  return (
    <Frame title="Live: tonight's real nurse queue" subtitle={`Top 6 of ${res.total_open_tasks} open tasks. The old sort only looks at due time; the GA policy also weighs patient acuity, how overdue a task is, and its type.`}>
      <div className="flex flex-col gap-4 lg:flex-row">{col('Old SQL sort', res.baseline)}{col('GA-evolved triage', res.optimized, true)}</div>
    </Frame>
  );
}

const VITAL_FIELDS = [['heart_rate', 'Heart rate', 78], ['bp_systolic', 'Systolic', 122], ['bp_diastolic', 'Diastolic', 78], ['resp_rate', 'Resp. rate', 16], ['temp_celsius', 'Temp °C', 36.8], ['o2_saturation', 'SpO₂ %', 97], ['blood_glucose', 'Glucose', 110]];
const TYPOS = [
  { label: 'Normal reading', patch: {} },
  { label: 'HR 81 typed as 180', patch: { heart_rate: 180 }, expect: 'immune detector' },
  { label: 'HR 78 lost a digit → 7', patch: { heart_rate: 7 }, expect: 'range rule' },
  { label: 'Temp entered in °F (98.4)', patch: { temp_celsius: 98.4 }, expect: 'range rule' },
  { label: 'Diastolic above systolic', patch: { bp_systolic: 70, bp_diastolic: 78 }, expect: 'relationship rule' },
  { label: 'Known limit: BP 122 → 212', patch: { bp_systolic: 212 }, expect: 'plausible value' },
];
const layerOf = (r) => {
  if (!r?.is_anomalous) return null;
  const e = (r.explanation || '').toLowerCase();
  if (e.includes('detector bound')) return { name: 'Immune detector (negative selection)', tone: 'rose' };
  if (e.includes('not below systolic') || e.includes('impossibl')) return { name: 'Relationship rule (diastolic vs systolic)', tone: 'amber' };
  return { name: 'Physiological range rule', tone: 'amber' };
};
export function VitalsLive() {
  const base = Object.fromEntries(VITAL_FIELDS.map(([k, v]) => [k, v]));
  const [vals, setVals] = useState(base);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState(null);
  const check = async (v = vals) => { setBusy(true); try { setRes(await bioApi.checkVitals(v)); } finally { setBusy(false); } };
  const layer = layerOf(res);
  return (
    <Frame title="Live: the real immune checkpoint" subtitle="Uses POST /api/bio/check-vitals, the same check every nurse entry goes through (7 vitals, 320 detectors).">
      <div className="mb-1 text-[11px] text-slate-500">Three checks run on every entry: range rules, a systolic/diastolic rule, and the immune system for everything the rules cannot list.</div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TYPOS.map((t) => (
          <button key={t.label} onClick={() => { const v = { ...base, ...t.patch }; setVals(v); setPicked(t); check(v); }}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-rose-300 hover:text-rose-700">{t.label}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {VITAL_FIELDS.map(([k, l]) => (
          <label key={k} className="block"><span className="label">{l}</span>
            <input className="input font-mono" type="number" step="any" value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: Number(e.target.value) })} /></label>
        ))}
      </div>
      <button className="btn btn-primary mt-3" onClick={() => check()} disabled={busy}>{busy ? <Spinner /> : 'Check this reading'}</button>
      {res && (
        <div className={cx('mt-4 rounded-2xl border p-4 anim-pop', res.is_anomalous ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50')}>
          <div className="flex items-center gap-2 text-sm font-bold">
            {res.is_anomalous ? <ShieldAlert className="h-5 w-5 text-rose-600" /> : <ShieldCheck className="h-5 w-5 text-emerald-600" />}
            <span className={res.is_anomalous ? 'text-rose-800' : 'text-emerald-800'}>{res.is_anomalous ? 'Flagged as non-self, likely a data-entry error' : 'Recognised as self, accepted'}</span>
          </div>
          {res.explanation && <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{res.explanation}</p>}
          {layer && <div className="mt-2"><Badge tone={layer.tone}>Caught by: {layer.name}</Badge></div>}
          {res.suspect_features?.length > 0 && (
            <p className="mt-2 text-xs text-slate-600">Furthest from normal: {res.suspect_features.slice(0, 2).map((f) => (
              <b key={f.feature} className="mr-2 text-slate-800">{f.feature.replace(/_/g, ' ')} {f.value} {f.unit} (normal {f.normal_band?.[0]}-{f.normal_band?.[1]})</b>
            ))}</p>
          )}
          {!res.is_anomalous && picked?.expect === 'plausible value' && (
            <p className="mt-2 rounded-lg bg-white/70 p-2 text-xs leading-relaxed text-slate-600">
              <b>Limitation:</b> 212 is unusual but still a real value on this ward (stroke patients run high), so it sits inside "self".
              A typo that lands on a <i>plausible</i> number is the hardest case for any detector, this is why NeuroSwarm pairs the immune system with hard range and relationship rules rather than relying on it alone.
            </p>
          )}
        </div>
      )}
    </Frame>
  );
}

export function RoutingLive() {
  const [pid, setPid] = useState(2);
  const [q, setQ] = useState(PATIENTS[1].qs[1]);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); try { setRes((await api.post('/rag/query', { patient_id: pid, question: q })).data); } finally { setBusy(false); } };
  useEffect(() => { run(); }, []); // eslint-disable-line
  const parts = res?.routing?.partitions || [];
  return (
    <Frame title="Live: ask the real assistant and see where the ants sent it" subtitle="Uses POST /api/rag/query, the same endpoint as the patient chart assistant.">
      <QueryPicker pid={pid} setPid={setPid} q={q} setQ={setQ} onRun={run} busy={busy} />
      {res && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-2">
            <div className="text-xs text-slate-500">Question type detected: <Badge tone="violet">{res.intent}</Badge></div>
            <div className="text-xs font-semibold text-slate-700"><Route className="mr-1 inline h-3.5 w-3.5 text-amber-500" />ACO searched {parts.length} of 30 sections first:</div>
            <div className="flex flex-wrap gap-1.5">{parts.map((p) => <Badge key={p} tone="amber">{p.replace('::', ' · ')}</Badge>)}</div>
            {res.routing?.fell_back_to_full_scan && <div className="text-[11px] text-slate-500">The routed search found too little, so NeuroSwarm also scanned everything.</div>}
            <div className="text-[11px] text-slate-400">Total time {Math.round(res.total_time_ms)} ms · {res.candidates_considered} candidates</div>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-700"><RichText text={res.answer} /></div>
        </div>
      )}
    </Frame>
  );
}

export function CompressionLive() {
  const [h, setH] = useState(null);
  useEffect(() => { api.get('/health').then((r) => setH(r.data.vector_engine)).catch(() => {}); }, []);
  if (!h) return null;
  const before = h.total_indexed_chunks * h.native_dim * 4; const after = h.total_indexed_chunks * h.active_dim * 4;
  const kb = (b) => `${(b / 1024).toFixed(0)} KB`;
  return (
    <Frame title="Live: the running search index right now" subtitle="Read from GET /health on the backend.">
      <div className="grid gap-3 sm:grid-cols-4">
        {[['Chunks indexed', h.total_indexed_chunks], ['Numbers per chunk', `${h.active_dim} of ${h.native_dim}`], ['Index size without GA', kb(before)], ['Index size with GA mask', kb(after)]].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-slate-50 p-3"><div className="text-[11px] text-slate-500">{l}</div><div className="text-lg font-bold text-slate-900">{v}</div></div>
        ))}
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(after / before) * 100}%` }} /></div>
      <div className="mt-1 text-[11px] text-slate-500">{(100 - (after / before) * 100).toFixed(0)}% less memory for the same {h.total_indexed_chunks} chunks, and it scales: a hospital with a million chunks saves the same fraction.</div>
    </Frame>
  );
}

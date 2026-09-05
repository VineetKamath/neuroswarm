import React, { useEffect, useMemo, useState } from 'react';
import {
  Dna, Wind, ShieldCheck, Boxes, Route, Loader2, AlertTriangle,
  CheckCircle2, PlayCircle, ChevronRight, FlaskConical,
} from 'lucide-react';
import { bioApi, ALGO_HEX, pct, num } from '../api/bio';
import { Scope, Chip, MetricDelta, WeightBar, Skeleton, EmptyState, Stat } from '../components/bio/Primitives';
import { ConvergenceChart } from '../components/bio/ConvergenceChart';
import { SwarmCanvas } from '../components/bio/SwarmCanvas';
import { ImmuneMap } from '../components/bio/ImmuneMap';
import { PheromoneGrid, ACOHistory } from '../components/bio/PheromoneGrid';
import { DimensionMask } from '../components/bio/DimensionMask';
import api from '../api/axios';

const TABS = [
  { id: 'overview',    label: 'Overview',          icon: FlaskConical, color: '#0f172a' },
  { id: 'ranking',     label: '1 · Ranking',       icon: Dna,          color: ALGO_HEX.ranking },
  { id: 'tasks',       label: '2 · Triage',        icon: Wind,         color: ALGO_HEX.tasks },
  { id: 'immune',      label: '3 · Immune',        icon: ShieldCheck,  color: ALGO_HEX.immune },
  { id: 'compression', label: '4 · Compression',   icon: Boxes,        color: ALGO_HEX.compression },
  { id: 'routing',     label: '5 · Routing',       icon: Route,        color: ALGO_HEX.routing },
];

export const BioLabPage = () => {
  const [tab, setTab] = useState('overview');
  const [status, setStatus] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [report, setReport] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    Promise.all([bioApi.status(), bioApi.algorithms()])
      .then(([s, c]) => { setStatus(s); setCatalog(c); })
      .catch(() => setErr('Could not reach the bio-inspired subsystem.'));
    bioApi.report().then(setReport).catch(() => setReport(null));
  }, []);

  const meta = useMemo(() => {
    const map = {};
    (catalog?.algorithms || []).forEach((a) => { map[a.key] = a; });
    return map;
  }, [catalog]);

  if (err) return <EmptyState title="Bio-Lab unavailable" body={err} />;

  const untrained = status && Object.values(status.algorithms).every((a) => !a.trained);

  return (
    <div className="space-y-5">
      <Header status={status} report={report} />

      {untrained && (
        <div className="ns-card border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">No optimizers have been trained yet.</p>
            <p className="mt-0.5 leading-relaxed">
              The clinical app is fully functional and running its documented baselines. To evolve
              the optimizers, run <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
              python -m app.bio.cli train</code> in the backend directory.
            </p>
          </div>
        </div>
      )}

      <nav className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`ns-focus flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                active ? 'text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900'
              }`}
              style={active ? { backgroundColor: t.color } : undefined}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </nav>

      <div key={tab} className="ns-animate-up">
        {tab === 'overview'    && <Overview status={status} report={report} catalog={catalog} onJump={setTab} />}
        {tab === 'ranking'     && <RankingPanel meta={meta.ranking} />}
        {tab === 'tasks'       && <TasksPanel meta={meta.tasks} />}
        {tab === 'immune'      && <ImmunePanel meta={meta.immune} />}
        {tab === 'compression' && <CompressionPanel meta={meta.compression} />}
        {tab === 'routing'     && <RoutingPanel meta={meta.routing} />}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ header */
const Header = ({ status, report }) => (
  <div className="ns-scope p-6 relative overflow-hidden">
    <div className="absolute inset-0 ns-grid-lines opacity-40 pointer-events-none" />
    <div className="relative flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-indigo-300">
          <FlaskConical className="w-4 h-4" /> Bio-Inspired Optimization Lab
        </div>
        <h1 className="mt-2 text-2xl font-bold text-white">
          Five nature-derived optimizers, tuning a live clinical system
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Each algorithm below replaces a hand-tuned decision point inside NeuroSwarm. Every number
          shown is measured against the baseline it replaced, on a{' '}
          <span className="font-semibold text-slate-100">held-out test split</span> the optimizer
          never trained on. There is no language model anywhere in this pipeline.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 shrink-0">
        <Stat label="Optimizers live" color="#a5b4fc"
              value={status ? Object.values(status.algorithms).filter((a) => a.active).length + ' / 5' : '—'} />
        <Stat label="Labeled queries" color="#67e8f9" value={report?.ranking_cases ?? '—'} />
        <Stat label="Triage scenarios" color="#fca5a5" value={report?.task_scenarios ?? '—'} />
        <Stat label="Trained" color="#fcd34d"
              value={report?.trained_at ? new Date(report.trained_at).toLocaleDateString() : '—'} />
      </div>
    </div>
  </div>
);

/* ---------------------------------------------------------------- overview */
const Overview = ({ status, report, catalog, onJump }) => {
  if (!catalog) return <Skeleton className="h-96" />;

  const results = {
    ranking: report?.ranking, tasks: report?.tasks, immune: report?.immune,
    compression: report?.compression, routing: report?.routing,
  };

  const headline = (key) => {
    const r = results[key];
    if (!r || r.error) return null;
    switch (key) {
      case 'ranking':
        return { text: 'nDCG@5 on held-out queries', from: num(r.baseline?.ndcg_at_5), to: num(r.optimized?.ndcg_at_5), d: r.improvement_pct?.ndcg_at_5 };
      case 'tasks':
        return { text: 'Agreement with expert triage', from: num(r.baseline?.pairwise_agreement), to: num(r.optimized?.pairwise_agreement), d: r.improvement_pct?.pairwise_agreement };
      case 'immune':
        return { text: 'Planted errors detected', from: '0.000', to: num(r.metrics?.detection_rate), d: null, note: `${r.metrics?.false_alarm_rate === 0 ? 'zero' : num(r.metrics?.false_alarm_rate)} false alarms` };
      case 'compression':
        return { text: 'Embedding dimensions', from: String(r.baseline?.dims_total ?? 384), to: String(r.optimized?.dims_kept ?? '—'), d: null, note: `${r.improvement?.accuracy_retained_pct ?? '—'}% accuracy retained` };
      case 'routing':
        return { text: 'Chunks scanned per query', from: num(r.baseline?.mean_chunks_scanned, 0), to: num(r.optimized?.mean_chunks_scanned, 0), d: null, note: `${num(r.optimized?.scan_reduction_pct, 1)}% less scanning` };
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      {catalog.algorithms.map((a) => {
        const st = status?.algorithms?.[a.key];
        const h = headline(a.key);
        const color = ALGO_HEX[a.key];
        return (
          <article key={a.key} className="ns-card overflow-hidden">
            <div className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg text-xs font-bold text-white"
                          style={{ backgroundColor: color }}>{a.index}</span>
                    <h3 className="text-base font-bold text-slate-900">{a.name}</h3>
                    <Chip color={color}>{a.family}</Chip>
                    {st?.active
                      ? <Chip color="#059669"><CheckCircle2 className="w-3 h-3" /> live</Chip>
                      : <Chip color="#94a3b8">not trained</Chip>}
                  </div>

                  <dl className="mt-3 space-y-2 text-sm">
                    <Row term="Plugs into" desc={a.plugs_into} />
                    <Row term="Problem" desc={a.problem} />
                    <Row term="Why bio-inspired" desc={a.why_bio} />
                    <Row term="Fitness" desc={a.fitness} mono />
                  </dl>

                  {a.scoping_note && (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-900">
                      <span className="font-semibold">Scoping note: </span>{a.scoping_note}
                    </p>
                  )}
                </div>

                {h && (
                  <div className="w-full sm:w-56 shrink-0 rounded-xl border p-3.5"
                       style={{ borderColor: `${color}33`, backgroundColor: `${color}0a` }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {h.text}
                    </p>
                    <div className="mt-1.5 flex items-baseline gap-2 ns-tabular">
                      <span className="text-sm text-slate-400 line-through">{h.from}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xl font-bold" style={{ color }}>{h.to}</span>
                    </div>
                    {h.d != null && (
                      <p className="mt-1 text-xs font-bold text-emerald-600 ns-tabular">▲ {pct(h.d)}</p>
                    )}
                    {h.note && <p className="mt-1 text-[11px] text-slate-600">{h.note}</p>}
                  </div>
                )}
              </div>

              <button
                onClick={() => onJump(a.key)}
                className="ns-focus mt-3 inline-flex items-center gap-1 text-sm font-semibold transition hover:gap-2"
                style={{ color }}
              >
                Open the {a.name.toLowerCase()} lab <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="h-1" style={{ backgroundColor: color }} />
          </article>
        );
      })}
    </div>
  );
};

const Row = ({ term, desc, mono }) => (
  <div className="grid grid-cols-[110px_1fr] gap-3">
    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 pt-0.5">{term}</dt>
    <dd className={`text-slate-700 leading-relaxed ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{desc}</dd>
  </div>
);

const PanelHead = ({ meta, color, children }) => (
  <div className="ns-card p-5">
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="text-lg font-bold text-slate-900">{meta?.name}</h2>
      <Chip color={color}>{meta?.family}</Chip>
      <Chip color="#64748b">{meta?.metaphor}</Chip>
    </div>
    <p className="mt-2 text-sm leading-relaxed text-slate-700">{meta?.why_bio}</p>
    {children}
  </div>
);

/* ----------------------------------------------------------------- ranking */
const RankingPanel = ({ meta }) => {
  const [d, setD] = useState(null);
  const [patients, setPatients] = useState([]);
  const [pid, setPid] = useState('');
  const [q, setQ] = useState('What diuretic and dose was prescribed?');
  const [cmp, setCmp] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    bioApi.ranking().then(setD).catch(() => setD(false));
    api.get('/patients').then((r) => {
      const list = r.data || [];
      setPatients(list);
      if (list.length) setPid(String(list[0].id));
    }).catch(() => {});
  }, []);

  const run = async () => {
    if (!pid || !q.trim()) return;
    setBusy(true);
    try { setCmp(await bioApi.compareRanking(Number(pid), q.trim())); }
    catch { setCmp(null); } finally { setBusy(false); }
  };

  if (d === false) return <EmptyState title="Not trained yet" body="Run the trainer to evolve retrieval weights." />;
  if (!d) return <Skeleton className="h-96" />;

  const color = ALGO_HEX.ranking;
  const ga = d.comparison?.ga;
  const pso = d.comparison?.pso;
  const base = d.heldout_baseline_metrics || d.baseline_metrics;
  const opt = d.heldout_optimized_metrics || d.optimized_metrics;
  const imp = d.heldout_improvement_pct || d.improvement_pct;
  const w = d.weights || {};

  return (
    <div className="space-y-4">
      <PanelHead meta={meta} color={color}>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricDelta label="nDCG@5" before={num(base?.ndcg_at_5)} after={num(opt?.ndcg_at_5)} deltaPct={imp?.ndcg_at_5} />
          <MetricDelta label="nDCG@3" before={num(base?.ndcg_at_3)} after={num(opt?.ndcg_at_3)} deltaPct={imp?.ndcg_at_3} />
          <MetricDelta label="Recall@5" before={num(base?.recall_at_5)} after={num(opt?.recall_at_5)} deltaPct={imp?.recall_at_5} />
          <MetricDelta label="MRR" before={num(base?.mrr)} after={num(opt?.mrr)} deltaPct={imp?.mrr} />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Measured on {d.split?.test ?? base?.queries} held-out queries; weights were evolved on{' '}
          {d.split?.train ?? '—'} others. Winner: <span className="font-semibold text-slate-700">{d.selected}</span>
          {ga && pso && <> (GA fitness {num(ga.best_fitness, 4)} vs PSO {num(pso.best_fitness, 4)})</>}
        </p>
      </PanelHead>

      <div className="grid gap-4 lg:grid-cols-2">
        <Scope title="Convergence — GA vs PSO racing the same objective"
               subtitle="Best fitness climbs in steps while population diversity collapses.">
          <ConvergenceChart
            series={ga?.history || d.history} color={color}
            compareSeries={pso?.history} compareColor={ALGO_HEX.pso}
            label="GA" compareLabel="PSO"
          />
        </Scope>

        <Scope title="Particle swarm in flight"
               subtitle="Particles explore widely, then contract onto the global best as inertia decays.">
          <SwarmCanvas trace={pso?.swarm_trace || d.swarm_trace}
                       xLabel="similarity weight" yLabel="recency weight" />
        </Scope>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="ns-card p-5">
          <h3 className="text-sm font-bold text-slate-900">The evolved genome</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Six signal weights plus two shape parameters. The baseline is the leftmost bar at 1.0
            with every other weight at zero.
          </p>
          <div className="mt-4 space-y-3.5">
            <WeightBar label="Embedding similarity" value={w.w_similarity} color={color}
                       hint="The only signal the baseline had." />
            <WeightBar label="Recency" value={w.w_recency} color={color}
                       hint={`Half-life ${num(w.half_life_days, 0)} days.`} />
            <WeightBar label="Verbatim term overlap" value={w.w_lexical} color={color}
                       hint="Catches drug names and organisms embeddings blur." />
            <WeightBar label="SOAP section match" value={w.w_section} color={color}
                       hint="Does this section answer this kind of question?" />
            <WeightBar label="Note type authority" value={w.w_type} color={color} />
            <WeightBar label="Chunk length" value={w.w_length} color={color}
                       hint={`Peaks near ${num(w.length_pivot, 0)} characters.`} />
          </div>
        </div>

        <div className="ns-card p-5">
          <h3 className="text-sm font-bold text-slate-900">Try it on a live query</h3>
          <p className="mt-1 text-xs text-slate-600">
            Same candidate pool, ranked both ways. Watch which section rises to the top.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select value={pid} onChange={(e) => setPid(e.target.value)}
                    className="ns-focus rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
              ))}
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && run()}
                   className="ns-focus min-w-[220px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                   placeholder="Ask a clinical question…" />
            <button onClick={run} disabled={busy}
                    className="ns-focus inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: color }}>
              {busy ? <Loader2 className="w-4 h-4 ns-spin" /> : <PlayCircle className="w-4 h-4" />}
              Compare
            </button>
          </div>

          {cmp && (
            <div className="mt-4 ns-animate-in">
              <p className="mb-2 text-xs text-slate-600">
                Detected intent <Chip color={color}>{cmp.intent}</Chip>{' '}
                {cmp.changed
                  ? <span className="font-semibold text-emerald-700">— the evolved ranker reordered the results.</span>
                  : <span className="text-slate-500">— both rankers agreed on this query.</span>}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <RankColumn title="Baseline (cosine only)" rows={cmp.baseline} tone="#94a3b8" />
                <RankColumn title="Evolved ranker" rows={cmp.optimized} tone={color} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const RankColumn = ({ title, rows, tone }) => (
  <div className="rounded-xl border border-slate-200 overflow-hidden">
    <div className="px-3 py-2 text-xs font-bold text-white" style={{ backgroundColor: tone }}>{title}</div>
    <ol className="divide-y divide-slate-100">
      {(rows || []).map((r, i) => (
        <li key={i} className="p-2.5">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-slate-100 text-[11px] font-bold text-slate-600">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">{r.section || r.note_title}</p>
              <p className="truncate text-[11px] text-slate-500">{r.note_type} · {r.date_recorded}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">{r.preview}</p>
            </div>
            <span className="ml-auto shrink-0 ns-tabular text-[11px] font-semibold text-slate-500">
              {Number(r.score).toFixed(3)}
            </span>
          </div>
        </li>
      ))}
    </ol>
  </div>
);

/* ------------------------------------------------------------------- tasks */
const TasksPanel = ({ meta }) => {
  const [d, setD] = useState(null);
  const [live, setLive] = useState(null);

  useEffect(() => {
    bioApi.taskPolicy().then(setD).catch(() => setD(false));
    bioApi.taskRanking(10).then(setLive).catch(() => {});
  }, []);

  if (d === false) return <EmptyState title="Not trained yet" body="Run the trainer to evolve the triage policy." />;
  if (!d) return <Skeleton className="h-96" />;

  const color = ALGO_HEX.tasks;
  const base = d.heldout_baseline_metrics || d.baseline_metrics;
  const opt = d.heldout_optimized_metrics || d.optimized_metrics;
  const imp = d.heldout_improvement_pct || d.improvement_pct;
  const p = d.policy || {};

  return (
    <div className="space-y-4">
      <PanelHead meta={meta} color={color}>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MetricDelta label="Pairwise agreement" before={num(base?.pairwise_agreement)} after={num(opt?.pairwise_agreement)} deltaPct={imp?.pairwise_agreement} />
          <MetricDelta label="Kendall's τ" before={num(base?.kendall_tau)} after={num(opt?.kendall_tau)} deltaPct={imp?.kendall_tau} />
          <MetricDelta label="Top-1 accuracy" before={num(base?.top1_accuracy)} after={num(opt?.top1_accuracy)} deltaPct={imp?.top1_accuracy} />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Measured on {base?.scenarios} held-out triage scenarios ({base?.pairs} expert pairwise judgements).
        </p>
      </PanelHead>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Scope title="Evolving a clinical instinct"
               subtitle="Fitness is the fraction of expert orderings the policy reproduces.">
          <ConvergenceChart series={d.history} color={color} />
        </Scope>

        <div className="ns-card p-5">
          <h3 className="text-sm font-bold text-slate-900">Evolved priorities</h3>
          <div className="mt-4 space-y-3.5">
            <WeightBar label="Stated priority" value={p.w_priority} color={color}
                       hint="The only factor the old sort used." />
            <WeightBar label="Patient acuity" value={p.w_acuity} color={color} />
            <WeightBar label="Overdue" value={p.w_overdue} color={color}
                       hint={`Saturates at ${num(p.overdue_scale_hours, 1)} h.`} />
            <WeightBar label="Time pending" value={p.w_pending} color={color} />
            <WeightBar label="Task category" value={p.w_category} color={color} />
            <WeightBar label="Nurse workload" value={p.w_workload} color={color}
                       hint="Stops one backlog dominating the board." />
          </div>
        </div>
      </div>

      {live && (
        <div className="ns-card p-5">
          <h3 className="text-sm font-bold text-slate-900">
            Live ward queue — {live.total_open_tasks} open tasks
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            {live.changed
              ? 'The evolved policy reorders the real queue right now.'
              : 'Both policies agree on the current queue.'}
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <TaskColumn title="Old sort: priority, then due time" rows={live.baseline} tone="#94a3b8" />
            <TaskColumn title="GA-evolved triage" rows={live.optimized} tone={color} />
          </div>
        </div>
      )}
    </div>
  );
};

const TaskColumn = ({ title, rows, tone }) => (
  <div className="rounded-xl border border-slate-200 overflow-hidden">
    <div className="px-3 py-2 text-xs font-bold text-white" style={{ backgroundColor: tone }}>{title}</div>
    <ol className="divide-y divide-slate-100">
      {(rows || []).slice(0, 8).map((t, i) => (
        <li key={t.task_id} className="flex items-center gap-2.5 p-2.5">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-slate-100 text-[11px] font-bold text-slate-600">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-900">{t.title}</p>
            <p className="truncate text-[11px] text-slate-500">
              {t.patient_name} · {t.room || '—'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Chip color={t.priority === 'STAT' ? '#e11d48' : t.priority === 'HIGH' ? '#f59e0b' : '#64748b'}>
              {t.priority}
            </Chip>
            {t.acuity === 'CRITICAL' && <Chip color="#dc2626">CRIT</Chip>}
            {t.overdue_hours > 0 && <Chip color="#b45309">{t.overdue_hours.toFixed(0)}h late</Chip>}
          </div>
        </li>
      ))}
    </ol>
  </div>
);

/* ------------------------------------------------------------------ immune */
const EMPTY_VITALS = {
  heart_rate: 78, bp_systolic: 122, bp_diastolic: 78, resp_rate: 16,
  temp_celsius: 36.8, o2_saturation: 97, blood_glucose: 98,
};

const PRESETS = [
  { name: 'Normal reading', values: EMPTY_VITALS },
  { name: 'Decimal slip (37 → 370 °C)', values: { ...EMPTY_VITALS, temp_celsius: 370 } },
  { name: 'Fahrenheit in a Celsius field', values: { ...EMPTY_VITALS, temp_celsius: 98.6 } },
  { name: 'Diastolic above systolic', values: { ...EMPTY_VITALS, bp_systolic: 88, bp_diastolic: 96, heart_rate: 44 } },
  { name: 'Dropped digit on SpO₂', values: { ...EMPTY_VITALS, o2_saturation: 7 } },
  { name: 'Glucose carried from another chart', values: { ...EMPTY_VITALS, blood_glucose: 512 } },
];

const ImmunePanel = ({ meta }) => {
  const [d, setD] = useState(null);
  const [vitals, setVitals] = useState(EMPTY_VITALS);
  const [result, setResult] = useState(null);
  const [findings, setFindings] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    bioApi.immune().then(setD).catch(() => setD(false));
    bioApi.anomalies(30).then(setFindings).catch(() => {});
  }, []);

  const check = async (v) => {
    setBusy(true);
    try { setResult(await bioApi.checkVitals(v || vitals)); }
    catch { setResult(null); } finally { setBusy(false); }
  };

  if (d === false) return <EmptyState title="Not trained yet" body="Run the trainer to mature the detector repertoire." />;
  if (!d) return <Skeleton className="h-96" />;

  const color = ALGO_HEX.immune;
  const m = d.metrics || {};

  const bounds = {
    heart_rate: [20, 220], bp_systolic: [50, 260], bp_diastolic: [25, 160],
    resp_rate: [5, 60], temp_celsius: [30, 43], o2_saturation: [50, 100], blood_glucose: [20, 600],
  };
  const probeVector = d.features.map((f) => {
    const [lo, hi] = bounds[f] || [0, 1];
    const v = Number(vitals[f]);
    return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  });

  return (
    <div className="space-y-4">
      <PanelHead meta={meta} color={color}>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <MetricDelta label="Detection rate" before="0.000" after={num(m.detection_rate)} />
          <MetricDelta label="False alarm rate" before="—" after={num(m.false_alarm_rate)} higherIsBetter={false} />
          <MetricDelta label="Precision" before="—" after={num(m.precision)} />
          <MetricDelta label="F1" before="—" after={num(m.f1)} />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          {d.detector_count} detectors matured from {d.train_self_count} normal readings.
          Evaluated on {d.test_normal_count} unseen normal readings and {d.test_anomalous_count} planted
          errors across {d.error_types?.length} corruption types — none of which the model was ever shown.
        </p>
      </PanelHead>

      <div className="grid gap-4 lg:grid-cols-2">
        <Scope title="Self / non-self space"
               subtitle="Detectors ring the normal cloud without ever overlapping it.">
          <ImmuneMap detectors={d.detectors} selfSet={d.self_set} features={d.features}
                     selfRadius={d.self_radius}
                     probe={{ vector: probeVector, anomalous: result?.is_anomalous }} />
        </Scope>

        <div className="ns-card p-5">
          <h3 className="text-sm font-bold text-slate-900">Test the immune checkpoint</h3>
          <p className="mt-1 text-xs text-slate-600">
            Enter a reading, or plant a typical documentation error.
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.name}
                      onClick={() => { setVitals(p.values); check(p.values); }}
                      className="ns-focus rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-rose-300 hover:bg-rose-50">
                {p.name}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {d.features.map((f) => (
              <label key={f} className="block">
                <span className="text-[11px] font-medium text-slate-600">{f.replace(/_/g, ' ')}</span>
                <input type="number" step="0.1" value={vitals[f] ?? ''}
                       onChange={(e) => setVitals({ ...vitals, [f]: Number(e.target.value) })}
                       className="ns-focus mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm ns-tabular" />
              </label>
            ))}
          </div>

          <button onClick={() => check()} disabled={busy}
                  className="ns-focus mt-3 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: color }}>
            {busy ? <Loader2 className="w-4 h-4 ns-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Screen this reading
          </button>

          {result && (
            <div className={`ns-animate-in mt-3 rounded-xl border p-3.5 ${
              result.is_anomalous ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <div className="flex items-center gap-2">
                {result.is_anomalous
                  ? <AlertTriangle className="w-4 h-4 text-rose-600" />
                  : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                <span className={`text-sm font-bold ${result.is_anomalous ? 'text-rose-900' : 'text-emerald-900'}`}>
                  {result.is_anomalous ? 'Flagged for verification' : 'Consistent with normal patterns'}
                </span>
                <span className="ml-auto ns-tabular text-xs font-semibold text-slate-600">
                  score {num(result.anomaly_score, 2)}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-700">{result.explanation}</p>
            </div>
          )}
        </div>
      </div>

      {findings?.findings?.length > 0 && (
        <div className="ns-card p-5">
          <h3 className="text-sm font-bold text-slate-900">
            Live sweep — {findings.flagged} of {findings.scanned} recent readings flagged
          </h3>
          <div className="mt-3 divide-y divide-slate-100">
            {findings.findings.slice(0, 8).map((f) => (
              <div key={f.vital_id} className="flex items-start gap-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900">
                    {f.patient_name} <span className="font-normal text-slate-500">· {f.room || '—'}</span>
                  </p>
                  <p className="text-[11px] leading-relaxed text-slate-600">{f.explanation}</p>
                </div>
                <span className="ml-auto shrink-0 ns-tabular text-[11px] font-bold text-rose-600">
                  {num(f.anomaly_score, 2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------- compression */
const CompressionPanel = ({ meta }) => {
  const [d, setD] = useState(null);
  useEffect(() => { bioApi.compression().then(setD).catch(() => setD(false)); }, []);

  if (d === false) return <EmptyState title="Not trained yet" body="Run the trainer to evolve the dimension mask." />;
  if (!d) return <Skeleton className="h-96" />;

  const color = ALGO_HEX.compression;
  const b = d.baseline_metrics || {};
  const o = d.optimized_metrics || {};
  const imp = d.improvement || {};

  return (
    <div className="space-y-4">
      <PanelHead meta={meta} color={color}>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <MetricDelta label="Dimensions" before={b.dims_total} after={o.dims_kept} higherIsBetter={false} />
          <MetricDelta label="Bytes / vector" before={b.bytes_per_vector} after={o.bytes_per_vector} higherIsBetter={false} />
          <MetricDelta label="nDCG@5" before={num(b.ndcg_at_5)} after={num(o.ndcg_at_5)} deltaPct={imp.ndcg_delta_pct} />
          <MetricDelta label="Search time" before={num(b.search_ms, 4)} after={num(o.search_ms, 4)} higherIsBetter={false} unit=" ms" />
        </div>
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-900">
          <span className="font-semibold">Result: </span>
          {imp.memory_saved_pct}% less memory per vector and a {imp.search_speedup_x}× faster scan,
          retaining {imp.accuracy_retained_pct}% of baseline retrieval accuracy.
          {Number(imp.ndcg_delta_pct) < 0 && (
            <> The {Math.abs(Number(imp.ndcg_delta_pct)).toFixed(2)}% accuracy cost is the honest
              trade being made — it is not free.</>
          )}
        </div>
      </PanelHead>

      <div className="grid gap-4 lg:grid-cols-2">
        <Scope title="Evolving the subspace"
               subtitle="Fitness = retrieval accuracy minus a parsimony penalty on dimensions kept.">
          <ConvergenceChart series={d.history} color={color} showDiversity />
        </Scope>
        <Scope title={`The evolved mask — ${o.dims_kept} of ${b.dims_total} dimensions survive`}
               subtitle="Brightness encodes each dimension's variance across the clinical corpus.">
          <DimensionMask mask={d.mask} importance={d.dimension_importance} />
        </Scope>
      </div>
    </div>
  );
};

/* ----------------------------------------------------------------- routing */
const RoutingPanel = ({ meta }) => {
  const [d, setD] = useState(null);
  const [intent, setIntent] = useState(null);
  useEffect(() => { bioApi.routing().then(setD).catch(() => setD(false)); }, []);

  if (d === false) return <EmptyState title="Not trained yet" body="Run the trainer to lay down pheromone trails." />;
  if (!d) return <Skeleton className="h-96" />;

  const color = ALGO_HEX.routing;
  const b = d.baseline_metrics || {};
  const o = d.metrics || {};

  return (
    <div className="space-y-4">
      <PanelHead meta={meta} color={color}>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <MetricDelta label="Chunks scanned" before={num(b.mean_chunks_scanned, 0)} after={num(o.mean_chunks_scanned, 0)} higherIsBetter={false} />
          <MetricDelta label="Partitions probed" before={num(b.mean_partitions_scanned, 0)} after={num(o.mean_partitions_scanned, 0)} higherIsBetter={false} />
          <MetricDelta label="Gold partition hit rate" before={num(b.hit_rate)} after={num(o.hit_rate)} />
          <MetricDelta label="Scan reduction" before="0" after={num(o.scan_reduction_pct, 1)} unit="%" />
        </div>
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          <span className="font-semibold">Reading this honestly: </span>
          routing scans {num(o.scan_reduction_pct, 1)}% fewer chunks, but its hit rate is{' '}
          {num(o.hit_rate)} rather than 1.0 — narrowing the search does cost recall. In production
          NeuroSwarm detects a weak or thin routed result and falls back to a full patient scan, so
          the clinician never loses an answer; the cost of a miss is one extra scan, not a wrong result.
        </div>
      </PanelHead>

      <Scope title="Pheromone map — query intent × searchable partition"
             subtitle="Bright cells are trails the colony reinforced. Click an intent to highlight its row.">
        <PheromoneGrid matrix={d.pheromone_matrix} onSelectIntent={setIntent} selectedIntent={intent} />
      </Scope>

      <Scope title="Colony convergence"
             subtitle="Hit rate rises while the number of chunks scanned falls — the trade being learned.">
        <ACOHistory history={d.history} />
      </Scope>
    </div>
  );
};

export default BioLabPage;

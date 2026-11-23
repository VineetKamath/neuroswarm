import React, { useEffect, useState } from 'react';
import { bioApi } from '../../api/bio';
import { LineChart, CompareBar } from './kit';
import { Skeleton, cx } from '../ui';

const cache = {};
export function useArtifact(name) {
  const [data, setData] = useState(cache[name] || null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (cache[name]) return;
    bioApi[name]().then((d) => { cache[name] = d; setData(d); }).catch((e) => setError(e?.response?.data?.detail || 'Not available, run the trainer.'));
  }, [name]);
  return [data, error];
}

export function ResultCard({ title, subtitle, children, className }) {
  return (
    <div className={cx('card p-5', className)}>
      <div className="mb-4">
        <div className="text-sm font-bold text-slate-900">{title}</div>
        {subtitle && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

const Loading = ({ error }) => (error ? <div className="text-xs text-slate-400">{error}</div> : <Skeleton className="h-40" />);
const f3 = (v) => Number(v).toFixed(3);
const pctf = (v) => `${(Number(v) * 100).toFixed(1)}%`;

/* --------------------------------------------------------------- ranking -- */
export function RankingResults({ report, focus = 'ga' }) {
  const [art, err] = useArtifact('ranking');
  const r = report?.ranking;
  const ga = art?.comparison?.ga?.history || [];
  const pso = art?.comparison?.pso?.history || [];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ResultCard title="Training run: GA vs PSO on search ranking"
        subtitle={`Both optimizers evolved the same 14-gene ranking policy; ${r?.selected || 'the winner'} was deployed.`}>
        {art ? (
          <LineChart height={170} series={[
            { label: 'GA best', values: ga.map((x) => x.best_fitness), color: '#7c6cf2', width: focus === 'ga' ? 2.8 : 1.6 },
            { label: 'PSO best', values: pso.map((x) => x.best_fitness), color: '#22b8e0', width: focus === 'pso' ? 2.8 : 1.6 },
            { label: focus === 'ga' ? 'GA mean' : 'PSO mean', values: (focus === 'ga' ? ga : pso).map((x) => x.mean_fitness), color: focus === 'ga' ? '#c4b5fd' : '#a5f3fc', dash: '4 3' },
          ]} />
        ) : <Loading error={err} />}
      </ResultCard>
      <ResultCard title="Unseen questions: old ranking vs evolved ranking"
        subtitle={r ? `${r.baseline.queries} labelled clinical questions the optimizer never trained on` : ''}>
        {r ? (
          <div className="space-y-3">
            <CompareBar label="nDCG@5 (ranking quality)" base={r.baseline.ndcg_at_5} opt={r.optimized.ndcg_at_5} color="#7c6cf2" format={f3} />
            <CompareBar label="Recall@5 (answer in top 5)" base={r.baseline.recall_at_5} opt={r.optimized.recall_at_5} color="#7c6cf2" format={f3} />
            <CompareBar label="MRR (how high the first right answer is)" base={r.baseline.mrr} opt={r.optimized.mrr} color="#7c6cf2" format={f3} />
            {art?.weights && (
              <div className="pt-2">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Learned signal weights</div>
                <div className="flex items-end gap-2">
                  {['w_similarity', 'w_recency', 'w_lexical', 'w_type', 'w_section', 'w_length'].map((k) => (
                    <div key={k} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex h-16 w-full items-end rounded-md bg-slate-50"><div className="w-full rounded-md bg-violet-400" style={{ height: `${art.weights[k] * 100}%` }} /></div>
                      <div className="text-[9px] text-slate-500">{k.replace('w_', '')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : <Loading />}
      </ResultCard>
    </div>
  );
}

/* ----------------------------------------------------------------- tasks -- */
export function TaskResults({ report }) {
  const [art, err] = useArtifact('taskPolicy');
  const t = report?.tasks;
  const pri = art?.policy?.category_priors || {};
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ResultCard title="Training run: GA on nurse task order"
        subtitle="Score = how well it agrees with expert task orders">
        {art ? (
          <LineChart height={170} series={[
            { label: 'best', values: art.history.map((x) => x.best_fitness), color: '#7c6cf2', width: 2.5 },
            { label: 'mean', values: art.history.map((x) => x.mean_fitness), color: '#c4b5fd', dash: '4 3' },
            { label: 'worst', values: art.history.map((x) => x.worst_fitness), color: '#e2e8f0' },
          ]} />
        ) : <Loading error={err} />}
      </ResultCard>
      <ResultCard title="Unseen ward scenarios: old sort vs GA policy" subtitle={t ? `${t.baseline.scenarios} unseen ward scenarios, ${t.baseline.pairs} task pairs` : ''}>
        {t ? (
          <div className="space-y-3">
            <CompareBar label="Pairwise agreement with expert" base={t.baseline.pairwise_agreement} opt={t.optimized.pairwise_agreement} color="#7c6cf2" format={pctf} />
            <CompareBar label="Kendall τ (order correlation)" base={t.baseline.kendall_tau} opt={t.optimized.kendall_tau} color="#7c6cf2" format={f3} />
            <CompareBar label="Top-1: most urgent task first" base={t.baseline.top1_accuracy} opt={t.optimized.top1_accuracy} color="#7c6cf2" format={pctf} />
            {art && (
              <div className="pt-1 text-[11px] text-slate-500">
                Learned category priorities: {Object.entries(pri).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(' · ')}
              </div>
            )}
          </div>
        ) : <Loading />}
      </ResultCard>
    </div>
  );
}

/* ---------------------------------------------------------------- immune -- */
export function ImmuneResults({ report }) {
  const [art, err] = useArtifact('immune');
  const m = report?.immune?.metrics || art?.metrics;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <ResultCard title="Unseen vitals with planted typos" subtitle="Trained on normal readings only. It never saw these typos during training.">
        {m ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-center">
              {[['Caught errors', m.true_positives, 'bg-emerald-50 text-emerald-700'], ['Missed errors', m.false_negatives, 'bg-amber-50 text-amber-700'],
                ['False alarms', m.false_positives, 'bg-rose-50 text-rose-700'], ['Correctly accepted', m.true_negatives, 'bg-slate-50 text-slate-700']].map(([l, v, c]) => (
                <div key={l} className={cx('rounded-xl p-3', c)}><div className="text-2xl font-bold">{v}</div><div className="text-[11px] font-medium">{l}</div></div>
              ))}
            </div>
            <CompareBar label="Detection rate" base={0} opt={m.detection_rate} color="#f0527a" format={pctf} />
            <CompareBar label="False-alarm rate (lower is better)" base={0} opt={m.false_alarm_rate} color="#f0527a" format={pctf} lowerIsBetter />
            <div className="text-[11px] text-slate-500">Precision {pctf(m.precision)} · F1 {f3(m.f1)} · {m.detectors} detectors</div>
          </div>
        ) : <Loading error={err} />}
      </ResultCard>
      <ResultCard title="How coverage grows as detectors are added" subtitle="Share of the abnormal space covered by detectors">
        {art ? (
          <>
            <LineChart height={150} xLabel="round" yDomain={[0, 1]} series={[
              { label: 'coverage of non-self', values: art.generation_log.map((g) => g.coverage_estimate), color: '#f0527a', width: 2.5, area: true },
              { label: 'detectors (÷ max)', values: art.generation_log.map((g) => g.detectors / Math.max(...art.generation_log.map((x) => x.detectors))), color: '#94a3b8', dash: '4 3' },
            ]} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {art.error_types.map((e) => <span key={e} className="badge bg-rose-50 text-rose-700 ring-rose-200">{e.replace(/_/g, ' ')}</span>)}
            </div>
            <div className="mt-2 text-[11px] text-slate-500">Typo types planted in the test set. None were used in training.</div>
          </>
        ) : <Loading error={err} />}
      </ResultCard>
    </div>
  );
}

/* ----------------------------------------------------------- compression -- */
export function CompressionResults({ report }) {
  const [art, err] = useArtifact('compression');
  const c = report?.compression;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <ResultCard title="The evolved mask: all 384 numbers"
        subtitle={art ? `${art.dims_kept} lit dimensions survived selection; the rest are dropped from every vector` : ''}>
        {art ? (
          <>
            <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(48, minmax(0, 1fr))' }}>
              {art.mask.map((b, i) => <div key={i} className="aspect-square rounded-[2px]" style={{ background: b ? '#2fbf71' : '#eef2f7' }} title={`dim ${i}`} />)}
            </div>
            <div className="mt-4"><LineChart height={110} series={[
              { label: 'best fitness', values: art.history.map((x) => x.best_fitness), color: '#2fbf71', width: 2.5 },
              { label: 'mean', values: art.history.map((x) => x.mean_fitness), color: '#86efac', dash: '4 3' },
            ]} /></div>
          </>
        ) : <Loading error={err} />}
      </ResultCard>
      <ResultCard title="Held-out effect" subtitle='Small test set, so read accuracy as "about the same", not "better"'>
        {c ? (
          <div className="space-y-3">
            <CompareBar label="Dimensions per vector" base={c.baseline.dims_kept} opt={c.optimized.dims_kept} max={384} color="#2fbf71" format={(v) => v} lowerIsBetter />
            <CompareBar label="Bytes per vector" base={c.baseline.bytes_per_vector} opt={c.optimized.bytes_per_vector} max={1536} color="#2fbf71" format={(v) => v} lowerIsBetter />
            <CompareBar label="nDCG@5 in reduced space" base={c.baseline.ndcg_at_5} opt={c.optimized.ndcg_at_5} color="#2fbf71" format={f3} />
            <div className="grid grid-cols-2 gap-2 pt-1 text-center">
              <div className="rounded-xl bg-emerald-50 p-3"><div className="text-xl font-bold text-emerald-700">{c.improvement.memory_saved_pct}%</div><div className="text-[11px] text-emerald-800">memory saved</div></div>
              <div className="rounded-xl bg-slate-50 p-3"><div className="text-xl font-bold text-slate-700">{c.improvement.search_speedup_x}×</div><div className="text-[11px] text-slate-600">scan speed-up</div></div>
            </div>
          </div>
        ) : <Loading />}
      </ResultCard>
    </div>
  );
}

/* --------------------------------------------------------------- routing -- */
export function RoutingResults({ report }) {
  const [art, err] = useArtifact('routing');
  const r = report?.routing;
  const pm = art?.pheromone_matrix;
  const max = pm ? Math.max(...pm.matrix.flat()) : 1;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <ResultCard title="Learned pheromone: question type × note section"
        subtitle="Darker = stronger trail. Each row shows where the colony learned to look first.">
        {pm ? (
          <div className="overflow-x-auto">
            <table className="text-[10px]">
              <tbody>
                {pm.intents.map((intent, i) => (
                  <tr key={intent}>
                    <td className="pr-2 text-right font-semibold text-slate-600">{intent}</td>
                    {pm.matrix[i].map((v, p) => (
                      <td key={p} className="p-[1px]">
                        <div className="h-4 w-4 rounded-[3px]" title={`${pm.partitions[p]}: ${v.toFixed(3)}`}
                          style={{ background: `rgba(245,165,36,${0.05 + 0.95 * Math.sqrt(v / max)})` }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-[11px] text-slate-500">{pm.partitions.length} partitions = 6 note types × 5 SOAP sections + narrative. Hover a cell for its name.</div>
          </div>
        ) : <Loading error={err} />}
      </ResultCard>
      <ResultCard title="All labelled questions: full scan vs ACO routing" subtitle={r ? `${r.baseline.queries} queries` : ''}>
        {r ? (
          <div className="space-y-3">
            <CompareBar label="Chunks scanned per query" base={r.baseline.mean_chunks_scanned} opt={r.optimized.mean_chunks_scanned} max={r.baseline.mean_chunks_scanned} color="#f5a524" format={(v) => Math.round(v)} lowerIsBetter />
            <CompareBar label="Partitions probed" base={r.baseline.mean_partitions_scanned} opt={r.optimized.mean_partitions_scanned} max={r.baseline.mean_partitions_scanned} color="#f5a524" format={(v) => Math.round(v)} lowerIsBetter />
            <CompareBar label="Hit rate (answer inside routed partitions)" base={r.baseline.hit_rate} opt={r.optimized.hit_rate} color="#f5a524" format={pctf} />
            {art && <LineChart height={100} xLabel="iteration" series={[{ label: 'training hit rate', values: art.history.map((x) => x.hit_rate), color: '#f5a524', width: 2 }]} />}
            <div className="text-[11px] text-slate-500">A miss triggers a full scan, so it costs time, not a wrong answer.</div>
          </div>
        ) : <Loading />}
      </ResultCard>
    </div>
  );
}

/** One-line headline numbers for each chapter, read from the live report. */
export function headline(key, report) {
  if (!report) return null;
  const p = (v) => `${v > 0 ? '+' : ''}${Number(v).toFixed(1)}%`;
  switch (key) {
    case 'ga': return [
      ['Search nDCG@5', `${f3(report.ranking.baseline.ndcg_at_5)} → ${f3(report.ranking.optimized.ndcg_at_5)}`, p(report.ranking.improvement_pct.ndcg_at_5)],
      ['Task agreement', `${pctf(report.tasks.baseline.pairwise_agreement)} → ${pctf(report.tasks.optimized.pairwise_agreement)}`, p(report.tasks.improvement_pct.pairwise_agreement)],
    ];
    case 'pso': return [['Search nDCG@5', `${f3(report.ranking.baseline.ndcg_at_5)} → ${f3(report.ranking.optimized.ndcg_at_5)}`, p(report.ranking.improvement_pct.ndcg_at_5)], ['Deployed', report.ranking.selected, '']];
    case 'ais': return [['Errors caught', pctf(report.immune.metrics.detection_rate), ''], ['False alarms', pctf(report.immune.metrics.false_alarm_rate), '']];
    case 'bga': return [['Dimensions', `384 → ${report.compression.optimized.dims_kept}`, ''], ['Memory', `−${report.compression.improvement.memory_saved_pct}%`, '']];
    case 'aco': return [['Chunks scanned', `${Math.round(report.routing.baseline.mean_chunks_scanned)} → ${Math.round(report.routing.optimized.mean_chunks_scanned)}`, `−${report.routing.optimized.scan_reduction_pct}%`], ['Hit rate', pctf(report.routing.optimized.hit_rate), '']];
    default: return null;
  }
}

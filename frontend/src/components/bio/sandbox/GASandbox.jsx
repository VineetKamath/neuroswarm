import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GeneticAlgorithm } from '../../../bio/engines';
import {
  SIGNALS, TOY_QUERIES, BASELINE_GENOME, toyFitness, rankQuery,
} from '../../../bio/toyProblem';
import { Scope } from '../Primitives';
import { Slider, Transport, Mechanism, Experiments, Readout, MiniChart } from './Controls';

const COLOR = '#6366f1';

const DEFAULTS = {
  populationSize: 20, crossoverRate: 0.85, mutationRate: 0.15,
  mutationSigma: 0.18, elitism: 2, tournamentSize: 3,
};

const EXPERIMENTS = [
  {
    label: 'Freeze all variation (mutation 0, crossover 0)',
    expect: 'No operator can now create a genome that is not already in the population. Within about five generations fitness flatlines permanently and the 20 genomes collapse to two or three clones — selection alone cannot invent anything.',
    params: { mutationRate: 0, crossoverRate: 0 },
  },
  {
    label: 'Mutation only (crossover 0)',
    expect: 'Still improves, but slowly — this is parallel hill-climbing with no recombination, so useful traits discovered by different genomes can never be combined.',
    params: { mutationRate: 0.25, crossoverRate: 0 },
  },
  {
    label: 'Mutation 1.0, large steps',
    expect: 'Every gene is disturbed every generation. This is random search wearing a GA costume — the best line stops climbing because good solutions are destroyed as fast as they are found.',
    params: { mutationRate: 1, mutationSigma: 0.45 },
  },
  {
    label: 'Turn off elitism (small population, high mutation)',
    expect: 'Watch the best-fitness line: it now DIPS between generations, because an unlucky crossover can destroy the best genome. With elitism on, that line provably never goes down.',
    params: { elitism: 0, populationSize: 10, mutationRate: 0.5, mutationSigma: 0.45 },
  },
  {
    label: 'Tournament size 1',
    expect: 'Selection becomes a coin toss — fitness no longer decides who reproduces. The best genome may survive by luck, but the population as a whole stays much weaker (watch the mean line sag).',
    params: { tournamentSize: 1 },
  },
  {
    label: 'Back to healthy defaults',
    expect: 'Balanced exploration and exploitation: fast early gains, then fine-tuning toward the best weight vector.',
    params: DEFAULTS,
  },
];

export const GASandbox = () => {
  const [params, setParams] = useState(DEFAULTS);
  const [playing, setPlaying] = useState(false);
  const [, force] = useState(0);
  const [note, setNote] = useState(null);
  const [seed, setSeed] = useState(42);
  const gaRef = useRef(null);
  const timerRef = useRef(null);

  const build = useCallback(() => {
    gaRef.current = new GeneticAlgorithm({
      genomeLength: 5, seed, fitnessFn: toyFitness, ...params,
    });
    force((n) => n + 1);
  }, [params, seed]);

  // Rebuild only when the seed changes; parameter edits apply to the live run
  // so you can change mutation mid-flight and watch the effect immediately.
  useEffect(() => { build(); /* eslint-disable-next-line */ }, [seed]);
  useEffect(() => { if (gaRef.current) gaRef.current.setParams(params); }, [params]);

  useEffect(() => {
    if (!playing) return undefined;
    timerRef.current = setInterval(() => {
      if (gaRef.current.generation >= 120) { setPlaying(false); return; }
      gaRef.current.step();
      force((n) => n + 1);
    }, 260);
    return () => clearInterval(timerRef.current);
  }, [playing]);

  const ga = gaRef.current;
  const baselineFitness = useMemo(() => toyFitness(BASELINE_GENOME), []);

  if (!ga) return null;

  const order = ga.population.map((_, i) => i).sort((a, b) => ga.fitness[b] - ga.fitness[a]);
  const best = ga.population[order[0]];
  const eliteSet = new Set(order.slice(0, ga.elitism));
  const lastOffspring = ga.lastEvents.filter((e) => e.type === 'offspring');
  const sampleEvent = lastOffspring[0];

  const apply = (e) => {
    setParams((p) => ({ ...p, ...e.params }));
    setNote(e.expect);
  };

  return (
    <div className="space-y-4">
      <Mechanism
        color={COLOR}
        title="Genetic Algorithm — how one generation actually works"
        formula={`fitness(genome) = mean nDCG@3 over 3 clinical queries

child = mutate( crossover( tournament(pop), tournament(pop) ) )
next_generation = elites ++ children`}
        steps={[
          { title: 'Evaluate', body: 'Every genome is scored by the fitness function. Here a genome is five ranking weights, and fitness is how well those weights rank three real clinical queries.' },
          { title: 'Select (tournament)', body: 'Pick k genomes at random; the fittest wins the right to reproduce. Larger k means stronger selection pressure — faster convergence, but a higher risk of getting stuck.' },
          { title: 'Crossover (BLX-α)', body: 'Two parents produce children whose genes are sampled from an interval spanning both. This recombines partial solutions rather than averaging them away.' },
          { title: 'Mutate (Gaussian creep)', body: 'Each gene has a small chance of being nudged. Note that BLX-alpha crossover already samples slightly OUTSIDE the parent interval, so on real-valued genomes it explores too — mutation matters most for keeping diversity alive late in a run. On the binary genomes in lab 4, crossover cannot invent a bit no parent has, so there mutation is strictly essential.' },
          { title: 'Elitism', body: 'The top few genomes are copied through untouched, guaranteeing the best solution found so far can never be lost.' },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Scope
          title="Live evolution — five ranking weights"
          subtitle="Each row is one genome in the population. Bar length is that signal's weight."
        >
          <div className="space-y-3 p-4">
            <Transport
              playing={playing} color={COLOR} generation={ga.generation}
              onPlay={() => setPlaying((p) => !p)}
              onStep={() => { ga.step(); force((n) => n + 1); }}
              onReset={() => { setPlaying(false); setSeed((s) => s + 1); }}
            />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Readout label="Best fitness" value={ga.best.fitness.toFixed(4)} color="#a5b4fc" />
              <Readout label="Mean fitness" value={(ga.fitness.reduce((a, b) => a + b, 0) / ga.fitness.length).toFixed(4)} />
              <Readout label="Distinct genomes"
                       value={`${new Set(ga.population.map((g) => g.map((x) => x.toFixed(4)).join(','))).size} / ${ga.population.length}`}
                       sub={ga.history[ga.history.length - 1].diversity < 0.03 ? 'converged' : 'exploring'} />
              <Readout label="Baseline" value={baselineFitness.toFixed(4)} color="#94a3b8" sub="similarity only" />
            </div>

            <MiniChart history={ga.history} color={COLOR} height={110} />

            {/* population as weight-bar rows */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 pl-7 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">
                {SIGNALS.map((s) => (
                  <span key={s.key} className="flex-1 truncate" title={s.label}>{s.label.split(' ')[0]}</span>
                ))}
                <span className="w-12 text-right">fitness</span>
              </div>
              {order.slice(0, 10).map((idx) => {
                const genome = ga.population[idx];
                const isElite = eliteSet.has(idx);
                const isBest = idx === order[0];
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors ${
                      isBest ? 'bg-indigo-500/15' : isElite ? 'bg-slate-700/30' : ''}`}
                  >
                    <span className="w-5 text-center text-[9.5px] font-bold text-slate-500">
                      {isElite ? '★' : ''}
                    </span>
                    {genome.map((g, gi) => (
                      <div key={gi} className="h-3 flex-1 overflow-hidden rounded-sm bg-slate-800">
                        <div
                          className="h-full rounded-sm transition-all duration-300"
                          style={{
                            width: `${g * 100}%`,
                            backgroundColor: gi === 0 ? '#94a3b8' : COLOR,
                            opacity: isBest ? 1 : 0.55,
                          }}
                        />
                      </div>
                    ))}
                    <span className="ns-tabular w-12 text-right text-[10px] font-bold text-slate-300">
                      {ga.fitness[idx].toFixed(3)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[10.5px] text-slate-500">
              ★ = elite (copied through untouched). Grey bar = embedding similarity, the only
              signal the baseline used.
            </p>
          </div>
        </Scope>

        <div className="space-y-3">
          <div className="ns-scope p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              GA parameters
            </p>
            <div className="space-y-3">
              <Slider label="Population size" value={params.populationSize} min={6} max={60} step={2}
                      color={COLOR} onChange={(v) => setParams({ ...params, populationSize: v })}
                      hint="More genomes search more of the space per generation, at more cost." />
              <Slider label="Mutation rate" value={params.mutationRate} min={0} max={1} step={0.01}
                      color={COLOR} format={(v) => v.toFixed(2)}
                      onChange={(v) => setParams({ ...params, mutationRate: v })}
                      hint="Chance each gene is nudged. 0 = no new material; 1 = random search." />
              <Slider label="Mutation strength (σ)" value={params.mutationSigma} min={0.01} max={0.5} step={0.01}
                      color={COLOR} format={(v) => v.toFixed(2)}
                      onChange={(v) => setParams({ ...params, mutationSigma: v })}
                      hint="How far a mutated gene moves." />
              <Slider label="Crossover rate" value={params.crossoverRate} min={0} max={1} step={0.05}
                      color={COLOR} format={(v) => v.toFixed(2)}
                      onChange={(v) => setParams({ ...params, crossoverRate: v })}
                      hint="Chance two parents recombine rather than cloning." />
              <Slider label="Tournament size" value={params.tournamentSize} min={1} max={8} step={1}
                      color={COLOR} onChange={(v) => setParams({ ...params, tournamentSize: v })}
                      hint="Selection pressure. 1 = random; high = greedy." />
              <Slider label="Elitism" value={params.elitism} min={0} max={6} step={1}
                      color={COLOR} onChange={(v) => setParams({ ...params, elitism: v })}
                      hint="How many best genomes survive untouched." />
            </div>
          </div>

          <Experiments items={EXPERIMENTS} onApply={apply} color={COLOR} />
          {note && (
            <div className="ns-animate-in rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-[11px] leading-relaxed text-indigo-900">
              <span className="font-bold">What to watch: </span>{note}
            </div>
          )}
        </div>
      </div>

      {/* One generation's operators, spelled out */}
      {sampleEvent && (
        <div className="ns-card p-4">
          <h4 className="text-sm font-bold text-slate-900">
            Inside generation {ga.generation} — one child, step by step
          </h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <OpCard
              step="Selection"
              body={`Tournament A sampled genomes [${sampleEvent.contenders[0].join(', ')}] → winner #${sampleEvent.parents[0]}. Tournament B sampled [${sampleEvent.contenders[1].join(', ')}] → winner #${sampleEvent.parents[1]}.`}
            />
            <OpCard
              step="Crossover"
              body={sampleEvent.crossed
                ? `Parents #${sampleEvent.parents[0]} and #${sampleEvent.parents[1]} recombined with BLX-α — each child gene drawn from an interval spanning both parents.`
                : `Crossover did not fire this time (rate ${params.crossoverRate.toFixed(2)}), so the children are clones of their parents.`}
            />
            <OpCard
              step="Mutation"
              body={sampleEvent.mutated.length
                ? `Genes ${sampleEvent.mutated.map((i) => SIGNALS[i]?.label.split(' ')[0] || i).join(', ')} were nudged by Gaussian creep.`
                : 'No gene mutated in this child.'}
            />
          </div>
        </div>
      )}

      {/* What the evolved weights do to real rankings */}
      <div className="ns-card p-4">
        <h4 className="text-sm font-bold text-slate-900">
          What these weights do to the actual result list
        </h4>
        <p className="mt-1 text-xs text-slate-600">
          The same three queries, ranked by the baseline (similarity only) and by the best genome
          in the population right now. Green rows are the clinically correct answers.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {TOY_QUERIES.map((q) => (
            <QueryCompare key={q.question} query={q} evolved={best} />
          ))}
        </div>
      </div>
    </div>
  );
};

const OpCard = ({ step, body }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
    <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">{step}</p>
    <p className="mt-1 text-xs leading-relaxed text-slate-700">{body}</p>
  </div>
);

const QueryCompare = ({ query, evolved }) => {
  const base = rankQuery(BASELINE_GENOME, query);
  const opt = rankQuery(evolved, query);
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <p className="bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-800">
        {query.question}
      </p>
      <div className="grid grid-cols-2 divide-x divide-slate-200">
        <RankList title="Baseline" rows={base} />
        <RankList title="Evolved" rows={opt} highlight />
      </div>
    </div>
  );
};

const RankList = ({ title, rows, highlight }) => (
  <div>
    <p className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
      highlight ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-500'}`}>
      {title}
    </p>
    <ol className="divide-y divide-slate-100">
      {rows.slice(0, 4).map((r, i) => (
        <li
          key={r.id}
          className={`flex items-center gap-1.5 px-2 py-1.5 ${
            r.rel >= 1 ? 'bg-emerald-50' : r.rel > 0 ? 'bg-emerald-50/40' : ''}`}
        >
          <span className="w-3 text-[9.5px] font-bold text-slate-400">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate text-[10.5px] text-slate-700" title={r.label}>
            {r.section}
          </span>
          {r.rel > 0 && <span className="text-[9px] font-bold text-emerald-600">✓</span>}
        </li>
      ))}
    </ol>
  </div>
);

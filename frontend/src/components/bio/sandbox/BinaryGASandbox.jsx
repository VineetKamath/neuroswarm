import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BinaryGeneticAlgorithm, mulberry32 } from '../../../bio/engines';
import { BIN_DIMS, makeDimensionValues, makeBinFitness } from '../../../bio/toyProblem';
import { Scope } from '../Primitives';
import { Slider, Transport, Mechanism, Experiments, Readout, MiniChart } from './Controls';

const COLOR = '#10b981';

const EXPERIMENTS = [
  {
    label: 'Parsimony pressure = 0',
    expect: 'Nothing penalises keeping dimensions, so the GA keeps almost all of them. Accuracy is maximal and compression is zero — the penalty term is what creates the trade-off.',
    params: { parsimony: 0 },
  },
  {
    label: 'Parsimony pressure = 1.2',
    expect: 'Shrinking now outweighs accuracy. The mask collapses to very few dimensions and retrieval quality falls off a cliff.',
    params: { parsimony: 1.2 },
  },
  {
    label: 'Bit-flip rate = 0.30',
    expect: 'The mask is scrambled every generation. Crossover cannot preserve any useful dimension group, so the run never converges.',
    params: { mutationRate: 0.30 },
  },
  {
    label: 'Balanced defaults',
    expect: 'The GA finds roughly a third of the dimensions — mostly the genuinely informative ones — for a large size saving at little accuracy cost.',
    params: { parsimony: 0.35, mutationRate: 0.03 },
  },
];

export const BinaryGASandbox = () => {
  const [params, setParams] = useState({
    populationSize: 24, crossoverRate: 0.8, mutationRate: 0.03, elitism: 2, tournamentSize: 3,
  });
  const [parsimony, setParsimony] = useState(0.35);
  const [playing, setPlaying] = useState(false);
  const [seed, setSeed] = useState(21);
  const [, force] = useState(0);
  const [note, setNote] = useState(null);
  const gaRef = useRef(null);
  const timerRef = useRef(null);

  const values = useMemo(() => makeDimensionValues(mulberry32(seed * 7 + 3)), [seed]);
  const fitnessFn = useMemo(() => makeBinFitness(values, parsimony), [values, parsimony]);

  const build = useCallback(() => {
    gaRef.current = new BinaryGeneticAlgorithm({
      genomeLength: BIN_DIMS, seed, fitnessFn, ...params,
    });
    force((n) => n + 1);
    /* eslint-disable-next-line */
  }, [seed, fitnessFn]);

  useEffect(() => { build(); }, [build]);
  useEffect(() => { if (gaRef.current) gaRef.current.setParams(params); }, [params]);

  useEffect(() => {
    if (!playing) return undefined;
    timerRef.current = setInterval(() => {
      if (gaRef.current.generation >= 120) { setPlaying(false); return; }
      gaRef.current.step();
      force((n) => n + 1);
    }, 180);
    return () => clearInterval(timerRef.current);
  }, [playing]);

  const ga = gaRef.current;
  if (!ga) return null;

  const best = ga.best.genome;
  const kept = best.filter(Boolean).length;
  const keptUseful = best.reduce((s, b, i) => s + (b && values[i] > 0.5 ? 1 : 0), 0);
  const totalUseful = values.filter((v) => v > 0.5).length;

  return (
    <div className="space-y-4">
      <Mechanism
        color={COLOR}
        title="Binary Genetic Algorithm — evolving a dimension mask"
        formula={`genome = 64 bits, one per embedding dimension  (production: 384)
fitness = retrieval_accuracy(kept dims)  −  parsimony · (dims kept)

uniform crossover:  child[i] = coin_flip ? parentA[i] : parentB[i]
mutation:           each bit flips with probability p`}
        steps={[
          { title: 'The search space is enormous', body: 'Choosing which of 384 dimensions to keep means 2³⁸⁴ possible masks. You cannot enumerate that, and there is no gradient to follow.' },
          { title: 'Why greedy selection fails', body: 'Dimensions interact. One that looks useless on its own can be decisive alongside another, so adding dimensions one at a time gets trapped early.' },
          { title: 'Uniform crossover', body: 'Each child bit is taken from either parent by coin flip. This recombines useful GROUPS of dimensions rather than contiguous blocks — the building-block behaviour crossover exists for.' },
          { title: 'Bit-flip mutation', body: 'Each bit has a small chance of flipping, letting the GA reconsider a dimension it had discarded.' },
          { title: 'The parsimony term', body: 'Without a size penalty the GA would simply keep everything. That penalty is what turns this into a real trade-off between accuracy and index size.' },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Scope
          title="The evolving mask — 64 dimensions"
          subtitle="Lit cells survived selection. Cell brightness shows each dimension's hidden usefulness, which the GA cannot see directly."
        >
          <div className="space-y-3 p-4">
            <Transport
              playing={playing} color={COLOR} generation={ga.generation}
              onPlay={() => setPlaying((p) => !p)}
              onStep={() => { ga.step(); force((n) => n + 1); }}
              onReset={() => { setPlaying(false); setSeed((s) => s + 1); }}
            />

            <div className="grid grid-cols-8 gap-1">
              {best.map((bit, i) => (
                <div
                  key={i}
                  title={`dim ${i} — usefulness ${values[i].toFixed(2)} — ${bit ? 'kept' : 'dropped'}`}
                  className="aspect-square rounded-sm transition-all duration-300"
                  style={{
                    backgroundColor: bit
                      ? `rgba(16,185,129,${0.3 + values[i] * 0.7})`
                      : 'rgba(100,116,139,.14)',
                    outline: bit && values[i] > 0.5 ? '1px solid rgba(52,211,153,.7)' : 'none',
                  }}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Readout label="Dimensions kept" value={`${kept} / ${BIN_DIMS}`} color="#6ee7b7" />
              <Readout label="Useful dims found" value={`${keptUseful} / ${totalUseful}`}
                       color={keptUseful / totalUseful > 0.8 ? '#34d399' : '#fbbf24'} />
              <Readout label="Memory saved" value={`${(100 * (1 - kept / BIN_DIMS)).toFixed(0)}%`} />
              <Readout label="Fitness" value={ga.best.fitness.toFixed(4)} color="#6ee7b7" />
            </div>

            <MiniChart history={ga.history} color={COLOR} height={110} />

            <p className="text-[10.5px] leading-relaxed text-slate-500">
              Outlined cells are genuinely useful dimensions the GA correctly kept. It has no direct
              access to usefulness — it only ever sees the fitness score, so recovering them is the
              search problem, not a lookup.
            </p>
          </div>
        </Scope>

        <div className="space-y-3">
          <div className="ns-scope p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Parameters
            </p>
            <div className="space-y-3">
              <Slider label="Parsimony pressure" value={parsimony} min={0} max={1.5} step={0.05} color={COLOR}
                      format={(v) => v.toFixed(2)} onChange={setParsimony}
                      hint="How hard the GA is pushed toward fewer dimensions. This creates the accuracy/size trade-off." />
              <Slider label="Bit-flip rate" value={params.mutationRate} min={0} max={0.35} step={0.005} color={COLOR}
                      format={(v) => v.toFixed(3)}
                      onChange={(v) => setParams({ ...params, mutationRate: v })}
                      hint="Chance each bit flips. Too high and useful groups are destroyed faster than crossover builds them." />
              <Slider label="Crossover rate" value={params.crossoverRate} min={0} max={1} step={0.05} color={COLOR}
                      format={(v) => v.toFixed(2)}
                      onChange={(v) => setParams({ ...params, crossoverRate: v })} />
              <Slider label="Tournament size" value={params.tournamentSize} min={1} max={8} step={1} color={COLOR}
                      onChange={(v) => setParams({ ...params, tournamentSize: v })} />
              <Slider label="Elitism" value={params.elitism} min={0} max={6} step={1} color={COLOR}
                      onChange={(v) => setParams({ ...params, elitism: v })} />
            </div>
          </div>

          <Experiments
            items={EXPERIMENTS}
            onApply={(e) => {
              if (e.params.parsimony !== undefined) setParsimony(e.params.parsimony);
              const rest = { ...e.params }; delete rest.parsimony;
              if (Object.keys(rest).length) setParams((p) => ({ ...p, ...rest }));
              setNote(e.expect);
            }}
            color={COLOR}
          />
          {note && (
            <div className="ns-animate-in rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] leading-relaxed text-emerald-900">
              <span className="font-bold">What to watch: </span>{note}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

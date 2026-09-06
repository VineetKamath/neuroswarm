import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AntColony } from '../../../bio/engines';
import {
  ACO_INTENTS, ACO_PARTITIONS, ACO_SIZES, acoGoldFor,
} from '../../../bio/toyProblem';
import { Scope } from '../Primitives';
import { Slider, Transport, Mechanism, Experiments, Readout } from './Controls';

const COLOR = '#f59e0b';

const EXPERIMENTS = [
  {
    label: 'Evaporation = 0',
    expect: 'Trails never fade. The first lucky route locks in permanently and the colony can never adapt if documentation habits change — this is exactly what a static lookup table does wrong.',
    params: { evaporation: 0 },
  },
  {
    label: 'Evaporation = 0.6',
    expect: 'Trails fade almost as fast as they are laid. The colony forgets everything it learns and keeps re-exploring from scratch.',
    params: { evaporation: 0.6 },
  },
  {
    label: 'α = 0 (ignore pheromone)',
    expect: 'Ants stop reading the trails entirely. This is pure random probing — no learning happens at all, however long you run it.',
    params: { alpha: 0 },
  },
  {
    label: 'Probe budget = 1',
    expect: 'Each query may only check one partition. Maximum efficiency, lowest hit rate — the sharpest version of the recall/cost trade-off.',
    params: { budget: 1 },
  },
  {
    label: 'Balanced defaults',
    expect: 'Trails concentrate on the partitions that actually answer each intent, while evaporation keeps the policy adaptable.',
    params: { evaporation: 0.12, alpha: 1, beta: 2, budget: 2 },
  },
];

export const ACOSandbox = () => {
  const [params, setParams] = useState({
    nAnts: 14, evaporation: 0.12, alpha: 1, beta: 2, budget: 2,
  });
  const [playing, setPlaying] = useState(false);
  const [seed, setSeed] = useState(99);
  const [, force] = useState(0);
  const [note, setNote] = useState(null);
  const colonyRef = useRef(null);
  const timerRef = useRef(null);

  const build = useCallback(() => {
    colonyRef.current = new AntColony({
      intents: ACO_INTENTS, partitions: ACO_PARTITIONS, sizes: ACO_SIZES,
      goldFor: acoGoldFor, seed, ...params,
    });
    force((n) => n + 1);
    /* eslint-disable-next-line */
  }, [seed]);

  useEffect(() => { build(); }, [build]);
  useEffect(() => { if (colonyRef.current) colonyRef.current.setParams(params); }, [params]);

  useEffect(() => {
    if (!playing) return undefined;
    timerRef.current = setInterval(() => {
      if (colonyRef.current.iteration >= 150) { setPlaying(false); return; }
      colonyRef.current.step();
      force((n) => n + 1);
    }, 200);
    return () => clearInterval(timerRef.current);
  }, [playing]);

  const colony = colonyRef.current;
  if (!colony) return null;

  const maxTau = Math.max(...colony.tau.flat(), 0.001);
  const last = colony.history[colony.history.length - 1];

  // Layout: intents on the left, partitions on the right, edges between.
  const W = 620; const H = 340;
  const iy = (i) => 46 + i * ((H - 80) / Math.max(1, ACO_INTENTS.length - 1));
  const py = (p) => 26 + p * ((H - 52) / Math.max(1, ACO_PARTITIONS.length - 1));
  const IX = 96; const PX = 470;

  return (
    <div className="space-y-4">
      <Mechanism
        color={COLOR}
        title="Ant Colony Optimization — learning routes from outcomes"
        formula={`P(choose partition p | intent i)  ∝  τ(i,p)^α  ·  η(i,p)^β
                                    ↑ trail    ↑ heuristic

evaporate:  τ ← (1 − ρ) · τ            ← forgetting
deposit:    τ ← τ + Q·quality / rank   ← reinforcement`}
        steps={[
          { title: 'The graph', body: 'Left nodes are query intents ("medication", "lab"…). Right nodes are searchable partitions of the record. An ant walks from an intent to a small set of partitions.' },
          { title: 'Probabilistic choice', body: 'Ants pick partitions with probability proportional to τ^α · η^β — pheromone strength times a heuristic prior. It is a weighted dice roll, never a fixed rule, which is what keeps exploration alive.' },
          { title: 'Reward the good routes', body: 'If the gold partition was found, the ant deposits pheromone in proportion to how early and how cheaply it found it. Earlier steps on a successful route earn more credit.' },
          { title: 'Evaporation is the point', body: 'Every trail decays each iteration. Without decay the first lucky route locks in forever. Decay is what lets the policy forget a route that has stopped working — the reason this beats a static table.' },
          { title: 'Result', body: 'After enough iterations, trails concentrate on partitions that genuinely answer each intent, so the search can probe 2 partitions instead of all 8.' },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Scope
          title="Pheromone trails — intent to partition"
          subtitle="Thicker, brighter lines are stronger trails. Green nodes are the partitions that genuinely answer each intent."
        >
          <div className="space-y-3 p-4">
            <Transport
              playing={playing} color={COLOR} generation={colony.iteration} label="iteration"
              onPlay={() => setPlaying((p) => !p)}
              onStep={() => { colony.step(); force((n) => n + 1); }}
              onReset={() => { setPlaying(false); setSeed((s) => s + 1); }}
            />

            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 340 }}>
              {/* edges */}
              {ACO_INTENTS.map((intent, i) =>
                ACO_PARTITIONS.map((part, p) => {
                  const t = colony.tau[i][p] / maxTau;
                  if (t < 0.06) return null;
                  const isGold = acoGoldFor(intent).includes(part);
                  return (
                    <line
                      key={`${i}-${p}`}
                      x1={IX + 4} y1={iy(i)} x2={PX - 4} y2={py(p)}
                      stroke={isGold ? '#fbbf24' : '#64748b'}
                      strokeWidth={0.4 + t * 4.6}
                      opacity={0.10 + t * 0.75}
                      className={t > 0.6 ? 'ns-dash' : undefined}
                    />
                  );
                }))}

              {/* live ant walks from the last iteration */}
              {colony.lastWalks.slice(0, 6).map((wlk, k) =>
                wlk.route.map((p, r) => (
                  <circle
                    key={`w${k}-${r}`}
                    r="2.6"
                    fill={wlk.foundAt >= 0 ? '#fcd34d' : '#475569'}
                    opacity="0.85"
                  >
                    <animateMotion
                      dur="1.1s" repeatCount="indefinite" begin={`${k * 0.13 + r * 0.05}s`}
                      path={`M ${IX + 4} ${iy(wlk.intent)} L ${PX - 4} ${py(p)}`}
                    />
                  </circle>
                )))}

              {/* intent nodes */}
              {ACO_INTENTS.map((intent, i) => (
                <g key={intent}>
                  <rect x={8} y={iy(i) - 12} width={IX - 12} height={24} rx={7}
                        fill="rgba(245,158,11,.14)" stroke="rgba(245,158,11,.5)" />
                  <text x={IX / 2} y={iy(i) + 4} textAnchor="middle" fontSize="10.5"
                        fill="#fcd34d" fontWeight="600">{intent}</text>
                </g>
              ))}

              {/* partition nodes */}
              {ACO_PARTITIONS.map((part, p) => {
                const isGold = ACO_INTENTS.some((it) => acoGoldFor(it).includes(part));
                return (
                  <g key={part}>
                    <rect x={PX} y={py(p) - 10} width={W - PX - 8} height={20} rx={6}
                          fill={isGold ? 'rgba(16,185,129,.13)' : 'rgba(100,116,139,.13)'}
                          stroke={isGold ? 'rgba(52,211,153,.5)' : 'rgba(100,116,139,.35)'} />
                    <text x={PX + 8} y={py(p) + 4} fontSize="9.5"
                          fill={isGold ? '#6ee7b7' : '#94a3b8'}>
                      {part} · {ACO_SIZES[part]}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Readout label="Hit rate" value={last ? `${(last.hitRate * 100).toFixed(0)}%` : '—'}
                       color={last && last.hitRate > 0.7 ? '#34d399' : '#fbbf24'}
                       sub="gold partition probed" />
              <Readout label="Chunks scanned" value={last ? last.meanScanned.toFixed(0) : '—'}
                       sub={`of ${Object.values(ACO_SIZES).reduce((a, b) => a + b, 0)} total`} />
              <Readout label="Scan reduction"
                       value={last ? `${(100 * (1 - last.meanScanned / Object.values(ACO_SIZES).reduce((a, b) => a + b, 0))).toFixed(0)}%` : '—'}
                       color="#fcd34d" />
              <Readout label="Total pheromone" value={last ? last.totalPheromone.toFixed(1) : '—'} />
            </div>

            {/* what the trained colony would serve */}
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Routes the colony would serve right now
              </p>
              <div className="mt-1.5 space-y-1">
                {ACO_INTENTS.map((intent, i) => {
                  const route = colony.bestRoute(i).map((k) => ACO_PARTITIONS[k]);
                  const gold = acoGoldFor(intent);
                  const good = route.some((r) => gold.includes(r));
                  return (
                    <div key={intent} className="flex items-center gap-2 text-[10.5px]">
                      <span className="w-20 shrink-0 font-semibold text-amber-300">{intent}</span>
                      <span className="text-slate-500">→</span>
                      <span className={`truncate ${good ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {route.join('  ·  ')}
                      </span>
                      <span className="ml-auto shrink-0">{good ? '✓' : '✗ misses gold'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Scope>

        <div className="space-y-3">
          <div className="ns-scope p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Colony parameters
            </p>
            <div className="space-y-3">
              <Slider label="Evaporation (ρ)" value={params.evaporation} min={0} max={0.6} step={0.01} color={COLOR}
                      format={(v) => v.toFixed(2)}
                      onChange={(v) => setParams({ ...params, evaporation: v })}
                      hint="How fast trails fade. 0 = never forgets (locks in); high = forgets everything." />
              <Slider label="Pheromone weight (α)" value={params.alpha} min={0} max={3} step={0.1} color={COLOR}
                      format={(v) => v.toFixed(1)}
                      onChange={(v) => setParams({ ...params, alpha: v })}
                      hint="How much ants trust the learned trails. 0 = ignore learning entirely." />
              <Slider label="Heuristic weight (β)" value={params.beta} min={0} max={4} step={0.1} color={COLOR}
                      format={(v) => v.toFixed(1)}
                      onChange={(v) => setParams({ ...params, beta: v })}
                      hint="How much ants trust the prior guess before any learning." />
              <Slider label="Ants per iteration" value={params.nAnts} min={2} max={40} step={2} color={COLOR}
                      onChange={(v) => setParams({ ...params, nAnts: v })}
                      hint="More ants gather more evidence per iteration." />
              <Slider label="Probe budget" value={params.budget} min={1} max={5} step={1} color={COLOR}
                      onChange={(v) => setParams({ ...params, budget: v })}
                      hint="Partitions each query may check. Lower = faster but riskier." />
            </div>
          </div>

          <Experiments
            items={EXPERIMENTS}
            onApply={(e) => { setParams((p) => ({ ...p, ...e.params })); setNote(e.expect); }}
            color={COLOR}
          />
          {note && (
            <div className="ns-animate-in rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
              <span className="font-bold">What to watch: </span>{note}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Dna, Wind, ShieldCheck, Boxes, Route } from 'lucide-react';
import { ALGO_HEX } from '../../api/bio';

/**
 * The five algorithms, named explicitly.
 *
 * This is the first thing on the page for a reason: an assessor should be able
 * to read the algorithm names, their nature-inspired origin and where each one
 * is used without scrolling or clicking anything.
 */
export const ALGORITHMS = [
  {
    key: 'ranking', n: 1, icon: Dna, color: ALGO_HEX.ranking,
    name: 'Genetic Algorithm',
    second: 'Particle Swarm Optimization',
    family: 'Evolutionary + Swarm Intelligence',
    inspiration: 'Darwinian natural selection; flocking birds',
    appliedTo: 'Clinical search result ranking',
    short: 'GA + PSO',
  },
  {
    key: 'tasks', n: 2, icon: Wind, color: ALGO_HEX.tasks,
    name: 'Genetic Algorithm',
    family: 'Evolutionary Computation',
    inspiration: 'Selection, crossover and mutation across generations',
    appliedTo: 'Nurse care-task prioritization',
    short: 'GA',
  },
  {
    key: 'immune', n: 3, icon: ShieldCheck, color: ALGO_HEX.immune,
    name: 'Artificial Immune System',
    second: 'Negative Selection Algorithm',
    family: 'Immune-Inspired Computation',
    inspiration: 'T-cell maturation in the thymus',
    appliedTo: 'Vital-sign anomaly and data-error detection',
    short: 'AIS',
  },
  {
    key: 'compression', n: 4, icon: Boxes, color: ALGO_HEX.compression,
    name: 'Binary Genetic Algorithm',
    family: 'Evolutionary Computation',
    inspiration: 'Genetic recombination of building blocks',
    appliedTo: 'Embedding dimension selection (384 → 146)',
    short: 'Binary GA',
  },
  {
    key: 'routing', n: 5, icon: Route, color: ALGO_HEX.routing,
    name: 'Ant Colony Optimization',
    family: 'Swarm Intelligence',
    inspiration: 'Pheromone trails laid by foraging ants',
    appliedTo: 'Multi-source retrieval routing',
    short: 'ACO',
  },
];

export const AlgorithmRoster = ({ onJump, status }) => (
  <div className="ns-card overflow-hidden">
    <div className="border-b border-slate-200 px-5 py-3.5">
      <h2 className="text-base font-bold text-slate-900">
        The five bio-inspired algorithms used in NeuroSwarm
      </h2>
      <p className="mt-0.5 text-xs text-slate-600">
        Three algorithm families — evolutionary, swarm intelligence and immune-inspired.
        Click any card to open its interactive lab.
      </p>
    </div>

    <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-5">
      {ALGORITHMS.map((a) => {
        const Icon = a.icon;
        const live = status?.algorithms?.[a.key]?.active;
        return (
          <button
            key={a.key}
            onClick={() => onJump && onJump(a.key)}
            className="ns-focus group bg-white p-4 text-left transition hover:bg-slate-50"
          >
            <div className="flex items-center gap-2">
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: a.color }}
              >
                {a.n}
              </span>
              <Icon className="h-4 w-4" style={{ color: a.color }} />
              {live && (
                <span className="ml-auto inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"
                      title="trained and serving traffic" />
              )}
            </div>

            <h3 className="mt-2.5 text-sm font-bold leading-tight text-slate-900">{a.name}</h3>
            {a.second && (
              <p className="text-xs font-semibold leading-tight" style={{ color: a.color }}>
                + {a.second}
              </p>
            )}

            <dl className="mt-2.5 space-y-1.5 text-[11px] leading-snug">
              <div>
                <dt className="font-semibold uppercase tracking-wider text-slate-400">Family</dt>
                <dd className="text-slate-700">{a.family}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wider text-slate-400">Inspired by</dt>
                <dd className="text-slate-700">{a.inspiration}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wider text-slate-400">Applied to</dt>
                <dd className="font-medium text-slate-900">{a.appliedTo}</dd>
              </div>
            </dl>
          </button>
        );
      })}
    </div>
  </div>
);

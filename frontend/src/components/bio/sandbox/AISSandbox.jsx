import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NegativeSelection, mulberry32 } from '../../../bio/engines';
import {
  makeSelfSamples, normalizeVital, denormalizeVital, AIS_PRESETS,
} from '../../../bio/toyProblem';
import { Scope } from '../Primitives';
import { Slider, Transport, Mechanism, Experiments, Readout } from './Controls';

const COLOR = '#f43f5e';

const EXPERIMENTS = [
  {
    label: 'Shrink self-radius to 0.02',
    expect: 'Detectors crowd right up against the normal cloud. Detection rises, but so do false alarms — readings that are merely unusual now get flagged.',
    params: { selfRadius: 0.02 },
  },
  {
    label: 'Grow self-radius to 0.20',
    expect: 'A wide safety margin around normal. Almost no false alarms, but genuine errors close to normal now slip through undetected.',
    params: { selfRadius: 0.20 },
  },
  {
    label: 'Only 30 detectors',
    expect: 'Large gaps in non-self space. An anomaly can land in an uncovered hole and be missed entirely — coverage is the limiting factor.',
    params: { targetDetectors: 30 },
  },
  {
    label: 'Back to defaults',
    expect: 'Balanced: high coverage of non-self space with a margin that keeps false alarms near zero.',
    params: { selfRadius: 0.09, targetDetectors: 160 },
  },
];

export const AISSandbox = () => {
  const [selfRadius, setSelfRadius] = useState(0.09);
  const [targetDetectors, setTargetDetectors] = useState(160);
  const [selfCount, setSelfCount] = useState(60);
  const [seed, setSeed] = useState(13);
  const [playing, setPlaying] = useState(false);
  const [, force] = useState(0);
  const [probe, setProbe] = useState(null);
  const [note, setNote] = useState(null);
  const [showRejected, setShowRejected] = useState(true);

  const modelRef = useRef(null);
  const timerRef = useRef(null);
  const svgRef = useRef(null);

  const selfSamples = useMemo(
    () => makeSelfSamples(mulberry32(seed), selfCount),
    [seed, selfCount],
  );

  const rebuild = useCallback(() => {
    modelRef.current = new NegativeSelection({ selfSamples, selfRadius, seed, dims: 2 });
    setProbe(null);
    force((n) => n + 1);
  }, [selfSamples, selfRadius, seed]);

  useEffect(() => { rebuild(); }, [rebuild]);

  useEffect(() => {
    if (!playing) return undefined;
    timerRef.current = setInterval(() => {
      const m = modelRef.current;
      if (m.detectors.length >= targetDetectors) { setPlaying(false); return; }
      m.grow(4);
      force((n) => n + 1);
    }, 55);
    return () => clearInterval(timerRef.current);
  }, [playing, targetDetectors]);

  const model = modelRef.current;
  if (!model) return null;

  const SIZE = 420;
  const toPx = (v) => v * SIZE;

  const handleClick = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    const point = [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
    setProbe({ point, result: model.test(point), vitals: denormalizeVital(point) });
  };

  const testPreset = (p) => {
    const point = normalizeVital(p.hr, p.sys);
    setProbe({ point, result: model.test(point), vitals: { heart_rate: p.hr, bp_systolic: p.sys }, preset: p });
  };

  const coverage = model.detectors.length > 0 ? model.coverage(600) : 0;
  const rejectedCount = model.attempts - model.detectors.length;

  return (
    <div className="space-y-4">
      <Mechanism
        color={COLOR}
        title="Negative Selection — training on normal data only"
        formula={`for each random candidate detector d:
    if  distance(d, nearest self) ≤ self_radius:
        destroy d                       ← binds self, apoptosis
    else:
        d.radius ← distance(d, nearest self) − self_radius
        keep d                          ← matured detector

anomaly(x)  ⟺  ∃ detector d :  distance(x, d) ≤ d.radius`}
        steps={[
          { title: 'Define "self"', body: 'Collect readings known to be normal. Green dots below are 60 such readings on two axes (heart rate × systolic BP). No error examples are used anywhere in training.' },
          { title: 'Propose random detectors', body: 'Generate a candidate at a random point in the space. This is a naive immature T-cell leaving the bone marrow.' },
          { title: 'Censor (the key step)', body: 'If the candidate falls within self_radius of ANY normal reading, it is destroyed. Only candidates that react to nothing normal survive — this is thymic negative selection.' },
          { title: 'Grow a variable radius', body: 'Each survivor expands until it almost touches the self region. Big detectors blanket empty space cheaply; small ones squeeze into crevices near normal.' },
          { title: 'Detect', body: 'Any new reading falling inside a detector is flagged. Because detectors only cover non-self space, the system catches error types it was never shown.' },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Scope
          title="Self / non-self space — click anywhere to test a reading"
          subtitle="Green = normal training data. Rose circles = matured detectors. Faint red crosses = candidates destroyed for binding self."
        >
          <div className="space-y-3 p-4">
            <Transport
              playing={playing} color={COLOR} generation={model.detectors.length} label="detectors"
              onPlay={() => setPlaying((p) => !p)}
              onStep={() => { model.grow(8); force((n) => n + 1); }}
              onReset={() => { setPlaying(false); rebuild(); }}
              extra={(
                <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <input type="checkbox" checked={showRejected}
                         onChange={(e) => setShowRejected(e.target.checked)}
                         style={{ accentColor: COLOR }} />
                  show destroyed
                </label>
              )}
            />

            <svg
              ref={svgRef}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="w-full cursor-crosshair rounded-lg"
              style={{ height: 420, background: 'rgba(15,23,42,.45)' }}
              onClick={handleClick}
            >
              {/* detectors */}
              {model.detectors.map((d, i) => (
                <circle
                  key={i}
                  cx={toPx(d.center[0])} cy={SIZE - toPx(d.center[1])}
                  r={Math.max(1.5, d.radius * SIZE)}
                  fill="rgba(244,63,94,.05)" stroke="rgba(244,63,94,.40)" strokeWidth="0.9"
                  className="ns-animate-in"
                />
              ))}

              {/* destroyed candidates */}
              {showRejected && model.rejected.slice(-40).map((r, i) => (
                <g key={`r${i}`} opacity="0.5">
                  <line x1={toPx(r.center[0]) - 3} y1={SIZE - toPx(r.center[1]) - 3}
                        x2={toPx(r.center[0]) + 3} y2={SIZE - toPx(r.center[1]) + 3}
                        stroke="#f87171" strokeWidth="1.2" />
                  <line x1={toPx(r.center[0]) - 3} y1={SIZE - toPx(r.center[1]) + 3}
                        x2={toPx(r.center[0]) + 3} y2={SIZE - toPx(r.center[1]) - 3}
                        stroke="#f87171" strokeWidth="1.2" />
                </g>
              ))}

              {/* self region */}
              {selfSamples.map((s, i) => (
                <g key={`s${i}`}>
                  <circle cx={toPx(s[0])} cy={SIZE - toPx(s[1])} r={selfRadius * SIZE}
                          fill="rgba(16,185,129,.09)" />
                  <circle cx={toPx(s[0])} cy={SIZE - toPx(s[1])} r="2.6" fill="#34d399" />
                </g>
              ))}

              {/* probe */}
              {probe && (
                <g>
                  <circle
                    cx={toPx(probe.point[0])} cy={SIZE - toPx(probe.point[1])} r="11"
                    fill="none" strokeWidth="2.2"
                    stroke={probe.result.anomalous ? '#fb7185' : '#38bdf8'}
                    className="ns-pulse-ring"
                    style={{ transformOrigin: `${toPx(probe.point[0])}px ${SIZE - toPx(probe.point[1])}px` }}
                  />
                  <circle cx={toPx(probe.point[0])} cy={SIZE - toPx(probe.point[1])} r="5.5"
                          fill={probe.result.anomalous ? '#fb7185' : '#38bdf8'}
                          stroke="#0b1220" strokeWidth="1.5" />
                </g>
              )}

              <text x={SIZE / 2} y={SIZE - 6} textAnchor="middle" fontSize="10" fill="#64748b">
                heart rate →
              </text>
              <text x={12} y={SIZE / 2} textAnchor="middle" fontSize="10" fill="#64748b"
                    transform={`rotate(-90 12 ${SIZE / 2})`}>
                systolic BP →
              </text>
            </svg>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Readout label="Detectors" value={model.detectors.length} color="#fda4af" />
              <Readout label="Destroyed" value={rejectedCount} sub="bound self or redundant" />
              <Readout label="Non-self coverage" value={`${(coverage * 100).toFixed(0)}%`}
                       color={coverage > 0.85 ? '#34d399' : '#fbbf24'} />
              <Readout label="Self samples" value={selfSamples.length} color="#34d399" />
            </div>

            {probe && (
              <div className={`ns-animate-in rounded-xl border p-3 ${
                probe.result.anomalous ? 'border-rose-500/40 bg-rose-500/10' : 'border-emerald-500/40 bg-emerald-500/10'}`}>
                <p className={`text-xs font-bold ${probe.result.anomalous ? 'text-rose-300' : 'text-emerald-300'}`}>
                  {probe.result.anomalous ? 'FLAGGED — a detector bound this reading' : 'ACCEPTED — inside the self region'}
                </p>
                <p className="mt-1 text-[11px] text-slate-300">
                  HR {probe.vitals.heart_rate} bpm · Systolic {probe.vitals.bp_systolic} mmHg
                  {probe.result.anomalous
                    ? ` · detector radius ${probe.result.detector.radius.toFixed(3)}, distance ${probe.result.distance.toFixed(3)}`
                    : ` · distance to nearest normal reading ${probe.result.distance.toFixed(3)}`}
                </p>
                {probe.preset && <p className="mt-1 text-[11px] text-slate-400">{probe.preset.note}</p>}
              </div>
            )}
          </div>
        </Scope>

        <div className="space-y-3">
          <div className="ns-scope p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Immune parameters
            </p>
            <div className="space-y-3">
              <Slider label="Self radius" value={selfRadius} min={0.01} max={0.25} step={0.005} color={COLOR}
                      format={(v) => v.toFixed(3)} onChange={setSelfRadius}
                      hint="Safety margin around each normal reading. The core sensitivity dial: small = catches more but risks false alarms." />
              <Slider label="Target detectors" value={targetDetectors} min={10} max={400} step={10} color={COLOR}
                      onChange={setTargetDetectors}
                      hint="How many matured detectors to grow. More = better coverage of non-self space." />
              <Slider label="Self samples" value={selfCount} min={10} max={160} step={5} color={COLOR}
                      onChange={setSelfCount}
                      hint="How much normal data the system learns from." />
            </div>
          </div>

          <div className="ns-scope p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Test a documentation error
            </p>
            <div className="space-y-1.5">
              {AIS_PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => testPreset(p)}
                  className="ns-focus block w-full rounded-lg border border-slate-700 px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-200 transition hover:border-rose-400 hover:bg-rose-500/10"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <Experiments
            items={EXPERIMENTS}
            onApply={(e) => {
              if (e.params.selfRadius !== undefined) setSelfRadius(e.params.selfRadius);
              if (e.params.targetDetectors !== undefined) setTargetDetectors(e.params.targetDetectors);
              setNote(e.expect);
            }}
            color={COLOR}
          />
          {note && (
            <div className="ns-animate-in rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] leading-relaxed text-rose-900">
              <span className="font-bold">What to watch: </span>{note}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

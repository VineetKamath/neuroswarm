import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Play, Pause, StepForward, RotateCcw } from 'lucide-react';
import { cx } from '../ui';

export const SPEEDS = {
  explain: { label: 'Explain', ms: 1100 },
  normal: { label: 'Normal', ms: 260 },
  fast: { label: 'Fast', ms: 50 },
};

/**
 * Drives a steppable simulation.
 * In "explain" speed a generation is broken into `phases`; each tick advances
 * one phase and the engine steps when the cycle restarts. That is what lets
 * the presenter narrate selection → crossover → mutation as it happens.
 */
export function usePlayer({ phases = [], onStep, initialSpeed = 'normal' }) {
  const n = Math.max(1, phases.length);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed);
  const [phase, setPhase] = useState(n - 1);
  const [stepAt, setStepAt] = useState(() => performance.now());
  const phaseRef = useRef(n - 1);
  const stepRef = useRef(onStep);
  stepRef.current = onStep;

  const advance = useCallback(() => {
    if (speed === 'explain' && n > 1) {
      const next = (phaseRef.current + 1) % n;
      if (next === 0) { stepRef.current?.(); setStepAt(performance.now()); }
      phaseRef.current = next; setPhase(next);
    } else {
      stepRef.current?.(); setStepAt(performance.now());
      phaseRef.current = n - 1; setPhase(n - 1);
    }
  }, [speed, n]);

  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(advance, SPEEDS[speed].ms);
    return () => clearInterval(id);
  }, [playing, speed, advance]);

  const resetPhase = () => { phaseRef.current = n - 1; setPhase(n - 1); setStepAt(performance.now()); };

  return {
    playing, setPlaying, toggle: () => setPlaying((p) => !p), speed, setSpeed, phase,
    step: advance, resetPhase, stepAt, duration: SPEEDS[speed].ms,
    explaining: speed === 'explain', phaseName: phases[phase],
  };
}

export function Transport({ player, onReset, generationLabel = 'Generation', generation, extra }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={player.toggle}
        className={cx('btn btn-sm min-w-[84px]', player.playing ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-white text-slate-900 hover:bg-slate-100')}>
        {player.playing ? <><Pause className="h-3.5 w-3.5" />Pause</> : <><Play className="h-3.5 w-3.5" />Play</>}
      </button>
      <button onClick={() => { player.setPlaying(false); player.step(); }} className="btn btn-sm bg-white/5 text-slate-200 hover:bg-white/10"
        title={player.explaining ? 'Advance one phase' : 'Advance one generation'}>
        <StepForward className="h-3.5 w-3.5" />{player.explaining ? 'Next phase' : 'Step'}
      </button>
      <button onClick={() => { player.setPlaying(false); player.resetPhase(); onReset(); }} className="btn btn-sm bg-white/5 text-slate-200 hover:bg-white/10">
        <RotateCcw className="h-3.5 w-3.5" />Reset
      </button>
      <div className="flex rounded-lg bg-white/5 p-0.5">
        {Object.entries(SPEEDS).map(([k, v]) => (
          <button key={k} onClick={() => player.setSpeed(k)}
            className={cx('rounded-md px-2 py-1 text-[11px] font-semibold', player.speed === k ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-slate-200')}>{v.label}</button>
        ))}
      </div>
      {extra}
      <div className="ml-auto rounded-lg bg-white/5 px-2.5 py-1 font-mono text-xs text-slate-300">
        {generationLabel} <span className="font-bold text-white">{generation}</span>
      </div>
    </div>
  );
}

export function Slider({ label, value, min, max, step = 0.01, onChange, format = (v) => v, color = '#a5b4fc', hint }) {
  return (
    <label className="block" title={hint}>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-medium text-slate-400">{label}</span>
        <span className="font-mono font-semibold text-slate-100">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10" style={{ accentColor: color }} />
    </label>
  );
}

export function Presets({ items, onPick, active }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((p) => (
        <button key={p.name} onClick={() => onPick(p)} title={p.note}
          className={cx('rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
            active === p.name ? 'border-white/40 bg-white/15 text-white' : 'border-white/10 text-slate-300 hover:border-white/30 hover:text-white')}>
          {p.name}
        </button>
      ))}
    </div>
  );
}

/** Phase rail shown above a simulation in Explain mode. */
export function PhaseRail({ phases, active, color }) {
  return (
    <div className="flex flex-wrap gap-1">
      {phases.map((p, i) => (
        <div key={p} className={cx('flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition',
          i === active ? 'text-slate-950' : 'bg-white/5 text-slate-400')} style={i === active ? { background: color } : undefined}>
          <span className="font-mono opacity-70">{i + 1}</span>{p}
        </div>
      ))}
    </div>
  );
}

export function Readout({ items }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl bg-white/[0.04] px-3 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{it.label}</div>
          <div className="mt-0.5 font-mono text-base font-semibold" style={{ color: it.color || '#f1f5f9' }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

/** Canvas that tracks its container width and draws at device pixel ratio. */
export function useCanvas(aspect = 0.62, maxHeight = 520) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 600, h: 372 });
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.max(280, Math.floor(e.contentRect.width));
      setSize({ w, h: Math.min(maxHeight, Math.floor(w * aspect)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect, maxHeight]);
  useLayoutEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size.w * dpr; c.height = size.h * dpr;
    c.style.width = `${size.w}px`; c.style.height = `${size.h}px`;
    c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [size]);
  return { wrapRef, canvasRef, size };
}

/** requestAnimationFrame loop bound to a draw callback held in a ref. */
export function useFrame(draw) {
  const ref = useRef(draw);
  ref.current = draw;
  useEffect(() => {
    let id;
    const loop = (t) => { ref.current?.(t); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
}

/* ---------------------------------------------------------- line chart -- */
export function LineChart({ series, height = 150, dark = false, yLabel, xLabel = 'generation', yDomain, legend = true }) {
  const W = 560; const H = height; const P = { l: 36, r: 10, t: 10, b: 22 };
  const all = series.flatMap((s) => s.values).filter((v) => v != null && Number.isFinite(v));
  if (!all.length) return <div style={{ height }} />;
  let [lo, hi] = yDomain || [Math.min(...all), Math.max(...all)];
  if (hi - lo < 1e-6) { hi += 0.5; lo -= 0.5; }
  const pad = (hi - lo) * 0.08; if (!yDomain) { lo -= pad; hi += pad; }
  const n = Math.max(...series.map((s) => s.values.length));
  const x = (i) => P.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - P.l - P.r));
  const y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const grid = dark ? 'rgba(148,163,184,.14)' : '#eef2f7';
  const txt = dark ? '#64748b' : '#94a3b8';
  const ticks = [lo, (lo + hi) / 2, hi];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke={grid} />
            <text x={P.l - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill={txt} fontFamily="JetBrains Mono">{t.toFixed(Math.abs(hi - lo) < 2 ? 2 : 0)}</text>
          </g>
        ))}
        <text x={W - P.r} y={H - 4} textAnchor="end" fontSize="9" fill={txt}>{xLabel} → {n - 1}</text>
        {yLabel && <text x={P.l} y={P.t - 2} fontSize="9" fill={txt}>{yLabel}</text>}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
          if (pts.length < 1) return null;
          const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
          return (
            <g key={s.label}>
              {s.area && <path d={`${d} L${pts[pts.length - 1][0]},${H - P.b} L${pts[0][0]},${H - P.b} Z`} fill={s.color} opacity={0.1} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth={s.width || 2} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" opacity={s.opacity ?? 1} />
              <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={s.color} />
            </g>
          );
        })}
      </svg>
      {legend && (
        <div className="mt-1 flex flex-wrap gap-3 text-[11px]">
          {series.map((s) => (
            <span key={s.label} className={cx('inline-flex items-center gap-1.5', dark ? 'text-slate-400' : 'text-slate-500')}>
              <span className="h-0.5 w-3 rounded" style={{ background: s.color }} />{s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Baseline → optimized bar pair for a metric (light theme). */
export function CompareBar({ label, base, opt, color, format = (v) => v.toFixed(3), max = 1, lowerIsBetter = false }) {
  const better = lowerIsBetter ? opt < base : opt > base;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-mono text-[11px] text-slate-400">{format(base)} → <b className={better ? 'text-emerald-600' : 'text-rose-600'}>{format(opt)}</b></span>
      </div>
      <div className="space-y-1">
        <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-300" style={{ width: `${Math.min(100, (base / max) * 100)}%` }} /></div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (opt / max) * 100)}%`, background: color }} /></div>
      </div>
    </div>
  );
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

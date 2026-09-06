import React from 'react';
import { Play, Pause, SkipForward, RotateCcw, Info } from 'lucide-react';

/** Labelled slider with a live value and a teaching hint. */
export const Slider = ({
  label, value, min, max, step = 0.01, onChange, format, hint, color = '#6366f1', disabled,
}) => (
  <label className={`block ${disabled ? 'opacity-50' : ''}`}>
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] font-semibold text-slate-300">{label}</span>
      <span className="ns-tabular text-[11px] font-bold" style={{ color }}>
        {format ? format(value) : value}
      </span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value} disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="mt-1 w-full"
      style={{ accentColor: color }}
    />
    {hint && <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500">{hint}</p>}
  </label>
);

/** Play / step / reset transport shared by every sandbox. */
export const Transport = ({
  playing, onPlay, onStep, onReset, generation, label = 'generation', color = '#6366f1', extra,
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <button
      onClick={onPlay}
      className="ns-focus inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition"
      style={{ backgroundColor: color }}
    >
      {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      {playing ? 'Pause' : 'Run'}
    </button>
    <button
      onClick={onStep}
      className="ns-focus inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
    >
      <SkipForward className="h-3.5 w-3.5" /> Step once
    </button>
    <button
      onClick={onReset}
      className="ns-focus inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
    >
      <RotateCcw className="h-3.5 w-3.5" /> Reset
    </button>
    <span className="ns-tabular ml-auto text-[11px] text-slate-400">
      {label} <span className="font-bold text-slate-200">{generation}</span>
    </span>
    {extra}
  </div>
);

/** Collapsible "how it works" explainer with numbered mechanism steps. */
export const Mechanism = ({ title, steps, color = '#6366f1', formula }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex items-center gap-2">
      <Info className="h-4 w-4" style={{ color }} />
      <h4 className="text-sm font-bold text-slate-900">{title}</h4>
    </div>
    {formula && (
      <pre className="mt-2.5 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-200">
        <code>{formula}</code>
      </pre>
    )}
    <ol className="mt-3 space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900">{s.title}</p>
            <p className="text-xs leading-relaxed text-slate-600">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  </div>
);

/** "Try this" experiment prompts — the fastest way to make a point land. */
export const Experiments = ({ items, onApply, color = '#6366f1' }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3.5">
    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
      Try this — break it on purpose
    </p>
    <div className="mt-2 space-y-1.5">
      {items.map((e) => (
        <button
          key={e.label}
          onClick={() => onApply(e)}
          className="ns-focus block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-400"
        >
          <span className="text-xs font-semibold" style={{ color }}>{e.label}</span>
          <span className="mt-0.5 block text-[11px] leading-snug text-slate-600">{e.expect}</span>
        </button>
      ))}
    </div>
  </div>
);

/** Small readout tile for a live sandbox statistic. */
export const Readout = ({ label, value, color = '#e2e8f0', sub }) => (
  <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1.5">
    <p className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    <p className="ns-tabular text-sm font-bold" style={{ color }}>{value}</p>
    {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
  </div>
);

/** Live line chart used by all sandboxes to show fitness over time. */
export const MiniChart = ({ history, color = '#6366f1', height = 120, yLabel = 'fitness' }) => {
  if (!history.length) return <div style={{ height }} />;
  const W = 480;
  const H = height;
  const pad = { l: 34, r: 8, t: 8, b: 16 };
  const keys = ['best', 'mean', 'worst'].filter((k) => history[0][k] !== undefined);
  const vals = history.flatMap((h) => keys.map((k) => h[k]));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const n = history.length;

  const x = (i) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - lo) / span) * (H - pad.t - pad.b);
  const path = (k) => history.map((h, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(h[k]).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {[0, 0.5, 1].map((f) => {
        const v = lo + f * span;
        return (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#1e293b" />
            <text x={pad.l - 5} y={y(v) + 3} textAnchor="end" fontSize="8.5" fill="#64748b">
              {v.toFixed(2)}
            </text>
          </g>
        );
      })}
      {keys.includes('worst') && <path d={path('worst')} fill="none" stroke={color} strokeWidth="1" opacity="0.25" />}
      {keys.includes('mean') && <path d={path('mean')} fill="none" stroke={color} strokeWidth="1.4" opacity="0.5" />}
      <path d={path('best')} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx={x(n - 1)} cy={y(history[n - 1].best)} r="3.2" fill={color} />
      <text x={W - pad.r} y={H - 3} textAnchor="end" fontSize="8.5" fill="#64748b">{yLabel}</text>
    </svg>
  );
};

import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Animated convergence plot.
 *
 * Shows best / mean / worst fitness per generation plus population diversity.
 * The story it has to tell is the signature of an evolutionary run: the best
 * curve climbs in steps, the mean chases it, and diversity collapses as the
 * population converges. A playhead sweeps through generations so that shape is
 * watched rather than merely read.
 */
export const ConvergenceChart = ({
  series = [],
  color = '#6366f1',
  compareSeries = null,
  compareColor = '#06b6d4',
  compareLabel = 'PSO',
  label = 'GA',
  height = 260,
  showDiversity = true,
  autoplay = true,
}) => {
  const [cursor, setCursor] = useState(series.length ? series.length - 1 : 0);
  const [playing, setPlaying] = useState(autoplay);
  const [hover, setHover] = useState(null);
  const raf = useRef(null);

  const n = series.length;

  // Replay the run once on mount so the convergence shape is seen forming.
  useEffect(() => {
    if (!autoplay || n < 2) return undefined;
    setCursor(0);
    setPlaying(true);
    let i = 0;
    let last = performance.now();
    const step = (t) => {
      if (t - last > Math.max(18, 900 / n)) {
        i += 1;
        last = t;
        setCursor(i);
      }
      if (i < n - 1) raf.current = requestAnimationFrame(step);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(step);
    return () => raf.current && cancelAnimationFrame(raf.current);
  }, [n, autoplay]);

  const W = 720;
  const H = height;
  const pad = { l: 46, r: 16, t: 16, b: 30 };

  const { yMin, yMax } = useMemo(() => {
    const vals = [];
    series.forEach((d) => vals.push(d.best_fitness, d.mean_fitness, d.worst_fitness));
    if (compareSeries) compareSeries.forEach((d) => vals.push(d.best_fitness));
    if (!vals.length) return { yMin: 0, yMax: 1 };
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const padY = (hi - lo) * 0.12 || 0.05;
    return { yMin: lo - padY, yMax: hi + padY };
  }, [series, compareSeries]);

  const x = (i) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - pad.t - pad.b);

  const path = (key, data = series, upto = n) =>
    data.slice(0, Math.max(2, upto + 1))
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`)
      .join(' ');

  const area = (upto = n) => {
    const pts = series.slice(0, Math.max(2, upto + 1));
    if (pts.length < 2) return '';
    const top = pts.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.best_fitness)}`).join(' ');
    const bottom = pts.slice().reverse()
      .map((d, i) => `L ${x(pts.length - 1 - i)} ${y(d.worst_fitness)}`).join(' ');
    return `${top} ${bottom} Z`;
  };

  if (!n) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-500" style={{ height }}>
        No convergence history recorded.
      </div>
    );
  }

  const shown = series[Math.min(cursor, n - 1)];
  const active = hover !== null ? series[hover] : shown;
  const activeIdx = hover !== null ? hover : Math.min(cursor, n - 1);

  const yTicks = 4;

  return (
    <div className="px-2 pb-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1));
          setHover(Math.max(0, Math.min(n - 1, i)));
        }}
      >
        <defs>
          <linearGradient id="convBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* axes */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const v = yMin + (i / yTicks) * (yMax - yMin);
          return (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#1e293b" strokeWidth="1" />
              <text x={pad.l - 8} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="#64748b">
                {v.toFixed(2)}
              </text>
            </g>
          );
        })}
        <text x={(W) / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="#64748b">
          generation
        </text>

        {/* spread between best and worst — the population's search envelope */}
        <path d={area(activeIdx)} fill="url(#convBand)" />

        {/* diversity, drawn faintly on its own implicit scale */}
        {showDiversity && (
          <path
            d={series.slice(0, activeIdx + 1).map((d, i) => {
              const maxDiv = Math.max(...series.map((s) => s.diversity)) || 1;
              const yy = pad.t + (1 - d.diversity / maxDiv) * (H - pad.t - pad.b);
              return `${i === 0 ? 'M' : 'L'} ${x(i)} ${yy}`;
            }).join(' ')}
            fill="none" stroke="#475569" strokeWidth="1.25" strokeDasharray="3 4"
          />
        )}

        {compareSeries && (
          <path d={path('best_fitness', compareSeries, activeIdx)} fill="none"
                stroke={compareColor} strokeWidth="2" opacity="0.85" />
        )}
        <path d={path('mean_fitness', series, activeIdx)} fill="none"
              stroke={color} strokeWidth="1.5" opacity="0.45" />
        <path d={path('best_fitness', series, activeIdx)} fill="none"
              stroke={color} strokeWidth="2.5" strokeLinecap="round" />

        {/* playhead */}
        <line x1={x(activeIdx)} x2={x(activeIdx)} y1={pad.t} y2={H - pad.b}
              stroke="#94a3b8" strokeWidth="1" opacity="0.4" />
        <circle cx={x(activeIdx)} cy={y(active.best_fitness)} r="4.5" fill={color} />
        <circle cx={x(activeIdx)} cy={y(active.best_fitness)} r="4.5" fill="none"
                stroke={color} strokeWidth="1.5" className={playing ? 'ns-pulse-ring' : ''}
                style={{ transformOrigin: `${x(activeIdx)}px ${y(active.best_fitness)}px` }} />
      </svg>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-3 pb-1 text-[11px]">
        <Legend color={color} text={`${label} best`} />
        <Legend color={color} text={`${label} mean`} faded />
        {compareSeries && <Legend color={compareColor} text={`${compareLabel} best`} />}
        {showDiversity && <Legend color="#475569" text="diversity" dashed />}
        <span className="ml-auto ns-tabular text-slate-400">
          gen {active.generation} · best {active.best_fitness.toFixed(4)} · div {active.diversity.toFixed(3)}
        </span>
      </div>
    </div>
  );
};

const Legend = ({ color, text, dashed, faded }) => (
  <span className="inline-flex items-center gap-1.5 text-slate-400">
    <svg width="16" height="6">
      <line x1="0" y1="3" x2="16" y2="3" stroke={color} strokeWidth="2.5"
            strokeDasharray={dashed ? '3 3' : undefined} opacity={faded ? 0.45 : 1} />
    </svg>
    {text}
  </span>
);

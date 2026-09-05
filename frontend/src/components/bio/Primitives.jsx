import React from 'react';

/** Dark "instrument panel" wrapper used by every visualization. */
export const Scope = ({ title, subtitle, right, children, className = '', height }) => (
  <div className={`ns-scope overflow-hidden ${className}`}>
    {(title || right) && (
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-slate-800">
        <div className="min-w-0">
          {title && <h4 className="text-sm font-semibold text-slate-100">{title}</h4>}
          {subtitle && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{subtitle}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    )}
    <div className="ns-grid-lines" style={height ? { height } : undefined}>{children}</div>
  </div>
);

export const Chip = ({ children, color = '#94a3b8', filled = false }) => (
  <span
    className="ns-chip"
    style={filled
      ? { color: '#fff', backgroundColor: color, borderColor: color }
      : { color, backgroundColor: `${color}14` }}
  >
    {children}
  </span>
);

/** A metric shown as baseline -> optimized with the delta made obvious. */
export const MetricDelta = ({ label, before, after, deltaPct, higherIsBetter = true, unit = '' }) => {
  const improved = higherIsBetter ? after > before : after < before;
  const tone = improved ? '#059669' : (after === before ? '#64748b' : '#e11d48');
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2 ns-tabular">
        <span className="text-sm text-slate-400 line-through decoration-slate-300">
          {before}{unit}
        </span>
        <span className="text-slate-300">→</span>
        <span className="text-xl font-bold text-slate-900">{after}{unit}</span>
      </div>
      {deltaPct !== undefined && deltaPct !== null && (
        <p className="mt-1 text-xs font-bold ns-tabular" style={{ color: tone }}>
          {deltaPct > 0 ? '▲' : deltaPct < 0 ? '▼' : '■'} {Math.abs(deltaPct).toFixed(1)}%
        </p>
      )}
    </div>
  );
};

/** Horizontal weight bar — used for evolved genome weights. */
export const WeightBar = ({ label, value, max = 1, color = '#6366f1', hint }) => {
  const w = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="group">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="ns-tabular font-semibold text-slate-900">{Number(value).toFixed(3)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${w}%`, backgroundColor: color }}
        />
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-500 leading-snug">{hint}</p>}
    </div>
  );
};

export const Skeleton = ({ className = 'h-32' }) => (
  <div className={`ns-skeleton rounded-xl ${className}`} />
);

export const EmptyState = ({ title, body, action }) => (
  <div className="ns-card p-8 text-center">
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">{body}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/** Small labelled statistic. */
export const Stat = ({ label, value, sub, color }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    <p className="text-lg font-bold ns-tabular" style={{ color: color || '#e2e8f0' }}>{value}</p>
    {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
  </div>
);

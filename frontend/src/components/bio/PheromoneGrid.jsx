import React, { useMemo, useState } from 'react';

/**
 * Ant-colony pheromone map.
 *
 * Rows are query intents, columns are searchable partitions (note type x SOAP
 * section). Cell brightness is trail strength. After training the map should be
 * sparse and structured — bright cells clustering where a medication question
 * meets a "Plan & Orders" partition — which is the colony having discovered the
 * clinical structure of the record from query outcomes alone.
 */
export const PheromoneGrid = ({ matrix, onSelectIntent, selectedIntent }) => {
  const [hover, setHover] = useState(null);

  const { intents = [], partitions = [], matrix: rows = [], partition_sizes = {} } = matrix || {};

  const max = useMemo(() => {
    let m = 0;
    rows.forEach((r) => r.forEach((v) => { if (v > m) m = v; }));
    return m || 1;
  }, [rows]);

  if (!intents.length || !partitions.length) {
    return <div className="p-6 text-sm text-slate-500">No pheromone matrix available.</div>;
  }

  const shortPartition = (p) => {
    const [type, section] = String(p).split('::');
    const sec = (section || '').replace(' & ', '&').replace('Objective / Vitals / Labs', 'Obj/Labs')
      .replace('Assessment&Diagnosis', 'Assess').replace('Plan&Orders', 'Plan')
      .replace('Subjective History', 'Subj').replace('Chief Complaint', 'Chief');
    return { type, sec };
  };

  return (
    <div className="p-3 overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="flex">
          <div className="w-24 shrink-0" />
          <div className="flex-1 grid gap-[2px]"
               style={{ gridTemplateColumns: `repeat(${partitions.length}, minmax(0,1fr))` }}>
            {partitions.map((p) => {
              const { type, sec } = shortPartition(p);
              return (
                <div key={p} className="text-[8.5px] text-slate-500 leading-tight text-center pb-1">
                  <div className="font-semibold text-slate-400">{type.slice(0, 4)}</div>
                  <div className="truncate" title={p}>{sec}</div>
                </div>
              );
            })}
          </div>
        </div>

        {intents.map((intent, r) => (
          <div
            key={intent}
            className={`flex items-center transition ${selectedIntent === intent ? 'bg-amber-500/10 rounded-md' : ''}`}
          >
            <button
              onClick={() => onSelectIntent && onSelectIntent(intent)}
              className="ns-focus w-24 shrink-0 text-left text-[11px] font-medium text-slate-300 hover:text-amber-300 pr-2 py-0.5 truncate transition"
            >
              {intent}
            </button>
            <div className="flex-1 grid gap-[2px]"
                 style={{ gridTemplateColumns: `repeat(${partitions.length}, minmax(0,1fr))` }}>
              {partitions.map((p, c) => {
                const v = rows[r]?.[c] ?? 0;
                const t = Math.pow(v / max, 0.55);
                const isHover = hover && hover.r === r && hover.c === c;
                return (
                  <div
                    key={p}
                    onMouseEnter={() => setHover({ r, c, v, intent, p })}
                    onMouseLeave={() => setHover(null)}
                    className="h-[15px] rounded-[2px] transition-all duration-200"
                    style={{
                      backgroundColor: `rgba(245,158,11,${0.06 + t * 0.94})`,
                      boxShadow: isHover ? '0 0 0 1.5px #fbbf24' : t > 0.72
                        ? `0 0 ${5 + t * 8}px rgba(245,158,11,${t * .55})` : 'none',
                      transform: isHover ? 'scale(1.35)' : 'none',
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-2">
          weak
          <span className="inline-block h-2.5 w-24 rounded"
                style={{ background: 'linear-gradient(90deg, rgba(245,158,11,.06), rgba(245,158,11,1))' }} />
          strong trail
        </span>
        {hover && (
          <span className="ml-auto ns-tabular">
            {hover.intent} → {hover.p} · τ={hover.v.toFixed(3)} · {partition_sizes[hover.p] ?? 0} chunks
          </span>
        )}
      </div>
    </div>
  );
};

/** Iteration history: hit-rate rising while chunks scanned falls. */
export const ACOHistory = ({ history = [], height = 170 }) => {
  if (!history.length) return null;
  const W = 700;
  const H = height;
  const pad = { l: 38, r: 42, t: 12, b: 24 };
  const n = history.length;
  const maxScan = Math.max(...history.map((h) => h.mean_chunks_scanned)) || 1;

  const x = (i) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r);
  const yHit = (v) => pad.t + (1 - v) * (H - pad.t - pad.b);
  const yScan = (v) => pad.t + (1 - v / maxScan) * (H - pad.t - pad.b);

  const line = (fn, key) => history
    .map((h, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${fn(h[key]).toFixed(1)}`).join(' ');

  return (
    <div className="px-2 pb-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={yHit(v)} y2={yHit(v)} stroke="#1e293b" />
            <text x={pad.l - 6} y={yHit(v) + 3.5} textAnchor="end" fontSize="9" fill="#64748b">
              {(v * 100).toFixed(0)}%
            </text>
          </g>
        ))}
        <path d={line(yScan, 'mean_chunks_scanned')} fill="none" stroke="#64748b"
              strokeWidth="1.5" strokeDasharray="4 3" />
        <path d={line(yHit, 'hit_rate')} fill="none" stroke="#f59e0b" strokeWidth="2.5"
              className="ns-draw-line" strokeLinecap="round" />
        <text x={W - pad.r + 5} y={yScan(history[n - 1].mean_chunks_scanned) + 3}
              fontSize="9" fill="#64748b">chunks</text>
      </svg>
      <div className="flex gap-4 px-3 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke="#f59e0b" strokeWidth="2.5" /></svg>
          hit rate per iteration
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="4"><line x1="0" y1="2" x2="14" y2="2" stroke="#64748b" strokeWidth="2" strokeDasharray="3 2" /></svg>
          mean chunks scanned
        </span>
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';

/**
 * The evolved 384-bit embedding mask.
 *
 * Every cell is one dimension of the sentence-transformer output. Lit cells
 * survived selection and are indexed; dark cells were dropped. Hovering shows
 * that dimension's variance across the corpus, which is the interpretable
 * check on the result: the GA should be keeping high-variance dimensions —
 * those that actually distinguish one clinical chunk from another — without
 * ever having been told to.
 */
export const DimensionMask = ({ mask = [], importance = [], columns = 32 }) => {
  const [hover, setHover] = useState(null);

  const kept = useMemo(() => mask.reduce((s, b) => s + (b ? 1 : 0), 0), [mask]);

  const stats = useMemo(() => {
    if (!importance.length || !mask.length) return null;
    let keptSum = 0; let keptN = 0; let dropSum = 0; let dropN = 0;
    mask.forEach((b, i) => {
      const v = importance[i] ?? 0;
      if (b) { keptSum += v; keptN += 1; } else { dropSum += v; dropN += 1; }
    });
    return {
      keptAvg: keptN ? keptSum / keptN : 0,
      dropAvg: dropN ? dropSum / dropN : 0,
    };
  }, [mask, importance]);

  if (!mask.length) {
    return <div className="p-6 text-sm text-slate-500">No dimension mask available.</div>;
  }

  return (
    <div className="p-4">
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}
      >
        {mask.map((bit, i) => {
          const imp = importance[i] ?? 0;
          const isHover = hover === i;
          return (
            <div
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="aspect-square rounded-[2px] transition-all duration-150"
              style={{
                backgroundColor: bit
                  ? `rgba(16,185,129,${0.30 + imp * 0.70})`
                  : 'rgba(100,116,139,.13)',
                boxShadow: isHover ? '0 0 0 1.5px #34d399' : 'none',
                transform: isHover ? 'scale(1.6)' : 'none',
                zIndex: isHover ? 5 : 1,
              }}
              title={`dim ${i} · ${bit ? 'kept' : 'dropped'}`}
            />
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500" /> kept ({kept})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[2px] bg-slate-600/40" /> dropped ({mask.length - kept})
        </span>
        {hover !== null && (
          <span className="ml-auto ns-tabular">
            dim {hover} · {mask[hover] ? 'kept' : 'dropped'} · variance {(importance[hover] ?? 0).toFixed(3)}
          </span>
        )}
      </div>

      {stats && (
        <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500">
          Mean corpus variance of kept dimensions is{' '}
          <span className="font-semibold text-emerald-400 ns-tabular">{stats.keptAvg.toFixed(3)}</span>{' '}
          versus{' '}
          <span className="font-semibold text-slate-400 ns-tabular">{stats.dropAvg.toFixed(3)}</span>{' '}
          for dropped ones
          {stats.keptAvg > stats.dropAvg
            ? ' — the GA converged on the dimensions that actually separate clinical text, without variance ever being part of its fitness function.'
            : '. The GA optimized retrieval accuracy directly, so it did not simply track variance here.'}
        </p>
      )}
    </div>
  );
};

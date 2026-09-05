import React, { useEffect, useRef, useState } from 'react';

/**
 * Replays the recorded Particle Swarm trajectory.
 *
 * Each dot is one particle, plotted in the first two genome dimensions
 * (similarity weight x recency weight). The behaviour to watch is the swarm
 * scattering widely at high inertia, then contracting onto the global best as
 * inertia decays — the mechanism that makes PSO explore before it exploits.
 */
export const SwarmCanvas = ({ trace = [], height = 300, color = '#06b6d4', xLabel, yLabel }) => {
  const canvasRef = useRef(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const rafRef = useRef(null);
  const lastRef = useRef(0);

  const frames = trace.length;

  useEffect(() => {
    if (!frames || !playing) return undefined;
    const tick = (t) => {
      if (t - lastRef.current > 130) {
        lastRef.current = t;
        setFrame((f) => (f + 1) % frames);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [frames, playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frames) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = 26;
    const px = (v) => pad + v * (w - pad * 2);
    const py = (v) => h - pad - v * (h - pad * 2);

    // axes
    ctx.strokeStyle = 'rgba(148,163,184,.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad); ctx.lineTo(pad, h - pad); ctx.lineTo(w - pad, h - pad);
    ctx.stroke();

    // Motion trail: a few previous frames at decreasing opacity, so direction
    // of travel is visible in a still screenshot too.
    for (let back = 3; back >= 1; back -= 1) {
      const f = trace[(frame - back + frames) % frames];
      if (!f) continue;
      ctx.fillStyle = `${color}${back === 3 ? '18' : back === 2 ? '28' : '44'}`;
      f.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.arc(px(a), py(b), 2.6, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const current = trace[frame] || [];
    // centroid marks where the swarm has agreed
    let cx = 0; let cy = 0;
    current.forEach(([a, b]) => { cx += a; cy += b; });
    cx /= current.length || 1; cy /= current.length || 1;

    current.forEach(([a, b]) => {
      const g = ctx.createRadialGradient(px(a), py(b), 0, px(a), py(b), 8);
      g.addColorStop(0, color);
      g.addColorStop(1, `${color}00`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px(a), py(b), 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(px(a), py(b), 2.9, 0, Math.PI * 2); ctx.fill();
    });

    // global-best marker
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(px(cx), py(cy), 11, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px(cx) - 15, py(cy)); ctx.lineTo(px(cx) + 15, py(cy));
    ctx.moveTo(px(cx), py(cy) - 15); ctx.lineTo(px(cx), py(cy) + 15);
    ctx.stroke();
  }, [frame, frames, trace, height, color]);

  if (!frames) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-500" style={{ height }}>
        No swarm trajectory recorded (the Genetic Algorithm won this run).
      </div>
    );
  }

  const spread = (() => {
    const f = trace[frame] || [];
    if (f.length < 2) return 0;
    const mx = f.reduce((s, p) => s + p[0], 0) / f.length;
    const my = f.reduce((s, p) => s + p[1], 0) / f.length;
    return Math.sqrt(f.reduce((s, p) => s + (p[0] - mx) ** 2 + (p[1] - my) ** 2, 0) / f.length);
  })();

  return (
    <div className="p-3">
      <canvas ref={canvasRef} style={{ width: '100%', height }} />
      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="ns-focus rounded-md border border-slate-700 px-2 py-1 font-medium text-slate-300 hover:bg-slate-800 transition"
        >
          {playing ? '❙❙ Pause' : '▶ Play'}
        </button>
        <input
          type="range" min="0" max={frames - 1} value={frame}
          onChange={(e) => { setPlaying(false); setFrame(Number(e.target.value)); }}
          className="flex-1 accent-cyan-400"
          aria-label="Swarm iteration"
        />
        <span className="ns-tabular w-36 text-right">
          iter {frame + 1}/{frames} · spread {spread.toFixed(3)}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500">
        x = {xLabel || 'gene 1'} · y = {yLabel || 'gene 2'} · crosshair = swarm centroid
      </p>
    </div>
  );
};

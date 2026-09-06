import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ParticleSwarm } from '../../../bio/engines';
import { psoLandscape, PSO_OPTIMUM, PSO_DECOY } from '../../../bio/toyProblem';
import { Scope } from '../Primitives';
import { Slider, Transport, Mechanism, Experiments, Readout, MiniChart } from './Controls';

const COLOR = '#06b6d4';

const DEFAULTS = { swarmSize: 26, inertia: 0.72, cognitive: 1.5, social: 1.5, vMax: 0.12 };

const EXPERIMENTS = [
  {
    label: 'Social pull only, small swarm',
    expect: 'Particles lose their own memory and rush to wherever the leader is, with too few of them to sample the space. Press Reset a few times: this converges on the DECOY peak in roughly half of all runs, whereas the defaults find the true optimum in about nine out of ten.',
    params: { cognitive: 0, social: 2.5, inertia: 0.05, vMax: 0.03, swarmSize: 10 },
  },
  {
    label: 'Cognitive only (social = 0)',
    expect: 'No information is shared between particles. Each one hill-climbs alone, so the swarm never coordinates — it degenerates into many independent searches and wastes most of its effort.',
    params: { cognitive: 2.5, social: 0, swarmSize: 26 },
  },
  {
    label: 'High inertia (0.95)',
    expect: 'Particles keep their momentum and overshoot repeatedly. Great exploration, but the swarm never settles.',
    params: { inertia: 0.95 },
  },
  {
    label: 'Low inertia (0.3)',
    expect: 'Momentum dies instantly. The swarm converges fast — and gets stuck in whichever peak it happened to land near.',
    params: { inertia: 0.3 },
  },
  {
    label: 'Balanced defaults',
    expect: 'Enough momentum and individual memory to escape the decoy, enough social pull to converge once the true optimum is found. Finds the true optimum in about nine runs out of ten.',
    params: DEFAULTS,
  },
];

export const PSOSandbox = () => {
  const [params, setParams] = useState(DEFAULTS);
  const [playing, setPlaying] = useState(false);
  const [, force] = useState(0);
  const [note, setNote] = useState(null);
  const [seed, setSeed] = useState(7);
  const [showVectors, setShowVectors] = useState(true);
  const psoRef = useRef(null);
  const canvasRef = useRef(null);
  const timerRef = useRef(null);

  const fitnessFn = useCallback((g) => psoLandscape(g[0], g[1]), []);

  useEffect(() => {
    psoRef.current = new ParticleSwarm({ genomeLength: 2, seed, fitnessFn, ...params });
    force((n) => n + 1);
    /* eslint-disable-next-line */
  }, [seed, params.swarmSize]);

  useEffect(() => { if (psoRef.current) psoRef.current.setParams(params); }, [params]);

  useEffect(() => {
    if (!playing) return undefined;
    timerRef.current = setInterval(() => {
      if (psoRef.current.iteration >= 200) { setPlaying(false); return; }
      psoRef.current.step();
      force((n) => n + 1);
    }, 90);
    return () => clearInterval(timerRef.current);
  }, [playing]);

  // Draw the landscape + swarm
  useEffect(() => {
    const pso = psoRef.current;
    const canvas = canvasRef.current;
    if (!pso || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = 360;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // fitness surface as a heat field
    const cell = 6;
    for (let px = 0; px < w; px += cell) {
      for (let py = 0; py < h; py += cell) {
        const v = psoLandscape(px / w, 1 - py / h);
        const t = Math.min(1, v);
        ctx.fillStyle = `rgba(6,182,212,${0.04 + t * 0.42})`;
        ctx.fillRect(px, py, cell, cell);
      }
    }
    // contour rings
    ctx.strokeStyle = 'rgba(148,163,184,.18)';
    [0.3, 0.5, 0.7, 0.9].forEach((lvl) => {
      ctx.beginPath();
      for (let px = 0; px < w; px += 3) {
        for (let py = 0; py < h; py += 3) {
          const v = psoLandscape(px / w, 1 - py / h);
          if (Math.abs(v - lvl) < 0.012) ctx.rect(px, py, 1.6, 1.6);
        }
      }
      ctx.stroke();
    });

    const X = (v) => v * w;
    const Y = (v) => (1 - v) * h;

    // markers for the true optimum and the decoy
    const marker = (pt, color, label) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X(pt.x), Y(pt.y), 13, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = color; ctx.font = '9px system-ui';
      ctx.fillText(label, X(pt.x) + 17, Y(pt.y) + 3);
    };
    marker(PSO_OPTIMUM, '#fbbf24', 'true optimum');
    marker(PSO_DECOY, '#94a3b8', 'decoy peak');

    // particles
    pso.positions.forEach((p, i) => {
      const px = X(p[0]); const py = Y(p[1]);
      if (showVectors) {
        const v = pso.velocities[i];
        ctx.strokeStyle = 'rgba(226,232,240,.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.lineTo(px + v[0] * w * 2.4, py - v[1] * h * 2.4);
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(px, py, 0, px, py, 9);
      g.addColorStop(0, COLOR); g.addColorStop(1, 'rgba(6,182,212,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLOR;
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
    });

    // global best
    const gx = X(pso.gBest[0]); const gy = Y(pso.gBest[1]);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx - 9, gy); ctx.lineTo(gx + 9, gy);
    ctx.moveTo(gx, gy - 9); ctx.lineTo(gx, gy + 9); ctx.stroke();
  });

  const pso = psoRef.current;
  if (!pso) return null;

  const dist = Math.hypot(pso.gBest[0] - PSO_OPTIMUM.x, pso.gBest[1] - PSO_OPTIMUM.y);
  const trapped = dist > 0.18;

  return (
    <div className="space-y-4">
      <Mechanism
        color={COLOR}
        title="Particle Swarm Optimization — the velocity update is the whole algorithm"
        formula={`v ← w·v  +  c₁·r₁·(pbest − x)  +  c₂·r₂·(gbest − x)
     ↑ momentum   ↑ own memory      ↑ social pull
x ← x + v`}
        steps={[
          { title: 'Each particle is a candidate solution', body: 'Its position is a set of parameter values; here just two, so the search space can be drawn as a map. Brighter regions are higher fitness.' },
          { title: 'Momentum (w · v)', body: 'A particle keeps moving the way it was moving. High inertia lets it coast past a mediocre peak; low inertia makes it settle quickly wherever it is.' },
          { title: 'Cognitive pull (c₁)', body: 'Each particle remembers the best place it personally found and is drawn back toward it. This is individual memory.' },
          { title: 'Social pull (c₂)', body: 'Every particle is also drawn toward the best position found by the whole swarm. This is how information spreads — and how the swarm converges.' },
          { title: 'The trade-off', body: 'Too much social pull and everyone rushes to the first decent peak. Too little and there is no coordination at all. The landscape below has a decoy peak specifically so you can watch this happen.' },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Scope
          title="Swarm on a two-peak fitness landscape"
          subtitle="Brighter = higher fitness. The narrow peak on the right is the true optimum; the broad one on the left is a decoy."
        >
          <div className="space-y-3 p-4">
            <Transport
              playing={playing} color={COLOR} generation={pso.iteration} label="iteration"
              onPlay={() => setPlaying((p) => !p)}
              onStep={() => { pso.step(); force((n) => n + 1); }}
              onReset={() => { setPlaying(false); setSeed((s) => s + 1); }}
              extra={(
                <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <input type="checkbox" checked={showVectors}
                         onChange={(e) => setShowVectors(e.target.checked)}
                         style={{ accentColor: COLOR }} />
                  velocity vectors
                </label>
              )}
            />
            <canvas ref={canvasRef} style={{ width: '100%', height: 360 }} className="rounded-lg" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Readout label="Best fitness" value={pso.gBestFit.toFixed(4)} color="#67e8f9" />
              <Readout label="Swarm spread" value={pso.history[pso.history.length - 1].diversity.toFixed(4)}
                       sub={pso.history[pso.history.length - 1].diversity < 0.03 ? 'converged' : 'exploring'} />
              <Readout label="Distance to optimum" value={dist.toFixed(3)}
                       color={trapped ? '#fb7185' : '#34d399'} />
              <Readout label="Outcome" value={trapped ? 'On decoy' : 'On optimum'}
                       color={trapped ? '#fb7185' : '#34d399'} />
            </div>
            <MiniChart history={pso.history} color={COLOR} height={100} />
          </div>
        </Scope>

        <div className="space-y-3">
          <div className="ns-scope p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              PSO parameters
            </p>
            <div className="space-y-3">
              <Slider label="Swarm size" value={params.swarmSize} min={4} max={60} step={2} color={COLOR}
                      onChange={(v) => setParams({ ...params, swarmSize: v })}
                      hint="Fewer particles sample less of the space, so a small swarm is far easier to trap." />
              <Slider label="Inertia (w)" value={params.inertia} min={0} max={1} step={0.01} color={COLOR}
                      format={(v) => v.toFixed(2)}
                      onChange={(v) => setParams({ ...params, inertia: v })}
                      hint="Momentum kept each step. High = keeps exploring; low = settles fast." />
              <Slider label="Cognitive (c₁)" value={params.cognitive} min={0} max={3} step={0.1} color={COLOR}
                      format={(v) => v.toFixed(1)}
                      onChange={(v) => setParams({ ...params, cognitive: v })}
                      hint="Pull toward the particle's own best-ever position." />
              <Slider label="Social (c₂)" value={params.social} min={0} max={3} step={0.1} color={COLOR}
                      format={(v) => v.toFixed(1)}
                      onChange={(v) => setParams({ ...params, social: v })}
                      hint="Pull toward the swarm's best-ever position." />
              <Slider label="Max velocity" value={params.vMax} min={0.01} max={0.4} step={0.01} color={COLOR}
                      format={(v) => v.toFixed(2)}
                      onChange={(v) => setParams({ ...params, vMax: v })}
                      hint="Speed limit — stops particles teleporting across the space." />
            </div>
          </div>

          <Experiments items={EXPERIMENTS} onApply={(e) => { setParams((p) => ({ ...p, ...e.params })); setNote(e.expect); }} color={COLOR} />
          {note && (
            <div className="ns-animate-in rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-[11px] leading-relaxed text-cyan-900">
              <span className="font-bold">What to watch: </span>{note}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

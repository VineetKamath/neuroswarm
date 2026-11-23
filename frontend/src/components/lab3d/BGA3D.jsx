import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { BinaryGeneticAlgorithm, mulberry32 } from '../../bio/engines';
import { BIN_DIMS, makeDimensionValues, makeBinFitness } from '../../bio/toyProblem';
import { useGenerations, useStage, ControlBar, Hud, Toast, PhaseCaption, setCaption, isIdle, useLagged, progress, smooth, seg } from './common';
import { makeNoteCard } from './models';
import { label, floor } from './stage';

const SIDE = 8; // 8 x 8 = 64 dimensions (the real system has 384)
const POP = 24;
export const BGA_PRESETS = [
  { name: 'Balanced (default)', p: { mutationRate: 0.02, crossoverRate: 0.8, parsimony: 0.35 } },
  { name: 'Mutation off', p: { mutationRate: 0, crossoverRate: 0.8, parsimony: 0.35 } },
  { name: 'Obsessed with size', p: { mutationRate: 0.02, crossoverRate: 0.8, parsimony: 1.6 } },
  { name: 'Ignore size', p: { mutationRate: 0.02, crossoverRate: 0.8, parsimony: 0 } },
];

const sorted = (g) => {
  const o = g.population.map((_, i) => i).sort((a, b) => g.fitness[b] - g.fitness[a]);
  return { masks: o.map((i) => [...g.population[i]]), fit: o.map((i) => g.fitness[i]), gen: g.generation };
};

export const BGA3D = forwardRef(function BGA3D(_, ref) {
  const values = useMemo(() => makeDimensionValues(mulberry32(404)), []);
  const useful = values.map((v) => v > 0.5);
  const nUseful = useful.filter(Boolean).length;
  const total = values.reduce((a, b) => a + b, 0);
  const [preset, setPreset] = useState(BGA_PRESETS[0].name);
  const seedRef = useRef(21);
  const make = (p) => new BinaryGeneticAlgorithm({ genomeLength: BIN_DIMS, populationSize: POP, elitism: 2, tournamentSize: 3, initDensity: 0.55, seed: seedRef.current, mutationRate: p.mutationRate, crossoverRate: p.crossoverRate, fitnessFn: makeBinFitness(values, p.parsimony) });
  const ga = useRef(make(BGA_PRESETS[0].p));
  const snaps = useRef({ prev: sorted(ga.current), cur: sorted(ga.current) });
  const stats = (m) => {
    const kept = m.filter(Boolean).length;
    return { kept, usefulKept: m.filter((b, i) => b && useful[i]).length, signal: m.reduce((s, b, i) => s + (b ? values[i] : 0), 0) / total };
  };
  const [hud, setHudNow] = useState({ gen: 0, ...stats(snaps.current.cur.masks[0]), div: ga.current.history[0].diversity });
  const setHud = useLagged(setHudNow);
  const capRef = useRef(null);
  const [toast, setToast] = useState(null);

  const onStep = () => {
    const prev = sorted(ga.current); ga.current.step(); const cur = sorted(ga.current);
    snaps.current = { prev, cur };
    setHud({ gen: cur.gen, ...stats(cur.masks[0]), div: ga.current.history[ga.current.history.length - 1].diversity }, gen.clock.current.ms * 0.7);
  };
  const gen = useGenerations(onStep, 'normal');
  const reset = (p = BGA_PRESETS.find((x) => x.name === preset).p) => {
    ga.current = make(p); // fixed seed: every reset replays the same run
    const s = sorted(ga.current); snaps.current = { prev: s, cur: s };
    setHud({ gen: 0, ...stats(s.masks[0]), div: ga.current.history[0].diversity }, 0);
  };

  const [box, stage] = useStage({ camera: [2, 9, 13], target: [0, 1.5, 0] }, (st) => {
    const { THREE, scene } = st;
    scene.add(floor(THREE, 30));
    const TILE = 0.62; const off = ((SIDE - 1) * TILE) / 2;
    const bx = 2.2; // best board x offset
    const tilePos = (i) => [bx + (i % SIDE) * TILE - off, ((Math.floor(i / SIDE)) * TILE) - off];

    // hidden usefulness pillars (glass) + mask tiles
    const tiles = []; const pillars = [];
    for (let i = 0; i < BIN_DIMS; i += 1) {
      const [x, z] = tilePos(i);
      const pil = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.82, 1, TILE * 0.82), new THREE.MeshStandardMaterial({ color: useful[i] ? 0x34d399 : 0x475569, transparent: true, opacity: 0.16, depthWrite: false }));
      const h = 0.1 + values[i] * 2.4; pil.scale.y = h; pil.position.set(x, h / 2, z); scene.add(pil); pillars.push(pil);
      const tile = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.9, 0.16, TILE * 0.9), new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x000000, roughness: 0.4 }));
      tile.position.set(x, 0.08, z); scene.add(tile); tiles.push(tile);
    }
    const l1 = label("one note chunk as 64 numbers (the real system uses 384)", { color: '#cbd5e1' }); l1.position.set(bx, 0, off + 1.1); scene.add(l1);
    const l2 = label('glass pillar height = how much meaning that number carries', { color: '#6ee7b7' }); l2.position.set(bx + 2.6, 2.6, 0); scene.add(l2);
    const card = makeNoteCard(['Plan & Orders (Kamala)', 'IV Furosemide 80mg BID.', 'Fluid restriction 1.5L/day.', 'Daily standing weights.', '  ...becomes numbers below']);
    card.position.set(bx, 4.6, -off - 0.6); card.rotation.x = -0.25; scene.add(card);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.6, 3.2, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.set(bx, 2.4, -off * 0.4); scene.add(beam);

    // population stack on the left
    const CELL = 0.16; const soff = ((SIDE - 1) * CELL) / 2;
    const stack = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL * 0.85, 0.07, CELL * 0.85), new THREE.MeshStandardMaterial({ roughness: 0.5 }), POP * BIN_DIMS);
    stack.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(POP * BIN_DIMS * 3), 3);
    scene.add(stack);
    const sx = -4.6;
    const l3 = label('the population: 24 masks (best on top)', { color: '#cbd5e1' }); l3.position.set(sx, POP * 0.17 + 0.6, 0); scene.add(l3);

    const m = new THREE.Matrix4(); const c = new THREE.Color();
    const GREEN = new THREE.Color(0x2fbf71); const AMBER = new THREE.Color(0xf59e0b); const OFF = new THREE.Color(0x111827);
    st.onFrame((dt, time) => {
      const { prev, cur } = snaps.current;
      const raw = progress(gen.clock);
      const animating = cur.gen !== prev.gen && raw < 1;
      const t = animating ? smooth(seg(raw, 0.7, 1)) : 1;
      card.position.y = 4.6 + Math.sin(time * 1.2) * 0.08;
      const explain = gen.clock.current.explain;
      let text = null;
      if (!animating) {
        if (isIdle(gen.clock)) text = cur.gen === 0 ? 'Generation 0: 24 random masks. Each raised tile is a number the mask keeps. Press Play or Next.' : `Generation ${cur.gen}: the best mask keeps ${cur.masks[0].filter(Boolean).length} of 64 numbers.`;
      } else if (!explain) text = 'Evolving: good masks are combined and a few tiles flip at random. Watch the amber tiles disappear. Use Explain speed to see each step.';
      else if (raw < 0.3) text = 'Step 1, selection: masks that keep meaning and stay small win the tournaments.';
      else if (raw < 0.5) text = 'Step 2, crossover: for each tile, a coin flip decides which parent the child copies.';
      else if (raw < 0.7) text = 'Step 3, mutation: a few tiles switch on or off at random.';
      else text = 'Step 4, new generation: tiles rise (kept) or sink (dropped). Amber tiles waste memory.';
      setCaption(capRef, text, explain ? 1200 : 4000);
      const pb = prev.masks[0]; const cb = cur.masks[0];
      tiles.forEach((tile, i) => {
        const a = pb[i] ? 1 : 0; const b = cb[i] ? 1 : 0; const k = a + (b - a) * t;
        const h = 0.16 + k * (0.4 + values[i] * 2.4);
        tile.scale.y = h / 0.16; tile.position.y = h / 2;
        const shown = animating && raw < 0.7 ? pb : cb;
        const col = shown[i] ? (useful[i] ? GREEN : AMBER) : OFF;
        tile.material.color.copy(col); tile.material.emissive.copy(shown[i] ? col : OFF); tile.material.emissiveIntensity = shown[i] ? 0.35 : 0;
        pillars[i].material.opacity = shown[i] ? 0.08 : 0.2;
      });
      let idx = 0;
      for (let r = 0; r < POP; r += 1) {
        const mask = (animating && raw < 0.7 ? prev : cur).masks[r]; const y = (POP - 1 - r) * 0.17 + 0.1;
        for (let i = 0; i < BIN_DIMS; i += 1) {
          m.makeTranslation(sx + (i % SIDE) * CELL - soff, y, Math.floor(i / SIDE) * CELL - soff);
          stack.setMatrixAt(idx, m);
          c.copy(mask[i] ? (useful[i] ? GREEN : AMBER) : OFF);
          if (r === 0) c.multiplyScalar(1.4);
          stack.setColorAt(idx, c); idx += 1;
        }
      }
      stack.instanceMatrix.needsUpdate = true; stack.instanceColor.needsUpdate = true;
    });
  });

  const applyPreset = (name) => {
    const pr = BGA_PRESETS.find((x) => x.name === name); if (!pr) return;
    setPreset(name); reset(pr.p); gen.setSpeed('normal'); gen.setPlaying(true);
  };

  useImperativeHandle(ref, () => ({
    run: (action) => {
      const st = stage.current;
      const [kind, arg] = action.split(':');
      if (kind === 'reset') { gen.setPlaying(false); setPreset(BGA_PRESETS[0].name); reset(BGA_PRESETS[0].p); }
      if (kind === 'pause') gen.setPlaying(false);
      if (kind === 'play') { gen.setSpeed(arg || 'normal'); gen.setPlaying(true); }
      if (kind === 'preset') { const p = BGA_PRESETS.find((x) => x.name.startsWith(arg)); if (p) applyPreset(p.name); }
      if (kind === 'cam' && st) {
        if (arg === 'wide') st.flyTo([2, 9, 13], [0, 1.5, 0]);
        if (arg === 'board') st.flyTo([4, 7, 6.5], [2.2, 0.8, 0]);
        if (arg === 'stack') st.flyTo([-1, 5, 6], [-4.6, 2, 0]);
      }
      if (kind === 'toast') { setToast(arg); setTimeout(() => setToast(null), 3500); }
    },
  }));

  return (
    <div className="relative h-[600px] overflow-hidden rounded-2xl border border-slate-800 bg-[#070b16]">
      <div ref={box} className="absolute inset-0" />
      <Hud title="Binary Genetic Algorithm" color="#6ee7b7" items={[
        { label: 'numbers kept', value: `${hud.kept} / ${BIN_DIMS}`, color: '#86efac' },
        { label: 'meaningful kept', value: `${hud.usefulKept} / ${nUseful}`, color: hud.usefulKept === nUseful ? '#86efac' : '#fde68a' },
        { label: 'meaning retained', value: `${(hud.signal * 100).toFixed(0)}%` },
        { label: 'memory saved', value: `${((1 - hud.kept / BIN_DIMS) * 100).toFixed(0)}%`, color: '#86efac' },
        { label: 'diversity', value: hud.div.toFixed(2) },
      ]} />
      <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#2fbf71]" />kept & meaningful</div>
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#f59e0b]" />kept but useless (wastes memory)</div>
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#1e293b] ring-1 ring-white/20" />dropped</div>
      </div>
      <Toast text={toast} />
      <PhaseCaption capRef={capRef} color="#6ee7b7" />
      <ControlBar gen={gen} value={hud.gen} onReset={() => reset()} presets={BGA_PRESETS} activePreset={preset} onPreset={applyPreset} />
    </div>
  );
});

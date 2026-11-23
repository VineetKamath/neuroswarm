import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Check, X, Stethoscope } from 'lucide-react';
import { GeneticAlgorithm, mulberry32, ndcgAtK } from '../../bio/engines';
import { TOY_QUERIES, toyFitness, rankQuery, BASELINE_GENOME } from '../../bio/toyProblem';
import { useGenerations, useStage, ControlBar, Hud, Toast, PhaseCaption, setCaption, isIdle, useLagged, progress, seg, smooth } from './common';
import { label, floor, glowSprite, setLinePoints } from './stage';
import { makeHelix } from './models';
import { cx } from '../ui';

const N = 24;
const GENE_COLORS = [0x94a3b8, 0x22b8e0, 0xf5a524, 0x2fbf71, 0xf0527a];
const GENE_NAMES = ['similarity', 'recency', 'exact words', 'right section', 'length'];
const GENE_HEX = ['#94a3b8', '#22b8e0', '#f5a524', '#2fbf71', '#f0527a'];
const BASE_FIT = toyFitness(BASELINE_GENOME);
const QUERY = TOY_QUERIES[0];
const SPLIT = 0.7; // point in a generation's animation where the new generation appears

export const GA_PRESETS = [
  { name: 'Balanced (default)', p: { mutationRate: 0.15, crossoverRate: 0.85, elitism: 2 } },
  { name: 'No mutation, no crossover', p: { mutationRate: 0, crossoverRate: 0, elitism: 2 } },
  { name: 'No elitism + heavy mutation', p: { mutationRate: 0.5, crossoverRate: 0.85, elitism: 0 } },
];

function makeGA(p, seed) {
  const ga = new GeneticAlgorithm({ genomeLength: 5, populationSize: N, tournamentSize: 3, seed, fitnessFn: toyFitness, ...p });
  // Generation 0 starts near the old system: trust similarity, ignore everything else.
  const r = mulberry32(seed + 7);
  ga.population = ga.population.map(() => [0.7 + 0.3 * r(), ...[0, 0, 0, 0].map(() => 0.12 * r())]);
  ga.fitness = ga.population.map(toyFitness); ga.history = []; ga.record();
  return ga;
}

const sortedSnap = (ga) => {
  const order = ga.population.map((_, i) => i).sort((a, b) => ga.fitness[b] - ga.fitness[a]);
  const rankOf = new Array(order.length); order.forEach((idx, r) => { rankOf[idx] = r; });
  return { genomes: order.map((i) => [...ga.population[i]]), fit: order.map((i) => ga.fitness[i]), rankOf, gen: ga.generation };
};

const slot = (r) => {
  const a = (-52 + (104 * r) / (N - 1)) * (Math.PI / 180);
  return [Math.sin(a) * 9, -Math.cos(a) * 9 + 5];
};

const hudOf = (ga) => {
  const s = sortedSnap(ga);
  return { gen: s.gen, best: s.fit[0], genome: s.genomes[0] };
};

export const GA3D = forwardRef(function GA3D(_, ref) {
  const [preset, setPreset] = useState(GA_PRESETS[0].name);
  const paramsRef = useRef(GA_PRESETS[0].p);
  const seedRef = useRef(42);
  const ga = useRef(makeGA(paramsRef.current, seedRef.current));
  const snaps = useRef({ prev: sortedSnap(ga.current), cur: sortedSnap(ga.current), events: [] });
  const [hud, setHudNow] = useState(() => hudOf(ga.current));
  const setHud = useLagged(setHudNow);
  const [toast, setToast] = useState(null);
  const capRef = useRef(null);

  const onStep = () => {
    const prev = sortedSnap(ga.current);
    ga.current.step();
    const cur = sortedSnap(ga.current);
    snaps.current = { prev, cur, events: ga.current.lastEvents, prevRankOf: prev.rankOf };
    setHud({ gen: cur.gen, best: cur.fit[0], genome: cur.genomes[0] }, gen.clock.current.ms * SPLIT);
  };
  const gen = useGenerations(onStep, 'slow');

  const reset = (p = paramsRef.current) => {
    paramsRef.current = p;
    // fixed seed: every reset replays the same run, so Back and Next are repeatable
    ga.current = makeGA(p, seedRef.current);
    const s = sortedSnap(ga.current);
    snaps.current = { prev: s, cur: s, events: [] };
    setHud(hudOf(ga.current), 0);
  };

  const [box, stage] = useStage({ camera: [2.6, 9.5, 19], target: [2.6, 2, 0] }, (st) => {
    const { THREE, scene } = st;
    scene.add(floor(THREE, 34));
    const towers = [];
    for (let r = 0; r < N; r += 1) {
      const g = new THREE.Group();
      const [x, z] = slot(r);
      g.position.set(x, 0, z);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1, 20), new THREE.MeshStandardMaterial({ color: 0x4c3fc4, emissive: 0x7c6cf2, emissiveIntensity: 0.25, roughness: 0.3, metalness: 0.3 }));
      g.add(ped);
      const helix = makeHelix(GENE_COLORS);
      helix.group.scale.setScalar(0.9);
      g.add(helix.group);
      const halo = glowSprite(THREE, 0xa78bfa, 1.8); halo.position.y = 0.1; g.add(halo);
      scene.add(g);
      towers.push({ g, ped, helix, halo });
    }
    const crown = glowSprite(THREE, 0xfbbf24, 1.6); scene.add(crown);
    const bestLbl = label('best recipe', { color: '#fde68a' }); scene.add(bestLbl);
    const left = label('fittest', { color: '#c4b5fd' }); left.position.set(slot(0)[0] - 0.4, -0.3, slot(0)[1] + 0.9); scene.add(left);
    const right = label('weakest', { color: '#64748b' }); right.position.set(slot(N - 1)[0] + 0.4, -0.3, slot(N - 1)[1] + 0.9); scene.add(right);

    const arcMat = new THREE.LineBasicMaterial({ color: 0xe9d5ff, transparent: true, opacity: 0 });
    const arcs = [];
    for (let k = 0; k < 14; k += 1) {
      const geo = new THREE.BufferGeometry().setFromPoints(new Array(24).fill(0).map(() => new THREE.Vector3()));
      const line = new THREE.Line(geo, arcMat); scene.add(line); arcs.push(line);
    }
    let lastGen = -1;
    const tmp = new THREE.Vector3();
    const white = new THREE.Color(0xffffff);

    st.onFrame((dt, time) => {
      const { prev, cur, events, prevRankOf } = snaps.current;
      const t = progress(gen.clock);
      const animating = cur.gen !== prev.gen && t < 1;
      const grow = animating ? smooth(seg(t, SPLIT, 1)) : 1;
      const selectGlow = animating ? Math.sin(Math.PI * seg(t, 0, 0.32)) : 0;

      const picked = new Array(N).fill(0);
      const offspring = (events || []).filter((e) => e.type === 'offspring');
      const elites = (events || []).filter((e) => e.type === 'elite').length;
      if (prevRankOf) offspring.forEach((e) => e.parents.forEach((pi) => { picked[prevRankOf[pi]] += 1; }));
      const maxPick = Math.max(1, ...picked);
      const mutated = new Map();
      if (cur.rankOf && events?.length) {
        offspring.forEach((e, k) => {
          const childIdx = elites + k * 2;
          if (childIdx < N && e.mutated.length) mutated.set(cur.rankOf[childIdx], e.mutated);
        });
      }
      const mutFlash = animating && t > 0.5 && t < 0.82;

      towers.forEach((tw, r) => {
        const f = prev.fit[r] + (cur.fit[r] - prev.fit[r]) * grow;
        const h = 0.2 + Math.max(0, f) * 3.0;
        tw.ped.scale.y = h; tw.ped.position.y = h / 2;
        tw.ped.material.emissiveIntensity = 0.2 + 1.6 * selectGlow * (picked[r] / maxPick);
        tw.helix.group.position.y = h + 0.05;
        tw.helix.group.rotation.y = time * 0.6 + r * 0.3;
        const genome = prev.genomes[r].map((gv, i) => gv + (cur.genomes[r][i] - gv) * grow);
        const mut = mutFlash ? mutated.get(r) : null;
        tw.helix.rungs.forEach((rg, i) => {
          const v = genome[i];
          rg.rung.scale.x = 0.25 + 0.75 * v;
          rg.bead.scale.setScalar(0.5 + 1.1 * v);
          const flash = mut && mut.includes(i);
          rg.mat.emissive.set(flash ? white : GENE_COLORS[i]);
          rg.mat.emissiveIntensity = flash ? 2.2 : 0.1 + v * 1.1;
        });
        tw.halo.material.opacity = 0.1 + 0.9 * selectGlow * (picked[r] / maxPick);
      });

      towers[0].g.getWorldPosition(tmp);
      const topY = towers[0].helix.group.position.y + 1.7;
      crown.position.set(tmp.x, topY + 0.15 * Math.sin(time * 2), tmp.z);
      bestLbl.position.set(tmp.x, topY + 0.65, tmp.z);

      if (cur.gen !== lastGen) {
        lastGen = cur.gen;
        arcs.forEach((line, k) => {
          const e = offspring[k];
          if (!e || !prevRankOf) { line.visible = false; return; }
          const a = slot(prevRankOf[e.parents[0]]); const b = slot(prevRankOf[e.parents[1]]);
          const c = slot(cur.rankOf[elites + k * 2] ?? 0);
          const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          const pts = [];
          for (let i = 0; i < 24; i += 1) {
            const u = i / 23; const uu = u < 0.5 ? u * 2 : (u - 0.5) * 2;
            const from = u < 0.5 ? a : mid; const to = u < 0.5 ? mid : c;
            pts.push(new THREE.Vector3(from[0] + (to[0] - from[0]) * uu, 4.5 + Math.sin(Math.PI * u) * 3, from[1] + (to[1] - from[1]) * uu));
          }
          setLinePoints(line.geometry, pts); line.visible = true;
        });
      }
      arcMat.opacity = animating ? 0.9 * Math.sin(Math.PI * seg(t, 0.28, 0.55)) : 0;

      const explain = gen.clock.current.explain;
      let text = null;
      if (!animating) {
        if (isIdle(gen.clock)) text = cur.gen === 0 ? 'Generation 0: 24 recipes, all close to the old system. Press Play or Next.' : `Generation ${cur.gen} is ready. Best score ${cur.fit[0].toFixed(3)}.`;
      } else if (!explain) text = 'Evolving: each generation picks parents, mixes their genes and changes a few at random. Use Explain speed to see each step.';
      else if (t < 0.3) text = 'Step 1, selection: the glowing pedestals are the recipes picked as parents. Fitter ones get picked more often.';
      else if (t < 0.5) text = 'Step 2, crossover: each arc joins two parents to a child that mixes their genes.';
      else if (t < SPLIT) text = mutated.size ? 'Step 3, mutation: the white rungs are genes that just got a small random change.' : 'Step 3, mutation: this time no gene changed by chance.';
      else text = `Step 4, new generation ${cur.gen}: the helices reshape and the pedestals move to their new scores.`;
      setCaption(capRef, text, explain ? 1200 : 4000);
    });
  });

  const applyPreset = (name, play = true) => {
    const p = GA_PRESETS.find((x) => x.name === name); if (!p) return;
    setPreset(name); reset(p.p);
    if (play) { gen.setSpeed('normal'); gen.setPlaying(true); }
  };

  useImperativeHandle(ref, () => ({
    run: (action) => {
      const st = stage.current;
      const [kind, arg] = action.split(':');
      if (kind === 'reset') { gen.setPlaying(false); setPreset(GA_PRESETS[0].name); reset(GA_PRESETS[0].p); }
      if (kind === 'pause') gen.setPlaying(false);
      if (kind === 'play') { gen.setSpeed(arg || 'slow'); gen.setPlaying(true); }
      if (kind === 'cam' && st) {
        if (arg === 'tower') { const [x, z] = slot(0); st.flyTo([x + 2.5, 4.5, z + 4.5], [x, 2.4, z]); }
        if (arg === 'wide') st.flyTo([2.6, 9.5, 19], [2.6, 2, 0]);
        if (arg === 'top') st.flyTo([0, 16, 6], [0, 0, 0]);
      }
      if (kind === 'preset') { const p = GA_PRESETS.find((x) => x.name.startsWith(arg)); if (p) applyPreset(p.name); }
      if (kind === 'toast') { setToast(arg); setTimeout(() => setToast(null), 3500); }
    },
  }));

  const evo = rankQuery(hud.genome, QUERY);
  const base = rankQuery(BASELINE_GENOME, QUERY);

  return (
    <div className="relative h-[600px] overflow-hidden rounded-2xl border border-slate-800 bg-[#070b16]">
      <div ref={box} className="absolute inset-0" />
      <Hud title="Genetic Algorithm" color="#a78bfa" items={[
        { label: 'generation', value: hud.gen },
        { label: 'best score', value: hud.best.toFixed(3), color: '#c4b5fd' },
        { label: 'old system', value: BASE_FIT.toFixed(3), color: '#94a3b8' },
      ]} />
      <Toast text={toast} />

      <div className="absolute right-3 top-3 z-10 w-[300px] rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-slate-200 backdrop-blur-md">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-violet-300"><Stethoscope className="h-3.5 w-3.5" />Dr. Sharma asks about Kamala</div>
        <div className="mt-1 text-sm font-bold text-white">"{QUERY.question}"</div>
        <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Results ranked by the best recipe</div>
        <ol className="mt-1 space-y-1">
          {evo.slice(0, 4).map((c, i) => (
            <li key={c.id} className={cx('flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] transition-all duration-500', c.rel === 1 ? 'bg-emerald-500/20 text-emerald-100' : 'bg-white/[0.04] text-slate-300')}>
              <span className="font-mono text-slate-500">{i + 1}</span>
              {c.rel === 1 ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> : c.rel > 0 ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700" /> : <X className="h-3.5 w-3.5 shrink-0 text-slate-600" />}
              <span className="truncate">{c.text}</span>
            </li>
          ))}
        </ol>
        <div className="mt-2 flex justify-between text-[10px]">
          <span className="text-slate-500">old system had the answer at #{base.findIndex((c) => c.rel === 1) + 1}</span>
          <span className="font-mono text-violet-300">quality {ndcgAtK(evo.map((c) => c.rel), 3).toFixed(2)}</span>
        </div>
        <div className="mt-3 border-t border-white/5 pt-2">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Best recipe: how much it trusts each clue</div>
          {GENE_NAMES.map((n, i) => (
            <div key={n} className="flex items-center gap-2 text-[10px]">
              <span className="w-20 text-slate-400">{n}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${hud.genome[i] * 100}%`, background: GENE_HEX[i] }} /></div>
            </div>
          ))}
        </div>
      </div>

      <PhaseCaption capRef={capRef} color="#a78bfa" />
      <ControlBar gen={gen} value={hud.gen} onReset={() => { gen.setPlaying(false); reset(); }} presets={GA_PRESETS} activePreset={preset} onPreset={(n) => applyPreset(n)} />
    </div>
  );
});

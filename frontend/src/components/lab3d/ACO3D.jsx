import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { AntColony } from '../../bio/engines';
import { ACO_INTENTS, ACO_PARTITIONS, ACO_SIZES, acoGoldFor } from '../../bio/toyProblem';
import { useGenerations, useStage, ControlBar, Hud, Toast, PhaseCaption, setCaption, isIdle, useLagged, progress, seg } from './common';
import { makeAnt, makeMound, makePaperStack } from './models';
import { label, floor, glowSprite } from './stage';

const ICOL = [0xf5a524, 0x22b8e0, 0xf0527a, 0xa78bfa];
const ICSS = ['#f5a524', '#22b8e0', '#f0527a', '#a78bfa'];
const TOTAL = Object.values(ACO_SIZES).reduce((a, b) => a + b, 0);
export const ACO_PRESETS = [
  { name: 'Balanced (default)', p: { evaporation: 0.12, alpha: 1, beta: 1 } },
  { name: 'α = 0: ants ignore trails', p: { evaporation: 0.12, alpha: 0, beta: 1 } },
  { name: 'No evaporation', p: { evaporation: 0, alpha: 1, beta: 1 } },
  { name: 'Greedy β = 4: only cheap sections', p: { evaporation: 0.12, alpha: 1, beta: 4 } },
];

function makeColony(p, seed) {
  const ac = new AntColony({ intents: ACO_INTENTS, partitions: ACO_PARTITIONS, goldFor: acoGoldFor, sizes: ACO_SIZES, nAnts: 16, budget: 2, seed, ...p });
  const minSize = Math.min(...Object.values(ACO_SIZES));
  ac.eta = ACO_INTENTS.map(() => ACO_PARTITIONS.map((n) => minSize / ACO_SIZES[n]));
  return ac;
}
const snap = (c) => ({ tau: c.tau.map((r) => [...r]), walks: c.lastWalks || [], it: c.iteration });

const hillPos = (i) => [-5.4 + i * 2.6, 0, 4.2];
const pilePos = (p) => [-7 + p * 2, 0, -4];

export const ACO3D = forwardRef(function ACO3D(_, ref) {
  const [preset, setPreset] = useState(ACO_PRESETS[0].name);
  const seedRef = useRef(99);
  const colony = useRef(makeColony(ACO_PRESETS[0].p, seedRef.current));
  const snaps = useRef({ prev: snap(colony.current), cur: snap(colony.current) });
  const routesOf = (c) => ACO_INTENTS.map((intent, i) => {
    const r = c.bestRoute(i).map((p) => ACO_PARTITIONS[p]);
    return { intent, r, ok: r.some((n) => acoGoldFor(intent).includes(n)) };
  });
  const [hud, setHudNow] = useState(() => ({ it: 0, hit: null, scan: null, routes: routesOf(colony.current) }));
  const setHud = useLagged(setHudNow);
  const capRef = useRef(null);
  const [toast, setToast] = useState(null);

  const onStep = () => {
    const prev = snap(colony.current); colony.current.step(); const cur = snap(colony.current);
    snaps.current = { prev, cur };
    const h = colony.current.history[colony.current.history.length - 1];
    setHud({ it: cur.it, hit: h.hitRate, scan: h.meanScanned / TOTAL, routes: routesOf(colony.current) }, gen.clock.current.ms * 0.92);
  };
  const gen = useGenerations(onStep, 'slow');
  const reset = (p = ACO_PRESETS.find((x) => x.name === preset).p) => {
    colony.current = makeColony(p, seedRef.current); // fixed seed: every reset replays the same run
    const s = snap(colony.current); snaps.current = { prev: s, cur: s }; setHud({ it: 0, hit: null, scan: null, routes: routesOf(colony.current) }, 0);
  };

  const [box, stage] = useStage({ camera: [0, 12, 14], target: [0, 0, -0.5] }, (st) => {
    const { THREE, scene } = st;
    scene.add(floor(THREE, 30, 0x16203a));
    const ground = new THREE.Mesh(new THREE.CircleGeometry(15, 48), new THREE.MeshStandardMaterial({ color: 0x0b1222, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; scene.add(ground);

    ACO_INTENTS.forEach((intent, i) => {
      const [x, z] = hillPos(i);
      const hill = makeMound(ICOL[i]); hill.position.set(x, 0, z); scene.add(hill);
      const l = label(`${intent} questions`, { color: ICSS[i] }); l.position.set(x, -0.2, z + 1.3); scene.add(l);
    });
    ACO_PARTITIONS.forEach((name, p) => {
      const [x, z] = pilePos(p);
      const stack = makePaperStack(Math.round(ACO_SIZES[name] / 3)); const h = stack.height;
      stack.group.position.set(x, 0, z); scene.add(stack.group);
      const l = label(`${name.replace(' :: ', ' · ')} (${ACO_SIZES[name]})`, { color: '#cbd5e1' }); l.position.set(x, h + 0.8 + (p % 2) * 0.8, z); scene.add(l);
      ACO_INTENTS.forEach((intent, i) => {
        if (!acoGoldFor(intent).includes(name)) return;
        const g = glowSprite(THREE, ICOL[i], 0.9); g.position.set(x - 0.25 + i * 0.18, h + 0.4 + i * 0.05, z); scene.add(g);
      });
    });
    const tl = label('a coloured dot above a pile marks where that question type finds its answer', { color: '#94a3b8' }); tl.position.set(0, 0, -7.2); scene.add(tl);

    // pheromone trails
    const curve = (i, p) => {
      const a = new THREE.Vector3(...hillPos(i)); const b = new THREE.Vector3(...pilePos(p));
      const mid = a.clone().lerp(b, 0.5); mid.y = 0.05; mid.x += (i - 1.5) * 0.3;
      return new THREE.QuadraticBezierCurve3(a.setY(0.05), mid, b.setY(0.05));
    };
    const trails = ACO_INTENTS.map((_, i) => ACO_PARTITIONS.map((__, p) => {
      const c = curve(i, p);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(c, 40, 0.07, 6), new THREE.MeshStandardMaterial({ color: ICOL[i], emissive: ICOL[i], emissiveIntensity: 0.6, transparent: true, opacity: 0.05, depthWrite: false }));
      scene.add(mesh); return { mesh, c };
    }));

    // ants
    const ants = Array.from({ length: 40 }, () => {
      const ant = makeAnt(0x2a1d12);
      const m = new THREE.Group(); m.add(ant.group); m.scale.setScalar(1.5);
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      marker.position.set(-0.15, 0.25, 0); ant.group.add(marker);
      const food = glowSprite(THREE, 0xfde68a, 0.45); food.position.set(0.3, 0.2, 0); ant.group.add(food);
      scene.add(m); return { m, food, ant, marker, prev: new THREE.Vector3(), yaw: 0 };
    });

    const v = new THREE.Vector3();
    st.onFrame((dt, time) => {
      const { prev, cur } = snaps.current;
      const t = progress(gen.clock);
      const running = cur.it !== prev.it && t < 1;
      const explain = gen.clock.current.explain;
      let text = null;
      if (!running) {
        if (isIdle(gen.clock)) text = cur.it === 0 ? 'No trails yet, so ants will choose almost at random. Press Play or Next.' : `Round ${cur.it} done. Bright trails are the routes the colony trusts.`;
      } else if (!explain) text = 'Ants keep searching. Paths that find the answer get brighter, the rest fade. Use Explain speed to see each step.';
      else if (t < 0.4) text = 'Step 1: ants walk from their anthill to the note section they picked first.';
      else if (t < 0.55) text = 'Step 2: each ant checks a second section.';
      else if (t < 0.75) text = 'Step 3: ants that found the answer carry it home (gold) and leave pheromone on that path.';
      else text = 'Step 4: trails update. Used paths get brighter and every trail fades a little (evaporation).';
      setCaption(capRef, text, explain ? 1200 : 4000);
      const ev = seg(t, 0.75, 1);
      const maxTau = Math.max(0.3, ...cur.tau.flat());
      trails.forEach((row, i) => row.forEach((tr, p) => {
        const tau = prev.tau[i][p] + (cur.tau[i][p] - prev.tau[i][p]) * ev;
        const k = Math.sqrt(tau / maxTau);
        tr.mesh.material.opacity = 0.04 + 0.85 * k; tr.mesh.material.emissiveIntensity = 0.2 + 1.2 * k;
      }));
      ants.forEach((a, k) => {
        const w = cur.walks[k];
        if (!w) { a.m.visible = false; return; }
        a.m.visible = true;
        const jitter = (k % 7) * 0.02; const tt = Math.max(0, Math.min(1, (t - jitter) / 0.9));
        const ok = w.foundAt >= 0;
        const p1 = w.route[0]; const p2 = w.route[1] ?? p1;
        const goldP = ok ? w.route[w.foundAt] : null;
        a.marker.material.color.setHex(ICOL[w.intent]);
        a.food.visible = false;
        if (tt < 0.4) {
          trails[w.intent][p1].c.getPoint(tt / 0.4, v);
        } else if (tt < 0.55) {
          const a1 = new THREE.Vector3(...pilePos(p1)); const a2 = new THREE.Vector3(...pilePos(w.foundAt === 0 ? p1 : p2));
          v.lerpVectors(a1, a2, (tt - 0.4) / 0.15); v.z += Math.sin(((tt - 0.4) / 0.15) * Math.PI) * 0.8;
        } else if (ok) {
          trails[w.intent][goldP].c.getPoint(1 - (tt - 0.55) / 0.45, v); a.food.visible = true;
        } else {
          v.set(...pilePos(p2)); v.z += 0.6; a.marker.material.color.setHex(0x475569);
        }
        a.m.position.set(v.x + ((k % 5) - 2) * 0.08, 0, v.z);
        const dx = a.m.position.x - a.prev.x; const dz = a.m.position.z - a.prev.z;
        const moving = Math.hypot(dx, dz) > 0.002;
        if (moving) {
          const target = Math.atan2(-dz, dx);
          let d = target - a.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
          a.yaw += d * Math.min(1, dt * 10);
        }
        a.m.rotation.y = a.yaw;
        a.ant.legs.forEach((lg) => { lg.pivot.rotation.y = moving ? Math.sin(time * 22 + lg.phase) * 0.45 : 0; });
        a.prev.copy(a.m.position);
      });
    });
  });

  const applyPreset = (name) => {
    const pr = ACO_PRESETS.find((x) => x.name === name); if (!pr) return;
    setPreset(name); reset(pr.p); gen.setSpeed('normal'); gen.setPlaying(true);
  };

  useImperativeHandle(ref, () => ({
    run: (action) => {
      const st = stage.current;
      const [kind, arg] = action.split(':');
      if (kind === 'reset') { gen.setPlaying(false); setPreset(ACO_PRESETS[0].name); reset(ACO_PRESETS[0].p); }
      if (kind === 'pause') gen.setPlaying(false);
      if (kind === 'play') { gen.setSpeed(arg || 'slow'); gen.setPlaying(true); }
      if (kind === 'preset') { const p = ACO_PRESETS.find((x) => x.name.startsWith(arg)); if (p) applyPreset(p.name); }
      if (kind === 'cam' && st) {
        if (arg === 'wide') st.flyTo([0, 12, 14], [0, 0, -0.5]);
        if (arg === 'top') st.flyTo([0, 21, 2], [0, 0, 0]);
        if (arg === 'hills') st.flyTo([-1.5, 5, 11], [-1.5, 0, 3.5]);
        if (arg === 'food') st.flyTo([0, 6, 4], [0, 0, -4]);
      }
      if (kind === 'toast') { setToast(arg); setTimeout(() => setToast(null), 3500); }
    },
  }));

  const routes = hud.routes;

  return (
    <div className="relative h-[600px] overflow-hidden rounded-2xl border border-slate-800 bg-[#070b16]">
      <div ref={box} className="absolute inset-0" />
      <Hud title="Ant Colony Optimization" color="#fbbf24" items={[
        { label: 'iteration', value: hud.it },
        { label: 'ants that found it', value: hud.hit == null ? '-' : `${(hud.hit * 100).toFixed(0)}%`, color: '#fde68a' },
        { label: 'notes scanned', value: hud.scan == null ? '-' : `${(hud.scan * 100).toFixed(0)}%`, color: '#86efac' },
      ]} />
      <div className="absolute right-3 top-3 z-10 w-[260px] rounded-2xl border border-white/10 bg-slate-950/80 p-3 backdrop-blur-md">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Where NeuroSwarm would search first</div>
        {routes.map((r, i) => (
          <div key={r.intent} className="flex items-start gap-2 py-0.5 text-[11px]">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: ICSS[i] }} />
            <div className="min-w-0 flex-1"><b className="text-slate-100">{r.intent}</b><div className="truncate text-slate-400">{r.r.join(' + ')}</div></div>
            {r.ok ? <Check className="mt-0.5 h-3.5 w-3.5 text-emerald-400" /> : <X className="mt-0.5 h-3.5 w-3.5 text-rose-400" />}
          </div>
        ))}
      </div>
      <Toast text={toast} />
      <PhaseCaption capRef={capRef} color="#fbbf24" />
      <ControlBar gen={gen} value={hud.it} label="Round" onReset={() => reset()} presets={ACO_PRESETS} activePreset={preset} onPreset={applyPreset} />
    </div>
  );
});

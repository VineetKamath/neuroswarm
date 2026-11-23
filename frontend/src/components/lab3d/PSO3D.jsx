import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ParticleSwarm } from '../../bio/engines';
import { psoLandscape, PSO_OPTIMUM, PSO_DECOY } from '../../bio/toyProblem';
import { useGenerations, useStage, ControlBar, Hud, Toast, PhaseCaption, setCaption, isIdle, useLagged, progress, smooth } from './common';
import { makeBird, flap } from './models';
import { label, glowSprite, setLinePoints } from './stage';

const SIZE = 12; const HMAX = 4.2;
const fit = ([x, y]) => psoLandscape(x, y);
const MAXF = (() => { let m = 0; for (let i = 0; i <= 60; i += 1) for (let j = 0; j <= 60; j += 1) m = Math.max(m, psoLandscape(i / 60, j / 60)); return m; })();
const toWorld = (x, y) => [(x - 0.5) * SIZE, (psoLandscape(x, y) / MAXF) * HMAX, (0.5 - y) * SIZE];

export const PSO_PRESETS = [
  { name: 'Balanced (default)', seed: 8, p: { inertia: 0.72, cognitive: 1.5, social: 1.5 } },
  { name: 'Herd: only follow the leader', seed: 7, p: { inertia: 0.4, cognitive: 0, social: 2.4 } },
  { name: 'Loners: never share', seed: 9, p: { inertia: 0.72, cognitive: 2.0, social: 0 } },
  { name: 'No momentum', seed: 10, p: { inertia: 0, cognitive: 1.5, social: 1.5 } },
];

const RAMP = [[0.04, 0.06, 0.16], [0.2, 0.13, 0.45], [0.13, 0.47, 0.78], [0.24, 0.78, 0.82], [0.98, 0.96, 0.75]];
function ramp(t) {
  const x = Math.max(0, Math.min(0.999, t)) * (RAMP.length - 1); const i = Math.floor(x); const f = x - i;
  return RAMP[i].map((c, k) => c + (RAMP[i + 1][k] - c) * f);
}

const snap = (s) => ({ pos: s.positions.map((p) => [...p]), vel: s.velocities.map((v) => [...v]), pbest: s.pBest.map((p) => [...p]), gbest: [...s.gBest], gfit: s.gBestFit, it: s.iteration });

export const PSO3D = forwardRef(function PSO3D(_, ref) {
  const [preset, setPreset] = useState(PSO_PRESETS[0].name);
  const make = (pr) => new ParticleSwarm({ genomeLength: 2, swarmSize: 22, vMax: 0.1, seed: pr.seed, fitnessFn: fit, ...pr.p });
  const swarm = useRef(make(PSO_PRESETS[0]));
  const snaps = useRef({ prev: snap(swarm.current), cur: snap(swarm.current) });
  const trails = useRef([]);
  const [hud, setHudNow] = useState({ it: 0, g: swarm.current.gBestFit, status: 'searching' });
  const setHud = useLagged(setHudNow);
  const capRef = useRef(null);
  const [toast, setToast] = useState(null);
  const showForces = useRef(true);

  const status = (g) => (Math.hypot(g[0] - PSO_OPTIMUM.x, g[1] - PSO_OPTIMUM.y) < 0.06 ? 'found the true peak'
    : Math.hypot(g[0] - PSO_DECOY.x, g[1] - PSO_DECOY.y) < 0.08 ? 'stuck on the decoy' : 'searching');

  const onStep = () => {
    const prev = snap(swarm.current); swarm.current.step(); const cur = snap(swarm.current);
    trails.current = cur.pos.map((_, i) => [...(trails.current[i] || []), prev.pos[i]].slice(-14));
    snaps.current = { prev, cur };
    setHud({ it: cur.it, g: cur.gfit, status: status(cur.gbest) }, gen.clock.current.ms * 0.85);
  };
  const gen = useGenerations(onStep, 'normal');
  const reset = (pr = PSO_PRESETS.find((x) => x.name === preset) || PSO_PRESETS[0]) => {
    swarm.current = make(pr); trails.current = [];
    const s = snap(swarm.current); snaps.current = { prev: s, cur: s };
    setHud({ it: 0, g: s.gfit, status: 'searching' }, 0);
  };

  const [box, stage] = useStage({ camera: [0, 10, 13], target: [0, 0.8, 0], autoRotate: false }, (st) => {
    const { THREE, scene } = st;
    // terrain
    const seg = 90;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, seg, seg); geo.rotateX(-Math.PI / 2);
    const colors = [];
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i) / SIZE + 0.5; const y = 0.5 - pos.getZ(i) / SIZE;
      const f = psoLandscape(x, y) / MAXF;
      pos.setY(i, f * HMAX); colors.push(...ramp(f));
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, flatShading: false })));
    const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.05 }));
    scene.add(wire);

    const peak = (p, txt, col) => { const [x, y, z] = toWorld(p.x, p.y); const l = label(txt, { color: col }); l.position.set(x, y + 1.3, z); scene.add(l); };
    peak(PSO_OPTIMUM, '★ true best setting', '#fde68a');
    peak(PSO_DECOY, 'decoy hill (good, not best)', '#cbd5e1');
    const ax1 = label('weight on recency →', { color: '#94a3b8' }); ax1.position.set(0, 0, SIZE / 2 + 0.8); scene.add(ax1);
    const ax2 = label('weight on exact words →', { color: '#94a3b8' }); ax2.position.set(-SIZE / 2 - 1.2, 0, 0); scene.add(ax2);
    const ax3 = label('height = search quality', { color: '#94a3b8' }); ax3.position.set(SIZE / 2 + 0.5, HMAX * 0.6, -SIZE / 2); scene.add(ax3);

    // particles
    const n = 22;
    const parts = [];
    for (let i = 0; i < n; i += 1) {
      const bird = i === 0 ? makeBird(0xffffff, 0x94a3b8) : makeBird(0x22d3ee, 0x0e7490);
      bird.group.scale.setScalar(i === 0 ? 1.5 : 1.1);
      const m = bird.group;
      const glow = glowSprite(THREE, i === 0 ? 0xffffff : 0x22d3ee, 0.7); m.add(glow);
      scene.add(m);
      const tgeo = new THREE.BufferGeometry().setFromPoints(new Array(15).fill(0).map(() => new THREE.Vector3()));
      const trail = new THREE.Line(tgeo, new THREE.LineBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.35 }));
      scene.add(trail);
      const pb = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 20), new THREE.MeshBasicMaterial({ color: 0xa5f3fc, transparent: true, opacity: 0.6 }));
      pb.rotation.x = Math.PI / 2; scene.add(pb);
      parts.push({ m, trail, pb, bird, yaw: 0 });
    }
    const meLbl = label('this bird', { color: '#ffffff' }); scene.add(meLbl);

    // global best beacon
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    scene.add(beacon);
    const bGlow = glowSprite(THREE, 0xfbbf24, 1.8); scene.add(bGlow);
    const gLbl = label('best spot the flock has found', { color: '#fde68a' }); scene.add(gLbl);

    // force arrows on particle 0
    const mkArrow = (c) => { const a = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, c, 0.3, 0.18); scene.add(a); return a; };
    const arrows = [mkArrow(0xcbd5e1), mkArrow(0x67e8f9), mkArrow(0xfbbf24)];
    const arrowLbls = ['momentum', 'own memory', 'follow flock'].map((t, i) => { const l = label(t, { color: ['#cbd5e1', '#67e8f9', '#fbbf24'][i] }); scene.add(l); return l; });

    const v = new THREE.Vector3(); const o = new THREE.Vector3();
    st.onFrame((dt, time) => {
      const { prev, cur } = snaps.current;
      const t = smooth(progress(gen.clock));
      parts.forEach((p, i) => {
        const x = prev.pos[i][0] + (cur.pos[i][0] - prev.pos[i][0]) * t;
        const y = prev.pos[i][1] + (cur.pos[i][1] - prev.pos[i][1]) * t;
        const [wx, wy, wz] = toWorld(x, y);
        p.m.position.set(wx, wy + 0.45 + 0.06 * Math.sin(time * 4 + i), wz);
        const dx = cur.pos[i][0] - prev.pos[i][0]; const dz = -(cur.pos[i][1] - prev.pos[i][1]);
        if (Math.hypot(dx, dz) > 1e-4) {
          const target = Math.atan2(-dz, dx);
          let d = target - p.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
          p.yaw += d * Math.min(1, dt * 6);
        }
        p.m.rotation.y = p.yaw;
        flap(p.bird, time + i * 0.37, t < 1 ? 14 : 7);
        const tr = trails.current[i] || [];
        const pts = [...tr.map(([a, b]) => { const w = toWorld(a, b); return new THREE.Vector3(w[0], w[1] + 0.3, w[2]); }), p.m.position.clone()];
        while (pts.length < 15) pts.unshift(pts[0].clone());
        setLinePoints(p.trail.geometry, pts);
        const [bx, by, bz] = toWorld(cur.pbest[i][0], cur.pbest[i][1]);
        p.pb.position.set(bx, by + 0.08, bz);
      });
      meLbl.position.copy(parts[0].m.position).add(v.set(0, 1.1, 0));
      const tt = progress(gen.clock);
      const moving = cur.it !== prev.it && tt < 1;
      const explain = gen.clock.current.explain;
      let text = null;
      if (!moving) {
        if (isIdle(gen.clock)) text = cur.it === 0 ? 'Birds start in random places. Each one is a guess at the best settings. Press Play or Next.' : `Iteration ${cur.it}: the gold beacon marks the best spot any bird has found.`;
      } else if (!explain) text = 'Flying: every bird mixes momentum, its own best spot and the flock best (the arrows on the white bird).';
      else if (tt < 0.3) text = 'Step 1: each bird checks how good its spot is and updates its own best (the small rings).';
      else text = 'Step 2: each bird flies using momentum (grey), a pull to its own best (blue) and a pull to the flock best (gold).';
      setCaption(capRef, text, explain ? 1200 : 4000);
      const [gx, gy, gz] = toWorld(cur.gbest[0], cur.gbest[1]);
      beacon.position.set(gx, gy + 3, gz); bGlow.position.set(gx, gy + 0.4, gz); gLbl.position.set(gx, gy + 6.3, gz);
      bGlow.scale.setScalar(1.6 + 0.3 * Math.sin(time * 3));

      // forces (expected pull, r = 0.5) on particle 0
      const s = swarm.current; const x0 = cur.pos[0]; const vel = cur.vel[0];
      const vecs = [
        [s.inertia * vel[0] * 8, s.inertia * vel[1] * 8],
        [s.cognitive * 0.5 * (cur.pbest[0][0] - x0[0]), s.cognitive * 0.5 * (cur.pbest[0][1] - x0[1])],
        [s.social * 0.5 * (cur.gbest[0] - x0[0]), s.social * 0.5 * (cur.gbest[1] - x0[1])],
      ];
      o.copy(parts[0].m.position);
      arrows.forEach((a, k) => {
        const dx = vecs[k][0] * SIZE * 0.5; const dz = -vecs[k][1] * SIZE * 0.5;
        const len = Math.hypot(dx, dz);
        a.visible = showForces.current && len > 0.12;
        if (!a.visible) { arrowLbls[k].visible = false; return; }
        a.position.copy(o); a.setDirection(v.set(dx, 0, dz).normalize()); a.setLength(Math.min(len, 5), 0.3, 0.18);
        arrowLbls[k].visible = true;
        arrowLbls[k].position.copy(o).add(v.set(dx, 0, dz).normalize().multiplyScalar(Math.min(len, 5) + 0.4)).add(new THREE.Vector3(0, 0.2, 0));
      });
    });
  });

  const applyPreset = (name) => {
    const pr = PSO_PRESETS.find((x) => x.name === name); if (!pr) return;
    setPreset(name); reset(pr); gen.setSpeed('normal'); gen.setPlaying(true);
  };

  useImperativeHandle(ref, () => ({
    run: (action) => {
      const st = stage.current;
      const [kind, arg] = action.split(':');
      if (kind === 'reset') { gen.setPlaying(false); reset(PSO_PRESETS[0]); setPreset(PSO_PRESETS[0].name); }
      if (kind === 'pause') gen.setPlaying(false);
      if (kind === 'play') { gen.setSpeed(arg || 'normal'); gen.setPlaying(true); }
      if (kind === 'forces') showForces.current = arg !== 'off';
      if (kind === 'preset') { const p = PSO_PRESETS.find((x) => x.name.startsWith(arg)); if (p) applyPreset(p.name); }
      if (kind === 'cam' && st) {
        if (arg === 'wide') st.flyTo([0, 10, 13], [0, 0.8, 0]);
        if (arg === 'top') st.flyTo([0, 17, 0.5], [0, 0, 0]);
        if (arg === 'low') st.flyTo([-9, 4, 9], [0, 1.5, 0]);
      }
      if (kind === 'toast') { setToast(arg); setTimeout(() => setToast(null), 3500); }
    },
  }));

  return (
    <div className="relative h-[600px] overflow-hidden rounded-2xl border border-slate-800 bg-[#070b16]">
      <div ref={box} className="absolute inset-0" />
      <Hud title="Particle Swarm" color="#67e8f9" items={[
        { label: 'iteration', value: hud.it },
        { label: 'flock best', value: hud.g.toFixed(3), color: '#67e8f9' },
        { label: 'status', value: hud.status, color: hud.status.startsWith('found') ? '#86efac' : hud.status.startsWith('stuck') ? '#fca5a5' : '#e2e8f0' },
      ]} />
      <Toast text={toast} />
      <PhaseCaption capRef={capRef} color="#67e8f9" />
      <ControlBar gen={gen} value={hud.it} label="Iteration" onReset={() => reset()} presets={PSO_PRESETS} activePreset={preset} onPreset={applyPreset} />
    </div>
  );
});

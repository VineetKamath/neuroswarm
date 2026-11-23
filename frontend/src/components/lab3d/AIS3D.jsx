import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Microscope, Radar } from 'lucide-react';
import { NegativeSelection, mulberry32 } from '../../bio/engines';
import { useGenerations, useStage, ControlBar, Hud, PhaseCaption, setCaption, isIdle } from './common';

// AIS makes one detector per tick, so it uses its own pace.
const AIS_MS = { slow: 3200, normal: 600, fast: 120 };
import { makeTablet, tcellGeometry } from './models';
import { label, glowSprite, floor } from './stage';
import { cx } from '../ui';

const B = { hr: [20, 220], sys: [50, 260], spo2: [60, 100] };
const norm = (hr, sys, spo2) => [(hr - B.hr[0]) / (B.hr[1] - B.hr[0]), (sys - B.sys[0]) / (B.sys[1] - B.sys[0]), (spo2 - B.spo2[0]) / (B.spo2[1] - B.spo2[0])];
const W = 8;
const world = (p) => [(p[0] - 0.5) * W, p[1] * W, (0.5 - p[2]) * W];
const MAX_DET = 170;

function selfSet(seed) {
  const r = mulberry32(seed); const out = [];
  for (let i = 0; i < 90; i += 1) {
    const a = r() < 0.62;
    const hr = a ? 62 + r() * 26 : 88 + r() * 26;
    const sys = a ? 108 + r() * 26 : 132 + r() * 30;
    const spo2 = 93 + r() * 7;
    out.push(norm(hr, sys, spo2));
  }
  return out;
}

const SCENARIOS = [
  { hr: 78, sys: 122, spo2: 97, text: 'Normal adult, HR 78, BP 122, SpO₂ 97', truth: false },
  { hr: 180, sys: 124, spo2: 97, text: 'Typo: HR 81 typed as 180', truth: true },
  { hr: 8, sys: 118, spo2: 96, text: 'Typo: HR 84 lost a digit → 8', truth: true },
  { hr: 96, sys: 138, spo2: 9.7, text: 'Typo: SpO₂ 97 typed as 9.7', truth: true },
  { hr: 104, sys: 150, spo2: 95, text: 'Feverish ward patient, HR 104, BP 150', truth: false },
  { hr: 38, sys: 70, spo2: 99, text: 'Impossible combo, HR 38, BP 70, SpO₂ 99', truth: true },
  { hr: 70, sys: 116, spo2: 98, text: 'Normal, HR 70, BP 116, SpO₂ 98', truth: false },
  { hr: 160, sys: 128, spo2: 96, text: 'Typo: HR 61 entered as 160', truth: true },
];

export const AIS3D = forwardRef(function AIS3D(_, ref) {
  const seedRef = useRef(13);
  const make = () => { const a = new NegativeSelection({ selfRadius: 0.075, seed: seedRef.current, dims: 3, maxRadius: 0.17 }); a.setSelf(selfSet(seedRef.current + 100)); return a; };
  const ais = useRef(make());
  const [mode, setMode] = useState('train');
  const modeRef = useRef('train');
  const fx = useRef({ spawns: [], readings: [] });
  const [hud, setHud] = useState({ det: 0, tried: 0, killed: 0, caught: 0, missed: 0, falseAlarm: 0, ok: 0 });
  const [toast, setToast] = useState(null);
  const scen = useRef(0);
  const capRef = useRef(null);
  const flash = (text, tone) => { setToast({ text, tone }); clearTimeout(flash.t); flash.t = setTimeout(() => setToast(null), 2600); };

  const inject = (r) => {
    const p = norm(r.hr, r.sys, r.spo2).map((v) => Math.max(-0.05, Math.min(1.05, v)));
    const res = ais.current.test(p);
    fx.current.readings.push({ p, res, born: performance.now(), text: r.text });
    if (fx.current.readings.length > 10) fx.current.readings.shift();
    setTimeout(() => {
      setHud((h) => ({ ...h,
        caught: h.caught + (res.anomalous && r.truth ? 1 : 0), missed: h.missed + (!res.anomalous && r.truth ? 1 : 0),
        falseAlarm: h.falseAlarm + (res.anomalous && r.truth === false ? 1 : 0), ok: h.ok + (!res.anomalous && r.truth === false ? 1 : 0) }));
      flash(res.anomalous ? `Flagged: ${r.text}` : `Accepted: ${r.text}`, res.anomalous ? 'bad' : 'good');
    }, 950);
  };

  const onStep = () => {
    if (modeRef.current === 'monitor') { inject(SCENARIOS[scen.current % SCENARIOS.length]); scen.current += 1; return; }
    const a = ais.current;
    if (a.detectors.length >= MAX_DET) { gen.setPlaying(false); flash('Thymus training complete, switch to Monitor', 'good'); return; }
    const k = gen.speed === 'fast' ? 6 : gen.speed === 'normal' ? 2 : 1;
    const now = performance.now();
    a.grow(k).forEach((res) => {
      fx.current.spawns.push({ center: res.center, accepted: res.accepted, det: res.accepted ? a.detectors[a.detectors.length - 1] : null, born: now });
    });
    setHud((h) => ({ ...h, det: a.detectors.length, tried: a.attempts, killed: a.attempts - a.detectors.length }));
  };
  const gen = useGenerations(onStep, 'slow', AIS_MS);

  const reset = () => {
    ais.current = make(); // fixed seed: every reset replays the same run
    fx.current.spawns = []; fx.current.readings = []; scen.current = 0;
    fx.current.rebuild = true;
    setHud({ det: 0, tried: 0, killed: 0, caught: 0, missed: 0, falseAlarm: 0, ok: 0 });
  };
  const prefill = () => {
    // Monitoring needs a mature repertoire; finish the thymus quickly if the audience skipped it.
    const a = ais.current;
    while (a.detectors.length < 150 && a.attempts < 4000) a.grow(1);
    setHud((h) => ({ ...h, det: a.detectors.length, tried: a.attempts, killed: a.attempts - a.detectors.length }));
  };
  const switchMode = (m) => { modeRef.current = m; setMode(m); gen.setPlaying(false); if (m === 'monitor') gen.setSpeed('slow'); };

  const [box, stage] = useStage({ camera: [13, 9.5, 15], target: [0, 3.6, 0] }, (st) => {
    const { THREE, scene } = st;
    scene.add(floor(THREE, 20));
    // axes box
    const cube = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, W, W)), new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.6 }));
    cube.position.set(0, W / 2, 0); scene.add(cube);
    const ax = (t, pos) => { const l = label(t, { color: '#94a3b8' }); l.position.set(...pos); scene.add(l); };
    ax('heart rate →', [0, -0.3, W / 2 + 0.6]); ax('systolic BP ↑', [-W / 2 - 0.4, W / 2, W / 2]); ax('SpO₂ →', [W / 2 + 0.6, -0.3, 0]);

    // self cloud
    const selfGroup = new THREE.Group(); scene.add(selfGroup);
    const buildSelf = () => {
      selfGroup.clear();
      const a = ais.current; const rr = a.selfRadius * W;
      const halo = new THREE.InstancedMesh(new THREE.SphereGeometry(rr, 14, 10), new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.4, transparent: true, opacity: 0.12, depthWrite: false }), a.selfSamples.length);
      const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0x4ade80 }), a.selfSamples.length);
      const m = new THREE.Matrix4();
      a.selfSamples.forEach((s, i) => { m.makeTranslation(...world(s)); halo.setMatrixAt(i, m); dots.setMatrixAt(i, m); });
      selfGroup.add(halo, dots);
      const l = label('"self" = normal readings', { color: '#86efac' });
      const c = a.selfSamples.reduce((acc, s) => acc.map((v, k) => v + s[k] / a.selfSamples.length), [0, 0, 0]);
      l.position.set(...world(c)); l.position.y += 1.6; selfGroup.add(l);
    };
    buildSelf();

    // nurse tablet
    const tablet = makeTablet();
    const tabletPos = new THREE.Vector3(-W / 2 - 2.2, 2.2, W / 2 + 1.8); tablet.position.copy(tabletPos); tablet.lookAt(6, 4, 14); scene.add(tablet);
    const tl = label("Nurse Priya's tablet", { color: '#7dd3fc' }); tl.position.copy(tabletPos).add(new THREE.Vector3(0, 0.9, 0)); scene.add(tl);

    const detGroup = new THREE.Group(); scene.add(detGroup);
    const detMeshes = new Map();
    const sphereGeo = new THREE.SphereGeometry(1, 20, 14);
    const TCELL = 0.2;
    const spawnMeshes = [];
    const readMeshes = [];

    st.onFrame((dt, time) => {
      const now = performance.now();
      if (fx.current.rebuild) { fx.current.rebuild = false; buildSelf(); detGroup.clear(); detMeshes.clear(); spawnMeshes.forEach((m) => scene.remove(m)); spawnMeshes.length = 0; readMeshes.forEach((m) => scene.remove(m)); readMeshes.length = 0; }
      // spawn animations
      fx.current.spawns = fx.current.spawns.filter((s) => now - s.born < 1400);
      while (spawnMeshes.length < fx.current.spawns.length) {
        const m = new THREE.Mesh(tcellGeometry, new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, emissiveIntensity: 0.9 }));
        scene.add(m); spawnMeshes.push(m);
      }
      spawnMeshes.forEach((m, i) => {
        const s = fx.current.spawns[i];
        if (!s) { m.visible = false; return; }
        m.visible = true; m.position.set(...world(s.center));
        const age = (now - s.born) / 1400;
        m.rotation.set(age * 3, age * 4, 0);
        if (s.accepted) {
          m.material.color.setHex(0xfda4af); m.material.emissive.setHex(0xf0527a);
          m.scale.setScalar(TCELL * (1 + 0.6 * Math.sin(Math.PI * Math.min(1, age * 1.5))));
          m.material.opacity = Math.max(0, 1 - age * 1.4);
        } else {
          const red = age > 0.35;
          m.material.color.setHex(red ? 0xef4444 : 0xffffff); m.material.emissive.setHex(red ? 0xb91c1c : 0x94a3b8);
          m.scale.setScalar(red ? TCELL * (1 + (age - 0.35) * 3) : TCELL);
          m.material.opacity = red ? Math.max(0, 1 - (age - 0.35) * 1.7) : 0.95;
        }
      });
      // matured detectors
      ais.current.detectors.forEach((d) => {
        if (detMeshes.has(d)) return;
        const m = new THREE.Mesh(sphereGeo, new THREE.MeshStandardMaterial({ color: 0xf0527a, emissive: 0xbe123c, emissiveIntensity: 0.25, transparent: true, opacity: 0.055, depthWrite: false }));
        m.position.set(...world(d.center)); m.scale.setScalar(d.radius * W);
        const core = new THREE.Mesh(tcellGeometry, new THREE.MeshStandardMaterial({ color: 0xfb7185, emissive: 0xe11d48, emissiveIntensity: 0.5, roughness: 0.4 }));
        core.scale.setScalar(TCELL / (d.radius * W)); m.add(core); m.userData.core = core;
        detGroup.add(m); detMeshes.set(d, m);
      });
      detMeshes.forEach((m) => { m.material.emissiveIntensity = 0.25; m.material.opacity = 0.055; m.userData.core.rotation.y = time * 0.5; m.userData.core.material.emissiveIntensity = 0.5; });
      // readings flying in
      while (readMeshes.length < fx.current.readings.length) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        m.add(glowSprite(THREE, 0xffffff, 1.4)); scene.add(m); readMeshes.push(m);
      }
      const lastR = fx.current.readings[fx.current.readings.length - 1];
      if (modeRef.current === 'train') {
        const recent = fx.current.spawns[fx.current.spawns.length - 1];
        const explain = gen.clock.current.explain;
        if (!recent) { if (isIdle(gen.clock)) setCaption(capRef, ais.current.detectors.length ? `${ais.current.detectors.length} mature detectors. Press Play to make more, or switch to Monitor.` : 'Green dots are normal readings ("self"). Press Play to start making detectors.'); }
        else {
          const a = ais.current; const killed = a.attempts - a.detectors.length;
          const tally = `So far: ${killed} rejected, ${a.detectors.length} kept.`;
          const why = a.rejected[a.rejected.length - 1]?.reason || '';
          setCaption(capRef, !explain
            ? `Making detector cells. Any that touch normal data are destroyed, the rest are kept. ${tally}`
            : recent.accepted
              ? `New cell stayed clear of normal data, so it is kept as a detector. ${tally}`
              : why.startsWith('already')
                ? `New cell landed where detectors already cover, so it is not needed. ${tally}`
                : `New cell was too close to normal data, so it is destroyed (red burst). ${tally}`, explain ? 2500 : 4000);
        }
      } else if (!lastR) setCaption(capRef, 'Monitoring: send a reading from the tablet, or press Play to stream readings.');
      else if (now - lastR.born < 900) setCaption(capRef, `A reading is on its way: ${lastR.text}`, 2500);
      else setCaption(capRef, lastR.res.anomalous ? `Inside a detector, so it is flagged: ${lastR.text}` : `Inside the normal cloud, so it is accepted: ${lastR.text}`);
      readMeshes.forEach((m, i) => {
        const r = fx.current.readings[i]; if (!r) { m.visible = false; return; }
        m.visible = true;
        const to = new THREE.Vector3(...world(r.p));
        const k = Math.min(1, (now - r.born) / 900);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        m.position.lerpVectors(tabletPos, to, e); m.position.y += Math.sin(Math.PI * e) * 2.5;
        const landed = k >= 1; const latest = i === fx.current.readings.length - 1;
        const col = !landed ? 0xffffff : r.res.anomalous ? 0xff3366 : 0x4ade80;
        m.material.color.setHex(col); m.children[0].material.color.setHex(col);
        m.scale.setScalar(latest && landed ? 1 + 0.25 * Math.sin(time * 8) : latest ? 1 : 0.6);
        if (landed && latest && r.res.anomalous && r.res.detector) {
          const dm = detMeshes.get(r.res.detector);
          if (dm) { dm.material.emissiveIntensity = 1.4 + Math.sin(time * 10); dm.material.opacity = 0.35; dm.userData.core.material.emissiveIntensity = 2.5; }
        }
      });
    });
  });

  useImperativeHandle(ref, () => ({
    run: (action) => {
      const st = stage.current;
      const [kind, arg] = action.split(':');
      if (kind === 'reset') { gen.setPlaying(false); reset(); switchMode('train'); }
      if (kind === 'pause') gen.setPlaying(false);
      if (kind === 'train') { switchMode('train'); gen.setSpeed(arg || 'slow'); gen.setPlaying(true); }
      if (kind === 'monitor') { switchMode('monitor'); gen.setPlaying(false); if (ais.current.detectors.length < 60) prefill(); }
      if (kind === 'inject') { switchMode('monitor'); if (ais.current.detectors.length < 60) prefill(); inject(SCENARIOS[Number(arg) || 0]); }
      if (kind === 'stream') { switchMode('monitor'); if (ais.current.detectors.length < 60) prefill(); gen.setSpeed('slow'); gen.setPlaying(true); }
      if (kind === 'cam' && st) {
        if (arg === 'wide') st.flyTo([13, 9.5, 15], [0, 3.6, 0]);
        if (arg === 'self') st.flyTo([3, 5, 7], [-1.5, 3.6, 0]);
        if (arg === 'front') st.flyTo([2, 6, 17], [0, 3.6, 0]);
      }
    },
    inject,
  }));

  return (
    <div className="relative h-[600px] overflow-hidden rounded-2xl border border-slate-800 bg-[#070b16]">
      <div ref={box} className="absolute inset-0" />
      <Hud title="Artificial Immune System" color="#fb7185" items={mode === 'train' ? [
        { label: 'detectors matured', value: hud.det, color: '#fda4af' },
        { label: 'rejected', value: hud.killed, color: '#fca5a5' },
        { label: 'candidates tried', value: hud.tried },
      ] : [
        { label: 'typos caught', value: hud.caught, color: '#86efac' },
        { label: 'typos missed', value: hud.missed, color: hud.missed ? '#fca5a5' : '#e2e8f0' },
        { label: 'false alarms', value: hud.falseAlarm, color: hud.falseAlarm ? '#fca5a5' : '#86efac' },
        { label: 'normal accepted', value: hud.ok },
      ]} />
      <div className="absolute right-3 top-3 z-10 flex gap-1.5">
        {[['train', Microscope, '1 · Train (thymus)'], ['monitor', Radar, '2 · Monitor ward']].map(([k, I, l]) => (
          <button key={k} onClick={() => { gen.setPlaying(false); if (k === 'monitor' && ais.current.detectors.length < 60) prefill(); switchMode(k); }}
            className={cx('btn btn-sm', mode === k ? 'bg-rose-500 text-white' : 'bg-slate-950/70 text-slate-300 hover:bg-white/10')}><I className="h-3.5 w-3.5" />{l}</button>
        ))}
      </div>
      {toast && <div className={cx('pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-xl border px-3 py-1.5 text-sm font-bold backdrop-blur anim-pop', toast.tone === 'bad' ? 'border-rose-400/50 bg-rose-600/40 text-white' : 'border-emerald-400/40 bg-emerald-600/30 text-white')}>{toast.text}</div>}
      <PhaseCaption capRef={capRef} color="#fb7185" />
      <ControlBar gen={gen} value={mode === 'train' ? hud.det : hud.caught + hud.missed + hud.falseAlarm + hud.ok} label={mode === 'train' ? 'Detectors' : 'Readings'} onReset={() => { reset(); switchMode('train'); }}>
        {mode === 'monitor' && (
          <select defaultValue="" onChange={(e) => { inject(SCENARIOS[Number(e.target.value)]); e.target.value = ''; }} className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-slate-200">
            <option value="" disabled>Send a reading…</option>
            {SCENARIOS.map((s, i) => <option key={s.text} value={i}>{s.text}</option>)}
          </select>
        )}
      </ControlBar>
    </div>
  );
});

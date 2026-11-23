import * as THREE from 'three';

/*
 * Procedural 3D models for the Bio-Lab scenes. Everything is built from three.js
 * primitives, so the lab works offline with no model files to download.
 */

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...extra });

/* ------------------------------------------------------------------ ant -- */
const antGeo = {
  head: new THREE.SphereGeometry(0.075, 12, 10),
  thorax: new THREE.SphereGeometry(0.06, 12, 10),
  abdomen: new THREE.SphereGeometry(0.11, 14, 12),
  leg: new THREE.CylinderGeometry(0.008, 0.008, 0.2, 5),
  antenna: new THREE.CylinderGeometry(0.005, 0.005, 0.14, 4),
};

/** Ant facing +x. Returns { group, legs, body } so the scene can animate legs and tint the body. */
export function makeAnt(color = 0x3b2a1a) {
  const g = new THREE.Group();
  const body = std(color, { roughness: 0.35, metalness: 0.25 });
  const head = new THREE.Mesh(antGeo.head, body); head.position.x = 0.17; g.add(head);
  const thorax = new THREE.Mesh(antGeo.thorax, body); thorax.scale.set(1.5, 0.9, 0.9); thorax.position.x = 0.05; g.add(thorax);
  const abdomen = new THREE.Mesh(antGeo.abdomen, body); abdomen.scale.set(1.5, 1, 1); abdomen.position.x = -0.15; g.add(abdomen);
  const legMat = std(0x1c1410);
  const legs = [];
  [-0.04, 0.05, 0.13].forEach((x) => [-1, 1].forEach((side) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0, 0); g.add(pivot);
    const leg = new THREE.Mesh(antGeo.leg, legMat);
    leg.position.set(0, -0.04, side * 0.09); leg.rotation.x = side * 1.0; pivot.add(leg);
    legs.push({ pivot, phase: (x * 20 + (side > 0 ? Math.PI : 0)) });
  }));
  [-1, 1].forEach((side) => {
    const a = new THREE.Mesh(antGeo.antenna, legMat);
    a.position.set(0.25, 0.06, side * 0.04); a.rotation.set(side * 0.5, 0, -0.9); g.add(a);
  });
  g.position.y = 0.11;
  return { group: g, legs, body };
}

/* ----------------------------------------------------------------- bird -- */
const birdBody = new THREE.ConeGeometry(0.09, 0.42, 8);
birdBody.rotateZ(-Math.PI / 2);
const wingShape = new THREE.Shape();
wingShape.moveTo(0, 0); wingShape.lineTo(-0.12, 0.38); wingShape.lineTo(0.1, 0.05); wingShape.lineTo(0, 0);
const wingGeo = new THREE.ShapeGeometry(wingShape);

/** Low-poly bird facing +x with two flapping wings. */
export function makeBird(color = 0x22d3ee, emissive = 0x0e7490) {
  const g = new THREE.Group();
  const mat = std(color, { emissive, emissiveIntensity: 0.5, flatShading: true });
  g.add(new THREE.Mesh(birdBody, mat));
  const wingMat = std(color, { emissive, emissiveIntensity: 0.35, side: THREE.DoubleSide, flatShading: true });
  const wings = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    const w = new THREE.Mesh(wingGeo, wingMat);
    w.rotation.x = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    pivot.add(w); g.add(pivot);
    return { pivot, side };
  });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 4), mat);
  tail.rotation.z = Math.PI / 2; tail.position.x = -0.26; tail.scale.set(1, 1, 0.3); g.add(tail);
  return { group: g, wings, mat };
}

export function flap(bird, t, speed = 9) {
  bird.wings.forEach(({ pivot, side }) => { pivot.rotation.x = side * Math.sin(t * speed) * 0.7; });
}

/* ---------------------------------------------------------------- helix -- */
const HELIX_TURNS = 1.25;
function strandCurve(phase, height) {
  const pts = [];
  for (let i = 0; i <= 40; i += 1) {
    const u = i / 40; const a = u * Math.PI * 2 * HELIX_TURNS + phase;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.22, u * height, Math.sin(a) * 0.22));
  }
  return new THREE.CatmullRomCurve3(pts);
}
const HELIX_H = 1.6;
const strandA = new THREE.TubeGeometry(strandCurve(0, HELIX_H), 60, 0.035, 6);
const strandB = new THREE.TubeGeometry(strandCurve(Math.PI, HELIX_H), 60, 0.035, 6);
const rungGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.44, 6); rungGeo.rotateZ(Math.PI / 2);
const beadGeo = new THREE.SphereGeometry(0.07, 10, 8);

/** DNA double helix with one rung per gene. Rung brightness and bead size show the gene value. */
export function makeHelix(geneColors) {
  const g = new THREE.Group();
  const back = std(0xcbd5e1, { metalness: 0.4, roughness: 0.3 });
  g.add(new THREE.Mesh(strandA, back), new THREE.Mesh(strandB, back));
  const rungs = geneColors.map((c, i) => {
    const u = (i + 0.5) / geneColors.length;
    const a = u * Math.PI * 2 * HELIX_TURNS;
    const mat = std(c, { emissive: c, emissiveIntensity: 0.4 });
    const rung = new THREE.Mesh(rungGeo, mat);
    rung.position.y = u * HELIX_H; rung.rotation.y = -a;
    const bead = new THREE.Mesh(beadGeo, mat);
    bead.position.y = u * HELIX_H;
    g.add(rung, bead);
    return { rung, bead, mat };
  });
  return { group: g, rungs, height: HELIX_H };
}

/* --------------------------------------------------------------- t-cell -- */
function spikyGeometry() {
  const parts = [new THREE.IcosahedronGeometry(1, 2)];
  const dirs = new THREE.IcosahedronGeometry(1, 0).attributes.position;
  const seen = new Set();
  for (let i = 0; i < dirs.count; i += 1) {
    const d = new THREE.Vector3(dirs.getX(i), dirs.getY(i), dirs.getZ(i)).normalize();
    const key = d.toArray().map((v) => v.toFixed(2)).join();
    if (seen.has(key)) continue; seen.add(key);
    const spike = new THREE.ConeGeometry(0.16, 0.55, 6);
    spike.translate(0, 1.15, 0);
    spike.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d));
    parts.push(spike);
  }
  // simple merge without the examples utils
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
  let total = 0; flat.forEach((p) => { total += p.attributes.position.count; });
  const pos = new Float32Array(total * 3); const nor = new Float32Array(total * 3); let off = 0;
  flat.forEach((n) => {
    n.computeVertexNormals();
    pos.set(n.attributes.position.array, off * 3); nor.set(n.attributes.normal.array, off * 3); off += n.attributes.position.count;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return geo;
}
export const tcellGeometry = spikyGeometry();

/** A spiky immune cell (receptors outward). */
export function makeTCell(color = 0xf0527a) {
  return new THREE.Mesh(tcellGeometry, std(color, { emissive: color, emissiveIntensity: 0.35, roughness: 0.4 }));
}

/* --------------------------------------------------------------- mound -- */
/** Anthill: a lathe-turned dirt mound with a dark entrance. */
export function makeMound(color) {
  const pts = [];
  for (let i = 0; i <= 12; i += 1) { const u = i / 12; pts.push(new THREE.Vector2(0.15 + 0.85 * u, 0.9 * (1 - u * u))); }
  pts.push(new THREE.Vector2(1.0, 0));
  const g = new THREE.Group();
  const mound = new THREE.Mesh(new THREE.LatheGeometry(pts.reverse(), 28), std(0x6b4f2a, { roughness: 0.95 }));
  g.add(mound);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 20), std(color, { emissive: color, emissiveIntensity: 0.8 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.9; g.add(rim);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  hole.rotation.x = -Math.PI / 2; hole.position.y = 0.91; g.add(hole);
  return g;
}

/* --------------------------------------------------------- paper stack -- */
const sheetGeo = new THREE.BoxGeometry(1.0, 0.035, 0.75);
/** A stack of note pages; more pages = more chunks in that section. */
export function makePaperStack(pages) {
  const g = new THREE.Group();
  const white = std(0xe2e8f0, { roughness: 0.9 });
  const lined = std(0xcbd5e1, { roughness: 0.9 });
  for (let i = 0; i < pages; i += 1) {
    const s = new THREE.Mesh(sheetGeo, i % 3 ? white : lined);
    s.position.y = 0.02 + i * 0.045;
    s.rotation.y = Math.sin(i * 2.1) * 0.12;
    g.add(s);
  }
  return { group: g, height: pages * 0.045 };
}

/* --------------------------------------------------------------- tablet -- */
export function makeTablet() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.07), std(0x1e293b, { metalness: 0.6, roughness: 0.3 }));
  g.add(shell);
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0c4a6e'; ctx.fillRect(0, 0, 256, 160);
  ctx.fillStyle = '#7dd3fc'; ctx.font = 'bold 20px sans-serif'; ctx.fillText('Record vitals', 16, 32);
  ctx.fillStyle = '#e0f2fe'; ctx.font = '16px monospace';
  ['HR    180', 'BP    124/78', 'SpO2  97'].forEach((t, i) => ctx.fillText(t, 16, 66 + i * 26));
  ctx.fillStyle = '#22c55e'; ctx.fillRect(160, 120, 80, 26); ctx.fillStyle = '#052e16'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('SAVE', 182, 138);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.86), new THREE.MeshBasicMaterial({ map: tex }));
  screen.position.z = 0.04; g.add(screen);
  return g;
}

/* ------------------------------------------------------------ note card -- */
/** Flat card with text, used to show "a note" turning into numbers. */
export function makeNoteCard(lines) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 200;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, 320, 200);
  ctx.fillStyle = '#0f172a'; ctx.font = 'bold 18px sans-serif'; ctx.fillText(lines[0], 16, 30);
  ctx.fillStyle = '#475569'; ctx.font = '15px sans-serif';
  lines.slice(1).forEach((t, i) => ctx.fillText(t, 16, 62 + i * 24));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
}

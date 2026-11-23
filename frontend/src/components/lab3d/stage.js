import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/**
 * A small three.js stage shared by every Bio-Lab scene: renderer, orbiting
 * camera, soft lighting, floating HTML labels and a resize-aware render loop.
 * Each scene only adds objects and an `update(dt, t)` callback.
 */
export function createStage(container, { camera: camPos = [0, 6, 12], target = [0, 0, 0], fov = 45, background = 0x070b16, autoRotate = false } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  scene.fog = new THREE.Fog(background, 22, 60);

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
  camera.position.set(...camPos);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';

  const labels = new CSS2DRenderer();
  labels.domElement.style.position = 'absolute';
  labels.domElement.style.inset = '0';
  labels.domElement.style.pointerEvents = 'none';
  container.appendChild(labels.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = 0.5;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 4;
  controls.maxDistance = 40;

  scene.add(new THREE.HemisphereLight(0xbfd7ff, 0x0b1020, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(6, 12, 8);
  scene.add(key);

  // Smooth camera fly-to used by the step-by-step demo.
  let fly = null;
  const flyTo = (pos, tgt, ms = 1200) => {
    fly = { from: camera.position.clone(), to: new THREE.Vector3(...pos), tFrom: controls.target.clone(), tTo: new THREE.Vector3(...tgt), start: performance.now(), ms };
  };

  const resize = () => {
    const w = container.clientWidth; const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const updaters = new Set();
  const clock = new THREE.Clock();
  let raf;
  const loop = () => {
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    if (fly) {
      const k = Math.min(1, (performance.now() - fly.start) / fly.ms);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      camera.position.lerpVectors(fly.from, fly.to, e);
      controls.target.lerpVectors(fly.tFrom, fly.tTo, e);
      if (k >= 1) fly = null;
    }
    updaters.forEach((fn) => fn(dt, t));
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const dispose = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    controls.dispose();
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose?.());
    });
    renderer.dispose();
    renderer.domElement.remove();
    labels.domElement.remove();
  };

  return { THREE, scene, camera, renderer, controls, onFrame: (fn) => { updaters.add(fn); return () => updaters.delete(fn); }, flyTo, dispose };
}

/** Floating HTML label attached to a 3D position. */
export function label(text, { className = '', color } = {}) {
  const el = document.createElement('div');
  el.className = `pointer-events-none select-none whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${className}`;
  el.style.color = color || '#e2e8f0';
  el.style.background = 'rgba(7,11,22,0.72)';
  el.style.border = '1px solid rgba(148,163,184,0.18)';
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.userData.el = el;
  return obj;
}

/** Subtle glowing floor grid. */
export function floor(THREE, size = 30, color = 0x1e293b) {
  const g = new THREE.GridHelper(size, size, color, color);
  g.material.transparent = true;
  g.material.opacity = 0.35;
  return g;
}

/** Soft additive glow sprite (no texture files needed). */
let glowTex;
export function glowSprite(THREE, color, scale = 1) {
  if (!glowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const s = new THREE.Sprite(m); s.scale.setScalar(scale);
  return s;
}

/** Update a line's points in place (no new GPU buffers per frame). */
export function setLinePoints(geometry, pts) {
  const attr = geometry.attributes.position;
  const n = Math.min(attr.count, pts.length);
  for (let i = 0; i < attr.count; i += 1) {
    const p = pts[Math.min(i, n - 1)];
    attr.setXYZ(i, p.x, p.y, p.z);
  }
  attr.needsUpdate = true;
  geometry.computeBoundingSphere();
}

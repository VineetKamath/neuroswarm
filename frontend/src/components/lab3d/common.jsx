import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, StepForward, RotateCcw, ChevronLeft, ChevronRight, Sparkles, Move3d } from 'lucide-react';
import { createStage } from './stage';
import { cx } from '../ui';

// Explain: one generation takes several seconds so every phase can be read.
// Normal / Fast: no phase-by-phase narration, just a steady caption.
export const SPEEDS3D = { slow: { label: 'Explain', ms: 8000 }, normal: { label: 'Normal', ms: 900 }, fast: { label: 'Fast', ms: 180 } };

/** Generation clock: calls onStep every `ms`, and remembers when the last step happened so the 3D loop can tween. */
export function useGenerations(onStep, initial = 'slow', overrides = {}) {
  const msOf = (k) => overrides[k] ?? SPEEDS3D[k].ms;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(initial);
  const stepRef = useRef(onStep);
  stepRef.current = onStep;
  const clock = useRef({ at: performance.now(), ms: msOf(initial), explain: initial === 'slow' });
  const step = useCallback(() => {
    clock.current = { at: performance.now(), ms: msOf(speed), explain: speed === 'slow' };
    stepRef.current?.();
  }, [speed]);
  useEffect(() => {
    if (!playing) return undefined;
    clock.current = { ...clock.current, explain: speed === 'slow' };
    // Start right away (or as soon as the current animation finishes) instead of
    // waiting a full interval, so Play responds immediately.
    const left = Math.max(0, clock.current.at + clock.current.ms * 0.95 - performance.now());
    let id;
    const first = setTimeout(() => { step(); id = setInterval(step, msOf(speed)); }, left);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [playing, speed, step]);
  return { playing, setPlaying, toggle: () => setPlaying((p) => !p), speed, setSpeed, step, clock };
}

/** Mounts a three.js stage into a div and runs `build(stage)` once. */
export function useStage(opts, build) {
  const ref = useRef(null);
  const stageRef = useRef(null);
  const buildRef = useRef(build);
  buildRef.current = build;
  useEffect(() => {
    const stage = createStage(ref.current, opts);
    stageRef.current = stage;
    const cleanup = buildRef.current(stage);
    return () => { cleanup?.(); stage.dispose(); stageRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [ref, stageRef];
}

/** 0→1 progress of the current generation animation. */
export const progress = (clock) => Math.min(1, (performance.now() - clock.current.at) / (clock.current.ms * 0.92));
export const smooth = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

export function ControlBar({ gen, value, onReset, label = 'Generation', presets, activePreset, onPreset, children }) {
  return (
    <div className="absolute inset-x-3 bottom-3 z-10 flex items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/70 p-2 backdrop-blur-md">
      <button onClick={gen.toggle} className={cx('btn btn-sm min-w-[82px]', gen.playing ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white text-slate-900 hover:bg-slate-100')}>
        {gen.playing ? <><Pause className="h-3.5 w-3.5" />Pause</> : <><Play className="h-3.5 w-3.5" />Play</>}
      </button>
      <button onClick={() => { gen.setPlaying(false); gen.step(); }} className="btn btn-sm bg-white/5 text-slate-200 hover:bg-white/15"><StepForward className="h-3.5 w-3.5" />Step</button>
      <button onClick={() => { gen.setPlaying(false); onReset(); }} className="btn btn-sm bg-white/5 text-slate-200 hover:bg-white/15"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
      <div className="flex rounded-lg bg-white/5 p-0.5">
        {Object.entries(SPEEDS3D).map(([k, v]) => (
          <button key={k} onClick={() => gen.setSpeed(k)} className={cx('rounded-md px-2 py-1 text-[11px] font-semibold', gen.speed === k ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white')}>{v.label}</button>
        ))}
      </div>
      {presets && (
        <select value={activePreset || ''} onChange={(e) => onPreset(e.target.value)} className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-slate-200">
          <option value="" disabled>Try an experiment…</option>
          {presets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      )}
      {children}
      <div className="ml-auto flex items-center gap-2">
        <span className="rounded-lg bg-white/5 px-2.5 py-1 font-mono text-xs text-slate-300">{label} <b className="text-white">{value}</b></span>
        <span title="Drag to rotate the view, scroll to zoom" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-slate-400"><Move3d className="h-3.5 w-3.5" /></span>
      </div>
    </div>
  );
}

export function Hud({ items, title, color }) {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[60%] space-y-2">
      {title && <div className="inline-block rounded-lg px-2.5 py-1 text-xs font-bold text-slate-950" style={{ background: color }}>{title}</div>}
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <div key={it.label} className="rounded-xl border border-white/10 bg-slate-950/70 px-2.5 py-1.5 backdrop-blur">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{it.label}</div>
            <div className="font-mono text-sm font-bold" style={{ color: it.color || '#f1f5f9' }}>{it.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Toast({ text, tone = 'info' }) {
  if (!text) return null;
  const c = tone === 'bad' ? 'border-rose-400/40 bg-rose-500/20 text-rose-50' : tone === 'good' ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-50' : 'border-white/10 bg-slate-950/75 text-slate-100';
  return <div className={cx('pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-xl border px-3 py-1.5 text-xs font-semibold backdrop-blur anim-pop', c)}>{text}</div>;
}

/** Guided, plain-language walkthrough. Each step can drive the scene. */
export function StoryPanel({ steps, index, setIndex, color, onAction }) {
  const s = steps[index];
  const prevIndex = useRef(-1);
  useEffect(() => {
    // Forward keeps the running simulation (the story builds on it). Going back,
    // or jumping, starts from a clean default scene first, so the step always
    // shows what its text describes.
    const actions = (s?.action || '').split('|').filter(Boolean);
    const forward = index === prevIndex.current + 1;
    if (!forward && !actions.includes('reset')) actions.unshift('reset');
    prevIndex.current = index;
    actions.forEach((a) => onAction?.(a));
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="card flex h-full flex-col p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color }}><Sparkles className="h-3.5 w-3.5" />Guided story</div>
        <div className="font-mono text-[11px] text-slate-400">{index + 1} / {steps.length}</div>
      </div>
      <div className="mb-4 flex gap-1">
        {steps.map((_, i) => (
          <button key={i} onClick={() => setIndex(i)} className="h-1.5 flex-1 rounded-full transition" style={{ background: i <= index ? color : '#e2e8f0' }} aria-label={`Step ${i + 1}`} />
        ))}
      </div>
      <div key={index} className="flex-1 anim-up">
        {s.tag && <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{s.tag}</div>}
        <h3 className="text-lg font-bold leading-snug text-slate-900">{s.title}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{s.text}</p>
        {s.project && (
          <div className="mt-4 rounded-xl border-l-4 bg-slate-50 px-3 py-2.5 text-[13px] leading-relaxed text-slate-700" style={{ borderColor: color }}>
            <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">In NeuroSwarm</div>
            {s.project}
          </div>
        )}
        {s.look && <div className="mt-3 text-[12px] text-slate-500"><b className="text-slate-700">Look at:</b> {s.look}</div>}
      </div>
      <div className="mt-5 flex items-center gap-2">
        <button className="btn btn-outline btn-sm" disabled={index === 0} onClick={() => setIndex(index - 1)}><ChevronLeft className="h-4 w-4" />Back</button>
        <button className="btn btn-sm flex-1 text-white" style={{ background: color }} disabled={index === steps.length - 1} onClick={() => setIndex(index + 1)}>
          {index === steps.length - 1 ? 'End of story' : 'Next'}<ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Live caption that follows the animation. The 3D loop writes straight into the
 * span (no React re-render per frame), so the words change at the same moment
 * the picture does.
 */
export function PhaseCaption({ capRef, color }) {
  return (
    <div className="pointer-events-none absolute bottom-[78px] left-1/2 z-10 max-w-[80%] -translate-x-1/2">
      <div className="rounded-xl border bg-slate-950/80 px-3.5 py-2 text-center text-[13px] font-semibold text-white shadow-lg backdrop-blur" style={{ borderColor: `${color}66` }}>
        <span ref={capRef} />
      </div>
    </div>
  );
}

export function setCaption(ref, text, hold = 1500) {
  // Called every frame. A new caption only replaces the old one after the old one
  // has been on screen for `hold` ms, so text never flickers past unread.
  const el = ref.current;
  if (!el || !text || el.textContent === text) return;
  const now = performance.now();
  if (el.dataset.at && now - Number(el.dataset.at) < hold) return;
  el.textContent = text;
  el.dataset.at = String(now);
  el.parentElement?.animate?.([{ opacity: 0.25 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
}

/** Has the scene been sitting still (paused, or waiting for the next step)? */
export const isIdle = (clock) => performance.now() - clock.current.at > clock.current.ms * 1.08;

/**
 * Holds a state update back until the animation has caught up, so numbers and
 * side cards change when the 3D scene shows the change, not before.
 */
export function useLagged(setter) {
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  return useCallback((value, delay) => {
    clearTimeout(timer.current);
    if (!delay) { setter(value); return; }
    timer.current = setTimeout(() => setter(value), delay);
  }, [setter]);
}

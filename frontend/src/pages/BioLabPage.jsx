import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2, Leaf, ListOrdered, Sigma, Lightbulb,
  MessageSquareText, HeartPulse, ClipboardList, ArrowRight, MapPin, FileCode2, Zap, BarChart3, BookOpen,
} from 'lucide-react';
import { bioApi } from '../api/bio';
import { navigate } from '../lib/router';
import { CHAPTERS, CONTENT } from '../bio/content';
import { PLAIN, STORIES } from '../bio/stories';
import { GA3D } from '../components/lab3d/GA3D';
import { PSO3D } from '../components/lab3d/PSO3D';
import { AIS3D } from '../components/lab3d/AIS3D';
import { BGA3D } from '../components/lab3d/BGA3D';
import { ACO3D } from '../components/lab3d/ACO3D';
import { StoryPanel } from '../components/lab3d/common';
import { RankingLive, TasksLive, VitalsLive, RoutingLive, CompressionLive } from '../components/lab3d/Live';
import { RankingResults, TaskResults, ImmuneResults, CompressionResults, RoutingResults, headline } from '../components/lab/Results';
import { Tabs, cx } from '../components/ui';

const SCENES = { ga: GA3D, pso: PSO3D, ais: AIS3D, bga: BGA3D, aco: ACO3D };
const LIVE = {
  ga: () => <div className="space-y-4"><RankingLive /><TasksLive /></div>,
  pso: () => <RankingLive />,
  ais: () => <VitalsLive />,
  bga: () => <CompressionLive />,
  aco: () => <RoutingLive />,
};
const RESULTS = {
  ga: (r) => <div className="space-y-4"><RankingResults report={r} focus="ga" /><TaskResults report={r} /></div>,
  pso: (r) => <RankingResults report={r} focus="pso" />,
  ais: (r) => <ImmuneResults report={r} />,
  bga: (r) => <CompressionResults report={r} />,
  aco: (r) => <RoutingResults report={r} />,
};

/* ------------------------------------------------------------- details -- */
function Details({ chapter }) {
  const c = CONTENT[chapter.key];
  const Block = ({ icon: Icon, title, children, color }) => (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900"><Icon className="h-4 w-4" style={{ color }} />{title}</div>
      {children}
    </div>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Block icon={Leaf} title="Inspired by nature" color="#16a34a">
        <p className="text-sm leading-relaxed text-slate-700">{c.nature}</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
          {c.mapping.map(([bio, ours], i) => (
            <div key={bio} className={cx('grid grid-cols-[0.8fr_1.2fr] gap-2 px-3 py-2 text-xs', i % 2 && 'bg-slate-50/70')}>
              <span className="font-semibold text-slate-700">{bio}</span><span className="text-slate-600">{ours}</span>
            </div>
          ))}
        </div>
      </Block>
      <Block icon={ListOrdered} title="The algorithm, step by step" color={chapter.color}>
        <ol className="space-y-2">
          {c.steps.map(([t, d], i) => (
            <li key={t} className="flex gap-2.5 text-[13px] leading-relaxed">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ background: chapter.color }}>{i + 1}</span>
              <span><b className="text-slate-800">{t}.</b> <span className="text-slate-600">{d}</span></span>
            </li>
          ))}
        </ol>
      </Block>
      <Block icon={Sigma} title="The update rule" color={chapter.color}>
        <div className="rounded-xl bg-slate-900 px-3 py-3 font-mono text-[12.5px] leading-relaxed text-slate-100">{c.equation}</div>
      </Block>
      <Block icon={Lightbulb} title="Why this algorithm, here" color="#d97706">
        <p className="text-sm leading-relaxed text-slate-700">{c.why}</p>
      </Block>
    </div>
  );
}

/* ------------------------------------------------------------ chapter -- */
function Chapter({ chapter, report }) {
  const Scene = SCENES[chapter.key];
  const plain = PLAIN[chapter.key];
  const story = STORIES[chapter.key];
  const sceneRef = useRef(null);
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState('live');
  const hl = headline(chapter.key, report);

  return (
    <div className="space-y-6">
      {/* plain-words banner */}
      <div className="card overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
          <div className="p-5">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: chapter.color }}>{chapter.family} · in one sentence</div>
            <p className="text-lg font-semibold leading-snug text-slate-900">
              In NeuroSwarm, the <span style={{ color: chapter.color }}>{chapter.name}</span> {plain.job}
            </p>
            {hl && (
              <div className="mt-3 flex flex-wrap gap-2">
                {hl.map(([l, v, d]) => (
                  <div key={l} className="rounded-xl bg-slate-50 px-3 py-1.5 text-xs">
                    <span className="text-slate-500">{l}: </span><b className="text-slate-900">{v}</b>{d && <span className="ml-1 font-semibold text-emerald-600">{d}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 bg-slate-50/60 p-5 lg:border-l lg:border-t-0">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400"><MapPin className="h-3.5 w-3.5" />Where you'll find it</div>
            <div className="space-y-2">
              {plain.where.map((w) => (
                <button key={w.label} onClick={() => navigate(w.route)} className="group flex w-full items-start gap-2 rounded-xl bg-white px-3 py-2 text-left ring-1 ring-slate-200 transition hover:ring-slate-300">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:translate-x-0.5 group-hover:text-slate-700" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800">{w.label}</div>
                    <div className="flex items-center gap-1 truncate font-mono text-[10px] text-slate-400"><FileCode2 className="h-3 w-3" />{w.file}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3D + story */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
        <Scene ref={sceneRef} />
        <StoryPanel steps={story} index={step} setIndex={setStep} color={chapter.color} onAction={(a) => sceneRef.current?.run(a)} />
      </div>

      {/* deeper material */}
      <div>
        <Tabs value={tab} onChange={setTab} className="mb-4" tabs={[
          { value: 'live', label: 'Try it on the real system', icon: Zap },
          { value: 'results', label: 'Real training results', icon: BarChart3 },
          { value: 'details', label: 'How it works', icon: BookOpen },
        ]} />
        <div key={tab} className="anim-in">
          {tab === 'live' && LIVE[chapter.key]()}
          {tab === 'results' && RESULTS[chapter.key](report)}
          {tab === 'details' && <Details chapter={chapter} />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ overview -- */
function Node({ k, label, sub }) {
  const ch = CHAPTERS.find((c) => c.key === k);
  return (
    <button onClick={() => navigate(`biolab/${k}`)} className="min-w-[120px] flex-1 rounded-xl border-2 bg-white px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: ch.color }}>
      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ch.color }}>{ch.short}</div>
      <div className="text-xs font-semibold text-slate-800">{label}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </button>
  );
}
const Plain = ({ label, sub }) => (
  <div className="min-w-[110px] flex-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2">
    <div className="text-xs font-semibold text-slate-700">{label}</div>{sub && <div className="text-[10px] text-slate-500">{sub}</div>}
  </div>
);
const Arrow = () => <ArrowRight className="h-4 w-4 shrink-0 self-center text-slate-300" />;

function Overview({ report }) {
  const c = CONTENT.overview;
  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="relative overflow-hidden bg-[#0b1222] px-6 py-7 text-white">
          <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: 'radial-gradient(500px 200px at 15% 0%, rgba(124,108,242,.35), transparent 60%), radial-gradient(500px 220px at 95% 100%, rgba(31,170,156,.3), transparent 60%)' }} />
          <div className="relative">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">Bio-Inspired Algorithms · NeuroSwarm</div>
            <h2 className="mt-2 max-w-3xl text-2xl font-bold leading-snug">{c.tagline}</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">Each chapter has a 3D simulation with a step-by-step demo, plus a live test on the real system.</p>
          </div>
        </div>
        <div className="space-y-3 p-6">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">A day in the hospital. Click any coloured box.</div>
          <div className="flex items-start gap-2"><MessageSquareText className="mt-2.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="flex flex-1 flex-wrap gap-2">
              <Plain label="Dr. Sharma asks a question" sub='"What diuretic is Kamala on?"' /><Arrow />
              <Node k="aco" label="Pick sections to search" sub="ants learned the route" /><Arrow />
              <Node k="bga" label="Search compressed notes" sub="~140 of 384 numbers" /><Arrow />
              <Node k="ga" label="Put the best note on top" sub="evolved recipe (GA vs PSO)" /><Arrow />
              <Plain label="Quoted, cited answer" />
            </div>
          </div>
          <div className="flex items-start gap-2"><HeartPulse className="mt-2.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="flex flex-1 flex-wrap gap-2">
              <Plain label="Nurse Priya enters vitals" sub="types HR 180 instead of 81" /><Arrow />
              <Node k="ais" label="Immune checkpoint" sub='is this "self"?' /><Arrow />
              <Plain label="Typo flagged before any alarm" />
            </div>
          </div>
          <div className="flex items-start gap-2"><ClipboardList className="mt-2.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="flex flex-1 flex-wrap gap-2">
              <Plain label="258 open nursing tasks" /><Arrow />
              <Node k="ga" label="Triage policy" sub="evolved by GA" /><Arrow />
              <Plain label="Most urgent task first" />
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 text-sm font-bold text-slate-900">Where each algorithm lives in the project</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400">
              <tr><th className="px-5 py-2.5 font-semibold">Algorithm</th><th className="px-5 py-2.5 font-semibold">Its job, in plain words</th><th className="px-5 py-2.5 font-semibold">See it in the app</th><th className="px-5 py-2.5 font-semibold">Result</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {CHAPTERS.slice(1).map((ch) => {
                const hl = headline(ch.key, report);
                return (
                  <tr key={ch.key} className="cursor-pointer hover:bg-slate-50/70" onClick={() => navigate(`biolab/${ch.key}`)}>
                    <td className="px-5 py-3"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ch.color }} /><b className="text-slate-800">{ch.name}</b></div><div className="pl-4 text-[11px] text-slate-400">{ch.family}</div></td>
                    <td className="max-w-sm px-5 py-3 text-xs text-slate-600">It {PLAIN[ch.key].job}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">{PLAIN[ch.key].where.map((w) => <div key={w.label}>{w.label}</div>)}</td>
                    <td className="px-5 py-3 text-xs">{hl ? <><b className="text-slate-800">{hl[0][1]}</b>{hl[0][2] && <span className="ml-1 font-semibold text-emerald-600">{hl[0][2]}</span>}</> : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="card p-5">
          <div className="mb-3 text-sm font-bold text-slate-900">The loop every one of them shares</div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {['Start with many random guesses', 'Score each guess', 'Good guesses influence the rest', 'Add a little randomness', 'Repeat'].map((s, i, a) => (
              <React.Fragment key={s}><span className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-semibold text-slate-700">{s}</span>{i < a.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-300" />}</React.Fragment>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            {[['Evolution', 'GA · Binary GA', 'survival of the fittest', '#7c6cf2'], ['Swarms', 'PSO · ACO', 'simple agents sharing information', '#22b8e0'], ['Immunity', 'AIS', 'learn self, reject non-self', '#f0527a']].map(([t, a, d, col]) => (
              <div key={t} className="rounded-xl border border-slate-100 p-3"><div className="font-bold" style={{ color: col }}>{t}</div><div className="font-semibold text-slate-700">{a}</div><div className="text-[11px] text-slate-500">{d}</div></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- page -- */
export function BioLabPage({ chapter: param }) {
  const idx = Math.max(0, CHAPTERS.findIndex((c) => c.key === param));
  const chapter = CHAPTERS[idx];
  const [report, setReport] = useState(null);
  const [present, setPresent] = useState(false);
  useEffect(() => { bioApi.report().then(setReport).catch(() => setReport(null)); }, []);
  const go = (i) => navigate(`biolab/${CHAPTERS[(i + CHAPTERS.length) % CHAPTERS.length].key}`);

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'PageDown' || (e.key === 'ArrowRight' && e.shiftKey)) { e.preventDefault(); go(idx + 1); }
      if (e.key === 'PageUp' || (e.key === 'ArrowLeft' && e.shiftKey)) { e.preventDefault(); go(idx - 1); }
      if (e.key === 'Escape') setPresent(false);
      if (e.key === 'f' || e.key === 'F') setPresent((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx]); // eslint-disable-line

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); document.getElementById('lab-root')?.scrollTo({ top: 0 }); }, [idx]);

  const body = (
    <div className="anim-up" key={chapter.key}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="mr-2">
          <div className="eyebrow">Bio-Lab · {idx + 1} / {CHAPTERS.length}</div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{chapter.key === 'overview' ? 'Bio-inspired algorithms in NeuroSwarm' : chapter.name}</h1>
        </div>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {CHAPTERS.map((c, i) => (
            <button key={c.key} onClick={() => go(i)} className={cx('rounded-full px-3 py-1.5 text-xs font-semibold transition', i === idx ? 'text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300')}
              style={i === idx ? { background: c.color } : undefined}>{c.short}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button className="btn btn-outline btn-sm" onClick={() => go(idx - 1)} title="Previous chapter (Shift+←)"><ChevronLeft className="h-4 w-4" /></button>
          <button className="btn btn-outline btn-sm" onClick={() => go(idx + 1)} title="Next chapter (Shift+→)"><ChevronRight className="h-4 w-4" /></button>
          <button className="btn btn-dark btn-sm" onClick={() => setPresent((p) => !p)} title="Presentation mode (F)">
            {present ? <><Minimize2 className="h-3.5 w-3.5" />Exit</> : <><Maximize2 className="h-3.5 w-3.5" />Present</>}
          </button>
        </div>
      </div>
      {chapter.key === 'overview' ? <Overview report={report} /> : <Chapter chapter={chapter} report={report} />}
      <div className="mt-8 text-center text-[11px] text-slate-400">Shift + ← / → changes chapter · F for full screen · Esc to exit · drag the 3D scene to look around</div>
    </div>
  );

  if (present) {
    return <div id="lab-root" className="fixed inset-0 z-50 overflow-y-auto bg-[#f4f6fa] px-4 py-6 sm:px-8"><div className="mx-auto max-w-[1700px]">{body}</div></div>;
  }
  return body;
}

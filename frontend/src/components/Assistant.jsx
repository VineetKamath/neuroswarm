import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, ShieldCheck, ChevronDown, Route, Gauge, Quote, AlertCircle, Sparkles } from 'lucide-react';
import api from '../api/axios';
import { Badge, RichText, Spinner, cx } from './ui';

/** Questions tailored to the condition in the chart, plus record-level ones. */
function suggestionsFor(patient) {
  const dx = (patient?.primary_diagnosis || '').toLowerCase();
  const bank = [
    [/heart failure|hfref/, ['What diuretic and dose is the patient on?', 'What was the ejection fraction?']],
    [/pneumonia/, ['What organism grew in the sputum culture?', 'Which antibiotics were started?']],
    [/ketoacidosis|dka/, ['What insulin regimen was started?', 'What was the arterial pH and bicarbonate?']],
    [/stroke/, ['What was the NIHSS score?', 'Was thrombolysis given?']],
    [/kidney|aki/, ['What is the creatinine and baseline?', 'Which medications were held?']],
    [/copd/, ['What were the blood gas results?', 'What is the target oxygen saturation?']],
    [/dengue/, ['What is the latest platelet count?', 'Why should NSAIDs be avoided?']],
    [/tuberculosis/, ['What did the CBNAAT show?', 'Which anti-TB drugs were started?']],
    [/myocardial|stemi/, ['What did the ECG show?', 'Which antiplatelet drugs were prescribed?']],
    [/typhoid|enteric/, ['What grew in the blood culture?', 'Which antibiotic was started?']],
    [/malaria/, ['What was the parasite count?', 'Which antimalarial was started?']],
    [/appendic/, ['What pain medication is the patient on?', 'When is discharge planned?']],
    [/hypertens/, ['What is the blood pressure target?', 'Which antihypertensives were started?']],
  ];
  const specific = bank.find(([re]) => re.test(dx))?.[1] || ['What is the current plan?', 'What did the latest assessment say?'];
  return ['Summarize this patient', ...specific, 'Any drug allergies?', 'What are the latest vitals?', 'What tasks are pending?'];
}

function SourceList({ sources }) {
  const [open, setOpen] = useState(false);
  if (!sources?.length) return null;
  return (
    <div className="mt-3 border-t border-slate-100 pt-2">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800">
        <Quote className="h-3.5 w-3.5" /> {sources.length} cited source{sources.length > 1 ? 's' : ''}
        <ChevronDown className={cx('ml-auto h-3.5 w-3.5 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-2 space-y-2 anim-in">
          {sources.map((s, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 truncate text-[11px] font-semibold text-slate-700">{s.note_title} · {s.section}</div>
                <Badge tone={s.note_type === 'RECORD' ? 'brand' : 'slate'}>{s.note_type}</Badge>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(4, Math.min(100, (s.ranked_score ?? s.similarity_score) * 100))}%` }} />
                </div>
                <span className="font-mono text-[10px] text-slate-500">cos {Number(s.similarity_score).toFixed(2)}</span>
              </div>
              <div className="mt-1 text-[10px] text-slate-400">{s.date_recorded} · {s.author_name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PipelineChips({ m }) {
  if (m.role !== 'assistant' || m.intro) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {m.intent && <Badge tone="violet">intent: {m.intent}</Badge>}
      {m.routing?.partitions?.length > 0 && (
        <Badge tone="amber" title={m.routing.partitions.join(', ')}>
          <Route className="h-3 w-3" />ACO {m.routing.fell_back_to_full_scan ? '→ full-scan fallback' : `${m.routing.partitions.length} partitions`}
        </Badge>
      )}
      {m.ranking_optimized && <Badge tone="sky">GA/PSO re-ranked</Badge>}
      {m.total_time_ms != null && <Badge tone="slate"><Gauge className="h-3 w-3" />{Math.round(m.total_time_ms)} ms</Badge>}
    </div>
  );
}

export function Assistant({ patient, className }) {
  const intro = {
    role: 'assistant', intro: true,
    content: `Ask anything about **${patient.first_name} ${patient.last_name}**. Answers are copied word for word from this patient's own notes and record. Nothing is made up, and other patients' records can't be reached from here.`,
  };
  const [messages, setMessages] = useState([intro]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { setMessages([intro]); }, [patient.id]); // eslint-disable-line
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, busy]);

  const ask = async (text) => {
    const question = (text ?? q).trim();
    if (!question || busy) return;
    setQ('');
    setMessages((m) => [...m, { role: 'user', content: question }]);
    setBusy(true);
    try {
      const { data } = await api.post('/rag/query', { patient_id: patient.id, question });
      setMessages((m) => [...m, { role: 'assistant', content: data.answer, ...data }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'The retrieval service did not respond. Is the backend running?', has_sufficient_context: false }]);
    } finally { setBusy(false); }
  };

  return (
    <section className={cx('card flex flex-col overflow-hidden', className)}>
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-brand-600 text-white"><Bot className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-slate-900">Clinical retrieval assistant</div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-700"><ShieldCheck className="h-3 w-3" />Only {patient.mrn}'s record · nothing generated</div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/50 p-4">
        {messages.map((m, i) => (
          <div key={i} className={cx('flex anim-up', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cx('max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
              m.role === 'user' ? 'rounded-br-md bg-slate-900 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm')}>
              {m.role === 'assistant' && m.has_sufficient_context === false && (
                <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
                  <AlertCircle className="h-3.5 w-3.5" />Below the similarity gate, refusing rather than guessing
                </div>
              )}
              {m.role === 'user' ? m.content : <RichText text={m.content} />}
              <PipelineChips m={m} />
              {m.role === 'assistant' && <SourceList sources={m.sources} />}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Spinner className="text-violet-500" /> Routing with ACO → FAISS search → GA/PSO re-ranking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-100 p-3">
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {suggestionsFor(patient).map((s) => (
            <button key={s} onClick={() => ask(s)} disabled={busy}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700">
              {s === 'Summarize this patient' && <Sparkles className="mr-1 inline h-3 w-3 text-violet-500" />}{s}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex gap-2">
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Ask about ${patient.first_name}…`} disabled={busy} />
          <button className="btn btn-primary px-3" disabled={busy || !q.trim()}><Send className="h-4 w-4" /></button>
        </form>
      </div>
    </section>
  );
}

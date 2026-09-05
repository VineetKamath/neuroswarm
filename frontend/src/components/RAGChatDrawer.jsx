import React, { useState } from 'react';
import { Bot, Send, Sparkles, BookOpen, AlertCircle, ShieldCheck, ChevronRight } from 'lucide-react';
import api from '../api/axios';

export const RAGChatDrawer = ({ patient, isOpen, onClose }) => {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I am MediMind AI, your clinical assistant for **${patient?.first_name || ''} ${patient?.last_name || ''}** (MRN: ${patient?.mrn || ''}).\n\nAsk me any clinical questions regarding their documented history, vitals, microbiology, medications, or surgical notes. All answers are strictly grounded in this patient's records.`,
      sources: [],
      has_sufficient_context: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [activeSources, setActiveSources] = useState([]);

  if (!isOpen || !patient) return null;

  const suggestedQuestions = [
    "What was the latest ejection fraction and echo findings?",
    "What antibiotics were prescribed and what were the culture results?",
    "Are there any documented drug allergies or contraindications?",
    "Summarize the post-op recovery milestones and current diet orders.",
  ];

  const handleSend = async (queryText) => {
    const q = queryText || question;
    if (!q || !q.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    setQuestion('');
    setLoading(true);

    try {
      const res = await api.post('/rag/query', {
        patient_id: patient.id,
        question: q,
      });

      const assistantMessage = {
        role: 'assistant',
        content: res.data.answer,
        sources: res.data.sources || [],
        has_sufficient_context: res.data.has_sufficient_context,
        retrieval_time_ms: res.data.retrieval_time_ms,
        generation_time_ms: res.data.generation_time_ms,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMessage]);
      if (res.data.sources && res.data.sources.length > 0) {
        setActiveSources(res.data.sources);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'An error occurred while querying the clinical assistant. Please check your connection and try again.',
          sources: [],
          has_sufficient_context: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-xs">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900">Clinical RAG Assistant</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <ShieldCheck className="w-3 h-3" /> Scoped to {patient.mrn}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Patient: <span className="font-semibold text-slate-700">{patient.first_name} {patient.last_name}</span> � Ward: {patient.ward || 'General'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          Close Drawer
        </button>
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400">
                <span>{msg.role === 'user' ? 'You (Clinician)' : 'MediMind AI'}</span>
                <span>�</span>
                <span>{msg.timestamp}</span>
                {msg.retrieval_time_ms && (
                  <span className="text-sky-600 font-mono">({msg.retrieval_time_ms}ms retrieval)</span>
                )}
              </div>

              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-sky-600 text-white shadow-xs rounded-tr-xs'
                    : 'bg-white text-slate-800 border border-slate-200 shadow-xs rounded-tl-xs'
                }`}
              >
                {msg.role === 'assistant' && msg.has_sufficient_context === false && (
                  <div className="mb-2 p-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center gap-2 font-medium">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    Similarity score fell below threshold or information is unrecorded. Refusing to infer unverified data.
                  </div>
                )}

                <div className="whitespace-pre-wrap">{msg.content}</div>

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-sky-800 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                      {msg.sources.length} Documented Sources Cited
                    </span>
                    <button
                      onClick={() => setActiveSources(msg.sources)}
                      className="text-xs text-sky-700 hover:text-sky-900 font-semibold flex items-center gap-0.5"
                    >
                      View Excerpts <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 p-4 bg-white border border-slate-200 rounded-2xl w-fit shadow-xs animate-pulse">
              <Bot className="w-4 h-4 text-sky-600 animate-spin" />
              <span className="text-xs font-medium text-slate-600">
                Searching FAISS index for {patient.first_name}'s clinical notes & synthesizing grounded answer...
              </span>
            </div>
          )}
        </div>

        {activeSources.length > 0 && (
          <div className="border-t border-slate-200 bg-white p-4 max-h-48 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-sky-600" /> Grounding Sources (Clinical Transparency)
              </h4>
              <button
                onClick={() => setActiveSources([])}
                className="text-[11px] text-slate-400 hover:text-slate-600"
              >
                Dismiss
              </button>
            </div>
            <div className="space-y-2">
              {activeSources.map((src, i) => (
                <div key={i} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-800 mb-1">
                    <span>{src.note_title} ({src.note_type})</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-mono">
                      Score: {src.similarity_score}
                    </span>
                  </div>
                  <div className="text-slate-500 text-[11px] mb-1">
                    Recorded {src.date_recorded} by {src.author_name}
                  </div>
                  <p className="text-slate-700 bg-white p-2 rounded border border-slate-100 font-mono text-[11px] whitespace-pre-wrap">
                    {src.chunk_text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-3 bg-slate-100/70 border-t border-slate-200">
          <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-sky-500" /> Suggested Clinical Queries:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestedQuestions.map((sq, i) => (
              <button
                key={i}
                onClick={() => handleSend(sq)}
                className="text-[11px] px-2.5 py-1 bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-800 border border-slate-200 rounded-full transition shadow-2xs text-left"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask anything about ${patient.first_name}'s clinical records...`}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-white outline-none transition"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2 shadow-xs"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Query</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

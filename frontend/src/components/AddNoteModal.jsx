import React, { useState } from 'react';
import { X, FileText, Sparkles } from 'lucide-react';
import api from '../api/axios';

export const AddNoteModal = ({ isOpen, onClose, patientId, patientName, onNoteCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    note_type: 'SOAP',
    chief_complaint: '',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    content: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAutoFillSOAP = () => {
    const fullNarrative = `[${formData.note_type}: ${formData.title}]\n` +
      `Chief Complaint: ${formData.chief_complaint}\n` +
      `Subjective: ${formData.subjective}\n` +
      `Objective: ${formData.objective}\n` +
      `Assessment: ${formData.assessment}\n` +
      `Plan: ${formData.plan}`;
    setFormData(prev => ({ ...prev, content: fullNarrative }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const narrative = formData.content || 
        `Chief Complaint: ${formData.chief_complaint}\nSubjective: ${formData.subjective}\nObjective: ${formData.objective}\nAssessment: ${formData.assessment}\nPlan: ${formData.plan}`;

      const payload = {
        patient_id: Number(patientId),
        title: formData.title,
        note_type: formData.note_type,
        chief_complaint: formData.chief_complaint || null,
        subjective: formData.subjective || null,
        objective: formData.objective || null,
        assessment: formData.assessment || null,
        plan: formData.plan || null,
        content: narrative,
      };

      await api.post('/notes', payload);
      onNoteCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save clinical note');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-100 text-sky-700 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Create Clinical Note</h3>
              <p className="text-xs text-slate-500">Patient: {patientName} • Auto-indexed and chunked by SOAP section</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Note Title *</label>
              <input
                type="text"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. Daily Cardiology Progress Note"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Note Type</label>
              <select
                name="note_type"
                value={formData.note_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none bg-white"
              >
                <option value="SOAP">SOAP Note</option>
                <option value="PROGRESS">Progress Note</option>
                <option value="ADMISSION">Admission H&P</option>
                <option value="CONSULT">Consultation Note</option>
                <option value="DISCHARGE">Discharge Summary</option>
                <option value="PROCEDURE">Procedure Note</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Chief Complaint</label>
            <input
              type="text"
              name="chief_complaint"
              value={formData.chief_complaint}
              onChange={handleChange}
              placeholder="e.g. Orthopnea and bilateral pedal edema"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-sky-800 mb-1">Subjective (S)</label>
              <textarea
                rows={3}
                name="subjective"
                value={formData.subjective}
                onChange={handleChange}
                placeholder="Patient reports symptom changes, pain level, oral intake..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-sky-800 mb-1">Objective (O)</label>
              <textarea
                rows={3}
                name="objective"
                value={formData.objective}
                onChange={handleChange}
                placeholder="Physical exam findings, lab results, imaging observations..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-sky-800 mb-1">Assessment (A)</label>
              <textarea
                rows={3}
                name="assessment"
                value={formData.assessment}
                onChange={handleChange}
                placeholder="Clinical impression, differential diagnoses, response to therapy..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-sky-800 mb-1">Plan & Orders (P)</label>
              <textarea
                rows={3}
                name="plan"
                value={formData.plan}
                onChange={handleChange}
                placeholder="Medication changes, diagnostic workup, nursing orders, discharge goals..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">Narrative / Full Text</label>
              <button
                type="button"
                onClick={handleAutoFillSOAP}
                className="text-xs text-sky-600 hover:text-sky-800 font-medium flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" /> Auto-format from SOAP
              </button>
            </div>
            <textarea
              rows={3}
              name="content"
              value={formData.content}
              onChange={handleChange}
              placeholder="Combined clinical narrative — indexed and retrievable verbatim..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? 'Indexing Note...' : 'Save & Index Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

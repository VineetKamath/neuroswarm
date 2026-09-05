import React, { useState } from 'react';
import { X, Heart, Wind, Thermometer, Droplet, Activity } from 'lucide-react';
import api from '../api/axios';

export const VitalsModal = ({ isOpen, onClose, patientId, patientName, onVitalsRecorded }) => {
  const [formData, setFormData] = useState({
    heart_rate: '',
    bp_systolic: '',
    bp_diastolic: '',
    resp_rate: '',
    temp_celsius: '',
    o2_saturation: '',
    blood_glucose: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        patient_id: Number(patientId),
        heart_rate: formData.heart_rate ? parseInt(formData.heart_rate) : null,
        bp_systolic: formData.bp_systolic ? parseInt(formData.bp_systolic) : null,
        bp_diastolic: formData.bp_diastolic ? parseInt(formData.bp_diastolic) : null,
        resp_rate: formData.resp_rate ? parseInt(formData.resp_rate) : null,
        temp_celsius: formData.temp_celsius ? parseFloat(formData.temp_celsius) : null,
        o2_saturation: formData.o2_saturation ? parseFloat(formData.o2_saturation) : null,
        blood_glucose: formData.blood_glucose ? parseFloat(formData.blood_glucose) : null,
        notes: formData.notes || null,
      };

      await api.post('/vitals', payload);
      onVitalsRecorded();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to record vitals');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900">Record Vital Signs</h3>
            <p className="text-xs text-slate-500">Patient: {patientName}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Heart Rate */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-500" /> Heart Rate (bpm)
              </label>
              <input
                type="number"
                name="heart_rate"
                value={formData.heart_rate}
                onChange={handleChange}
                placeholder="e.g. 72"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>

            {/* O2 Saturation */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-sky-500" /> SpO2 (%)
              </label>
              <input
                type="number"
                step="0.1"
                name="o2_saturation"
                value={formData.o2_saturation}
                onChange={handleChange}
                placeholder="e.g. 98.5"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>

            {/* Blood Pressure Systolic */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-500" /> BP Systolic (mmHg)
              </label>
              <input
                type="number"
                name="bp_systolic"
                value={formData.bp_systolic}
                onChange={handleChange}
                placeholder="e.g. 120"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>

            {/* Blood Pressure Diastolic */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-500" /> BP Diastolic (mmHg)
              </label>
              <input
                type="number"
                name="bp_diastolic"
                value={formData.bp_diastolic}
                onChange={handleChange}
                placeholder="e.g. 80"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>

            {/* Temp */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-amber-500" /> Temp (°C)
              </label>
              <input
                type="number"
                step="0.1"
                name="temp_celsius"
                value={formData.temp_celsius}
                onChange={handleChange}
                placeholder="e.g. 36.8"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>

            {/* Resp Rate */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Resp Rate (breaths/min)</label>
              <input
                type="number"
                name="resp_rate"
                value={formData.resp_rate}
                onChange={handleChange}
                placeholder="e.g. 16"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              />
            </div>
          </div>

          {/* Blood Glucose */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Droplet className="w-3.5 h-3.5 text-teal-500" /> Blood Glucose (mg/dL)
            </label>
            <input
              type="number"
              step="0.1"
              name="blood_glucose"
              value={formData.blood_glucose}
              onChange={handleChange}
              placeholder="e.g. 110"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical Vitals Notes</label>
            <input
              type="text"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="e.g. 2L O2 via NC; patient resting comfortably"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
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
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Save Vitals'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

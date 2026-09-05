import React, { useState, useEffect } from 'react';
import { Users, Bot, Activity, ChevronRight } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { AddPatientModal } from '../components/AddPatientModal';
import { RAGChatDrawer } from '../components/RAGChatDrawer';
import api from '../api/axios';

export const DoctorDashboard = ({ onNavigateToPatient }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRAGPatient, setSelectedRAGPatient] = useState(null);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    try {
      const res = await api.get('/patients');
      setPatients(res.data);
    } catch (err) {
      console.error('Failed to load patients:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
              Physician Clinical Portal
            </span>
            <span className="text-xs text-slate-400 font-medium">Inpatient Roster & AI Assistant</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">Attending Physician Overview</h1>
          <p className="text-xs text-slate-500">Review vital trends, document clinical notes, and launch grounded RAG queries.</p>
        </div>

        <button
          onClick={() => setIsPatientModalOpen(true)}
          className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
        >
          <Users className="w-4 h-4" /> Admit New Patient
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Assigned Inpatients" value={patients.length} subtitle="Active Clinical Cases" icon={Users} color="blue" />
        <StatCard title="Clinical Retrieval" value="Verbatim" subtitle="No LLM · GA/PSO ranked" icon={Bot} color="teal" />
        <StatCard title="Care Reviews Needed" value={patients.filter(p => p.pending_tasks_count > 0).length} subtitle="Patients with active orders" icon={Activity} color="amber" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">Active Inpatient Roster</h2>
          <p className="text-xs text-slate-500">Click any patient to open full medical record or launch RAG assistant</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Patient / MRN</th>
                <th className="px-6 py-3">Ward & Room</th>
                <th className="px-6 py-3">Primary Diagnosis</th>
                <th className="px-6 py-3">Latest Vitals</th>
                <th className="px-6 py-3 text-right">Clinical Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 text-sm">{p.first_name} {p.last_name}</div>
                    <div className="text-slate-500 font-mono text-[11px]">{p.mrn} � {p.gender}, {p.blood_group}</div>
                    {p.allergies && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-medium truncate max-w-xs">
                        ?? {p.allergies}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-slate-800">{p.ward || 'General'}</span>
                    <div className="text-slate-500 text-[11px]">Room: {p.room_number || 'TBD'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-800 max-w-xs leading-relaxed">
                      {p.primary_diagnosis || 'Under Evaluation'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {p.latest_vitals ? (
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-900">
                          BP: {p.latest_vitals.bp_systolic}/{p.latest_vitals.bp_diastolic} mmHg � HR: {p.latest_vitals.heart_rate} bpm
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          SpO2: {p.latest_vitals.o2_saturation}% � Temp: {p.latest_vitals.temp_celsius}�C
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">No vitals logged</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => setSelectedRAGPatient(p)}
                      className="px-3 py-1.5 bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 rounded-lg font-semibold transition inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      <Bot className="w-3.5 h-3.5" /> Ask AI
                    </button>
                    <button
                      onClick={() => onNavigateToPatient(p.id)}
                      className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-semibold transition inline-flex items-center gap-1 shadow-2xs"
                    >
                      View Chart <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddPatientModal
        isOpen={isPatientModalOpen}
        onClose={() => setIsPatientModalOpen(false)}
        onPatientCreated={loadPatients}
      />

      <RAGChatDrawer
        patient={selectedRAGPatient}
        isOpen={!!selectedRAGPatient}
        onClose={() => setSelectedRAGPatient(null)}
      />
    </div>
  );
};

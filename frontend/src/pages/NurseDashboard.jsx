import React, { useState, useEffect } from 'react';
import { CheckSquare, HeartPulse, Clock, CheckCircle2, Bot } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { VitalsModal } from '../components/VitalsModal';
import { RAGChatDrawer } from '../components/RAGChatDrawer';
import api from '../api/axios';

export const NurseDashboard = ({ onNavigateToPatient }) => {
  const [tasks, setTasks] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVitalsPatient, setSelectedVitalsPatient] = useState(null);
  const [selectedRAGPatient, setSelectedRAGPatient] = useState(null);

  useEffect(() => {
    loadNurseData();
  }, []);

  const loadNurseData = async () => {
    setLoading(true);
    try {
      const [tasksRes, patientsRes] = await Promise.all([
        api.get('/tasks'),
        api.get('/patients'),
      ]);
      setTasks(tasksRes.data);
      setPatients(patientsRes.data);
    } catch (err) {
      console.error('Failed to load nursing dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkComplete = async (taskId) => {
    try {
      await api.patch(`/tasks/${taskId}/status`, {
        status: 'COMPLETED',
        completion_notes: 'Completed per shift protocol by nursing staff.',
      });
      loadNurseData();
    } catch (err) {
      alert('Failed to update task');
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
              Nursing Station Portal
            </span>
            <span className="text-xs text-slate-400 font-medium">Care Tasks & Vitals Logging</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">Nurse Care Coordination Station</h1>
          <p className="text-xs text-slate-500">Manage daily patient checkups, administer medications, and record vitals.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Shift Tasks Due" value={pendingTasks.length} subtitle="Awaiting completion" icon={Clock} color="amber" />
        <StatCard title="Tasks Completed Today" value={completedTasks.length} subtitle="Signed off by nursing" icon={CheckCircle2} color="teal" />
        <StatCard title="Monitored Inpatients" value={patients.length} subtitle="Bedside oversight" icon={HeartPulse} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Active Checkup & Medication Orders</h2>
              <p className="text-xs text-slate-500">Prioritized by urgency and physician orders</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              {pendingTasks.length} Pending
            </span>
          </div>

          <div className="divide-y divide-slate-200 max-h-[500px] overflow-y-auto">
            {pendingTasks.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                All care tasks completed for current shift!
              </div>
            ) : (
              pendingTasks.map((t) => (
                <div key={t.id} className="p-4 hover:bg-slate-50/70 transition flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.priority === 'STAT' ? 'bg-rose-100 text-rose-800' :
                        t.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {t.priority}
                      </span>
                      <h4 className="font-bold text-slate-900 text-xs">{t.title}</h4>
                    </div>
                    <p className="text-xs text-slate-600">{t.description || 'Routine nursing checkup order'}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                      <span>Patient: <strong className="text-slate-700">{t.patient_name}</strong> (Room {t.patient_room || 'General'})</span>
                      <span>�</span>
                      <span>Assigned to: {t.assigned_nurse_name || 'Floor Pool'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleMarkComplete(t.id)}
                    className="shrink-0 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-2xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-900">Bedside Vitals Roster</h2>
            <p className="text-xs text-slate-500">Rapid vitals recording per room</p>
          </div>

          <div className="divide-y divide-slate-200 flex-1 overflow-y-auto max-h-[500px]">
            {patients.map((p) => (
              <div key={p.id} className="p-4 hover:bg-slate-50/70 transition space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-xs">{p.first_name} {p.last_name}</div>
                    <div className="text-[11px] text-slate-500">Room: {p.room_number || 'TBD'} � {p.ward}</div>
                  </div>
                  <button
                    onClick={() => setSelectedRAGPatient(p)}
                    title="Ask AI about this patient"
                    className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg border border-sky-200 transition"
                  >
                    <Bot className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-slate-500">
                    {p.latest_vitals ? `BP: ${p.latest_vitals.bp_systolic}/${p.latest_vitals.bp_diastolic} | SpO2: ${p.latest_vitals.o2_saturation}%` : 'No recent vitals'}
                  </div>
                  <button
                    onClick={() => setSelectedVitalsPatient(p)}
                    className="px-2.5 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-lg text-xs font-semibold transition"
                  >
                    + Record Vitals
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <VitalsModal
        isOpen={!!selectedVitalsPatient}
        patientId={selectedVitalsPatient?.id}
        patientName={selectedVitalsPatient ? `${selectedVitalsPatient.first_name} ${selectedVitalsPatient.last_name}` : ''}
        onClose={() => setSelectedVitalsPatient(null)}
        onVitalsRecorded={loadNurseData}
      />

      <RAGChatDrawer
        patient={selectedRAGPatient}
        isOpen={!!selectedRAGPatient}
        onClose={() => setSelectedRAGPatient(null)}
      />
    </div>
  );
};

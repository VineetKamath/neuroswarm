import React, { useState, useEffect } from 'react';
import { ArrowLeft, Bot, Activity, FileText, CheckSquare, Plus, AlertCircle, Clock } from 'lucide-react';
import { VitalsModal } from '../components/VitalsModal';
import { AddNoteModal } from '../components/AddNoteModal';
import { AddTaskModal } from '../components/AddTaskModal';
import { RAGChatDrawer } from '../components/RAGChatDrawer';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export const PatientDetailPage = ({ patientId, onBack }) => {
  const { role } = useAuth();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notes');
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isRAGOpen, setIsRAGOpen] = useState(false);

  const fetchPatientDetail = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/patients/${patientId}`);
      setPatient(res.data);
    } catch (err) {
      console.error('Failed to load patient record:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientDetail();
  }, [patientId]);

  if (loading || !patient) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        Loading centralized patient record & vector index metadata...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition flex items-center gap-1.5 shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Patient Roster
        </button>

        <button
          onClick={() => setIsRAGOpen(true)}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs"
        >
          <Bot className="w-4 h-4" /> Launch Grounded AI Assistant
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{patient.first_name} {patient.last_name}</h1>
              <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                {patient.mrn}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
                {patient.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 mt-2">
              <span>DOB: <strong className="text-slate-700">{patient.date_of_birth}</strong></span>
              <span>�</span>
              <span>Gender: <strong className="text-slate-700">{patient.gender}</strong></span>
              <span>�</span>
              <span>Blood Group: <strong className="text-slate-700">{patient.blood_group || 'N/A'}</strong></span>
              <span>�</span>
              <span>Ward: <strong className="text-slate-700">{patient.ward || 'General'}</strong></span>
              <span>�</span>
              <span>Room: <strong className="text-slate-700">{patient.room_number || 'TBD'}</strong></span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="font-bold text-slate-800 block mb-0.5">Primary Diagnosis:</span>
            <span className="text-slate-700 leading-relaxed">{patient.primary_diagnosis || 'Under Evaluation'}</span>
          </div>

          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
            <span className="font-bold text-rose-900 block mb-0.5 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Documented Drug Allergies:
            </span>
            <span className="text-rose-800 font-medium leading-relaxed">{patient.allergies || 'No documented allergies'}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-2 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'notes' ? 'bg-white text-sky-700 shadow-2xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" /> Clinical & SOAP Notes ({patient.clinical_notes.length})
            </button>
            <button
              onClick={() => setActiveTab('vitals')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'vitals' ? 'bg-white text-sky-700 shadow-2xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity className="w-4 h-4" /> Vitals History ({patient.vital_signs.length})
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'tasks' ? 'bg-white text-sky-700 shadow-2xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="w-4 h-4" /> Care Tasks ({patient.care_tasks.length})
            </button>
          </div>

          <div>
            {activeTab === 'notes' && (
              <button
                onClick={() => setIsNoteModalOpen(true)}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Clinical Note
              </button>
            )}
            {activeTab === 'vitals' && (
              <button
                onClick={() => setIsVitalsModalOpen(true)}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" /> Log Vitals
              </button>
            )}
            {activeTab === 'tasks' && (
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" /> Assign Care Task
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'notes' && (
            <div className="space-y-4">
              {patient.clinical_notes.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No clinical notes recorded yet.</div>
              ) : (
                patient.clinical_notes.map((note) => (
                  <div key={note.id} className="p-5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-bold text-[10px]">
                          {note.note_type}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm">{note.title}</h3>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(note.created_at).toLocaleString()}</span>
                        <span>�</span>
                        <span className="font-medium text-slate-700">{note.author_name} ({note.author_role})</span>
                      </div>
                    </div>

                    {note.chief_complaint && (
                      <div className="text-xs">
                        <span className="font-semibold text-slate-700">Chief Complaint: </span>
                        <span className="text-slate-600">{note.chief_complaint}</span>
                      </div>
                    )}

                    {(note.subjective || note.objective || note.assessment || note.plan) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                        {note.subjective && (
                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <strong className="text-sky-800 block mb-1">Subjective:</strong>
                            <p className="text-slate-600 whitespace-pre-wrap">{note.subjective}</p>
                          </div>
                        )}
                        {note.objective && (
                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <strong className="text-sky-800 block mb-1">Objective:</strong>
                            <p className="text-slate-600 whitespace-pre-wrap">{note.objective}</p>
                          </div>
                        )}
                        {note.assessment && (
                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <strong className="text-sky-800 block mb-1">Assessment:</strong>
                            <p className="text-slate-600 whitespace-pre-wrap">{note.assessment}</p>
                          </div>
                        )}
                        {note.plan && (
                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <strong className="text-sky-800 block mb-1">Plan:</strong>
                            <p className="text-slate-600 whitespace-pre-wrap">{note.plan}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-100 whitespace-pre-wrap font-mono text-[11px]">
                      {note.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'vitals' && (
            <div className="space-y-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Heart Rate</th>
                    <th className="px-4 py-3">Blood Pressure</th>
                    <th className="px-4 py-3">SpO2</th>
                    <th className="px-4 py-3">Temperature</th>
                    <th className="px-4 py-3">Glucose</th>
                    <th className="px-4 py-3">Recorded By</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {patient.vital_signs.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-mono text-slate-600">{new Date(v.recorded_at).toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{v.heart_rate ? `${v.heart_rate} bpm` : '-'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic} mmHg` : '-'}</td>
                      <td className="px-4 py-3 font-semibold text-sky-700">{v.o2_saturation ? `${v.o2_saturation}%` : '-'}</td>
                      <td className="px-4 py-3 font-semibold text-amber-700">{v.temp_celsius ? `${v.temp_celsius}�C` : '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{v.blood_glucose ? `${v.blood_glucose} mg/dL` : '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{v.recorded_by_name || 'Staff'}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{v.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-3">
              {patient.care_tasks.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No active care tasks assigned for this patient.</div>
              ) : (
                patient.care_tasks.map((t) => (
                  <div key={t.id} className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl flex items-start justify-between gap-4">
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
                      <p className="text-xs text-slate-600">{t.description}</p>
                      <div className="text-[11px] text-slate-400">
                        Assigned to: {t.assigned_nurse_name || 'Floor Pool'} � Status: <strong className="text-slate-700">{t.status}</strong>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <VitalsModal
        isOpen={isVitalsModalOpen}
        patientId={patient.id}
        patientName={`${patient.first_name} ${patient.last_name}`}
        onClose={() => setIsVitalsModalOpen(false)}
        onVitalsRecorded={fetchPatientDetail}
      />

      <AddNoteModal
        isOpen={isNoteModalOpen}
        patientId={patient.id}
        patientName={`${patient.first_name} ${patient.last_name}`}
        onClose={() => setIsNoteModalOpen(false)}
        onNoteCreated={fetchPatientDetail}
      />

      <AddTaskModal
        isOpen={isTaskModalOpen}
        patientId={patient.id}
        patientName={`${patient.first_name} ${patient.last_name}`}
        onClose={() => setIsTaskModalOpen(false)}
        onTaskCreated={fetchPatientDetail}
      />

      <RAGChatDrawer
        patient={patient}
        isOpen={isRAGOpen}
        onClose={() => setIsRAGOpen(false)}
      />
    </div>
  );
};

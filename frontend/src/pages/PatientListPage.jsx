import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Bot, ChevronRight, Filter } from 'lucide-react';
import { AddPatientModal } from '../components/AddPatientModal';
import { RAGChatDrawer } from '../components/RAGChatDrawer';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export const PatientListPage = ({ onSelectPatient }) => {
  const { role } = useAuth();
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [selectedRAGPatient, setSelectedRAGPatient] = useState(null);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/patients', { params });
      setPatients(res.data);
    } catch (err) {
      console.error('Failed to search patients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Centralized Patient Records</h1>
          <p className="text-xs text-slate-500">Role-secured electronic health records with grounded clinical AI assistant.</p>
        </div>

        {(role === 'ADMIN' || role === 'DOCTOR') && (
          <button
            onClick={() => setIsAddPatientOpen(true)}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <UserPlus className="w-4 h-4" /> Admit New Patient
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, MRN, primary diagnosis, or medical condition..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-700 w-full sm:w-auto"
          >
            <option value="">All Inpatient Statuses</option>
            <option value="ADMITTED">Admitted</option>
            <option value="CRITICAL">Critical Care</option>
            <option value="STABLE">Stable</option>
            <option value="DISCHARGED">Discharged</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5">Patient Record</th>
                <th className="px-6 py-3.5">Location & Ward</th>
                <th className="px-6 py-3.5">Primary Diagnosis</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Latest Vitals</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                    No patient records found matching search query.
                  </td>
                </tr>
              ) : (
                patients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 text-sm">{p.first_name} {p.last_name}</div>
                      <div className="text-slate-500 font-mono text-[11px]">{p.mrn} • {p.gender}, {p.blood_group}</div>
                      {p.allergies && (
                        <div className="mt-1 text-[10px] text-rose-700 font-medium truncate max-w-xs">
                          ⚠️ Allergies: {p.allergies}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{p.ward || 'General'}</div>
                      <div className="text-slate-500 text-[11px]">Room: {p.room_number || 'TBD'}</div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="font-medium text-slate-800 line-clamp-2">
                        {p.primary_diagnosis || 'Not specified'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={"px-2.5 py-1 rounded-full text-[11px] font-bold " + (
                        p.status === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                        p.status === 'STABLE' ? 'bg-emerald-100 text-emerald-800' :
                        p.status === 'DISCHARGED' ? 'bg-slate-100 text-slate-600' : 'bg-sky-100 text-sky-800'
                      )}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {p.latest_vitals ? (
                        <div>
                          <div className="font-semibold text-slate-900">
                            {p.latest_vitals.bp_systolic}/{p.latest_vitals.bp_diastolic} mmHg • {p.latest_vitals.heart_rate} bpm
                          </div>
                          <div className="text-slate-500 text-[11px]">
                            SpO2: {p.latest_vitals.o2_saturation}%
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No vitals</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedRAGPatient(p)}
                        className="px-3 py-1.5 bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 rounded-lg font-semibold transition inline-flex items-center gap-1 shadow-2xs"
                      >
                        <Bot className="w-3.5 h-3.5" /> Ask AI
                      </button>
                      <button
                        onClick={() => onSelectPatient(p.id)}
                        className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-semibold transition inline-flex items-center gap-1 shadow-2xs"
                      >
                        View Record <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddPatientModal
        isOpen={isAddPatientOpen}
        onClose={() => setIsAddPatientOpen(false)}
        onPatientCreated={fetchPatients}
      />

      <RAGChatDrawer
        patient={selectedRAGPatient}
        isOpen={!!selectedRAGPatient}
        onClose={() => setSelectedRAGPatient(null)}
      />
    </div>
  );
};

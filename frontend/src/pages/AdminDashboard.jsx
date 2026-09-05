import React, { useState, useEffect } from 'react';
import { Users, Shield, FileText, CheckSquare, Activity, Cpu, UserPlus, RefreshCw } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { AddStaffModal } from '../components/AddStaffModal';
import { AddPatientModal } from '../components/AddPatientModal';
import api from '../api/axios';

export const AdminDashboard = ({ onNavigateToPatient }) => {
  const [stats, setStats] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, staffRes] = await Promise.all([
        api.get('/staff/system-stats'),
        api.get('/staff'),
      ]);
      setStats(statsRes.data);
      setStaffList(staffRes.data);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleToggleStaffStatus = async (user) => {
    try {
      await api.put(`/staff/${user.id}`, { is_active: !user.is_active });
      setActionMessage(`Updated status for ${user.full_name}`);
      setTimeout(() => setActionMessage(''), 3000);
      loadDashboardData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update user');
    }
  };

  if (loading && !stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin text-sky-600" />
          <span>Loading hospital telemetry & administration dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
              Admin Portal
            </span>
            <span className="text-xs text-slate-400 font-medium">Hospital Control & AI Vector Oversight</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">Hospital Administration Dashboard</h1>
          <p className="text-xs text-slate-500">Centralized EHR control, staff access provisioning, and FAISS RAG health.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPatientModalOpen(true)}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <UserPlus className="w-4 h-4" /> Admit Patient
          </button>
          <button
            onClick={() => setIsStaffModalOpen(true)}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <Shield className="w-4 h-4" /> Provision Staff
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium">
          {actionMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Inpatients" value={stats?.total_patients || 0} subtitle="Centralized EHR Records" icon={Users} color="blue" />
        <StatCard title="Active Staff" value={stats?.active_staff || 0} subtitle="Physicians, Nurses & Admins" icon={Shield} color="purple" />
        <StatCard title="Clinical Notes" value={stats?.total_clinical_notes || 0} subtitle="Indexed in Vector Store" icon={FileText} color="teal" />
        <StatCard title="Pending Care Tasks" value={stats?.pending_care_tasks || 0} subtitle="Assigned to Nursing Units" icon={CheckSquare} color="amber" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-100 text-sky-700 rounded-lg"><Cpu className="w-5 h-5" /></div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Vector Search Engine & RAG Telemetry</h2>
              <p className="text-xs text-slate-500">Sentence-BERT + FAISS per-patient isolated indices</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Activity className="w-3.5 h-3.5 text-emerald-600" /> Engine Online
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 block">Embedding Model:</span>
            <span className="font-mono font-bold text-slate-800">{stats?.vector_engine?.embedding_model || 'all-MiniLM-L6-v2'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Embedding Vector Dimension:</span>
            <span className="font-mono font-bold text-slate-800">{stats?.vector_engine?.embedding_dim || 384} dims (L2 Normalized)</span>
          </div>
          <div>
            <span className="text-slate-500 block">Indexed Patient Stores:</span>
            <span className="font-bold text-slate-800">{stats?.vector_engine?.total_indexed_patients || 0} Isolated Indices</span>
          </div>
          <div>
            <span className="text-slate-500 block">Total Note Chunks:</span>
            <span className="font-bold text-slate-800">{stats?.vector_engine?.total_indexed_chunks || 0} Chunks Indexed</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">Hospital Staff Directory & RBAC Roles</h2>
          <p className="text-xs text-slate-500">Manage role permissions and active login access</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Staff Member</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Department</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {staffList.map((st) => (
                <tr key={st.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-6 py-3.5">
                    <div className="font-semibold text-slate-900">{st.full_name}</div>
                    <div className="text-slate-500 text-[11px]">{st.email}</div>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                      st.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                      st.role === 'DOCTOR' ? 'bg-sky-100 text-sky-800' : 'bg-teal-100 text-teal-800'
                    }`}>
                      {st.role}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-slate-600">{st.department || 'General'}</td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      st.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {st.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <button
                      onClick={() => handleToggleStaffStatus(st)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition ${
                        st.is_active
                          ? 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100'
                          : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {st.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AddStaffModal isOpen={isStaffModalOpen} onClose={() => setIsStaffModalOpen(false)} onStaffCreated={() => { loadDashboardData(); setActionMessage('Staff member registered.'); }} />
      <AddPatientModal isOpen={isPatientModalOpen} onClose={() => setIsPatientModalOpen(false)} onPatientCreated={() => { loadDashboardData(); setActionMessage('Patient admitted.'); }} />
    </div>
  );
};

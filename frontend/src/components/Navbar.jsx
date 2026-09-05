import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, LogOut, Shield, Stethoscope, HeartPulse } from 'lucide-react';

export const Navbar = ({ onSelectRoleDemo }) => {
  const { user, role, logout } = useAuth();

  const getRoleBadge = () => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <Shield className="w-3.5 h-3.5 text-purple-600" /> Admin
          </span>
        );
      case 'DOCTOR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200">
            <Stethoscope className="w-3.5 h-3.5 text-sky-600" /> Physician
          </span>
        );
      case 'NURSE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">
            <HeartPulse className="w-3.5 h-3.5 text-teal-600" /> Nursing Staff
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-sm">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">MediMind</h1>
              <span className="text-[11px] font-medium uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                Clinical AI Platform
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">St. Jude Medical Center � EHR & Grounded RAG</p>
          </div>
        </div>

        {onSelectRoleDemo && (
          <div className="hidden md:flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-500 font-medium px-2">Quick Demo Switch:</span>
            <button
              onClick={() => onSelectRoleDemo('admin@medimind.org', 'password123')}
              className={`px-2.5 py-1 rounded font-medium transition ${role === 'ADMIN' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Admin
            </button>
            <button
              onClick={() => onSelectRoleDemo('dr.chen@medimind.org', 'password123')}
              className={`px-2.5 py-1 rounded font-medium transition ${role === 'DOCTOR' ? 'bg-white text-sky-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Dr. Chen
            </button>
            <button
              onClick={() => onSelectRoleDemo('nurse.sarah@medimind.org', 'password123')}
              className={`px-2.5 py-1 rounded font-medium transition ${role === 'NURSE' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Nurse Sarah
            </button>
          </div>
        )}

        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-slate-900">{user.full_name}</div>
                <div className="text-xs text-slate-500">{user.department || 'Clinical Unit'}</div>
              </div>
              {getRoleBadge()}
              <button
                onClick={logout}
                title="Sign Out"
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

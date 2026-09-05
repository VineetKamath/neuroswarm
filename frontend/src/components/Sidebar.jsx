import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, CheckSquare, Settings, HeartHandshake, FlaskConical, Dna } from 'lucide-react';

export const Sidebar = ({ activeTab, setActiveTab }) => {
  const { role } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'DOCTOR', 'NURSE'] },
    { id: 'patients', label: 'Patient Records', icon: Users, roles: ['ADMIN', 'DOCTOR', 'NURSE'] },
    { id: 'tasks', label: 'Care Tasks', icon: CheckSquare, roles: ['ADMIN', 'DOCTOR', 'NURSE'] },
    { id: 'biolab', label: 'Bio-Lab', icon: FlaskConical, roles: ['ADMIN', 'DOCTOR', 'NURSE'] },
    { id: 'staff', label: 'Staff Directory', icon: HeartHandshake, roles: ['ADMIN'] },
    { id: 'system', label: 'System & Vectors', icon: Settings, roles: ['ADMIN'] },
  ];

  const filteredItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between shrink-0">
      <div className="space-y-1">
        <div className="px-3 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
          Navigation
        </div>
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition " + (isActive ? "bg-sky-50 text-sky-700 font-semibold" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50")}
            >
              <Icon className={"w-4 h-4 " + (isActive ? "text-sky-600" : "text-slate-400")} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900">
        <div className="mb-1 flex items-center gap-2 font-semibold text-indigo-800">
          <Dna className="h-4 w-4 text-indigo-600" />
          Bio-Inspired Engine
        </div>
        <p className="leading-relaxed text-indigo-700">
          Retrieval, triage and data-quality decisions tuned by GA, PSO, an Artificial Immune
          System and Ant Colony Optimization.
        </p>
        <p className="mt-1.5 font-semibold text-indigo-800">No LLM in the pipeline.</p>
      </div>
    </aside>
  );
};

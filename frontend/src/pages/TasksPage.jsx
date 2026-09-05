import React, { useState, useEffect } from 'react';
import { CheckCircle2, Dna, Clock, AlertTriangle } from 'lucide-react';
import api from '../api/axios';

export const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const gaActive = tasks.some((t) => t.prioritized_by_ga);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tasks', { params: statusFilter ? { status: statusFilter } : {} });
      setTasks(res.data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [statusFilter]);

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await api.patch('/tasks/' + taskId + '/status', { status: newStatus });
      fetchTasks();
    } catch (err) {
      alert('Failed to update task status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Care Coordination &amp; Tasks</h1>
          <p className="text-xs text-slate-500">
            Bedside checkups, medication passes and shift assignments.
            {gaActive
              ? ' Ordered by a Genetic-Algorithm triage policy trained on expert judgements.'
              : ' Ordered by the fixed priority sort (GA policy not trained).'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {gaActive && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
              <Dna className="h-3.5 w-3.5" /> GA-prioritized
            </span>
          )}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 outline-none bg-white text-slate-700"
          >
            <option value="">All Task Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="divide-y divide-slate-200">
          {tasks.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">No care tasks found matching criteria.</div>
          ) : (
            tasks.map((t, idx) => (
              <div key={t.id} className="p-5 hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && (
                      <span
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-indigo-600 text-[11px] font-bold text-white"
                        title={gaActive ? `Triage rank ${idx + 1} — urgency ${t.urgency_score}` : `Position ${idx + 1}`}
                      >
                        {idx + 1}
                      </span>
                    )}
                    <span className={"px-2 py-0.5 rounded text-[10px] font-bold " + (
                      t.priority === 'STAT' ? 'bg-rose-100 text-rose-800' :
                      t.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                    )}>
                      {t.priority}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">{t.title}</h3>
                    {t.overdue_hours > 0 && t.status !== 'COMPLETED' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        <AlertTriangle className="h-3 w-3" /> {t.overdue_hours.toFixed(0)}h overdue
                      </span>
                    )}
                    {t.task_category && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {t.task_category}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">{t.description || 'Routine care order'}</p>
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-[11px] text-slate-400 pt-1">
                    <span>Patient: <strong className="text-slate-800">{t.patient_name}</strong> (Room {t.patient_room || 'TBD'})</span>
                    <span>•</span>
                    <span>Assigned Nurse: <strong className="text-slate-700">{t.assigned_nurse_name || 'Floor Pool'}</strong></span>
                    <span>•</span>
                    <span>Ordered by: {t.created_by_name || 'Staff'}</span>
                    {gaActive && t.urgency_score != null && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 font-mono text-indigo-500" title="Score from the GA-evolved triage policy">
                          <Clock className="h-3 w-3" /> urgency {t.urgency_score.toFixed(3)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {t.status !== 'COMPLETED' ? (
                    <>
                      <button
                        onClick={() => handleUpdateStatus(t.id, 'IN_PROGRESS')}
                        className={"px-3 py-1.5 rounded-lg text-xs font-semibold border transition " + (
                          t.status === 'IN_PROGRESS'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        )}
                      >
                        In Progress
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(t.id, 'COMPLETED')}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-2xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Complete
                      </button>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

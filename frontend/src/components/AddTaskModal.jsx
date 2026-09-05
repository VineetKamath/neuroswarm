import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Clock, AlertTriangle } from 'lucide-react';
import api from '../api/axios';

export const AddTaskModal = ({ isOpen, onClose, patientId, patientName, onTaskCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    assigned_nurse_id: '',
    due_in_hours: '4',
  });
  const [nurses, setNurses] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      api.get('/staff')
        .then((res) => {
          const nurseList = res.data.filter((u) => u.role === 'NURSE' && u.is_active);
          setNurses(nurseList);
          if (nurseList.length > 0) {
            setFormData(prev => ({ ...prev, assigned_nurse_id: nurseList[0].id.toString() }));
          }
        })
        .catch(() => {
          // If not admin, nurse list can be left optional or filled
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const dueTime = new Date();
      dueTime.setHours(dueTime.getHours() + parseInt(formData.due_in_hours || '4'));

      const payload = {
        patient_id: Number(patientId),
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        assigned_nurse_id: formData.assigned_nurse_id ? parseInt(formData.assigned_nurse_id) : null,
        due_time: dueTime.toISOString(),
      };

      await api.post('/tasks', payload);
      onTaskCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-100 text-teal-700 rounded-lg">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Assign Care / Checkup Task</h3>
              <p className="text-xs text-slate-500">Patient: {patientName}</p>
            </div>
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Task Title *</label>
            <input
              type="text"
              name="title"
              required
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Check morning BP and administer IV Lasix"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Instructions & Clinical Orders</label>
            <textarea
              rows={3}
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Specific thresholds, medication doses, or precautions..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none bg-white"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="STAT">STAT (Immediate)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Due Within</label>
              <select
                name="due_in_hours"
                value={formData.due_in_hours}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none bg-white"
              >
                <option value="1">1 Hour (Urgent)</option>
                <option value="2">2 Hours</option>
                <option value="4">4 Hours (Routine)</option>
                <option value="8">8 Hours (End of Shift)</option>
                <option value="12">12 Hours</option>
                <option value="24">24 Hours</option>
              </select>
            </div>
          </div>

          {nurses.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assign to Nurse</label>
              <select
                name="assigned_nurse_id"
                value={formData.assigned_nurse_id}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none bg-white"
              >
                <option value="">Unassigned / Floor Pool</option>
                {nurses.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.full_name} ({n.department || 'Nurse'})
                  </option>
                ))}
              </select>
            </div>
          )}

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
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              {submitting ? 'Assigning...' : 'Assign Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

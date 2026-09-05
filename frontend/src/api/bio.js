import api from './axios';

export const bioApi = {
  status:       () => api.get('/bio/status').then((r) => r.data),
  report:       () => api.get('/bio/report').then((r) => r.data),
  algorithms:   () => api.get('/bio/algorithms').then((r) => r.data),
  ranking:      () => api.get('/bio/ranking').then((r) => r.data),
  taskPolicy:   () => api.get('/bio/tasks').then((r) => r.data),
  immune:       () => api.get('/bio/immune').then((r) => r.data),
  compression:  () => api.get('/bio/compression').then((r) => r.data),
  routing:      () => api.get('/bio/routing').then((r) => r.data),

  taskRanking:  (limit = 12) => api.get(`/bio/task-ranking?limit=${limit}`).then((r) => r.data),
  anomalies:    (limit = 40) => api.get(`/bio/anomalies?limit=${limit}`).then((r) => r.data),

  compareRanking: (patientId, question) =>
    api.post('/bio/compare-ranking', { patient_id: patientId, question }).then((r) => r.data),
  checkVitals: (values) => api.post('/bio/check-vitals', values).then((r) => r.data),
  retrain: (generations = 30) =>
    api.post(`/bio/retrain?generations=${generations}`).then((r) => r.data),
};

export const ALGO_ACCENT = {
  ranking: 'var(--ns-ga)',
  tasks: 'var(--ns-ga)',
  immune: 'var(--ns-ais)',
  compression: 'var(--ns-bin)',
  routing: 'var(--ns-aco)',
};

export const ALGO_HEX = {
  ranking: '#6366f1',
  tasks: '#818cf8',
  immune: '#f43f5e',
  compression: '#10b981',
  routing: '#f59e0b',
  baseline: '#94a3b8',
  pso: '#06b6d4',
};

/** Format a signed percentage for display, e.g. +54.04% */
export const pct = (v) => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const n = Number(v);
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
};

export const num = (v, digits = 3) => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return Number(v).toFixed(digits);
};

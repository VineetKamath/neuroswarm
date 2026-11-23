import api from './axios';

const get = (url) => api.get(url).then((r) => r.data);

export const bioApi = {
  status: () => get('/bio/status'),
  report: () => get('/bio/report'),
  ranking: () => get('/bio/ranking'),
  taskPolicy: () => get('/bio/tasks'),
  immune: () => get('/bio/immune'),
  compression: () => get('/bio/compression'),
  routing: () => get('/bio/routing'),
  taskRanking: (limit = 10) => get(`/bio/task-ranking?limit=${limit}`),
  anomalies: (limit = 40) => get(`/bio/anomalies?limit=${limit}`),
  compareRanking: (patientId, question) =>
    api.post('/bio/compare-ranking', { patient_id: patientId, question }).then((r) => r.data),
  checkVitals: (values) => api.post('/bio/check-vitals', values).then((r) => r.data),
};

export const pct = (v, digits = 1) => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '-';
  const n = Number(v);
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`;
};

export const num = (v, digits = 3) => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '-';
  return Number(v).toFixed(digits);
};

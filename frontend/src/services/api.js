import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api`
  : '/api';

const API = axios.create({ baseURL: BASE_URL });

API.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg =
      err.response?.data?.detail ||
      err.response?.data?.error ||
      err.message ||
      'Request failed';
    return Promise.reject(new Error(msg));
  }
);

/* ─── Health & Info ───────────────────────────────── */
export const healthCheck = () => API.get('/health');
export const getModelsInfo = () => API.get('/models');
export const getFeatureColumns = () => API.get('/feature-columns');

/* ─── Predictions ─────────────────────────────────── */
export const predictDNN = (features) =>
  API.post('/predict/dnn', { features });

export const predictLSTM = (sequences) =>
  API.post('/predict/lstm', { sequences });

export const predictGRU = (sequences) =>
  API.post('/predict/gru', { sequences });

export const predictCompare = (sequences) =>
  API.post('/predict/compare', { sequences });

export const predictCSV = (file, model) => {
  const fd = new FormData();
  fd.append('file', file);
  return API.post(`/predict/csv?model=${model}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

/* ─── Dashboard & Stats ──────────────────────────── */
// Dashboard stats are now derived entirely from frontend session state

/* ─── Model Comparison ───────────────────────────── */
export const getModelComparison = () => API.get('/model-comparison');

/* ─── Attack Logs ─────────────────────────────────── */
export const getAttackLogs = (limit = 200) =>
  API.get(`/attack-logs?limit=${limit}`);
export const clearAttackLogs = () => API.delete('/attack-logs');
export const exportAttackLogs = () => API.get('/attack-logs/export');

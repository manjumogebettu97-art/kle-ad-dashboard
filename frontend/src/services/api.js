import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────
export const login    = (email, password)  => api.post('/auth/login', { email, password });
export const logout   = ()                 => api.post('/auth/logout');
export const register = (data)             => api.post('/auth/register', data);
export const getMe    = ()                 => api.get('/auth/me');

// ── Dashboard ─────────────────────────────────────────────────────────────
export const getPeriods    = ()        => api.get('/dashboard/periods');
export const getSummary    = (params)  => api.get('/dashboard/summary',   { params });
export const getDailyPerformance = (params) => api.get('/dashboard/daily', { params });
export const getCampaigns  = (params)  => api.get('/dashboard/campaigns', { params });
export const getLocations  = (params)  => api.get('/dashboard/locations',  { params });
export const getAds        = (params)  => api.get('/dashboard/ads',        { params });
export const getPlacements = (params)  => api.get('/dashboard/placements', { params });
export const getHighlights = (params)  => api.get('/dashboard/highlights', { params });
export const getCompanies  = (params)  => api.get('/dashboard/companies',  { params });

// ── Settings ──────────────────────────────────────────────────────────────
export const getSettings    = ()       => api.get('/settings');
export const updateSettings = (data)   => api.put('/settings', data);
export const getUsers       = ()       => api.get('/settings/users');
export const deleteUser     = (id)     => api.delete(`/settings/users/${id}`);

export default api;

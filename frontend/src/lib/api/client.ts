import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token && config.url !== '/admin/auth/login') config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const token = localStorage.getItem('admin_token');
      if (token && err.config?.headers?.Authorization === `Bearer ${token}`) {
        localStorage.removeItem('admin_token');
        window.dispatchEvent(new Event('admin:unauthorized'));
      }
    }
    return Promise.reject(err);
  }
);

export default api;

import axios from 'axios';

const vendorApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

vendorApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('vendor_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

vendorApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('vendor_token');
      window.location.href = '/vendor/login';
    }
    return Promise.reject(err);
  },
);

export default vendorApi;

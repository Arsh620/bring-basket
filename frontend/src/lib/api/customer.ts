import axios from 'axios';

const customerApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

customerApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('customer_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

customerApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('customer_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default customerApi;

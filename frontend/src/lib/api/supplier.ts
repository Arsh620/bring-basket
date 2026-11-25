import axios from 'axios';

const supplierApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

supplierApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('supplier_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default supplierApi;

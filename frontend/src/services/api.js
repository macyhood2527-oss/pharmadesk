import axios from 'axios';

const getBaseUrl = () => {
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (envBaseUrl) return envBaseUrl;

  if (import.meta.env.DEV) {
    return '/api';
  }

  const { hostname, protocol } = window.location;

  return `${protocol}//${hostname}:3001/api`;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || '';
    const isLoginRequest = requestUrl.includes('/auth/login');

    if (error.response?.status === 401 && !isLoginRequest && window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

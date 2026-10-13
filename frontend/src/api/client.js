import axios from 'axios';

export default axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

export const errMsg = (e) => e.response?.data?.message || 'Something went wrong';

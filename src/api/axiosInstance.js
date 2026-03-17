import axios from 'axios';

const axiosInstance = axios.create({
  // baseURL: 'http://localhost:5000/api',
  baseURL: 'https://nerl.ai-horizon.io/api',
  timeout: 150000,
  withCredentials: true,
});

export default axiosInstance;

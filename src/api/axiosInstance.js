import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 150000,
  withCredentials: true,
});

export default axiosInstance;

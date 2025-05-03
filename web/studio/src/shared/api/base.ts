import axios from 'axios';
import { API_BASE_URL } from '../lib/env';

/**
 * Central Axios instance. Add interceptors (auth, retries) here.
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

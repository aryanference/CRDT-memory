// ui/src/api/client.ts
// Axios instance for the PCCM API.

import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.response.use(
  (resp) => resp,
  (error) => {
    console.warn('[PCCM API]', error.message)
    return Promise.reject(error)
  }
)

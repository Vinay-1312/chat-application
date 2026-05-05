import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:10000/api'
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
    config.headers['x-user-id'] = user.id  // Envoy ring hash key
  }
  return config
})

export default api

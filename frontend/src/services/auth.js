import api from './api'

export const authService = {
  async register(email, username, password) {
    const { data } = await api.post('/api/auth/register', { email, username, password })
    localStorage.setItem('token', data.access_token)
    return data
  },

  async login(email, password) {
    const { data } = await api.post('/api/auth/login', { email, password })
    localStorage.setItem('token', data.access_token)
    return data
  },

  logout() {
    localStorage.removeItem('token')
    window.location.href = '/login'
  },

  isAuthenticated() {
    return !!localStorage.getItem('token')
  },
}

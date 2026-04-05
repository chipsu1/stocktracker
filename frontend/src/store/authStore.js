import { create } from 'zustand'
import { authService } from '../services/auth'

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: authService.isAuthenticated(),

  login: async (email, password) => {
    const data = await authService.login(email, password)
    set({ user: data.user, isAuthenticated: true })
    return data
  },

  register: async (email, username, password) => {
    const data = await authService.register(email, username, password)
    set({ user: data.user, isAuthenticated: true })
    return data
  },

  logout: () => {
    authService.logout()
    set({ user: null, isAuthenticated: false })
  },

  setUser: (user) => set({ user }),
}))

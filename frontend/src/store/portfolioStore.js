import { create } from 'zustand'
import { portfolioService } from '../services/portfolio'

export const usePortfolioStore = create((set, get) => ({
  portfolios: [],
  activePortfolioId: null,
  summary: null,
  loading: false,
  error: null,

  fetchPortfolios: async () => {
    set({ loading: true, error: null })
    try {
      const portfolios = await portfolioService.getAll()
      set({ portfolios, loading: false })
      const currentId = get().activePortfolioId
      const stillExists = portfolios.find((p) => p.id === currentId)
      // Jeśli aktywne portfolio nie istnieje lub nie było ustawione — ustaw pierwsze
      if (!stillExists && portfolios.length > 0) {
        set({ activePortfolioId: portfolios[0].id })
        await get().fetchSummary(portfolios[0].id)
      } else if (stillExists) {
        await get().fetchSummary(currentId)
      }
    } catch (e) {
      set({ error: e.message, loading: false })
    }
  },

  fetchSummary: async (portfolioId) => {
    set({ loading: true, error: null })
    try {
      const summary = await portfolioService.getSummary(portfolioId)
      set({ summary, activePortfolioId: portfolioId, loading: false })
    } catch (e) {
      set({ error: e.message, loading: false })
    }
  },

  createPortfolio: async (payload) => {
    const portfolio = await portfolioService.create(payload)
    set((s) => ({ portfolios: [...s.portfolios, portfolio] }))
    return portfolio
  },

  deletePortfolio: async (id) => {
    await portfolioService.remove(id)
    const { portfolios, activePortfolioId } = get()
    const remaining = portfolios.filter((p) => p.id !== id)
    const newActiveId = activePortfolioId === id
      ? (remaining.length > 0 ? remaining[0].id : null)
      : activePortfolioId
    set({ portfolios: remaining, activePortfolioId: newActiveId, summary: newActiveId ? get().summary : null })
    if (newActiveId) await get().fetchSummary(newActiveId)
  },

  addTransaction: async (portfolioId, payload) => {
    await portfolioService.addTransaction(portfolioId, payload)
    await get().fetchSummary(portfolioId)
  },

  setActivePortfolio: (id) => {
    set({ activePortfolioId: id })
    get().fetchSummary(id)
  },
}))

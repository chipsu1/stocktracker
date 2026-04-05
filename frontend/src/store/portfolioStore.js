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
      // Ustaw aktywne portfolio jeśli nie ma
      if (!get().activePortfolioId && portfolios.length > 0) {
        set({ activePortfolioId: portfolios[0].id })
        await get().fetchSummary(portfolios[0].id)
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
    set((s) => ({
      portfolios: s.portfolios.filter((p) => p.id !== id),
      activePortfolioId: s.activePortfolioId === id ? null : s.activePortfolioId,
      summary: s.activePortfolioId === id ? null : s.summary,
    }))
  },

  addPosition: async (portfolioId, payload) => {
    await portfolioService.createPosition(portfolioId, payload)
    await get().fetchSummary(portfolioId)
  },

  deletePosition: async (positionId) => {
    await portfolioService.deletePosition(positionId)
    const id = get().activePortfolioId
    if (id) await get().fetchSummary(id)
  },

  setActivePortfolio: (id) => {
    set({ activePortfolioId: id })
    get().fetchSummary(id)
  },
}))

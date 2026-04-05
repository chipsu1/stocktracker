import api from './api'

export const portfolioService = {
  // Portfolios
  async getAll() {
    const { data } = await api.get('/api/portfolios/')
    return data
  },
  async create(payload) {
    const { data } = await api.post('/api/portfolios/', payload)
    return data
  },
  async update(id, payload) {
    const { data } = await api.put(`/api/portfolios/${id}`, payload)
    return data
  },
  async remove(id) {
    await api.delete(`/api/portfolios/${id}`)
  },
  async getSummary(id) {
    const { data } = await api.get(`/api/portfolios/${id}/summary`)
    return data
  },

  // Positions
  async createPosition(portfolioId, payload) {
    const { data } = await api.post(`/api/portfolios/${portfolioId}/positions`, payload)
    return data
  },
  async updatePosition(positionId, payload) {
    const { data } = await api.put(`/api/portfolios/positions/${positionId}`, payload)
    return data
  },
  async deletePosition(positionId) {
    await api.delete(`/api/portfolios/positions/${positionId}`)
  },

  // Transactions
  async addTransaction(positionId, payload) {
    const { data } = await api.post(`/api/portfolios/positions/${positionId}/transactions`, payload)
    return data
  },

  // Prices
  async getQuote(ticker, currency = 'PLN') {
    const { data } = await api.get('/api/prices/quote', { params: { ticker, currency } })
    return data
  },
}

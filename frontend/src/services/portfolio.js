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

  // Transactions
  async getTransactions(portfolioId) {
    const { data } = await api.get(`/api/portfolios/${portfolioId}/transactions`)
    return data
  },
  async addTransaction(portfolioId, payload) {
    const { data } = await api.post(`/api/portfolios/${portfolioId}/transactions`, payload)
    return data
  },
  async deleteTransaction(transactionId) {
    await api.delete(`/api/portfolios/transactions/${transactionId}`)
  },

  // Prices
  async getQuote(ticker, currency = 'PLN') {
    const { data } = await api.get('/api/prices/quote', { params: { ticker, currency } })
    return data
  },
}

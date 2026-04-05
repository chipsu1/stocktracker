import { useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'

const CURRENCIES = ['PLN', 'USD', 'EUR', 'GBP', 'CHF']

export default function CreatePortfolioModal({ onClose }) {
  const { createPortfolio, setActivePortfolio } = usePortfolioStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    description: '',
    currency: 'PLN',
  })

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setError('')
    setLoading(true)
    try {
      const portfolio = await createPortfolio({
        name: form.name.trim(),
        description: form.description.trim() || null,
        currency: form.currency,
      })
      setActivePortfolio(portfolio.id)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Błąd tworzenia portfela')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Nowy portfel</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nazwa portfela *</label>
            <input
              className="input"
              placeholder="np. IKE GPW, XTB USD, Obligacje"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="label">Opis (opcjonalnie)</label>
            <input
              className="input"
              placeholder="np. Akcje polskie na koncie IKE"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <div>
            <label className="label">Waluta bazowa</label>
            <select
              className="input"
              value={form.currency}
              onChange={(e) => set('currency', e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-loss text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Anuluj
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Tworzenie...' : 'Utwórz portfel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

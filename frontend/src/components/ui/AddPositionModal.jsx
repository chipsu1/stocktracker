import { useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'

const ASSET_CLASSES = [
  'Akcje polskie',
  'Akcje zagraniczne',
  'Obligacje skarbowe polskie',
  'Obligacje skarbowe zagraniczne',
  'Obligacje korporacyjne polskie',
  'ETF',
  'Gotówka',
  'Waluty',
  'Inne',
]

const CURRENCIES = ['PLN', 'USD', 'EUR', 'GBP', 'CHF']

export default function AddPositionModal({ onClose }) {
  const { activePortfolioId, addPosition } = usePortfolioStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    ticker: '',
    name: '',
    asset_class: 'Akcje zagraniczne',
    currency: 'PLN',
    quantity: '',
    avg_purchase_price: '',
    exchange_rate_at_purchase: '1',
    purchase_date: new Date().toISOString().split('T')[0],
  })

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await addPosition(activePortfolioId, {
        ...form,
        quantity: parseFloat(form.quantity),
        avg_purchase_price: parseFloat(form.avg_purchase_price),
        exchange_rate_at_purchase: parseFloat(form.exchange_rate_at_purchase) || 1,
        purchase_date: form.purchase_date ? new Date(form.purchase_date).toISOString() : null,
      })
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Błąd dodawania pozycji')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Dodaj pozycję</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ticker *</label>
              <input className="input" placeholder="np. NVDA, XTB, ETR:SAP" value={form.ticker}
                onChange={(e) => set('ticker', e.target.value.toUpperCase())} required />
            </div>
            <div>
              <label className="label">Nazwa</label>
              <input className="input" placeholder="Nvidia" value={form.name}
                onChange={(e) => set('name', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Klasa aktywów</label>
            <select className="input" value={form.asset_class} onChange={(e) => set('asset_class', e.target.value)}>
              {ASSET_CLASSES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Waluta</label>
              <select className="input" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Liczba</label>
              <input className="input" type="number" step="any" min="0" placeholder="10" value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)} required />
            </div>
            <div>
              <label className="label">Śr. cena zakupu</label>
              <input className="input" type="number" step="any" min="0" placeholder="150.00" value={form.avg_purchase_price}
                onChange={(e) => set('avg_purchase_price', e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="label">Data zakupu</label>
            <input className="input" type="date" value={form.purchase_date}
              onChange={(e) => set('purchase_date', e.target.value)} />
          </div>

          {form.currency !== 'PLN' && (
            <div>
              <label className="label">Kurs walutowy przy zakupie (1 {form.currency} = ? PLN)</label>
              <input className="input" type="number" step="any" min="0" placeholder="4.28" value={form.exchange_rate_at_purchase}
                onChange={(e) => set('exchange_rate_at_purchase', e.target.value)} />
            </div>
          )}

          {error && <p className="text-loss text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Anuluj</button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Dodawanie...' : 'Dodaj pozycję'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

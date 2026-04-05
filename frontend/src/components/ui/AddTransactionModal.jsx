import { useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import clsx from 'clsx'

const TRANSACTION_TYPES = [
  { value: 'buy',        label: 'Zakup',            hasTicker: true,  hasQty: true,  hasPrice: true,  hasCash: false },
  { value: 'sell',       label: 'Sprzedaż',         hasTicker: true,  hasQty: true,  hasPrice: true,  hasCash: false },
  { value: 'dividend',   label: 'Dywidenda',        hasTicker: true,  hasQty: false, hasPrice: true,  hasCash: false },
  { value: 'split',      label: 'Split akcji',      hasTicker: true,  hasQty: true,  hasPrice: false, hasCash: false },
  { value: 'deposit',    label: 'Wpłata środków',   hasTicker: false, hasQty: false, hasPrice: false, hasCash: true  },
  { value: 'withdrawal', label: 'Wypłata środków',  hasTicker: false, hasQty: false, hasPrice: false, hasCash: true  },
]

const ASSET_CLASSES = ['Akcje', 'ETF', 'Obligacje', 'Krypto', 'Surowce', 'Inne']
const CURRENCIES = ['PLN', 'USD', 'EUR', 'GBP', 'CHF']

const DESCRIPTIONS = {
  buy:        'Zakup akcji, ETF lub innego instrumentu.',
  sell:       'Sprzedaż posiadanego instrumentu.',
  dividend:   'Otrzymana dywidenda — podaj łączną kwotę.',
  split:      'Split akcji — podaj współczynnik (np. 4 jeśli 1 akcja → 4 akcje).',
  deposit:    'Wpłata gotówki do portfela.',
  withdrawal: 'Wypłata gotówki z portfela.',
}

export default function AddTransactionModal({ onClose, defaultTicker = '' }) {
  const { activePortfolioId, fetchSummary } = usePortfolioStore()
  const [type, setType] = useState('buy')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    ticker: defaultTicker,
    asset_class: 'Akcje',
    currency: 'PLN',
    quantity: '',
    price: '',
    exchange_rate: '1',
    amount_pln: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  })

  const txType = TRANSACTION_TYPES.find((t) => t.value === type)

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const payload = {
        transaction_type: type,
        date: form.date ? new Date(form.date).toISOString() : null,
        notes: form.notes || null,
      }

      if (txType.hasTicker) {
        payload.ticker = form.ticker.trim().toUpperCase()
        payload.asset_class = form.asset_class
        payload.currency = form.currency
        payload.exchange_rate = parseFloat(form.exchange_rate) || 1
      }
      if (txType.hasQty) payload.quantity = parseFloat(form.quantity)
      if (txType.hasPrice) payload.price = parseFloat(form.price)
      if (txType.hasCash) payload.amount_pln = parseFloat(form.amount_pln)

      const res = await fetch(`/api/portfolios/${activePortfolioId}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Błąd dodawania transakcji')
      await fetchSummary(activePortfolioId)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Dodaj transakcję</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none transition-colors">×</button>
        </div>

        {/* Typ transakcji */}
        <div className="grid grid-cols-3 gap-1 mb-5 bg-gray-800 p-1 rounded-lg">
          {TRANSACTION_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={clsx(
                'text-xs py-1.5 px-2 rounded-md transition-colors font-medium',
                type === t.value
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-500 mb-4">{DESCRIPTIONS[type]}</p>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Ticker */}
          {txType.hasTicker && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Ticker *</label>
                <input
                  className="input"
                  placeholder="np. XTB.WA, AAPL"
                  value={form.ticker}
                  onChange={(e) => set('ticker', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Klasa aktywów</label>
                <select className="input" value={form.asset_class} onChange={(e) => set('asset_class', e.target.value)}>
                  {ASSET_CLASSES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Ilość i cena */}
          {(txType.hasQty || txType.hasPrice) && (
            <div className="grid grid-cols-2 gap-3">
              {txType.hasQty && (
                <div>
                  <label className="label">
                    {type === 'split' ? 'Współczynnik *' : 'Liczba jednostek *'}
                  </label>
                  <input
                    className="input"
                    type="number"
                    step="any"
                    min="0"
                    placeholder={type === 'split' ? 'np. 4' : 'np. 10'}
                    value={form.quantity}
                    onChange={(e) => set('quantity', e.target.value)}
                    required
                  />
                </div>
              )}
              {txType.hasPrice && (
                <div>
                  <label className="label">
                    {type === 'dividend' ? 'Kwota dywidendy *' : 'Cena jednostkowa *'}
                  </label>
                  <input
                    className="input"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="np. 95.40"
                    value={form.price}
                    onChange={(e) => set('price', e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
          )}

          {/* Waluta i kurs */}
          {txType.hasTicker && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Waluta</label>
                <select className="input" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              {form.currency !== 'PLN' && (
                <div>
                  <label className="label">Kurs (1 {form.currency} = ? PLN)</label>
                  <input
                    className="input"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="np. 4.05"
                    value={form.exchange_rate}
                    onChange={(e) => set('exchange_rate', e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Kwota PLN dla wpłat/wypłat */}
          {txType.hasCash && (
            <div>
              <label className="label">Kwota (PLN) *</label>
              <input
                className="input"
                type="number"
                step="any"
                min="0"
                placeholder="np. 5000"
                value={form.amount_pln}
                onChange={(e) => set('amount_pln', e.target.value)}
                required
              />
            </div>
          )}

          {/* Data */}
          <div>
            <label className="label">Data transakcji</label>
            <input
              className="input"
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </div>

          {/* Notatki */}
          <div>
            <label className="label">Notatki</label>
            <input
              className="input"
              placeholder="Opcjonalnie..."
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>

          {error && <p className="text-loss text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Anuluj</button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Dodawanie...' : 'Dodaj transakcję'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

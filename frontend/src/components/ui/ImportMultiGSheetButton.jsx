import { useRef, useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'

const BACKEND_URL = 'https://stocktracker-production-5f5f.up.railway.app'

export default function ImportMultiGSheetButton() {
  const { fetchPortfolios, activePortfolioId, fetchSummary } = usePortfolioStore()
  const inputRef = useRef()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${BACKEND_URL}/api/import/multi-gsheet`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Błąd importu')

      setResult(data)
      // Odśwież listę portfeli (mogły powstać nowe)
      await fetchPortfolios()
      if (activePortfolioId) await fetchSummary(activePortfolioId)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
        onChange={handleFile}
      />
      <button
        className="btn-ghost text-sm"
        onClick={() => { setResult(null); setError(''); inputRef.current.click() }}
        disabled={loading}
      >
        {loading ? 'Importowanie...' : '↑ Importuj wszystkie portfele'}
      </button>

      {/* Wynik importu */}
      {result && (
        <div className="absolute right-0 top-10 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">Import zakończony ✓</p>
            <button
              onClick={() => setResult(null)}
              className="text-gray-400 hover:text-gray-700 text-lg leading-none"
            >×</button>
          </div>

          <p className="text-xs text-gray-500 mb-3">
            Łącznie: <span className="font-semibold text-gray-900">{result.total_imported}</span> transakcji
            {result.skipped > 0 && <span className="text-gray-400"> · pominięto: {result.skipped}</span>}
          </p>

          {result.portfolios_created?.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Utworzone portfele</p>
              {result.portfolios_created.map((name) => (
                <div key={name} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-green-600 font-medium">+ {name}</span>
                  <span className="text-gray-500">{result.imported_per_portfolio[name]} tx</span>
                </div>
              ))}
            </div>
          )}

          {result.portfolios_existing?.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Istniejące portfele</p>
              {result.portfolios_existing.map((name) => (
                <div key={name} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-gray-700">{name}</span>
                  <span className="text-gray-500">{result.imported_per_portfolio[name]} tx</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="absolute right-0 top-10 z-50 bg-white border border-red-200 rounded-lg shadow p-3 text-xs text-red-500 w-64">
          {error}
        </p>
      )}
    </div>
  )
}

import { useState, useRef } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import clsx from 'clsx'

const BACKEND_URL = 'https://stocktracker-production-5f5f.up.railway.app'

export default function ImportXTBModal({ onClose }) {
  const { activePortfolioId, fetchSummary, fetchPortfolios } = usePortfolioStore()
  const [file, setFile] = useState(null)
  const [merge, setMerge] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const inputRef = useRef()

  async function handleImport() {
    if (!file) return
    setError('')
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(
        `${BACKEND_URL}/api/import/${activePortfolioId}/xtb?merge=${merge}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Błąd importu')
      setResult(data)
      // Odśwież portfele i summary bezpiecznie
      await fetchPortfolios()
      if (activePortfolioId) await fetchSummary(activePortfolioId)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const TX_LABELS = {
    buy: 'Zakupy',
    sell: 'Sprzedaże',
    dividend: 'Dywidendy',
    deposit: 'Wpłaty',
    withdrawal: 'Wypłaty',
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Importuj z XTB</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none transition-colors">×</button>
        </div>

        {!result ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Wgraj plik <span className="text-white font-mono">.xlsx</span> pobrany z XTB.
              Zaimportowane zostaną otwarte pozycje, wpłaty, dywidendy i odsetki.
            </p>

            <div
              onClick={() => inputRef.current.click()}
              className={clsx(
                'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                file ? 'border-brand-500 bg-brand-500/10' : 'border-gray-700 hover:border-gray-500'
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => setFile(e.target.files[0])}
              />
              {file ? (
                <p className="text-sm text-white">{file.name}</p>
              ) : (
                <p className="text-sm text-gray-500">Kliknij aby wybrać plik .xlsx</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="merge"
                checked={merge}
                onChange={(e) => setMerge(e.target.checked)}
                className="w-4 h-4 accent-brand-500"
              />
              <label htmlFor="merge" className="text-sm text-gray-300">
                Łącz pozycje tego samego tickera (średnia ważona ceny)
              </label>
            </div>

            {error && <p className="text-loss text-sm">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">Anuluj</button>
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="btn-primary flex-1"
              >
                {loading ? 'Importowanie...' : 'Importuj'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4 space-y-2">
              <p className="text-white font-medium">Import zakończony ✓</p>
              <p className="text-sm text-gray-300">
                Łącznie zaimportowano: <span className="text-gain font-medium">{result.total_imported}</span> transakcji
              </p>
              {result.imported && (
                <div className="mt-3 space-y-1">
                  {Object.entries(result.imported).map(([type, count]) =>
                    count > 0 ? (
                      <div key={type} className="flex justify-between text-xs">
                        <span className="text-gray-400">{TX_LABELS[type] || type}</span>
                        <span className="text-white font-medium">{count}</span>
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </div>
            <button onClick={onClose} className="btn-primary w-full">Zamknij</button>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useRef } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'
import clsx from 'clsx'

export default function ImportXTBModal({ onClose }) {
  const { activePortfolioId, fetchSummary } = usePortfolioStore()
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
        `/api/import/${activePortfolioId}/xtb?merge=${merge}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Błąd importu')
      setResult(data)
      await fetchSummary(activePortfolioId)
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
          <h2 className="text-white font-semibold">Importuj z XTB</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none transition-colors">×</button>
        </div>

        {!result ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Wgraj plik <span className="text-white font-mono">.xlsx</span> pobrany z XTB (Historia konta → Eksport).
              Zaimportowane zostaną otwarte pozycje.
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
                Zaimportowano: <span className="text-gain font-medium">{result.total_imported}</span> pozycji
              </p>
              {result.total_skipped > 0 && (
                <p className="text-sm text-gray-300">
                  Pominięto (już istnieją): <span className="text-yellow-400 font-medium">{result.total_skipped}</span>
                </p>
              )}
              {result.imported.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">Zaimportowane:</p>
                  <p className="text-xs font-mono text-gray-300">{result.imported.join(', ')}</p>
                </div>
              )}
              {result.skipped.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">Pominięte:</p>
                  <p className="text-xs font-mono text-yellow-500">{result.skipped.join(', ')}</p>
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

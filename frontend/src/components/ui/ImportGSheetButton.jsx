import { useRef, useState } from 'react'
import { usePortfolioStore } from '../../store/portfolioStore'

export default function ImportGSheetButton() {
  const { activePortfolioId, fetchSummary } = usePortfolioStore()
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

      const res = await fetch(`/api/import/${activePortfolioId}/gsheet`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Błąd importu')

      await fetchSummary(activePortfolioId)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
        onChange={handleFile}
      />
      <button
        className="btn-ghost"
        onClick={() => inputRef.current.click()}
        disabled={loading}
      >
        {loading ? 'Importowanie...' : '↑ Import CSV/XLSX'}
      </button>

      {result && (
        <p className="text-xs text-green-400 mt-1">
          Zaimportowano {result.total_imported} transakcji
          {result.imported.skipped > 0 && ` (pominięto: ${result.imported.skipped})`}
        </p>
      )}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}

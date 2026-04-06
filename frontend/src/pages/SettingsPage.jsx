import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolioStore } from '../store/portfolioStore'
import CreatePortfolioModal from '../components/ui/CreatePortfolioModal'
import ConfirmModal from '../components/ui/ConfirmModal'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { portfolios, deletePortfolio, fetchPortfolios, setActivePortfolio } = usePortfolioStore()
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')

  async function handleDelete(id) {
    setDeleting(id)
    try {
      await deletePortfolio(id)
    } finally {
      setDeleting(null)
      setConfirmDelete(null)
    }
  }

  async function handleRename(id) {
    if (!editName.trim()) return
    setSaving(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/portfolios/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: editName.trim() }),
      })
      if (!res.ok) throw new Error('Błąd zapisu')
      await fetchPortfolios()
      setEditId(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleGoToPortfolio(id) {
    setActivePortfolio(id)
    navigate('/dashboard')
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Ustawienia</h1>
      <p className="text-sm text-gray-500 mb-8">Zarządzaj swoimi portfelami inwestycyjnymi.</p>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Portfele</h2>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
            + Nowy portfel
          </button>
        </div>

        <div className="space-y-2">
          {portfolios.length === 0 && (
            <p className="text-sm text-gray-400 py-4">Brak portfeli. Utwórz pierwszy portfel.</p>
          )}

          {portfolios.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm"
            >
              {editId === p.id ? (
                <div className="flex items-center gap-2 flex-1 mr-4">
                  <input
                    className="input flex-1"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(p.id)
                      if (e.key === 'Escape') setEditId(null)
                    }}
                    autoFocus
                  />
                  {error && <p className="text-loss text-xs">{error}</p>}
                </div>
              ) : (
                <button
                  onClick={() => handleGoToPortfolio(p.id)}
                  className="flex-1 text-left group"
                >
                  <p className="text-gray-900 text-sm font-medium group-hover:text-brand-600 transition-colors">
                    {p.name}
                    <span className="ml-2 text-xs text-gray-400 group-hover:text-gray-500">→</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {p.currency} · utworzony {new Date(p.created_at).toLocale

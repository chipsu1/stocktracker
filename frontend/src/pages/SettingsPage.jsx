import { useState } from 'react'
import { usePortfolioStore } from '../store/portfolioStore'
import CreatePortfolioModal from '../components/ui/CreatePortfolioModal'
import ConfirmModal from '../components/ui/ConfirmModal'

export default function SettingsPage() {
  const { portfolios, deletePortfolio, fetchPortfolios } = usePortfolioStore()
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

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-white mb-1">Ustawienia</h1>
      <p className="text-sm text-gray-500 mb-8">Zarządzaj swoimi portfelami inwestycyjnymi.</p>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-300 uppercase tracking-wide">Portfele</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary text-sm"
          >
            + Nowy portfel
          </button>
        </div>

        <div className="space-y-2">
          {portfolios.length === 0 && (
            <p className="text-sm text-gray-600 py-4">Brak portfeli. Utwórz pierwszy portfel.</p>
          )}

          {portfolios.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
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
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    {p.currency} · utworzony {new Date(p.created_at).toLocaleDateString('pl-PL')}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                {editId === p.id ? (
                  <>
                    <button
                      onClick={() => handleRename(p.id)}
                      disabled={saving}
                      className="btn-primary text-xs px-3 py-1"
                    >
                      {saving ? '...' : 'Zapisz'}
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="btn-ghost text-xs px-3 py-1"
                    >
                      Anuluj
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditId(p.id); setEditName(p.name); setError('') }}
                      className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-800"
                    >
                      Zmień nazwę
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ id: p.id, name: p.name })}
                      disabled={deleting === p.id}
                      className="text-xs text-gray-600 hover:text-loss transition-colors px-2 py-1 rounded hover:bg-gray-800"
                    >
                      {deleting === p.id ? '...' : 'Usuń'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {showCreate && <CreatePortfolioModal onClose={() => setShowCreate(false)} />}

      {confirmDelete && (
        <ConfirmModal
          message={`Usunąć portfel "${confirmDelete.name}"? Wszystkie pozycje i transakcje zostaną trwale usunięte.`}
          onConfirm={() => handleDelete(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

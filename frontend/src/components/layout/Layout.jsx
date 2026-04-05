import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { usePortfolioStore } from '../../store/portfolioStore'
import CreatePortfolioModal from '../ui/CreatePortfolioModal'
import ConfirmModal from '../ui/ConfirmModal'
import clsx from 'clsx'

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/positions', label: 'Pozycje' },
]

export default function Layout() {
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const { portfolios, activePortfolioId, fetchPortfolios, setActivePortfolio, deletePortfolio } =
    usePortfolioStore()
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // { id, name }
  const [deleting, setDeleting] = useState(false)
  const [hoveredPortfolio, setHoveredPortfolio] = useState(null)

  useEffect(() => {
    fetchPortfolios()
  }, [])

  async function handleDeletePortfolio(id) {
    setDeleting(true)
    try {
      await deletePortfolio(id)
    } finally {
      setDeleting(false)
      setConfirmDelete(null)
    }
  }

  return (
    <div className="flex h-screen bg-gray-950">
      <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <span className="text-white font-semibold text-sm">Portfolio Tracker</span>
        </div>

        <div className="p-3 border-b border-gray-800">
          <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">Portfele</p>
          <div className="space-y-1">
            {portfolios.map((p) => (
              <div
                key={p.id}
                className="relative group"
                onMouseEnter={() => setHoveredPortfolio(p.id)}
                onMouseLeave={() => setHoveredPortfolio(null)}
              >
                <button
                  onClick={() => setActivePortfolio(p.id)}
                  className={clsx(
                    'w-full text-left text-sm px-3 py-2 rounded-lg transition-colors truncate pr-8',
                    activePortfolioId === p.id
                      ? 'bg-brand-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  )}
                >
                  {p.name}
                </button>

                {/* Przycisk usuwania — pojawia się po najechaniu */}
                {hoveredPortfolio === p.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDelete({ id: p.id, name: p.name })
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-loss transition-colors text-xs leading-none"
                    title="Usuń portfel"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-2 w-full text-xs text-gray-500 hover:text-white py-1 text-left px-3 rounded hover:bg-gray-800 transition-colors"
          >
            + Nowy portfel
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'block text-sm px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-800">
          <p className="text-xs text-gray-500 truncate mb-1">{user?.email || '—'}</p>
          <button onClick={logout} className="text-xs text-gray-500 hover:text-white transition-colors">
            Wyloguj
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {showCreate && <CreatePortfolioModal onClose={() => setShowCreate(false)} />}

      {confirmDelete && (
        <ConfirmModal
          message={`Usunąć portfel "${confirmDelete.name}"? Wszystkie pozycje zostaną trwale usunięte.`}
          onConfirm={() => handleDeletePortfolio(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

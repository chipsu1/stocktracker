import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { usePortfolioStore } from '../../store/portfolioStore'
import clsx from 'clsx'

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/positions', label: 'Pozycje' },
]

export default function Layout() {
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const { portfolios, activePortfolioId, fetchPortfolios, setActivePortfolio, createPortfolio } =
    usePortfolioStore()

  useEffect(() => {
    fetchPortfolios()
  }, [])

  async function handleNewPortfolio() {
    const name = window.prompt('Nazwa nowego portfela:')
    if (!name) return
    const p = await createPortfolio({ name })
    setActivePortfolio(p.id)
  }

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <span className="text-white font-semibold text-sm">Portfolio Tracker</span>
        </div>

        {/* Portfele */}
        <div className="p-3 border-b border-gray-800">
          <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">Portfele</p>
          <div className="space-y-1">
            {portfolios.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePortfolio(p.id)}
                className={clsx(
                  'w-full text-left text-sm px-3 py-2 rounded-lg transition-colors truncate',
                  activePortfolioId === p.id
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
          <button
            onClick={handleNewPortfolio}
            className="mt-2 w-full text-xs text-gray-500 hover:text-white py-1 text-left px-3 rounded hover:bg-gray-800 transition-colors"
          >
            + Nowy portfel
          </button>
        </div>

        {/* Nawigacja */}
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

        {/* User */}
        <div className="p-3 border-t border-gray-800">
          <p className="text-xs text-gray-500 truncate mb-1">{user?.email || '—'}</p>
          <button onClick={logout} className="text-xs text-gray-500 hover:text-white transition-colors">
            Wyloguj
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

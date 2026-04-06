import { Outlet, NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { usePortfolioStore } from '../../store/portfolioStore'
import CreatePortfolioModal from '../ui/CreatePortfolioModal'
import clsx from 'clsx'
import { LayoutDashboard, ListOrdered, Settings, LogOut, TrendingUp } from 'lucide-react'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/positions', label: 'Pozycje', icon: ListOrdered },
  { to: '/settings', label: 'Ustawienia', icon: Settings },
]

export default function Layout() {
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const { portfolios, activePortfolioId, fetchPortfolios, setActivePortfolio } =
    usePortfolioStore()
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    fetchPortfolios()
  }, [])

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <div className="p-4 border-b border-gray-200 flex items-center gap-2">
          <TrendingUp size={18} className="text-brand-600" />
          <span className="text-gray-900 font-semibold text-sm">Portfolio Tracker</span>
        </div>

        <div className="p-3 border-b border-gray-200">
          <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">Portfele</p>
          <div className="space-y-1">
            {portfolios.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePortfolio(p.id)}
                className={clsx(
                  'w-full text-left text-sm px-3 py-2 rounded-lg transition-colors truncate',
                  activePortfolioId === p.id
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-2 w-full text-xs text-gray-400 hover:text-gray-900 py-1 text-left px-3 rounded hover:bg-gray-100 transition-colors"
          >
            + Nowy portfel
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 text-sm px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? 'text-brand-600' : 'text-gray-400'} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <p className="text-xs text-gray-400 truncate mb-2">{user?.email || '—'}</p>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-900 transition-colors"
          >
            <LogOut size={13} />
            Wyloguj
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {showCreate && <CreatePortfolioModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

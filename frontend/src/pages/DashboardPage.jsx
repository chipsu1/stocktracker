import { usePortfolioStore } from '../store/portfolioStore'
import StatCard from '../components/ui/StatCard'
import AllocationChart from '../components/charts/AllocationChart'

function fmt(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 2 }).format(v)
}

function fmtPct(v) {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

export default function DashboardPage() {
  const { summary, loading, activePortfolioId, portfolios } = usePortfolioStore()

  const portfolio = portfolios.find((p) => p.id === activePortfolioId)

  if (!activePortfolioId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Wybierz lub utwórz portfel w panelu bocznym.
      </div>
    )
  }

  if (loading && !summary) {
    return <div className="p-8 text-gray-500 text-sm">Ładowanie...</div>
  }

  const s = summary

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">{portfolio?.name}</h1>
        <p className="text-sm text-gray-500">{portfolio?.description || 'Podsumowanie portfela'}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Wartość portfela" value={fmt(s?.total_value_pln)} />
        <StatCard label="Wpłaty netto" value={fmt(s?.total_cost_pln)} />
        <StatCard
          label="Niezrealizowany zysk"
          value={fmt(s?.total_gain_loss_pln)}
          sub={fmtPct(s?.total_gain_loss_pct)}
          positive={s?.total_gain_loss_pln > 0}
          negative={s?.total_gain_loss_pln < 0}
        />
        <StatCard
          label="Zmiana dzienna"
          value={fmt(s?.daily_change_pln)}
          positive={s?.daily_change_pln > 0}
          negative={s?.daily_change_pln < 0}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {s?.positions?.length > 0 && <AllocationChart positions={s.positions} />}

        {/* Top positions */}
        <div className="card">
          <p className="text-sm font-medium text-gray-300 mb-4">Największe pozycje</p>
          <div className="space-y-3">
            {(s?.positions || [])
              .filter((p) => p.current_value_pln)
              .sort((a, b) => b.current_value_pln - a.current_value_pln)
              .slice(0, 6)
              .map((p) => {
                const pct = s.total_value_pln > 0
                  ? (p.current_value_pln / s.total_value_pln) * 100
                  : 0
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-white font-medium truncate">{p.ticker}</span>
                        <span className="text-gray-400 ml-2">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-gray-300 w-24 text-right">{fmt(p.current_value_pln)}</span>
                  </div>
                )
              })}
            {(!s?.positions?.length) && (
              <p className="text-sm text-gray-600">Brak pozycji. Dodaj transakcję w zakładce Pozycje.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

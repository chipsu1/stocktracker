import { useEffect } from 'react'
import { usePortfolioStore } from '../store/portfolioStore'
import { useNavigate } from 'react-router-dom'
import StatCard from '../components/ui/StatCard'
import AllocationChart from '../components/charts/AllocationChart'
import ImportMultiGSheetButton from '../components/ui/ImportMultiGSheetButton'
import clsx from 'clsx'

function fmt(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency', currency: 'PLN', maximumFractionDigits: 2,
  }).format(v)
}

function fmtPct(v) {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

export default function OverallDashboardPage() {
  const { portfolios, allSummaries, loading, fetchAllSummaries, setActivePortfolio } = usePortfolioStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (portfolios.length > 0) fetchAllSummaries()
  }, [portfolios])

  // Agreguj wszystkie summaries w jedną liczbę
  const totalValue    = allSummaries.reduce((s, x) => s + (x?.total_value_pln   ?? 0), 0)
  const totalCost     = allSummaries.reduce((s, x) => s + (x?.total_cost_pln    ?? 0), 0)
  const totalGain     = allSummaries.reduce((s, x) => s + (x?.total_gain_loss_pln ?? 0), 0)
  const totalDaily    = allSummaries.reduce((s, x) => s + (x?.daily_change_pln  ?? 0), 0)
  const totalCash     = allSummaries.reduce((s, x) => s + (x?.cash_pln          ?? 0), 0)
  const totalGainPct  = totalCost > 0 ? (totalGain / totalCost) * 100 : 0

  // Połącz wszystkie pozycje ze wszystkich portfeli
  const allPositions = allSummaries.flatMap((s) => s?.positions ?? [])

  // Top pozycje po wartości
  const topPositions = [...allPositions]
    .filter((p) => p.current_value_pln)
    .sort((a, b) => b.current_value_pln - a.current_value_pln)
    .slice(0, 6)

  if (loading && allSummaries.length === 0) {
    return <div className="p-8 text-gray-500 text-sm">Ładowanie...</div>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Wszystkie portfele</h1>
          <p className="text-sm text-gray-500">Łączne podsumowanie — {portfolios.length} portfeli</p>
        </div>
        <ImportMultiGSheetButton />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Łączna wartość" value={fmt(totalValue)} />
        <StatCard label="Wpłaty netto" value={fmt(totalCost)} />
        <StatCard
          label="Niezrealizowany zysk"
          value={fmt(totalGain)}
          sub={fmtPct(totalGainPct)}
          positive={totalGain > 0}
          negative={totalGain < 0}
        />
        <StatCard
          label="Zmiana dzienna"
          value={fmt(totalDaily)}
          positive={totalDaily > 0}
          negative={totalDaily < 0}
        />
      </div>

      {/* Saldo gotówkowe łącznie */}
      <div className="mb-6 px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm flex items-center gap-3">
        <span className="text-xs text-gray-400 uppercase tracking-wide">Saldo gotówkowe łącznie</span>
        <span className={clsx('font-semibold', totalCash >= 0 ? 'text-gray-900' : 'text-red-500')}>
          {fmt(totalCash)}
        </span>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {allPositions.length > 0 && <AllocationChart positions={allPositions} />}

        {/* Top pozycje */}
        <div className="card">
          <p className="text-sm font-medium text-gray-700 mb-4">Największe pozycje (wszystkie portfele)</p>
          <div className="space-y-3">
            {topPositions.map((p) => {
              const pct = totalValue > 0 ? (p.current_value_pln / totalValue) * 100 : 0
              return (
                <div key={`${p.ticker}-${p.current_value_pln}`} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-900 font-medium truncate">
                        {p.name || p.ticker}
                        <span className="text-gray-400 font-normal ml-1 font-mono text-xs">{p.name ? p.ticker : ''}</span>
                      </span>
                      <span className="text-gray-400 ml-2">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-gray-600 w-28 text-right">{fmt(p.current_value_pln)}</span>
                </div>
              )
            })}
            {allPositions.length === 0 && (
              <p className="text-sm text-gray-400">Brak pozycji z wyceną.</p>
            )}
          </div>
        </div>
      </div>

      {/* Per-portfolio breakdown */}
      <div className="card">
        <p className="text-sm font-medium text-gray-700 mb-4">Podział per portfel</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                <th className="text-left py-2 pr-4 font-medium">Portfel</th>
                <th className="text-right py-2 px-4 font-medium">Wartość</th>
                <th className="text-right py-2 px-4 font-medium">Wpłaty</th>
                <th className="text-right py-2 px-4 font-medium">Zysk/Strata</th>
                <th className="text-right py-2 px-4 font-medium">%</th>
                <th className="text-right py-2 px-4 font-medium">Gotówka</th>
                <th className="text-right py-2 pl-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {allSummaries.map((s, i) => {
                const port = portfolios[i]
                if (!port) return null
                const gain = s?.total_gain_loss_pln ?? 0
                const gainPct = s?.total_gain_loss_pct ?? 0
                return (
                  <tr key={port.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-gray-900">{port.name}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{fmt(s?.total_value_pln)}</td>
                    <td className="py-3 px-4 text-right text-gray-500">{fmt(s?.total_cost_pln)}</td>
                    <td className={clsx('py-3 px-4 text-right font-medium', gain >= 0 ? 'text-green-600' : 'text-red-500')}>
                      {fmt(gain)}
                    </td>
                    <td className={clsx('py-3 px-4 text-right', gainPct >= 0 ? 'text-green-600' : 'text-red-500')}>
                      {fmtPct(gainPct)}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500">{fmt(s?.cash_pln)}</td>
                    <td className="py-3 pl-4 text-right">
                      <button
                        onClick={() => { setActivePortfolio(port.id); navigate('/dashboard') }}
                        className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                      >
                        Otwórz →
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td className="py-3 pr-4 text-xs font-semibold text-gray-500 uppercase">Łącznie</td>
                <td className="py-3 px-4 text-right font-semibold text-gray-900">{fmt(totalValue)}</td>
                <td className="py-3 px-4 text-right font-semibold text-gray-500">{fmt(totalCost)}</td>
                <td className={clsx('py-3 px-4 text-right font-semibold', totalGain >= 0 ? 'text-green-600' : 'text-red-500')}>
                  {fmt(totalGain)}
                </td>
                <td className={clsx('py-3 px-4 text-right font-semibold', totalGainPct >= 0 ? 'text-green-600' : 'text-red-500')}>
                  {fmtPct(totalGainPct)}
                </td>
                <td className="py-3 px-4 text-right font-semibold text-gray-500">{fmt(totalCash)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

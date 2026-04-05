import { useState } from 'react'
import { usePortfolioStore } from '../store/portfolioStore'
import AddPositionModal from '../components/ui/AddPositionModal'
import ConfirmModal from '../components/ui/ConfirmModal'
import clsx from 'clsx'

function fmt(v, decimals = 2) {
  if (v == null) return '—'
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency', currency: 'PLN',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v)
}

function fmtNum(v, decimals = 2) {
  if (v == null) return '—'
  return v.toFixed(decimals)
}

function fmtDate(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function Pct({ value }) {
  if (value == null) return <span className="text-gray-600">—</span>
  return (
    <span className={clsx('font-medium', value >= 0 ? 'text-gain' : 'text-loss')}>
      {value >= 0 ? '+' : ''}{value.toFixed(2)}%
    </span>
  )
}

function PLNChange({ value }) {
  if (value == null) return <span className="text-gray-600">—</span>
  return (
    <span className={clsx('text-sm', value >= 0 ? 'text-gain' : 'text-loss')}>
      {value >= 0 ? '+' : ''}{fmt(value)}
    </span>
  )
}

export default function PositionsPage() {
  const { summary, loading, activePortfolioId, portfolios, deletePosition, fetchSummary } = usePortfolioStore()
  const [showAdd, setShowAdd] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const portfolio = portfolios.find((p) => p.id === activePortfolioId)
  const positions = summary?.positions || []

  async function handleDelete(positionId) {
    setDeleting(positionId)
    try {
      await deletePosition(positionId)
    } finally {
      setDeleting(null)
    }
  }

  async function handleRefresh() {
    if (activePortfolioId) await fetchSummary(activePortfolioId)
  }

  if (!activePortfolioId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Wybierz portfel w panelu bocznym.
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">{portfolio?.name} — Pozycje</h1>
          <p className="text-sm text-gray-500">{positions.length} pozycji</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefresh} className="btn-ghost text-sm" disabled={loading}>
            {loading ? 'Odświeżanie...' : '↻ Odśwież ceny'}
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">
            + Dodaj pozycję
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium">Ticker</th>
              <th className="text-left px-4 py-3 font-medium">Nazwa</th>
              <th className="text-left px-4 py-3 font-medium">Klasa</th>
              <th className="text-right px-4 py-3 font-medium">Waluta</th>
              <th className="text-right px-4 py-3 font-medium">Liczba</th>
              <th className="text-right px-4 py-3 font-medium">Śr. cena zakupu</th>
              <th className="text-right px-4 py-3 font-medium">Data zakupu</th>
              <th className="text-right px-4 py-3 font-medium">Obecna cena</th>
              <th className="text-right px-4 py-3 font-medium">Zmiana dzienna</th>
              <th className="text-right px-4 py-3 font-medium">Wartość (PLN)</th>
              <th className="text-right px-4 py-3 font-medium">Zysk/Strata PLN</th>
              <th className="text-right px-4 py-3 font-medium">% Zysk/Strata</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-12 text-center text-gray-600">
                  Brak pozycji. Kliknij „Dodaj pozycję".
                </td>
              </tr>
            )}
            {positions.map((p) => (
              <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-900/50 transition-colors">
                <td className="px-4 py-3 font-mono font-medium text-white">{p.ticker}</td>
                <td className="px-4 py-3 text-gray-300 max-w-[120px] truncate">{p.name || '—'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{p.asset_class}</td>
                <td className="px-4 py-3 text-right text-gray-400">{p.currency}</td>
                <td className="px-4 py-3 text-right text-gray-300">{fmtNum(p.quantity, p.quantity % 1 === 0 ? 0 : 2)}</td>
                <td className="px-4 py-3 text-right text-gray-300">{fmtNum(p.avg_purchase_price)} {p.currency}</td>
                <td className="px-4 py-3 text-right text-gray-400 text-xs">{fmtDate(p.purchase_date)}</td>
                <td className="px-4 py-3 text-right text-white font-medium">
                  {p.current_price != null ? `${fmtNum(p.current_price)} ${p.currency}` : '—'}
                </td>
                <td className="px-4 py-3 text-right"><Pct value={p.daily_change_pct} /></td>
                <td className="px-4 py-3 text-right text-white">{fmt(p.current_value_pln)}</td>
                <td className="px-4 py-3 text-right"><PLNChange value={p.gain_loss_pln} /></td>
                <td className="px-4 py-3 text-right"><Pct value={p.gain_loss_pct} /></td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setConfirm({ id: p.id, name: p.ticker })}
                    disabled={deleting === p.id}
                    className="text-gray-600 hover:text-loss transition-colors text-xs"
                  >
                    {deleting === p.id ? '...' : 'Usuń'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {positions.length > 0 && summary && (
            <tfoot>
              <tr className="border-t border-gray-700 bg-gray-900/80">
                <td colSpan={9} className="px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Łącznie</td>
                <td className="px-4 py-3 text-right text-white font-semibold">{fmt(summary.total_value_pln)}</td>
                <td className="px-4 py-3 text-right"><PLNChange value={summary.total_gain_loss_pln} /></td>
                <td className="px-4 py-3 text-right"><Pct value={summary.total_gain_loss_pct} /></td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showAdd && <AddPositionModal onClose={() => setShowAdd(false)} />}
      {confirm && (
        <ConfirmModal
          message={`Usunąć pozycję ${confirm.name}?`}
          onConfirm={() => handleDelete(confirm.id)}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

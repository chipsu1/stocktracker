import { useState } from 'react'
import { usePortfolioStore } from '../store/portfolioStore'
import AddPositionModal from '../components/ui/AddPositionModal'
import ConfirmModal from '../components/ui/ConfirmModal'
import ImportXTBModal from '../components/ui/ImportXTBModal'
import EditPositionModal from '../components/ui/EditPositionModal'
import clsx from 'clsx'

const BACKEND_URL = 'https://stocktracker-production-5f5f.up.railway.app'

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

// Grupuje pozycje po tickerze
function groupPositions(positions) {
  const groups = {}
  for (const p of positions) {
    if (!groups[p.ticker]) {
      groups[p.ticker] = []
    }
    groups[p.ticker].push(p)
  }
  return groups
}

// Liczy sumaryczne dane dla grupy tickerów
function summarizeGroup(positions) {
  const totalQuantity = positions.reduce((s, p) => s + p.quantity, 0)
  const totalCost = positions.reduce((s, p) => s + p.quantity * p.avg_purchase_price, 0)
  const avgPrice = totalCost / totalQuantity

  const totalValuePln = positions.reduce((s, p) => s + (p.current_value_pln ?? 0), 0)
  const totalCostPln = positions.reduce((s, p) => s + (p.cost_pln ?? p.quantity * p.avg_purchase_price), 0)
  const gainLossPln = positions.some(p => p.current_value_pln != null)
    ? positions.reduce((s, p) => s + (p.gain_loss_pln ?? 0), 0)
    : null
  const gainLossPct = gainLossPln != null && totalCostPln > 0
    ? (gainLossPln / totalCostPln) * 100
    : null

  const dailyPct = positions[0]?.daily_change_pct ?? null
  const currentPrice = positions[0]?.current_price ?? null

  return {
    ticker: positions[0].ticker,
    name: positions[0].name,
    asset_class: positions[0].asset_class,
    currency: positions[0].currency,
    totalQuantity,
    avgPrice,
    currentPrice,
    dailyPct,
    totalValuePln: positions.some(p => p.current_value_pln != null) ? totalValuePln : null,
    gainLossPln,
    gainLossPct,
  }
}

export default function PositionsPage() {
  const { summary, loading, activePortfolioId, portfolios, deletePosition, fetchSummary } = usePortfolioStore()
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editPosition, setEditPosition] = useState(null)
  const [addToPosition, setAddToPosition] = useState(null) // ticker do którego dodajemy
  const [confirm, setConfirm] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [expanded, setExpanded] = useState({}) // { [ticker]: bool }

  const portfolio = portfolios.find((p) => p.id === activePortfolioId)
  const positions = summary?.positions || []
  const groups = groupPositions(positions)
  const tickers = Object.keys(groups)

  function toggleExpand(ticker) {
    setExpanded((prev) => ({ ...prev, [ticker]: !prev[ticker] }))
  }

  async function handleDelete(positionId) {
    setDeleting(positionId)
    try {
      await deletePosition(positionId)
    } finally {
      setDeleting(null)
    }
  }

  async function handleSaveEdit(positionId, data) {
    const token = localStorage.getItem('token')
    const res = await fetch(`${BACKEND_URL}/api/portfolios/positions/${positionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Błąd edycji')
    }
    await fetchSummary(activePortfolioId)
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
          <p className="text-sm text-gray-500">{positions.length} pozycji ({tickers.length} tickerów)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRefresh} className="btn-ghost text-sm" disabled={loading}>
            {loading ? 'Odświeżanie...' : '↻ Odśwież ceny'}
          </button>
          <button onClick={() => setShowImport(true)} className="btn-ghost text-sm">
            ↑ Importuj XTB
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
              <th className="text-left px-4 py-3 font-medium w-4"></th>
              <th className="text-left px-4 py-3 font-medium">Ticker</th>
              <th className="text-left px-4 py-3 font-medium">Nazwa</th>
              <th className="text-left px-4 py-3 font-medium">Klasa</th>
              <th className="text-right px-4 py-3 font-medium">Waluta</th>
              <th className="text-right px-4 py-3 font-medium">Liczba</th>
              <th className="text-right px-4 py-3 font-medium">Śr. cena zakupu</th>
              <th className="text-right px-4 py-3 font-medium">Obecna cena</th>
              <th className="text-right px-4 py-3 font-medium">Zmiana dzienna</th>
              <th className="text-right px-4 py-3 font-medium">Wartość (PLN)</th>
              <th className="text-right px-4 py-3 font-medium">Zysk/Strata PLN</th>
              <th className="text-right px-4 py-3 font-medium">% Zysk/Strata</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {tickers.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-12 text-center text-gray-600">
                  Brak pozycji. Kliknij „Dodaj pozycję" lub „Importuj XTB".
                </td>
              </tr>
            )}

            {tickers.map((ticker) => {
              const group = groups[ticker]
              const isExpanded = expanded[ticker]
              const hasMultiple = group.length > 1
              const s = summarizeGroup(group)

              return (
                <>
                  {/* Wiersz sumaryczny tickera */}
                  <tr
                    key={`group-${ticker}`}
                    className={clsx(
                      'border-b border-gray-800/50 transition-colors',
                      hasMultiple ? 'cursor-pointer hover:bg-gray-800/60' : 'hover:bg-gray-900/50',
                      isExpanded && 'bg-gray-800/40'
                    )}
                    onClick={() => hasMultiple && toggleExpand(ticker)}
                  >
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {hasMultiple ? (isExpanded ? '▼' : '▶') : ''}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-white">
                      {ticker}
                      {hasMultiple && (
                        <span className="ml-2 text-xs text-gray-500 font-normal">×{group.length}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300 max-w-[120px] truncate">{s.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{s.asset_class}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{s.currency}</td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {fmtNum(s.totalQuantity, s.totalQuantity % 1 === 0 ? 0 : 2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {fmtNum(s.avgPrice)} {s.currency}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-medium">
                      {s.currentPrice != null ? `${fmtNum(s.currentPrice)} ${s.currency}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right"><Pct value={s.dailyPct} /></td>
                    <td className="px-4 py-3 text-right text-white">{fmt(s.totalValuePln)}</td>
                    <td className="px-4 py-3 text-right"><PLNChange value={s.gainLossPln} /></td>
                    <td className="px-4 py-3 text-right"><Pct value={s.gainLossPct} /></td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setShowAdd(true) || setAddToPosition(ticker)}
                        className="text-gray-500 hover:text-white transition-colors text-xs mr-2"
                      >
                        +Kup
                      </button>
                    </td>
                  </tr>

                  {/* Sub-wiersze po rozwinięciu */}
                  {isExpanded && group.map((p) => (
                    <tr
                      key={`sub-${p.id}`}
                      className="border-b border-gray-800/30 bg-gray-900/60 hover:bg-gray-900/80 transition-colors"
                    >
                      <td className="px-4 py-2"></td>
                      <td className="px-4 py-2">
                        <span className="text-xs text-gray-500 font-mono">#{p.id}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">{fmtDate(p.purchase_date)}</td>
                      <td className="px-4 py-2 text-xs text-gray-400">{p.asset_class}</td>
                      <td className="px-4 py-2 text-right text-xs text-gray-400">{p.currency}</td>
                      <td className="px-4 py-2 text-right text-xs text-gray-300">
                        {fmtNum(p.quantity, p.quantity % 1 === 0 ? 0 : 2)}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-300">
                        {fmtNum(p.avg_purchase_price)} {p.currency}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-white">
                        {p.current_price != null ? `${fmtNum(p.current_price)} ${p.currency}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right"><Pct value={p.daily_change_pct} /></td>
                      <td className="px-4 py-2 text-right text-xs text-white">{fmt(p.current_value_pln)}</td>
                      <td className="px-4 py-2 text-right"><PLNChange value={p.gain_loss_pln} /></td>
                      <td className="px-4 py-2 text-right"><Pct value={p.gain_loss_pct} /></td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => setEditPosition(p)}
                          className="text-gray-500 hover:text-white transition-colors text-xs mr-2"
                        >
                          Edytuj
                        </button>
                        <button
                          onClick={() => setConfirm({ id: p.id, name: `${p.ticker} #${p.id}` })}
                          disabled={deleting === p.id}
                          className="text-gray-600 hover:text-loss transition-colors text-xs"
                        >
                          {deleting === p.id ? '...' : 'Usuń'}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Dla pojedynczej pozycji — przyciski w głównym wierszu */}
                  {!hasMultiple && (
                    <tr key={`actions-${ticker}`} className="hidden">
                      <td colSpan={13}>
                        {/* akcje są w ostatniej kolumnie głównego wiersza */}
                      </td>
                    </tr>
                  )}
                </>
              )
            })}

            {/* Dla pojedynczych pozycji dodaj przyciski Edytuj/Usuń w głównym wierszu */}
            {/* To jest obsługiwane przez nadpisanie ostatniej kolumny wyżej */}
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

      {showAdd && <AddPositionModal onClose={() => { setShowAdd(false); setAddToPosition(null) }} defaultTicker={addToPosition} />}
      {showImport && <ImportXTBModal onClose={() => setShowImport(false)} />}
      {editPosition && (
        <EditPositionModal
          position={editPosition}
          onClose={() => setEditPosition(null)}
          onSave={handleSaveEdit}
        />
      )}
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

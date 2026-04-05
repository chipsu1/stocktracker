import { useState } from 'react'
import { usePortfolioStore } from '../store/portfolioStore'
import AddTransactionModal from '../components/ui/AddTransactionModal'
import ImportXTBModal from '../components/ui/ImportXTBModal'
import ConfirmModal from '../components/ui/ConfirmModal'
import clsx from 'clsx'
import { portfolioService } from '../services/portfolio'

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

const TX_LABELS = {
  buy: 'Zakup',
  sell: 'Sprzedaż',
  dividend: 'Dywidenda',
  split: 'Split',
  deposit: 'Wpłata',
  withdrawal: 'Wypłata',
}

const TX_COLORS = {
  buy: 'text-gain',
  sell: 'text-loss',
  dividend: 'text-blue-400',
  split: 'text-yellow-400',
  deposit: 'text-gain',
  withdrawal: 'text-loss',
}

export default function PositionsPage() {
  const { summary, loading, activePortfolioId, portfolios, fetchSummary } = usePortfolioStore()
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [defaultTicker, setDefaultTicker] = useState('')
  const [expanded, setExpanded] = useState({})
  const [txByTicker, setTxByTicker] = useState({})
  const [loadingTx, setLoadingTx] = useState(false)
  const [txLoaded, setTxLoaded] = useState(false)
  const [confirmTx, setConfirmTx] = useState(null)
  const [deletingTx, setDeletingTx] = useState(null)

  const portfolio = portfolios.find((p) => p.id === activePortfolioId)
  const positions = summary?.positions || []

  async function handleRefresh() {
    if (activePortfolioId) {
      setTxLoaded(false)
      setTxByTicker({})
      await fetchSummary(activePortfolioId)
    }
  }

  async function loadAllTransactions() {
    if (txLoaded) return
    setLoadingTx(true)
    try {
      const all = await portfolioService.getTransactions(activePortfolioId)
      const byTicker = {}
      for (const tx of all) {
        if (!tx.ticker) continue
        if (!byTicker[tx.ticker]) byTicker[tx.ticker] = []
        byTicker[tx.ticker].push(tx)
      }
      setTxByTicker(byTicker)
      setTxLoaded(true)
    } finally {
      setLoadingTx(false)
    }
  }

  function toggleExpand(ticker) {
    const isOpen = expanded[ticker]
    if (!isOpen) loadAllTransactions()
    setExpanded((prev) => ({ ...prev, [ticker]: !isOpen }))
  }

  async function handleDeleteTx(txId) {
    setDeletingTx(txId)
    try {
      await portfolioService.deleteTransaction(txId)
      setTxLoaded(false)
      setTxByTicker({})
      await fetchSummary(activePortfolioId)
    } finally {
      setDeletingTx(null)
      setConfirmTx(null)
    }
  }

  function openAddForTicker(ticker) {
    setDefaultTicker(ticker)
    setShowAdd(true)
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
          <button onClick={() => setShowImport(true)} className="btn-ghost text-sm">
            ↑ Importuj XTB
          </button>
          <button onClick={() => { setDefaultTicker(''); setShowAdd(true) }} className="btn-primary text-sm">
            + Dodaj transakcję
          </button>
        </div>
      </div>

      {/* Saldo gotówkowe */}
      {summary?.cash_pln != null && (
        <div className="mb-4 px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl flex items-center gap-3">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Saldo gotówkowe</span>
          <span className={clsx('font-semibold', summary.cash_pln >= 0 ? 'text-white' : 'text-loss')}>
            {fmt(summary.cash_pln)}
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium w-6"></th>
              <th className="text-left px-4 py-3 font-medium">Ticker</th>
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
            {positions.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-gray-600">
                  Brak pozycji. Dodaj transakcję zakupu lub zaimportuj z XTB.
                </td>
              </tr>
            )}

            {positions.map((p) => {
              const isExpanded = expanded[p.ticker]
              const tickerTx = txByTicker[p.ticker] || []

              return (
                <>
                  {/* Główny wiersz pozycji */}
                  <tr
                    key={`pos-${p.ticker}`}
                    className={clsx(
                      'border-b border-gray-800/50 transition-colors cursor-pointer',
                      isExpanded ? 'bg-gray-800/40' : 'hover:bg-gray-900/50'
                    )}
                    onClick={() => toggleExpand(p.ticker)}
                  >
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {isExpanded ? '▼' : '▶'}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-white">{p.ticker}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{p.asset_class}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{p.currency}</td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {fmtNum(p.quantity, p.quantity % 1 === 0 ? 0 : 4)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {fmtNum(p.avg_purchase_price)} {p.currency}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-medium">
                      {p.current_price != null ? `${fmtNum(p.current_price)} ${p.currency}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right"><Pct value={p.daily_change_pct} /></td>
                    <td className="px-4 py-3 text-right text-white">{fmt(p.current_value_pln)}</td>
                    <td className="px-4 py-3 text-right"><PLNChange value={p.gain_loss_pln} /></td>
                    <td className="px-4 py-3 text-right"><Pct value={p.gain_loss_pct} /></td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openAddForTicker(p.ticker)}
                        className="text-gray-500 hover:text-white transition-colors text-xs"
                      >
                        + Transakcja
                      </button>
                    </td>
                  </tr>

                  {/* Rozwinięte transakcje */}
                  {isExpanded && (
                    <>
                      {loadingTx && (
                        <tr key={`loading-${p.ticker}`}>
                          <td colSpan={12} className="px-8 py-3 text-xs text-gray-500">Ładowanie...</td>
                        </tr>
                      )}
                      {!loadingTx && tickerTx.length === 0 && (
                        <tr key={`empty-${p.ticker}`}>
                          <td colSpan={12} className="px-8 py-3 text-xs text-gray-600">Brak transakcji</td>
                        </tr>
                      )}
                      {tickerTx.map((tx) => (
                        <tr
                          key={`tx-${tx.id}`}
                          className="border-b border-gray-800/20 bg-gray-900/60 hover:bg-gray-900/80 transition-colors"
                        >
                          <td className="px-4 py-2"></td>
                          <td className="px-4 py-2">
                            <span className={clsx('text-xs font-medium', TX_COLORS[tx.transaction_type])}>
                              {TX_LABELS[tx.transaction_type] || tx.transaction_type}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-500" colSpan={2}>
                            {fmtDate(tx.date)}
                          </td>
                          <td className="px-4 py-2 text-right text-xs text-gray-300">
                            {tx.quantity != null ? fmtNum(tx.quantity, tx.quantity % 1 === 0 ? 0 : 4) : '—'}
                          </td>
                          <td className="px-4 py-2 text-right text-xs text-gray-300">
                            {tx.price != null ? `${fmtNum(tx.price)} ${tx.currency}` : '—'}
                          </td>
                          <td className="px-4 py-2 text-right text-xs text-gray-500" colSpan={4}>
                            {tx.notes || ''}
                          </td>
                          <td className="px-4 py-2 text-right" colSpan={2}>
                            <button
                              onClick={() => setConfirmTx({ id: tx.id, label: `${TX_LABELS[tx.transaction_type]} ${p.ticker}` })}
                              disabled={deletingTx === tx.id}
                              className="text-gray-600 hover:text-loss transition-colors text-xs"
                            >
                              {deletingTx === tx.id ? '...' : 'Usuń'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </>
              )
            })}
          </tbody>

          {positions.length > 0 && summary && (
            <tfoot>
              <tr className="border-t border-gray-700 bg-gray-900/80">
                <td colSpan={8} className="px-4 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Łącznie</td>
                <td className="px-4 py-3 text-right text-white font-semibold">{fmt(summary.total_value_pln)}</td>
                <td className="px-4 py-3 text-right"><PLNChange value={summary.total_gain_loss_pln} /></td>
                <td className="px-4 py-3 text-right"><Pct value={summary.total_gain_loss_pct} /></td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showAdd && (
        <AddTransactionModal
          onClose={() => { setShowAdd(false); setDefaultTicker(''); setTxLoaded(false); setTxByTicker({}) }}
          defaultTicker={defaultTicker}
        />
      )}
      {showImport && <ImportXTBModal onClose={() => setShowImport(false)} />}
      {confirmTx && (
        <ConfirmModal
          message={`Usunąć transakcję: ${confirmTx.label}?`}
          onConfirm={() => handleDeleteTx(confirmTx.id)}
          onClose={() => setConfirmTx(null)}
        />
      )}
    </div>
  )
}

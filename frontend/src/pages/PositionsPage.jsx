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
  if (value == null) return <span className="text-gray-400">—</span>
  return (
    <span className={clsx('font-medium', value >= 0 ? 'text-gain' : 'text-loss')}>
      {value >= 0 ? '+' : ''}{value.toFixed(2)}%
    </span>
  )
}

function PLNChange({ value }) {
  if (value == null) return <span className="text-gray-400">—</span>
  return (
    <span className={clsx('text-sm', value >= 0 ? 'text-gain' : 'text-loss')}>
      {value >= 0 ? '+' : ''}{fmt(value)}
    </span>
  )
}

const TX_LABELS = {
  buy: 'Zakup', sell: 'Sprzedaż', dividend: 'Dywidenda',
  split: 'Split', deposit: 'Wpłata', withdrawal: 'Wypłata',
}

const TX_COLORS = {
  buy: 'text-gain', sell: 'text-loss', dividend: 'text-blue-500',
  split: 'text-yellow-500', deposit: 'text-gain', withdrawal: 'text-loss',
}

export default function PositionsPage() {
  const { summary, loading, activePortfolioId, portfolios, fetchSummary } = usePortfolioStore()
  const [showAdd, setShowAdd] = useState(fal

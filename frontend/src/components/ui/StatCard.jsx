import clsx from 'clsx'

export default function StatCard({ label, value, sub, positive, negative }) {
  return (
    <div className="card">
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <p
        className={clsx(
          'text-2xl font-semibold',
          positive && 'text-gain',
          negative && 'text-loss',
          !positive && !negative && 'text-white'
        )}
      >
        {value ?? '—'}
      </p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

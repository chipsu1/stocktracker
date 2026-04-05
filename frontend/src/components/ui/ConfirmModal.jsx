export default function ConfirmModal({ message, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-sm p-6">
        <p className="text-white text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">
            Anuluj
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="flex-1 bg-loss hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Usuń
          </button>
        </div>
      </div>
    </div>
  )
}

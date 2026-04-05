import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const register = useAuthStore((s) => s.register)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(email, username, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Błąd rejestracji')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-white mb-1">Utwórz konto</h1>
        <p className="text-gray-400 text-sm mb-8">Portfolio Tracker</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ty@email.com"
              required
            />
          </div>
          <div>
            <label className="label">Nazwa użytkownika</label>
            <input
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="jankowalski"
              required
            />
          </div>
          <div>
            <label className="label">Hasło</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min. 8 znaków"
              minLength={8}
              required
            />
          </div>

          {error && <p className="text-loss text-sm">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Tworzenie konta...' : 'Zarejestruj się'}
          </button>
        </form>

        <p className="text-sm text-gray-500 mt-6 text-center">
          Masz już konto?{' '}
          <Link to="/login" className="text-brand-500 hover:text-brand-400">
            Zaloguj się
          </Link>
        </p>
      </div>
    </div>
  )
}

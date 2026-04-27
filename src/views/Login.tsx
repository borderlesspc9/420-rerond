import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { isAuthenticated, setSessionToken } from '../auth/session'
import './Login.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as { from?: string } | null)?.from && (location.state as { from: string }).from !== '/login'
      ? (location.state as { from: string }).from
      : '/dashboard'

  useEffect(() => {
    if (isAuthenticated()) {
      navigate(from, { replace: true })
    }
  }, [navigate, from])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Sem endpoint /auth/login no backend: sessão local até integrar auth real.
    setTimeout(() => {
      setSessionToken(crypto.randomUUID())
      setLoading(false)
      navigate(from, { replace: true })
    }, 400)
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="login-title">Login</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

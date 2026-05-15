import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Lock, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { login } from '../services/auth/authService'
import './Login.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as { from?: string } | null)?.from && (location.state as { from: string }).from !== '/login'
      ? (location.state as { from: string }).from
      : '/dashboard'

  useEffect(() => {
    if (!authLoading && user) {
      navigate(from, { replace: true })
    }
  }, [authLoading, user, navigate, from])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível entrar. Tente novamente.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-shell">
        <div className="login-box">
          <div className="login-brand">
            <img src="/logo420.png" alt="Logo Baseinfra" className="login-logo" />
          </div>

          <div className="login-trust-pill" aria-hidden="true">
            <ShieldCheck size={14} />
            <span>Acesso seguro Baseinfra</span>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <div className="input-shell">
                <Mail size={18} className="input-icon" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="password">Senha</label>
              <div className="input-shell">
                <Lock size={18} className="input-icon" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>
            </div>
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="login-button" disabled={loading || authLoading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="login-footnote">
            Plataforma de conformidade para engenharia rodoviária.
          </p>
        </div>
      </div>
    </div>
  )
}

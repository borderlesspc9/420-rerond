import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Mail, ShieldCheck } from 'lucide-react'
import { Button, Container, Input, Typography } from '../components/ui'
import './authScreens.css'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = () => {}
  const handleForgotPassword = () => {}
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleLogin()
  }

  return (
    <div className="ui-auth">
      <div className="ui-auth__panel">
        <Container variant="narrow" pad="none" className="ui-auth__form-wrap">
          <Container variant="card" pad="lg" className="ui-auth__card">
            <div className="ui-auth__brand">
              <img src="/logo420.png" alt="BaseInfra" className="ui-auth__logo" />
              <span className="ui-auth__pill">
                <ShieldCheck size={14} />
                Acesso interno seguro
              </span>
            </div>

            <div className="ui-auth__intro">
              <Typography variant="h2">Entrar</Typography>
              <Typography variant="muted">
                Análise técnica de projetos rodoviários com IA — uso interno BaseInfra.
              </Typography>
            </div>

            <form className="ui-auth__form" onSubmit={handleSubmit} noValidate>
              <Input
                label="E-mail"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="seu@email.com"
                leftIcon={<Mail size={18} />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="Senha"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                leftIcon={<Lock size={18} />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <div className="ui-auth__row">
                <button type="button" className="ui-auth__text-btn" onClick={handleForgotPassword}>
                  Esqueci minha senha
                </button>
              </div>

              <Button type="submit" variant="primary" size="lg" fullWidth>
                Entrar
              </Button>
            </form>

            <div className="ui-auth__footer">
              <Typography variant="caption">Ainda não tem acesso interno?</Typography>
              <Link to="/ui/register" className="ui-auth__outline-link">
                Criar conta
              </Link>
            </div>
          </Container>
        </Container>
      </div>

      <aside className="ui-auth__aside" aria-hidden>
        <div className="ui-auth__aside-content">
          <Typography variant="caption" className="ui-auth__aside-kicker">
            BaseInfra Projetos e Consultoria
          </Typography>
          <Typography variant="h1" className="ui-auth__aside-title">
            Análise técnica com precisão e rastreabilidade
          </Typography>
          <Typography variant="subtitle" className="ui-auth__aside-text">
            Compare formulário, documentos e normas. Revise o parecer e exporte o relatório.
          </Typography>
        </div>
      </aside>
    </div>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Mail, User, Building2 } from 'lucide-react'
import { Button, Container, Input, Typography } from '../components/ui'
import './authScreens.css'

/**
 * Cadastro de usuário interno (analista / operação).
 * Sem Firebase nesta etapa — apenas apresentação.
 */
export default function RegisterScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)

  const handleRegister = () => {
    if (password && confirmPassword && password !== confirmPassword) {
      setFieldError('As senhas não coincidem.')
      return
    }
    setFieldError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleRegister()
  }

  return (
    <div className="ui-auth">
      <div className="ui-auth__panel">
        <Container variant="narrow" pad="none" className="ui-auth__form-wrap">
          <Container variant="card" pad="lg" className="ui-auth__card">
            <div className="ui-auth__brand">
              <img src="/logo420.png" alt="BaseInfra" className="ui-auth__logo" />
            </div>

            <div className="ui-auth__intro">
              <Typography variant="h2">Criar conta</Typography>
              <Typography variant="muted">
                Cadastro para analistas internos. O acesso é restrito à equipe BaseInfra.
              </Typography>
            </div>

            <form className="ui-auth__form" onSubmit={handleSubmit} noValidate>
              <Input
                label="Nome completo"
                name="name"
                autoComplete="name"
                placeholder="Seu nome"
                leftIcon={<User size={18} />}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label="E-mail corporativo"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="voce@empresa.com"
                leftIcon={<Mail size={18} />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="Função (opcional)"
                name="role"
                placeholder="Ex.: Analista técnico"
                leftIcon={<Building2 size={18} />}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                hint="Perfil interno: Analista ou Admin/Operação"
              />
              <Input
                label="Senha"
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                leftIcon={<Lock size={18} />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                label="Confirmar senha"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Repita a senha"
                leftIcon={<Lock size={18} />}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={fieldError}
              />

              <Button type="submit" variant="primary" size="lg" fullWidth>
                Criar conta
              </Button>
            </form>

            <div className="ui-auth__footer">
              <Typography variant="caption">Já possui acesso?</Typography>
              <Link to="/ui/login" className="ui-auth__outline-link">
                Voltar ao login
              </Link>
            </div>
          </Container>
        </Container>
      </div>

      <aside className="ui-auth__aside ui-auth__aside--register" aria-hidden>
        <div className="ui-auth__aside-content">
          <Typography variant="caption" className="ui-auth__aside-kicker">
            Uso interno
          </Typography>
          <Typography variant="h1" className="ui-auth__aside-title">
            Equipe enxuta, fluxo claro
          </Typography>
          <Typography variant="subtitle" className="ui-auth__aside-text">
            Prioridade: qualidade da análise técnica. Cadastro e identidade visual apoiam o
            processo — não o substituem.
          </Typography>
        </div>
      </aside>
    </div>
  )
}

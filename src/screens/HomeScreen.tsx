import {
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Building2,
  Bell,
} from 'lucide-react'
import { Button, Container, Typography } from '../components/ui'
import './HomeScreen.css'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'solicitacoes', label: 'Solicitações', icon: FileText },
  { id: 'nova', label: 'Nova Solicitação', icon: Plus },
  { id: 'concessionarias', label: 'Concessionárias', icon: Building2 },
] as const

/**
 * Home / dashboard estrutural — apenas apresentação (mocks).
 */
export default function HomeScreen() {
  const userName = 'Analista'
  const handleNavigate = () => {}
  const handleLogout = () => {}
  const handleNewSolicitacao = () => {}

  return (
    <div className="ui-home">
      <aside className="ui-home__sidebar">
        <div className="ui-home__brand">
          <img src="/logo420.png" alt="BaseInfra" className="ui-home__logo" />
        </div>
        <nav className="ui-home__nav" aria-label="Principal">
          {NAV_ITEMS.map((item, index) => {
            const Icon = item.icon
            const active = index === 0
            return (
              <button
                key={item.id}
                type="button"
                className={['ui-home__nav-item', active ? 'is-active' : ''].join(' ')}
                onClick={handleNavigate}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="ui-home__sidebar-footer">
          <Button variant="outline" size="sm" fullWidth leftIcon={<LogOut size={16} />} onClick={handleLogout}>
            Sair
          </Button>
        </div>
      </aside>

      <div className="ui-home__main">
        <header className="ui-home__topbar">
          <div className="ui-home__topbar-left">
            <button type="button" className="ui-home__menu-btn" aria-label="Menu" onClick={handleNavigate}>
              <Menu size={22} />
            </button>
            <div>
              <Typography variant="caption">Bem-vindo(a)</Typography>
              <Typography variant="h3">Olá, {userName}</Typography>
            </div>
          </div>
          <div className="ui-home__topbar-actions">
            <button type="button" className="ui-home__icon-btn" aria-label="Notificações" onClick={handleNavigate}>
              <Bell size={18} />
            </button>
            <Button variant="primary" size="sm" leftIcon={<Plus size={16} />} onClick={handleNewSolicitacao}>
              Nova solicitação
            </Button>
          </div>
        </header>

        <Container variant="page" pad="lg" className="ui-home__content">
          <section className="ui-home__hero">
            <Typography variant="h2">Painel de análise</Typography>
            <Typography variant="muted">
              Acompanhe solicitações, revise pareceres da IA e avance o fluxo técnico.
            </Typography>
          </section>

          <section className="ui-home__stats" aria-label="Resumo">
            {['Pendentes', 'Em análise', 'Aprovadas', 'Analisadas por IA'].map((label) => (
              <div key={label} className="ui-home__stat-card">
                <div className="ui-home__skeleton ui-home__skeleton--value" />
                <Typography variant="caption">{label}</Typography>
              </div>
            ))}
          </section>

          <section className="ui-home__panel">
            <div className="ui-home__panel-head">
              <Typography variant="h3">Últimas solicitações</Typography>
              <Button variant="secondary" size="sm" onClick={handleNavigate}>
                Ver todas
              </Button>
            </div>
            <div className="ui-home__list">
              {[1, 2, 3].map((i) => (
                <div key={i} className="ui-home__list-item">
                  <div className="ui-home__list-main">
                    <div className="ui-home__skeleton ui-home__skeleton--title" />
                    <div className="ui-home__skeleton ui-home__skeleton--meta" />
                  </div>
                  <div className="ui-home__skeleton ui-home__skeleton--badge" />
                </div>
              ))}
            </div>
          </section>

          <section className="ui-home__panel">
            <Typography variant="h3">Próximos passos do fluxo</Typography>
            <ul className="ui-home__steps">
              <li>
                <Typography variant="bodyStrong">Cliente persistente</Typography>
                <Typography variant="caption">Reutilizar dados em novas revisões</Typography>
              </li>
              <li>
                <Typography variant="bodyStrong">Processo R00 → R01</Typography>
                <Typography variant="caption">Histórico vinculado ao mesmo atendimento</Typography>
              </li>
              <li>
                <Typography variant="bodyStrong">Análise → revisão → PDF</Typography>
                <Typography variant="caption">IA apoia; analista valida</Typography>
              </li>
            </ul>
          </section>
        </Container>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, Plus, Building2, Users, FolderKanban, Menu, X, LogOut, Layers3, Brain } from 'lucide-react'
import { logout } from '../services/auth/authService'
import './Layout.css'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const isActive = (path: string) => location.pathname === path

  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  return (
    <div className="layout-container">
      {/* Botão hambúrguer - visível apenas no mobile */}
      <button 
        className="mobile-menu-toggle"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Backdrop - visível apenas no mobile quando menu está aberto */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-backdrop"
          onClick={closeMobileMenu}
        />
      )}

      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <img src="/logo420.png" alt="Baseinfra" className="sidebar-logo" />
        </div>
        <nav className="sidebar-nav">
          <Link
            to="/dashboard"
            className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>
          <Link
            to="/solicitacoes"
            className={`nav-item ${isActive('/solicitacoes') ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <FileText size={20} />
            <span>Solicitações</span>
          </Link>
          <Link
            to="/clientes"
            className={`nav-item ${isActive('/clientes') ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <Users size={20} />
            <span>Clientes</span>
          </Link>
          <Link
            to="/processos"
            className={`nav-item ${location.pathname.startsWith('/processos') ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <FolderKanban size={20} />
            <span>Processos</span>
          </Link>
          <Link
            to="/nova-solicitacao"
            className={`nav-item ${isActive('/nova-solicitacao') ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <Plus size={20} />
            <span>Nova Solicitação</span>
          </Link>
          <Link
            to="/ensinar-ia"
            className={`nav-item ${isActive('/ensinar-ia') ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <Brain size={20} />
            <span>Ensinar a IA</span>
          </Link>
          <Link
            to="/configuracoes"
            className={`nav-item ${isActive('/configuracoes') ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <Layers3 size={20} />
            <span>Configurações</span>
          </Link>
          <Link
            to="/concessionarias/nova"
            className={`nav-item ${isActive('/concessionarias/nova') ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <Building2 size={20} />
            <span>Nova Concessionária</span>
          </Link>
          <button type="button" className="nav-item nav-item-button" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}

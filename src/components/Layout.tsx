import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, FileText, Plus, Menu, X } from 'lucide-react'
import './Layout.css'

export default function Layout() {
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
          <h2>Portal de Análise</h2>
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
            to="/nova-solicitacao"
            className={`nav-item ${isActive('/nova-solicitacao') ? 'active' : ''}`}
            onClick={closeMobileMenu}
          >
            <Plus size={20} />
            <span>Nova Solicitação</span>
          </Link>
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import Login from './views/Login'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Dashboard from './views/Dashboard'
import Solicitacoes from './views/Solicitacoes'
import NovaSolicitacao from './views/NovaSolicitacao'
import SolicitacaoRegistrada from './views/SolicitacaoRegistrada'
import NovaConcessionaria from './views/NovaConcessionaria'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="solicitacoes" element={<Solicitacoes />} />
            <Route path="nova-solicitacao" element={<NovaSolicitacao />} />
            <Route path="concessionarias/nova" element={<NovaConcessionaria />} />
            <Route path="solicitacao-registrada" element={<SolicitacaoRegistrada />} />
          </Route>
        </Route>
      </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

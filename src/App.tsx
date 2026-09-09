import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import Login from './views/Login'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Dashboard from './views/Dashboard'
import Solicitacoes from './views/Solicitacoes'
import NovaSolicitacao from './views/NovaSolicitacao'
import EditarSolicitacao from './views/EditarSolicitacao'
import SolicitacaoRegistrada from './views/SolicitacaoRegistrada'
import NovaConcessionaria from './views/NovaConcessionaria'
import Clientes from './views/Clientes'
import Processos from './views/Processos'
import ProcessoDetalhe from './views/ProcessoDetalhe'
import ConfiguracoesModulares from './views/ConfiguracoesModulares'
import EnsinarIA from './views/EnsinarIA'
import { HomeScreen, LoginScreen, RegisterScreen } from './screens'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Preview visual (sem auth / sem Firebase) — inspeção do design system */}
        <Route path="/ui/login" element={<LoginScreen />} />
        <Route path="/ui/register" element={<RegisterScreen />} />
        <Route path="/ui/home" element={<HomeScreen />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="processos" element={<Processos />} />
            <Route path="processos/:processoId" element={<ProcessoDetalhe />} />
            <Route path="solicitacoes" element={<Solicitacoes />} />
            <Route path="nova-solicitacao" element={<NovaSolicitacao />} />
            <Route path="solicitacoes/:id/editar" element={<EditarSolicitacao />} />
            <Route path="configuracoes" element={<ConfiguracoesModulares />} />
            <Route path="ensinar-ia" element={<EnsinarIA />} />
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

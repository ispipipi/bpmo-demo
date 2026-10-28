import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ToastProvider } from './components/feedback'
import { canAccess } from './domain/permissions'
import AlertsPage from './pages/AlertsPage'
import ArcopDetailPage from './pages/ArcopDetailPage'
import ArcopListPage from './pages/ArcopListPage'
import CommitteeActaPage from './pages/CommitteeActaPage'
import CommitteePage from './pages/CommitteePage'
import ConsentsPage from './pages/ConsentsPage'
import RiskPage from './pages/RiskPage'
import DashboardPage from './pages/DashboardPage'
import VendorsPage from './pages/VendorsPage'
import FindingPage from './pages/FindingPage'
import FindingPrintPage from './pages/FindingPrintPage'
import MapaPage from './pages/MapaPage'
import ParamsPage from './pages/ParamsPage'
import MpiPage from './pages/MpiPage'
import RatPage from './pages/RatPage'
import ReportsPage from './pages/ReportsPage'
import RatRequestPage from './pages/RatRequestPage'
import NoPermissions from './pages/NoPermissions'
import { StoreProvider, useStore } from './store/StoreProvider'
import { useLocation } from 'react-router-dom'

function Guard({ children }: { children: ReactNode }) {
  const { state } = useStore()
  const { pathname } = useLocation()
  return canAccess(state.role, pathname) ? <>{children}</> : <NoPermissions />
}

export default function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <ToastProvider>
          <AppShell>
            <Guard>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/mapa" element={<MapaPage />} />
                <Route path="/alertas" element={<AlertsPage />} />
                <Route path="/alertas/parametros" element={<ParamsPage />} />
                <Route path="/arcop" element={<ArcopListPage />} />
                <Route path="/arcop/:id" element={<ArcopDetailPage />} />
                <Route path="/mpi" element={<MpiPage />} />
                <Route path="/mpi/hallazgo/:id" element={<FindingPage />} />
                <Route path="/mpi/hallazgo/:id/acta" element={<FindingPrintPage kind="acta" />} />
                <Route path="/mpi/hallazgo/:id/paquete" element={<FindingPrintPage kind="paquete" />} />
                <Route path="/riesgo" element={<RiskPage />} />
                <Route path="/rat" element={<RatPage />} />
                <Route path="/rat/solicitud/:id" element={<RatRequestPage />} />
                <Route path="/consentimientos" element={<ConsentsPage />} />
                <Route path="/proveedores" element={<VendorsPage />} />
                <Route path="/comites" element={<CommitteePage />} />
                <Route path="/comites/acta/:sessionId" element={<CommitteeActaPage />} />
                <Route path="/reporteria/:n" element={<ReportsPage />} />
                <Route path="/sin-permisos" element={<NoPermissions />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Guard>
          </AppShell>
        </ToastProvider>
      </StoreProvider>
    </HashRouter>
  )
}

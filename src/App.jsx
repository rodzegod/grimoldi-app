import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/Login'

// Vendedor
import MisTareas from './pages/vendedor/MisTareas'
import NuevaIncidencia from './pages/vendedor/NuevaIncidencia'
import MisIncidencias from './pages/vendedor/MisIncidencias'
import MapaLocal from './pages/vendedor/MapaLocal'

// Encargado
import GestionTareas from './pages/encargado/GestionTareas'
import BandejaIncidencias from './pages/encargado/BandejaIncidencias'
import HistorialDia from './pages/encargado/HistorialDia'
import GestionZonas from './pages/encargado/GestionZonas'
import ReporteVentas from './pages/encargado/ReporteVentas'

// Supervisor
import Dashboard from './pages/supervisor/Dashboard'
import Reportes from './pages/supervisor/Reportes'

// Admin
import ImportarCatalogo from './pages/admin/ImportarCatalogo'
import GestionUsuarios from './pages/admin/GestionUsuarios'

function PageWrapper({ children }) {
  return (
    <Layout>
      {children}
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Vendedor */}
          <Route path="/vendedor/tareas" element={
            <ProtectedRoute roles={['vendedor']}>
              <PageWrapper><MisTareas /></PageWrapper>
            </ProtectedRoute>
          } />
          <Route path="/vendedor/incidencias/nueva" element={
            <ProtectedRoute roles={['vendedor']}>
              <PageWrapper><NuevaIncidencia /></PageWrapper>
            </ProtectedRoute>
          } />
          <Route path="/vendedor/incidencias" element={
            <ProtectedRoute roles={['vendedor']}>
              <PageWrapper><MisIncidencias /></PageWrapper>
            </ProtectedRoute>
          } />
          <Route path="/vendedor/mapa" element={
            <ProtectedRoute roles={['vendedor']}>
              <PageWrapper><MapaLocal /></PageWrapper>
            </ProtectedRoute>
          } />

          {/* Encargado */}
          <Route path="/encargado/tareas" element={
            <ProtectedRoute roles={['encargado']}>
              <PageWrapper><GestionTareas /></PageWrapper>
            </ProtectedRoute>
          } />
          <Route path="/encargado/incidencias" element={
            <ProtectedRoute roles={['encargado']}>
              <PageWrapper><BandejaIncidencias /></PageWrapper>
            </ProtectedRoute>
          } />
          <Route path="/encargado/historial" element={
            <ProtectedRoute roles={['encargado']}>
              <PageWrapper><HistorialDia /></PageWrapper>
            </ProtectedRoute>
          } />
          <Route path="/encargado/zonas" element={
            <ProtectedRoute roles={['encargado', 'admin']}>
              <PageWrapper><GestionZonas /></PageWrapper>
            </ProtectedRoute>
          } />
          <Route path="/encargado/ventas" element={
            <ProtectedRoute roles={['encargado', 'admin']}>
              <PageWrapper><ReporteVentas readOnly={false} /></PageWrapper>
            </ProtectedRoute>
          } />

          {/* Supervisor */}
          <Route path="/supervisor/dashboard" element={
            <ProtectedRoute roles={['supervisor']}>
              <PageWrapper><Dashboard /></PageWrapper>
            </ProtectedRoute>
          } />
          <Route path="/supervisor/ventas" element={
            <ProtectedRoute roles={['supervisor']}>
              <PageWrapper><ReporteVentas readOnly={true} /></PageWrapper>
            </ProtectedRoute>
          } />
          <Route path="/supervisor/reportes" element={
            <ProtectedRoute roles={['supervisor']}>
              <PageWrapper><Reportes /></PageWrapper>
            </ProtectedRoute>
          } />

          {/* Admin */}
          <Route path="/admin/catalogo" element={
            <ProtectedRoute roles={['admin']}>
              <PageWrapper><ImportarCatalogo /></PageWrapper>
            </ProtectedRoute>
          } />
          <Route path="/admin/usuarios" element={
            <ProtectedRoute roles={['admin']}>
              <PageWrapper><GestionUsuarios /></PageWrapper>
            </ProtectedRoute>
          } />

          <Route path="/no-autorizado" element={
            <div className="min-h-screen flex items-center justify-center">
              <p className="text-gray-500">No tenés permiso para acceder a esta sección.</p>
            </div>
          } />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

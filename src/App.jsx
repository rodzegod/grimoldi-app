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
import Apertura from './pages/vendedor/Apertura'
import Novedades from './pages/vendedor/Novedades'
import MiHorario from './pages/vendedor/MiHorario'

// Encargado
import GestionTareas from './pages/encargado/GestionTareas'
import BandejaIncidencias from './pages/encargado/BandejaIncidencias'
import HistorialDia from './pages/encargado/HistorialDia'
import GestionZonas from './pages/encargado/GestionZonas'
import ReporteVentas from './pages/encargado/ReporteVentas'
import VistaAperturas from './pages/encargado/VistaAperturas'
import TareasRecurrentes from './pages/encargado/TareasRecurrentes'
import Comunicados from './pages/encargado/Comunicados'
import Horarios from './pages/encargado/Horarios'

// Supervisor
import Dashboard from './pages/supervisor/Dashboard'
import Reportes from './pages/supervisor/Reportes'

// Admin
import ImportarCatalogo from './pages/admin/ImportarCatalogo'
import GestionUsuarios from './pages/admin/GestionUsuarios'
import ControlStock from './pages/admin/ControlStock'

function W({ roles, children }) {
  return (
    <ProtectedRoute roles={roles}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Vendedor */}
          <Route path="/vendedor/tareas"            element={<W roles={['vendedor']}><MisTareas /></W>} />
          <Route path="/vendedor/incidencias/nueva" element={<W roles={['vendedor']}><NuevaIncidencia /></W>} />
          <Route path="/vendedor/incidencias"       element={<W roles={['vendedor']}><MisIncidencias /></W>} />
          <Route path="/vendedor/mapa"              element={<W roles={['vendedor']}><MapaLocal /></W>} />
          <Route path="/encargado/mapa"             element={<W roles={['encargado','admin']}><MapaLocal /></W>} />
          <Route path="/vendedor/apertura"          element={<W roles={['vendedor']}><Apertura /></W>} />
          <Route path="/vendedor/novedades"         element={<W roles={['vendedor']}><Novedades /></W>} />
          <Route path="/vendedor/horario"           element={<W roles={['vendedor']}><MiHorario /></W>} />

          {/* Encargado */}
          <Route path="/encargado/tareas"       element={<W roles={['encargado']}><GestionTareas /></W>} />
          <Route path="/encargado/incidencias"  element={<W roles={['encargado']}><BandejaIncidencias /></W>} />
          <Route path="/encargado/historial"    element={<W roles={['encargado']}><HistorialDia /></W>} />
          <Route path="/encargado/zonas"        element={<W roles={['encargado','admin']}><GestionZonas /></W>} />
          <Route path="/encargado/ventas"       element={<W roles={['encargado','admin']}><ReporteVentas readOnly={false} /></W>} />
          <Route path="/encargado/aperturas"    element={<W roles={['encargado']}><VistaAperturas /></W>} />
          <Route path="/encargado/recurrentes"  element={<W roles={['encargado']}><TareasRecurrentes /></W>} />
          <Route path="/encargado/comunicados"  element={<W roles={['encargado','admin']}><Comunicados /></W>} />
          <Route path="/encargado/horarios"     element={<W roles={['encargado','admin']}><Horarios /></W>} />

          {/* Supervisor */}
          <Route path="/supervisor/dashboard"     element={<W roles={['supervisor']}><Dashboard /></W>} />
          <Route path="/supervisor/ventas"        element={<W roles={['supervisor']}><ReporteVentas readOnly={true} /></W>} />
          <Route path="/supervisor/reportes"      element={<W roles={['supervisor']}><Reportes /></W>} />
          <Route path="/supervisor/incidencias"   element={<W roles={['supervisor']}><BandejaIncidencias readOnly={true} /></W>} />

          {/* Admin */}
          <Route path="/admin/catalogo"  element={<W roles={['admin']}><ImportarCatalogo /></W>} />
          <Route path="/admin/usuarios"  element={<W roles={['admin']}><GestionUsuarios /></W>} />
          <Route path="/encargado/stock"  element={<W roles={['encargado','admin','supervisor']}><ControlStock /></W>} />

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

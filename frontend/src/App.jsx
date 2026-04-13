import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { TeamProvider } from './context/TeamContext'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Activity from './pages/Activity'
import Analytics from './pages/Analytics'
import Team from './pages/Team'

// AI Agent pages
import AgentsHub       from './pages/AgentsHub'
import AnalystAgent    from './pages/AnalystAgent'
import SQLAgent        from './pages/SQLAgent'
import ForecastAgent   from './pages/ForecastAgent'
import AnomalyAgent    from './pages/AnomalyAgent'
import Monitor         from './pages/Monitor'
import ErrorBoundary   from './components/ErrorBoundary'

function PrivateLayout() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  )
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TeamProvider>
          <Routes>
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<PrivateLayout />}>
              <Route path="/dashboard"       element={<Dashboard />} />
              <Route path="/projects"        element={<Projects />} />
              <Route path="/activity"        element={<Activity />} />
              <Route path="/analytics"       element={<Analytics />} />
              <Route path="/team"            element={<Team />} />
              {/* Agent routes */}
              <Route path="/agents"          element={<ErrorBoundary><AgentsHub /></ErrorBoundary>} />
              <Route path="/agents/analyst"  element={<ErrorBoundary><AnalystAgent /></ErrorBoundary>} />
              <Route path="/agents/sql"      element={<ErrorBoundary><SQLAgent /></ErrorBoundary>} />
              <Route path="/agents/forecast" element={<ErrorBoundary><ForecastAgent /></ErrorBoundary>} />
              <Route path="/agents/anomaly"  element={<ErrorBoundary><AnomalyAgent /></ErrorBoundary>} />
              <Route path="/monitor"         element={<ErrorBoundary><Monitor /></ErrorBoundary>} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </TeamProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

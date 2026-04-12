import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import OverallDashboardPage from './pages/OverallDashboardPage'
import PositionsPage from './pages/PositionsPage'

function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard/overall" replace />} />
          <Route path="dashboard/overall" element={<OverallDashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="positions" element={<PositionsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

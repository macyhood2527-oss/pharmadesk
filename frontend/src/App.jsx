import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import POS from './pages/POS.jsx'
import Products from './pages/Products.jsx'
import Sales from './pages/Sales.jsx'
import Batches from './pages/Batches.jsx'
import Suppliers from './pages/Suppliers.jsx'
import Reports from './pages/Reports.jsx'
import Users from './pages/Users.jsx'
import StockHistory from './pages/StockHistory.jsx'
import Receiving from './pages/Receiving.jsx'
import Settings from './pages/Settings.jsx'
import Manual from './pages/Manual.jsx'

const PlaceholderPage = ({ title, description }) => (
  <div className="card p-12 text-center">
    <h1 className="mb-4 text-3xl font-bold text-gray-900">{title}</h1>
    <p className="text-gray-600">{description}</p>
  </div>
)

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pos" element={<POS />} />

                <Route path="/products" element={<ProtectedRoute roles={['admin']}><Products /></ProtectedRoute>} />
                <Route path="/receiving" element={<ProtectedRoute roles={['admin']}><Receiving /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute roles={['admin']}><Reports /></ProtectedRoute>} />
                <Route path="/stock-history" element={<ProtectedRoute roles={['admin']}><StockHistory /></ProtectedRoute>} />
                <Route path="/batches" element={<ProtectedRoute roles={['admin']}><Batches /></ProtectedRoute>} />
                <Route path="/sales" element={<ProtectedRoute roles={['admin']}><Sales /></ProtectedRoute>} />
                <Route path="/suppliers" element={<ProtectedRoute roles={['admin']}><Suppliers /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute roles={['admin']}><Users /></ProtectedRoute>} />
                <Route path="/manual" element={<Manual />} />
                <Route path="/settings" element={<ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App

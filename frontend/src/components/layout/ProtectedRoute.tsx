import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false 
}) => {
  const { isAuthenticated, role } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute

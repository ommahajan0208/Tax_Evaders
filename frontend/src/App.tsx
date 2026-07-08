import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ThemeProvider } from './contexts/ThemeContext'
import { UploadProvider } from './contexts/UploadContext'
import { ChatProvider } from './contexts/ChatContext'

import ProtectedRoute from './components/layout/ProtectedRoute'
import SidebarLayout from './components/layout/SidebarLayout'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ChatPage from './pages/ChatPage'
import UploadPage from './pages/UploadPage'
import AdminPage from './pages/AdminPage'

// Setup React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <UploadProvider>
          <ChatProvider>
            <BrowserRouter>
              <Routes>
                {/* Public Auth Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Private Authenticated Routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <SidebarLayout>
                        <DashboardPage />
                      </SidebarLayout>
                    </ProtectedRoute>
                  }
                />
                
                <Route
                  path="/chat"
                  element={
                    <ProtectedRoute>
                      <SidebarLayout>
                        <ChatPage />
                      </SidebarLayout>
                    </ProtectedRoute>
                  }
                />
                
                <Route
                  path="/upload"
                  element={
                    <ProtectedRoute>
                      <SidebarLayout>
                        <UploadPage />
                      </SidebarLayout>
                    </ProtectedRoute>
                  }
                />
                
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireAdmin={true}>
                      <SidebarLayout>
                        <AdminPage />
                      </SidebarLayout>
                    </ProtectedRoute>
                  }
                />

                {/* Default Fallbacks */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </ChatProvider>
        </UploadProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App

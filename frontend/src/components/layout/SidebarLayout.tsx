import React, { useEffect, useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutGrid, MessageSquare, UploadCloud, ShieldCheck, LogOut,
  ShieldAlert, Sparkles, Sun, Moon, FileSearch, ClipboardCheck,
  BarChart2, FileText, Bell, Lock, Settings
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useTheme } from '../../contexts/ThemeContext'
import api from '../../utils/api'

export const SidebarLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { username, role, clearAuth } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await api.get<{ unread_count: number }>('/notifications/unread-count')
        setUnreadCount(res.data.unread_count)
      } catch {}
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const navGroups = [
    {
      label: 'Core',
      items: [
        { to: '/dashboard', label: 'Compliance Dashboard', icon: LayoutGrid },
        { to: '/chat', label: 'RAG Regulatory Chat', icon: MessageSquare },
        { to: '/upload', label: 'Document Control', icon: UploadCloud },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { to: '/circulars', label: 'Circulars & Obligations', icon: FileSearch },
        { to: '/checklists', label: 'Checklist Generator', icon: ClipboardCheck },
        { to: '/risk', label: 'Risk Dashboard', icon: BarChart2 },
        { to: '/reports', label: 'Reports', icon: FileText },
        { to: '/audit', label: 'Audit Ledger', icon: Lock },
      ],
    },
    {
      label: 'System',
      items: [
        { to: '/settings', label: 'Settings', icon: Settings },
      ]
    },
    ...(role === 'admin'
      ? [{ label: 'Admin', items: [{ to: '/admin', label: 'Admin Console', icon: ShieldCheck }] }]
      : []),
  ]

  const getPageTitle = () => {
    const map: Record<string, string> = {
      '/dashboard':    'Compliance Control Room',
      '/chat':         'Regulatory RAG Workspace',
      '/upload':       'Document Management Hub',
      '/admin':        'System Performance & Admin Controls',
      '/circulars':    'Regulatory Circulars & Obligations',
      '/checklists':   'Compliance Checklist Generator',
      '/risk':         'Risk Assessment Dashboard',
      '/reports':      'Compliance Reports',
      '/notifications':'Notifications Center',
      '/audit':        'Immutable Audit Ledger',
      '/settings':     'System Settings',
    }
    return map[location.pathname] || 'SEBI Agentic Compliance OS'
  }

  return (
    <div className="flex h-screen bg-[#070a13] text-[#f8fafc] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-[#0d1222] border-r border-slate-800 flex flex-col justify-between shrink-0 glassmorphism">
        <div className="flex-1 overflow-y-auto">
          {/* Logo */}
          <div className="p-6 flex items-center space-x-3 border-b border-slate-800/80">
            <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                SEBI AI Agent
              </h1>
              <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest flex items-center gap-1 mt-0.5">
                <Sparkles className="w-2.5 h-2.5 animate-pulse" /> Compliance OS
              </span>
            </div>
          </div>

          {/* Nav Groups */}
          <nav className="p-3 space-y-5 mt-2">
            {navGroups.map(group => (
              <div key={group.label}>
                <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-600 px-3 mb-2">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        id={`nav-${item.to.replace('/', '')}`}
                        className={({ isActive }) =>
                          `flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative
                          ${isActive
                            ? 'bg-blue-600/15 text-blue-400 border-l-4 border-blue-500 shadow-[inset_0_0_12px_rgba(37,99,235,0.08)]'
                            : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                          }`
                        }
                      >
                        <Icon className="w-4.5 h-4.5 shrink-0 group-hover:scale-105 transition-transform" />
                        <span className="flex-1">{item.label}</span>
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Notifications — special item with unread badge */}
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-slate-600 px-3 mb-2">
                Alerts
              </p>
              <NavLink
                to="/notifications"
                id="nav-notifications"
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative
                  ${isActive
                    ? 'bg-blue-600/15 text-blue-400 border-l-4 border-blue-500 shadow-[inset_0_0_12px_rgba(37,99,235,0.08)]'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`
                }
              >
                <Bell className="w-4.5 h-4.5 shrink-0 group-hover:scale-105 transition-transform" />
                <span className="flex-1">Notifications</span>
                {unreadCount > 0 && (
                  <span className="bg-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </NavLink>
            </div>
          </nav>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 space-y-3 shrink-0">
          <div className="flex items-center justify-between p-2.5 bg-slate-900/50 rounded-xl border border-slate-800/40">
            <span className="text-xs text-slate-400 font-medium pl-1.5">Theme</span>
            <div className="flex space-x-1">
              <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded-lg transition ${theme === 'light' ? 'bg-slate-700 text-amber-400 shadow' : 'text-slate-400 hover:text-slate-300'}`}
              >
                <Sun className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded-lg transition ${theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow' : 'text-slate-400 hover:text-slate-300'}`}
              >
                <Moon className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-md uppercase text-sm">
                {username?.slice(0, 2) || 'US'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-200 truncate">{username}</p>
                <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5 border ${
                  role === 'admin'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {role === 'admin' ? 'Admin' : 'Compliance Officer'}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              id="logout-btn"
              className="p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-400 rounded-xl transition"
              title="Logout"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Frame */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#070b16]">
        <header className="h-16 border-b border-slate-800 px-8 flex items-center justify-between bg-[#0d1222]/30 backdrop-blur-md z-10 shrink-0">
          <h2 className="text-xl font-bold tracking-tight text-white">{getPageTitle()}</h2>
          <div className="flex items-center gap-4">
            <NavLink to="/notifications" className="relative p-2 text-slate-400 hover:text-slate-200 transition">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[8px] font-extrabold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </NavLink>
            <div className="text-xs text-slate-400 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-medium text-slate-300">Compliance Agent Online</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8 relative">
          {children}
        </main>
      </div>
    </div>
  )
}

export default SidebarLayout

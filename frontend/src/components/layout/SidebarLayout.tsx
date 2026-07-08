import React from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { 
  LayoutGrid, 
  MessageSquare, 
  UploadCloud, 
  ShieldCheck, 
  LogOut, 
  ShieldAlert,
  Sparkles,
  Sun,
  Moon
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useTheme } from '../../contexts/ThemeContext'

export const SidebarLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { username, role, clearAuth } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  
  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  const navItems = [
    { to: '/dashboard', label: 'Compliance Dashboard', icon: LayoutGrid },
    { to: '/chat', label: 'RAG Regulatory Chat', icon: MessageSquare },
    { to: '/upload', label: 'Document Control', icon: UploadCloud },
  ]

  if (role === 'admin') {
    navItems.push({ to: '/admin', label: 'Admin Console', icon: ShieldCheck })
  }

  // Get active page title
  const getPageTitle = () => {
    switch(location.pathname) {
      case '/dashboard': return 'Compliance Control Room'
      case '/chat': return 'Regulatory RAG Workspace'
      case '/upload': return 'Document Management Hub'
      case '/admin': return 'System Performance & Admin Controls'
      default: return 'SEBI AI Assistant'
    }
  }

  return (
    <div className="flex h-screen bg-[#070a13] text-[#f8fafc] overflow-hidden">
      {/* Sidebar Panel */}
      <aside className="w-72 bg-[#0d1222] border-r border-slate-800 flex flex-col justify-between shrink-0 glassmorphism">
        <div>
          {/* Logo Brand Header */}
          <div className="p-6 flex items-center space-x-3 border-b border-slate-850">
            <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                SEBI AI Agent
              </h1>
              <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest flex items-center gap-1 mt-0.5">
                <Sparkles className="w-2.5 h-2.5 animate-pulse-glow" /> Compliance Engine
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5 mt-4">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `
                    flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-250 group
                    ${isActive 
                      ? 'bg-blue-600/15 text-blue-400 border-l-4 border-blue-500 shadow-[inset_0_0_12px_rgba(37,99,235,0.08)]' 
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 group-hover:scale-105 transition-transform" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* Footer Actions & Profile */}
        <div className="p-4 border-t border-slate-800 space-y-4">
          {/* Theme toggler */}
          <div className="flex items-center justify-between p-2.5 bg-slate-900/50 rounded-xl border border-slate-800/40">
            <span className="text-xs text-slate-400 font-medium pl-1.5">Theme System</span>
            <div className="flex space-x-1">
              <button 
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded-lg transition ${theme === 'light' ? 'bg-slate-700 text-amber-400 shadow' : 'text-slate-400 hover:text-slate-300'}`}
                title="Light Mode"
              >
                <Sun className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded-lg transition ${theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow' : 'text-slate-400 hover:text-slate-300'}`}
                title="Dark Mode"
              >
                <Moon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* User profile details */}
          <div className="flex items-center justify-between p-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-md uppercase">
                {username?.slice(0, 2) || 'US'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-200 truncate">{username}</p>
                <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5 border ${
                  role === 'admin' 
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {role === 'admin' ? 'Admin' : 'Intermediary'}
                </span>
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-400 rounded-xl transition duration-200"
              title="Logout session"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#070b16]">
        {/* Workspace Top Header */}
        <header className="h-16 border-b border-slate-850 px-8 flex items-center justify-between bg-[#0d1222]/30 backdrop-blur-md z-10 shrink-0">
          <h2 className="text-xl font-bold tracking-tight text-white">{getPageTitle()}</h2>
          <div className="text-xs text-slate-400 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="font-medium text-slate-300">Compliance Agent Online</span>
          </div>
        </header>

        {/* Content Page Area */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          {children}
        </main>
      </div>
    </div>
  )
}

export default SidebarLayout;

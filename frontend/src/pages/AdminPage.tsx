import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Database, 
  HelpCircle, 
  Activity, 
  ShieldAlert, 
  Loader2, 
  RefreshCw,
  Sparkles,
  ArrowUpCircle,
  ArrowDownCircle
} from 'lucide-react'
import api from '../utils/api'

interface UserItem {
  id: number
  username: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

interface Stats {
  total_documents: number
  total_chunks: number
  total_users: number
  total_queries: number
  faiss_health: string
  last_rebuild?: string
}

export const AdminPage: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRebuilding, setIsRebuilding] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const fetchAdminData = async () => {
    setIsLoading(true)
    try {
      const usersRes = await api.get<UserItem[]>('/admin/users')
      setUsers(usersRes.data)
      
      const statsRes = await api.get<Stats>('/admin/stats')
      setStats(statsRes.data)
    } catch (e) {
      console.error("Error fetching admin metrics:", e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAdminData()
  }, [])

  const handleToggleRole = async (userId: number, currentRole: string) => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin'
    setActionMessage(null)
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: nextRole })
      setActionMessage(`Successfully updated role of user ID ${userId} to '${nextRole}'.`)
      await fetchAdminData()
    } catch (e: any) {
      setActionMessage(`Error changing role: ${e.response?.data?.detail || e.message}`)
    }
  }

  const handleRebuildIndex = async () => {
    setIsRebuilding(true)
    setActionMessage(null)
    try {
      const res = await api.post('/admin/reindex')
      setActionMessage(res.data.detail || "FAISS Vector Index rebuilt successfully.")
      await fetchAdminData()
    } catch (e: any) {
      setActionMessage(`Rebuilding failed: ${e.response?.data?.detail || e.message}`)
    } finally {
      setIsRebuilding(false)
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* Action alerts overlay */}
      {actionMessage && (
        <div className="p-4 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-2xl text-xs font-semibold">
          {actionMessage}
        </div>
      )}

      {/* 1. Diagnostics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glassmorphism rounded-2xl p-5 border border-slate-800">
            <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Platform Users</span>
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-3xl font-extrabold text-white mt-3">{stats.total_users}</p>
          </div>
          <div className="glassmorphism rounded-2xl p-5 border border-slate-800">
            <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Vector Chunks</span>
              <Database className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="text-3xl font-extrabold text-indigo-400 mt-3">{stats.total_chunks}</p>
          </div>
          <div className="glassmorphism rounded-2xl p-5 border border-slate-800">
            <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>Total RAG Queries</span>
              <HelpCircle className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-3xl font-extrabold text-purple-400 mt-3">{stats.total_queries}</p>
          </div>
          <div className="glassmorphism rounded-2xl p-5 border border-slate-800">
            <div className="flex justify-between items-center text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <span>FAISS Index status</span>
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-400 mt-3.5 tracking-tight">{stats.faiss_health}</p>
          </div>
        </div>
      )}

      {/* 2. Admin Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Users Administration Table */}
        <div className="lg:col-span-2 glassmorphism rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
          <div className="p-6 border-b border-slate-850">
            <h3 className="font-bold text-lg text-slate-200">Registered Platform Users</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/40 text-slate-400 font-bold uppercase text-[9px] tracking-wider border-b border-slate-850">
                  <th className="px-5 py-3">User details</th>
                  <th className="px-5 py-3">Access Level</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created Date</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60 text-xs text-slate-300">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-900/10 transition">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-bold text-slate-200">{u.username}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{u.email}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-bold uppercase">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] border ${
                        u.role === 'admin' 
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/25' 
                          : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-slate-650'}`}></span>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {u.username !== 'admin' && (
                        <button
                          onClick={() => handleToggleRole(u.id, u.role)}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition duration-200"
                          title={u.role === 'admin' ? "Demote to Intermediary" : "Promote to Admin"}
                        >
                          {u.role === 'admin' ? (
                            <ArrowDownCircle className="w-4.5 h-4.5 text-rose-400" />
                          ) : (
                            <ArrowUpCircle className="w-4.5 h-4.5 text-indigo-400" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Index Rebuild Controls */}
        <div className="glassmorphism rounded-3xl p-6 border border-slate-800 flex flex-col justify-between shadow-xl">
          <div>
            <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 animate-pulse-glow" /> Ingestion controls
            </span>
            <h3 className="text-xl font-bold text-slate-100">Vector Index Control Panel</h3>
            <p className="text-xs text-slate-400 mt-3 leading-relaxed">
              If the local FAISS vectors become out of sync or search relevance degrades, you can trigger a full index rebuild.
            </p>
            <div className="mt-4 p-4 bg-slate-950/40 border border-slate-850 rounded-2xl text-xs space-y-2 text-slate-400">
              <div className="flex justify-between">
                <span>Vector Dimension:</span>
                <span className="font-mono font-bold text-slate-200">384 (all-MiniLM-L6-v2)</span>
              </div>
              <div className="flex justify-between">
                <span>Last Rebuilt:</span>
                <span className="font-mono text-slate-300 font-semibold">{stats?.last_rebuild || 'N/A'}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-8 space-y-3">
            <button
              onClick={handleRebuildIndex}
              disabled={isRebuilding || isLoading}
              className="w-full py-3 bg-gradient-to-r from-indigo-650 to-blue-600 hover:from-indigo-600 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-650/15 disabled:opacity-50"
            >
              {isRebuilding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Rebuilding vector matrix...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" /> Force Full Vector Reindex
                </>
              )}
            </button>
            <p className="text-[10px] text-slate-500 text-center leading-relaxed">
              *Warning: This reads all physical PDFs from backend upload folder and recreates the FAISS index database file.
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}

export default AdminPage

import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ShieldAlert, KeyRound, Mail, UserPlus, Sparkles, Loader } from 'lucide-react'
import api from '../utils/api'

export const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsLoading(true)
    
    try {
      await api.post('/auth/register', { username, email, password })
      setSuccess('Registration successful! Redirecting to login...')
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        'Could not register. Username or email may already be taken.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070b16] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(37,99,235,0.15),rgba(255,255,255,0))] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        
        {/* Logo Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl shadow-xl shadow-blue-500/25 mb-4">
            <ShieldAlert className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white font-sans">
            SEBI Compliance AI
          </h2>
          <p className="text-slate-400 text-sm mt-2 flex items-center justify-center gap-1">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse-glow" /> 
            Agentic Regulatory & RAG Assistant
          </p>
        </div>

        {/* Form Card */}
        <div className="glassmorphism rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500/0 via-blue-500 to-blue-500/0"></div>
          
          <h3 className="text-xl font-bold text-slate-100 mb-6">Register Intermediary</h3>
          
          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-medium">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <UserPlus className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="stockbroker_alpha"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition duration-200 text-sm"
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="compliance@brokeralpha.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition duration-200 text-sm"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition duration-200 text-sm"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition duration-250 flex items-center justify-center space-x-2 text-sm shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 disabled:opacity-75"
            >
              {isLoading ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <span>Register Account</span>
              )}
            </button>
          </form>
        </div>

        {/* Footer links */}
        <p className="text-center text-slate-400 text-xs mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-400 font-bold hover:underline">
            Sign In Portal
          </Link>
        </p>
      </div>
    </div>
  )
}

export default RegisterPage

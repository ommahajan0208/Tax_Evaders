import React, { useState, useEffect } from 'react'
import { Bell, CheckCheck, AlertTriangle, FileSearch, Shield, Clock, Info, Sparkles } from 'lucide-react'
import api from '../utils/api'

interface Notification {
  id: number
  type: string
  title: string
  body: string | null
  payload: string | null
  read_at: string | null
  created_at: string
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  new_circular: {
    icon: <FileSearch className="w-4 h-4" />,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  change_detected: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  risk_escalation: {
    icon: <Shield className="w-4 h-4" />,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
  },
  review_request: {
    icon: <Sparkles className="w-4 h-4" />,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/20',
  },
  deadline_reminder: {
    icon: <Clock className="w-4 h-4" />,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20',
  },
}

const getTypeConfig = (type: string) =>
  TYPE_CONFIG[type] || {
    icon: <Info className="w-4 h-4" />,
    color: 'text-slate-400',
    bg: 'bg-slate-800 border-slate-700',
  }

// Group notifications by type category
const GROUP_LABELS: Record<string, string> = {
  risk_escalation: '🔴 Risk Escalations',
  change_detected: '⚠️ Change Alerts',
  new_circular: '📄 New Circulars',
  review_request: '✨ Review Requests',
  deadline_reminder: '⏰ Deadline Reminders',
}

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [isMarkingAll, setIsMarkingAll] = useState(false)

  useEffect(() => {
    fetchNotifications()
    fetchUnreadCount()
  }, [showUnreadOnly])

  const fetchNotifications = async () => {
    try {
      const params = showUnreadOnly ? '?unread_only=true' : ''
      const res = await api.get<Notification[]>(`/notifications/${params}`)
      setNotifications(res.data)
    } catch {}
  }

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get<{ unread_count: number }>('/notifications/unread-count')
      setUnreadCount(res.data.unread_count)
    } catch {}
  }

  const handleMarkRead = async (id: number) => {
    try {
      await api.post(`/notifications/${id}/read`)
      await fetchNotifications()
      await fetchUnreadCount()
    } catch {}
  }

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true)
    try {
      await api.post('/notifications/read-all')
      await fetchNotifications()
      await fetchUnreadCount()
    } catch {}
    setIsMarkingAll(false)
  }

  // Group by type
  const grouped = notifications.reduce((acc, n) => {
    const key = n.type
    if (!acc[key]) acc[key] = []
    acc[key].push(n)
    return acc
  }, {} as Record<string, Notification[]>)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-100 flex items-center gap-3">
            <Bell className="w-7 h-7 text-indigo-400" />
            Notifications
            {unreadCount > 0 && (
              <span className="bg-rose-500 text-white text-xs font-extrabold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-400 mt-1">Change alerts, risk escalations, and review requests</p>
        </div>
        <div className="flex gap-2">
          <button
            id="toggle-unread-btn"
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition ${
              showUnreadOnly
                ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
            }`}
          >
            Unread only
          </button>
          {unreadCount > 0 && (
            <button
              id="mark-all-read-btn"
              onClick={handleMarkAllRead}
              disabled={isMarkingAll}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="glassmorphism rounded-3xl p-16 text-center border border-slate-800">
          <Bell className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 font-semibold">You're all caught up!</p>
          <p className="text-xs text-slate-500 mt-1">No new notifications at this time.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([type, notifs]) => (
          <div key={type} className="space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              {GROUP_LABELS[type] || type}
            </h3>
            <div className="space-y-2">
              {notifs.map(n => {
                const tc = getTypeConfig(n.type)
                const isUnread = !n.read_at
                return (
                  <div
                    key={n.id}
                    id={`notification-${n.id}`}
                    className={`glassmorphism rounded-2xl border transition p-4 ${
                      isUnread ? 'border-slate-700 bg-slate-800/10' : 'border-slate-800/60 opacity-70'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl border shrink-0 ${tc.bg} ${tc.color}`}>
                        {tc.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-bold ${isUnread ? 'text-slate-100' : 'text-slate-400'}`}>
                            {n.title}
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(n.created_at).toLocaleString('en-IN', {
                                month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                            {isUnread && (
                              <button
                                id={`mark-read-${n.id}`}
                                onClick={() => handleMarkRead(n.id)}
                                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold transition"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>
                        {n.body && (
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-3">{n.body}</p>
                        )}
                      </div>
                    </div>
                    {isUnread && (
                      <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-400" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default NotificationsPage

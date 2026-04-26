'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Bell, X, Trophy, Clock, Zap, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { notificationApi, AppNotification } from '@/services/notification.service'
import './NotificationBell.css'

function NotificationIcon({ type }: { type: AppNotification['type'] }) {
  if (type === 'ACHIEVEMENT') return <Trophy size={14} />
  if (type === 'REMINDER')    return <Clock size={14} />
  return <Zap size={14} />
}

function typeClass(type: AppNotification['type']): string {
  if (type === 'ACHIEVEMENT') return 'nb-item--achievement'
  if (type === 'REMINDER')    return 'nb-item--reminder'
  return 'nb-item--motivation'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const router = useRouter()

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationApi.getNotifications,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000, // poll every 2 min, aligned with staleTime
  })

  const { mutate: markAllRead } = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Close panel when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const unreadCount = data?.unreadCount ?? 0
  const notifications = data?.notifications ?? []

  function handleOpen() {
    setOpen((o) => !o)
    if (!open && unreadCount > 0) markAllRead()
  }

  function handleNotificationClick(n: AppNotification) {
    if (!n.href) return
    setOpen(false)
    router.push(n.href)
  }

  return (
    <div className="nb-root" ref={panelRef}>
      <button className="nb-bell-btn" onClick={handleOpen} aria-label="Notifications">
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="nb-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="nb-panel"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
          >
            <div className="nb-panel-header">
              <span className="nb-panel-title">Notifications</span>
              <button className="nb-close-btn" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="nb-list">
              {notifications.length === 0 ? (
                <div className="nb-empty">
                  <Bell size={28} strokeWidth={1.2} />
                  <p>You're all caught up!</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`nb-item ${typeClass(n.type)} ${n.isRead ? 'nb-item--read' : ''} ${n.href ? 'nb-item--clickable' : ''}`}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="nb-item-icon">
                      <NotificationIcon type={n.type} />
                    </div>
                    <div className="nb-item-body">
                      <p className="nb-item-title">{n.title}</p>
                      <p className="nb-item-msg">{n.message}</p>
                      <span className="nb-item-time">{timeAgo(n.createdAt)}</span>
                    </div>
                    {n.href && <ChevronRight size={14} className="nb-item-arrow" />}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

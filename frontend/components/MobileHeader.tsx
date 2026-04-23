'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MoreHorizontal, User, TrendingUp, LogOut } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { authApi } from '@/services/auth.service'
import { profileApi } from '@/services/profile.service'
import NotificationBell from './NotificationBell'

export default function MobileHeader() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: profileApi.getProfile,
    staleTime: 5 * 60 * 1000,
  })

  // Close on outside tap
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleLogout = async () => {
    setOpen(false)
    await authApi.logout()
    logout()
    router.push('/login')
  }

  const firstName = user?.name?.split(' ')[0] ?? ''

  return (
    <header className="mobile-header">
      {/* ── Left: logo + name ── */}
      <Link href="/dashboard" className="mobile-header-brand">
        <Image
          src="/images/appIcon.png"
          alt="What to Cook?"
          width={30}
          height={30}
          style={{ objectFit: 'contain' }}
        />
        <span className="mobile-header-appname">What to Cook?</span>
      </Link>

      {/* ── Right: bell + avatar + menu ── */}
      <div className="mobile-header-right" ref={menuRef}>
        <NotificationBell />
        <button
          className="mobile-header-user"
          onClick={() => setOpen((v) => !v)}
          aria-label="Open user menu"
        >
          <div className="mobile-header-avatar">
            {profile?.avatarUrl
              ? <img src={profile.avatarUrl} alt={user?.name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : <span>{user?.name?.charAt(0).toUpperCase() ?? 'U'}</span>
            }
          </div>
          <span className="mobile-header-name">{firstName}</span>
          <MoreHorizontal size={16} className="mobile-header-dots" />
        </button>

        {/* ── Dropdown ── */}
        <AnimatePresence>
          {open && (
            <motion.div
              className="mobile-header-dropdown"
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            >
              <Link href="/profile" className="mh-drop-item" onClick={() => setOpen(false)}>
                <User size={15} />
                Profile
              </Link>
              <Link href="/progress" className="mh-drop-item" onClick={() => setOpen(false)}>
                <TrendingUp size={15} />
                Progress
              </Link>
              <div className="mh-drop-divider" />
              <button className="mh-drop-item mh-drop-item--danger" onClick={handleLogout}>
                <LogOut size={15} />
                Sign out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import {
  LayoutDashboard, UtensilsCrossed, Calendar,
  ShoppingCart, Apple, TrendingUp, User,
  LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { authApi } from '@/services/auth.service'

const NAV_ITEMS = [
  { href: '/dashboard',      label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/recipes',        label: 'Recipes',      icon: UtensilsCrossed },
  { href: '/weekly-planner', label: 'Meal Planner', icon: Calendar },
  { href: '/groceries',      label: 'Groceries',    icon: ShoppingCart },
  { href: '/pantry',         label: 'Pantry',       icon: Apple },
  { href: '/progress',       label: 'Progress',     icon: TrendingUp },
  { href: '/profile',        label: 'Profile',      icon: User },
]

const COLLAPSED_KEY = 'sidebar-collapsed'

function getSidebarGreeting() {
  const h = new Date().getHours()
  if (h < 5)  return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getSidebarDate() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(COLLAPSED_KEY) === 'true'
  })
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const logoutRef = useRef<HTMLDivElement>(null)

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed))
  }, [collapsed])

  // Close logout popover on outside click
  useEffect(() => {
    if (!showLogoutConfirm) return
    const handler = (e: MouseEvent) => {
      if (logoutRef.current && !logoutRef.current.contains(e.target as Node)) {
        setShowLogoutConfirm(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showLogoutConfirm])

  const handleLogout = async () => {
    await authApi.logout()
    logout()
    router.push('/login')
  }

  return (
    <motion.aside
      className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}
      animate={{ width: collapsed ? 64 : 232 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* ── Logo ── */}
      <div className="sidebar-logo">
        <div className="logo-mark">
          <Image src="/images/appIcon.png" alt="What to Cook?" width={38} height={38} style={{ objectFit: 'contain' }} />
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
            >
              What to Cook?
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Collapse toggle ── */}
      <button
        className="sidebar-collapse-btn"
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* ── Greeting ── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            className="sidebar-greeting"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="sidebar-greeting-time">{getSidebarGreeting()}</div>
            <div className="sidebar-greeting-date">{getSidebarDate()}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Nav ── */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${active ? 'nav-active' : ''} ${collapsed ? 'nav-item--collapsed' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="nav-indicator"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon size={18} strokeWidth={active ? 2 : 1.5} />
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.16 }}
                    style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )
        })}
      </nav>

      {/* ── Streak badge ── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            className="sidebar-streak"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
          >
            <span className="sidebar-streak-emoji">🔥</span>
            <div>
              <div className="sidebar-streak-text">Keep it up!</div>
              <div className="sidebar-streak-sub">Log meals daily to build your streak</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar">
            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                className="user-info"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.16 }}
                style={{ overflow: 'hidden' }}
              >
                <span className="user-name">{user?.name}</span>
                <span className="user-email">{user?.email}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sign-out with confirmation popover */}
        <div className="logout-wrap" ref={logoutRef}>
          <button
            className="logout-btn"
            onClick={() => setShowLogoutConfirm((v) => !v)}
            title="Sign out"
          >
            <LogOut size={16} />
          </button>

          <AnimatePresence>
            {showLogoutConfirm && (
              <motion.div
                className="logout-popover"
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.15 }}
              >
                <p>Sign out?</p>
                <div className="logout-popover-actions">
                  <button className="logout-cancel" onClick={() => setShowLogoutConfirm(false)}>
                    Cancel
                  </button>
                  <button className="logout-confirm" onClick={handleLogout}>
                    Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  )
}

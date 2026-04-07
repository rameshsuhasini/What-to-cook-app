'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, UtensilsCrossed, Calendar,
  ShoppingCart, Apple, TrendingUp, User,
  ChefHat, LogOut,
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

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    await authApi.logout()
    logout()
    router.push('/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <ChefHat size={20} strokeWidth={1.5} />
        </div>
        <span>What to Cook?</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} className={`nav-item ${active ? 'nav-active' : ''}`}>
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="nav-indicator"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon size={18} strokeWidth={active ? 2 : 1.5} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar">
            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-email">{user?.email}</span>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout} title="Sign out">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}
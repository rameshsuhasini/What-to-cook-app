'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, UtensilsCrossed, Calendar,
  ShoppingCart, Apple,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',      label: 'Home',    icon: LayoutDashboard },
  { href: '/recipes',        label: 'Recipes', icon: UtensilsCrossed },
  { href: '/weekly-planner', label: 'Planner', icon: Calendar },
  { href: '/groceries',      label: 'Grocery', icon: ShoppingCart },
  { href: '/pantry',         label: 'Pantry',  icon: Apple },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item${active ? ' bottom-nav-item--active' : ''}`}
          >
            {active && (
              <motion.div
                layoutId="bottom-nav-indicator"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'var(--teal-50)',
                  borderRadius: 10,
                  zIndex: 0,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>
              <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
            </span>
            <span style={{ position: 'relative', zIndex: 1 }}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

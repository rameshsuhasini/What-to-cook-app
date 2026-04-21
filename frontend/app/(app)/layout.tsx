'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import MobileHeader from '@/components/MobileHeader'
import { useOnboardingGuard } from '@/hooks/useOnboardingGuard'
import '../layout.css'

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  useOnboardingGuard()

  return (
    <div className="app-layout">
      <Sidebar />
      <MobileHeader />
      <main className="app-main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ minHeight: '100%' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
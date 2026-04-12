import type { ReactNode } from 'react'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import '../layout.css'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">{children}</main>
      <BottomNav />
    </div>
  )
}
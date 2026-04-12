import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Providers from '@/components/Providers'

export const metadata: Metadata = {
  title: 'What to Cook?',
  description: 'AI-powered meal planning and nutrition assistant',
  icons: {
    icon: '/images/appIcon.png',
    apple: '/images/appIcon.png',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
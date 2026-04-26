'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import '@/components/ErrorBoundary.css'

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Route Error]', error)
    }
  }, [error])

  return (
    <div className="eb-root">
      <div className="eb-card">
        <div className="eb-icon-wrap">
          <AlertTriangle size={36} strokeWidth={1.5} />
        </div>
        <h1 className="eb-title">Something went wrong</h1>
        <p className="eb-message">
          An error occurred loading this page. Try again or return to the home
          screen.
        </p>
        {process.env.NODE_ENV !== 'production' && (
          <pre className="eb-debug">{error.message}</pre>
        )}
        <div className="eb-actions">
          <button className="eb-btn eb-btn--primary" onClick={reset}>
            <RefreshCw size={15} />
            Try again
          </button>
          <a className="eb-btn eb-btn--ghost" href="/dashboard">
            <Home size={15} />
            Go home
          </a>
        </div>
      </div>
    </div>
  )
}

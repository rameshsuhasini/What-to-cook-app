'use client'

import { RefreshCw } from 'lucide-react'

// global-error must render its own <html>/<body> — it replaces the root layout
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #faf7f4 0%, #f0e8de 100%)',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          padding: '2rem',
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: '20px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
            padding: '3rem 2.5rem',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              background: '#faeeda',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.75rem',
              fontSize: '2.2rem',
            }}
          >
            ⚠️
          </div>
          <h1
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: '1.65rem',
              fontWeight: 600,
              color: '#1c1a17',
              marginBottom: '0.75rem',
            }}
          >
            Critical error
          </h1>
          <p
            style={{
              fontSize: '0.925rem',
              color: '#5c5752',
              lineHeight: 1.65,
              marginBottom: '2rem',
            }}
          >
            The application encountered a fatal error. Please refresh the page.
          </p>
          <button
            onClick={reset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.6rem 1.5rem',
              borderRadius: '12px',
              background: '#1d9e75',
              color: '#fff',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              minHeight: 40,
            }}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>
      </body>
    </html>
  )
}

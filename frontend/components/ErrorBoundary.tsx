'use client'

import './ErrorBoundary.css'
import React from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary]', error, info.componentStack)
    }
  }

  handleReset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="eb-root">
        <div className="eb-card">
          <div className="eb-icon-wrap">
            <AlertTriangle size={36} strokeWidth={1.5} />
          </div>
          <h1 className="eb-title">Something went wrong</h1>
          <p className="eb-message">
            An unexpected error occurred. You can try refreshing the page or
            return to the home screen.
          </p>
          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <pre className="eb-debug">{this.state.error.message}</pre>
          )}
          <div className="eb-actions">
            <button className="eb-btn eb-btn--primary" onClick={this.handleReset}>
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
}

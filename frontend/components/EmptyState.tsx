import type { ReactNode } from 'react'
import './EmptyState.css'

interface Action {
  label: string
  icon?: ReactNode
  onClick: () => void
}

interface EmptyStateProps {
  illustration: ReactNode
  title: string
  description: string
  primaryAction?: Action
  secondaryAction?: Action
  className?: string
}

export default function EmptyState({
  illustration,
  title,
  description,
  primaryAction,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`es-root ${className}`}>
      <div className="es-illustration">{illustration}</div>
      <h2 className="es-title">{title}</h2>
      <p className="es-description">{description}</p>
      {(primaryAction || secondaryAction) && (
        <div className="es-actions">
          {primaryAction && (
            <button className="es-btn es-btn--primary" onClick={primaryAction.onClick}>
              {primaryAction.icon}
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button className="es-btn es-btn--ghost" onClick={secondaryAction.onClick}>
              {secondaryAction.icon}
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

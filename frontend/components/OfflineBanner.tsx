'use client'

import './OfflineBanner.css'
import { useEffect, useState } from 'react'
import { WifiOff, ServerCrash, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNetworkStore } from '@/store/network.store'

export default function OfflineBanner() {
  const { isOnline, isServerReachable, setOnline } = useNetworkStore()
  const [dismissed, setDismissed] = useState(false)

  // Re-show the banner whenever connectivity state changes to a bad state
  useEffect(() => {
    if (!isOnline || !isServerReachable) {
      setDismissed(false)
    }
  }, [isOnline, isServerReachable])

  // Mirror browser online/offline events into the store
  useEffect(() => {
    const handleOnline  = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setOnline])

  const isVisible = (!isOnline || !isServerReachable) && !dismissed
  const isOffline = !isOnline

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={`offline-banner ${isOffline ? 'offline-banner--offline' : 'offline-banner--server'}`}
          role="alert"
          aria-live="assertive"
          initial={{ y: -56, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{    y: -56, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="offline-banner-inner">
            <div className="offline-banner-left">
              {isOffline ? <WifiOff size={15} /> : <ServerCrash size={15} />}
              <span className="offline-banner-msg">
                {isOffline
                  ? "You're offline — check your internet connection"
                  : 'Server unreachable — your changes may not be saved'}
              </span>
            </div>
            <button
              className="offline-banner-dismiss"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

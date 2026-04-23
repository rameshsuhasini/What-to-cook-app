'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { notificationApi, UserAchievement } from '@/services/notification.service'
import './AchievementToast.css'

export default function AchievementToast() {
  const queryClient = useQueryClient()
  const [seenIds, setSeenIds] = useLocalStorage<string[]>('seen_achievements', [])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationApi.getNotifications,
    refetchInterval: 60_000,
  })

  const achievements = data?.achievements ?? []

  // Find the first achievement the user hasn't seen yet
  const unseen = achievements.find((a) => !seenIds.includes(a.id))

  useEffect(() => {
    if (!unseen) return
    // Auto-dismiss after 5 seconds
    timerRef.current = setTimeout(() => {
      setSeenIds((prev) => [...prev, unseen.id])
    }, 5000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [unseen?.id])

  function dismiss(a: UserAchievement) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setSeenIds((prev) => [...prev, a.id])
  }

  return (
    <AnimatePresence>
      {unseen && (
        <motion.div
          key={unseen.id}
          className="ach-toast"
          initial={{ opacity: 0, y: 60, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          onClick={() => dismiss(unseen)}
        >
          <div className="ach-toast-glow" />
          <div className="ach-toast-emoji">
            {unseen.definition?.emoji ?? '🏆'}
          </div>
          <div className="ach-toast-body">
            <p className="ach-toast-eyebrow">Achievement Unlocked</p>
            <p className="ach-toast-title">{unseen.definition?.title ?? unseen.achievementKey}</p>
            <p className="ach-toast-msg">{unseen.definition?.message}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

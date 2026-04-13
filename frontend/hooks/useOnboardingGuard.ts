'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { profileApi } from '@/services/profile.service'

/**
 * Redirects to /onboarding if the user's profile is incomplete.
 * "Incomplete" means dietType is still the default 'NONE' AND calorieGoal is null —
 * indicating they have never been through the wizard.
 *
 * We use both conditions together so existing users who genuinely chose 'NONE'
 * and have set goals are not redirected.
 */
export function useOnboardingGuard() {
  const router = useRouter()
  const pathname = usePathname()

  const { data: profile, isSuccess } = useQuery({
    queryKey: ['profile'],
    queryFn: profileApi.getProfile,
    // Don't retry on 401/404 — user may not have a profile yet
    retry: false,
  })

  useEffect(() => {
    if (!isSuccess) return
    if (pathname === '/onboarding') return

    const isIncomplete = profile.dietType === 'NONE' && profile.calorieGoal === null
    if (isIncomplete) {
      router.replace('/onboarding')
    }
  }, [isSuccess, profile, pathname, router])
}

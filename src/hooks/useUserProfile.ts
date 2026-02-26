'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'

interface UserProfile {
  tier: 'free' | 'premium'
  stripe_customer_id: string | null
}

export function useUserProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setProfile(null); setLoading(false); return }
    let isMounted = true
    const supabase = createClient()
    supabase.from('profiles').select('tier, stripe_customer_id').eq('id', user.id).single()
      .then(({ data, error }) => {
        if (!isMounted) return
        if (error) console.warn('[useUserProfile] fetch failed:', error.message)
        setProfile(data as UserProfile ?? { tier: 'free', stripe_customer_id: null })
        setLoading(false)
      })
    return () => { isMounted = false }
  }, [user?.id])

  return { profile, loading }
}

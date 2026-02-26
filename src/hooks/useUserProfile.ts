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
    const supabase = createClient()
    supabase.from('profiles').select('tier, stripe_customer_id').eq('id', user.id).single()
      .then(({ data }) => {
        setProfile(data as UserProfile ?? { tier: 'free', stripe_customer_id: null })
        setLoading(false)
      })
  }, [user?.id])

  return { profile, loading }
}

'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { MONTHLY_CREDITS } from '@/lib/ai-credits-config'

interface UserProfile {
  tier: 'free' | 'premium'
  stripe_customer_id: string | null
  is_admin: boolean
  event_credit: number
  ai_credits_used: number
  ai_credits_reset_at: string | null
  character_theme: string | null
  newsletter_opt_in: boolean
  marketing_opt_in: boolean
}

export interface AiCreditsInfo {
  used: number
  total: number
  remaining: number
  resetAt: string | null
}

// ── Broadcast cross-componente ─────────────────────────────────────────────
// Ogni istanza monta registra il proprio fetchProfile qui.
// broadcastProfileRefresh() forza il re-fetch su TUTTE le istanze montate
// (Header, Pricing, Profilo, ecc.) anche quando non arriva l'evento Realtime.
const _refreshRegistry = new Set<() => void>()

export function broadcastProfileRefresh() {
  _refreshRegistry.forEach(fn => fn())
}

// ─────────────────────────────────────────────────────────────────────────

export function useUserProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    if (!user) { setProfile(null); setLoading(false); return }
    const supabase = createClient()
    const { data, error } = await supabase.from('profiles')
      .select('tier, stripe_customer_id, is_admin, event_credit, ai_credits_used, ai_credits_reset_at, character_theme, newsletter_opt_in, marketing_opt_in')
      .eq('id', user.id).single()
    if (error) console.warn('[useUserProfile] fetch failed:', error.message)
    setProfile(data as UserProfile ?? {
      tier: 'free',
      stripe_customer_id: null,
      is_admin: false,
      event_credit: 0,
      ai_credits_used: 0,
      ai_credits_reset_at: null,
      character_theme: 'luly',
      newsletter_opt_in: true,
      marketing_opt_in: false,
    })
    setLoading(false)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchProfile() }, [fetchProfile])

  // Registra fetchProfile nel registry globale per il broadcast
  useEffect(() => {
    _refreshRegistry.add(fetchProfile)
    return () => { _refreshRegistry.delete(fetchProfile) }
  }, [fetchProfile])

  // Realtime: aggiorna su tutti i dispositivi quando il DB cambia
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    const channel = supabase
      .channel(`profile-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Partial<UserProfile>
          setProfile(prev => prev ? { ...prev, ...updated } : prev)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Crediti AI calcolati
  const aiCredits: AiCreditsInfo | null = profile
    ? (() => {
        const tier = profile.tier ?? 'free'
        const total = MONTHLY_CREDITS[tier] ?? 50
        const used = profile.ai_credits_used ?? 0
        return {
          used,
          total,
          remaining: Math.max(0, total - used),
          resetAt: profile.ai_credits_reset_at,
        }
      })()
    : null

  return { profile, loading, refreshProfile: fetchProfile, aiCredits }
}

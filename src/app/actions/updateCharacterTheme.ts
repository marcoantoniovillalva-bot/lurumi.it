'use server'

import { createClient } from '@/lib/supabase/server'
import { broadcastProfileRefresh } from '@/hooks/useUserProfile'

export async function updateCharacterTheme(theme: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Non autenticato')

    const { error } = await supabase
        .from('profiles')
        .update({ character_theme: theme })
        .eq('id', user.id)

    if (error) throw new Error(error.message)
}

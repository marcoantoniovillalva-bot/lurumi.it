import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
    try {
        const { session_id, ended_at } = await req.json()
        if (!session_id || !ended_at) {
            return NextResponse.json({ ok: false }, { status: 400 })
        }

        const supabase = createServiceClient()

        const { data: session } = await supabase
            .from('user_sessions')
            .select('started_at')
            .eq('id', session_id)
            .single()

        if (!session) return NextResponse.json({ ok: false })

        const durationSec = Math.max(0, Math.round(
            (new Date(ended_at).getTime() - new Date(session.started_at).getTime()) / 1000
        ))

        await supabase
            .from('user_sessions')
            .update({ ended_at, duration_seconds: durationSec })
            .eq('id', session_id)

        return NextResponse.json({ ok: true })
    } catch {
        return NextResponse.json({ ok: false }, { status: 500 })
    }
}

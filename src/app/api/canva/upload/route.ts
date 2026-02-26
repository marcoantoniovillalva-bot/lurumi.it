import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

    const { imageUrl } = await request.json()
    if (!imageUrl) return NextResponse.json({ error: 'imageUrl mancante' }, { status: 400 })

    // Get Canva token from profiles
    const { data: profile } = await supabase.from('profiles').select('canva_token').eq('id', user.id).single()
    const token = (profile as any)?.canva_token
    if (!token) return NextResponse.json({ error: 'Canva non connesso' }, { status: 400 })

    // Fetch the image bytes
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) return NextResponse.json({ error: 'Impossibile scaricare immagine' }, { status: 400 })
    const imgBlob = await imgRes.blob()
    const imgBuffer = Buffer.from(await imgBlob.arrayBuffer())

    // Upload to Canva Assets API
    const uploadRes = await fetch('https://api.canva.com/rest/v1/asset-uploads', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/octet-stream',
            'Asset-Upload-Metadata': JSON.stringify({
                name_base64: Buffer.from('lurumi-design.webp').toString('base64'),
            }),
        },
        body: imgBuffer,
    })

    if (!uploadRes.ok) {
        const err = await uploadRes.text()
        if (uploadRes.status === 401) {
            return NextResponse.json({ error: 'Token Canva scaduto. Ricollega il tuo account Canva dal profilo.' }, { status: 401 })
        }
        return NextResponse.json({ error: `Upload Canva fallito: ${err}` }, { status: 500 })
    }

    const { job } = await uploadRes.json()

    return NextResponse.json({
        success: true,
        jobId: job?.id,
        message: 'Immagine caricata su Canva. Vai su canva.com → Le tue risorse per trovarla.',
        canvaUrl: 'https://www.canva.com',
    })
}

import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// POST /api/admin/upload-pdf
// Usato da @vercel/blob/client upload() per generare un client token.
// Il file NON passa mai dal serverless — va direttamente browser → Vercel Blob.
export async function POST(req: NextRequest) {
    const body = (await req.json()) as HandleUploadBody;

    // Verifica admin prima di generare il token
    const authHeader = req.headers.get('authorization');
    const sessionToken = authHeader?.replace('Bearer ', '');
    if (!sessionToken) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: { user } } = await supabase.auth.getUser(sessionToken);
    if (!user) return NextResponse.json({ error: 'Token non valido' }, { status: 401 });

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });

    try {
        const jsonResponse = await handleUpload({
            body,
            request: req,
            onBeforeGenerateToken: async () => ({
                allowedContentTypes: ['application/pdf'],
                maximumSizeInBytes: 500 * 1024 * 1024, // 500 MB
            }),
            onUploadCompleted: async () => {
                // opzionale: callback dopo upload completato
            },
        });
        return NextResponse.json(jsonResponse);
    } catch (e: any) {
        console.error('[upload-pdf] handleUpload error:', e?.message ?? e);
        return NextResponse.json({ error: e?.message ?? 'Errore upload' }, { status: 400 });
    }
}

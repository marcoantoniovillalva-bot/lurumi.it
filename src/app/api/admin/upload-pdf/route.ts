import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const LIBRARY_BUCKET = 'library-content';

// POST /api/admin/upload-pdf
// Body: { path: string }
// Returns: { signedUrl: string, token: string, fullPath: string }
// Il client usa signedUrl per caricare il file DIRETTAMENTE in Supabase (no serverless body limit).
export async function POST(req: NextRequest) {
    // Verifica admin via service role
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Token non valido' }, { status: 401 });

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const path = body.path as string | undefined;
    if (!path) return NextResponse.json({ error: 'Path mancante' }, { status: 400 });

    // Genera un signed upload URL valido 60 secondi — il client carica il file direttamente
    const { data, error } = await supabase.storage
        .from(LIBRARY_BUCKET)
        .createSignedUploadUrl(path, { upsert: true });

    if (error || !data) {
        return NextResponse.json({ error: error?.message ?? 'Errore generazione URL' }, { status: 500 });
    }

    return NextResponse.json({
        signedUrl: data.signedUrl,
        token: data.token,
        fullPath: data.path,
    });
}

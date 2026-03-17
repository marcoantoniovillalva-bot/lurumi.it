import { put } from '@vercel/blob';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

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

    // Leggi il file dal form
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const path = formData.get('path') as string | null;
    if (!file || !path) return NextResponse.json({ error: 'File o path mancante' }, { status: 400 });

    // Upload su Vercel Blob (nessun limite di dimensione)
    const blob = await put(path, file, {
        access: 'public',
        contentType: file.type,
    });

    return NextResponse.json({ url: blob.url });
}

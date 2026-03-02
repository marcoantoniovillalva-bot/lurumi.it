import { NextResponse } from 'next/server'
import { getPublishedLibraryItems } from '@/features/admin/actions/library'

export async function GET() {
    try {
        const items = await getPublishedLibraryItems()
        return NextResponse.json({ items })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const supabase = await createServerClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { path } = await params
        const filePath = path.join('/')

        // Security check: Ensure user owns this file?
        // The path usually starts with user_id/
        if (!filePath.startsWith(user.id)) {
            // In a real app, strict ownership check via DB lookup is better.
            // For now, folder-based isolation check:
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Use Service Role to bypass RLS for download (since we verified ownership above)
        const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data, error } = await adminSupabase.storage
            .from('documents')
            .download(filePath)

        if (error) {
            console.error('Storage Download Error:', error)
            return NextResponse.json({ error: 'File not found' }, { status: 404 })
        }

        // Return the file stream
        const headers = new Headers()
        headers.set('Content-Type', 'application/pdf')
        headers.set('Content-Disposition', 'inline')

        return new NextResponse(data, { headers })

    } catch (error: any) {
        console.error('File Proxy Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

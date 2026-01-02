import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { createConversion } from '@/lib/db/conversions'
import { getUserById } from '@/lib/db/users'
import { getOrCreateGuestUser } from '@/lib/guest-manager'

export async function POST(request: NextRequest) {
    try {
        // Standard client for Auth check
        const supabase = await createServerClient()

        // Admin client for RLS bypass (Storage & DB)
        const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // 1. Auth check (Optional for Guest Mode)
        const { data: { user } } = await supabase.auth.getUser()

        // 2. Parse FormData
        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // 3. Validation
        if (file.type !== 'application/pdf') {
            return NextResponse.json({ error: 'Invalid file type. Only PDF allowed.' }, { status: 400 })
        }
        if (file.size > 50 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large. Maximum 50MB.' }, { status: 400 })
        }

        // 4. Usage Limit Check
        if (user) {
            const profile = await getUserById(supabase, user.id)
            if (profile && profile.pages_used_this_month >= (profile.pages_limit || 5)) {
                return NextResponse.json(
                    { error: 'Page limit exceeded. Upgrade to continue.', code: 'LIMIT_EXCEEDED' },
                    { status: 402 }
                )
            }
        }

        // Determine User ID (Actual or Guest Bot)
        let userIdToUse = user ? user.id : null
        if (!userIdToUse) {
            try {
                userIdToUse = await getOrCreateGuestUser(adminSupabase)
            } catch (err) {
                console.error('Guest user creation failed:', err)
                return NextResponse.json({ error: 'Guest system unavailable' }, { status: 500 })
            }
        }

        // 5. Upload to Supabase Storage (Using Admin Client to bypass RLS)
        const storageFolder = user ? user.id : 'guest'

        // Sanitize filename
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const fileName = `${storageFolder}/${Date.now()}_${safeFileName}`
        const { data: storageData, error: storageError } = await adminSupabase.storage
            .from('documents')
            .upload(fileName, file)

        if (storageError) {
            console.error('Storage Upload Error:', storageError)
            return NextResponse.json({ error: `Upload failed: ${storageError.message}` }, { status: 500 })
        }

        // 6. Create Conversion Record (Using Admin Client to bypass RLS)
        const conversion = await createConversion(adminSupabase, {
            user_id: userIdToUse, // Now guaranteed to be a valid UUID
            file_name: file.name,
            file_size: file.size,
            file_path: storageData.path,
            status: 'pending'
        })

        return NextResponse.json({
            conversionId: conversion.id,
            fileName: conversion.file_name,
            status: conversion.status
        })

    } catch (error: any) {
        console.error('Upload API Error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}

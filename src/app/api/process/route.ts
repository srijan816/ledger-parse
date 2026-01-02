import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { getConversionById, updateConversionStatus, updateConversionResults } from '@/lib/db/conversions'
import { createTransactions } from '@/lib/db/transactions'
import { incrementPagesUsed, getUserById } from '@/lib/db/users'
import { getOrCreateGuestUser } from '@/lib/guest-manager'

// Use new Advanced PDF Engine
import { processDocument } from '@/lib/services/pdf-processor'

/**
 * ASYNC PROCESSING ARCHITECTURE
 * 
 * This endpoint returns 202 IMMEDIATELY after validation.
 * It then triggers background processing via a non-blocking fetch.
 * 
 * Flow:
 * 1. User calls POST /api/process with { conversionId }
 * 2. We validate the request and mark status = 'processing'
 * 3. We return 202 Accepted immediately
 * 4. Background: We call /api/process-background to do actual work
 * 5. UI polls GET /api/conversions/{id} to check status
 */

export const maxDuration = 60; // Vercel Pro limit

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerClient()

        // Admin client for RLS bypass
        const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: { user } } = await supabase.auth.getUser()

        const body = await request.json()
        const { conversionId } = body

        if (!conversionId) {
            return NextResponse.json({ error: 'Missing conversionId' }, { status: 400 })
        }

        // Check Usage Limit (Only for logged-in users)
        if (user) {
            const profile = await getUserById(supabase, user.id)
            if (profile) {
                const used = profile.pages_used_this_month || 0
                const limit = profile.pages_limit || 5

                if (used >= limit) {
                    return NextResponse.json(
                        { error: 'Monthly limit reached. Please upgrade your plan.' },
                        { status: 403 }
                    )
                }
            }
        }

        // Validate conversion exists
        let conversion;
        try {
            conversion = await getConversionById(adminSupabase, conversionId)
        } catch (e) {
            console.warn('Conversion lookup failed:', e);
            conversion = null;
        }

        // Check ownership or guest access
        const guestUserId = await getOrCreateGuestUser(adminSupabase)
        if (!conversion) {
            return NextResponse.json({ error: 'Conversion not found' }, { status: 404 })
        }
        if (conversion.user_id !== user?.id && conversion.user_id !== guestUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Mark as processing IMMEDIATELY
        await updateConversionStatus(adminSupabase, conversionId, 'processing')

        // ASYNC: Trigger background processing (fire and forget)
        // This prevents serverless timeout - the background endpoint handles the work
        const baseUrl = request.nextUrl.origin

        // Use non-blocking fetch - we don't await this
        fetch(`${baseUrl}/api/process-background`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Pass auth for RLS
                'x-supabase-auth': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
            },
            body: JSON.stringify({
                conversionId,
                userId: user?.id || guestUserId,
                filePath: conversion.file_path,
            }),
        }).catch(err => {
            console.error('Failed to trigger background processing:', err);
            // Don't fail the request - the status will show the error
        });

        // Return IMMEDIATELY with 202 Accepted
        return NextResponse.json({
            success: true,
            status: 'processing',
            message: 'Processing started. Poll GET /api/conversions/{id} for status.',
            conversionId,
        }, { status: 202 })

    } catch (error: any) {
        console.error('Process error:', error)
        return NextResponse.json(
            { error: error.message || 'Processing failed' },
            { status: 500 }
        )
    }
}

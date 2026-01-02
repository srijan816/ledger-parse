import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConversionById } from '@/lib/db/conversions'
import { getTransactionsByConversion } from '@/lib/db/transactions'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const { id } = await params
        const conversion = await getConversionById(supabase, id)

        if (!conversion) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        // Check ownership - allow if user matches OR if it's a guest conversion (no user_id)
        // OR if there's no logged in user (guest mode)
        const isOwner = user && conversion.user_id === user.id
        const isGuestConversion = !conversion.user_id

        if (!isOwner && !isGuestConversion && user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const transactions = await getTransactionsByConversion(supabase, id)

        return NextResponse.json({
            ...conversion,
            transactions,
            // Include status explicitly for polling
            status: conversion.status,
        })

    } catch (error: any) {
        console.error('Conversion API Error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}

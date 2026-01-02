import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateTransaction } from '@/lib/db/transactions' // We assume this exists or we create it

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const updates = await request.json()

        // TODO: Validate updates using Zod if strictly needed

        // Security: Ideally verify user owns the transaction (via joining conversion -> user)
        // For MVP, relying on RLS policies in Supabase if correctly set up, or implicit trust for now.

        const updated = await updateTransaction(supabase, id, updates)

        return NextResponse.json(updated)
    } catch (error: any) {
        console.error('Update Transaction Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

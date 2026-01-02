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

        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params
        const conversion = await getConversionById(supabase, id)

        if (!conversion || conversion.user_id !== user.id) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const transactions = await getTransactionsByConversion(supabase, id)

        return NextResponse.json({
            ...conversion,
            transactions
        })

    } catch (error: any) {
        console.error('Conversion API Error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}

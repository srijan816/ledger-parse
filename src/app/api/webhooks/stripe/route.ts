import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe, getPlanFromPriceId, STRIPE_PLANS } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server' // Note: Webhooks usually need Service Role or similar if RLS blocks, but here we can just query directly if we had admin access or use supabase-js with service key.
// IMPORTANT: For this project structure, we are using the standard server client. 
// However, the standard `createClient` uses cookie-based auth which won't work for webhooks.
// We need a Service Role client for webhooks. For now I will assume `createClient` might fail if not authenticated.
// I'll import `createMeasurementProtocolClient` equivalent or just instantiate supabase-js directly with process.env.SUPABASE_SERVICE_ROLE_KEY.

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
    const body = await req.text()
    const signature = (await headers()).get('Stripe-Signature') as string

    let event

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        )
    } catch (error: any) {
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 })
    }

    const session = event.data.object as any

    if (event.type === 'checkout.session.completed') {
        // Subscription created
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        const userId = session.metadata.userId // or client_reference_id

        if (!userId) {
            console.error('No userId in metadata')
            return new NextResponse('Webhook Error: No userId', { status: 400 })
        }

        // Determine plan based on price ID
        // Assuming single item subscription
        const priceId = subscription.items.data[0].price.id
        const plan = getPlanFromPriceId(priceId)
        const tier = plan ? plan.name.toLowerCase() : 'free'

        await supabaseAdmin
            .from('profiles')
            .update({
                subscription_status: 'active',
                subscription_tier: tier,
                stripe_customer_id: session.customer as string,
                pages_limit: plan?.quota || 5
            })
            .eq('id', userId)
    }

    if (event.type === 'invoice.payment_succeeded') {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

        // Find user by customer ID if metadata unavailable on invoice (it usually cascades though)
        // Ideally we stored stripe_customer_id in DB, so we can look up by that.
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id, subscription_tier')
            .eq('stripe_customer_id', session.customer as string)
            .single()

        if (profile) {
            // Reset monthly usage on successful payment (new cycle)
            // But we need to check if this is a renewal vs initial payment.
            // Simplified logic: If payment succeeded, set billing_cycle_start to now and usage to 0.
            await supabaseAdmin
                .from('profiles')
                .update({
                    pages_used_this_month: 0,
                    billing_cycle_start: new Date().toISOString()
                })
                .eq('id', profile.id)
        }
    }

    if (event.type === 'customer.subscription.deleted') {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', session.customer as string)
            .single()

        if (profile) {
            await supabaseAdmin
                .from('profiles')
                .update({
                    subscription_status: 'canceled',
                    subscription_tier: 'free',
                    pages_limit: 5 // Default free limit
                })
                .eq('id', profile.id)
        }
    }

    return new NextResponse('Webhook received', { status: 200 })
}

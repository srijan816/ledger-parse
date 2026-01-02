import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        const { priceId } = await req.json()

        if (!priceId) {
            return new NextResponse('Price ID is required', { status: 400 })
        }

        // 1. Get user profile to check for existing Stripe Customer ID
        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id, email')
            .eq('id', user.id)
            .single()

        let stripeCustomerId = profile?.stripe_customer_id

        // 2. If no customer ID, create one in Stripe and save it
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: profile?.email || user.email || '',
                metadata: {
                    userId: user.id
                }
            })
            stripeCustomerId = customer.id

            await supabase
                .from('profiles')
                .update({ stripe_customer_id: stripeCustomerId })
                .eq('id', user.id)
        }

        // 3. Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?success=true`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?canceled=true`,
            subscription_data: {
                metadata: {
                    userId: user.id
                }
            }
        })

        return NextResponse.json({ url: session.url })

    } catch (error: any) {
        console.error('Stripe Checkout Error:', error)
        return new NextResponse('Internal Error', { status: 500 })
    }
}

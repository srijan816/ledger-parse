import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string || 'sk_test_placeholder', {
    apiVersion: '2025-12-15.clover', // Latest API version
    typescript: true,
})

// Configuration for Prices
// In a real app, these commonly come from env vars or a config object, 
// as IDs differ between Test Mode and Live Mode.
export const STRIPE_PLANS = {
    starter: {
        priceId: process.env.STRIPE_PRICE_ID_STARTER || 'price_1Q...', // Replace with actual test ID
        name: 'Starter',
        quota: 100,
    },
    professional: {
        priceId: process.env.STRIPE_PRICE_ID_PRO || 'price_1Q...',
        name: 'Professional',
        quota: 500,
    },
    enterprise: {
        priceId: process.env.STRIPE_PRICE_ID_ENTERPRISE || 'price_1Q...',
        name: 'Enterprise',
        quota: 10000,
    }
}

export function getPlanFromPriceId(priceId: string) {
    return Object.values(STRIPE_PLANS).find(plan => plan.priceId === priceId)
}

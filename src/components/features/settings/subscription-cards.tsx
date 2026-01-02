'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { STRIPE_PLANS } from '@/lib/stripe'

interface SubscriptionCardsProps {
    currentTier: string
}

export function SubscriptionCards({ currentTier }: SubscriptionCardsProps) {
    const [loading, setLoading] = useState<string | null>(null)

    const handleCheckout = async (priceId: string) => {
        setLoading(priceId)
        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priceId })
            })

            const data = await res.json()

            if (data.url) {
                window.location.href = data.url
            } else {
                throw new Error('Failed to create checkout session')
            }
        } catch (error) {
            console.error(error)
            toast.error('Something went wrong. Please try again.')
        } finally {
            setLoading(null)
        }
    }

    const plans = [
        {
            key: 'starter',
            name: STRIPE_PLANS.starter.name,
            price: '$10/mo',
            description: 'Perfect for freelancers.',
            features: [
                '100 Pages / month',
                'Basic Export Formats (XLSX, CSV)',
                'Email Support'
            ],
            priceId: STRIPE_PLANS.starter.priceId
        },
        {
            key: 'professional',
            name: STRIPE_PLANS.professional.name,
            price: '$30/mo',
            description: 'For growing businesses.',
            features: [
                '500 Pages / month',
                'All Export Formats (inc. QBO)',
                'Priority Support',
                'Reconciliation Tools'
            ],
            priceId: STRIPE_PLANS.professional.priceId
        },
        {
            key: 'enterprise',
            name: STRIPE_PLANS.enterprise.name,
            price: '$100/mo',
            description: 'High volume processing.',
            features: [
                '10,000 Pages / month',
                'Custom Integrations',
                'Dedicated Account Manager',
                'SLA'
            ],
            priceId: STRIPE_PLANS.enterprise.priceId
        }
    ]

    return (
        <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
                const isCurrent = currentTier === plan.key?.toLowerCase() // Normalize check

                return (
                    <Card key={plan.key} className={`flex flex-col ${isCurrent ? 'border-brand-500 shadow-md ring-1 ring-brand-500' : ''}`}>
                        <CardHeader>
                            <CardTitle>{plan.name}</CardTitle>
                            <CardDescription>{plan.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <div className="text-2xl font-bold mb-4">{plan.price}</div>
                            <ul className="space-y-2 text-sm">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-center">
                                        <Check className="mr-2 h-4 w-4 text-green-500" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Button
                                className="w-full"
                                variant={isCurrent ? 'outline' : 'default'}
                                disabled={isCurrent || !!loading}
                                onClick={() => handleCheckout(plan.priceId)}
                            >
                                {loading === plan.priceId ? 'Processing...' : isCurrent ? 'Current Plan' : 'Upgrade'}
                            </Button>
                        </CardFooter>
                    </Card>
                )
            })}
        </div>
    )
}

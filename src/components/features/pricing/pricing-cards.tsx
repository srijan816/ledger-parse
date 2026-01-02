'use client'

import { Check } from 'lucide-react'
import { Button } from '../../ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../ui/card'
import { Switch } from '../../ui/switch'
import { useState } from 'react'
import { cn } from '../../../lib/utils'

const tiers = [
    {
        name: 'Free',
        price: '$0',
        description: 'Perfect for testing and small tasks.',
        features: ['5 pages per month', 'Basic PDF extraction', 'Standard support', '7-day history'],
        cta: 'Get Started',
        popular: false,
    },
    {
        name: 'Starter',
        price: '$29',
        period: '/month',
        description: 'For freelance bookkeepers.',
        features: ['100 pages per month', 'Forensic verification', 'Priority support', '30-day history', 'Excluded rows filter'],
        cta: 'Start Free Trial',
        popular: false,
    },
    {
        name: 'Professional',
        price: '$59',
        period: '/month',
        description: 'For accounting firms & brokers.',
        features: ['300 pages per month', 'Batch uploading', 'QuickBooks & Xero export', 'Unlimited history', 'Team billing (soon)'],
        cta: 'Get Professional',
        popular: true,
    },
]

export function PricingCards() {
    const [isAnnual, setIsAnnual] = useState(false)

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto px-4 py-8">
            {tiers.map((tier) => (
                <Card
                    key={tier.name}
                    className={cn(
                        "flex flex-col relative",
                        tier.popular ? "border-brand-600 shadow-xl scale-105 z-10" : "border-slate-200 shadow-sm"
                    )}
                >
                    {tier.popular && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                            Most Popular
                        </div>
                    )}
                    <CardHeader>
                        <CardTitle className="text-xl font-bold font-sans">{tier.name}</CardTitle>
                        <CardDescription>{tier.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                        <div className="flex items-baseline mb-6">
                            <span className="text-4xl font-extrabold tracking-tight">{tier.price}</span>
                            {tier.period && (
                                <span className="text-muted-foreground ml-1">{tier.period}</span>
                            )}
                        </div>
                        <ul className="space-y-3">
                            {tier.features.map((feature) => (
                                <li key={feature} className="flex items-start gap-3">
                                    <Check className="h-5 w-5 text-brand-600 shrink-0" />
                                    <span className="text-sm text-slate-600">{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                    <CardFooter>
                        <Button
                            className={cn("w-full", tier.popular ? "bg-brand-600 hover:bg-brand-700" : "")}
                            variant={tier.popular ? 'default' : 'outline'}
                        >
                            {tier.cta}
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    )
}

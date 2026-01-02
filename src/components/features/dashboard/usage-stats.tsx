'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'
import Link from 'next/link'

interface UsageStatsProps {
    currentUsage: number
    limit: number
    planName: string
    resetDate: string
}

export function UsageStats({ currentUsage, limit, planName, resetDate }: UsageStatsProps) {
    const percentage = Math.min((currentUsage / limit) * 100, 100)
    const isNearLimit = percentage >= 80

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Usage</CardTitle>
                    <Zap className="h-4 w-4 text-brand-600" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">
                    {currentUsage} <span className="text-sm font-normal text-muted-foreground">/ {limit} pages</span>
                </div>
                <Progress value={percentage} className="mt-3 h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                    <span>{Math.round(percentage)}% used</span>
                    <span>Resets {new Date(resetDate).toLocaleDateString()}</span>
                </div>

                {isNearLimit && planName === 'free' && (
                    <Button className="w-full mt-4 bg-gradient-to-r from-brand-600 to-indigo-600 text-white border-0" size="sm" asChild>
                        <Link href="/pricing">Upgrade to Pro</Link>
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConversionHistory } from '@/components/features/dashboard/conversion-history'
import { UsageStats } from '@/components/features/dashboard/usage-stats'
import { Button } from '@/components/ui/button'
import { Plus, Upload } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getConversionsByUser } from '@/lib/db/conversions'
import { getUserById } from '@/lib/db/users'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Fetch real data in parallel
    const [profileData, conversionsData] = await Promise.all([
        getUserById(supabase, user.id).catch(() => null), // Handle missing profile gracefully
        getConversionsByUser(supabase, user.id, 5)
    ])

    // Profile Defaults if not ready
    const pagesUsed = profileData?.pages_used_this_month || 0
    const planTier = profileData?.subscription_tier || 'free'
    const pagesLimit = planTier === 'enterprise' ? 10000 : planTier === 'professional' ? 500 : planTier === 'starter' ? 100 : 50

    // Calculate next billing date (1 month from billing_cycle_start, or now + 30 days)
    const billingStart = profileData?.billing_cycle_start ? new Date(profileData.billing_cycle_start) : new Date()
    const resetDate = new Date(billingStart)
    resetDate.setMonth(resetDate.getMonth() + 1)

    return (
        <div className="space-y-8 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <div className="flex items-center space-x-2">
                    <Button asChild>
                        <Link href="/dashboard/upload">
                            <Plus className="mr-2 h-4 w-4" /> New Conversion
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Conversions</CardTitle>
                        <Upload className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{conversionsData.count || 0}</div>
                        <p className="text-xs text-muted-foreground">All time</p>
                    </CardContent>
                </Card>

                <UsageStats
                    currentUsage={pagesUsed}
                    limit={pagesLimit}
                    planName={planTier}
                    resetDate={resetDate.toISOString()} // Pass string
                />
                {/* More stats could go here */}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Recent Conversions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ConversionHistory conversions={conversionsData.data || []} />
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button variant="outline" className="w-full justify-start" asChild>
                            <Link href="/dashboard/upload">
                                <Upload className="mr-2 h-4 w-4" /> Upload Statement
                            </Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start">
                            Upgrade Plan
                        </Button>
                        <Button variant="outline" className="w-full justify-start">
                            View Documentation
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

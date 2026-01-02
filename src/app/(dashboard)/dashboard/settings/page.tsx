import { createClient } from '@/lib/supabase/server'
import { getUserById } from '@/lib/db/users'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { SubscriptionCards } from '@/components/features/settings/subscription-cards'
import { ManageSubscriptionButton } from '@/components/features/settings/manage-subscription-button'

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const profile = await getUserById(supabase, user.id)

    return (
        <div className="space-y-6 pt-6 pb-12"> {/* Added generous bottom padding */}
            <div>
                <h3 className="text-lg font-medium">Settings</h3>
                <p className="text-sm text-muted-foreground">
                    Manage your account settings and subscription.
                </p>
            </div>
            <Separator />

            <div className="grid gap-6">
                {/* Profile Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Profile</CardTitle>
                        <CardDescription>
                            Your personal information.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" value={user.email} disabled />
                            <p className="text-[0.8rem] text-muted-foreground">
                                Your email address is managed via your signup provider.
                            </p>
                        </div>
                        {/* Could add fullName update here later */}
                    </CardContent>
                </Card>

                {/* Subscription Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Subscription</CardTitle>
                        <CardDescription>
                            Manage your plan and billing details.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {/* Current Plan Status */}
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
                            <div className="space-y-0.5">
                                <div className="font-medium flex items-center gap-2">
                                    Current Plan: <span className="text-brand-600 uppercase font-bold">{profile?.subscription_tier || 'Free'}</span>
                                    {profile?.subscription_status === 'active' && (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                                    )}
                                </div>
                                <div className="text-sm text-slate-500">
                                    {profile?.pages_used_this_month || 0} pages processed this cycle.
                                </div>
                            </div>
                            <ManageSubscriptionButton />
                        </div>

                        {/* Usage Bar */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Monthly Usage</span>
                                <span className="text-muted-foreground">
                                    {Math.round(((profile?.pages_used_this_month || 0) / (profile?.pages_limit || 5)) * 100)}% Used
                                </span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-brand-600"
                                    style={{ width: `${Math.min(100, ((profile?.pages_used_this_month || 0) / (profile?.pages_limit || 5)) * 100)}%` }}
                                />
                            </div>
                        </div>

                        <Separator />

                        <div>
                            <h4 className="text-sm font-medium mb-4">Available Plans</h4>
                            <SubscriptionCards currentTier={profile?.subscription_tier || 'free'} />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

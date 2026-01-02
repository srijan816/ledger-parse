import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'

export default function VerifyPage() {
    return (
        <Card className="w-full max-w-md mx-auto text-center">
            <CardHeader>
                <div className="flex justify-center mb-4">
                    <div className="rounded-full bg-brand-100 p-3">
                        <MailCheck className="h-8 w-8 text-brand-600" />
                    </div>
                </div>
                <CardTitle>Check your email</CardTitle>
                <CardDescription>
                    We've sent a verification link to your email address. Please click the link to confirm your account.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild className="w-full" variant="outline">
                    <Link href="/login">Back to Sign in</Link>
                </Button>
            </CardContent>
        </Card>
    )
}

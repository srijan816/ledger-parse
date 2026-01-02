'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Settings } from 'lucide-react'

export function ManageSubscriptionButton() {
    const [loading, setLoading] = useState(false)

    const handleManage = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/portal', {
                method: 'POST',
            })
            const data = await res.json()
            if (data.url) {
                window.location.href = data.url
            } else {
                // If 404, maybe no stripe customer yet?
                toast.error('No billing account found. Please subscribe to a plan first.')
            }
        } catch (error) {
            console.error(error)
            toast.error('Failed to open billing portal')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button variant="outline" onClick={handleManage} disabled={loading}>
            <Settings className="mr-2 h-4 w-4" />
            {loading ? 'Opening...' : 'Manage Billing'}
        </Button>
    )
}

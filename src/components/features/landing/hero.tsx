'use client'

import { Button } from '@/components/ui/button'
import { DropZone } from '@/components/features/upload/drop-zone'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ProcessingProgress, ProcessingStep } from '@/components/features/upload/processing-progress'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

export function LandingHero() {
    const router = useRouter()
    const supabase = createClient()
    const [isProcessing, setIsProcessing] = useState(false)
    const [progress, setProgress] = useState(0)

    // This will handle the file upload from the landing page
    const handleFileSelect = async (file: File) => {
        // Initiate upload flow
        setIsProcessing(true)
        setProgress(10)

        try {
            // Check auth state but proceed regardless (Guest Mode)
            const { data: { user } } = await supabase.auth.getUser()

            const formData = new FormData()
            formData.append('file', file)

            // Step 1: Upload
            const res = await fetch('/api/upload', { method: 'POST', body: formData })

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.error || `Upload failed (${res.status})`)
            }

            const data = await res.json()
            setProgress(50)

            // Step 2: Kick off processing
            const processRes = await fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversionId: data.conversionId })
            })

            if (!processRes.ok) {
                const errData = await processRes.json().catch(() => ({}))
                throw new Error(errData.error || `Processing initialization failed (${processRes.status})`)
            }

            setProgress(100)
            toast.success("Statement processed successfully!")

            // Redirect to the workbench for this specific conversion
            router.push(`/dashboard/conversions/${data.conversionId}`)

        } catch (error) {
            console.error(error)
            setIsProcessing(false)
            toast.error("Upload failed. Please try again.")
        }
    }

    return (
        <section className="relative pt-32 pb-32 overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-50 via-white to-white opacity-70"></div>

            <div className="container px-4 md:px-6 mx-auto">
                <div className="flex flex-col items-center text-center space-y-8 mb-12">
                    <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-brand-100 text-brand-700 hover:bg-brand-200/80">
                        New: Forensic Verification Mode
                    </div>

                    <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl mx-auto text-slate-900">
                        Convert Bank Statements <br className="hidden sm:inline" />
                        to <span className="text-brand-600">Excel</span> in Seconds
                    </h1>

                    <p className="mx-auto max-w-2xl text-lg text-slate-600 md:text-xl leading-relaxed">
                        The forensic-grade converter for accountants and bookkeepers.
                        Automatically verify balances, detect discrepancies, and export to Excel, CSV, or QuickBooks.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span>No credit card required</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span>Secure & Private</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span>Support for 10,000+ banks</span>
                        </div>
                    </div>
                </div>

                {/* Upload Widget */}
                <div className="max-w-3xl mx-auto relative rounded-2xl shadow-2xl bg-white p-2 ring-1 ring-slate-200/50">
                    {isProcessing ? (
                        <div className="p-12">
                            <ProcessingProgress currentStage="uploading" progress={progress} />
                        </div>
                    ) : (
                        <DropZone onFileSelect={handleFileSelect} className="border-0 bg-slate-50/50 hover:bg-slate-50 min-h-[350px]" />
                    )}
                </div>
            </div>
        </section>
    )
}

'use client'

import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ProcessingStep = 'uploading' | 'extracting' | 'analyzing' | 'reconciling' | 'completed' | 'failed'

interface ProcessingProgressProps {
    currentStage: ProcessingStep
    progress?: number
    error?: string
    className?: string
}

const steps = [
    { id: 'uploading', label: 'Uploading PDF...' },
    { id: 'extracting', label: 'Extracting transactions...' }, // mapped from extracting
    { id: 'analyzing', label: 'Analyzing data...' },
    { id: 'reconciling', label: 'Reconciling balances...' },
]

export function ProcessingProgress({ currentStage, progress, error, className }: ProcessingProgressProps) {
    const getStepStatus = (stepId: string) => {
        const stepOrder = ['uploading', 'extracting', 'analyzing', 'reconciling', 'completed']
        const currentIndex = stepOrder.indexOf(currentStage === 'failed' ? 'uploading' : currentStage)
        const stepIndex = stepOrder.indexOf(stepId)

        if (currentStage === 'failed') return 'error'
        if (stepIndex < currentIndex) return 'completed'
        if (stepIndex === currentIndex) return 'current'
        return 'pending'
    }

    const isCompleted = currentStage === 'completed'

    return (
        <div className={cn("w-full max-w-md mx-auto space-y-6 bg-white p-6 rounded-xl border shadow-sm", className)}>
            <div className="space-y-4">
                {steps.map((step) => {
                    const status = isCompleted ? 'completed' : getStepStatus(step.id)

                    return (
                        <div key={step.id} className="flex items-center gap-4">
                            <div className="flex-shrink-0">
                                {status === 'completed' && (
                                    <CheckCircle2 className="w-6 h-6 text-forensic-success" />
                                )}
                                {status === 'current' && (
                                    <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
                                )}
                                {status === 'pending' && (
                                    <Circle className="w-6 h-6 text-slate-200" />
                                )}
                                {status === 'error' && ( // Not fully implementing specific step error mapping for simplicity in MVP
                                    <Circle className="w-6 h-6 text-slate-200" />
                                )}
                            </div>
                            <div className="flex-1">
                                <p className={cn(
                                    "text-sm font-medium transition-colors",
                                    status === 'completed' ? "text-slate-900" :
                                        status === 'current' ? "text-brand-600" : "text-slate-400"
                                )}>
                                    {step.label}
                                </p>
                                {step.id === 'uploading' && status === 'current' && progress !== undefined && (
                                    <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-brand-600 transition-all duration-500 ease-out"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
                    Error: {error}
                </div>
            )}
        </div>
    )
}

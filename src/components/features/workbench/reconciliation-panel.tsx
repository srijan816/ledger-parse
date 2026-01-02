'use client'

import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

interface ReconciliationPanelProps {
    openingBalance: number
    totalCredits: number
    totalDebits: number
    calculatedClosing: number
    closingBalance: number
    isReconciled: boolean
    difference: number
    className?: string
}

export function ReconciliationPanel({
    openingBalance,
    totalCredits,
    totalDebits,
    calculatedClosing,
    closingBalance,
    isReconciled,
    difference,
    className,
}: ReconciliationPanelProps) {

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(val)
    }

    return (
        <Card className={cn("border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] rounded-none z-20", className)}>
            <div className="container mx-auto px-4 py-3">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm font-mono">

                    {/* Calculation Flow */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-6 text-slate-600">
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-400 font-sans">Opening</span>
                            <span className="font-medium text-slate-900">{formatCurrency(openingBalance)}</span>
                        </div>
                        <span className="text-slate-300 font-sans">+</span>
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-400 font-sans">Credits</span>
                            <span className="font-medium text-green-600">{formatCurrency(totalCredits)}</span>
                        </div>
                        <span className="text-slate-300 font-sans">-</span>
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-400 font-sans">Debits</span>
                            <span className="font-medium text-red-600">({formatCurrency(totalDebits)})</span>
                        </div>
                        <span className="text-slate-300 font-sans">=</span>
                        <div className="flex flex-col p-1.5 bg-slate-50 rounded border border-slate-100">
                            <span className="text-xs text-slate-400 font-sans">Calculated End</span>
                            <span className="font-bold text-slate-900">{formatCurrency(calculatedClosing)}</span>
                        </div>
                    </div>

                    {/* Comparison & Status */}
                    <div className="flex items-center gap-6 border-l pl-6 border-slate-200">
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-400 font-sans">Statement End</span>
                            <span className="font-medium text-slate-900">{formatCurrency(closingBalance)}</span>
                        </div>

                        <div className={cn(
                            "flex items-center gap-3 px-4 py-2 rounded-lg border",
                            isReconciled
                                ? "bg-green-50 border-green-200 text-green-700"
                                : "bg-red-50 border-red-200 text-red-700"
                        )}>
                            {isReconciled ? (
                                <CheckCircle2 className="w-5 h-5" />
                            ) : (
                                <AlertCircle className="w-5 h-5" />
                            )}
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
                                    {isReconciled ? 'Reconciled' : 'Discrepancy'}
                                </span>
                                {!isReconciled && (
                                    <span className="font-bold font-mono">
                                        {formatCurrency(difference)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </Card>
    )
}

import { createClient } from '@/lib/supabase/server'
import { getConversionById } from '@/lib/db/conversions'
import { getTransactionsByConversion } from '@/lib/db/transactions'
import { notFound, redirect } from 'next/navigation'
import { PDFViewer } from '@/components/features/workbench/pdf-viewer'
import { ConversionWorkbench } from '@/components/features/workbench/conversion-workbench'
import { ReconciliationPanel } from '@/components/features/workbench/reconciliation-panel'
import { ExportDialog } from '@/components/features/workbench/export-dialog'
import { ConversionPoller } from '@/components/features/workbench/conversion-poller'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default async function ConversionPage({ params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Allow guest access - don't redirect if no user
    // if (!user) {
    //     redirect('/login')
    // }

    const { id } = await params
    const conversion = await getConversionById(supabase, id)

    if (!conversion) {
        notFound()
    }

    // Only check ownership if user is logged in and conversion has a user_id
    if (user && conversion.user_id && conversion.user_id !== user.id) {
        notFound()
    }

    const transactions = await getTransactionsByConversion(supabase, id)

    return (
        <ConversionPoller
            conversionId={conversion.id}
            initialStatus={conversion.status}
        >
            <div className="flex flex-col h-[calc(100vh-4rem)] relative">
                {/* Toolbar */}
                <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-6">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/dashboard">
                            <ChevronLeft className="h-4 w-4" />
                            <span className="sr-only">Back</span>
                        </Link>
                    </Button>
                    <h1 className="font-semibold text-lg truncate flex-1">{conversion.file_name}</h1>
                    <div className="flex items-center gap-2">
                        {/* Show status badge */}
                        {conversion.status === 'processing' && (
                            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                                Processing...
                            </span>
                        )}
                        {conversion.status === 'completed' && (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                                Completed
                            </span>
                        )}
                        {conversion.status === 'failed' && (
                            <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                                Failed
                            </span>
                        )}
                        <ExportDialog
                            conversionId={conversion.id}
                            fileName={conversion.file_name}
                        />
                    </div>
                </header>

                {/* Main Content - Split View */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: PDF Viewer */}
                    <div className="w-1/2 border-r bg-slate-100 relative">
                        <PDFViewer
                            url={`/api/files/${conversion.file_path}`}
                            highlightedBbox={undefined}
                        />
                    </div>

                    {/* Right: Data Grid */}
                    <div className="w-1/2 flex flex-col bg-white">
                        <div className="flex-1 overflow-auto">
                            <ConversionWorkbench
                                conversionId={conversion.id}
                                initialTransactions={transactions}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer: Reconciliation */}
                <ReconciliationPanel
                    openingBalance={conversion.opening_balance || 0}
                    closingBalance={conversion.closing_balance || 0}
                    calculatedClosing={conversion.calculated_closing || 0}
                    isReconciled={conversion.is_reconciled}
                    totalCredits={transactions.reduce((sum, t) => sum + (t.credit || 0), 0)}
                    totalDebits={transactions.reduce((sum, t) => sum + (t.debit || 0), 0)}
                    difference={(conversion.closing_balance || 0) - (conversion.calculated_closing || 0)}
                />
            </div>
        </ConversionPoller>
    )
}

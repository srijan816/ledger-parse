import { createClient } from '@/lib/supabase/server'
import { getConversionById } from '@/lib/db/conversions'
import { getTransactionsByConversion } from '@/lib/db/transactions'
import { notFound, redirect } from 'next/navigation'
import { PDFViewer } from '@/components/features/workbench/pdf-viewer'
import { ConversionWorkbench } from '@/components/features/workbench/conversion-workbench'
import { ReconciliationPanel } from '@/components/features/workbench/reconciliation-panel'
import { ExportDialog } from '@/components/features/workbench/export-dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default async function ConversionPage({ params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { id } = await params
    const conversion = await getConversionById(supabase, id)

    if (!conversion || conversion.user_id !== user.id) {
        notFound()
    }

    const transactions = await getTransactionsByConversion(supabase, id)

    // Convert basic DB transaction type to UI compatible type if needed
    // Or pass directly if types align. 
    // We'll pass raw data to client components which can manage state.

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
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
                    {/* PDF Viewer needs a public URL. 
                 Supabase Storage URL logic: 
                 If public bucket: getPublicUrl
                 If private: createSignedUrl (expiration needed)
                 For MVP, assuming we can get a signed URL or proxy via API.
             */}
                    <PDFViewer
                        url={`/api/files/${conversion.file_path}`} // We'll need a route to proxy this securely
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
    )
}

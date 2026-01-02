import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getConversionById, updateConversionStatus, updateConversionResults } from '@/lib/db/conversions'
import { createTransactions } from '@/lib/db/transactions'
import { incrementPagesUsed } from '@/lib/db/users'
import { processDocument } from '@/lib/services/pdf-processor'

/**
 * BACKGROUND PROCESSING ENDPOINT
 * 
 * This runs the actual PDF processing work.
 * Called by /api/process in a fire-and-forget manner.
 * 
 * Has its own maxDuration to allow longer processing.
 */

export const maxDuration = 300; // 5 minutes for background processing

export async function POST(request: NextRequest) {
    // Verify internal call (basic auth check)
    const authHeader = request.headers.get('x-supabase-auth');
    if (authHeader !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversionId, userId, filePath } = await request.json();

    if (!conversionId || !filePath) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Admin client for DB operations
    const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        console.log(`[Background] Starting processing for ${conversionId}`);

        // Download file from storage
        const { data: fileData, error: downloadError } = await adminSupabase
            .storage
            .from('documents')
            .download(filePath);

        if (downloadError || !fileData) {
            throw new Error(`Failed to download file: ${downloadError?.message || 'No data'}`)
        }

        const buffer = Buffer.from(await fileData.arrayBuffer());
        console.log(`[Background] Downloaded ${buffer.length} bytes`);

        // Process the document
        const processingResult = await processDocument(buffer);

        if (!processingResult.success || processingResult.transactions.length === 0) {
            await updateConversionStatus(adminSupabase, conversionId, 'failed');
            await updateConversionResults(adminSupabase, conversionId, {
                processing_method: processingResult.method,
                extraction_confidence: 0,
                reconciliation_status: 'failed',
                error_message: processingResult.errors?.join(', ') || 'No transactions extracted',
            });

            return NextResponse.json({
                success: false,
                error: processingResult.errors?.join(', ') || 'Processing failed',
            });
        }

        // Helper for strict UTC date parsing
        const parseValidDate = (dateStr: string | null): string | null => {
            if (!dateStr) return null;

            const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) {
                const [, year, month, day] = isoMatch;
                return `${year}-${month}-${day}`;
            }

            const formats = [
                {
                    regex: /^(\d{1,2})\s+(\w{3})\s+(\d{4})/, handler: (m: RegExpMatchArray) => {
                        const months: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
                        const mon = months[m[2].toLowerCase()];
                        return mon ? `${m[3]}-${mon}-${m[1].padStart(2, '0')}` : null;
                    }
                },
                {
                    regex: /^(\w{3})\s+(\d{1,2}),?\s+(\d{4})/, handler: (m: RegExpMatchArray) => {
                        const months: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
                        const mon = months[m[1].toLowerCase()];
                        return mon ? `${m[3]}-${mon}-${m[2].padStart(2, '0')}` : null;
                    }
                },
                {
                    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})/, handler: (m: RegExpMatchArray) =>
                        `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
                },
            ];

            for (const { regex, handler } of formats) {
                const match = dateStr.match(regex);
                if (match) {
                    const result = handler(match);
                    if (result) return result;
                }
            }

            try {
                const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00Z'));
                if (!isNaN(d.getTime())) {
                    const year = d.getUTCFullYear();
                    if (year >= 1900 && year <= 2100) {
                        return `${year}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
                    }
                }
            } catch { }

            return null;
        };

        // Map transactions to DB format
        const transactionsWithIds = processingResult.transactions.map((tx, index) => {
            const amount = tx.amount ?? 0;
            const isDebit = tx.type === 'debit' || amount < 0;
            const absAmount = Math.abs(amount);

            return {
                conversion_id: conversionId,
                row_index: index,
                date: parseValidDate(tx.date),
                description: tx.description,
                debit: isDebit ? absAmount : null,
                credit: !isDebit ? absAmount : null,
                balance: tx.balance,
                confidence_score: typeof tx.confidence === 'number' ? tx.confidence * 100 : 0,
                needs_review: (tx.confidence ?? 0) < 0.7,
                ocr_text_raw: tx.rawText || tx.description,
            };
        });

        // Save transactions
        await createTransactions(adminSupabase, transactionsWithIds);

        // Update conversion results
        await updateConversionResults(adminSupabase, conversionId, {
            processing_method: processingResult.method,
            extraction_confidence: processingResult.confidence * 100,
            opening_balance: processingResult.openingBalance,
            closing_balance: processingResult.closingBalance,
            calculated_closing: processingResult.calculatedClosing,
            reconciliation_status: processingResult.isReconciled ? 'matched' : 'discrepancy',
            reconciliation_difference: processingResult.reconciliationDifference,
            page_count: processingResult.pageCount,
            bank_detected: processingResult.bankDetected,
            error_message: null,
        });

        // Mark as completed
        await updateConversionStatus(adminSupabase, conversionId, 'completed');

        // Increment usage
        if (userId) {
            await incrementPagesUsed(adminSupabase, userId, processingResult.pageCount || 1);
        }

        console.log(`[Background] Completed processing for ${conversionId}: ${processingResult.transactions.length} transactions`);

        return NextResponse.json({
            success: true,
            transactionCount: processingResult.transactions.length,
            method: processingResult.method,
        });

    } catch (error: any) {
        console.error(`[Background] Error processing ${conversionId}:`, error);

        // Mark as failed
        try {
            await updateConversionStatus(adminSupabase, conversionId, 'failed');
            await updateConversionResults(adminSupabase, conversionId, {
                error_message: error.message || 'Unknown processing error',
            });
        } catch { }

        return NextResponse.json({
            success: false,
            error: error.message || 'Processing failed',
        }, { status: 500 });
    }
}

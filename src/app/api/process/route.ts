import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { getConversionById, updateConversionStatus, updateConversionResults } from '@/lib/db/conversions'
import { createTransactions } from '@/lib/db/transactions'
import { processSchema } from '@/lib/utils/validation'
import { incrementPagesUsed, getUserById } from '@/lib/db/users'
import { getOrCreateGuestUser } from '@/lib/guest-manager'

// Use new Advanced PDF Engine
import { processDocument } from '@/lib/services/pdf-processor'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerClient()

        // Admin client for RLS bypass
        const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: { user } } = await supabase.auth.getUser()

        const body = await request.json()
        const result = processSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
        }

        // Check Usage Limit (Only for logged-in users)
        if (user) {
            const profile = await getUserById(supabase, user.id)
            if (profile) {
                const used = profile.pages_used_this_month || 0
                const limit = profile.pages_limit || 5

                if (used >= limit) {
                    return NextResponse.json(
                        { error: 'Monthly limit reached. Please upgrade your plan.' },
                        { status: 403 }
                    )
                }
            }
        }

        const { conversionId } = result.data
        let conversion;
        try {
            // Use admin client to fetch conversion (in case guest RLS blocks reading)
            conversion = await getConversionById(adminSupabase, conversionId)
        } catch (e) {
            console.warn('Conversion lookup failed:', e);
            // If it throws, we assume it's not found or permission issue
            conversion = null;
        }

        // Check ownership or guest access
        const guestUserId = await getOrCreateGuestUser(adminSupabase)

        // Safety check if retrieval failed
        if (!conversion) {
            return NextResponse.json({ error: 'Conversion not found or unauthorized' }, { status: 404 })
        }

        const isOwner = user && conversion.user_id === user.id
        const isGuestConversion = conversion.user_id === guestUserId

        if (!isOwner && !isGuestConversion) {
            return NextResponse.json({ error: 'Conversion not found or unauthorized' }, { status: 404 })
        }

        // Update status to processing (Using admin client)
        await updateConversionStatus(adminSupabase, conversionId, 'processing')

        // Fetch File from Storage (Using admin client)
        const { data: fileData, error: fileError } = await adminSupabase
            .storage
            .from('documents')
            .download(conversion.file_path)

        if (fileError || !fileData) {
            console.error('File Download Error:', fileError)
            await updateConversionStatus(adminSupabase, conversionId, 'failed', 'File download failed')
            return NextResponse.json({ error: 'File download failed' }, { status: 500 })
        }

        const buffer = Buffer.from(await fileData.arrayBuffer())

        // Run Advanced PDF Engine
        // Note: For scanned docs, this calls Python Worker. If worker is down, it might fail or return native/errors.
        const processingResult = await processDocument(buffer)

        if (processingResult.success) {
            // Update Usage for User
            if (user) {
                await incrementPagesUsed(adminSupabase, user.id, processingResult.pageCount)
            }

            // Save Transactions
            // Map the new engine's transaction format to DB schema
            // Helper to validate dates - STRICT UTC PARSING to avoid timezone shifts
            const parseValidDate = (dateStr: string | null): string | null => {
                if (!dateStr) return null;

                // Try to parse as YYYY-MM-DD (ISO format) directly without timezone conversion
                const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (isoMatch) {
                    const [, year, month, day] = isoMatch;
                    return `${year}-${month}-${day}`;
                }

                // Try common date formats and convert to YYYY-MM-DD string directly
                // This avoids Date object timezone issues
                const formats = [
                    // DD Mon YYYY or D Mon YYYY
                    {
                        regex: /^(\d{1,2})\s+(\w{3})\s+(\d{4})/, handler: (m: RegExpMatchArray) => {
                            const months: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
                            const mon = months[m[2].toLowerCase()];
                            return mon ? `${m[3]}-${mon}-${m[1].padStart(2, '0')}` : null;
                        }
                    },
                    // Mon DD, YYYY
                    {
                        regex: /^(\w{3})\s+(\d{1,2}),?\s+(\d{4})/, handler: (m: RegExpMatchArray) => {
                            const months: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
                            const mon = months[m[1].toLowerCase()];
                            return mon ? `${m[3]}-${mon}-${m[2].padStart(2, '0')}` : null;
                        }
                    },
                    // MM/DD/YYYY
                    {
                        regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})/, handler: (m: RegExpMatchArray) =>
                            `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
                    },
                    // MM-DD-YYYY
                    {
                        regex: /^(\d{1,2})-(\d{1,2})-(\d{4})/, handler: (m: RegExpMatchArray) =>
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

                // Fallback: try Date parsing but force to UTC string
                try {
                    // Append Z to force UTC interpretation
                    const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00Z'));
                    if (!isNaN(d.getTime())) {
                        const year = d.getUTCFullYear();
                        if (year >= 1900 && year <= 2100) {
                            return `${year}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
                        }
                    }
                } catch {
                    // Ignore date parsing errors
                }

                return null;
            };

            const transactionsWithIds = processingResult.transactions.map((tx, index) => {
                // Determine debit/credit from amount and type
                const amount = tx.amount ?? 0;
                const isDebit = tx.type === 'debit' || amount < 0;
                const absAmount = Math.abs(amount);

                return {
                    conversion_id: conversionId,
                    row_index: index,
                    date: parseValidDate(tx.date),
                    description: tx.description,
                    debit: isDebit ? absAmount : null,
                    credit: !isDebit && amount !== 0 ? absAmount : null,
                    balance: tx.balance,
                    // Fix: 0 confidence should stay 0, not become 100.
                    confidence_score: typeof tx.confidence === 'number' ? tx.confidence * 100 : 100,
                    pdf_page: tx.bbox?.page || null,
                    pdf_bbox: tx.bbox || null,
                    raw_text: tx.rawText || null
                };
            });

            await createTransactions(adminSupabase, transactionsWithIds)

            // Update Conversion Record with rich metadata
            await updateConversionResults(adminSupabase, conversionId, {
                status: 'completed',
                bank_detected: processingResult.bankDetected || undefined,
                page_count: processingResult.pageCount,
                opening_balance: processingResult.openingBalance || undefined,
                closing_balance: processingResult.closingBalance || undefined,
                calculated_closing: processingResult.calculatedClosing || undefined,
                is_reconciled: processingResult.isReconciled,
                reconciliation_difference: processingResult.reconciliationDifference || undefined,
                processing_completed_at: new Date().toISOString()
            })

            return NextResponse.json({ success: true, status: 'completed' })
        } else {
            console.error('Processing Failed:', processingResult.errors)
            const errorMsg = processingResult.errors.length > 0 ? processingResult.errors.join(', ') : 'Processing failed'
            await updateConversionStatus(adminSupabase, conversionId, 'failed', errorMsg)
            return NextResponse.json({ error: errorMsg }, { status: 500 })
        }

    } catch (error: any) {
        console.error('Process API Error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}

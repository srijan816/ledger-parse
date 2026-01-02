import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConversionById } from '@/lib/db/conversions'
import { getTransactionsByConversion } from '@/lib/db/transactions'
import { exportSchema } from '@/lib/utils/validation'
import * as XLSX from 'xlsx'
import { Transaction } from '@/types/transaction'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await request.json()
        const result = exportSchema.safeParse(body)
        if (!result.success) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
        }

        const { conversionId, format, includeExcluded } = result.data

        const conversion = await getConversionById(supabase, conversionId)
        const isOwner = user && conversion.user_id === user.id
        const isGuest = !conversion.user_id

        if (!conversion || (!isOwner && !isGuest)) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        let transactions = await getTransactionsByConversion(supabase, conversionId)

        // Filter excluded
        if (!includeExcluded) {
            transactions = transactions.filter((t: Transaction) => !t.isExcluded)
        }

        // Check if we have account info (from Gemini multi-account extraction)
        // Account info would be stored in raw_text or a dedicated field if we save it
        // For now, group by account if raw_text contains account info, otherwise single account

        // Transform data for export with account column
        const exportData = transactions.map((t: Transaction, index: number) => ({
            '#': index + 1,
            Date: t.date,
            Description: t.description,
            Debit: t.debit || '',
            Credit: t.credit || '',
            Balance: t.balance || '',
            'Confidence %': t.confidence_score ? Math.round(t.confidence_score) : '',
        }))

        // Calculate summary
        const totalDebits = transactions.reduce((sum: number, t: Transaction) => sum + (t.debit || 0), 0)
        const totalCredits = transactions.reduce((sum: number, t: Transaction) => sum + (t.credit || 0), 0)
        const netChange = totalCredits - totalDebits

        const summaryData = [
            { Metric: 'Bank Detected', Value: conversion.bank_detected || 'Unknown' },
            { Metric: 'Statement Period', Value: `${conversion.statement_period_start || 'N/A'} to ${conversion.statement_period_end || 'N/A'}` },
            { Metric: 'Total Transactions', Value: transactions.length },
            { Metric: 'Opening Balance', Value: conversion.opening_balance || 'N/A' },
            { Metric: 'Closing Balance (Statement)', Value: conversion.closing_balance || 'N/A' },
            { Metric: 'Calculated Closing', Value: conversion.calculated_closing || 'N/A' },
            { Metric: 'Total Credits', Value: totalCredits.toFixed(2) },
            { Metric: 'Total Debits', Value: totalDebits.toFixed(2) },
            { Metric: 'Net Change', Value: netChange.toFixed(2) },
            { Metric: 'Reconciled', Value: conversion.is_reconciled ? 'Yes ✓' : 'No ✗' },
            { Metric: 'Discrepancy', Value: conversion.reconciliation_difference ? `$${conversion.reconciliation_difference.toFixed(2)}` : 'N/A' },
        ]

        if (format === 'csv') {
            const worksheet = XLSX.utils.json_to_sheet(exportData)
            const csvOutput = XLSX.utils.sheet_to_csv(worksheet)

            return new NextResponse(csvOutput, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="${conversion.file_name?.replace('.pdf', '')}.csv"`
                }
            })

        } else if (format === 'xlsx') {
            // Excel generation with multiple sheets
            const workbook = XLSX.utils.book_new()

            // Sheet 1: Summary
            const summarySheet = XLSX.utils.json_to_sheet(summaryData)
            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

            // Sheet 2: All Transactions
            const transactionSheet = XLSX.utils.json_to_sheet(exportData)

            // Set column widths for better readability
            transactionSheet['!cols'] = [
                { wch: 5 },   // #
                { wch: 12 },  // Date
                { wch: 50 },  // Description
                { wch: 15 },  // Debit
                { wch: 15 },  // Credit
                { wch: 15 },  // Balance
                { wch: 12 },  // Confidence
            ]

            XLSX.utils.book_append_sheet(workbook, transactionSheet, 'All Transactions')

            // If we have account breakdown from conversion metadata, add per-account sheets
            // This would require storing account data in the conversion record
            // For now, we'll use the conversion's raw metadata if available

            const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

            return new NextResponse(buf, {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="${conversion.file_name?.replace('.pdf', '')}.xlsx"`
                }
            })

        } else if (format === 'qbo') {
            // QBO (OFX) generation
            const nowStr = new Date().toISOString().replace(/[-T:]/g, '').split('.')[0]
            const bankName = conversion.bank_detected || 'Unknown Bank'

            let ofx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>${nowStr}
<LANGUAGE>ENG
<INTU.BID>3000
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<BANKID>999999999
<ACCTID>${conversion.id.substring(0, 10)}
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>${nowStr}
<DTEND>${nowStr}
`
            transactions.forEach((t: Transaction, index: number) => {
                const dateObj = new Date(t.date || '')
                const dateStr = !isNaN(dateObj.getTime())
                    ? dateObj.toISOString().replace(/[-T:]/g, '').split('.')[0].substring(0, 8)
                    : nowStr.substring(0, 8)

                const amount = t.debit ? -Math.abs(t.debit) : (t.credit || 0)
                const type = amount < 0 ? 'DEBIT' : 'CREDIT'

                ofx += `<STMTTRN>
<TRNTYPE>${type}
<DTPOSTED>${dateStr}
<TRNAMT>${amount.toFixed(2)}
<FITID>${t.id || index}
<NAME>${(t.description || '').substring(0, 32)}
<MEMO>${t.description || ''}
</STMTTRN>
`
            })

            const closingBal = conversion.closing_balance || 0

            ofx += `</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>${closingBal.toFixed(2)}
<DTASOF>${nowStr}
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`

            return new NextResponse(ofx, {
                headers: {
                    'Content-Type': 'application/vnd.intuit.qbo',
                    'Content-Disposition': `attachment; filename="${conversion.file_name?.replace('.pdf', '')}.qbo"`
                }
            })

        } else {
            return NextResponse.json({ error: 'Format not supported yet' }, { status: 400 })
        }

    } catch (error: any) {
        console.error('Export API Error:', error)
        return NextResponse.json({ error: 'Export failed' }, { status: 500 })
    }
}

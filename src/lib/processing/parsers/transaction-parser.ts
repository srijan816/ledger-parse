import { Transaction } from '@/types/transaction'
import { BankName } from '../detectors/bank-detector'

interface ParseResult {
    transactions: Partial<Transaction>[]
    openingBalance?: number
    closingBalance?: number
}

// Simple regex for date MM/DD/YYYY or MM/DD/YY
const DATE_REGEX = /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/

// Simple regex for currency amount (e.g. 1,234.56 or -1234.56)
const AMOUNT_REGEX = /(-?\$?[\d,]+\.\d{2})/g

export function parseTransactions(text: string, bank: BankName): ParseResult {
    const lines = text.split('\n')
    const transactions: Partial<Transaction>[] = []
    let rowIndex = 0

    // Very naive parser for MVP demonstration
    // Real implementation relies on specific bank strategies or LLM

    lines.forEach((line) => {
        // Check if line starts with a date
        const dateMatch = line.match(DATE_REGEX)

        if (dateMatch) {
            // Assuming format: Date | Description | ... | Amount ... 
            // This is highly variable, but serves as a placeholder logic
            const date = dateMatch[0]
            const description = line.replace(date, '').trim()

            // Try to find amounts
            const amounts = line.match(AMOUNT_REGEX)

            if (amounts && amounts.length > 0) {
                // Heuristic: If 2 amounts, maybe Debit/Credit or Amount/Balance
                // For now, let's just take the first amount found as a generic 'amount'
                // and try to classify it based on sign or context if possible.
                // Simplification:
                const rawAmount = parseFloat(amounts[0].replace(/[^0-9.-]/g, ''))

                let debit = null
                let credit = null

                if (rawAmount < 0) {
                    debit = Math.abs(rawAmount)
                } else {
                    credit = rawAmount
                }

                transactions.push({
                    rowIndex: rowIndex++,
                    date,
                    description: description.substring(0, 50), // Truncate description for clean display
                    debit,
                    credit,
                    confidenceScore: 80, // Lower confidence for naive regex
                    isExcluded: false,
                    rawText: line
                })
            }
        }
    })

    return {
        transactions,
        openingBalance: 0, // Would need dedicated regex for "Opening Balance" line
        closingBalance: 0
    }
}

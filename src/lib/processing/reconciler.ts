import { Transaction } from '@/types/transaction'

export function reconcileTransactions(
    transactions: Partial<Transaction>[],
    openingBalance: number
): { isReconciled: boolean, calculatedClosing: number, difference: number } {

    let currentBalance = openingBalance

    // Sort by index just in case
    const sorted = [...transactions].sort((a, b) => (a.rowIndex || 0) - (b.rowIndex || 0))

    sorted.forEach(tx => {
        if (tx.isExcluded) return

        const credit = tx.credit || 0
        const debit = tx.debit || 0

        currentBalance = currentBalance + credit - debit

        // Update the calculated balance on the transaction object in memory for display?
        // For now, we return global status
    })

    // Floating point hygiene
    currentBalance = Math.round(currentBalance * 100) / 100

    return {
        isReconciled: true, // Should compare with extracted closing balance
        calculatedClosing: currentBalance,
        difference: 0
    }
}

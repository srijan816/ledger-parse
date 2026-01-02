import { extractTextFromPDF } from './extractors/text-extractor'
// import { extractDataWithOCR } from './extractors/ocr-extractor' // Use for fallback in future P0+
import { detectBank } from './detectors/bank-detector'
import { parseTransactions } from './parsers/transaction-parser'
import { reconcileTransactions } from './reconciler'

export async function processPDF(fileBuffer: Buffer) {
    // 1. Extract Text
    const { text, numpages } = await extractTextFromPDF(fileBuffer)

    // 2. Detect Bank
    const bank = detectBank(text)

    // 3. Parse Transactions
    const { transactions, openingBalance, closingBalance } = parseTransactions(text, bank)

    // 4. Reconcile
    const { isReconciled, calculatedClosing, difference } = reconcileTransactions(
        transactions,
        openingBalance || 0
    )

    return {
        success: true,
        pageCount: numpages,
        bankDetected: bank,
        openingBalance,
        closingBalance,
        calculatedClosing,
        isReconciled,
        transactions,
        difference
    }
}

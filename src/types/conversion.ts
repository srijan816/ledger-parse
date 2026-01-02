import { Transaction } from './transaction'

export type ConversionStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Conversion {
    id: string
    userId: string | null
    fileName: string
    fileSize: number
    filePath: string
    pageCount: number
    bankDetected: string | null
    status: ConversionStatus
    errorMessage: string | null
    openingBalance: number | null
    closingBalance: number | null
    calculatedClosing: number | null
    isReconciled: boolean
    reconciliationDifference: number | null
    processingStartedAt: string | null
    processingCompletedAt: string | null
    createdAt: string
    updatedAt: string
}

export interface ConversionWithTransactions extends Conversion {
    transactions: Transaction[]
}

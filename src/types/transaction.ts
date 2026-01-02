export interface BoundingBox {
    x1: number
    y1: number
    x2: number
    y2: number
}

export interface Transaction {
    id: string
    conversionId: string
    rowIndex: number
    date: string | null // ISO date string
    description: string
    debit: number | null
    credit: number | null
    balance: number | null
    confidenceScore: number
    isExcluded: boolean
    isHeader: boolean
    pdfPage: number
    pdfBbox: BoundingBox | null
    rawText: string
    createdAt?: string
    updatedAt?: string
}

export type TransactionColumn = keyof Transaction

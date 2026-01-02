'use client'

import { useState, useEffect } from 'react'
import { Transaction } from '@/types/transaction'
import { DataGrid } from '@/components/features/workbench/data-grid'
import { toast } from 'sonner'

interface ConversionWorkbenchProps {
    conversionId: string
    initialTransactions: Transaction[]
}

export function ConversionWorkbench({ conversionId, initialTransactions }: ConversionWorkbenchProps) {
    const [transactions, setTransactions] = useState(initialTransactions)

    // Sync state when initialTransactions changes (e.g., after router.refresh())
    useEffect(() => {
        setTransactions(initialTransactions)
    }, [initialTransactions])

    const handleCellEdit = async (transactionId: string, field: string, value: any) => {
        // Optimistic update
        setTransactions(prev => prev.map(t =>
            t.id === transactionId ? { ...t, [field]: value } : t
        ))

        try {
            const res = await fetch(`/api/transactions/${transactionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value })
            })

            if (!res.ok) throw new Error('Failed to update')

        } catch (error) {
            console.error(error)
            toast.error('Failed to save changes')
            // Revert changes (would need previous state or re-fetch)
        }
    }

    const handleRowExclude = async (transaction: Transaction) => {
        const newStatus = !transaction.isExcluded

        // Optimistic update
        setTransactions(prev => prev.map(t =>
            t.id === transaction.id ? { ...t, isExcluded: newStatus } : t
        ))

        try {
            const res = await fetch(`/api/transactions/${transaction.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isExcluded: newStatus })
            })

            if (!res.ok) throw new Error('Failed to update')

        } catch (error) {
            console.error(error)
            toast.error('Failed to update row status')
        }
    }

    return (
        <DataGrid
            initialData={transactions}
            onCellEdit={handleCellEdit}
            onRowExclude={handleRowExclude}
        />
    )
}

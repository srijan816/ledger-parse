import { SupabaseClient } from '@supabase/supabase-js'
import { Transaction } from '@/types/transaction'

export async function createTransactions(
    supabase: SupabaseClient,
    transactions: any[]
) {
    if (transactions.length === 0) return []

    const { data, error } = await supabase
        .from('transactions')
        .insert(transactions)
        .select()

    if (error) throw error
    return data
}

export async function getTransactionsByConversion(
    supabase: SupabaseClient,
    conversionId: string
) {
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('conversion_id', conversionId)
        .order('row_index', { ascending: true })

    if (error) throw error
    return data
}

export async function updateTransaction(
    supabase: SupabaseClient,
    id: string,
    updates: Partial<Transaction>
) {
    const { data, error } = await supabase
        .from('transactions')
        .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function excludeTransaction(
    supabase: SupabaseClient,
    id: string,
    isExcluded: boolean
) {
    const { data, error } = await supabase
        .from('transactions')
        .update({
            is_excluded: isExcluded,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

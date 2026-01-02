import { SupabaseClient } from '@supabase/supabase-js'
import { Conversion, ConversionStatus } from '@/types/conversion'

export async function createConversion(
    supabase: SupabaseClient,
    data: any
) {
    const { data: conversion, error } = await supabase
        .from('conversions')
        .insert(data)
        .select()
        .single()

    if (error) throw error
    return conversion
}

export async function getConversionById(supabase: SupabaseClient, id: string) {
    const { data, error } = await supabase
        .from('conversions')
        .select('*')
        .eq('id', id)
        .single()

    if (error) throw error
    return data
}

export async function getConversionsByUser(
    supabase: SupabaseClient,
    userId: string,
    limit = 20,
    offset = 0
) {
    const { data, error, count } = await supabase
        .from('conversions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

    if (error) throw error
    return { data, count }
}

export async function updateConversionStatus(
    supabase: SupabaseClient,
    id: string,
    status: ConversionStatus,
    errorMessage?: string
) {
    const { data, error } = await supabase
        .from('conversions')
        .update({
            status,
            error_message: errorMessage,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateConversionResults(
    supabase: SupabaseClient,
    id: string,
    results: any
) {
    const { data, error } = await supabase
        .from('conversions')
        .update({
            ...results,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

import { SupabaseClient } from '@supabase/supabase-js'

export async function getUserById(supabase: SupabaseClient, id: string) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()

    if (error) throw error
    return data
}

export async function updateUserSubscription(
    supabase: SupabaseClient,
    id: string,
    tier: 'free' | 'starter' | 'professional' | 'enterprise',
    status: 'active' | 'canceled' | 'past_due'
) {
    const { data, error } = await supabase
        .from('profiles')
        .update({
            subscription_tier: tier,
            subscription_status: status,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function incrementPagesUsed(supabase: SupabaseClient, id: string, count: number) {
    // RPC call would be atomic, but for MVP we'll read-then-write or use simple increment if possible.
    // Since we don't have an RPC function set up for this yet, we will fetch and update.
    // Ideally: supabase.rpc('increment_pages', { user_id: id, count })

    const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('pages_used_this_month')
        .eq('id', id)
        .single()

    if (fetchError) throw fetchError

    const newCount = (profile?.pages_used_this_month || 0) + count

    const { data, error } = await supabase
        .from('profiles')
        .update({
            pages_used_this_month: newCount,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function resetMonthlyUsage(supabase: SupabaseClient, id: string) {
    const { data, error } = await supabase
        .from('profiles')
        .update({
            pages_used_this_month: 0,
            billing_cycle_start: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

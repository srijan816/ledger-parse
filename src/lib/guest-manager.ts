import { SupabaseClient } from '@supabase/supabase-js'

const GUEST_EMAIL = 'guest-bot@ledgerparse.internal'

// Simple in-memory cache to avoid repeated DB hits
let cachedGuestUserId: string | null = null

export async function getOrCreateGuestUser(supabaseAdmin: SupabaseClient): Promise<string> {
    if (cachedGuestUserId) return cachedGuestUserId

    // 1. Try to find existing guest user
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()

    if (!listError && users) {
        const existing = users.find(u => u.email === GUEST_EMAIL)
        if (existing) {
            cachedGuestUserId = existing.id
            // Ensure profile exists
            await ensureProfileExists(supabaseAdmin, existing.id, existing.email!)
            return existing.id
        }
    }

    // 2. Create if not exists
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: GUEST_EMAIL,
        email_confirm: true,
        password: 'guest-password-super-secure-123', // Not used for login
        user_metadata: { full_name: 'Guest User' }
    })

    if (createError) {
        console.error('Failed to create guest user:', createError)
        throw new Error('Failed to initialize guest system')
    }

    cachedGuestUserId = newUser.user.id
    await ensureProfileExists(supabaseAdmin, newUser.user.id, GUEST_EMAIL)

    return newUser.user.id
}

async function ensureProfileExists(supabase: SupabaseClient, userId: string, email: string) {
    const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single()

    if (!profile) {
        await supabase.from('profiles').insert({
            id: userId,
            email: email,
            full_name: 'Guest User',
            subscription_tier: 'free',
            subscription_status: 'active',
            pages_limit: 1000 // Generous limit for the shared guest user
        })
    }
}

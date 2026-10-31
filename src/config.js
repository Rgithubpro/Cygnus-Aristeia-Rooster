// Both values are PUBLIC by design: they only allow calling the functions in
// supabase/schema.sql, and those check a class password. Safe to commit.
// Supabase dashboard -> Project Settings -> API (Project URL + anon/publishable key).
export const SUPABASE_URL = 'https://ijkfnntmrkqkoqymbixo.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_ZPrw5X2bkh6S0Ig6owQf9g_P6vA5btL'

export const isGeconfigureerd = () => !SUPABASE_URL.includes('JOUW')

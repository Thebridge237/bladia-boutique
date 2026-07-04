import { createClient } from '@supabase/supabase-js'

// Ces valeurs sont sûres à exposer publiquement : c'est la clé "anon/publishable",
// prévue pour être utilisée côté navigateur. La sécurité réelle est assurée par les
// règles RLS (Row Level Security) définies dans Supabase.
const supabaseUrl = 'https://rajlislwqqnssnehctid.supabase.co'
const supabaseKey = 'sb_publishable_78seTU1uVNmjt7gYiqKRpQ_XJMwwGn1'

export const supabase = createClient(supabaseUrl, supabaseKey)

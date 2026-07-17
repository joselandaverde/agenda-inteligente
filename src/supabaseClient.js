import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uxpktmrurvxqigiiharn.supabase.co';
const supabaseAnonKey = 'sb_publishable_UWLfZ0xy0jqGlJ5gQZGsNA_uDLKp1Nu';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

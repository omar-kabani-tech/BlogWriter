/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jqazxlfswxawybjjgcna.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxYXp4bGZzd3hhd3liampnY25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDA0MTgsImV4cCI6MjA4NzYxNjQxOH0.psSBFmcsbFJx181q17BABRSVsnC2q62SvF2G9KSqeSI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

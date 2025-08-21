import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fpqpjorymcoyghhcrbvc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwcXBqb3J5bWNveWdoaGNyYnZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3Mjg1NDksImV4cCI6MjA3MTMwNDU0OX0.JTWCiH_oU7kzeGCdvHkzcyE6x0CMcDuujTSUCrpr54A';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ptfvdpryxzvkkcquaqbk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0ZnZkcHJ5eHp2a2tjcXVhcWJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMjc4ODAsImV4cCI6MjA4NzgwMzg4MH0.oAkFb5p9MGLewjRa3dQG2TSdFpM0tAxfmh2LNNixti4'

export const supabase = createClient(supabaseUrl, supabaseKey)

// FieldVoice Pro - Shared Configuration
// This is the single source of truth for Supabase credentials and app constants

const SUPABASE_URL = 'https://wejwhplqnhciyxbinivx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlandocGxxbmhjaXl4YmluaXZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NzkwNDUsImV4cCI6MjA4NTE1NTA0NX0.xFHzf7QpnHSnIuWR8ZmotaDzlZ2zwh_sEpzDLE3-JG4';

// Initialize Supabase client (requires @supabase/supabase-js to be loaded first)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============ POWERSYNC ============
// PowerSync credentials and token are defined in js/powersync.js
// The development token expires every ~12 hours and needs to be refreshed
// Get a new token from: https://powersync.journeyapps.com/ → Your Instance → Connect
//
// To initialize PowerSync after page load:
//   await initPowerSync();
//
// PowerSync URL: https://697d5b91d930100f50158b4f.powersync.journeyapps.com
// See js/powersync.js for the full schema and helper functions

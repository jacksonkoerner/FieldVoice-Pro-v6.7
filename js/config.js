// FieldVoice Pro - Shared Configuration
// This is the single source of truth for Supabase credentials and app constants

const SUPABASE_URL = 'https://lpzjiporaieedxdsufcq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwemppcG9yYWllZWR4ZHN1ZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MjM0MzIsImV4cCI6MjA4NTM5OTQzMn0.5cBPVkyheEvNOE6my91EaX2TcYn18WYaN_v3iHEusHg';

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

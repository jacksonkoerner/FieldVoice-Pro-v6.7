// FieldVoice Pro - Main Entry Point
// This module initializes Supabase and PowerSync before other scripts run

import { createClient } from '@supabase/supabase-js';
import { initPowerSync, getSyncStatus } from './powersync.js';

// ============ SUPABASE INITIALIZATION ============
const SUPABASE_URL = 'https://wejwhplqnhciyxbinivx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlandocGxxbmhjaXl4YmluaXZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NzkwNDUsImV4cCI6MjA4NTE1NTA0NX0.xFHzf7QpnHSnIuWR8ZmotaDzlZ2zwh_sEpzDLE3-JG4';

// Create and expose Supabase client globally
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabaseClient;
window.supabase = { createClient }; // For compatibility with existing code

console.log('[Main] Supabase client initialized');

// ============ POWERSYNC INITIALIZATION ============
// Initialize PowerSync after DOM is ready
async function initApp() {
    try {
        await initPowerSync();
        console.log('[Main] PowerSync initialized successfully');

        // Update sync status indicator if it exists
        updateSyncStatusUI();
    } catch (error) {
        console.error('[Main] PowerSync initialization failed:', error);
        updateSyncStatusUI();
        // App continues to work - PowerSync will retry on next page load
    }
}

// Update sync status indicator (used on index.html and other pages)
function updateSyncStatusUI() {
    const indicator = document.getElementById('syncStatusIndicator');
    if (!indicator) return;

    const status = getSyncStatus();

    if (status.syncing) {
        indicator.innerHTML = '<i class="fas fa-sync-alt fa-spin text-xs text-dot-yellow"></i>';
        indicator.title = 'Syncing...';
    } else if (status.connected) {
        indicator.innerHTML = '<i class="fas fa-check-circle text-xs text-safety-green"></i>';
        indicator.title = 'Synced';
    } else if (status.error) {
        indicator.innerHTML = '<i class="fas fa-exclamation-circle text-xs text-red-500"></i>';
        indicator.title = 'Sync error: ' + status.error;
    } else {
        indicator.innerHTML = '<i class="fas fa-circle text-xs text-slate-400"></i>';
        indicator.title = 'Not connected';
    }
}

// Expose for pages that need to update status
window.updateSyncStatusUI = updateSyncStatusUI;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

console.log('[Main] Module loaded');

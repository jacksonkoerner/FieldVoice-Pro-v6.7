// FieldVoice Pro - Main Entry Point
// This module initializes Supabase and PowerSync before other scripts run
// All shared utilities are imported here so Vite bundles them

import { createClient } from '@supabase/supabase-js';
import { initPowerSync, getSyncStatus } from './powersync.js';

// ============ SHARED UTILITIES ============
// These are side-effect imports - they set up window globals
import './storage-keys.js';
import './indexeddb-utils.js';
import './ui-utils.js';
import './pwa-utils.js';
import './supabase-utils.js';
import './report-rules.js';
import './lock-manager.js';
import './media-utils.js';
import './data-layer.js';
import './sync-manager.js';

// ============ SUPABASE INITIALIZATION ============
const SUPABASE_URL = 'https://lpzjiporaieedxdsufcq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwemppcG9yYWllZWR4ZHN1ZmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MjM0MzIsImV4cCI6MjA4NTM5OTQzMn0.5cBPVkyheEvNOE6my91EaX2TcYn18WYaN_v3iHEusHg';

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

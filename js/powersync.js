// FieldVoice Pro - PowerSync Integration
// Provides offline-first sync with Supabase via PowerSync

import { PowerSyncDatabase, Schema, Table, column } from '@powersync/web';

// ============ POWERSYNC CREDENTIALS ============
// PowerSync uses Supabase Auth tokens for authentication
const POWERSYNC_URL = 'https://697d5b91d930100f50158b4f.powersync.journeyapps.com';

// ============ POWERSYNC SCHEMA ============
// Define all tables that sync with Supabase
// This must match your Supabase schema and PowerSync sync rules

const userProfiles = new Table(
    {
        device_id: column.text,
        full_name: column.text,
        title: column.text,
        company: column.text,
        email: column.text,
        phone: column.text,
        preferences: column.text,
        created_at: column.text,
        updated_at: column.text
    },
    { name: 'user_profiles' }
);

const projects = new Table(
    {
        project_name: column.text,
        location: column.text,
        status: column.text,
        prime_contractor: column.text,
        engineer: column.text,
        logo: column.text,
        cno_solicitation_no: column.text,
        noab_project_no: column.text,
        contract_duration: column.text,
        notice_to_proceed: column.text,
        expected_completion: column.text,
        weather_days: column.integer,
        default_start_time: column.text,
        default_end_time: column.text,
        created_at: column.text,
        updated_at: column.text,
        created_by: column.text
    },
    { name: 'projects' }
);

const contractors = new Table(
    {
        project_id: column.text,
        name: column.text,
        company: column.text,
        abbreviation: column.text,
        type: column.text,
        trades: column.text,
        status: column.text,
        added_date: column.text,
        removed_date: column.text,
        created_at: column.text,
        updated_at: column.text
    },
    { name: 'contractors' }
);

const activeReports = new Table(
    {
        project_id: column.text,
        device_id: column.text,
        report_date: column.text,
        status: column.text,
        started_at: column.text,
        started_by: column.text,
        last_heartbeat: column.text,
        inspector_name: column.text // Name of inspector for display in lock UI
    },
    { name: 'active_reports' }
);

const aiRequests = new Table(
    {
        active_report_id: column.text,
        request_payload: column.text, // JSON string
        webhook_url: column.text,
        created_at: column.text
    },
    { name: 'ai_requests' }
);

const aiResponses = new Table(
    {
        ai_request_id: column.text,
        active_report_id: column.text,
        generated_content: column.text,
        raw_response: column.text, // JSON string
        created_at: column.text
    },
    { name: 'ai_responses' }
);

const finalReports = new Table(
    {
        project_id: column.text,
        active_report_id: column.text,
        report_date: column.text,
        submitted_at: column.text,
        submitted_by: column.text,
        executive_summary: column.text,
        work_performed: column.text,
        materials_used: column.text,
        delays_issues: column.text,
        inspector_notes: column.text,
        // Weather fields
        general_condition: column.text,
        high_temp: column.integer,
        low_temp: column.integer,
        precipitation: column.text,
        wind_speed: column.text,
        humidity: column.text,
        // Has flags
        has_work_performed: column.integer,
        has_materials: column.integer,
        has_delays: column.integer,
        has_visitors: column.integer,
        has_safety: column.integer,
        has_photos: column.integer,
        // JSON data fields
        work_performed_json: column.text,
        materials_json: column.text,
        delays_json: column.text,
        visitors_json: column.text,
        safety_json: column.text,
        photos_json: column.text,
        // Notes fields
        work_performed_notes: column.text,
        materials_notes: column.text,
        delays_notes: column.text,
        visitors_notes: column.text,
        safety_notes: column.text,
        // PDF fields
        pdf_url: column.text,
        pdf_storage_path: column.text,
        created_at: column.text
    },
    { name: 'final_reports' }
);

const photos = new Table(
    {
        active_report_id: column.text,
        photo_url: column.text,
        storage_path: column.text,
        caption: column.text,
        photo_type: column.text,
        taken_at: column.text,
        location_lat: column.real,
        location_lng: column.real,
        created_at: column.text
    },
    { name: 'photos' }
);

// Schema expects an object where keys are table names and values are Table instances
// The table name in the key must match the 'name' option in each Table definition
const powerSyncSchema = new Schema({
    user_profiles: userProfiles,
    projects: projects,
    contractors: contractors,
    active_reports: activeReports,
    ai_requests: aiRequests,
    ai_responses: aiResponses,
    final_reports: finalReports,
    photos: photos
});

// ============ STATE ============
let powerSyncDb = null;
let powerSyncInitPromise = null;
let isConnecting = false; // Track if we're in the middle of connecting
let isDisconnecting = false; // Track if we're in the middle of disconnecting
let connectionAttemptCount = 0; // Track connection attempts for debugging
let syncStatus = {
    connected: false,
    syncing: false,
    lastSyncTime: null,
    error: null
};

// ============ CONNECT WITH TIMEOUT ============
// Wraps connect() with explicit timeout and detailed error catching
async function connectWithTimeout(db, connector, timeoutMs = 10000) {
    console.log('[PowerSync] connectWithTimeout: Starting with', timeoutMs, 'ms timeout');
    console.log('[PowerSync] connectWithTimeout: Connector methods:', {
        hasFetchCredentials: typeof connector.fetchCredentials === 'function',
        hasUploadData: typeof connector.uploadData === 'function'
    });

    // Wrap in a proper Promise to handle async/await correctly
    const connectPromise = (async () => {
        try {
            console.log('[PowerSync] connectWithTimeout: Calling db.connect(connector)...');
            const startTime = Date.now();

            // The SDK should call connector.fetchCredentials() during this call
            await db.connect(connector);

            const elapsed = Date.now() - startTime;
            console.log(`[PowerSync] connectWithTimeout: db.connect() resolved in ${elapsed}ms`);
            return true;
        } catch (e) {
            console.error('[PowerSync] connectWithTimeout: db.connect() threw:', e.message);
            console.error('[PowerSync] connectWithTimeout: Error details:', {
                name: e.name,
                message: e.message,
                stack: e.stack
            });
            throw e;
        }
    })();

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            console.error(`[PowerSync] connectWithTimeout: TIMEOUT after ${timeoutMs}ms`);
            console.error('[PowerSync] connectWithTimeout: If fetchCredentials was never logged, the SDK is stuck before auth');
            reject(new Error(`connect() timed out after ${timeoutMs}ms - SDK may be stuck during initialization`));
        }, timeoutMs);
    });

    return Promise.race([connectPromise, timeoutPromise]);
}

// ============ PAGE LIFECYCLE CLEANUP ============
// Clean up PowerSync connection when leaving the page to prevent issues on next page load
let cleanupRegistered = false;

function registerPageCleanup() {
    if (cleanupRegistered) return;
    cleanupRegistered = true;

    window.addEventListener('beforeunload', () => {
        console.log('[PowerSync] Page unload detected, cleaning up...');
        // Mark as disconnecting to prevent new operations
        isDisconnecting = true;

        // Attempt quick disconnect - this may not complete but helps
        if (powerSyncDb) {
            try {
                // Use disconnect() to close WebSocket connection
                // Note: This is best-effort during page unload
                powerSyncDb.disconnect();
                console.log('[PowerSync] Disconnect initiated during page unload');
            } catch (e) {
                console.warn('[PowerSync] Disconnect during unload failed:', e);
            }
        }
    });

    // Also handle page hide (for mobile browsers that may not fire beforeunload)
    window.addEventListener('pagehide', () => {
        console.log('[PowerSync] Page hide detected');
        isDisconnecting = true;
    });

    console.log('[PowerSync] Page cleanup handlers registered');
}

// ============ SUPABASE CONNECTOR ============
// Handles authentication and upload queue for PowerSync
class SupabaseConnector {
    constructor(supabaseClient) {
        this.supabaseClient = supabaseClient;
        // Pre-bind methods to ensure 'this' context is preserved when SDK calls them
        this.fetchCredentials = this.fetchCredentials.bind(this);
        this.uploadData = this.uploadData.bind(this);
    }

    // Get credentials for PowerSync connection using Supabase Auth
    async fetchCredentials() {
        console.log('[PowerSync] >>> fetchCredentials() CALLED <<<');

        try {
            // Use window.supabaseClient since it's set globally in main.js
            const supabase = window.supabaseClient || this.supabaseClient;
            if (!supabase) {
                console.error('[PowerSync] fetchCredentials: Supabase client not available');
                throw new Error('Supabase client not available');
            }

            console.log('[PowerSync] fetchCredentials: Getting session...');
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                console.error('[PowerSync] fetchCredentials: Auth session error:', error);
                throw error;
            }

            if (!session) {
                console.warn('[PowerSync] fetchCredentials: No auth session found');
                throw new Error('Not authenticated');
            }

            console.log('[PowerSync] fetchCredentials: Using auth token for user:', session.user.email);
            console.log('[PowerSync] fetchCredentials: Token expires:', new Date(session.expires_at * 1000).toISOString());
            console.log('[PowerSync] fetchCredentials: Returning credentials with endpoint:', POWERSYNC_URL);

            return {
                endpoint: POWERSYNC_URL,
                token: session.access_token
            };
        } catch (e) {
            console.error('[PowerSync] fetchCredentials FAILED:', e);
            throw e;
        }
    }

    // Upload local changes to Supabase
    async uploadData(database) {
        const transaction = await database.getNextCrudTransaction();
        if (!transaction) return;

        try {
            for (const op of transaction.crud) {
                const table = op.table;
                let record = { ...op.opData, id: op.id };

                // Sanitize empty strings to null (Supabase rejects "" for integer/numeric columns)
                Object.keys(record).forEach(key => {
                    if (record[key] === '') {
                        record[key] = null;
                    }
                });

                // Filter out fields that don't exist in Supabase schema
                if (table === 'user_profiles') {
                    // Remove legacy 'role' field - column doesn't exist in Supabase
                    delete record.role;
                }

                switch (op.op) {
                    case 'PUT':
                        // Upsert to Supabase
                        const { error: putError } = await this.supabaseClient
                            .from(table)
                            .upsert(record, { onConflict: 'id' });
                        if (putError) throw putError;
                        break;

                    case 'PATCH':
                        // Update in Supabase - use filtered data (without id)
                        const updateData = { ...record };
                        delete updateData.id;
                        const { error: patchError } = await this.supabaseClient
                            .from(table)
                            .update(updateData)
                            .eq('id', op.id);
                        if (patchError) throw patchError;
                        break;

                    case 'DELETE':
                        // Delete from Supabase
                        const { error: deleteError } = await this.supabaseClient
                            .from(table)
                            .delete()
                            .eq('id', op.id);
                        if (deleteError) throw deleteError;
                        break;
                }
            }

            await transaction.complete();
            console.log('[PowerSync] Upload transaction completed');
        } catch (error) {
            console.error('[PowerSync] Upload failed:', error);
            throw error;
        }
    }
}

// ============ INDEXEDDB CHECK ============
// Check if IndexedDB is accessible (not locked by another tab/page)
async function checkIndexedDBAccess() {
    return new Promise((resolve) => {
        try {
            const testRequest = indexedDB.open('fieldvoice-test', 1);
            testRequest.onsuccess = () => {
                testRequest.result.close();
                indexedDB.deleteDatabase('fieldvoice-test');
                console.log('[PowerSync] IndexedDB access OK');
                resolve(true);
            };
            testRequest.onerror = (e) => {
                console.error('[PowerSync] IndexedDB access BLOCKED:', e);
                resolve(false);
            };
            testRequest.onblocked = () => {
                console.error('[PowerSync] IndexedDB access BLOCKED (onblocked event)');
                resolve(false);
            };
        } catch (e) {
            console.error('[PowerSync] IndexedDB test failed:', e);
            resolve(false);
        }
    });
}

// ============ INITIALIZATION ============
export async function initPowerSync() {
    connectionAttemptCount++;
    const attemptId = connectionAttemptCount;
    console.log(`[PowerSync] initPowerSync() called (attempt #${attemptId})`);

    // Register cleanup handlers on first init
    registerPageCleanup();

    // DEBUG: Small delay to ensure previous page cleanup completed (helps with navigation)
    console.log(`[PowerSync] (#${attemptId}) Waiting 500ms for any previous page cleanup...`);
    await new Promise(r => setTimeout(r, 500));
    console.log(`[PowerSync] (#${attemptId}) Starting initialization after delay...`);

    // Check for auth session before proceeding
    const supabase = window.supabaseClient;
    if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            console.warn('[PowerSync] No auth session, skipping PowerSync init');
            syncStatus.connected = false;
            return null;
        }
        console.log('[PowerSync] Auth session found for:', session.user.email);
    }

    // Force close any existing connections before proceeding (handles stale state from navigation)
    if (typeof powerSyncDb !== 'undefined' && powerSyncDb) {
        console.log(`[PowerSync] (#${attemptId}) Found existing db at start, forcing disconnect...`);
        try {
            await powerSyncDb.disconnect();
            await new Promise(r => setTimeout(r, 200)); // Wait for cleanup
            console.log(`[PowerSync] (#${attemptId}) Force disconnect completed`);
        } catch (e) {
            console.warn(`[PowerSync] (#${attemptId}) Force disconnect failed:`, e.message);
        }
        powerSyncDb = null;
        powerSyncInitPromise = null;
        isConnecting = false;
        isDisconnecting = false;
    }

    // If already connected and database exists, return immediately
    if (powerSyncDb && syncStatus.connected) {
        console.log(`[PowerSync] (#${attemptId}) Already connected, reusing existing connection`);
        return powerSyncDb;
    }

    // If database exists but not connected, try to reconnect
    if (powerSyncDb && !isConnecting && !isDisconnecting) {
        console.log(`[PowerSync] (#${attemptId}) Database exists but not connected, attempting reconnect...`);
        return attemptReconnect(attemptId);
    }

    // Return existing promise if already initializing
    if (powerSyncInitPromise) {
        console.log(`[PowerSync] (#${attemptId}) Initialization already in progress, waiting...`);
        return powerSyncInitPromise;
    }

    powerSyncInitPromise = (async () => {
        try {
            console.log(`[PowerSync] (#${attemptId}) Initializing new PowerSync instance...`);

            // Check if Supabase client exists (from config.js via window)
            if (typeof window.supabaseClient === 'undefined') {
                throw new Error('Supabase client not initialized. Make sure config.js is loaded first.');
            }

            // Check IndexedDB accessibility before proceeding
            console.log(`[PowerSync] (#${attemptId}) Checking IndexedDB access...`);
            const indexedDBOk = await checkIndexedDBAccess();
            if (!indexedDBOk) {
                console.error(`[PowerSync] (#${attemptId}) IndexedDB is locked or inaccessible!`);
                // Continue anyway - PowerSync may still work or give a better error
            }

            // If there's an old database instance, try to clean it up first
            if (powerSyncDb) {
                console.log(`[PowerSync] (#${attemptId}) Cleaning up old database instance...`);
                try {
                    await powerSyncDb.disconnect();
                    await new Promise(r => setTimeout(r, 200)); // Extra wait for cleanup
                    console.log(`[PowerSync] (#${attemptId}) Old instance disconnected`);
                } catch (cleanupError) {
                    console.warn(`[PowerSync] (#${attemptId}) Old instance cleanup warning:`, cleanupError.message);
                }
                powerSyncDb = null;
            }

            console.log(`[PowerSync] (#${attemptId}) Creating database...`);

            // Create PowerSync database
            powerSyncDb = new PowerSyncDatabase({
                schema: powerSyncSchema,
                database: {
                    dbFilename: 'fieldvoice.db'
                }
            });

            console.log(`[PowerSync] (#${attemptId}) Database created, preparing to connect...`);

            // DEBUG: Log database state before connect
            console.log(`[PowerSync] (#${attemptId}) Database state before connect:`, {
                exists: !!powerSyncDb,
                connected: powerSyncDb?.connected,
                currentStatus: powerSyncDb?.currentStatus,
                closed: powerSyncDb?.closed
            });

            // Create connector and log URL for WebSocket debugging
            console.log(`[PowerSync] (#${attemptId}) Creating connector with URL:`, POWERSYNC_URL);
            const connector = new SupabaseConnector(window.supabaseClient);

            // PRE-TEST: Verify fetchCredentials works before passing to SDK
            console.log(`[PowerSync] (#${attemptId}) Pre-testing fetchCredentials()...`);
            try {
                const testCreds = await connector.fetchCredentials();
                console.log(`[PowerSync] (#${attemptId}) Pre-test SUCCESS - credentials obtained:`, {
                    endpoint: testCreds.endpoint,
                    tokenLength: testCreds.token?.length || 0,
                    tokenPreview: testCreds.token?.substring(0, 20) + '...'
                });
            } catch (preTestError) {
                console.error(`[PowerSync] (#${attemptId}) Pre-test FAILED:`, preTestError);
                throw new Error('Cannot connect: fetchCredentials pre-test failed - ' + preTestError.message);
            }

            // Mark that we're attempting to connect
            isConnecting = true;
            isDisconnecting = false;
            console.log(`[PowerSync] (#${attemptId}) Connecting to PowerSync service (connector verified)...`);

            // Connect to PowerSync service with retry logic
            let connectSuccess = false;
            let lastError = null;

            for (let retry = 0; retry < 3; retry++) {
                if (retry > 0) {
                    console.log(`[PowerSync] (#${attemptId}) Retry ${retry}/2 after ${retry * 1000}ms delay...`);
                    await new Promise(resolve => setTimeout(resolve, retry * 1000));
                }

                try {
                    // DEBUG: Detailed connect() logging
                    console.log(`[PowerSync] (#${attemptId}) About to call connectWithTimeout() [attempt ${retry + 1}]...`);
                    console.log(`[PowerSync] (#${attemptId}) Database state:`, {
                        exists: !!powerSyncDb,
                        connected: powerSyncDb?.connected,
                        currentStatus: powerSyncDb?.currentStatus
                    });

                    const connectStartTime = Date.now();

                    // Use improved connectWithTimeout with 10 second timeout (instead of 30)
                    await connectWithTimeout(powerSyncDb, connector, 10000);

                    const connectDuration = Date.now() - connectStartTime;
                    console.log(`[PowerSync] (#${attemptId}) connect() resolved successfully in ${connectDuration}ms on attempt ${retry + 1}`);
                    connectSuccess = true;
                    break;
                } catch (connectError) {
                    lastError = connectError;
                    console.error(`[PowerSync] (#${attemptId}) connect() threw error on attempt ${retry + 1}:`, connectError);
                    console.error(`[PowerSync] (#${attemptId}) Error details:`, {
                        message: connectError.message,
                        name: connectError.name,
                        stack: connectError.stack
                    });

                    // Check if error indicates a stale connection issue
                    const errorMsg = connectError.message?.toLowerCase() || '';
                    if (errorMsg.includes('already') || errorMsg.includes('exists') || errorMsg.includes('locked')) {
                        console.log(`[PowerSync] (#${attemptId}) Possible stale connection detected, will retry...`);
                    }
                    if (errorMsg.includes('timeout')) {
                        console.log(`[PowerSync] (#${attemptId}) Connect timed out - may be WebSocket issue or expired token`);
                    }
                }
            }

            isConnecting = false;

            if (!connectSuccess) {
                console.error(`[PowerSync] (#${attemptId}) All connect() attempts failed:`, lastError);
                // Don't rethrow - we can still use local-only mode
                console.log(`[PowerSync] (#${attemptId}) Falling back to local-only mode after connect failure`);
                syncStatus.connected = false;
                syncStatus.error = lastError?.message || 'Connection failed';
                return powerSyncDb; // Return db for local queries
            }

            // Update sync status
            syncStatus.connected = true;
            syncStatus.lastSyncTime = new Date().toISOString();
            syncStatus.error = null;

            // Listen for sync status changes
            powerSyncDb.registerListener({
                statusChanged: (status) => {
                    syncStatus.syncing = status.dataFlowStatus?.downloading || status.dataFlowStatus?.uploading || false;
                    if (status.connected !== undefined) {
                        syncStatus.connected = status.connected;
                    }
                    console.log(`[PowerSync] (#${attemptId}) Status changed:`, status);
                }
            });

            console.log(`[PowerSync] (#${attemptId}) Connected successfully`);

            // Run connection test
            await testPowerSyncConnection();

            return powerSyncDb;

        } catch (error) {
            console.error(`[PowerSync] (#${attemptId}) Initialization failed:`, error);
            isConnecting = false;
            syncStatus.connected = false;
            syncStatus.error = error.message;
            throw error;
        }
    })();

    return powerSyncInitPromise;
}

// Helper to attempt reconnection on an existing database
async function attemptReconnect(attemptId) {
    console.log(`[PowerSync] (#${attemptId}) Attempting to reconnect existing database...`);

    // DEBUG: Log database state before reconnect
    console.log(`[PowerSync] (#${attemptId}) Reconnect - Database state:`, {
        exists: !!powerSyncDb,
        connected: powerSyncDb?.connected,
        currentStatus: powerSyncDb?.currentStatus,
        closed: powerSyncDb?.closed
    });

    if (!window.supabaseClient) {
        console.error(`[PowerSync] (#${attemptId}) Cannot reconnect - Supabase client not available`);
        return powerSyncDb; // Return db for local-only mode
    }

    isConnecting = true;
    console.log(`[PowerSync] (#${attemptId}) Reconnect - Creating connector with URL:`, POWERSYNC_URL);
    const connector = new SupabaseConnector(window.supabaseClient);

    // PRE-TEST: Verify fetchCredentials works before passing to SDK
    console.log(`[PowerSync] (#${attemptId}) Reconnect - Pre-testing fetchCredentials()...`);
    try {
        const testCreds = await connector.fetchCredentials();
        console.log(`[PowerSync] (#${attemptId}) Reconnect - Pre-test SUCCESS:`, {
            endpoint: testCreds.endpoint,
            tokenLength: testCreds.token?.length || 0
        });
    } catch (preTestError) {
        console.error(`[PowerSync] (#${attemptId}) Reconnect - Pre-test FAILED:`, preTestError);
        isConnecting = false;
        syncStatus.error = 'fetchCredentials failed: ' + preTestError.message;
        return powerSyncDb; // Return db for local-only mode
    }

    try {
        console.log(`[PowerSync] (#${attemptId}) Reconnect - About to call connectWithTimeout()...`);
        const connectStartTime = Date.now();

        // Use improved connectWithTimeout with 10 second timeout
        await connectWithTimeout(powerSyncDb, connector, 10000);

        const connectDuration = Date.now() - connectStartTime;
        console.log(`[PowerSync] (#${attemptId}) Reconnection successful in ${connectDuration}ms!`);
        syncStatus.connected = true;
        syncStatus.lastSyncTime = new Date().toISOString();
        syncStatus.error = null;
    } catch (reconnectError) {
        console.error(`[PowerSync] (#${attemptId}) Reconnection threw error:`, reconnectError);
        console.error(`[PowerSync] (#${attemptId}) Reconnect error details:`, {
            message: reconnectError.message,
            name: reconnectError.name,
            stack: reconnectError.stack
        });
        syncStatus.connected = false;
        syncStatus.error = reconnectError.message;

        // If reconnect fails, try full reinit
        console.log(`[PowerSync] (#${attemptId}) Reconnect failed, attempting full reinit...`);
        powerSyncInitPromise = null; // Clear promise to allow fresh init
        try {
            console.log(`[PowerSync] (#${attemptId}) Disconnecting before reinit...`);
            await powerSyncDb.disconnect();
            await new Promise(r => setTimeout(r, 200)); // Extra delay
            console.log(`[PowerSync] (#${attemptId}) Disconnect completed before reinit`);
        } catch (e) {
            console.warn(`[PowerSync] (#${attemptId}) Disconnect before reinit failed:`, e.message);
        }
        powerSyncDb = null;
        return initPowerSync();
    } finally {
        isConnecting = false;
    }

    return powerSyncDb;
}

// ============ HELPER FUNCTIONS ============

// Get the PowerSync database instance
export function getPowerSync() {
    if (!powerSyncDb) {
        console.warn('[PowerSync] Database not initialized. Call initPowerSync() first.');
        return null;
    }
    return powerSyncDb;
}

// Get current sync status
export function getSyncStatus() {
    return { ...syncStatus };
}

// Check if PowerSync is ready
export function isPowerSyncReady() {
    return powerSyncDb !== null && syncStatus.connected;
}

// Default timeout for PowerSync operations (5 seconds)
const POWERSYNC_TIMEOUT_MS = 5000;

/**
 * Wait for PowerSync to be ready with timeout
 * Returns null if timeout is reached (allows graceful degradation)
 * @param {number} timeoutMs - Timeout in milliseconds (default 5000)
 * @returns {Promise<PowerSyncDatabase|null>}
 */
export async function waitForPowerSync(timeoutMs = POWERSYNC_TIMEOUT_MS) {
    // If already connected, return immediately
    if (powerSyncDb && syncStatus.connected) {
        return powerSyncDb;
    }

    // If initialization is in progress, wait for it to complete
    if (powerSyncInitPromise) {
        console.log('[PowerSync] waitForPowerSync: initialization in progress, waiting...');
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('PowerSync initialization timeout')), timeoutMs)
            );

            const result = await Promise.race([
                powerSyncInitPromise,
                timeoutPromise
            ]);

            return result;
        } catch (error) {
            console.error('[PowerSync] waitForPowerSync: wait failed:', error.message);
            // Return existing db if available (local-only mode), otherwise null
            if (powerSyncDb) {
                console.warn('[PowerSync] Using database in local-only mode after timeout');
            }
            return powerSyncDb || null;
        }
    }

    // If database exists but not connected and no init in progress,
    // this means init completed but connect failed - use local-only mode
    if (powerSyncDb && !isConnecting) {
        console.warn('[PowerSync] Database exists but not connected, using local-only mode');
        return powerSyncDb;
    }

    // No database and no init in progress - start initialization
    console.log('[PowerSync] waitForPowerSync: starting new initialization...');
    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('PowerSync initialization timeout')), timeoutMs)
        );

        const result = await Promise.race([
            initPowerSync(),
            timeoutPromise
        ]);

        return result;
    } catch (error) {
        console.error('[PowerSync] waitForPowerSync failed:', error.message);
        // Return existing db if available (local-only mode), otherwise null
        return powerSyncDb || null;
    }
}

/**
 * Check if PowerSync is available (with quick timeout)
 * Use this before operations to fail fast if PowerSync isn't ready
 * @returns {Promise<boolean>}
 */
export async function isPowerSyncAvailable() {
    if (powerSyncDb) return true;

    try {
        const db = await waitForPowerSync(2000); // Quick 2s timeout
        return db !== null;
    } catch {
        return false;
    }
}

// ============ QUERY HELPERS ============

/**
 * Get all records from a table with timeout protection
 * Returns empty array if PowerSync is unavailable
 */
export async function psGetAll(tableName, options = {}) {
    const db = await waitForPowerSync();
    if (!db) {
        console.warn(`[PowerSync] psGetAll(${tableName}) - database unavailable, returning empty array`);
        return [];
    }

    try {
        let query = `SELECT * FROM ${tableName}`;
        const params = [];

        if (options.where && Object.keys(options.where).length > 0) {
            const whereClauses = [];
            for (const [key, value] of Object.entries(options.where)) {
                whereClauses.push(`${key} = ?`);
                params.push(value);
            }
            query += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        if (options.orderBy) {
            query += ` ORDER BY ${options.orderBy}`;
            if (options.orderDesc) {
                query += ' DESC';
            }
        }

        if (options.limit) {
            query += ` LIMIT ${options.limit}`;
        }

        const result = await db.getAll(query, params);
        return result;
    } catch (error) {
        console.error(`[PowerSync] psGetAll(${tableName}) error:`, error);
        return [];
    }
}

/**
 * Get a single record by ID with timeout protection
 * Returns null if PowerSync is unavailable
 */
export async function psGet(tableName, id) {
    const db = await waitForPowerSync();
    if (!db) {
        console.warn(`[PowerSync] psGet(${tableName}, ${id}) - database unavailable`);
        return null;
    }

    try {
        const result = await db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
        return result;
    } catch (error) {
        console.error(`[PowerSync] psGet(${tableName}, ${id}) error:`, error);
        return null;
    }
}

/**
 * Insert or update a record with timeout protection
 * Returns the record if successful, null if failed
 */
export async function psSave(tableName, record) {
    const db = await waitForPowerSync();
    if (!db) {
        console.error(`[PowerSync] psSave(${tableName}) - database unavailable, cannot save`);
        return null;
    }

    try {
        // Ensure record has an ID
        if (!record.id) {
            record.id = crypto.randomUUID();
        }

        // Add timestamps - only for tables that have these columns
        const now = new Date().toISOString();

        // Tables that have created_at column
        const tablesWithCreatedAt = ['user_profiles', 'projects', 'contractors', 'active_reports', 'ai_requests', 'ai_responses', 'final_reports'];
        if (tablesWithCreatedAt.includes(tableName) && !record.created_at) {
            record.created_at = now;
        }

        // Tables that have updated_at column (NOT active_reports, ai_requests, ai_responses)
        const tablesWithUpdatedAt = ['user_profiles', 'projects', 'contractors', 'final_reports'];
        if (tablesWithUpdatedAt.includes(tableName)) {
            record.updated_at = now;
        }

        // Build upsert query
        const columns = Object.keys(record);
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map(col => record[col]);

        const query = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

        await db.execute(query, values);
        return record;
    } catch (error) {
        console.error(`[PowerSync] psSave(${tableName}) error:`, error);
        return null;
    }
}

/**
 * Delete a record by ID with timeout protection
 * Returns true if successful, false if failed
 */
export async function psDelete(tableName, id) {
    const db = await waitForPowerSync();
    if (!db) {
        console.error(`[PowerSync] psDelete(${tableName}, ${id}) - database unavailable`);
        return false;
    }

    try {
        await db.execute(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
        return true;
    } catch (error) {
        console.error(`[PowerSync] psDelete(${tableName}, ${id}) error:`, error);
        return false;
    }
}

/**
 * Execute a custom query with timeout protection
 * Returns empty array if failed
 */
export async function psQuery(sql, params = []) {
    const db = await waitForPowerSync();
    if (!db) {
        console.warn('[PowerSync] psQuery - database unavailable');
        return [];
    }

    try {
        return await db.getAll(sql, params);
    } catch (error) {
        console.error('[PowerSync] psQuery error:', error);
        return [];
    }
}

/**
 * Execute a custom command (INSERT, UPDATE, DELETE) with timeout protection
 * Returns true if successful, false if failed
 */
export async function psExecute(sql, params = []) {
    const db = await waitForPowerSync();
    if (!db) {
        console.error('[PowerSync] psExecute - database unavailable');
        return false;
    }

    try {
        await db.execute(sql, params);
        return true;
    } catch (error) {
        console.error('[PowerSync] psExecute error:', error);
        return false;
    }
}

// ============ CONNECTION TEST ============
export async function testPowerSyncConnection() {
    try {
        console.log('[PowerSync] Running connection test...');

        // Try to query user_profiles table
        const profiles = await psGetAll('user_profiles', { limit: 1 });
        console.log('[PowerSync] ✓ Connection test passed - user_profiles query successful');
        console.log('[PowerSync] Sample data:', profiles.length > 0 ? '1 profile found' : 'No profiles yet');

        // Log sync status
        const status = getSyncStatus();
        console.log('[PowerSync] Sync status:', status);

        return true;
    } catch (error) {
        console.error('[PowerSync] ✗ Connection test failed:', error);
        return false;
    }
}

// ============ DISCONNECT ============
/**
 * Explicitly disconnect PowerSync and clean up resources
 * Call this before page unload or when you want to reset the connection
 */
export async function disconnectPowerSync() {
    console.log('[PowerSync] Explicit disconnect requested...');
    isDisconnecting = true;

    if (!powerSyncDb) {
        console.log('[PowerSync] No database to disconnect');
        return true;
    }

    try {
        await powerSyncDb.disconnect();
        console.log('[PowerSync] Disconnect successful');
        syncStatus.connected = false;
        syncStatus.error = null;
        return true;
    } catch (error) {
        console.error('[PowerSync] Disconnect error:', error);
        return false;
    } finally {
        isDisconnecting = false;
    }
}

/**
 * Force reset PowerSync - disconnects and clears all state
 * Use this if PowerSync gets into a bad state
 */
export async function resetPowerSync() {
    console.log('[PowerSync] Force reset requested...');

    await disconnectPowerSync();

    // Clear all state
    powerSyncDb = null;
    powerSyncInitPromise = null;
    isConnecting = false;
    isDisconnecting = false;
    syncStatus.connected = false;
    syncStatus.syncing = false;
    syncStatus.error = null;

    console.log('[PowerSync] State cleared, ready for fresh initialization');
    return true;
}

// ============ EXPOSE TO WINDOW FOR COMPATIBILITY ============
// This allows existing code that uses window.initPowerSync etc. to keep working
window.PowerSyncClient = {
    init: initPowerSync,
    getDb: getPowerSync,
    getStatus: getSyncStatus,
    isReady: isPowerSyncReady,
    isAvailable: isPowerSyncAvailable,
    waitFor: waitForPowerSync,

    // Connection management
    disconnect: disconnectPowerSync,
    reset: resetPowerSync,

    // Query helpers
    getAll: psGetAll,
    get: psGet,
    save: psSave,
    delete: psDelete,
    query: psQuery,
    execute: psExecute,

    // Test
    test: testPowerSyncConnection
};

// Also expose individual functions for convenience
window.initPowerSync = initPowerSync;
window.getPowerSync = getPowerSync;
window.getSyncStatus = getSyncStatus;
window.isPowerSyncAvailable = isPowerSyncAvailable;
window.disconnectPowerSync = disconnectPowerSync;
window.resetPowerSync = resetPowerSync;

console.log('[PowerSync] Module loaded. Call initPowerSync() to connect.');

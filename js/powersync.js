// FieldVoice Pro - PowerSync Integration
// Provides offline-first sync with Supabase via PowerSync

// ============ POWERSYNC CREDENTIALS ============
// NOTE: Development token expires every ~12 hours
// Get a new token from: https://powersync.journeyapps.com/ → Your Instance → Connect
const POWERSYNC_URL = 'https://697d5b91d930100f50158b4f.powersync.journeyapps.com';

// Development token - UPDATE THIS WHEN IT EXPIRES
// Last updated: 2026-01-31
const POWERSYNC_DEV_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6InBvd2Vyc3luYy1kZXYtMzIyM2Q0ZTMifQ.eyJzdWIiOiJkZXYtdXNlciIsImlhdCI6MTczODI1MDQ1MywiYXVkIjoiaHR0cHM6Ly82OTdkNWI5MWQ5MzAxMDBmNTAxNThiNGYucG93ZXJzeW5jLmpvdXJuZXlhcHBzLmNvbSIsImlzcyI6Imh0dHBzOi8vcG93ZXJzeW5jLmpvdXJuZXlhcHBzLmNvbSIsImV4cCI6MTczODMzNjg1M30.GSFB8vsM4WgtOTrxMNPshIxemM0tJTQiAdxJpyJWgzBJHJAzR5iPZJYKcPhfGnrqSmIhS3wdTtuZxdaIzegrRXdHbbLutj7bhBz3cU5FMyCL9eqDu2bDU4s9gc9a-9bBkKxmYT6e_5MFNH7ma9UiXuHSWHogjKLmYxWMhq1Fsi-hBuwDNdYqW6Ap7y8eWgqKv5g1XJ5aQTnPl5yHQA0U3guzNqNXH5bSL7_N0mq6-8Q5z0m5J7vsW4R8vNGaW7kdQPq-pKSbSFbLbYvWJVVpDT2hA-VJU4_HzqgE-qZmLN2RJWSZ9jzCvM8TpR3yQXN7vHxqB5cM2FnDqLsK6F8vYA';

// ============ POWERSYNC SCHEMA ============
// Define all tables that sync with Supabase
// This must match your Supabase schema and PowerSync sync rules

let powerSyncSchema = null;
let powerSyncDb = null;
let powerSyncInitPromise = null;
let syncStatus = {
    connected: false,
    syncing: false,
    lastSyncTime: null,
    error: null
};

// Schema definition using PowerSync SDK
function createPowerSyncSchema() {
    const { Schema, Table, Column, ColumnType } = PowerSync;

    return new Schema([
        // User Profiles
        new Table({
            name: 'user_profiles',
            columns: [
                new Column({ name: 'id', type: ColumnType.TEXT }),
                new Column({ name: 'full_name', type: ColumnType.TEXT }),
                new Column({ name: 'email', type: ColumnType.TEXT }),
                new Column({ name: 'phone', type: ColumnType.TEXT }),
                new Column({ name: 'company', type: ColumnType.TEXT }),
                new Column({ name: 'role', type: ColumnType.TEXT }),
                new Column({ name: 'inspector_cert', type: ColumnType.TEXT }),
                new Column({ name: 'preferences', type: ColumnType.TEXT }), // JSON string
                new Column({ name: 'created_at', type: ColumnType.TEXT }),
                new Column({ name: 'updated_at', type: ColumnType.TEXT })
            ]
        }),

        // Projects
        new Table({
            name: 'projects',
            columns: [
                new Column({ name: 'id', type: ColumnType.TEXT }),
                new Column({ name: 'user_id', type: ColumnType.TEXT }),
                new Column({ name: 'name', type: ColumnType.TEXT }),
                new Column({ name: 'project_number', type: ColumnType.TEXT }),
                new Column({ name: 'location', type: ColumnType.TEXT }),
                new Column({ name: 'client_name', type: ColumnType.TEXT }),
                new Column({ name: 'start_date', type: ColumnType.TEXT }),
                new Column({ name: 'status', type: ColumnType.TEXT }),
                new Column({ name: 'logo_url', type: ColumnType.TEXT }),
                new Column({ name: 'settings', type: ColumnType.TEXT }), // JSON string
                new Column({ name: 'created_at', type: ColumnType.TEXT }),
                new Column({ name: 'updated_at', type: ColumnType.TEXT })
            ]
        }),

        // Contractors
        new Table({
            name: 'contractors',
            columns: [
                new Column({ name: 'id', type: ColumnType.TEXT }),
                new Column({ name: 'project_id', type: ColumnType.TEXT }),
                new Column({ name: 'name', type: ColumnType.TEXT }),
                new Column({ name: 'trade', type: ColumnType.TEXT }),
                new Column({ name: 'contact_name', type: ColumnType.TEXT }),
                new Column({ name: 'contact_phone', type: ColumnType.TEXT }),
                new Column({ name: 'contact_email', type: ColumnType.TEXT }),
                new Column({ name: 'status', type: ColumnType.TEXT }),
                new Column({ name: 'created_at', type: ColumnType.TEXT }),
                new Column({ name: 'updated_at', type: ColumnType.TEXT })
            ]
        }),

        // Active Reports (in-progress reports)
        new Table({
            name: 'active_reports',
            columns: [
                new Column({ name: 'id', type: ColumnType.TEXT }),
                new Column({ name: 'user_id', type: ColumnType.TEXT }),
                new Column({ name: 'project_id', type: ColumnType.TEXT }),
                new Column({ name: 'report_date', type: ColumnType.TEXT }),
                new Column({ name: 'status', type: ColumnType.TEXT }),
                new Column({ name: 'capture_mode', type: ColumnType.TEXT }),
                new Column({ name: 'weather_data', type: ColumnType.TEXT }), // JSON string
                new Column({ name: 'entries', type: ColumnType.TEXT }), // JSON string
                new Column({ name: 'overview', type: ColumnType.TEXT }), // JSON string
                new Column({ name: 'created_at', type: ColumnType.TEXT }),
                new Column({ name: 'updated_at', type: ColumnType.TEXT })
            ]
        }),

        // AI Requests
        new Table({
            name: 'ai_requests',
            columns: [
                new Column({ name: 'id', type: ColumnType.TEXT }),
                new Column({ name: 'user_id', type: ColumnType.TEXT }),
                new Column({ name: 'report_id', type: ColumnType.TEXT }),
                new Column({ name: 'entry_index', type: ColumnType.INTEGER }),
                new Column({ name: 'request_type', type: ColumnType.TEXT }),
                new Column({ name: 'input_data', type: ColumnType.TEXT }), // JSON string
                new Column({ name: 'status', type: ColumnType.TEXT }),
                new Column({ name: 'created_at', type: ColumnType.TEXT })
            ]
        }),

        // AI Responses
        new Table({
            name: 'ai_responses',
            columns: [
                new Column({ name: 'id', type: ColumnType.TEXT }),
                new Column({ name: 'request_id', type: ColumnType.TEXT }),
                new Column({ name: 'response_data', type: ColumnType.TEXT }), // JSON string
                new Column({ name: 'tokens_used', type: ColumnType.INTEGER }),
                new Column({ name: 'created_at', type: ColumnType.TEXT })
            ]
        }),

        // Final Reports (submitted/archived)
        new Table({
            name: 'final_reports',
            columns: [
                new Column({ name: 'id', type: ColumnType.TEXT }),
                new Column({ name: 'user_id', type: ColumnType.TEXT }),
                new Column({ name: 'project_id', type: ColumnType.TEXT }),
                new Column({ name: 'report_date', type: ColumnType.TEXT }),
                new Column({ name: 'project_name', type: ColumnType.TEXT }),
                new Column({ name: 'project_number', type: ColumnType.TEXT }),
                new Column({ name: 'weather_summary', type: ColumnType.TEXT }),
                new Column({ name: 'entries', type: ColumnType.TEXT }), // JSON string
                new Column({ name: 'overview', type: ColumnType.TEXT }), // JSON string
                new Column({ name: 'pdf_url', type: ColumnType.TEXT }),
                new Column({ name: 'submitted_at', type: ColumnType.TEXT }),
                new Column({ name: 'created_at', type: ColumnType.TEXT })
            ]
        }),

        // Photos
        new Table({
            name: 'photos',
            columns: [
                new Column({ name: 'id', type: ColumnType.TEXT }),
                new Column({ name: 'user_id', type: ColumnType.TEXT }),
                new Column({ name: 'report_id', type: ColumnType.TEXT }),
                new Column({ name: 'entry_index', type: ColumnType.INTEGER }),
                new Column({ name: 'storage_path', type: ColumnType.TEXT }),
                new Column({ name: 'thumbnail_path', type: ColumnType.TEXT }),
                new Column({ name: 'caption', type: ColumnType.TEXT }),
                new Column({ name: 'gps_lat', type: ColumnType.REAL }),
                new Column({ name: 'gps_lng', type: ColumnType.REAL }),
                new Column({ name: 'taken_at', type: ColumnType.TEXT }),
                new Column({ name: 'created_at', type: ColumnType.TEXT })
            ]
        })
    ]);
}

// ============ SUPABASE CONNECTOR ============
// Handles authentication and upload queue for PowerSync
class SupabaseConnector {
    constructor(supabaseClient) {
        this.supabaseClient = supabaseClient;
    }

    // Get credentials for PowerSync connection
    async fetchCredentials() {
        // For development, use the static dev token
        // In production, this would get a JWT from Supabase auth
        return {
            endpoint: POWERSYNC_URL,
            token: POWERSYNC_DEV_TOKEN
        };
    }

    // Upload local changes to Supabase
    async uploadData(database) {
        const transaction = await database.getNextCrudTransaction();
        if (!transaction) return;

        try {
            for (const op of transaction.crud) {
                const table = op.table;
                const record = { ...op.opData, id: op.id };

                switch (op.op) {
                    case 'PUT':
                        // Upsert to Supabase
                        const { error: putError } = await this.supabaseClient
                            .from(table)
                            .upsert(record, { onConflict: 'id' });
                        if (putError) throw putError;
                        break;

                    case 'PATCH':
                        // Update in Supabase
                        const { error: patchError } = await this.supabaseClient
                            .from(table)
                            .update(op.opData)
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

// ============ INITIALIZATION ============
async function initPowerSync() {
    // Return existing promise if already initializing
    if (powerSyncInitPromise) {
        return powerSyncInitPromise;
    }

    powerSyncInitPromise = (async () => {
        try {
            console.log('[PowerSync] Initializing...');

            // Check if PowerSync SDK is loaded
            if (typeof PowerSync === 'undefined') {
                throw new Error('PowerSync SDK not loaded. Make sure to include the script tag.');
            }

            // Check if Supabase client exists
            if (typeof supabaseClient === 'undefined') {
                throw new Error('Supabase client not initialized. Make sure config.js is loaded first.');
            }

            // Create schema
            powerSyncSchema = createPowerSyncSchema();

            // Create PowerSync database
            const { PowerSyncDatabase } = PowerSync;
            powerSyncDb = new PowerSyncDatabase({
                schema: powerSyncSchema,
                database: {
                    dbFilename: 'fieldvoice.db'
                }
            });

            // Create connector
            const connector = new SupabaseConnector(supabaseClient);

            // Connect to PowerSync service
            await powerSyncDb.connect(connector);

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
                    console.log('[PowerSync] Status changed:', status);
                }
            });

            console.log('[PowerSync] Connected successfully');

            // Run connection test
            await testPowerSyncConnection();

            return powerSyncDb;

        } catch (error) {
            console.error('[PowerSync] Initialization failed:', error);
            syncStatus.connected = false;
            syncStatus.error = error.message;
            throw error;
        }
    })();

    return powerSyncInitPromise;
}

// ============ HELPER FUNCTIONS ============

// Get the PowerSync database instance
function getPowerSync() {
    if (!powerSyncDb) {
        console.warn('[PowerSync] Database not initialized. Call initPowerSync() first.');
        return null;
    }
    return powerSyncDb;
}

// Get current sync status
function getSyncStatus() {
    return { ...syncStatus };
}

// Check if PowerSync is ready
function isPowerSyncReady() {
    return powerSyncDb !== null && syncStatus.connected;
}

// Wait for PowerSync to be ready
async function waitForPowerSync() {
    if (powerSyncDb && syncStatus.connected) {
        return powerSyncDb;
    }
    return initPowerSync();
}

// ============ QUERY HELPERS ============

// Get all records from a table
async function psGetAll(tableName, options = {}) {
    const db = await waitForPowerSync();
    let query = `SELECT * FROM ${tableName}`;
    const params = [];

    if (options.where) {
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
}

// Get a single record by ID
async function psGet(tableName, id) {
    const db = await waitForPowerSync();
    const result = await db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
    return result;
}

// Insert or update a record
async function psSave(tableName, record) {
    const db = await waitForPowerSync();

    // Ensure record has an ID
    if (!record.id) {
        record.id = crypto.randomUUID();
    }

    // Add timestamps
    const now = new Date().toISOString();
    if (!record.created_at) {
        record.created_at = now;
    }
    record.updated_at = now;

    // Build upsert query
    const columns = Object.keys(record);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(col => record[col]);

    const query = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

    await db.execute(query, values);
    return record;
}

// Delete a record by ID
async function psDelete(tableName, id) {
    const db = await waitForPowerSync();
    await db.execute(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
}

// Execute a custom query
async function psQuery(sql, params = []) {
    const db = await waitForPowerSync();
    return db.getAll(sql, params);
}

// Execute a custom command (INSERT, UPDATE, DELETE)
async function psExecute(sql, params = []) {
    const db = await waitForPowerSync();
    return db.execute(sql, params);
}

// ============ CONNECTION TEST ============
async function testPowerSyncConnection() {
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

// ============ EXPOSE TO WINDOW ============
window.PowerSyncClient = {
    init: initPowerSync,
    getDb: getPowerSync,
    getStatus: getSyncStatus,
    isReady: isPowerSyncReady,
    waitFor: waitForPowerSync,

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

console.log('[PowerSync] Module loaded. Call initPowerSync() to connect.');

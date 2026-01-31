// FieldVoice Pro - PowerSync Integration
// Provides offline-first sync with Supabase via PowerSync

import { PowerSyncDatabase, Schema, Table, column } from '@powersync/web';

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

const userProfiles = new Table(
    {
        full_name: column.text,
        email: column.text,
        phone: column.text,
        company: column.text,
        role: column.text,
        inspector_cert: column.text,
        preferences: column.text, // JSON string
        created_at: column.text,
        updated_at: column.text
    },
    { name: 'user_profiles' }
);

const projects = new Table(
    {
        user_id: column.text,
        name: column.text,
        project_number: column.text,
        location: column.text,
        client_name: column.text,
        start_date: column.text,
        status: column.text,
        logo_url: column.text,
        settings: column.text, // JSON string
        created_at: column.text,
        updated_at: column.text
    },
    { name: 'projects' }
);

const contractors = new Table(
    {
        project_id: column.text,
        name: column.text,
        trade: column.text,
        contact_name: column.text,
        contact_phone: column.text,
        contact_email: column.text,
        status: column.text,
        created_at: column.text,
        updated_at: column.text
    },
    { name: 'contractors' }
);

const activeReports = new Table(
    {
        user_id: column.text,
        project_id: column.text,
        report_date: column.text,
        status: column.text,
        capture_mode: column.text,
        weather_data: column.text, // JSON string
        entries: column.text, // JSON string
        overview: column.text, // JSON string
        created_at: column.text,
        updated_at: column.text
    },
    { name: 'active_reports' }
);

const aiRequests = new Table(
    {
        user_id: column.text,
        report_id: column.text,
        entry_index: column.integer,
        request_type: column.text,
        input_data: column.text, // JSON string
        status: column.text,
        created_at: column.text
    },
    { name: 'ai_requests' }
);

const aiResponses = new Table(
    {
        request_id: column.text,
        response_data: column.text, // JSON string
        tokens_used: column.integer,
        created_at: column.text
    },
    { name: 'ai_responses' }
);

const finalReports = new Table(
    {
        user_id: column.text,
        project_id: column.text,
        report_date: column.text,
        project_name: column.text,
        project_number: column.text,
        weather_summary: column.text,
        entries: column.text, // JSON string
        overview: column.text, // JSON string
        pdf_url: column.text,
        submitted_at: column.text,
        created_at: column.text
    },
    { name: 'final_reports' }
);

const photos = new Table(
    {
        user_id: column.text,
        report_id: column.text,
        entry_index: column.integer,
        storage_path: column.text,
        thumbnail_path: column.text,
        caption: column.text,
        gps_lat: column.real,
        gps_lng: column.real,
        taken_at: column.text,
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
let syncStatus = {
    connected: false,
    syncing: false,
    lastSyncTime: null,
    error: null
};

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
export async function initPowerSync() {
    // Return existing promise if already initializing
    if (powerSyncInitPromise) {
        return powerSyncInitPromise;
    }

    powerSyncInitPromise = (async () => {
        try {
            console.log('[PowerSync] Initializing...');

            // Check if Supabase client exists (from config.js via window)
            if (typeof window.supabaseClient === 'undefined') {
                throw new Error('Supabase client not initialized. Make sure config.js is loaded first.');
            }

            // Create PowerSync database
            powerSyncDb = new PowerSyncDatabase({
                schema: powerSyncSchema,
                database: {
                    dbFilename: 'fieldvoice.db'
                }
            });

            // Create connector
            const connector = new SupabaseConnector(window.supabaseClient);

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

// Wait for PowerSync to be ready
export async function waitForPowerSync() {
    if (powerSyncDb && syncStatus.connected) {
        return powerSyncDb;
    }
    return initPowerSync();
}

// ============ QUERY HELPERS ============

// Get all records from a table
export async function psGetAll(tableName, options = {}) {
    const db = await waitForPowerSync();
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
}

// Get a single record by ID
export async function psGet(tableName, id) {
    const db = await waitForPowerSync();
    const result = await db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
    return result;
}

// Insert or update a record
export async function psSave(tableName, record) {
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
export async function psDelete(tableName, id) {
    const db = await waitForPowerSync();
    await db.execute(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
}

// Execute a custom query
export async function psQuery(sql, params = []) {
    const db = await waitForPowerSync();
    return db.getAll(sql, params);
}

// Execute a custom command (INSERT, UPDATE, DELETE)
export async function psExecute(sql, params = []) {
    const db = await waitForPowerSync();
    return db.execute(sql, params);
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

// ============ EXPOSE TO WINDOW FOR COMPATIBILITY ============
// This allows existing code that uses window.initPowerSync etc. to keep working
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

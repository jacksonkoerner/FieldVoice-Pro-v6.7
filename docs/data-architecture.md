# FieldVoice Pro v6.6 - Data Architecture

**Last Updated:** 2026-01-29  
**Version:** 6.6  
**Supabase Project:** FieldVoice-Pro-v66 (ref: `wejwhplqnhciyxbinivx`)

---

## Table of Contents

1. [Entity Relationship Diagram (ERD)](#1-entity-relationship-diagram-erd)
2. [localStorage Structure](#2-localstorage-structure)
3. [Data Flow Diagram](#3-data-flow-diagram)
4. [Sync Function Reference](#4-sync-function-reference)
5. [Field Mapping Matrix](#5-field-mapping-matrix)

---

## 1. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    projects ||--o{ reports : "has many"
    projects ||--o{ contractors : "has many"
    reports ||--o| report_raw_capture : "has one"
    reports ||--o{ report_entries : "has many"
    reports ||--o{ photos : "has many"
    reports ||--o| final_reports : "has one"
    reports ||--o{ ai_responses : "has many"
    contractors ||--o{ report_entries : "referenced by"
    user_profiles ||--o{ reports : "created by"

    projects {
        uuid id PK "gen_random_uuid()"
        uuid user_id FK
        text project_name "Required"
        text noab_project_no
        text cno_solicitation_no
        text location
        text engineer
        text prime_contractor
        date notice_to_proceed
        integer contract_duration
        date expected_completion
        text default_start_time
        text default_end_time
        integer weather_days
        text logo
        text logo_thumbnail
        text logo_url
        text status "default: active"
        timestamptz created_at "default: now()"
        timestamptz updated_at "default: now()"
    }

    contractors {
        uuid id PK "gen_random_uuid()"
        uuid project_id FK "→ projects.id"
        text name "Required"
        text company
        text abbreviation
        text type "default: sub"
        text trades
        text status "default: active"
        date added_date
        date removed_date
        timestamptz created_at "default: now()"
    }

    reports {
        uuid id PK "gen_random_uuid()"
        uuid project_id FK "→ projects.id"
        uuid user_id
        text device_id
        date report_date "Required"
        text status "default: draft"
        text capture_mode "default: guided"
        text pdf_url
        text inspector_name
        jsonb toggle_states "v6.6: Section toggles"
        boolean safety_no_incidents "v6.6: Safety flag"
        timestamptz created_at "default: now()"
        timestamptz updated_at "default: now()"
        timestamptz submitted_at
    }

    report_entries {
        uuid id PK "gen_random_uuid()"
        uuid report_id FK "→ reports.id"
        text local_id "Client-generated ID"
        text section "Required: issues, safety, qaqc, etc."
        text content
        integer entry_order "default: 0"
        boolean is_deleted "default: false"
        timestamptz timestamp "v6.6: Entry timestamp"
        uuid contractor_id FK "v6.6: → contractors.id"
        timestamptz created_at "default: now()"
        timestamptz updated_at "default: now()"
    }

    report_raw_capture {
        uuid id PK "gen_random_uuid()"
        uuid report_id FK "→ reports.id"
        text capture_mode "default: guided"
        jsonb raw_data "contractor_work, personnel, equipment"
        jsonb weather
        jsonb location
        text site_conditions
        text qaqc_notes
        text communications
        text visitors_remarks
        boolean safety_has_incident "default: false"
        timestamptz created_at "default: now()"
    }

    photos {
        uuid id PK "gen_random_uuid()"
        uuid report_id FK "→ reports.id"
        text photo_url
        text storage_path
        text caption
        text photo_type
        numeric location_lat
        numeric location_lng
        timestamptz taken_at
        timestamptz created_at "default: now()"
    }

    final_reports {
        uuid id PK "gen_random_uuid()"
        uuid report_id FK "→ reports.id"
        text pdf_url
        numeric weather_high_temp
        numeric weather_low_temp
        text weather_precipitation
        text weather_general_condition
        text weather_job_site_condition
        text weather_adverse_conditions
        text executive_summary
        text work_performed
        text safety_observations
        text delays_issues
        text materials_used
        text qaqc_notes
        text communications_notes
        text visitors_deliveries_notes
        text inspector_notes
        boolean has_contractor_personnel "default: false"
        boolean has_equipment "default: false"
        boolean has_issues "default: false"
        boolean has_communications "default: false"
        boolean has_qaqc "default: false"
        boolean has_safety_incidents "default: false"
        boolean has_visitors_deliveries "default: false"
        boolean has_photos "default: false"
        text contractors_display
        jsonb contractors_json
        text equipment_display
        jsonb equipment_json
        text personnel_display
        jsonb personnel_json
        timestamptz created_at "default: now()"
        timestamptz submitted_at
    }

    ai_responses {
        uuid id PK "gen_random_uuid()"
        uuid report_id FK "→ reports.id"
        jsonb raw_response
        jsonb generated_content
        timestamptz created_at "default: now()"
    }

    user_profiles {
        uuid id PK "gen_random_uuid()"
        text full_name
        text title
        text company
        text email
        text phone
        text device_id
        timestamptz created_at "default: now()"
        timestamptz updated_at "default: now()"
    }
```

### Key Relationships

| Parent Table | Child Table | Relationship | FK Column |
|--------------|-------------|--------------|-----------|
| `projects` | `reports` | 1:N | `project_id` |
| `projects` | `contractors` | 1:N | `project_id` |
| `reports` | `report_entries` | 1:N | `report_id` |
| `reports` | `report_raw_capture` | 1:1 | `report_id` |
| `reports` | `photos` | 1:N | `report_id` |
| `reports` | `final_reports` | 1:1 | `report_id` |
| `reports` | `ai_responses` | 1:N | `report_id` |
| `contractors` | `report_entries` | 1:N | `contractor_id` |

### New Columns (v6.6)

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `reports` | `toggle_states` | JSONB | Stores Yes/No toggle states for sections |
| `reports` | `safety_no_incidents` | BOOLEAN | Quick access to safety status |
| `report_entries` | `timestamp` | TIMESTAMPTZ | When the entry was created by user |
| `report_entries` | `contractor_id` | UUID (FK) | Links work entries to specific contractors |

---

## 2. localStorage Structure

### Storage Keys (from `storage-keys.js`)

```javascript
const STORAGE_KEYS = {
    ACTIVE_PROJECT_ID: 'fvp_active_project_id',
    CURRENT_REPORTS: 'fvp_current_reports',      // Map of reportId → report data
    USER_SETTINGS: 'fvp_user_settings',
    SYNC_QUEUE: 'fvp_sync_queue',                // Offline sync queue
    CAPTURE_MODE: 'fvp_capture_mode',
    PROJECTS_CACHE: 'fvp_projects_cache',
    CONTRACTORS_CACHE: 'fvp_contractors_cache'
};
```

### Guided Mode Report Object

```javascript
{
    // Identifiers
    projectId: "uuid",
    reportDate: "YYYY-MM-DD",
    captureMode: "guided",
    lastSaved: "ISO timestamp",

    // Meta
    meta: {
        createdAt: "ISO timestamp",
        version: 2,
        naMarked: {
            issues: false,
            photos: false
        },
        captureMode: "guided",
        status: "draft"  // draft | refined | submitted
    },

    // Weather & Site
    weather: {
        highTemp: "72",
        lowTemp: "58",
        precipitation: "0.00\"",
        generalCondition: "Clear",
        jobSiteCondition: "Dry and workable",
        adverseConditions: "N/A"
    },

    // Legacy fields (for backward compatibility)
    freeformNotes: "",
    workSummary: "",
    siteConditions: "",
    issuesNotes: [],           // Legacy array format
    safetyNoIncidents: false,
    safetyHasIncidents: false,
    safetyNotes: [],           // Legacy array format
    qaqcNotes: [],
    communications: "",
    visitorsRemarks: "",
    additionalNotes: "",

    // Contractor Work (per-contractor activities)
    activities: [
        {
            contractorId: "uuid",
            noWork: false,
            narrative: "Concrete pour section A",
            equipmentUsed: "",
            crew: ""
        }
    ],

    // Personnel Counts
    operations: [
        {
            contractorId: "uuid",
            superintendents: 1,
            foremen: 2,
            operators: 3,
            laborers: 10,
            surveyors: 0,
            others: 0
        }
    ],

    // Equipment
    equipment: [],              // Legacy format
    equipmentRows: [            // v6.6 structured format
        {
            id: "local-uuid",
            description: "CAT 320 Excavator",
            quantity: 1,
            hoursUsed: 8,
            notes: ""
        }
    ],

    // Photos
    photos: [
        {
            id: "local-uuid",
            storagePath: "reports/uuid/photo.jpg",
            url: "https://...",
            caption: "Foundation work",
            timestamp: "ISO timestamp",
            date: "1/29/2026",
            time: "10:30 AM",
            gps: { lat: 29.9511, lng: -90.0715 },
            fileName: "photo.jpg"
        }
    ],

    // Reporter Info
    reporter: {
        name: "John Smith"
    },

    // Overview
    overview: {
        date: "1/29/2026",
        startTime: "7:00 AM",
        completedBy: "John Smith",
        projectName: "NOLA Street Improvements"
    },

    // v6: Entry-based Notes (replaces legacy arrays)
    entries: [
        {
            id: "local-uuid",
            section: "issues",           // issues | safety | qaqc | communications | visitors | contractor_work
            content: "Delay due to weather",
            timestamp: "ISO timestamp",
            contractorId: null           // Only for contractor_work section
        }
    ],

    // v6: Toggle States
    toggleStates: {
        communications_made: true,       // Yes/No for communications
        qaqc_performed: true,           // Yes/No for QA/QC
        visitors_present: false,         // Yes/No for visitors
        personnel_onsite: true          // Yes/No for personnel
    }
}
```

### Freeform Mode Report Object

```javascript
{
    // Identifiers (same as guided)
    projectId: "uuid",
    reportDate: "YYYY-MM-DD",
    captureMode: "freeform",
    lastSaved: "ISO timestamp",

    // Meta
    meta: {
        createdAt: "ISO timestamp",
        version: 2,
        naMarked: {},
        captureMode: "freeform",
        status: "draft"
    },

    // Weather (auto-fetched)
    weather: {
        highTemp: "72",
        lowTemp: "58",
        precipitation: "0.00\"",
        generalCondition: "Clear"
    },

    // Legacy single-string notes (for migration)
    freeformNotes: "",

    // v6.6: Timestamped Freeform Entries
    freeform_entries: [
        {
            id: "local-uuid",
            content: "Started work at 7am. Concrete pour for section A.",
            timestamp: "ISO timestamp"
        }
    ],

    // v6.6: Visual Checklist (quick toggles)
    freeform_checklist: {
        safety_confirmed: true,
        weather_recorded: true,
        photos_taken: false,
        personnel_counted: true
    },

    // Photos (same structure as guided)
    photos: [],

    // Overview
    overview: {
        date: "1/29/2026",
        startTime: "7:00 AM",
        completedBy: "John Smith"
    },

    // Reporter
    reporter: {
        name: "John Smith"
    }
}
```

---

## 3. Data Flow Diagram

```mermaid
flowchart TD
    subgraph "User Input"
        A[Text Entry] --> B[saveReport]
        C[Toggle Click] --> B
        D[Photo Capture] --> E[uploadPhotoToSupabase]
    end

    subgraph "localStorage First"
        B --> F[saveToLocalStorage]
        F --> G[CURRENT_REPORTS]
    end

    subgraph "Real-time Backup"
        B --> H{Entry Created?}
        H -->|Yes| I[queueEntryBackup]
        I --> J[backupEntry]
        J --> K[(report_entries)]
    end

    subgraph "Explicit Save / Finish"
        L[Finish Button] --> M[saveReportToSupabase]
        M --> N[(reports)]
        M --> O[saveRawCapture]
        O --> P[(report_raw_capture)]
        M --> Q[backupAllEntries]
        Q --> K
    end

    subgraph "AI Processing (n8n)"
        L --> R[callProcessWebhook]
        R --> S[n8n Webhook]
        S --> T[AI Processing]
        T --> U[saveAIResponse]
        U --> V[(ai_responses)]
    end

    subgraph "Final Report"
        T --> W[AI Refined Content]
        W --> X[User Edits]
        X --> Y[Submit Report]
        Y --> Z[(final_reports)]
    end

    E --> AA[(photos)]
    E --> AB[Supabase Storage]

    style G fill:#f9f,stroke:#333
    style K fill:#bbf,stroke:#333
    style N fill:#bbf,stroke:#333
    style P fill:#bbf,stroke:#333
    style V fill:#bbf,stroke:#333
    style Z fill:#bbf,stroke:#333
    style AA fill:#bbf,stroke:#333
```

### Sync Timing

| Event | localStorage | Supabase | Destination Table(s) |
|-------|-------------|----------|---------------------|
| Entry created/edited | Immediate | 2s debounce | `report_entries` |
| Toggle changed | Immediate | On Finish | `reports.toggle_states` |
| Photo captured | Immediate | Immediate | `photos`, Storage bucket |
| Form field changed | 500ms debounce | On Finish | `reports`, `report_raw_capture` |
| **Finish clicked** | N/A | Immediate | All tables |
| **Submit clicked** | N/A | Immediate | `final_reports` |

### Function Call Chain

```
User types entry → createEntry() → saveReport() → saveToLocalStorage()
                                 → queueEntryBackup() → [2s] → backupEntry() → Supabase

User clicks Finish → processReport() → saveReportToSupabase()
                                     → toSupabaseReport() → reports table
                                     → saveRawCapture() → report_raw_capture table
                                     → backupAllEntries() → report_entries table
                                     → callProcessWebhook() → n8n
```

---

## 4. Sync Function Reference

| Function | File | Trigger | Destination Table | Notes |
|----------|------|---------|-------------------|-------|
| `queueEntryBackup()` | sync-manager.js | Entry created/updated | `report_entries` | 2s debounce |
| `backupEntry()` | sync-manager.js | After debounce | `report_entries` | Single entry upsert |
| `backupAllEntries()` | sync-manager.js | Finish clicked | `report_entries` | Batch upsert |
| `saveReportToSupabase()` | quick-interview.js | Finish clicked | `reports`, `report_raw_capture` | Main save function |
| `uploadPhotoToSupabase()` | quick-interview.js | Photo captured | `photos`, Storage | Immediate |
| `deletePhotoFromSupabase()` | quick-interview.js | Photo deleted | `photos`, Storage | Immediate |
| `syncReport()` | sync-manager.js | Offline queue | `reports` | Retry logic |
| `syncRawCapture()` | sync-manager.js | Offline queue | `report_raw_capture` | Retry logic |
| `toSupabaseReport()` | supabase-utils.js | Called by save | N/A | Transform function |
| `toSupabaseEntry()` | supabase-utils.js | Called by backup | N/A | Transform function |
| `toSupabaseRawCapture()` | supabase-utils.js | Called by save | N/A | Transform function |
| `toSupabasePhoto()` | supabase-utils.js | Called by upload | N/A | Transform function |
| `fromSupabaseReport()` | supabase-utils.js | Load report | N/A | Transform function |
| `fromSupabaseEntry()` | supabase-utils.js | Load entries | N/A | Transform function |
| `reconstructReportFromSupabase()` | quick-interview.js | Page load | N/A | Full report reconstruction |

### Offline Queue Processing

```javascript
// sync-manager.js
processOfflineQueue() {
    // Process queued items when back online
    // Types: ENTRY_BACKUP, REPORT_SYNC, RAW_CAPTURE_SYNC
}
```

---

## 5. Field Mapping Matrix

### reports table

| localStorage Path | Supabase Column | Type | Notes |
|-------------------|-----------------|------|-------|
| `projectId` | `project_id` | UUID | FK to projects |
| `reportDate` | `report_date` | DATE | Required |
| `meta.status` | `status` | TEXT | draft/refined/submitted |
| `meta.captureMode` | `capture_mode` | TEXT | guided/freeform |
| `overview.completedBy` | `inspector_name` | TEXT | |
| `toggleStates` | `toggle_states` | JSONB | v6.6 |
| `safety.noIncidents` | `safety_no_incidents` | BOOLEAN | v6.6 |

### report_entries table

| localStorage Path | Supabase Column | Type | Notes |
|-------------------|-----------------|------|-------|
| `entries[].id` | `local_id` | TEXT | Client-generated |
| `entries[].section` | `section` | TEXT | issues/safety/qaqc/etc |
| `entries[].content` | `content` | TEXT | |
| `entries[].timestamp` | `timestamp` | TIMESTAMPTZ | v6.6 |
| `entries[].contractorId` | `contractor_id` | UUID | v6.6, FK to contractors |
| (auto) | `entry_order` | INTEGER | Calculated on save |
| (auto) | `is_deleted` | BOOLEAN | Soft delete flag |

### report_raw_capture table

| localStorage Path | Supabase Column | Type | Notes |
|-------------------|-----------------|------|-------|
| `meta.captureMode` | `capture_mode` | TEXT | |
| `weather` | `weather` | JSONB | Full weather object |
| `siteConditions` | `site_conditions` | TEXT | |
| `activities[]` | `raw_data.contractor_work` | JSONB | Nested in raw_data |
| `operations[]` | `raw_data.personnel` | JSONB | Nested in raw_data |
| `equipment[]` | `raw_data.equipment_usage` | JSONB | Nested in raw_data |
| `safety.hasIncidents` | `safety_has_incident` | BOOLEAN | |

### photos table

| localStorage Path | Supabase Column | Type | Notes |
|-------------------|-----------------|------|-------|
| `photos[].id` | `id` | UUID | Server-generated on insert |
| `photos[].storagePath` | `storage_path` | TEXT | Path in Storage bucket |
| `photos[].url` | `photo_url` | TEXT | Public URL |
| `photos[].caption` | `caption` | TEXT | |
| `photos[].timestamp` | `taken_at` | TIMESTAMPTZ | |
| `photos[].gps.lat` | `location_lat` | NUMERIC | |
| `photos[].gps.lng` | `location_lng` | NUMERIC | |

### Section Names Mapping

| localStorage Section | `report_entries.section` | Toggle State Key |
|---------------------|-------------------------|------------------|
| Issues & Delays | `issues` | N/A (always visible) |
| Safety | `safety` | N/A (checkbox based) |
| QA/QC Testing | `qaqc` | `qaqc_performed` |
| Communications | `communications` | `communications_made` |
| Visitors/Deliveries | `visitors` | `visitors_present` |
| Contractor Work | `contractor_work` | N/A |
| Personnel | `personnel` | `personnel_onsite` |

---

## Appendix: Unique Constraints

| Table | Constraint | Columns | Purpose |
|-------|-----------|---------|---------|
| `reports` | `reports_project_date_key` | `project_id`, `report_date` | One report per project per day |
| `report_entries` | `report_entries_report_local_key` | `report_id`, `local_id` | Dedup entries by local ID |

---

*Document generated from codebase analysis of FieldVoice-Pro-v6.6*

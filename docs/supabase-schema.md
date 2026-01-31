# FieldVoice Pro - Supabase Schema Documentation

**Last Updated:** 2026-01-25
**Generated From:** Code analysis of HTML files

---

## Executive Summary

FieldVoice Pro uses Supabase as its backend database to store:
- **Project Configuration:** Projects, contractors, and equipment definitions
- **Daily Reports:** Field reports with weather, activities, personnel, equipment usage
- **AI Processing:** Request/response logs for AI refinement
- **Photos:** Metadata for photos stored in Supabase Storage
- **User Data:** Inspector profiles and user-edited report content

The application uses a **single Supabase project** with anonymous authentication (anon key). All data operations use the JavaScript client library `@supabase/supabase-js@2`.

---

## Part 1: Table Inventory

### Core Tables
| Table | Purpose |
|-------|---------|
| `projects` | Project configuration and metadata |
| `reports` | Main daily report records |

### Project Reference Tables
| Table | Purpose |
|-------|---------|
| `contractors` | Contractors assigned to projects |
| `equipment` | Equipment assigned to projects |

### Report Detail Tables
| Table | Purpose |
|-------|---------|
| `report_raw_capture` | Raw field notes and weather data (1:1 with reports) |
| `report_contractor_work` | Contractor activities/narratives (1:N with reports) |
| `report_personnel` | Personnel counts by contractor (1:N with reports) |
| `report_equipment_usage` | Equipment hours/status (1:N with reports) |
| `report_photos` | Photo metadata (1:N with reports) |

### AI Processing Tables
| Table | Purpose |
|-------|---------|
| `report_ai_request` | AI processing request payloads (1:N with reports) |
| `report_ai_response` | AI processing responses (1:1 with reports via upsert) |

### User Data Tables
| Table | Purpose |
|-------|---------|
| `report_user_edits` | User manual edits to AI-generated content |
| `report_final` | Final submitted report snapshot (1:1 with reports) |
| `user_profiles` | Inspector profile information |

---

## Part 2: Table-by-Table Documentation

### projects

**Purpose:** Stores project configuration including identifiers, locations, contractors, and scheduling info.

**Columns Used in Code:**
| Column | Data Type (inferred) | Used In | Operation |
|--------|---------------------|---------|-----------|
| id | UUID | project-config.html, report.html, index.html | SELECT, INSERT, UPDATE, DELETE |
| project_name | TEXT | project-config.html, archives.html, index.html | SELECT, INSERT, UPDATE |
| noab_project_no | TEXT | project-config.html, index.html | SELECT, INSERT, UPDATE |
| cno_solicitation_no | TEXT | project-config.html | SELECT, INSERT, UPDATE |
| location | TEXT | project-config.html | SELECT, INSERT, UPDATE |
| engineer | TEXT | project-config.html | SELECT, INSERT, UPDATE |
| prime_contractor | TEXT | project-config.html | SELECT, INSERT, UPDATE |
| notice_to_proceed | DATE/TEXT | project-config.html | SELECT, INSERT, UPDATE |
| contract_duration | TEXT | project-config.html | SELECT, INSERT, UPDATE |
| weather_days | INTEGER | project-config.html | SELECT, INSERT, UPDATE |
| expected_completion | DATE/TEXT | project-config.html | SELECT, INSERT, UPDATE |
| default_start_time | TIME/TEXT | project-config.html | SELECT, INSERT, UPDATE |
| default_end_time | TIME/TEXT | project-config.html | SELECT, INSERT, UPDATE |
| logo | TEXT (base64 or URL) | project-config.html | SELECT, INSERT, UPDATE |
| status | TEXT ('active', etc.) | project-config.html, archives.html | SELECT, INSERT, UPDATE |
| created_at | TIMESTAMPTZ | project-config.html, index.html | SELECT (auto) |
| updated_at | TIMESTAMPTZ | project-config.html | INSERT, UPDATE |

**Indexes Needed:**
- `project_name` - ORDER BY queries in project lists
- `status` - Filter by active status

**Sample Query from Code:**
```javascript
// From project-config.html line 741
const { data: projectRows, error: projectError } = await supabaseClient
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
```

---

### contractors

**Purpose:** Stores contractor information associated with projects.

**Columns Used in Code:**
| Column | Data Type (inferred) | Used In | Operation |
|--------|---------------------|---------|-----------|
| id | UUID | project-config.html, report.html | SELECT, INSERT, UPDATE, DELETE |
| project_id | UUID (FK → projects.id) | project-config.html, report.html | SELECT, INSERT |
| name | TEXT | project-config.html | SELECT, INSERT, UPDATE |
| abbreviation | TEXT | project-config.html | SELECT, INSERT, UPDATE |
| type | TEXT ('prime', 'subcontractor') | project-config.html, report.html | SELECT, INSERT, UPDATE |
| trades | TEXT[] (array) | project-config.html | SELECT, INSERT, UPDATE |
| status | TEXT ('active', 'removed') | project-config.html | SELECT, INSERT, UPDATE |
| added_date | DATE/TEXT | project-config.html | SELECT, INSERT, UPDATE |
| removed_date | DATE/TEXT | project-config.html | SELECT, INSERT, UPDATE |
| updated_at | TIMESTAMPTZ | project-config.html | INSERT, UPDATE |

**Foreign Keys:**
- `project_id` → `projects.id` (CASCADE DELETE inferred from code comments)

**Indexes Needed:**
- `project_id` - Filter contractors by project

**Sample Query from Code:**
```javascript
// From report.html line 1319
const { data: contractorRows, error: contractorError } = await supabaseClient
    .from('contractors')
    .select('*')
    .eq('project_id', activeId);
```

---

### equipment

**Purpose:** Stores equipment definitions associated with projects.

**Columns Used in Code:**
| Column | Data Type (inferred) | Used In | Operation |
|--------|---------------------|---------|-----------|
| id | UUID | project-config.html, report.html | SELECT, INSERT, UPDATE, DELETE |
| project_id | UUID (FK → projects.id) | project-config.html | SELECT, INSERT |
| contractor_id | UUID (FK → contractors.id) | project-config.html | SELECT, INSERT, UPDATE |
| type | TEXT | project-config.html | SELECT, INSERT, UPDATE |
| model | TEXT | project-config.html | SELECT, INSERT, UPDATE |
| identifier | TEXT | project-config.html | SELECT, INSERT, UPDATE |
| status | TEXT ('active', 'removed') | project-config.html | SELECT, INSERT, UPDATE |
| added_date | DATE/TEXT | project-config.html | SELECT, INSERT, UPDATE |
| removed_date | DATE/TEXT | project-config.html | SELECT, INSERT, UPDATE |
| updated_at | TIMESTAMPTZ | project-config.html | INSERT, UPDATE |

**Foreign Keys:**
- `project_id` → `projects.id` (CASCADE DELETE)
- `contractor_id` → `contractors.id` (likely CASCADE DELETE)

**Sample Query from Code:**
```javascript
// From report.html line 1337
const { data: equipmentRows, error: equipmentError } = await supabaseClient
    .from('equipment')
    .select('*')
    .eq('project_id', activeId);
```

---

### reports

**Purpose:** Main report table storing daily report metadata.

**Columns Used in Code:**
| Column | Data Type (inferred) | Used In | Operation |
|--------|---------------------|---------|-----------|
| id | UUID | All report pages | SELECT, INSERT, UPDATE, DELETE |
| project_id | UUID (FK → projects.id) | report.html, index.html, drafts.html | SELECT, INSERT |
| report_date | DATE | report.html, index.html, drafts.html | SELECT, INSERT |
| inspector_name | TEXT | report.html, quick-interview.html | SELECT, INSERT, UPDATE |
| status | TEXT ('draft', 'pending_refine', 'refined', 'submitted', 'finalized') | All report pages | SELECT, INSERT, UPDATE |
| created_at | TIMESTAMPTZ | archives.html, admin-debug.html | SELECT (auto) |
| updated_at | TIMESTAMPTZ | report.html, quick-interview.html | INSERT, UPDATE |
| submitted_at | TIMESTAMPTZ | finalreview.html, archives.html | SELECT, UPDATE |

**Note:** Some code references `raw_capture` and `ai_generated` columns in drafts.html but these may be legacy/unused since separate tables exist.

**Foreign Keys:**
- `project_id` → `projects.id`

**Unique Constraint:**
- Likely `(project_id, report_date)` - enforced by code logic checking existing reports

**Indexes Needed:**
- `project_id` - Filter reports by project
- `report_date` - Order by date
- `status` - Filter by status
- `(project_id, report_date)` - Composite for lookup

**Sample Query from Code:**
```javascript
// From report.html line 1425
const result = await supabaseClient
    .from('reports')
    .select('*')
    .eq('project_id', activeProject.id)
    .eq('report_date', reportDateStr)
    .single();
```

---

### report_raw_capture

**Purpose:** Stores raw field notes, transcripts, and weather data captured during field work.

**Columns Used in Code:**
| Column | Data Type (inferred) | Used In | Operation |
|--------|---------------------|---------|-----------|
| report_id | UUID (FK → reports.id) | report.html, quick-interview.html | SELECT, INSERT, DELETE |
| capture_mode | TEXT ('guided', 'minimal') | report.html | SELECT, INSERT |
| freeform_notes | TEXT | report.html, quick-interview.html | SELECT, INSERT |
| work_summary | TEXT | report.html, quick-interview.html | SELECT, INSERT |
| issues_notes | TEXT | report.html, quick-interview.html | SELECT, INSERT |
| safety_notes | TEXT | report.html, quick-interview.html | SELECT, INSERT |
| weather_data | JSONB | report.html, quick-interview.html | SELECT, INSERT |
| captured_at | TIMESTAMPTZ | report.html | INSERT |
| transcript | TEXT | index.html | SELECT |
| guided_notes | JSONB/TEXT | index.html | SELECT |

**Foreign Keys:**
- `report_id` → `reports.id` (CASCADE DELETE)

**Relationship:** 1:1 with reports (maybeSingle() used in queries)

**Sample Query from Code:**
```javascript
// From report.html line 1448
supabaseClient.from('report_raw_capture').select('*').eq('report_id', reportRow.id).maybeSingle()
```

---

### report_contractor_work

**Purpose:** Stores contractor work activities and narratives for each contractor on a report.

**Columns Used in Code:**
| Column | Data Type (inferred) | Used In | Operation |
|--------|---------------------|---------|-----------|
| report_id | UUID (FK → reports.id) | report.html, quick-interview.html | SELECT, INSERT, DELETE |
| contractor_id | UUID (FK → contractors.id) | report.html, quick-interview.html | SELECT, INSERT |
| no_work_performed | BOOLEAN | report.html | SELECT, INSERT |
| narrative | TEXT | report.html | SELECT, INSERT |
| equipment_used | TEXT | report.html | SELECT, INSERT |
| crew | TEXT | report.html | SELECT, INSERT |

**Foreign Keys:**
- `report_id` → `reports.id` (CASCADE DELETE)
- `contractor_id` → `contractors.id`

**Relationship:** 1:N with reports (multiple contractors per report)

**Sample Query from Code:**
```javascript
// From report.html line 1449
supabaseClient.from('report_contractor_work').select('*').eq('report_id', reportRow.id)
```

---

### report_personnel

**Purpose:** Stores personnel counts (superintendents, foremen, etc.) by contractor.

**Columns Used in Code:**
| Column | Data Type (inferred) | Used In | Operation |
|--------|---------------------|---------|-----------|
| report_id | UUID (FK → reports.id) | report.html, quick-interview.html | SELECT, INSERT, DELETE |
| contractor_id | UUID (FK → contractors.id) | report.html, quick-interview.html | SELECT, INSERT |
| superintendents | INTEGER | report.html | SELECT, INSERT |
| foremen | INTEGER | report.html | SELECT, INSERT |
| operators | INTEGER | report.html | SELECT, INSERT |
| laborers | INTEGER | report.html | SELECT, INSERT |
| surveyors | INTEGER | report.html | SELECT, INSERT |
| others | INTEGER | report.html | SELECT, INSERT |

**Foreign Keys:**
- `report_id` → `reports.id` (CASCADE DELETE)
- `contractor_id` → `contractors.id`

**Relationship:** 1:N with reports

**Sample Query from Code:**
```javascript
// From report.html line 1450
supabaseClient.from('report_personnel').select('*').eq('report_id', reportRow.id)
```

---

### report_equipment_usage

**Purpose:** Stores equipment usage hours and status for a report.

**Columns Used in Code:**
| Column | Data Type (inferred) | Used In | Operation |
|--------|---------------------|---------|-----------|
| report_id | UUID (FK → reports.id) | report.html, quick-interview.html | SELECT, INSERT, DELETE |
| equipment_id | UUID (FK → equipment.id) | report.html, quick-interview.html | SELECT, INSERT |
| contractor_id | UUID (FK → contractors.id) | report.html | SELECT, INSERT |
| type | TEXT | report.html | SELECT, INSERT |
| qty | INTEGER | report.html | SELECT, INSERT |
| status | TEXT ('active', 'idle') | report.html, quick-interview.html | SELECT, INSERT |
| hours_used | INTEGER/DECIMAL | report.html, quick-interview.html | SELECT, INSERT |
| notes | TEXT | report.html, quick-interview.html | INSERT |

**Foreign Keys:**
- `report_id` → `reports.id` (CASCADE DELETE)
- `equipment_id` → `equipment.id`

**Relationship:** 1:N with reports

**Sample Query from Code:**
```javascript
// From report.html line 1451
supabaseClient.from('report_equipment_usage').select('*').eq('report_id', reportRow.id)
```

---

### report_photos

**Purpose:** Stores photo metadata with references to Supabase Storage.

**Columns Used in Code:**
| Column | Data Type (inferred) | Used In | Operation |
|--------|---------------------|---------|-----------|
| id | UUID | quick-interview.html, archives.html | SELECT, INSERT, UPDATE, DELETE |
| report_id | UUID (FK → reports.id) | report.html, quick-interview.html, archives.html | SELECT, INSERT |
| storage_path | TEXT | report.html, quick-interview.html | SELECT, INSERT |
| filename | TEXT | report.html, quick-interview.html | SELECT, INSERT |
| caption | TEXT | report.html, quick-interview.html | SELECT, INSERT, UPDATE |
| gps_lat | DECIMAL/FLOAT | report.html, quick-interview.html | SELECT, INSERT |
| gps_lng | DECIMAL/FLOAT | report.html, quick-interview.html | SELECT, INSERT |
| taken_at | TIMESTAMPTZ | report.html, quick-interview.html | SELECT, INSERT |
| created_at | TIMESTAMPTZ | report.html, quick-interview.html | SELECT, INSERT |

**Foreign Keys:**
- `report_id` → `reports.id` (CASCADE DELETE)

**Relationship:** 1:N with reports

**Sample Query from Code:**
```javascript
// From report.html line 1452
supabaseClient.from('report_photos').select('*').eq('report_id', reportRow.id).order('created_at', { ascending: true })
```

---

### report_ai_request

**Purpose:** Stores AI processing request payloads for audit/debugging.

**Columns Used in Code:**
| Column | Data Type (inferred) | Used In | Operation |
|--------|---------------------|---------|-----------|
| report_id | UUID (FK → reports.id) | quick-interview.html | INSERT |
| request_payload | JSONB | quick-interview.html | INSERT |
| sent_at | TIMESTAMPTZ | quick-interview.html | INSERT |

**Foreign Keys:**
- `report_id` → `reports.id` (CASCADE DELETE)

**Relationship:** 1:N with reports (allows retry logging)

**Sample Query from Code:**
```javascript
// From quick-interview.html line 1658
const { error } = await supabaseClient
    .from('report_ai_request')
    .insert(requestData);
```

---

### report_ai_response

**Purpose:** Stores AI-generated content for reports.

**Columns Used in Code:**
| Column | Data Type (inferred) | Used In | Operation |
|--------|---------------------|---------|-----------|
| report_id | UUID (FK → reports.id) | report.html, quick-interview.html, finalreview.html | SELECT, UPSERT |
| response_payload | JSONB | report.html, quick-interview.html | SELECT, UPSERT |
| model_used | TEXT | quick-interview.html | INSERT |
| processing_time_ms | INTEGER | quick-interview.html | INSERT |
| received_at | TIMESTAMPTZ | report.html, quick-interview.html | SELECT, INSERT |

**Foreign Keys:**
- `report_id` → `reports.id` (CASCADE DELETE)

**Unique Constraint:**
- `report_id` (used with `onConflict: 'report_id'` for upsert)

**Relationship:** 1:1 with reports (upsert enforces this)

**Sample Query from Code:**
```javascript
// From quick-interview.html line 1686
const { error } = await supabaseClient
    .from('report_ai_response')
    .upsert(responseData, { onConflict: 'report_id' });

// From report.html line 1454
supabaseClient.from('report_ai_response').select('*').eq('report_id', reportRow.id).order('received_at', { ascending: false }).limit(1).maybeSingle()
```

---

### report_user_edits

**Purpose:** Stores user manual edits to AI-generated content.

**Columns Used in Code:**
| Column | Data Type (inferred) | Used In | Operation |
|--------|---------------------|---------|-----------|
| report_id | UUID (FK → reports.id) | report.html | SELECT, INSERT, DELETE |
| field_path | TEXT | report.html | SELECT, INSERT |
| edited_value | TEXT | report.html | SELECT, INSERT |
| edited_at | TIMESTAMPTZ | report.html | INSERT |

**Foreign Keys:**
- `report_id` → `reports.id` (CASCADE DELETE)

**Relationship:** 1:N with reports

**Sample Query from Code:**
```javascript
// From report.html line 1455
supabaseClient.from('report_user_edits').select('*').eq('report_id', reportRow.id)
```

---

### report_final

**Purpose:** Stores the final submitted version of a report as a snapshot.

**Columns Used in Code:**
| Column | Data Type (inferred) | Used In | Operation |
|--------|---------------------|---------|-----------|
| id | UUID | finalreview.html | SELECT |
| report_id | UUID (FK → reports.id) | finalreview.html | SELECT, INSERT, UPDATE |
| final_data | JSONB | finalreview.html | SELECT, INSERT, UPDATE |
| submitted_at | TIMESTAMPTZ | finalreview.html | SELECT, INSERT, UPDATE |

**Foreign Keys:**
- `report_id` → `reports.id` (CASCADE DELETE)

**Relationship:** 1:1 with reports

**Sample Query from Code:**
```javascript
// From finalreview.html line 2105
const { data: existingFinal } = await supabaseClient
    .from('report_final')
    .select('id')
    .eq('report_id', currentReportId)
    .single();
```

---

### user_profiles

**Purpose:** Stores inspector profile information.

**Columns Used in Code:**
| Column | Data Type (inferred) | Used In | Operation |
|--------|---------------------|---------|-----------|
| id | UUID | settings.html | SELECT, INSERT, UPDATE |
| full_name | TEXT | settings.html, report.html, finalreview.html | SELECT, INSERT, UPDATE |
| title | TEXT | settings.html | SELECT, INSERT, UPDATE |
| company | TEXT | settings.html | SELECT, INSERT, UPDATE |
| email | TEXT | settings.html | SELECT, INSERT, UPDATE |
| phone | TEXT | settings.html | SELECT, INSERT, UPDATE |
| updated_at | TIMESTAMPTZ | settings.html | INSERT, UPDATE |

**Note:** Currently appears to be single-user (limit(1).single() used)

**Sample Query from Code:**
```javascript
// From settings.html line 209
const { data, error } = await supabaseClient
    .from('user_profiles')
    .select('*')
    .limit(1)
    .single();
```

---

## Part 3: Relationship Diagram

```
projects
│
├──< contractors (project_id → projects.id) CASCADE
│   │
│   └──< equipment (contractor_id → contractors.id) CASCADE
│
├──< equipment (project_id → projects.id) CASCADE
│
└──< reports (project_id → projects.id)
    │
    ├──1 report_raw_capture (report_id → reports.id) CASCADE
    │
    ├──< report_contractor_work (report_id → reports.id) CASCADE
    │
    ├──< report_personnel (report_id → reports.id) CASCADE
    │
    ├──< report_equipment_usage (report_id → reports.id) CASCADE
    │
    ├──< report_photos (report_id → reports.id) CASCADE
    │
    ├──< report_ai_request (report_id → reports.id) CASCADE
    │
    ├──1 report_ai_response (report_id → reports.id) CASCADE, UNIQUE(report_id)
    │
    ├──< report_user_edits (report_id → reports.id) CASCADE
    │
    └──1 report_final (report_id → reports.id) CASCADE


user_profiles (standalone - no FK relationships)


Legend:
──1 : One-to-one relationship
──< : One-to-many relationship
CASCADE : Deleting parent deletes children
```

---

## Part 4: Identified Schema Issues

### 4.1 Column Mismatches / Potential Issues

| Issue | Location | Description |
|-------|----------|-------------|
| **Legacy columns in `reports`** | drafts.html:457-458 | Code inserts `raw_capture` column directly into `reports` table, but data is typically stored in `report_raw_capture` |
| **Legacy column `ai_generated`** | drafts.html:492-493 | Code updates `ai_generated` column in `reports`, but data typically stored in `report_ai_response` |
| **Inconsistent `contractor_id` in `report_equipment_usage`** | report.html | Sometimes includes `contractor_id`, sometimes omits it |
| **Missing `equipment_id` in some inserts** | report.html:2733-2741 | Uses inline `type`, `qty` instead of referencing equipment table |

### 4.2 Missing Constraints (Inferred)

| Table | Suggested Constraint | Reason |
|-------|---------------------|--------|
| `reports` | UNIQUE(project_id, report_date) | Code checks for existing report before insert |
| `report_ai_response` | UNIQUE(report_id) | Uses `onConflict: 'report_id'` for upsert |
| `report_raw_capture` | UNIQUE(report_id) | 1:1 relationship with reports |
| `report_final` | UNIQUE(report_id) | 1:1 relationship with reports |
| `user_profiles` | Consider adding user_id for multi-user support | Currently single-user only |

### 4.3 Data Type Considerations

| Issue | Table.Column | Current (Inferred) | Recommended |
|-------|--------------|-------------------|-------------|
| **Weather data** | report_raw_capture.weather_data | JSONB | Good - JSONB is appropriate |
| **GPS coordinates** | report_photos.gps_lat/gps_lng | FLOAT/DECIMAL | Consider PostgreSQL `POINT` type |
| **Trades array** | contractors.trades | TEXT[] | Good - native array type |
| **Date strings** | Various `*_date` columns | TEXT | Should be DATE type |
| **Time strings** | projects.default_*_time | TEXT | Should be TIME type |

### 4.4 Query Anti-Patterns Observed

| Pattern | Location | Issue |
|---------|----------|-------|
| **SELECT *** | Multiple files | Retrieves unnecessary columns; specify needed columns |
| **Delete + Insert instead of Upsert** | report.html:2673-2680 | For child tables, could use upsert instead |
| **No pagination** | archives.html | `getAllReports()` fetches all reports without limit |
| **Sequential queries** | Some files | Could use Promise.all() more consistently |

### 4.5 Orphan Data Risks

| Risk | Description | Mitigation |
|------|-------------|------------|
| **Storage orphans** | Photos in storage may not be deleted when report deleted | Add storage cleanup trigger or policy |
| **Equipment usage without equipment reference** | Some equipment usage records use inline data | Enforce FK constraint |

---

## Part 5: Storage Buckets

### Buckets

| Bucket Name | Used By | Operations | File Types |
|-------------|---------|------------|------------|
| `report-photos` | quick-interview.html, report.html | upload, getPublicUrl, remove | images (JPEG after compression) |

### Storage Patterns

**File Naming Convention:**
```
{report_id}/{photo_id}_{original_filename}
```

Example: `550e8400-e29b-41d4-a716-446655440000/photo_abc123_IMG_001.jpg`

**Path Structure:**
- Files organized by report ID
- Each photo has unique ID prefix to prevent collisions

**Access:**
- Public access via `getPublicUrl()` - no authentication required to view
- Upload requires Supabase client (anon key)

**URL Construction:**
```javascript
// From report.html line 1530
url: p.storage_path ? `${SUPABASE_URL}/storage/v1/object/public/report-photos/${p.storage_path}` : ''
```

**Image Processing:**
- Photos compressed client-side before upload (quick-interview.html:3316)
- Max width: 1200px
- Quality: 0.7 (70% JPEG quality)
- Format: Converted to JPEG

**Orphan Cleanup:**
- When deleting a photo, both storage file and metadata are removed
- When deleting a report, storage files may not be automatically removed (depends on triggers)

---

## Part 6: RLS Policies

### Current State

Based on code analysis, **Row Level Security (RLS) appears to be disabled** or using permissive policies:

1. **No `.auth()` calls observed** - Application uses anonymous key only
2. **Single user assumption** - `user_profiles` uses `limit(1).single()`
3. **No user filtering in queries** - All queries access data without user constraints

### Security Implications

| Risk | Current State | Recommendation |
|------|---------------|----------------|
| **Data isolation** | All users share same data | Add RLS with user_id filtering if multi-user |
| **Anonymous access** | Anyone with anon key can read/write | Consider authenticated access for sensitive operations |
| **Delete protection** | No restrictions on deletion | Add RLS policy to prevent unauthorized deletes |

### Recommended RLS Policies (if implementing multi-user)

```sql
-- Example: projects policy
CREATE POLICY "Users can only access their own projects"
ON projects
FOR ALL
USING (auth.uid() = user_id);

-- Example: reports policy
CREATE POLICY "Users can only access their own reports"
ON reports
FOR ALL
USING (project_id IN (
  SELECT id FROM projects WHERE user_id = auth.uid()
));
```

---

## Part 7: Common Operations Reference

### Create Report Flow

```javascript
// From quick-interview.html
// 1. Check if report already exists
const { data: existingReport } = await supabaseClient
    .from('reports')
    .select('id')
    .eq('project_id', activeProject.id)
    .eq('report_date', todayStr)
    .maybeSingle();

reportId = existingReport?.id || generateId();

// 2. Upsert main report record
const reportData = {
    id: reportId,
    project_id: activeProject.id,
    report_date: todayStr,
    inspector_name: userSettings?.full_name || '',
    status: 'draft',
    updated_at: new Date().toISOString()
};
await supabaseClient.from('reports').upsert(reportData, { onConflict: 'id' });

// 3. Delete + Insert child tables (report_raw_capture, etc.)
await supabaseClient.from('report_raw_capture').delete().eq('report_id', reportId);
await supabaseClient.from('report_raw_capture').insert(rawCaptureData);

// 4. Repeat for other child tables...
// report_contractor_work, report_personnel, report_equipment_usage
```

### Load Report Flow

```javascript
// From report.html
// 1. Load main report
const { data: reportRow } = await supabaseClient
    .from('reports')
    .select('*')
    .eq('project_id', activeProject.id)
    .eq('report_date', reportDateStr)
    .single();

// 2. Parallel fetch all related data
const [rawCapture, contractorWork, personnel, equipmentUsage, photos, aiResponse, userEdits] =
  await Promise.all([
    supabaseClient.from('report_raw_capture').select('*').eq('report_id', reportRow.id).maybeSingle(),
    supabaseClient.from('report_contractor_work').select('*').eq('report_id', reportRow.id),
    supabaseClient.from('report_personnel').select('*').eq('report_id', reportRow.id),
    supabaseClient.from('report_equipment_usage').select('*').eq('report_id', reportRow.id),
    supabaseClient.from('report_photos').select('*').eq('report_id', reportRow.id).order('created_at'),
    supabaseClient.from('report_ai_response').select('*').eq('report_id', reportRow.id).order('received_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseClient.from('report_user_edits').select('*').eq('report_id', reportRow.id)
]);

// 3. Reconstruct report object
```

### Submit Report Flow

```javascript
// From finalreview.html
// 1. Save final version to report_final table
const finalData = {
    report_id: currentReportId,
    final_data: { /* all report sections */ },
    submitted_at: submittedAt
};

// Check if final record exists
const { data: existingFinal } = await supabaseClient
    .from('report_final')
    .select('id')
    .eq('report_id', currentReportId)
    .single();

if (existingFinal) {
    await supabaseClient.from('report_final').update(finalData).eq('report_id', currentReportId);
} else {
    await supabaseClient.from('report_final').insert(finalData);
}

// 2. Update reports table status
await supabaseClient
    .from('reports')
    .update({
        status: 'submitted',
        submitted_at: submittedAt,
        updated_at: submittedAt
    })
    .eq('id', currentReportId);
```

### Delete Report Flow

```javascript
// From archives.html / admin-debug.html
// Single delete - cascade handles related tables
const { error } = await supabaseClient
    .from('reports')
    .delete()
    .eq('id', reportId);

// Note: Storage photos may need separate cleanup
```

### Upload Photo Flow

```javascript
// From quick-interview.html
// 1. Compress image client-side
const compressedUrl = await compressImage(dataUrl, 1200, 0.7);

// 2. Upload to storage
const fileName = `${currentReportId}/${photoId}_${file.name}`;
const { data, error } = await supabaseClient.storage
    .from('report-photos')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });

// 3. Get public URL
const { data: urlData } = supabaseClient.storage
    .from('report-photos')
    .getPublicUrl(fileName);

// 4. Save metadata to report_photos table
await supabaseClient
    .from('report_photos')
    .upsert({
        id: photoId,
        report_id: currentReportId,
        storage_path: fileName,
        filename: file.name,
        caption: '',
        gps_lat: gps?.lat,
        gps_lng: gps?.lng,
        taken_at: timestamp,
        created_at: new Date().toISOString()
    }, { onConflict: 'id' });
```

---

## Part 8: Recommendations

### High Priority

1. **Add unique constraints** on `reports(project_id, report_date)` and `report_ai_response(report_id)`

2. **Clean up legacy columns** - Remove or deprecate `raw_capture` and `ai_generated` from `reports` table if not needed

3. **Implement storage cleanup** - Add trigger or background job to delete storage files when reports are deleted

4. **Add proper date/time types** - Convert string date columns to proper PostgreSQL DATE/TIME types

### Medium Priority

5. **Specify columns in SELECT** - Replace `SELECT *` with explicit column lists for better performance

6. **Add pagination to archives** - Implement cursor-based pagination for report lists

7. **Consider RLS** - If moving to multi-user, implement Row Level Security policies

8. **Add indexes** - Create indexes on frequently filtered columns (project_id, report_date, status)

### Low Priority

9. **Use upsert consistently** - Replace delete+insert patterns with upsert for child tables

10. **Normalize equipment usage** - Ensure `equipment_id` FK is always populated

11. **Add audit columns** - Consider `created_by`/`updated_by` columns for tracking

---

## Appendix: Supabase Connection Details

**URL:** `https://ruzadotbgkjhgwkvotlz.supabase.co`

**Client Initialization:**
```javascript
const SUPABASE_URL = 'https://ruzadotbgkjhgwkvotlz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

**Note:** This documentation is based on code analysis only. To verify actual schema, constraints, and indexes, query the Supabase database directly using the SQL editor or API.

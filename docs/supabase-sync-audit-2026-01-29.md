# FieldVoice Pro v6.6 - Supabase Schema Audit Report

**Date:** 2026-01-29  
**Project:** FieldVoice-Pro-v6.6  
**Supabase Ref:** wejwhplqnhciyxbinivx  
**Audit Type:** Schema vs localStorage sync gap analysis

---

## 1. Schema Summary

### Target Tables

| Table | Columns | Types | Key Constraints |
|-------|---------|-------|-----------------|
| **reports** | id, project_id, user_id, device_id, report_date, status, capture_mode, pdf_url, created_at, updated_at, submitted_at | UUID, UUID (FK), UUID, TEXT, DATE, TEXT, TEXT, TEXT, TIMESTAMPTZ×3 | PK: id, FK: project_id → projects(id) CASCADE |
| **report_raw_capture** | id, report_id, capture_mode, raw_data, weather, location, site_conditions, qaqc_notes, communications, visitors_remarks, safety_has_incident, created_at | UUID, UUID (FK), TEXT, JSONB×3, TEXT×4, BOOLEAN, TIMESTAMPTZ | PK: id, FK: report_id → reports(id) CASCADE |
| **report_entries** | id, report_id, local_id, section, content, entry_order, created_at, updated_at, is_deleted | UUID, UUID (FK), TEXT, TEXT NOT NULL, TEXT, INTEGER, TIMESTAMPTZ×2, BOOLEAN | PK: id, FK: report_id → reports(id) CASCADE |
| **final_reports** | id, report_id, pdf_url, weather_*, content_*, has_*, *_display, *_json, created_at, submitted_at | UUID, UUID (FK), TEXT, many others | PK: id, FK: report_id → reports(id) CASCADE |
| **photos** | id, report_id, photo_url, storage_path, caption, photo_type, taken_at, location_lat, location_lng, created_at | UUID, UUID (FK), TEXT×4, TIMESTAMPTZ, NUMERIC×2, TIMESTAMPTZ | PK: id, FK: report_id → reports(id) CASCADE |

### RLS Policies

All tables have RLS enabled with permissive "Allow all" policies:
```sql
CREATE POLICY "Allow all access to [table]" ON [table] FOR ALL USING (true) WITH CHECK (true);
```

**⚠️ Security Note:** These are development-only policies. Production should restrict access based on user_id.

---

## 2. Gap Matrix

### Guided Mode Fields

| localStorage Field | Supabase Destination | Status | Notes |
|--------------------|---------------------|--------|-------|
| `report.activities[]` | `report_raw_capture.raw_data.contractor_work` | ⚠️ PARTIAL | Stored in JSONB, original design expected `report_contractor_work` table |
| `report.activities[].contractorId` | `raw_data.contractor_work[].contractor_id` | ✅ Mapped | Nested in JSONB |
| `report.activities[].noWork` | `raw_data.contractor_work[].no_work_performed` | ✅ Mapped | Nested in JSONB |
| `report.activities[].narrative` | `raw_data.contractor_work[].narrative` | ✅ Mapped | Nested in JSONB |
| `report.activities[].equipmentUsed` | `raw_data.contractor_work[].equipment_used` | ✅ Mapped | Nested in JSONB |
| `report.activities[].crew` | `raw_data.contractor_work[].crew` | ✅ Mapped | Nested in JSONB |
| `report.entries[]` | `report_entries` | ⚠️ CONSTRAINT ISSUE | See Root Cause section |
| `report.entries[].section` | `report_entries.section` | ✅ Mapped | NOT NULL constraint |
| `report.entries[].content` | `report_entries.content` | ✅ Mapped | |
| `report.entries[].id` | `report_entries.local_id` | ⚠️ MISALIGNED | Code uses `local_id` for conflict resolution but no unique constraint exists |
| `report.equipmentRows[]` | `report_raw_capture.raw_data.equipment_usage` | ⚠️ PARTIAL | Stored in JSONB |
| `report.safety.noIncidents` | ❌ NOT STORED | ❌ MISSING | No dedicated column |
| `report.safety.hasIncidents` | `report_raw_capture.safety_has_incident` | ✅ Mapped | Boolean field |
| `report.safety.notes[]` | `report_raw_capture.raw_data` or inline | ⚠️ INCONSISTENT | Sometimes in safety_notes field, sometimes not |
| `report.toggleStates.qaqc_performed` | ❌ NOT STORED | ❌ MISSING | No column for toggle states |
| `report.toggleStates.communications_made` | ❌ NOT STORED | ❌ MISSING | No column for toggle states |
| `report.toggleStates.visitors_present` | ❌ NOT STORED | ❌ MISSING | No column for toggle states |
| `report.photos[]` | `photos` table | ✅ Mapped | Works correctly |
| `report.overview.weather` | `report_raw_capture.weather` | ✅ Mapped | JSONB |
| `report.overview.completedBy` | `reports.inspector_name` | ✅ Mapped | |
| `report.meta.captureMode` | `reports.capture_mode` | ✅ Mapped | |
| `report.meta.status` | `reports.status` | ✅ Mapped | |
| `report.operations[]` (personnel) | `report_raw_capture.raw_data.personnel` | ⚠️ PARTIAL | Stored in JSONB |

### Freeform Mode Fields

| localStorage Field | Supabase Destination | Status | Notes |
|--------------------|---------------------|--------|-------|
| `report.freeform_entries[]` | Via migration to `report.entries[]` | ⚠️ INDIRECT | Migrated on load, not directly synced |
| `report.freeform_checklist{}` | ❌ NOT STORED | ❌ MISSING | Visual-only, never persisted |
| `report.fieldNotes.freeformNotes` | Migrated to `freeform_entries` | ⚠️ LEGACY | One-time migration |

---

## 3. Root Cause: report_entries Constraint Error

### The Problem

**File:** `js/sync-manager.js` (lines 64-67, 112-115)

```javascript
const { error } = await supabaseClient
    .from('report_entries')
    .upsert(supabaseEntry, {
        onConflict: 'report_id,local_id',  // ← PROBLEM HERE
        ignoreDuplicates: false
    });
```

**Issue:** The code uses `onConflict: 'report_id,local_id'` for upsert operations, but the database schema has **NO UNIQUE CONSTRAINT** on the `(report_id, local_id)` combination.

### Schema Definition (from migration)

```sql
CREATE TABLE IF NOT EXISTS report_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  local_id TEXT,
  section TEXT NOT NULL,
  content TEXT,
  entry_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);
```

**Missing constraint:**
```sql
-- THIS DOES NOT EXIST:
UNIQUE(report_id, local_id)
```

### Why This Causes Errors

PostgreSQL's `ON CONFLICT` clause requires a **unique index or constraint** to detect conflicts. Without it:
- Supabase/PostgreSQL cannot determine which row to update
- The upsert fails with a constraint/conflict resolution error
- Entries fail to sync, potentially causing data loss

### Secondary Issue: section NOT NULL

The `section` column has a `NOT NULL` constraint, but some conversion paths may not guarantee a section value:

**In `toSupabaseEntry()` (supabase-utils.js):**
```javascript
function toSupabaseEntry(entry, reportId) {
  const row = {
    report_id: reportId,
    local_id: entry.localId || entry.id || null,
    section: entry.section || '',  // ← Empty string, not NULL, but may be unexpected
    content: entry.content || '',
    // ...
  };
}
```

If `entry.section` is undefined/null, it becomes `''` which satisfies NOT NULL but may cause semantic issues.

---

## 4. Conversion Function Audit

### js/supabase-utils.js

| Function | Issues Found |
|----------|-------------|
| `toSupabaseReport()` | ✅ No issues - properly maps all required fields |
| `toSupabaseEntry()` | ⚠️ Uses `entry.localId || entry.id` which may cause ID confusion |
| `toSupabaseRawCapture()` | ✅ Properly builds raw_data JSONB with nested structures |
| `toSupabasePhoto()` | ✅ No issues |
| `fromSupabaseEntry()` | ✅ No issues |

### js/sync-manager.js

| Function | Issues Found |
|----------|-------------|
| `queueEntryBackup()` | ⚠️ Relies on broken upsert with non-existent constraint |
| `backupEntry()` | ❌ Uses `onConflict: 'report_id,local_id'` - will fail |
| `backupAllEntries()` | ❌ Same issue as backupEntry |
| `syncReport()` | ✅ Uses correct `onConflict: 'id'` pattern |
| `syncRawCapture()` | ⚠️ Uses `onConflict: 'report_id'` - needs unique constraint on report_id |

### js/quick-interview.js

| Function | Issues Found |
|----------|-------------|
| `saveReportToSupabase()` | ✅ Uses DELETE+INSERT pattern for raw_capture (avoids constraint issue) |
| `savePhotoMetadata()` | ✅ Uses `onConflict: 'id'` correctly |

---

## 5. Fields NOT Being Converted/Synced

### Critical Missing Fields

1. **Toggle States** (`report.toggleStates`)
   - `qaqc_performed` 
   - `communications_made`
   - `visitors_present`
   - **Impact:** User's section toggles are lost on sync/reload

2. **Safety No Incidents Flag** (`report.safety.noIncidents`)
   - Only `hasIncidents` maps to `safety_has_incident`
   - **Impact:** "No incidents" selection not persisted distinctly

3. **Freeform Checklist** (`report.freeform_checklist`)
   - Visual checklist state never saved
   - **Impact:** Checklist resets on reload (acceptable if intentional)

4. **Entry-level Metadata**
   - `entry.synced` flag tracked locally but not in DB
   - `entry.supabase_id` sometimes missing

---

## 6. Recommended Fixes

### Fix 1: Add Missing Unique Constraint (HIGH PRIORITY)

```sql
-- Add unique constraint for entry upserts
ALTER TABLE report_entries 
ADD CONSTRAINT report_entries_report_local_unique 
UNIQUE (report_id, local_id);
```

**Alternative (if local_id can be null):**
```sql
CREATE UNIQUE INDEX report_entries_report_local_idx 
ON report_entries (report_id, local_id) 
WHERE local_id IS NOT NULL;
```

### Fix 2: Add Unique Constraint for raw_capture (MEDIUM PRIORITY)

```sql
-- Add unique constraint for raw_capture upserts
ALTER TABLE report_raw_capture 
ADD CONSTRAINT report_raw_capture_report_unique 
UNIQUE (report_id);
```

### Fix 3: Add Toggle States Columns (MEDIUM PRIORITY)

```sql
ALTER TABLE report_raw_capture
ADD COLUMN IF NOT EXISTS toggle_qaqc_performed BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS toggle_communications_made BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS toggle_visitors_present BOOLEAN DEFAULT NULL;
```

Or store in JSONB:
```sql
ALTER TABLE report_raw_capture
ADD COLUMN IF NOT EXISTS toggle_states JSONB DEFAULT '{}';
```

### Fix 4: Add safety_no_incidents Column (LOW PRIORITY)

```sql
ALTER TABLE report_raw_capture
ADD COLUMN IF NOT EXISTS safety_no_incidents BOOLEAN DEFAULT FALSE;
```

### Fix 5: Update Conversion Functions

**In `toSupabaseRawCapture()` - add toggle states:**
```javascript
function toSupabaseRawCapture(captureData, reportId) {
  // ... existing code ...
  
  // Add toggle states
  if (captureData.toggleStates) {
    rawData.toggleStates = captureData.toggleStates;
  }
  
  return {
    // ... existing fields ...
    toggle_states: captureData.toggleStates || null  // if using JSONB column
  };
}
```

---

## 7. Summary

### ✅ Working Correctly
- Reports table sync
- Photos table sync  
- Project/Contractor sync (project-config.js)
- Weather data (JSONB)
- Basic report metadata

### ⚠️ Partial/Inconsistent
- Contractor work (stored in JSONB, not normalized table)
- Personnel data (stored in JSONB, not normalized table)
- Equipment usage (stored in JSONB, not normalized table)
- Safety incident flag (only hasIncidents, not noIncidents)

### ❌ Broken/Missing
- **report_entries upsert** - Missing unique constraint causes failures
- **Toggle states** - Not persisted to database
- **Freeform checklist** - Not persisted (may be intentional)
- **Entry real-time sync** - Blocked by constraint issue

### Priority Actions

1. 🔴 **CRITICAL:** Add `UNIQUE(report_id, local_id)` constraint to `report_entries`
2. 🟠 **HIGH:** Add `UNIQUE(report_id)` constraint to `report_raw_capture`
3. 🟡 **MEDIUM:** Add toggle_states column/storage to schema
4. 🟢 **LOW:** Add safety_no_incidents column for completeness

---

*Report generated by George 🫡 for Jackson Koerner*

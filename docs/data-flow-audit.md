# FieldVoice Pro Data Flow Audit

**Generated:** 2026-01-25
**Audit Type:** Read-Only Investigation
**Status:** Complete

---

## Table of Contents

1. [localStorage Keys Inventory](#1-localstorage-keys-inventory)
2. [Supabase Tables Usage by Page](#2-supabase-tables-usage-by-page)
3. [Page-by-Page Breakdown](#3-page-by-page-breakdown)
4. [Report Lifecycle Flow](#4-report-lifecycle-flow)
5. [Data Flow Diagram (ASCII)](#5-data-flow-diagram-ascii)
6. [Identified Issues & Inconsistencies](#6-identified-issues--inconsistencies)
7. [Recommendations](#7-recommendations)

---

## 1. localStorage Keys Inventory

### Complete Key Registry

| Key Name | Written By | Read By | Deleted By | Purpose | Data Structure |
|----------|-----------|---------|------------|---------|----------------|
| `fvp_active_project` | index.html, drafts.html, project-config.html | index.html, quick-interview.html, report.html, finalreview.html, drafts.html, project-config.html | project-config.html | Store UUID of currently selected project | `string` (UUID) |
| `fvp_quick_interview_draft` | quick-interview.html, drafts.html | quick-interview.html | quick-interview.html | Draft data during interview process | `object` (complex interview state) |
| `fvp_offline_queue` | quick-interview.html, drafts.html | index.html, quick-interview.html, drafts.html | - | Queue of reports pending sync | `{ drafts: [...] }` |
| `fvp_ai_response_${reportId}` | quick-interview.html | report.html | report.html, index.html (cleanup) | Temporary cache for AI response until saved to DB | `object` (AI generated report) |
| `fvp_mic_granted` | quick-interview.html, permissions.html | index.html, quick-interview.html, permissions.html | permissions.html | Track microphone permission status | `'true'` |
| `fvp_mic_timestamp` | permissions.html | - | permissions.html | When mic permission was granted | `string` (timestamp) |
| `fvp_cam_granted` | permissions.html | permissions.html | permissions.html | Track camera permission status | `'true'` |
| `fvp_loc_granted` | index.html, quick-interview.html, permissions.html | index.html, quick-interview.html, permissions.html | index.html, permissions.html | Track location permission status | `'true'` |
| `fvp_speech_granted` | - | permissions.html | permissions.html | Track speech recognition status | `'true'` |
| `fvp_onboarded` | permissions.html | index.html, permissions.html | permissions.html | Track if user completed onboarding | `'true'` |
| `fvp_banner_dismissed` | index.html | index.html | index.html | Track if permissions banner dismissed | `'true'` |
| `fvp_banner_dismissed_date` | index.html | index.html | index.html | When banner was dismissed (24hr reset) | `string` (ISO date) |
| `fvp_dictation_hint_dismissed` | quick-interview.html | quick-interview.html | - | Track if dictation hint shown | `'true'` |
| `permissions_dismissed` | quick-interview.html | - | - | Track if permissions modal dismissed | `'true'` |

### sessionStorage Keys

| Key Name | Written By | Read By | Purpose |
|----------|-----------|---------|---------|
| `fvp_submitted_banner_dismissed` | index.html | index.html | Track if "submitted" banner dismissed this session |

---

## 2. Supabase Tables Usage by Page

### Master Table Matrix

| Table | index.html | quick-interview.html | report.html | finalreview.html | archives.html | admin-debug.html | settings.html | drafts.html | project-config.html |
|-------|------------|---------------------|-------------|-----------------|---------------|-----------------|---------------|-------------|-------------------|
| `projects` | SELECT | SELECT | SELECT | SELECT | SELECT | (via JOIN) | - | - | SELECT, UPSERT, DELETE |
| `reports` | SELECT | SELECT, UPSERT | SELECT, UPSERT | SELECT, UPDATE | SELECT, DELETE | SELECT, UPDATE, DELETE | - | SELECT, INSERT, UPDATE | - |
| `report_raw_capture` | SELECT | SELECT, DELETE, INSERT | SELECT, DELETE, INSERT | SELECT | - | - | - | - | - |
| `report_contractor_work` | SELECT | SELECT, DELETE, INSERT | SELECT, DELETE, INSERT | SELECT | - | - | - | - | - |
| `report_personnel` | - | SELECT, DELETE, INSERT | SELECT, DELETE, INSERT | SELECT | - | - | - | - | - |
| `report_equipment_usage` | - | SELECT, DELETE, INSERT | SELECT, DELETE, INSERT | SELECT | - | - | - | - | - |
| `report_photos` | - | SELECT, UPSERT, UPDATE, DELETE | SELECT | SELECT | SELECT | - | - | - | - |
| `report_ai_request` | - | INSERT | - | - | - | - | - | - | - |
| `report_ai_response` | - | UPSERT | SELECT | SELECT | - | - | - | - | - |
| `report_user_edits` | - | - | SELECT, DELETE, INSERT | SELECT | - | - | - | - | - |
| `report_final` | - | - | - | SELECT, INSERT, UPDATE | - | - | - | - | - |
| `contractors` | - | SELECT | SELECT | SELECT | - | - | - | - | SELECT, UPSERT, DELETE |
| `equipment` | - | SELECT | SELECT | SELECT | - | - | - | - | SELECT, UPSERT, DELETE |
| `user_profiles` | - | SELECT | SELECT | SELECT | - | - | SELECT, INSERT, UPDATE | - | - |

### Storage Buckets

| Bucket | Operations | Used By |
|--------|-----------|---------|
| `report-photos` | upload, getPublicUrl, remove | quick-interview.html |

---

## 3. Page-by-Page Breakdown

### index.html (Dashboard)

**Purpose:** Main dashboard showing active project, today's report status, weather, and navigation

**localStorage:**
- Reads: `fvp_active_project`, `fvp_mic_granted`, `fvp_loc_granted`, `fvp_onboarded`, `fvp_banner_dismissed`, `fvp_banner_dismissed_date`, `fvp_offline_queue`
- Writes: `fvp_active_project`, `fvp_loc_granted`, `fvp_cached_weather`, `fvp_banner_dismissed`, `fvp_banner_dismissed_date`
- Deletes: `fvp_loc_granted`, `fvp_banner_dismissed`, `fvp_banner_dismissed_date`

**sessionStorage:**
- Reads/Writes: `fvp_submitted_banner_dismissed`

**Supabase Queries:**
- `projects`: SELECT (load all, load by ID)
- `reports`: SELECT (today's report, check submitted status)
- `report_raw_capture`: SELECT (check for data)
- `report_contractor_work`: SELECT (check for activities)

**URL Parameters:** None

**Navigates To:**
- `project-config.html` (manage projects)
- `settings.html` (settings)
- `quick-interview.html` (begin/continue report)
- `report.html` (review & submit)
- `archives.html` (view history)
- `drafts.html` (pending reports)
- `permissions.html` (if not onboarded)
- `admin-debug.html` (debug link)

---

### quick-interview.html (Interview/Data Entry)

**Purpose:** Primary data capture page - voice recording, notes, photos, contractor work

**localStorage:**
- Reads: `fvp_active_project`, `fvp_quick_interview_draft`, `fvp_offline_queue`, `fvp_dictation_hint_dismissed`, `fvp_mic_granted`, `fvp_loc_granted`
- Writes: `fvp_quick_interview_draft`, `fvp_offline_queue`, `fvp_ai_response_${reportId}`, `fvp_loc_granted`, `fvp_dictation_hint_dismissed`, `fvp_mic_granted`, `permissions_dismissed`
- Deletes: `fvp_quick_interview_draft`

**Supabase Queries:**
- `reports`: SELECT, UPSERT
- `projects`: SELECT
- `contractors`: SELECT
- `equipment`: SELECT
- `user_profiles`: SELECT
- `report_raw_capture`: SELECT, DELETE, INSERT
- `report_contractor_work`: SELECT, DELETE, INSERT
- `report_personnel`: SELECT, DELETE, INSERT
- `report_equipment_usage`: SELECT, DELETE, INSERT
- `report_photos`: SELECT, UPSERT, UPDATE, DELETE
- `report_ai_request`: INSERT
- `report_ai_response`: UPSERT
- Storage: `report-photos` (upload, getPublicUrl, remove)

**URL Parameters:** None (reads none, generates for navigation)

**Webhooks:**
- `POST https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-v6` (AI processing)
- `GET https://api.open-meteo.com/v1/forecast` (weather)

**Navigates To:**
- `report.html?date=${date}&reportId=${id}` (after finish)
- `drafts.html` (if offline)

---

### report.html (Report Review/Edit)

**Purpose:** Display AI-refined report, allow edits, prepare for final review

**localStorage:**
- Reads: `fvp_active_project`, `fvp_ai_response_${reportId}`
- Writes: None
- Deletes: `fvp_ai_response_${reportId}` (after loading from cache)

**Supabase Queries:**
- `projects`: SELECT
- `contractors`: SELECT
- `equipment`: SELECT
- `user_profiles`: SELECT
- `reports`: SELECT, UPSERT
- `report_raw_capture`: SELECT, DELETE, INSERT
- `report_contractor_work`: SELECT, DELETE, INSERT
- `report_personnel`: SELECT, DELETE, INSERT
- `report_equipment_usage`: SELECT, DELETE, INSERT
- `report_photos`: SELECT
- `report_ai_response`: SELECT
- `report_user_edits`: SELECT, DELETE, INSERT

**URL Parameters:**
- `date` (report date, defaults to today)
- `reportId` (direct report lookup)

**Webhooks:**
- `POST https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-v6` (retry AI processing)

**Navigates To:**
- `finalreview.html?date=${date}&reportId=${id}` (proceed to submit)

---

### finalreview.html (Final Review & Submit)

**Purpose:** Final review before submission, PDF preview, signature, submit action

**localStorage:**
- Reads: `fvp_active_project`
- Writes: None
- Deletes: None

**Supabase Queries:**
- `projects`: SELECT
- `contractors`: SELECT
- `equipment`: SELECT
- `user_profiles`: SELECT
- `reports`: SELECT, UPDATE (set status='submitted')
- `report_raw_capture`: SELECT
- `report_contractor_work`: SELECT
- `report_personnel`: SELECT
- `report_equipment_usage`: SELECT
- `report_photos`: SELECT
- `report_ai_response`: SELECT
- `report_user_edits`: SELECT
- `report_final`: SELECT, INSERT, UPDATE

**URL Parameters:**
- `date` (report date)
- `reportId` (report ID)

**Navigates To:**
- `index.html` (if no report found)
- `report.html?date=${date}` (go back to edit)
- `archives.html` (after submission success)

---

### archives.html (Report History)

**Purpose:** View and manage past submitted reports

**localStorage:**
- Reads: None (defines key but doesn't use)
- Writes: None
- Deletes: None

**Supabase Queries:**
- `projects`: SELECT
- `reports`: SELECT (with JOIN to projects), DELETE
- `report_photos`: SELECT (for photo counts)

**URL Parameters:** None (builds for navigation)

**Navigates To:**
- `index.html` (back)
- `finalreview.html?date=${date}&reportId=${id}` (view report)

---

### admin-debug.html (Debug Tools)

**Purpose:** Administrative debugging - view/clear localStorage, manage reports

**localStorage:**
- Reads: All `fvp_*` keys (dynamic pattern)
- Writes: None
- Deletes: All `fvp_*` keys (clear all function)

**Supabase Queries:**
- `reports`: SELECT (with JOIN to projects), DELETE, UPDATE (reset to draft)

**URL Parameters:** None

**Navigates To:**
- `index.html` (back link)

---

### settings.html (User Profile Settings)

**Purpose:** Manage user profile information

**localStorage:**
- Reads: None
- Writes: None
- Deletes: None

**Supabase Queries:**
- `user_profiles`: SELECT, UPDATE, INSERT

**URL Parameters:** None

**Navigates To:**
- `index.html` (back)
- `project-config.html` (manage projects)
- `permissions.html` (setup permissions)

---

### drafts.html (Offline Queue Manager)

**Purpose:** Manage and sync offline drafts/pending reports

**localStorage:**
- Reads: `fvp_offline_queue`
- Writes: `fvp_offline_queue`, `fvp_active_project`, `fvp_quick_interview_draft`
- Deletes: None

**Supabase Queries:**
- `reports`: SELECT, INSERT, UPDATE

**URL Parameters:** None

**Webhooks:**
- `POST https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-v6` (AI processing)

**Navigates To:**
- `index.html` (back, after sync all)
- `quick-interview.html` (continue editing)
- `report.html` (after sync success)

---

### project-config.html (Project Management)

**Purpose:** Create, edit, delete projects and their contractors/equipment

**localStorage:**
- Reads: `fvp_active_project`
- Writes: `fvp_active_project`
- Deletes: `fvp_active_project` (if deleted project was active)

**Supabase Queries:**
- `projects`: SELECT, UPSERT, DELETE
- `contractors`: SELECT, UPSERT, DELETE
- `equipment`: SELECT, UPSERT, DELETE

**URL Parameters:** None

**Webhooks:**
- `POST https://advidere.app.n8n.cloud/webhook/fieldvoice-project-extractor` (extract from PDF/DOCX)

**Navigates To:**
- `index.html` (back)

---

### permissions.html (Permission Onboarding)

**Purpose:** Guide user through granting device permissions (mic, camera, location)

**localStorage:**
- Reads: `fvp_mic_granted`, `fvp_cam_granted`, `fvp_loc_granted`, `fvp_speech_granted`, `fvp_onboarded`
- Writes: `fvp_mic_granted`, `fvp_mic_timestamp`, `fvp_cam_granted`, `fvp_loc_granted`, `fvp_onboarded`
- Deletes: All permission keys (clearLocalPermissionState)

**Supabase Queries:** None

**URL Parameters:** None

**Navigates To:**
- `index.html` (after setup complete)

---

### landing.html (Marketing/Landing Page)

**Purpose:** Static marketing page showcasing product features

**localStorage:** None
**Supabase Queries:** None
**URL Parameters:** None

**Navigates To:**
- `index.html` (start using app)

---

### permission-debug.html (Permission Debugging)

**Purpose:** Debug native browser permission dialogs

**localStorage:** None
**Supabase Queries:** None
**URL Parameters:** None
**Navigates To:** None (self-contained diagnostic tool)

---

## 4. Report Lifecycle Flow

### Step-by-Step Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REPORT LIFECYCLE                                   │
└─────────────────────────────────────────────────────────────────────────────┘

1. CREATION
   ├── Trigger: User clicks "Begin Daily Report" on index.html
   ├── Action: Redirect to quick-interview.html
   ├── Status: No report record yet (created on first save)
   └── Storage: None yet

2. DRAFT EDITING (AUTO-SAVE)
   ├── Trigger: User types/records in quick-interview.html
   ├── Source: Form inputs, voice recordings, photos
   ├── Destination: localStorage['fvp_quick_interview_draft']
   ├── Frequency: Debounced auto-save (~2 seconds)
   └── Status: Not in database yet

3. FIRST SUPABASE SAVE
   ├── Trigger: User clicks "Finish" in quick-interview.html
   ├── Action: saveReportToSupabase() called
   ├── Tables Written:
   │   ├── reports: UPSERT (id, project_id, report_date, status='draft')
   │   ├── report_raw_capture: INSERT (transcript, guided_notes)
   │   ├── report_contractor_work: INSERT (multiple rows)
   │   ├── report_personnel: INSERT (multiple rows)
   │   └── report_equipment_usage: INSERT (multiple rows)
   └── Storage: report-photos bucket (if photos)

4. AI PROCESSING REQUEST
   ├── Trigger: After raw capture saved
   ├── Source: Raw notes, activities, weather, project data
   ├── Action: POST to n8n webhook
   │   URL: https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-v6
   ├── Tables Written:
   │   ├── report_ai_request: INSERT (request payload for audit)
   │   └── reports: UPDATE (status='pending_refine')
   └── Fallback: Queue to fvp_offline_queue if offline

5. AI RESPONSE RECEIVED
   ├── Trigger: Webhook returns
   ├── Source: n8n webhook response
   ├── Destination:
   │   ├── localStorage['fvp_ai_response_{reportId}'] (temp cache)
   │   └── report_ai_response: UPSERT
   ├── Tables Written:
   │   └── reports: UPDATE (status='refined')
   └── Action: Redirect to report.html

6. REFINEMENT/EDITING
   ├── Page: report.html
   ├── Trigger: User edits AI-generated content
   ├── Source: AI response + user modifications
   ├── Destination:
   │   └── report_user_edits: DELETE + INSERT (per section)
   └── Status: 'refined' (unchanged)

7. FINAL REVIEW
   ├── Page: finalreview.html
   ├── Trigger: User clicks "Continue to Submit"
   ├── Source: Aggregated report data (raw + AI + edits)
   ├── Display: PDF-style preview with signature
   └── Status: 'refined' (unchanged)

8. SUBMISSION
   ├── Trigger: User clicks "Submit Report"
   ├── Tables Written:
   │   ├── report_final: INSERT or UPDATE (compiled final data)
   │   └── reports: UPDATE (status='submitted', submitted_at)
   └── Redirect: archives.html (success modal)

9. ARCHIVE ACCESS
   ├── Page: archives.html
   ├── Source: Supabase reports table (status IN submitted, finalized)
   ├── View: finalreview.html?reportId=X (read-only)
   └── Actions: View, Delete
```

### Status State Machine

```
                    ┌─────────┐
                    │  (new)  │
                    └────┬────┘
                         │ saveReportToSupabase()
                         ▼
                    ┌─────────┐
                    │  draft  │
                    └────┬────┘
                         │ AI webhook called
                         ▼
               ┌──────────────────┐
               │  pending_refine  │ (offline queue possible)
               └────────┬─────────┘
                        │ AI response received
                        ▼
                   ┌─────────┐
                   │ refined │
                   └────┬────┘
                        │ User clicks Submit
                        ▼
                  ┌───────────┐
                  │ submitted │
                  └───────────┘
```

---

## 5. Data Flow Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FIELDVOICE PRO DATA FLOW                              │
└─────────────────────────────────────────────────────────────────────────────────┘

                         ┌──────────────┐
                         │ permissions  │
                         │    .html     │
                         └──────┬───────┘
                                │ localStorage: fvp_*_granted, fvp_onboarded
                                ▼
┌─────────────┐         ┌──────────────┐         ┌───────────────┐
│  landing    │────────▶│   index      │◀───────▶│  project-     │
│   .html     │         │    .html     │         │  config.html  │
└─────────────┘         └──────┬───────┘         └───────────────┘
                               │                         │
          ┌────────────────────┼─────────────────────────┤
          │                    │                         │
          │                    │ localStorage:           │ Supabase:
          │                    │ fvp_active_project      │ projects,
          │                    │                         │ contractors,
          │                    │                         │ equipment
          │                    ▼                         │
          │            ┌───────────────┐                 │
          │            │    quick-     │◀────────────────┘
          │            │  interview    │
          │            │    .html      │
          │            └───────┬───────┘
          │                    │
          │    ┌───────────────┼───────────────┐
          │    │               │               │
          │    │ localStorage: │ Supabase:     │ Webhook:
          │    │ fvp_quick_    │ reports,      │ n8n AI
          │    │ interview_    │ report_*,     │ processing
          │    │ draft         │ photos bucket │
          │    │               │               │
          │    │               ▼               │
          │    │       ┌──────────────┐        │
          │    │       │   report     │◀───────┘
          │    │       │    .html     │
          │    │       └──────┬───────┘
          │    │              │
          │    │              │ Supabase:
          │    │              │ report_user_edits
          │    │              │
          │    │              ▼
          │    │      ┌───────────────┐
          │    │      │  finalreview  │
          │    │      │     .html     │
          │    │      └───────┬───────┘
          │    │              │
          │    │              │ Supabase:
          │    │              │ report_final,
          │    │              │ reports (status=submitted)
          │    │              │
          │    │              ▼
          │    │      ┌───────────────┐
          └────┼─────▶│   archives    │
               │      │     .html     │
               │      └───────────────┘
               │
               │
               ▼
        ┌──────────────┐
        │   drafts     │─────────▶ Webhook: n8n
        │    .html     │          (process-report)
        └──────────────┘


SUPPORTING PAGES:
├── settings.html ─────────▶ Supabase: user_profiles
├── admin-debug.html ──────▶ localStorage (all fvp_*), Supabase: reports
└── permission-debug.html ─▶ (diagnostic only, no data)
```

---

## 6. Identified Issues & Inconsistencies

### 6.1 Duplicate Storage Patterns

| Issue | Details | Risk Level |
|-------|---------|------------|
| **AI Response Double Storage** | AI response stored in both `localStorage['fvp_ai_response_${id}']` AND `report_ai_response` table | Medium - Potential sync issues |
| **Draft in localStorage + Supabase** | `fvp_quick_interview_draft` persists locally while data also goes to `report_raw_capture` | Low - Designed for offline support |

### 6.2 Orphaned/Unused Keys

| Key/Constant | Defined In | Status |
|--------------|-----------|--------|
| `fvp_cached_weather` | ~~Written in index.html~~ | ✅ **FIXED** - Removed dead write operation |
| `ACTIVE_PROJECT_KEY` in archives.html | ~~Defined (line 161)~~ | ✅ **FIXED** - Removed unused constant |
| `fvp_speech_granted` | permissions.html | **Write location unknown** - Read but never written |

### 6.3 Webhook URLs (Consistent)

| Page | Webhook URL |
|------|-------------|
| quick-interview.html | `https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-v6` |
| report.html | `https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-v6` |
| drafts.html | `https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-v6` |

All pages now use the same webhook endpoint for AI processing.

### 6.4 Stale Cache Risks

| Cache | Risk | Scenario |
|-------|------|----------|
| `fvp_quick_interview_draft` | Data loss on multi-device | User edits on Device A, opens Device B which has stale draft |
| `fvp_ai_response_${id}` | ~~Orphaned if page navigated away~~ | ✅ **FIXED** - index.html now cleans up caches older than 24 hours |
| `projectsCache` (in-memory) | Stale if project edited elsewhere | No cache invalidation mechanism |

### 6.5 Potential Race Conditions

| Scenario | Pages Involved | Risk |
|----------|----------------|------|
| ~~**Concurrent editing**~~ | ~~quick-interview.html + editor.html~~ | ✅ **FIXED** - editor.html removed (was unused legacy code) |
| **Offline queue sync** | drafts.html | Multiple sync attempts could create duplicate records |
| **Report status transitions** | quick-interview.html → report.html | If webhook slow, report.html may load stale status |

### 6.6 Naming Inconsistencies

| Concept | Variations Found |
|---------|------------------|
| Project ID reference | `project_id` (DB), `projectId` (JS), `activeId` (local var) |
| Report status values | `'draft'`, `'pending_refine'`, `'refined'`, `'submitted'`, `'finalized'` - ✅ **DOCUMENTED** - `finalized` is reserved for future admin approval workflow |
| Supabase client variable | `supabaseClient` (all files) - ✅ **VERIFIED** - Consistent across codebase |

### 6.7 Missing Error Recovery

| Scenario | Current Behavior | Risk |
|----------|------------------|------|
| AI webhook timeout | Report stuck in `pending_refine` | User cannot proceed without retry |
| Photo upload failure | Error logged, silently continues | Photos may be missing from final report |
| localStorage quota exceeded | Uncaught exception | Draft data loss |

### 6.8 Table Foreign Key Gaps

| Child Table | References | Observed Issue |
|-------------|-----------|----------------|
| `report_contractor_work` | `report_id` | Delete report doesn't cascade (manual delete required) |
| `report_photos` | `report_id` | Storage bucket files not auto-deleted |

---

## 7. Recommendations

> **Note:** These are documented observations only. No code changes should be implemented based on this audit without further discussion and prioritization.

### 7.1 Data Consistency

1. **Unify webhook URLs** - drafts.html uses different n8n instance than other pages
2. **Add cache invalidation** - Implement event-based cache refresh for projectsCache
3. ~~**Remove unused localStorage keys**~~ - ✅ **DONE** - `fvp_cached_weather` write removed

### 7.2 Offline Support

4. **Add conflict resolution** - When syncing offline drafts, check for server-side changes
5. **Implement draft versioning** - Add timestamp to detect stale drafts
6. **Add queue deduplication** - Prevent duplicate entries in `fvp_offline_queue`

### 7.3 Error Handling

7. **Add retry UI for webhook failures** - Currently requires manual page refresh
8. **Implement localStorage quota handling** - Graceful degradation when quota exceeded
9. **Add photo upload retry queue** - Failed uploads should be recoverable

### 7.4 Code Cleanup

10. ~~**Remove `ACTIVE_PROJECT_KEY` from archives.html**~~ - ✅ **DONE** - Removed unused constant
11. **Standardize variable naming** - Use consistent casing for projectId vs project_id
12. ~~**Add `finalized` status transition**~~ - ✅ **DOCUMENTED** - Clarified as reserved for future admin approval workflow

### 7.5 Data Integrity

13. **Implement cascade deletes** - When report deleted, clean up child tables and storage
14. **Add foreign key constraints** - Ensure referential integrity at DB level
15. ~~**Clean up orphaned AI response cache**~~ - ✅ **DONE** - index.html now cleans up stale `fvp_ai_response_*` keys older than 24 hours

### 7.6 Performance

16. **Reduce redundant Supabase calls** - loadActiveProject called multiple times per page
17. **Add request batching** - Combine related queries where possible
18. **Implement proper caching strategy** - Define TTL for cached data

---

## Appendix A: Supabase Table Schema (Inferred)

Based on query patterns observed:

```sql
-- Core tables
projects (id, project_name, noab_project_no, cno_solicitation_no, location,
          engineer, prime_contractor, notice_to_proceed, contract_duration,
          weather_days, expected_completion, default_start_time, default_end_time,
          logo, status, created_at)

reports (id, project_id, report_date, status, inspector_name,
         created_at, updated_at, submitted_at)

-- Report detail tables
report_raw_capture (id, report_id, transcript, guided_notes)
report_contractor_work (id, report_id, contractor_name, work_description, ...)
report_personnel (id, report_id, name, classification, hours, ...)
report_equipment_usage (id, report_id, equipment_name, hours, ...)
report_photos (id, report_id, photo_url, caption, created_at)

-- AI processing tables
report_ai_request (id, report_id, request_payload, created_at)
report_ai_response (id, report_id, ai_generated, received_at)

-- User modifications
report_user_edits (id, report_id, section, content, ...)
report_final (id, report_id, final_content, submitted_at, ...)

-- Reference tables
contractors (id, project_id, name, ...)
equipment (id, project_id, name, ...)
user_profiles (id, full_name, title, company, email, phone, updated_at)
```

---

## Appendix B: External API Dependencies

| Service | URL | Purpose | Used By |
|---------|-----|---------|---------|
| Supabase | `https://ruzadotbgkjhgwkvotlz.supabase.co` | Database & Storage | All pages |
| n8n | `https://advidere.app.n8n.cloud/webhook/...` | AI Processing, Project Extraction | quick-interview, report, drafts, project-config |
| Open-Meteo | `https://api.open-meteo.com/v1/forecast` | Weather Data | index, quick-interview |

---

*End of Data Flow Audit*

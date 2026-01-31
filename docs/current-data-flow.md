# FieldVoice Pro - Current Data Flow Documentation

**Date:** January 2026
**Purpose:** Document current data flow implementation before refactoring for improved state management

---

## 1. QUICK-INTERVIEW.HTML INVESTIGATION

### Data Storage

#### localStorage Keys Used:
| Key | Read/Write | Purpose |
|-----|------------|---------|
| `fvp_active_project` | Read | Gets active project ID (line 1510) |
| `fvp_loc_granted` | Write | Set when location permission granted during weather sync (line 3013) |
| `fvp_dictation_hint_dismissed` | Read/Write | Tracks if dictation hint banner dismissed (lines 3069, 3075) |
| `fvp_mic_granted` | Read/Write | Microphone permission state (lines 3597, 3614) |
| `permissions_dismissed` | Write | Permissions modal dismissed (line 3665) |

#### Supabase Tables Interacted With:

**Read Operations:**
- `projects` - Load active project details (line 1520)
- `contractors` - Load contractors for the project (line 1536)
- `equipment` - Load equipment for the project (line 1554)
- `user_profiles` - Load user settings (line 1574)
- `reports` - Check for existing report for today (lines 2509, 2734)
- `report_raw_capture` - Load existing raw capture data (line 2534)
- `report_contractor_work` - Load existing contractor work (line 2541)
- `report_personnel` - Load existing personnel data (line 2547)
- `report_equipment_usage` - Load equipment usage (line 2553)
- `report_photos` - Load existing photos (line 2559)

**Write Operations:**
- `reports` - UPSERT with `onConflict: 'id'` (line 2754)
- `report_raw_capture` - DELETE then INSERT pattern (lines 2779-2785)
- `report_contractor_work` - DELETE then INSERT pattern (lines 2790-2805)
- `report_personnel` - DELETE then INSERT pattern (lines 2811-2828)
- `report_equipment_usage` - DELETE then INSERT pattern (lines 2834-2848)
- `report_photos` - UPSERT with `onConflict: 'id'` (line 2922)
- `report_ai_request` - INSERT (line 1375)
- `report_ai_response` - UPSERT with `onConflict: 'report_id'` (line 1404)

### When Data Gets Saved

**Auto-save with Debouncing:**
The `saveReport()` function (line 2705) implements a 1-second debounce:

```javascript
function saveReport() {
    // Update local UI immediately
    updateAllPreviews();
    updateProgress();

    // Debounce actual save to Supabase
    if (saveReportTimeout) {
        clearTimeout(saveReportTimeout);
    }
    saveReportTimeout = setTimeout(() => {
        saveReportToSupabase();
    }, 1000); // 1 second debounce
}
```

**Save Triggers:**
- On every `onchange` event for form fields
- On textarea `onchange` for work narratives
- When safety checkboxes change
- When photos are uploaded
- When contractor work is updated
- Mode selection change

**Key Observation:** Data is saved to Supabase continuously during editing, NOT just on FINISH. This is a potential issue if we want to keep data in localStorage until FINISH.

---

### FINISH Button Behavior

#### Guided Mode: `finishReport()` (line 3668)

**Validation:**
1. Checks if `workSummary` is filled (required)
2. Checks if safety question is answered (either `noIncidents` or `hasIncidents` must be true)

**Sequence of Operations:**

```
1. Validate required fields (work summary, safety)
   - If missing, show toast and focus the field
   - Return early if validation fails

2. Set loading state on button
   - Disable button
   - Change text to "Processing..."

3. Update report metadata
   - Set endTime
   - Set interviewCompleted = true
   - Calculate shiftDuration
   - Add default safety note if none

4. Store guided notes for AI
   - guidedNotes.issues = generalIssues.join('\n')
   - guidedNotes.safety = formatted safety string

5. Save to Supabase (await saveReportToSupabase())

6. Build AI payload (buildProcessPayload())

7. Check if online
   - If offline: handleOfflineProcessing(payload), redirect to report.html
   - If online: continue to step 8

8. Save AI request to Supabase (await saveAIRequest(payload))

9. Call webhook (await callProcessWebhook(payload))
   - URL: https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-v6
   - Timeout: 30 seconds
   - Method: POST with JSON payload

10. On success:
    - Save AI response (await saveAIResponse())
    - Store aiGenerated in local report
    - Set status = 'refined'
    - Save to Supabase again
    - Redirect to report.html

11. On failure:
    - Log error
    - Restore button state
    - Handle as offline (sets status = 'pending_refine')
    - Redirect to report.html
```

#### Minimal Mode: `finishMinimalReport()` (line 1432)

Very similar to guided mode, but:
- Only validates that `freeformNotes` is filled
- Same webhook call sequence
- Same error handling

---

### n8n Webhook Details

**Endpoint:** `https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-v6`

**Request Payload Structure (buildProcessPayload at line 1258):**
```javascript
{
    reportId: string,           // e.g., "project123_2026-01-24"
    captureMode: 'minimal' | 'guided',

    projectContext: {
        projectId: string,
        projectName: string,
        noabProjectNo: string,
        location: string,
        engineer: string,
        primeContractor: string,
        contractors: Array,
        equipment: Array
    },

    fieldNotes: {
        // If minimal mode:
        freeformNotes: string
        // If guided mode:
        workSummary: string,
        issues: string,
        safety: string
    },

    weather: object,

    photos: Array<{
        id: string,
        caption: string,
        timestamp: string,
        date: string,
        time: string,
        gps: { lat, lng }
    }>,

    reportDate: string,
    inspectorName: string
}
```

**Response Handling:**
- If response has `aiGenerated` string, parses it as JSON
- Validates aiGenerated has arrays: `activities`, `operations`, `equipment`, `generalIssues`, `qaqcNotes`
- Ensures `safety` object exists

**Where AI Response Gets Saved:**
1. Stored in `report_ai_response` table with column `response_payload` (JSONB)
2. Also stored in local `report.aiGenerated` object

---

### Mode Handling

#### Mode Selection Logic (`shouldShowModeSelection` at line 846):

```javascript
function shouldShowModeSelection() {
    if (!report) return true;
    if (report.meta?.captureMode) return false;  // Mode already set

    // Check if report has any meaningful data
    const hasPhotos = report.photos?.length > 0;
    const hasActivities = report.activities?.length > 0;
    const hasIssues = report.generalIssues?.length > 0;
    const hasNotes = report.additionalNotes?.trim().length > 0;
    const hasFieldNotes = report.fieldNotes?.freeformNotes?.trim().length > 0;
    const hasReporterName = report.reporter?.name?.trim().length > 0;

    // If any data exists, don't show mode selection
    return !(hasPhotos || hasActivities || hasIssues || hasNotes || hasFieldNotes || hasReporterName);
}
```

#### Mode Selection (`selectCaptureMode` at line 865):

```javascript
function selectCaptureMode(mode) {
    report.meta.captureMode = mode;
    saveReport();  // Immediately saves to Supabase
    showModeUI(mode);
}
```

#### Data Fields by Mode:

**Minimal Mode (Quick Notes):**
- `report.fieldNotes.freeformNotes` - Single free-form text area
- `report.photos[]` - Photo array with captions
- `report.overview.weather` - Weather data

**Guided Mode (Guided Sections):**
- `report.guidedNotes.workSummary` - Work performed summary
- `report.generalIssues[]` - Array of issue strings
- `report.safety.noIncidents` / `report.safety.hasIncidents` - Boolean flags
- `report.safety.notes[]` - Array of safety notes
- `report.overview.weather.jobSiteCondition` - Site conditions text
- `report.photos[]` - Photo array

---

### Existing State Checks

#### Report Existence Check (in `getReport` at line 2496):

```javascript
// If report was already submitted, create fresh
if (reportRow.status === 'submitted') {
    return createFreshReport();
}
```

#### Interview Completion Check (in DOMContentLoaded at line 3832):

```javascript
// If user came back to edit a "completed" report (from report.html),
// mark it as in-progress again
if (report.meta?.interviewCompleted && !report.meta?.submitted) {
    report.meta.interviewCompleted = false;
    saveReport();
}
```

**Critical Finding:** There is NO check that prevents users from returning to quick-interview.html after status is 'refined'. The system simply resets `interviewCompleted = false` and allows editing. This could cause data inconsistency if user edits after AI processing.

---

## 2. REPORT.HTML INVESTIGATION

### Data Loading

**On Page Load (async loadReport at line 1400):**

Queries executed in parallel:
```javascript
const [
    rawCaptureResult,
    contractorWorkResult,
    personnelResult,
    equipmentUsageResult,
    photosResult,
    aiResponseResult,
    userEditsResult
] = await Promise.all([
    supabaseClient.from('report_raw_capture').select('*').eq('report_id', reportRow.id).maybeSingle(),
    supabaseClient.from('report_contractor_work').select('*').eq('report_id', reportRow.id),
    supabaseClient.from('report_personnel').select('*').eq('report_id', reportRow.id),
    supabaseClient.from('report_equipment_usage').select('*').eq('report_id', reportRow.id),
    supabaseClient.from('report_photos').select('*').eq('report_id', reportRow.id).order('created_at', { ascending: true }),
    supabaseClient.from('report_ai_response').select('*').eq('report_id', reportRow.id).order('received_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseClient.from('report_user_edits').select('*').eq('report_id', reportRow.id)
]);
```

**AI Response Loading (line 1518-1524):**
```javascript
if (aiResponseResult.data) {
    try {
        loadedReport.aiGenerated = aiResponseResult.data.response_payload || null;
    } catch (e) {
        console.error('Failed to parse AI response:', e);
    }
}
```

**Column Name:** The code expects `response_payload` column (NOT `ai_generated_content`)

---

### Debug Panel Population

The debug panel shows:
- Raw AI response from `report.aiGenerated`
- User edits from `report.userEdits`
- Schema validation issues
- Missing data warnings

---

### Data Priority System

#### `getValue()` Function (line 1601):

```javascript
function getValue(path, defaultValue = '') {
    // 1. Check user edits first - user edits always win
    if (userEdits[path] !== undefined) {
        return userEdits[path];
    }

    // 2. Check AI-generated content
    if (report.aiGenerated) {
        const aiValue = getNestedValue(report.aiGenerated, path);
        if (aiValue !== undefined && aiValue !== null && aiValue !== '') {
            if (Array.isArray(aiValue)) {
                return aiValue.join('\n');
            }
            return aiValue;
        }
    }

    // 3. Check existing report data (fieldNotes, guidedNotes, etc.)
    const reportValue = getNestedValue(report, path);
    if (reportValue !== undefined && reportValue !== null && reportValue !== '') {
        if (Array.isArray(reportValue)) {
            return reportValue.join('\n');
        }
        return reportValue;
    }

    // 4. Return default
    return defaultValue;
}
```

**Priority Order:**
1. `userEdits[path]` - User manual edits always win
2. `report.aiGenerated[path]` - AI-generated content
3. `report[path]` - Raw capture data (fieldNotes, guidedNotes)
4. `defaultValue` - Fallback default

---

### User Edits Tracking

**Storage:** User edits stored in `report.userEdits` object keyed by field path

**Example:** `userEdits['safety.hasIncident'] = true`

**When Edits Are Saved:**

```javascript
// On field change (line 2518):
userEdits[path] = value;
report.userEdits = userEdits;

// Save to Supabase (lines 2701-2717):
if (report.userEdits && Object.keys(report.userEdits).length > 0) {
    await supabaseClient
        .from('report_user_edits')
        .delete()
        .eq('report_id', reportId);

    const userEditsData = Object.entries(report.userEdits).map(([fieldPath, editedValue]) => ({
        report_id: reportId,
        field_path: fieldPath,
        edited_value: typeof editedValue === 'string' ? editedValue : JSON.stringify(editedValue),
        edited_at: new Date().toISOString()
    }));

    await supabaseClient
        .from('report_user_edits')
        .insert(userEditsData);
}
```

---

### localStorage Keys Used

| Key | Operation | Purpose |
|-----|-----------|---------|
| `fvp_active_project` | Read | Get active project ID (line 1293) |

**Note:** report.html does NOT use localStorage for storing report data - all data is in Supabase.

---

### Navigation

**Home Button:** Links to `index.html` (line 426)

**No direct link back to quick-interview.html** from report.html. Users must go through index.html.

**No state check** prevents navigation - users can freely navigate away.

---

## 3. INDEX.HTML INVESTIGATION

### Report Status Display Logic (`updateReportStatus` at line 653)

**States and UI:**

| Condition | Status Label | Primary Action | Secondary Action |
|-----------|--------------|----------------|------------------|
| `!report` (null) | "No Report Started" | "Begin Daily Report" -> project picker | None |
| `report.meta?.status === 'pending_refine'` | "Processing Pending" | "Review & Submit" -> report.html | "or continue editing" -> quick-interview.html |
| `report.meta?.interviewCompleted && !submitted` | "Ready for Review" | "Review & Submit" -> report.html | "or continue editing" -> quick-interview.html |
| `!report.meta?.interviewCompleted` | "In Progress" | "Continue Report" -> quick-interview.html | None |

**Critical Issue:** When status is 'refined', the "or continue editing" link still appears (line 702-704):
```html
<a href="quick-interview.html" class="text-sm text-slate-500 hover:text-dot-blue transition-colors">
    <i class="fas fa-edit mr-1"></i>or continue editing
</a>
```

This allows users to return to quick-interview.html after AI processing is complete.

---

### Project Picker Logic

**`showProjectPickerModal()` at line 357:**
1. Shows loading spinner
2. Calls `loadProjects()` to refresh from Supabase
3. Renders project list with active project highlighted
4. On click: `selectProjectAndProceed(projectId)`

**`selectProjectAndProceed()` at line 424:**
```javascript
async function selectProjectAndProceed(projectId) {
    localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
    await loadActiveProject();
    updateActiveProjectCard();
    closeProjectPickerModal();
    window.location.href = 'quick-interview.html';
}
```

---

### Navigation Logic Summary

| User Action | Destination |
|-------------|-------------|
| "Begin Daily Report" (no report) | Project picker -> quick-interview.html |
| "Continue Report" (in progress) | quick-interview.html |
| "Review & Submit" (refined/completed) | report.html |
| "or continue editing" (refined) | quick-interview.html |

**No graying out or disabling** of navigation options based on status.

---

## 4. SUPABASE QUERIES AUDIT

### Tables and Operations by Page

#### quick-interview.html

| Table | Operation | ON CONFLICT | Notes |
|-------|-----------|-------------|-------|
| `projects` | SELECT | - | Load active project |
| `contractors` | SELECT | - | Load project contractors |
| `equipment` | SELECT | - | Load project equipment |
| `user_profiles` | SELECT | - | Load user settings |
| `reports` | SELECT | - | Check existing report |
| `reports` | UPSERT | `id` | Save/create report |
| `report_raw_capture` | DELETE | - | Clear before insert |
| `report_raw_capture` | INSERT | - | Save capture data |
| `report_contractor_work` | DELETE | - | Clear before insert |
| `report_contractor_work` | INSERT | - | Save contractor work |
| `report_personnel` | DELETE | - | Clear before insert |
| `report_personnel` | INSERT | - | Save personnel data |
| `report_equipment_usage` | DELETE | - | Clear before insert |
| `report_equipment_usage` | INSERT | - | Save equipment usage |
| `report_photos` | UPSERT | `id` | Save photo metadata |
| `report_ai_request` | INSERT | - | Log AI request |
| `report_ai_response` | UPSERT | `report_id` | Save AI response |

#### report.html

| Table | Operation | ON CONFLICT | Notes |
|-------|-----------|-------------|-------|
| `projects` | SELECT | - | Load active project |
| `contractors` | SELECT | - | Load contractors |
| `equipment` | SELECT | - | Load equipment |
| `user_profiles` | SELECT | - | Load user profile |
| `reports` | SELECT | - | Load report |
| `reports` | UPSERT | `id` | Update report |
| `report_raw_capture` | SELECT | - | Load raw capture |
| `report_raw_capture` | DELETE/INSERT | - | Update raw capture |
| `report_contractor_work` | SELECT | - | Load contractor work |
| `report_contractor_work` | DELETE/INSERT | - | Update contractor work |
| `report_personnel` | SELECT | - | Load personnel |
| `report_personnel` | DELETE/INSERT | - | Update personnel |
| `report_equipment_usage` | SELECT | - | Load equipment usage |
| `report_equipment_usage` | DELETE/INSERT | - | Update equipment |
| `report_photos` | SELECT | - | Load photos |
| `report_ai_response` | SELECT | - | Load AI response |
| `report_user_edits` | SELECT | - | Load user edits |
| `report_user_edits` | DELETE/INSERT | - | Save user edits |

#### index.html

| Table | Operation | Notes |
|-------|-----------|-------|
| `projects` | SELECT | Load all projects |
| `reports` | SELECT | Check today's report |
| `report_raw_capture` | SELECT | Check for raw capture |
| `report_contractor_work` | SELECT | Check for activities |

#### finalreview.html

| Table | Operation | Notes |
|-------|-----------|-------|
| `projects` | SELECT | Load active project |
| `contractors` | SELECT | Load contractors |
| `equipment` | SELECT | Load equipment |
| `user_profiles` | SELECT | Load user profile |
| `reports` | SELECT/UPDATE | Load and update status |
| `report_raw_capture` | SELECT | Load raw capture |
| `report_contractor_work` | SELECT | Load contractor work |
| `report_personnel` | SELECT | Load personnel |
| `report_equipment_usage` | SELECT | Load equipment usage |
| `report_photos` | SELECT | Load photos |
| `report_ai_response` | SELECT | Load AI response |
| `report_user_edits` | SELECT | Load user edits |
| `report_final` | SELECT/UPSERT | Load/save final report |

---

## 5. LOCALSTORAGE KEYS AUDIT

| Key | Data Type | Pages Using | Purpose |
|-----|-----------|-------------|---------|
| `fvp_active_project` | UUID string | all pages | Stores active project ID |
| `fvp_mic_granted` | boolean string | index, quick-interview, permissions | Microphone permission granted |
| `fvp_mic_timestamp` | number string | permissions | When mic permission granted |
| `fvp_cam_granted` | boolean string | permissions | Camera permission granted |
| `fvp_loc_granted` | boolean string | index, quick-interview, permissions | Location permission granted |
| `fvp_speech_granted` | boolean string | permissions | Speech recognition permission |
| `fvp_onboarded` | boolean string | index, permissions | User completed onboarding |
| `fvp_banner_dismissed` | boolean string | index | Permission banner dismissed |
| `fvp_banner_dismissed_date` | ISO date string | index | When banner dismissed |
| `fvp_dictation_hint_dismissed` | boolean string | quick-interview | Dictation hint dismissed |
| `fvp_cached_weather` | JSON string | index | Cached weather data |
| `permissions_dismissed` | boolean string | quick-interview | Permissions modal dismissed |

**Note:** Report data is NOT stored in localStorage - only device-specific settings and active project ID.

---

## 6. IDENTIFIED ISSUES

### 6.1 No State Protection for "Refined" Reports

**Location:** quick-interview.html, line 3832-3835

**Problem:** When a user navigates back to quick-interview.html after AI processing:
```javascript
if (report.meta?.interviewCompleted && !report.meta?.submitted) {
    report.meta.interviewCompleted = false;
    saveReport();
}
```

This simply resets `interviewCompleted` and allows editing. There's no check for `status === 'refined'`.

**Impact:** User can:
1. Complete interview and get AI refinement
2. Navigate back to quick-interview
3. Edit the raw notes
4. Click FINISH again (triggers new AI processing)
5. This creates duplicate AI requests and potentially inconsistent state

**Recommendation:** Add state machine enforcement that blocks return to quick-interview when status is 'refined'.

---

### 6.2 Immediate Supabase Saves During Editing

**Location:** quick-interview.html, line 2705-2716

**Problem:** Data is saved to Supabase every 1 second during editing via debounce.

**Impact:**
- Partial/incomplete data appears in database
- Race conditions possible if user navigates quickly
- Data loss if save fails mid-edit (user thinks data is safe)
- Cannot easily "cancel" changes

**Recommendation:** Keep data in localStorage during quick-interview until FINISH is clicked, then batch-save to Supabase.

---

### 6.3 DELETE-then-INSERT Pattern Vulnerability

**Location:** Multiple locations in quick-interview.html and report.html

**Problem:** Child tables use DELETE then INSERT instead of UPSERT:
```javascript
await supabaseClient.from('report_raw_capture').delete().eq('report_id', reportId);
await supabaseClient.from('report_raw_capture').insert(rawCaptureData);
```

**Impact:** If insert fails after delete succeeds, data is lost.

**Recommendation:** Wrap in transaction or use UPSERT pattern consistently.

---

### 6.4 Missing Error Handling in Save Functions

**Location:** saveReportToSupabase() in quick-interview.html

**Problem:** Individual save operations (contractor_work, personnel, etc.) don't check for errors before proceeding:
```javascript
await supabaseClient.from('report_contractor_work').delete().eq('report_id', reportId);
// No error check
await supabaseClient.from('report_contractor_work').insert(contractorWorkData);
// No error check
```

**Impact:** Partial saves can occur with some tables updated and others not.

**Recommendation:** Add error checking and transaction support.

---

### 6.5 index.html Shows "Continue Editing" for Refined Reports

**Location:** index.html, line 702-704

**Problem:** Even when status is 'refined' (AI processing complete), the UI shows:
```html
<a href="quick-interview.html">or continue editing</a>
```

**Impact:** Users can accidentally re-enter quick-interview and trigger re-processing.

**Recommendation:** Hide "continue editing" link when status is 'refined'.

---

### 6.6 No Offline Queue Processing

**Location:** quick-interview.html, line 1417-1426

**Problem:** `handleOfflineProcessing()` adds to `offlineQueue` but there's no mechanism to process this queue when back online:
```javascript
function handleOfflineProcessing(payload) {
    report.meta.status = 'pending_refine';
    report.meta.offlineQueue = report.meta.offlineQueue || [];
    report.meta.offlineQueue.push({
        type: 'refine',
        payload: payload,
        queuedAt: new Date().toISOString()
    });
    saveReport();
}
```

**Impact:** Reports can stay in 'pending_refine' indefinitely if user doesn't manually retry.

**Recommendation:** Add online event listener to process offline queue automatically.

---

### 6.7 Potential Race Condition in Report ID Generation

**Location:** quick-interview.html, line 2730-2741

**Problem:** Code checks for existing report then generates new ID, but another request could create a report in between:
```javascript
if (!reportId) {
    const { data: existingReport } = await supabaseClient
        .from('reports')
        .select('id')
        .eq('project_id', activeProject.id)
        .eq('report_date', todayStr)
        .maybeSingle();

    reportId = existingReport?.id || generateId();
}
```

**Impact:** Rare race condition could create duplicate reports for same day.

**Recommendation:** Use database-level unique constraint and handle conflict.

---

### 6.8 Weather Data Not Persisted Properly

**Location:** index.html stores weather in localStorage, quick-interview fetches fresh

**Problem:** Weather is fetched on index.html and cached in localStorage, but quick-interview.html fetches fresh weather data. The two may not be in sync.

**Recommendation:** Single source of truth for weather data, either always from localStorage or always fresh.

---

## 7. RECOMMENDED REFACTOR CHANGES

Based on this investigation, the planned refactor should:

1. **Add State Machine Enforcement:**
   - Define valid state transitions: `draft` -> `refined` -> `submitted`
   - Block navigation to quick-interview.html when status is 'refined' or 'submitted'
   - Show warning modal if user tries to go back

2. **Keep Data in localStorage Until FINISH:**
   - Store all quick-interview data in localStorage during editing
   - Only write to Supabase when FINISH is clicked
   - Add explicit "Save Draft" button for users who want to save mid-edit

3. **Fix Schema Consistency:**
   - Ensure all pages use consistent column names
   - Add proper error handling for all Supabase operations
   - Consider using transactions for multi-table operations

4. **Remove "Continue Editing" Link for Refined Reports:**
   - When status is 'refined', only show "Review & Submit"
   - If editing is truly needed, require explicit "Discard AI Changes" action

5. **Add Offline Queue Processing:**
   - Listen for `online` event
   - Automatically retry pending AI requests
   - Show notification when processing completes

---

## 8. IMPLEMENTED REFACTOR CHANGES (January 2026)

The following changes have been implemented to address the issues identified above:

### 8.1 State Protection (Phase 1)

**quick-interview.html:**
- Added `checkReportState()` function that runs BEFORE any other initialization
- Redirects users to `report.html` if report status is 'refined', 'submitted', or 'finalized'
- Users can no longer accidentally edit a report after AI refinement

**index.html:**
- Updated `updateReportStatus()` to hide "continue editing" link when status is refined
- Updated `showProjectPickerModal()` to gray out and disable projects that have refined reports for today
- Refined projects show a "In Review" badge and are non-clickable

### 8.2 localStorage-First Editing (Phase 2)

**New localStorage System:**
- Key: `fvp_quick_interview_draft`
- Stores all form data during editing
- Data validated against current project ID and date
- Automatically expires if project/date changes

**Functions Added:**
- `saveToLocalStorage()` - Saves entire form state to localStorage
- `loadFromLocalStorage()` - Loads and validates draft data
- `restoreFromLocalStorage()` - Restores draft into report object
- `clearLocalStorageDraft()` - Clears draft after successful FINISH

**Modified Behavior:**
- `saveReport()` now saves to localStorage instead of Supabase (with 500ms debounce)
- Data is recovered from localStorage on page load (survives app swipe-away)
- Data only goes to Supabase when FINISH is clicked
- localStorage is cleared after successful AI processing

### 8.3 Schema Alignment (Phase 3)

**Migration Required:** `migrations/001_add_guided_section_columns.sql`

New columns added to `report_raw_capture`:
- `site_conditions` (TEXT) - Site conditions from guided mode
- `qaqc_notes` (TEXT) - QA/QC notes
- `communications` (TEXT) - Contractor communications
- `visitors_remarks` (TEXT) - Visitor remarks
- `safety_has_incident` (BOOLEAN) - Safety incident flag

### 8.4 Data Flow Summary (Post-Refactor)

```
User enters quick-interview.html
          ↓
   checkReportState()
          ↓
    Status refined? ──Yes──→ Redirect to report.html
          ↓ No
    Load from Supabase (baseline)
          ↓
    Check localStorage for draft
          ↓ (if found)
    Restore from localStorage
          ↓
    User edits form
          ↓
    saveReport() → localStorage (debounced 500ms)
          ↓
    User clicks FINISH
          ↓
    saveReportToSupabase() (all data)
          ↓
    Call AI webhook
          ↓
    Save AI response
          ↓
    Update status to 'refined'
          ↓
    clearLocalStorageDraft()
          ↓
    Redirect to report.html
```

### 8.5 Testing Checklist

After implementing, test these scenarios:

1. **Fresh start**: No localStorage, no Supabase data → Start new report
2. **Swipe away and return**: Enter data → swipe out of app → return → data should persist
3. **FINISH flow**: Complete interview → click FINISH → verify Supabase data → verify redirect
4. **Try to go back**: After FINISH, try to navigate to quick-interview → should redirect to report.html
5. **Index.html options**: Verify "Edit Report" button is hidden when status='refined'
6. **Project picker**: Verify refined projects are grayed out

---

*Document updated: January 2026 - Post robust data flow refactor*

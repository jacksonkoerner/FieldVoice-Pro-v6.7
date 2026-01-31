# FieldVoice Pro - Report/FinalReview/Archives Investigation

**Date:** January 2026
**Purpose:** Deep investigation of interconnected issues between report.html, finalreview.html, archives.html, and data flow after AI processing

---

## ISSUE 1: REPORT.HTML EMPTY ON FIRST LOAD AFTER FINISH

### Reported Behavior
- User clicks FINISH in quick-interview.html
- Redirects to report.html
- Page is EMPTY (no data populated)
- User goes back to index.html
- Clicks "Review and Submit" which goes to report.html
- NOW the page is fully populated

### Investigation Findings

#### 1.1 quick-interview.html FINISH Handler

**Guided Mode: `finishReport()` (line 4012-4115)**

```javascript
async function finishReport() {
    // 1. Validate required fields
    const workSummary = report.guidedNotes?.workSummary?.trim();
    const safetyAnswered = report.safety.noIncidents === true || report.safety.hasIncidents === true;
    // ... validation ...

    // 2. Show loading state
    finishBtn.disabled = true;
    finishBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Processing...';

    // 3. Set up report metadata
    report.overview.endTime = new Date().toLocaleTimeString(...);
    report.meta.interviewCompleted = true;
    // ... more metadata setup ...

    // 4. AWAIT: Save to Supabase FIRST ✅
    await saveReportToSupabase();

    // 5. Build AI payload
    const payload = buildProcessPayload();

    // 6. AWAIT: Save AI request to Supabase ✅
    await saveAIRequest(payload);

    // 7. AWAIT: Call webhook ✅
    const result = await callProcessWebhook(payload);

    // 8. AWAIT: Save AI response to Supabase ✅
    await saveAIResponse(result.aiGenerated, processingTime);

    // 9. Save AI response to local report
    report.aiGenerated = result.aiGenerated;
    report.meta.status = 'refined';

    // 10. AWAIT: Save to Supabase AGAIN ✅
    await saveReportToSupabase();

    // 11. Clear localStorage draft
    clearLocalStorageDraft();

    // 12. REDIRECT - happens AFTER all awaits complete ✅
    window.location.href = 'report.html';
}
```

**Key Finding:** All Supabase saves ARE properly awaited before redirect. The sequence is correct:
- Line 4067: `await saveReportToSupabase()`
- Line 4079: `await saveAIRequest(payload)`
- Line 4085: `const result = await callProcessWebhook(payload)`
- Line 4089: `await saveAIResponse(result.aiGenerated, processingTime)`
- Line 4096: `await saveReportToSupabase()`
- Line 4102: `window.location.href = 'report.html'` (AFTER all awaits)

#### 1.2 report.html Page Load

**DOMContentLoaded handler (line 1083-1126):**

```javascript
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load project and user settings from Supabase
        await Promise.all([
            loadActiveProject(),
            loadUserSettings()
        ]);

        // Load report data from Supabase
        report = await loadReport();  // <-- Key loading function

        // Initialize user edits tracking
        if (!report.userEdits) report.userEdits = {};
        userEdits = report.userEdits;

        // Populate all fields
        populateAllFields();
        // ... rest of initialization
    } catch (err) {
        console.error('Failed to initialize report page:', err);
    }
});
```

**`loadReport()` function (line 1392-1539):**

How it determines what report to load:
1. Gets active project from localStorage: `fvp_active_project`
2. Gets date from URL parameter or defaults to today: `getReportDateStr()`
3. Queries Supabase: `reports` table where `project_id = activeProject.id AND report_date = reportDateStr`

**No localStorage check for report data** - report.html relies entirely on Supabase queries.

#### 1.3 Root Cause Analysis

**THE ISSUE IS NOT A RACE CONDITION IN quick-interview.html**

The code correctly awaits all saves before redirect. However, the issue could be:

1. **Missing URL parameter:** quick-interview.html redirects to `report.html` without a date parameter:
   ```javascript
   window.location.href = 'report.html';  // No ?date= parameter!
   ```

   report.html then uses today's date:
   ```javascript
   function getReportDateStr() {
       const params = new URLSearchParams(window.location.search);
       const dateParam = params.get('date');
       return dateParam || new Date().toISOString().split('T')[0];
   }
   ```

   If there's a timezone edge case near midnight, the dates might not match.

2. **Active project mismatch:** report.html requires `activeProject` to be loaded from localStorage:
   ```javascript
   if (!activeProject) {
       return createFreshReport();  // Returns empty report!
   }
   ```

   If localStorage `fvp_active_project` is missing or invalid, the query never happens.

3. **Supabase eventual consistency:** Though rare, Supabase is eventually consistent. The data might not be immediately readable after write.

4. **Second navigation works because:**
   - By the time user navigates manually, Supabase consistency is achieved
   - User might select a project first on index.html, populating localStorage correctly

### Recommended Fix for Issue 1

```javascript
// In finishReport() and finishMinimalReport(), change:
window.location.href = 'report.html';

// To:
const todayStr = new Date().toISOString().split('T')[0];
window.location.href = `report.html?date=${todayStr}&reportId=${currentReportId}`;
```

AND in report.html's `loadReport()`, add reportId-based lookup (like finalreview.html already has).

---

## ISSUE 2: FINALREVIEW.HTML DATA MAPPING

### Reported Behavior
- Information is not mapping correctly to the final review page
- Fields appear empty or incorrect

### Investigation Findings

#### 2.1 CRITICAL BUG: Wrong Column Names Expected

**finalreview.html expects different columns than what exists!**

**What quick-interview.html SAVES (line 1670-1685):**
```javascript
async function saveAIResponse(response, processingTimeMs) {
    const responseData = {
        report_id: currentReportId,
        response_payload: response,  // <-- JSONB column with ENTIRE AI response
        model_used: 'n8n-fieldvoice-refine',
        processing_time_ms: processingTimeMs,
        received_at: new Date().toISOString()
    };

    await supabaseClient
        .from('report_ai_response')
        .upsert(responseData, { onConflict: 'report_id' });
}
```

**What report.html correctly LOADS (line 1518-1524):**
```javascript
if (aiResponseResult.data) {
    try {
        loadedReport.aiGenerated = aiResponseResult.data.response_payload || null;
    } catch (e) {
        console.error('Failed to parse AI response:', e);
    }
}
```

**What finalreview.html INCORRECTLY expects (line 1361-1415):**
```javascript
if (aiResponseResult.data) {
    const aiData = aiResponseResult.data;
    loadedReport.aiGenerated = {
        activities: [],
        generalIssues: aiData.general_issues || '',     // WRONG - column doesn't exist!
        qaqcNotes: aiData.qaqc_notes || '',             // WRONG - column doesn't exist!
        safety: {
            hasIncident: aiData.safety_has_incident || false,  // WRONG!
            notes: aiData.safety_notes || ''                   // WRONG!
        },
        contractorCommunications: aiData.contractor_communications || '',  // WRONG!
        visitorsRemarks: aiData.visitors_remarks || '',  // WRONG!
        // ...
    };

    if (aiData.activities_json) {  // WRONG - column doesn't exist!
        loadedReport.aiGenerated.activities = JSON.parse(aiData.activities_json);
    }
}
```

#### 2.2 Field Mapping Table

| finalreview.html Expects | Actually Stored In | Status |
|--------------------------|-------------------|--------|
| `aiData.general_issues` | `response_payload.generalIssues` | MISMATCH |
| `aiData.qaqc_notes` | `response_payload.qaqcNotes` | MISMATCH |
| `aiData.safety_has_incident` | `response_payload.safety.hasIncidents` | MISMATCH |
| `aiData.safety_notes` | `response_payload.safety.notes` | MISMATCH |
| `aiData.contractor_communications` | `response_payload.contractorCommunications` | MISMATCH |
| `aiData.visitors_remarks` | `response_payload.visitorsRemarks` | MISMATCH |
| `aiData.activities_json` | `response_payload.activities` (already array) | MISMATCH |
| `aiData.operations_json` | `response_payload.operations` (already array) | MISMATCH |
| `aiData.equipment_json` | `response_payload.equipment` (already array) | MISMATCH |

#### 2.3 Photo URL Mapping Issue

**report.html correctly builds photo URLs (line 1507):**
```javascript
url: p.storage_path ? `${SUPABASE_URL}/storage/v1/object/public/report-photos/${p.storage_path}` : '',
```

**finalreview.html expects wrong column (line 1354):**
```javascript
url: row.photo_url || '',  // WRONG - column is 'storage_path', not 'photo_url'
```

#### 2.4 Data Priority

Both report.html and finalreview.html use the SAME priority system:
```
userEdits > aiGenerated > fieldNotes > defaults
```

However, since finalreview.html fails to load aiGenerated properly, the priority falls through to fieldNotes (raw capture data) or defaults.

### Root Cause Summary for Issue 2

**finalreview.html was written expecting a different database schema than what actually exists.** It expects:
- Separate columns for each AI-generated field
- A `photo_url` column instead of `storage_path`

But the actual schema stores:
- AI response as a single `response_payload` JSONB column
- Photo paths in `storage_path` column

### Recommended Fix for Issue 2

Replace finalreview.html's AI response loading (lines 1361-1415) with the same approach as report.html:

```javascript
// Process AI response - FIXED VERSION
if (aiResponseResult.data) {
    // AI response is stored as JSONB in response_payload
    const aiPayload = aiResponseResult.data.response_payload;

    if (aiPayload && typeof aiPayload === 'object') {
        loadedReport.aiGenerated = aiPayload;

        // Copy AI text sections to report for easy access
        loadedReport.issues = aiPayload.generalIssues?.join?.('\n') ||
                             aiPayload.generalIssues || '';
        loadedReport.communications = aiPayload.contractorCommunications || '';
        loadedReport.qaqc = aiPayload.qaqcNotes?.join?.('\n') ||
                           aiPayload.qaqcNotes || '';
        loadedReport.visitors = aiPayload.visitorsRemarks || '';
        loadedReport.safety = aiPayload.safety || { hasIncident: false, notes: '' };
    }
}
```

And fix the photo URL loading (line 1354):
```javascript
// BEFORE:
url: row.photo_url || '',

// AFTER:
url: row.storage_path ? `${SUPABASE_URL}/storage/v1/object/public/report-photos/${row.storage_path}` : '',
```

---

## ISSUE 3: ARCHIVES.HTML ISSUES

### Investigation Findings

#### 3.1 Data Source Query

**`getAllReports()` function (line 195-258):**
```javascript
async function getAllReports() {
    const { data: reportRows, error: reportError } = await supabaseClient
        .from('reports')
        .select(`
            id,
            project_id,
            project_name,
            report_date,
            inspector_name,
            status,
            created_at,
            submitted_at,
            updated_at
        `)
        .order('report_date', { ascending: false });
    // ...
}
```

**Key Finding:** archives.html does NOT filter by status. It shows ALL reports, not just submitted ones.

#### 3.2 Report Display

Each archived report shows:
- Date (formatted)
- Project name
- Status badge ("Submitted" or "Draft")
- Photo count

Status is determined by:
```javascript
submitted: row.status === 'submitted',
```

#### 3.3 Navigation

When user clicks on an archived report (line 350):
```javascript
const viewUrl = `finalreview.html?date=${report.date}&reportId=${report.id}`;
```

**Archives.html correctly passes both `date` AND `reportId`** to finalreview.html.

#### 3.4 Relationship to finalreview.html Issues

Since archives.html links to finalreview.html, ALL the mapping issues in Issue 2 affect archives.html indirectly:
- When user clicks an archived report, they go to finalreview.html
- finalreview.html fails to load AI-generated content correctly
- User sees incomplete/empty data

### Summary for Issue 3

Archives.html itself is working correctly. The issues users see are caused by finalreview.html's data mapping bugs (Issue 2).

---

## ISSUE 4: DATA FLOW AFTER WEBHOOK RESPONSE

### Current Flow Analysis

```
n8n returns AI response
    ↓
await saveAIResponse(result.aiGenerated, processingTime)  [LINE 4089]
    - Saves to report_ai_response.response_payload (JSONB)
    ↓
report.aiGenerated = result.aiGenerated  [LINE 4093]
    - Also stored in local report object
    ↓
await saveReportToSupabase()  [LINE 4096]
    - Saves report metadata, status = 'refined'
    ↓
clearLocalStorageDraft()  [LINE 4099]
    ↓
window.location.href = 'report.html'  [LINE 4102]
    ↓
report.html queries Supabase
    ↓
Page populated
```

### Investigation Questions Answered

#### 4.1 In quick-interview.html after webhook returns

**Exact code handling webhook response (lines 4083-4096):**
```javascript
try {
    const result = await callProcessWebhook(payload);
    const processingTime = Date.now() - startTime;

    // Save AI response to Supabase
    await saveAIResponse(result.aiGenerated, processingTime);

    // Save AI response to local report
    if (result.aiGenerated) {
        report.aiGenerated = result.aiGenerated;
    }
    report.meta.status = 'refined';
    await saveReportToSupabase();
```

- **Is the Supabase save awaited?** YES - line 4089: `await saveAIResponse(...)`
- **Is there any localStorage save?** NO - AI response is NOT saved to localStorage
- **When does redirect happen?** AFTER all awaits complete - line 4102

#### 4.2 In report.html data loading

- **Does it check localStorage at all?** NO
- **What localStorage keys would it check?** N/A - it only checks `fvp_active_project` for the project ID
- **Can we add a localStorage-first check?** YES - recommended below

#### 4.3 Proposed Solution

**Add localStorage caching for AI response:**

In quick-interview.html (before redirect):
```javascript
// Save to localStorage for immediate access on report.html
localStorage.setItem('fvp_ai_response_cache', JSON.stringify({
    reportId: currentReportId,
    aiGenerated: result.aiGenerated,
    cachedAt: new Date().toISOString()
}));
```

In report.html (at start of loadReport):
```javascript
// Check localStorage cache first for immediate load
const aiCache = localStorage.getItem('fvp_ai_response_cache');
if (aiCache) {
    const cached = JSON.parse(aiCache);
    // Only use if it's for THIS report and less than 5 minutes old
    if (cached.reportId === currentReportId &&
        (Date.now() - new Date(cached.cachedAt)) < 300000) {
        loadedReport.aiGenerated = cached.aiGenerated;
        // Clear cache after use
        localStorage.removeItem('fvp_ai_response_cache');
    }
}
```

---

## ISSUE 5: REPORT_FINAL TABLE USAGE

### Investigation Findings

#### 5.1 When data gets written to report_final

Data is written to `report_final` on **Submit from finalreview.html** (line 2086-2137):

```javascript
async function submitReport() {
    // ...
    const finalData = {
        report_id: currentReportId,
        final_data: {
            overview: report.overview,
            activities: report.activities,
            operations: report.operations,
            equipment: report.equipment,
            photos: report.photos,
            aiGenerated: report.aiGenerated,
            userEdits: report.userEdits,
            issues: report.issues,
            communications: report.communications,
            qaqc: report.qaqc,
            visitors: report.visitors,
            safety: report.safety
        },
        submitted_at: submittedAt
    };

    // Check if exists, update or insert
    const { data: existingFinal } = await supabaseClient
        .from('report_final')
        .select('id')
        .eq('report_id', currentReportId)
        .single();

    if (existingFinal) {
        await supabaseClient.from('report_final').update({...}).eq('report_id', currentReportId);
    } else {
        await supabaseClient.from('report_final').insert(finalData);
    }

    // Also update reports table status
    await supabaseClient.from('reports').update({
        status: 'submitted',
        submitted_at: submittedAt,
        updated_at: submittedAt
    }).eq('id', currentReportId);
}
```

#### 5.2 What data goes into report_final

It's a **complete snapshot** of the final report state, including:
- `overview` - all project metadata
- `activities` - contractor work summaries
- `operations` - personnel counts
- `equipment` - equipment usage
- `photos` - photo metadata
- `aiGenerated` - AI-generated content
- `userEdits` - all user modifications
- `issues`, `communications`, `qaqc`, `visitors`, `safety` - text sections

**Note:** The `aiGenerated` stored here will be EMPTY/INCORRECT due to Issue 2's mapping bug!

#### 5.3 Schema

Expected columns in `report_final`:
- `id` (primary key)
- `report_id` (foreign key to reports)
- `final_data` (JSONB - contains entire report snapshot)
- `submitted_at` (timestamp)

---

## CODE AUDIT: EXACT CODE EXTRACTION

### quick-interview.html

#### Complete FINISH Button Handler (Guided Mode)

**Location:** Lines 4012-4115

```javascript
async function finishReport() {
    // Validate required fields before finishing
    const workSummary = report.guidedNotes?.workSummary?.trim();
    const safetyAnswered = report.safety.noIncidents === true || report.safety.hasIncidents === true;

    if (!workSummary) {
        showToast('Work Summary is required', 'error');
        const activitiesCard = document.querySelector('[data-section="activities"]');
        if (activitiesCard && !activitiesCard.classList.contains('expanded')) {
            toggleSection('activities');
        }
        document.getElementById('work-summary-input')?.focus();
        return;
    }

    if (!safetyAnswered) {
        showToast('Please answer the Safety question', 'error');
        const safetyCard = document.querySelector('[data-section="safety"]');
        if (safetyCard && !safetyCard.classList.contains('expanded')) {
            toggleSection('safety');
        }
        return;
    }

    const finishBtn = document.querySelector('button[onclick="finishReport()"]');
    const originalBtnHtml = finishBtn ? finishBtn.innerHTML : '';

    if (finishBtn) {
        finishBtn.disabled = true;
        finishBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Processing...';
    }
    showToast('Processing with AI...', 'info');

    report.overview.endTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    report.meta.interviewCompleted = true;
    if (report.overview.startTime) {
        const start = new Date(`2000/01/01 ${report.overview.startTime}`);
        const end = new Date(`2000/01/01 ${report.overview.endTime}`);
        const diffMs = end - start;
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        report.overview.shiftDuration = `${hours}.${String(mins).padStart(2, '0')} hours`;
    }
    if (report.safety.notes.length === 0) { report.safety.notes.push('No safety incidents reported.'); }

    report.guidedNotes.issues = report.generalIssues?.join('\n') || '';
    report.guidedNotes.safety = report.safety.noIncidents ? 'No incidents reported' : (report.safety.hasIncidents ? 'INCIDENT REPORTED: ' + report.safety.notes.join('; ') : '');

    await saveReportToSupabase();

    const payload = buildProcessPayload();

    if (!navigator.onLine) {
        handleOfflineProcessing(payload, true);
        return;
    }

    await saveAIRequest(payload);

    const startTime = Date.now();

    try {
        const result = await callProcessWebhook(payload);
        const processingTime = Date.now() - startTime;

        await saveAIResponse(result.aiGenerated, processingTime);

        if (result.aiGenerated) {
            report.aiGenerated = result.aiGenerated;
        }
        report.meta.status = 'refined';
        await saveReportToSupabase();

        clearLocalStorageDraft();

        window.location.href = 'report.html';
    } catch (error) {
        console.error('AI processing failed:', error);

        if (finishBtn) {
            finishBtn.disabled = false;
            finishBtn.innerHTML = originalBtnHtml;
        }

        handleOfflineProcessing(payload, true);
    }
}
```

#### Webhook Call Function

**Location:** Lines 1585-1640

```javascript
async function callProcessWebhook(payload) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(N8N_PROCESS_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Webhook failed: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success && !data.aiGenerated) {
            console.error('Invalid webhook response:', data);
            throw new Error('Invalid response from AI processing');
        }

        if (typeof data.aiGenerated === 'string') {
            try {
                data.aiGenerated = JSON.parse(data.aiGenerated);
            } catch (e) {
                console.error('Failed to parse aiGenerated string:', e);
            }
        }

        const ai = data.aiGenerated;
        if (ai) {
            ai.activities = ai.activities || [];
            ai.operations = ai.operations || [];
            ai.equipment = ai.equipment || [];
            ai.generalIssues = ai.generalIssues || [];
            ai.qaqcNotes = ai.qaqcNotes || [];
            ai.safety = ai.safety || { hasIncidents: false, noIncidents: true, notes: '' };
        }

        console.log('[AI] Received response:', JSON.stringify(data.aiGenerated, null, 2));

        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}
```

#### Save AI Response Function

**Location:** Lines 1670-1693

```javascript
async function saveAIResponse(response, processingTimeMs) {
    if (!currentReportId) return;

    try {
        const responseData = {
            report_id: currentReportId,
            response_payload: response,
            model_used: 'n8n-fieldvoice-refine',
            processing_time_ms: processingTimeMs,
            received_at: new Date().toISOString()
        };

        const { error } = await supabaseClient
            .from('report_ai_response')
            .upsert(responseData, { onConflict: 'report_id' });

        if (error) {
            console.error('Error saving AI response:', error);
        }
    } catch (err) {
        console.error('Failed to save AI response:', err);
    }
}
```

### report.html

#### Page Initialization

**Location:** Lines 1083-1126

```javascript
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await Promise.all([
            loadActiveProject(),
            loadUserSettings()
        ]);

        report = await loadReport();

        if (!report.userEdits) report.userEdits = {};
        userEdits = report.userEdits;

        if (!report.meta) report.meta = {};
        report.meta.reportViewed = true;
        await saveReportSilent();

        populateAllFields();
        populateOriginalNotes();
        checkPendingRefineStatus();
        setupAutoSave();
        initAutoExpandTextareas();
        updateHeaderDate();
        initializeDebugPanel();
    } catch (err) {
        console.error('Failed to initialize report page:', err);
    }
});
```

#### Data Loading Function

**Location:** Lines 1392-1539 (excerpt showing AI response loading)

```javascript
async function loadReport() {
    currentReportId = null;

    if (!activeProject) {
        return createFreshReport();
    }

    const reportDateStr = getReportDateStr();

    try {
        const { data: reportRow, error: reportError } = await supabaseClient
            .from('reports')
            .select('*')
            .eq('project_id', activeProject.id)
            .eq('report_date', reportDateStr)
            .single();

        if (!reportRow) {
            return createFreshReport();
        }

        currentReportId = reportRow.id;

        const [rawCaptureResult, contractorWorkResult, personnelResult,
               equipmentUsageResult, photosResult, aiResponseResult,
               userEditsResult] = await Promise.all([
            // ... parallel queries ...
            supabaseClient.from('report_ai_response')
                .select('*')
                .eq('report_id', reportRow.id)
                .order('received_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            // ...
        ]);

        // AI response - CORRECT LOADING
        if (aiResponseResult.data) {
            try {
                loadedReport.aiGenerated = aiResponseResult.data.response_payload || null;
            } catch (e) {
                console.error('Failed to parse AI response:', e);
            }
        }

        return loadedReport;
    } catch (e) {
        console.error('Failed to load report:', e);
        return createFreshReport();
    }
}
```

#### getValue Function (Data Priority)

**Location:** Lines 1601-1630

```javascript
function getValue(path, defaultValue = '') {
    // Check user edits first - user edits always win
    if (userEdits[path] !== undefined) {
        return userEdits[path];
    }

    // Check AI-generated content
    if (report.aiGenerated) {
        const aiValue = getNestedValue(report.aiGenerated, path);
        if (aiValue !== undefined && aiValue !== null && aiValue !== '') {
            if (Array.isArray(aiValue)) {
                return aiValue.join('\n');
            }
            return aiValue;
        }
    }

    // Check existing report data (fieldNotes, guidedNotes, etc.)
    const reportValue = getNestedValue(report, path);
    if (reportValue !== undefined && reportValue !== null && reportValue !== '') {
        if (Array.isArray(reportValue)) {
            return reportValue.join('\n');
        }
        return reportValue;
    }

    return defaultValue;
}
```

### finalreview.html

#### Page Initialization

**Location:** Lines 1076-1096

```javascript
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadActiveProject();
        await loadUserSettings();
        report = await loadReport();

        if (!report) {
            alert('No report found for this date.');
            window.location.href = 'index.html';
            return;
        }

        populateReport();
        updateTotalPages();
        checkSubmittedState();
        checkEmptyFields();
    } catch (err) {
        console.error('Failed to initialize:', err);
        alert('Failed to load report data. Please try again.');
    }
});
```

#### Data Loading (BUGGY)

**Location:** Lines 1212-1440 (excerpt showing problematic AI response loading)

```javascript
// Process AI response - BUGGY CODE
if (aiResponseResult.data) {
    const aiData = aiResponseResult.data;
    loadedReport.aiGenerated = {
        activities: [],
        generalIssues: aiData.general_issues || '',  // BUG: expects column that doesn't exist
        qaqcNotes: aiData.qaqc_notes || '',          // BUG: expects column that doesn't exist
        safety: {
            hasIncident: aiData.safety_has_incident || false,
            notes: aiData.safety_notes || ''
        },
        // ...
    };

    if (aiData.activities_json) {  // BUG: column doesn't exist
        loadedReport.aiGenerated.activities = JSON.parse(aiData.activities_json);
    }
}
```

### archives.html

#### Data Loading Function

**Location:** Lines 195-258

```javascript
async function getAllReports() {
    try {
        const { data: reportRows, error: reportError } = await supabaseClient
            .from('reports')
            .select(`
                id,
                project_id,
                project_name,
                report_date,
                inspector_name,
                status,
                created_at,
                submitted_at,
                updated_at
            `)
            .order('report_date', { ascending: false });

        // ... photo count query ...

        const reports = reportRows.map(row => {
            const project = getProjectById(row.project_id);
            return {
                id: row.id,
                date: row.report_date,
                projectId: row.project_id,
                projectName: project?.name || row.project_name || 'Unknown Project',
                submitted: row.status === 'submitted',
                photoCount: photoCountMap[row.id] || 0,
                createdAt: row.created_at,
                submittedAt: row.submitted_at
            };
        });

        return reports;
    } catch (e) {
        console.error('[SUPABASE] Failed to load reports:', e);
        return [];
    }
}
```

#### Report Row Rendering and Navigation

**Location:** Lines 339-384

```javascript
function renderReportRow(report) {
    // ... formatting ...

    // Navigation URL - correctly passes reportId
    const viewUrl = `finalreview.html?date=${report.date}&reportId=${report.id}`;

    return `
        <div class="swipe-container ...">
            <a href="${viewUrl}" class="swipe-content ...">
                <!-- ... report display ... -->
            </a>
            <!-- ... delete button ... -->
        </div>
    `;
}
```

---

## SUMMARY TABLE

| Issue | File | Function/Line | Problem | Suggested Fix |
|-------|------|---------------|---------|---------------|
| Empty page on first load | quick-interview.html | finishReport:4102 | Redirect has no date/reportId params | Add `?date=${todayStr}&reportId=${currentReportId}` |
| Empty page on first load | report.html | loadReport:1396-1398 | Returns empty if no activeProject | Add validation and better error handling |
| AI data not loading | finalreview.html | loadReport:1361-1415 | Expects wrong column names (general_issues vs response_payload) | Use `response_payload` JSONB like report.html |
| AI data not loading | finalreview.html | loadReport:1365 | Expects `aiData.general_issues` | Use `aiData.response_payload.generalIssues` |
| AI data not loading | finalreview.html | loadReport:1366 | Expects `aiData.qaqc_notes` | Use `aiData.response_payload.qaqcNotes` |
| AI data not loading | finalreview.html | loadReport:1378 | Expects `aiData.activities_json` | Use `aiData.response_payload.activities` |
| Photos not loading | finalreview.html | loadReport:1354 | Expects `photo_url` column | Use `storage_path` and build URL |
| No localStorage cache | quick-interview.html | finishReport:4089-4102 | AI response not cached locally | Add localStorage cache before redirect |
| report_final has bad data | finalreview.html | submitReport:2089-2096 | Saves broken aiGenerated | Fix loading first, then this auto-fixes |

---

## RECOMMENDATIONS

### 1. Fixing the Race Condition (report.html empty on first load)

**Priority: HIGH**

```javascript
// In quick-interview.html, change line 4102:
// FROM:
window.location.href = 'report.html';

// TO:
const todayStr = new Date().toISOString().split('T')[0];
window.location.href = `report.html?date=${todayStr}&reportId=${currentReportId}`;
```

Also add to report.html's `loadReport()` function the ability to load by reportId (like finalreview.html):

```javascript
const params = new URLSearchParams(window.location.search);
const reportIdParam = params.get('reportId');

// If we have a reportId, load directly by ID first
if (reportIdParam) {
    const { data, error } = await supabaseClient
        .from('reports')
        .select('*')
        .eq('id', reportIdParam)
        .single();
    if (!error && data) {
        reportRow = data;
    }
}
```

### 2. Fixing finalreview.html Data Mapping

**Priority: CRITICAL**

Replace lines 1361-1415 in finalreview.html with:

```javascript
// Process AI response - FIXED VERSION
if (aiResponseResult.data && aiResponseResult.data.response_payload) {
    const aiPayload = aiResponseResult.data.response_payload;

    // Use the response_payload directly (it's already the aiGenerated object)
    loadedReport.aiGenerated = aiPayload;

    // Copy relevant fields to report for easy access
    if (aiPayload.generalIssues) {
        loadedReport.issues = Array.isArray(aiPayload.generalIssues)
            ? aiPayload.generalIssues.join('\n')
            : aiPayload.generalIssues;
    }
    if (aiPayload.qaqcNotes) {
        loadedReport.qaqc = Array.isArray(aiPayload.qaqcNotes)
            ? aiPayload.qaqcNotes.join('\n')
            : aiPayload.qaqcNotes;
    }
    if (aiPayload.contractorCommunications) {
        loadedReport.communications = aiPayload.contractorCommunications;
    }
    if (aiPayload.visitorsRemarks) {
        loadedReport.visitors = aiPayload.visitorsRemarks;
    }
    if (aiPayload.safety) {
        loadedReport.safety = {
            hasIncident: aiPayload.safety.hasIncidents || aiPayload.safety.hasIncident || false,
            notes: Array.isArray(aiPayload.safety.notes)
                ? aiPayload.safety.notes.join('\n')
                : (aiPayload.safety.notes || '')
        };
    }
}
```

Fix photo URL loading at line 1354:

```javascript
// FROM:
url: row.photo_url || '',

// TO:
url: row.storage_path
    ? `${SUPABASE_URL}/storage/v1/object/public/report-photos/${row.storage_path}`
    : '',
```

### 3. Fixing archives.html Issues

**Priority: MEDIUM**

Archives.html itself works correctly. Once finalreview.html is fixed, archives will work properly since it just links to finalreview.html.

Optional enhancement - add status filtering:
```javascript
// To show only submitted reports:
.in('status', ['submitted', 'finalized'])

// Or to show all but mark draft differently:
// (current behavior - no change needed)
```

### 4. Implementing localStorage-First for AI Response

**Priority: MEDIUM**

In quick-interview.html, add before redirect (around line 4098):

```javascript
// Cache AI response in localStorage for immediate availability
if (currentReportId && result.aiGenerated) {
    try {
        localStorage.setItem('fvp_ai_response_cache', JSON.stringify({
            reportId: currentReportId,
            aiGenerated: result.aiGenerated,
            cachedAt: Date.now()
        }));
    } catch (e) {
        console.warn('Failed to cache AI response:', e);
    }
}
```

In report.html's `loadReport()`, add early check:

```javascript
// Check for cached AI response first (for immediate availability after redirect)
const aiCache = localStorage.getItem('fvp_ai_response_cache');
if (aiCache) {
    try {
        const cached = JSON.parse(aiCache);
        const cacheAge = Date.now() - cached.cachedAt;
        if (cached.reportId === currentReportId && cacheAge < 300000) { // 5 min max
            loadedReport.aiGenerated = cached.aiGenerated;
            console.log('[CACHE] Loaded AI response from localStorage cache');
        }
        // Clear cache after use
        localStorage.removeItem('fvp_ai_response_cache');
    } catch (e) {
        console.warn('Failed to load cached AI response:', e);
    }
}
```

---

## TESTING CHECKLIST

After implementing fixes, verify:

1. [ ] FINISH in quick-interview.html redirects to report.html with data visible immediately
2. [ ] report.html loads AI-generated content correctly
3. [ ] finalreview.html shows all AI-generated fields (issues, qaqc, communications, safety, etc.)
4. [ ] finalreview.html shows photos correctly
5. [ ] archives.html lists all reports
6. [ ] Clicking report in archives.html shows full data in finalreview.html
7. [ ] Submit from finalreview.html saves complete data to report_final
8. [ ] Offline scenario still works (saves to drafts)

---

*Document created: January 2026*
*Last updated: January 2026*

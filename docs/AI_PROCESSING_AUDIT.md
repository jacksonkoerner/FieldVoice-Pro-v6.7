# FieldVoice Pro v6.6 — AI Processing Flow Audit

**Date:** January 29, 2026  
**Audited by:** George (AI Assistant)  
**Project:** FieldVoice-Pro-v6.6  
**Webhook:** `https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-text-v6.5`

---

## PART A: n8n Workflow Audit

### Workflow Details
- **Name:** FieldVoice - Refine Text - v6.5
- **ID:** `YOrX6da2tZzU4DfN`
- **Status:** Active ✅
- **Node Count:** 3

### Workflow Diagram

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Webhook   │────▶│  Claude Sonnet  │────▶│ Respond JSON │
│   (POST)    │     │   (Anthropic)   │     │              │
└─────────────┘     └─────────────────┘     └──────────────┘
```

### Node Details

| # | Node Name | Type | Purpose |
|---|-----------|------|---------|
| 1 | **Webhook** | `n8n-nodes-base.webhook` (v2) | Receives POST requests at `/fieldvoice-refine-text-v6.5` |
| 2 | **Claude Sonnet** | `@n8n/n8n-nodes-langchain.anthropic` (v1) | AI text refinement using `claude-sonnet-4-5-20250929` |
| 3 | **Respond JSON** | `n8n-nodes-base.respondToWebhook` (v1.1) | Returns JSON response to caller |

### Claude Prompt (Full Text)

```
You are a professional construction field report editor. Your job is to refine raw field notes into polished, DOT-compliant language.

## Context
- Project: {{ $json.body.reportContext.projectName }}
- Reporter: {{ $json.body.reportContext.reporterName }}
- Date: {{ $json.body.reportContext.date }}
- Section: {{ $json.body.section }}

## Section-Specific Guidelines
{{ $json.body.section === 'weather' ? 'Format weather observations professionally. Include temperature, precipitation, and site conditions.' : '' }}
{{ $json.body.section === 'activities' ? 'Describe work performed in professional third-person past tense. Be specific about locations, quantities, and methods.' : '' }}
{{ $json.body.section === 'issues' ? 'Document problems clearly with impact and any resolutions. Maintain factual, objective tone.' : '' }}
{{ $json.body.section === 'inspections' ? 'Note inspection type, results, and any deficiencies identified. Include inspector names if mentioned.' : '' }}
{{ $json.body.section === 'safety' ? 'Document safety observations, toolbox talks, and any incidents. Note PPE compliance.' : '' }}
{{ $json.body.section === 'visitors' ? 'Log visitor names, organizations, purpose of visit, and duration on site.' : '' }}
{{ $json.body.section === 'additionalNotes' ? 'Refine miscellaneous observations into clear, professional notes.' : '' }}

## Original Field Notes
{{ $json.body.originalText }}

## Instructions
1. Refine the text into professional DOT-compliant language
2. Maintain all factual content - do not add or fabricate details
3. Use third-person past tense
4. Keep it concise but complete
5. Return ONLY the refined text - no explanations, no JSON, no markdown

Refined text:
```

### Claude Model Settings
- **Model:** `claude-sonnet-4-5-20250929`
- **Max Tokens:** 1024
- **Temperature:** 0.3

### Expected Input Payload

```json
{
  "body": {
    "section": "weather|activities|issues|inspections|safety|visitors|additionalNotes",
    "originalText": "Raw field notes to refine",
    "reportContext": {
      "projectName": "Project Name",
      "reporterName": "Inspector Name",
      "date": "2026-01-29"
    }
  }
}
```

### Output Format

```json
{
  "refinedText": "The refined, DOT-compliant text..."
}
```

**Note:** The webhook returns `responseMode: "responseNode"` which means the Respond JSON node controls the response format.

---

## PART B: Code Audit — Sending Data

### Webhook URL Definition

| File | Line | URL |
|------|------|-----|
| `js/quick-interview.js` | 910 | `https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-text-v6.5` |
| `js/report.js` | 26 | `https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-text-v6.5` |
| `js/drafts.js` | 292 | `https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-text-v6.5` |

### Primary Function: `callProcessWebhook()`

**Location:** `js/quick-interview.js` lines 965-1012

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

        // Validate response structure
        if (!data.success && !data.aiGenerated) {
            throw new Error('Invalid response from AI processing');
        }

        // If aiGenerated is a string, try to parse it
        if (typeof data.aiGenerated === 'string') {
            data.aiGenerated = JSON.parse(data.aiGenerated);
        }

        // Ensure arrays exist in AI response
        const ai = data.aiGenerated;
        if (ai) {
            ai.activities = ai.activities || [];
            ai.operations = ai.operations || [];
            ai.equipment = ai.equipment || [];
            ai.generalIssues = ai.generalIssues || [];
            ai.qaqcNotes = ai.qaqcNotes || [];
            ai.safety = ai.safety || { hasIncidents: false, noIncidents: true, notes: '' };
        }

        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}
```

### Payload Builder: `buildProcessPayload()`

**Location:** `js/quick-interview.js` lines 915-961

```javascript
function buildProcessPayload() {
    const todayStr = new Date().toISOString().split('T')[0];
    const reportKey = getReportKey(activeProject?.id, todayStr);

    return {
        reportId: reportKey,
        captureMode: report.meta.captureMode || 'guided',

        projectContext: {
            projectId: activeProject?.id || null,
            projectName: activeProject?.name || report.project?.name || '',
            noabProjectNo: activeProject?.noabProjectNo || '',
            location: activeProject?.location || '',
            engineer: activeProject?.engineer || '',
            primeContractor: activeProject?.primeContractor || '',
            contractors: activeProject?.contractors || [],
            equipment: activeProject?.equipment || []
        },

        fieldNotes: report.meta.captureMode === 'minimal'
            ? { freeformNotes: report.fieldNotes?.freeformNotes || '' }
            : {
                workSummary: report.guidedNotes?.workSummary || '',
                issues: report.guidedNotes?.issues || '',
                safety: report.guidedNotes?.safety || ''
              },

        weather: report.overview?.weather || {},

        photos: (report.photos || []).map(p => ({
            id: p.id,
            caption: p.caption || '',
            timestamp: p.timestamp,
            date: p.date,
            time: p.time,
            gps: p.gps
        })),

        reportDate: report.overview?.date || new Date().toLocaleDateString(),
        inspectorName: report.overview?.completedBy || '',

        // v6: Entry-based notes and toggle states
        entries: report.entries || [],
        toggleStates: report.toggleStates || {}
    };
}
```

### Triggers — When is the Webhook Called?

| Trigger | Function | File:Line | User Action |
|---------|----------|-----------|-------------|
| **Finish Minimal Report** | `finishMinimalReport()` | `quick-interview.js:1116-1203` | Click "Finish" button in minimal capture mode |
| **Finish Guided Report** | `finishGuidedReport()` | `quick-interview.js:3499-3560` | Click "Finish" button in guided capture mode |
| **Sync Draft** | `syncDraft()` | `drafts.js:280-360` | Manual sync from drafts page |

### Call Chain Example (Minimal Mode)

```
User clicks "Finish" button
    ↓
finishMinimalReport()                     [quick-interview.js:1116]
    ├── Validates field notes exist
    ├── Shows loading state
    ├── saveReportToSupabase()            [saves initial draft]
    ├── buildProcessPayload()             [builds payload]
    ├── navigator.onLine check
    │   ├── If offline → handleOfflineProcessing()
    │   └── If online → continue
    ├── saveAIRequest()                   [disabled - no-op]
    ├── callProcessWebhook(payload)       [calls n8n]
    ├── saveAIResponse()                  [saves to ai_responses table]
    ├── report.aiGenerated = result
    ├── report.meta.status = 'refined'
    ├── saveReportToSupabase()            [updates with AI data]
    ├── clearLocalStorageDraft()
    └── window.location.href = 'report.html?...'
```

---

## PART C: Code Audit — Receiving/Displaying AI Response

### Response Handling

**Location:** `js/quick-interview.js` lines 1034-1057

```javascript
async function saveAIResponse(response, processingTimeMs) {
    if (!currentReportId) return;

    const responseData = {
        report_id: currentReportId,
        response_payload: response,
        model_used: 'n8n-fieldvoice-refine',
        processing_time_ms: processingTimeMs,
        received_at: new Date().toISOString()
    };

    // Upsert to handle retries/reprocessing
    const { error } = await supabaseClient
        .from('ai_responses')
        .upsert(responseData, { onConflict: 'report_id' });
}
```

### Storage Locations

| Data | Storage Location | Table/Key |
|------|------------------|-----------|
| AI Response | Supabase | `ai_responses.response_payload` (JSONB) |
| AI Response Cache | localStorage | `fvp_ai_response_{reportId}` |
| Report Status | Supabase | `reports.status` |
| Final Report | Supabase | `final_reports` (on submit) |

### Page Audits

#### `report.html` — Editable Report Review

**Purpose:** Display AI-refined report for user editing before final review.

**Location:** `js/report.js`

**Key Functions:**
- `loadReport()` — Loads report from Supabase, including AI response
- `populateAllFields()` — Populates form with AI-refined content
- `populateOriginalNotes()` — Shows original field notes for comparison
- `saveReportToSupabase()` — Saves user edits

**Data Sources:**
1. Report data from `reports` table (via `currentReportId`)
2. AI response from `ai_responses` table (via `report_id`)
3. Local cache fallback: `localStorage.fvp_ai_response_{reportId}`

**Features:**
- Two tabs: "Form View" (AI refined) and "Original Notes" (raw capture)
- Editable fields with auto-save
- User edits tracked separately in `report.userEdits`

---

#### `finalreview.html` — Read-Only Final Review + Submit

**Purpose:** Print-optimized final report view with submit capability.

**Location:** `js/finalreview.js`

**Key Functions:**
- `loadReport()` — Lines 124-350 — Loads complete report + AI data
- `populateReport()` — Populates read-only view
- `submitReport()` — Lines 981-1110 — Saves to `final_reports` and marks submitted
- `checkSubmittedState()` — Disables submit if already submitted

**Data Flow on Load:**
```
loadReport()
    ├── Fetch from Supabase: reports + raw_capture_results + ai_responses
    ├── Process contractor work (from raw_data.contractor_work)
    ├── Process personnel (from raw_data.personnel)
    ├── Process equipment (from raw_data.equipment_usage)
    ├── Process photos (from report_photos)
    └── Process AI response (from ai_responses.response_payload)
         ├── aiGenerated.activities
         ├── aiGenerated.operations
         ├── aiGenerated.equipment
         ├── aiGenerated.generalIssues
         ├── aiGenerated.qaqcNotes
         ├── aiGenerated.safety
         ├── aiGenerated.contractorCommunications
         └── aiGenerated.visitorsRemarks
```

**Submit Flow:**
```
submitReport()
    ├── Build finalData object
    ├── Upsert to final_reports table
    ├── Update reports.status = 'submitted'
    ├── Update reports.submitted_at
    └── showSubmitSuccess()
```

---

### Status Flow

```
┌─────────┐    AI Processing    ┌─────────┐    User Review    ┌───────────┐
│  DRAFT  │ ─────────────────▶ │ REFINED │ ────────────────▶ │ SUBMITTED │
└─────────┘                     └─────────┘                    └───────────┘
     │                               │                              │
     │                               │                              │
     ▼                               ▼                              ▼
quick-interview.js            report.html                   finalreview.html
(capture + finish)            (edit AI output)              (submit)
```

**Status Values (from `storage-keys.js` line 127):**
- `'draft'` — Initial state, data being captured
- `'pending_refine'` — Queued for AI processing (offline)
- `'refined'` — AI processing complete, ready for review
- `'submitted'` — Final report submitted

**Status Transitions:**
| From | To | Trigger | Location |
|------|-----|---------|----------|
| `draft` | `pending_refine` | Offline finish | `quick-interview.js:1104` |
| `draft` | `refined` | Online AI success | `quick-interview.js:1185` |
| `pending_refine` | `refined` | Draft sync | `drafts.js:307` |
| `refined` | `submitted` | Submit button | `finalreview.js:1084` |

---

## Summary

### Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER CAPTURES DATA                             │
│                         (quick-interview.html)                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        buildProcessPayload()                             │
│  Creates: reportId, projectContext, fieldNotes, weather, photos, etc.   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         callProcessWebhook()                             │
│              POST → n8n webhook (fieldvoice-refine-text-v6.5)           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           n8n WORKFLOW                                   │
│  Webhook → Claude Sonnet (claude-sonnet-4-5) → Respond JSON              │
│  Prompt: Section-aware refinement to DOT-compliant language             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         RESPONSE HANDLING                                │
│  • Saved to Supabase: ai_responses table                                │
│  • Cached to localStorage                                                │
│  • Status updated: draft → refined                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         REPORT DISPLAY                                   │
│  report.html: Edit AI-refined content                                   │
│  finalreview.html: Final review + submit                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Files Reference

| File | Purpose |
|------|---------|
| `js/quick-interview.js` | Main capture flow, AI webhook calls |
| `js/report.js` | Editable report review page |
| `js/finalreview.js` | Read-only final review + submit |
| `js/drafts.js` | Offline draft management + sync |
| `js/storage-keys.js` | Status constants, storage helpers |
| `js/supabase-utils.js` | Database utilities |

### Database Tables

| Table | Purpose |
|-------|---------|
| `reports` | Main report records, status tracking |
| `ai_responses` | AI response payloads |
| `final_reports` | Submitted final versions |
| `raw_capture_results` | Original field notes |
| `report_photos` | Photo attachments |

---

*Audit complete. Report generated automatically.*

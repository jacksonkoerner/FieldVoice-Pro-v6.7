# FieldVoice Pro - Application Workflows

**Last Updated:** January 25, 2026
**Purpose:** Detailed workflow documentation for developers and AI assistants

> This document contains detailed application flow diagrams. For quick reference, see README.md.

---

## Table of Contents

1. [New Report Workflow](#1-new-report-workflow)
2. [Project Configuration Workflow](#2-project-configuration-workflow)
3. [Document Import Workflow](#3-document-import-workflow)
4. [Interview/Documentation Flow](#4-interviewdocumentation-flow)
5. [Voice Input Flow](#5-voice-input-flow)
6. [AI Processing Flow](#6-ai-processing-flow)
7. [Report Generation Flow](#7-report-generation-flow)
8. [Photo Capture Flow](#8-photo-capture-flow)
9. [Report Lifecycle](#9-report-lifecycle)

---

## 1. New Report Workflow

User opens app → project selection → quick-interview

```
[index.html] User opens app
     │
     ├─► First visit? ─► [permissions.html] Setup permissions
     │
     ├─► Check for active project
     │    ├─► No projects? ─► Prompt to create project ─► [project-config.html]
     │    └─► Has project: Show active project card with name/number
     │
     ├─► Check for existing report (from Supabase)
     │    ├─► No report: Show "Begin Daily Report" button
     │    ├─► In progress: Show progress bar, "Continue" button
     │    └─► Completed: Show "View Report" / "Edit" options
     │
     └─► User clicks "Begin Daily Report"
          │
          ├─► Project picker modal appears
          │    ├─► Shows all saved projects (from Supabase)
          │    ├─► Highlights currently active project
          │    └─► "Manage Projects" link to project-config.html
          │
          └─► User selects project ─► [quick-interview.html]
```

**Key Code Locations:**
- Project loading: `index.html` → `loadProjects()`
- Report status check: `index.html` → `checkTodayReport()`
- Project picker modal: `index.html` → `showProjectPicker()`

---

## 2. Project Configuration Workflow

Create/edit projects, contractor roster, equipment inventory

```
[project-config.html] Project Management
     │
     ├─► View saved projects list (from Supabase)
     │    ├─► Active project highlighted with checkmark
     │    └─► Each project shows name, number, location
     │
     ├─► Create new project (Manual Entry)
     │    ├─► Project Details (name, number, location, engineer)
     │    ├─► Contract Information (NTP date, duration, completion)
     │    ├─► Contractor Roster (prime + subcontractors with trades)
     │    └─► Equipment Inventory (per contractor)
     │
     ├─► Create new project (Document Import)
     │    ├─► Drag-and-drop or browse for PDF/DOCX files
     │    ├─► Upload multiple files for extraction
     │    ├─► Auto-populate form fields from extracted data
     │    ├─► Missing fields highlighted with red indicators
     │    ├─► Extraction notes displayed for uncertain values
     │    └─► Review and save extracted project
     │
     ├─► Edit existing project
     │    └─► All fields editable, changes saved to Supabase
     │
     └─► Set active project
          └─► Selected project used for new reports
```

**Key Code Locations:**
- Project list: `project-config.html` → `loadProjects()`
- Save project: `project-config.html` → `saveProject()`
- Set active: `project-config.html` → `setActiveProject()`

---

## 3. Document Import Workflow

PDF/DOCX extraction via n8n webhook

```
[project-config.html] Import from Existing Report
     │
     ├─► User initiates import
     │    ├─► Click "New Project" to open project form
     │    └─► "Import from Existing Report" section at top of form
     │
     ├─► File Selection
     │    ├─► Drag-and-drop files into drop zone
     │    ├─► Or click to browse for files
     │    ├─► Accepts: PDF, DOCX
     │    ├─► Multiple files supported
     │    └─► Selected files displayed with remove option
     │
     ├─► Extraction Process
     │    ├─► Click "Extract Project Data"
     │    ├─► Files converted to base64 and sent to webhook
     │    ├─► Loading spinner during processing
     │    └─► n8n workflow processes documents
     │
     ├─► Results Handling
     │    ├─► Success: Green banner + form auto-populated
     │    │    ├─► Project details filled (name, number, location)
     │    │    ├─► Contract info populated (NTP, duration, dates)
     │    │    ├─► Contractors added to roster
     │    │    ├─► Equipment inventory populated
     │    │    └─► Missing fields marked with red indicators
     │    │
     │    ├─► Extraction Notes (collapsible)
     │    │    └─► Shows any uncertainties or assumptions made
     │    │
     │    └─► Error: Red banner with error message
     │         └─► User can retry or enter data manually
     │
     ├─► User Review
     │    ├─► Review all extracted values
     │    ├─► Fill in any missing fields (red indicators)
     │    ├─► Correct any extraction errors
     │    └─► Add additional contractors/equipment as needed
     │
     └─► Save Project
          └─► Project saved to Supabase and ready for daily reports
```

**Webhook:** `https://advidere.app.n8n.cloud/webhook/fieldvoice-project-extractor`

**Key Code Locations:**
- File handling: `project-config.html` → `handleFileSelect()`
- Extraction: `project-config.html` → `extractProjectData()`
- Populate form: `project-config.html` → `populateFormFromExtraction()`

---

## 4. Interview/Documentation Flow

Quick Notes vs Guided Sections modes

```
[quick-interview.html]
     │
     ├─► Load contractors/equipment from active project (Supabase)
     │
     ├─► Choose capture mode (toggle at top):
     │    │
     │    ├─► "Quick Notes" (Minimal Mode):
     │    │    ├─► Single freeform textarea for dictation-first workflow
     │    │    ├─► Auto-expanding textarea adjusts height as you type
     │    │    └─► Best for fast field notes via voice input
     │    │
     │    └─► "Guided Sections" (Structured Mode):
     │         └─► 5 expandable section cards with structured input
     │
     ├─► Expandable section cards (Guided Mode):
     │    │
     │    ├─► Weather & Site Conditions (data-section="weather")
     │    │    └─► Auto-fetched weather, manual site conditions
     │    │
     │    ├─► Contractor Activities (data-section="activities")
     │    │    ├─► Per-contractor work cards
     │    │    ├─► "No work performed" checkbox
     │    │    ├─► Work narrative textarea (auto-expanding)
     │    │    ├─► "Add Contractor" button for on-the-fly additions
     │    │    ├─► Personnel/Operations (DOT columns)
     │    │    │    ├─► Superintendent(s), Foreman, Operators
     │    │    │    ├─► Laborers, Surveyors, Others
     │    │    │    └─► Auto-calculated totals
     │    │    └─► Equipment Status
     │    │         ├─► Per-equipment status dropdown
     │    │         ├─► IDLE or 1-10 hours utilized
     │    │         ├─► "Mark All IDLE" quick action
     │    │         └─► "Add Equipment" button
     │    │
     │    ├─► Issues & Delays (data-section="issues")
     │    │    └─► QA/QC, Communications, Visitors, Other Remarks
     │    │
     │    ├─► Safety (data-section="safety")
     │    │    └─► Safety observations and incidents
     │    │
     │    └─► Progress Photos (data-section="photos")
     │         └─► Full-size cards with orientation handling
     │
     ├─► Each section supports:
     │    ├─► Text input (manual typing or keyboard dictation)
     │    ├─► Auto-expanding textareas (grow with content, max 60vh)
     │    └─► Real-time preview updates
     │
     └─► User clicks "Finish" ─► AI processes data ─► [report.html]
```

**Key Code Locations:**
- Mode toggle: `quick-interview.html` → `toggleCaptureMode()`
- Section rendering: `quick-interview.html` → `renderSections()`
- Finish handler: `quick-interview.html` → `handleFinish()`

---

## 5. Voice Input Flow

Native keyboard dictation explanation

```
User enters text in any input field
     │
     ├─► User taps microphone button on device keyboard:
     │    ├─► iOS: Uses Siri dictation (Settings → Keyboard → Enable Dictation)
     │    ├─► Android: Uses Google Voice Typing
     │    ├─► Desktop: Uses OS-level dictation if available
     │    └─► Transcribed text appears directly in input field
     │
     └─► Requirements:
          ├─► Microphone permission granted to browser
          ├─► Device dictation feature enabled in OS settings
          └─► Internet connection (for cloud-based transcription)
```

**Note:** The app relies exclusively on native keyboard dictation for voice input, providing consistent, reliable behavior across all platforms without custom microphone buttons.

**iOS Setup:**
1. Settings → General → Keyboard → Enable Dictation
2. Allow Safari to access microphone when prompted

**Android Setup:**
1. Enable Google Voice Typing in keyboard settings
2. Allow browser to access microphone when prompted

---

## 6. AI Processing Flow

Webhook call, response handling, offline queue

```
User clicks "Finish" in quick-interview.html
     │
     ├─► Validation:
     │    ├─► Guided mode: workSummary required, safety must be answered
     │    └─► Minimal mode: freeformNotes required
     │
     ├─► Build payload:
     │    ├─► Field notes (freeform or guided sections)
     │    ├─► Weather data
     │    ├─► Photo metadata
     │    ├─► Project context (name, contractors, etc.)
     │    └─► Report metadata
     │
     ├─► Webhook call to n8n (fieldvoice-refine):
     │    ├─► POST to https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-v6
     │    ├─► n8n workflow processes and returns AI-generated content
     │    └─► Store result in Supabase report_ai_response table
     │
     ├─► AI Processing Rules (enforced by n8n workflow):
     │    ├─► Never invent or add information
     │    ├─► Keep all facts, quantities, names exactly as stated
     │    ├─► Convert informal language to professional tone
     │    ├─► Format for DOT documentation standards
     │    └─► Highlight safety concerns appropriately
     │
     ├─► Offline handling:
     │    ├─► Queue processing request in localStorage
     │    ├─► Set report status to 'pending_refine'
     │    └─► Show retry banner on report.html when online
     │
     └─► Navigate to [report.html]
```

**Key Code Locations:**
- Payload builder: `quick-interview.html` → `buildProcessPayload()`
- Webhook call: `quick-interview.html` → `processWithAI()`
- Offline queue: `quick-interview.html` → `queueForLater()`

---

## 7. Report Generation Flow

report.html data loading, priority system

```
[report.html] Loaded with report data from Supabase
     │
     ├─► Load report data:
     │    ├─► Fetch from reports table by ID
     │    ├─► Join related tables (raw_capture, contractor_work, etc.)
     │    └─► Fetch AI response if available
     │
     ├─► Tab toggle: "Form View" | "Original Notes"
     │
     ├─► Form View (default):
     │    │
     │    ├─► Data priority (highest to lowest):
     │    │    1. userEdits (from report_user_edits)
     │    │    2. aiGenerated (from report_ai_response)
     │    │    3. fieldNotes (from report_raw_capture)
     │    │    4. defaults (empty strings)
     │    │
     │    ├─► Editable DOT-format form fields:
     │    │    ├─► Project overview (read-only from project)
     │    │    ├─► Weather conditions
     │    │    ├─► Work summary sections
     │    │    ├─► Personnel/operations tables
     │    │    ├─► Equipment utilization
     │    │    └─► Issues, safety, communications
     │    │
     │    └─► Changes saved as userEdits to Supabase
     │
     ├─► Original Notes View:
     │    ├─► Shows raw field capture data
     │    ├─► Display mode indicator (minimal vs guided)
     │    └─► Photo thumbnails with original captions
     │
     ├─► Pending refine banner (if offline during processing):
     │    ├─► Shows when status is 'pending_refine'
     │    └─► "Retry Now" button to re-process
     │
     └─► User clicks "Final Review" ─► [finalreview.html]
```

**Key Code Locations:**
- Data loading: `report.html` → `loadReport()`
- Field priority: `report.html` → `getFieldValue()`
- Save edits: `report.html` → `saveEdit()`

---

## 8. Photo Capture Flow

Camera → GPS → compression → storage

```
User taps photo capture (camera icon)
     │
     ├─► Browser requests camera permission (if not granted)
     │
     ├─► User takes photo or selects from library
     │    └─► <input type="file" accept="image/*" capture="environment">
     │
     ├─► Processing pipeline:
     │    │
     │    ├─► 1. Request GPS coordinates (parallel)
     │    │    ├─► Call getHighAccuracyGPS() from media-utils.js
     │    │    ├─► Takes up to 3 readings over ~5 seconds
     │    │    ├─► Returns best accuracy reading
     │    │    └─► Warns if accuracy > 100m
     │    │
     │    ├─► 2. Read file as base64 data URL
     │    │    └─► readFileAsDataURL() from media-utils.js
     │    │
     │    ├─► 3. Compress image
     │    │    ├─► compressImage() from media-utils.js
     │    │    ├─► Default: max 1200px width, 70% JPEG quality
     │    │    ├─► If storage near limit: 800px, 50% quality
     │    │    └─► Logs compression ratio
     │    │
     │    └─► 4. Create photo object
     │         ├─► id: crypto.randomUUID()
     │         ├─► data: compressed base64
     │         ├─► gps: { lat, lng, accuracy }
     │         ├─► timestamp: ISO string
     │         └─► caption: (user-editable)
     │
     ├─► Save to Supabase report_photos table
     │
     └─► Update display with new photo card
```

**Key Code Locations:**
- Photo handler: `quick-interview.html` → `handlePhotoCapture()`
- GPS: `js/media-utils.js` → `getHighAccuracyGPS()`
- Compression: `js/media-utils.js` → `compressImage()`

---

## 9. Report Lifecycle

Status state machine (draft → refined → submitted → finalized)

```
                    ┌─────────────────────────────────────────┐
                    │         REPORT STATUS FLOW              │
                    └─────────────────────────────────────────┘

┌──────────┐    ┌───────────────┐    ┌───────────┐    ┌───────────┐
│  draft   │───►│pending_refine │───►│  refined  │───►│ submitted │
└──────────┘    └───────────────┘    └───────────┘    └───────────┘
     │                  │                  │                │
     │                  │                  │                ▼
     │                  │                  │         ┌───────────┐
     │                  │                  │         │ finalized │
     │                  │                  │         └───────────┘
     │                  │                  │
     ▼                  ▼                  ▼
  Created          AI Processing      Ready for
  in quick-        in progress        final review
  interview


STATUS DEFINITIONS:
──────────────────────────────────────────────────────────────────

draft
  ├─► Created when user starts quick-interview.html
  ├─► Raw capture data being collected
  └─► Stored in: report_raw_capture, report_photos

pending_refine
  ├─► Finish clicked but AI processing pending/failed
  ├─► Offline queue scenario
  └─► Retry button shown in report.html

refined
  ├─► AI processing complete
  ├─► AI response stored in report_ai_response
  └─► Ready for user editing in report.html

submitted
  ├─► User clicked "Submit" in finalreview.html
  ├─► Final content stored in report_final
  └─► Visible in archives.html

finalized
  ├─► Report locked, no further edits
  ├─► PDF export available
  └─► Permanent archive record


PAGE VISIBILITY BY STATUS:
──────────────────────────────────────────────────────────────────

                    │ index │ quick-  │ report │ final  │ archives │
                    │       │interview│        │ review │          │
────────────────────┼───────┼─────────┼────────┼────────┼──────────┤
draft               │ cont. │    ✓    │   -    │   -    │    -     │
pending_refine      │ cont. │    -    │   ✓    │   -    │    -     │
refined             │ edit  │    -    │   ✓    │   ✓    │    -     │
submitted           │ view  │    -    │   ✓    │   ✓    │    ✓     │
finalized           │ view  │    -    │   -    │   ✓    │    ✓     │

cont. = Continue button
edit  = Edit button
view  = View button
```

**Key Code Locations:**
- Status updates: Various pages → Supabase `reports.status` column
- Status checks: `index.html` → `checkTodayReport()`
- Finalization: `finalreview.html` → `submitReport()`

---

## Data Flow Summary

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   index.html    │────►│quick-interview  │────►│   report.html   │
│                 │     │     .html       │     │                 │
│ - Project pick  │     │ - Field capture │     │ - AI content    │
│ - Weather fetch │     │ - Photos        │     │ - User edits    │
│ - Report status │     │ - GPS coords    │     │ - Form view     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  archives.html  │◄────│ finalreview.html│◄────┘                 │
│                 │     │                 │                       │
│ - Report list   │     │ - DOT format    │                       │
│ - View/delete   │     │ - Print/PDF     │                       │
│ - Date filter   │     │ - Submit        │                       │
└─────────────────┘     └─────────────────┘                       │

                        ┌─────────────────┐                       │
                        │  drafts.html    │◄──────────────────────┘
                        │                 │   (if offline/pending)
                        │ - Pending queue │
                        │ - Sync status   │
                        │ - Resume drafts │
                        └─────────────────┘
```

---

## Supabase Tables Used Per Workflow

| Workflow | Tables Written | Tables Read |
|----------|----------------|-------------|
| New Report | reports | projects, reports |
| Project Config | projects | projects |
| Document Import | projects | - |
| Interview | report_raw_capture, report_contractor_work, report_personnel, report_equipment_usage, report_photos | projects |
| AI Processing | report_ai_response, reports (status) | report_raw_capture |
| Report Generation | report_user_edits | reports, report_raw_capture, report_ai_response, report_contractor_work, report_personnel, report_equipment_usage, report_photos |
| Photo Capture | report_photos | - |
| Finalization | report_final, reports (status) | All report tables |

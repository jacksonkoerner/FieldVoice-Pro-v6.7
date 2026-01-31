# Quick Interview Technical Specification

## Overview

`quick-interview.html` is the primary field data capture interface in FieldVoice Pro. It provides construction inspectors with two capture modes for documenting daily activities, which are then sent to an n8n webhook for AI processing.

### Purpose

- Field data capture with two modes: Quick Notes (minimal) and Guided Sections
- Captures weather, work activities, issues, safety, and photos
- Sends data TO n8n for AI processing and refinement

### Storage Backend

- **Supabase Tables**: `reports`, `report_raw_capture`, `report_contractor_work`, `report_personnel`, `report_equipment_usage`, `report_photos`
- **Local Storage**: Device-specific preferences only (`fvp_active_project`)

### Webhook

**Endpoint:** `https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-v6`

### Data Flow

```
User selects capture mode
        │
        ▼
Minimal Mode (Quick Notes)    OR    Guided Mode (Structured Sections)
        │                                   │
        └───────────────┬───────────────────┘
                        │
                        ▼
               Click "Finish"
                        │
                        ▼
        buildProcessPayload() builds request
                        │
                        ▼
        POST to fieldvoice-refine webhook
                        │
                        ▼
             n8n AI processing
                        │
                        ▼
        Response saved to Supabase report_ai_response table
                        │
                        ▼
          Redirect to report.html
```

---

## Capture Modes

### Mode Selection Screen

When a user opens quick-interview.html with no existing data, they see a mode selection screen with two options:

| Mode | ID | Button Handler | Description |
|------|----|----------------|-------------|
| Quick Notes | `minimal` | `selectCaptureMode('minimal')` | Single freeform textarea + photos |
| Guided Sections | `guided` | `selectCaptureMode('guided')` | Structured sections with categories |

### 1. Quick Notes (Minimal Mode)

**UI Container:** `#minimalModeApp`

A streamlined interface with:
- Auto-fetched weather display (read-only)
- Single freeform textarea for all field notes
- Photo capture with GPS and timestamp

**Best for:** Quick dictation of all observations without structure.

### 2. Guided Sections Mode

**UI Container:** `#app`

Expandable section cards for structured input:
1. Weather & Site Conditions
2. Work Summary
3. Issues & Delays
4. Safety
5. Progress Photos

**Best for:** Systematic documentation with category separation.

---

## Input Fields by Section

### Mode Selection Screen

| Field ID | Input Type | Data Captured |
|----------|------------|---------------|
| `modeSelectionProjectName` | Display | Active project name |
| `modeSelectionDate` | Display | Current date formatted |

---

### Minimal Mode Fields

#### Weather Card (Display Only)

| Field ID | Input Type | Data Captured |
|----------|------------|---------------|
| `minimalWeatherIcon` | Icon | Weather condition icon |
| `minimalWeatherCondition` | Display | Weather description (e.g., "Sunny") |
| `minimalWeatherTemp` | Display | Current temperature |
| `minimalWeatherPrecip` | Display | Precipitation amount |

#### Field Notes Section

| Field ID | Input Type | Data Captured |
|----------|------------|---------------|
| `freeform-notes-input` | textarea | Freeform dictated/typed field notes |
| `fieldNotesCharCount` | Display | Character count |

**Handler:** `updateFieldNotes(value)` saves to report via Supabase

#### Photos Section (Minimal)

| Field ID | Input Type | Data Captured |
|----------|------------|---------------|
| `minimalPhotoInput` | file (multiple) | Photo files with GPS |
| `minimalPhotosGrid` | Container | Rendered photo grid |
| `minimalPhotosCount` | Display | Photo count text |

---

### Guided Mode Fields

#### 1. Weather & Site Conditions

**Section Card:** `data-section="weather"`

| Field ID/Class | Input Type | Data Captured |
|----------------|------------|---------------|
| `weather-condition` | Display | Auto-fetched condition (e.g., "Sunny") |
| `weather-temp` | Display | Temperature |
| `weather-precip` | Display | Precipitation |
| `site-conditions-input` | textarea | Manual site conditions description |

**Data Path:** Saved to Supabase `report_raw_capture.site_conditions`

#### 2. Work Summary

**Section Card:** `data-section="activities"`

| Field ID/Class | Input Type | Data Captured |
|----------------|------------|---------------|
| `work-summary-input` | textarea | Consolidated work performed description |

**Handler:** `updateWorkSummary(value)` saves to Supabase `report_raw_capture.work_summary`

**Note:** This is a simplified single-textarea approach. The AI extracts per-contractor details from this summary during processing.

#### 3. Issues & Delays

**Section Card:** `data-section="issues"`

| Field ID/Class | Input Type | Data Captured |
|----------------|------------|---------------|
| `issues-na-btn` | button | Mark as "No Issues - N/A" |
| `issue-input` | textarea | Issue description input |
| `issues-list` | Container | List of added issues |
| Add button | button | `addIssue()` handler |

**Data Path:** Saved to Supabase as part of report data

**Functions:**
- `addIssue()` - Adds issue to array
- `removeIssue(index)` - Removes issue at index
- `markNA('issues')` - Marks section as N/A

#### 4. Safety

**Section Card:** `data-section="safety"`

| Field ID/Class | Input Type | Data Captured |
|----------------|------------|---------------|
| `no-incidents` | checkbox | Boolean: No incidents occurred |
| `has-incidents` | checkbox | Boolean: Incident occurred |
| `safety-input` | textarea | Safety notes/toolbox talks input |
| `safety-list` | Container | List of safety notes |
| Add button | button | `addSafetyNote()` handler |

**Data Paths:** Saved to Supabase as part of report data

**Functions:**
- `addSafetyNote()` - Adds note to array
- `removeSafetyNote(index)` - Removes note at index

#### 5. Contractor Work

**Section Card:** `data-section="contractor-work"`

| Field ID/Class | Input Type | Data Captured |
|----------------|------------|---------------|
| `contractor-work-list` | Container | Rendered contractor work cards |
| Add Contractor button | button | `showAddContractorModal()` handler |

**Per-Contractor Card Fields:**
| Field ID Pattern | Input Type | Data Captured |
|------------------|------------|---------------|
| `noWork-{contractorId}` | checkbox | "No work performed" flag |
| `narrative-{contractorId}` | textarea | Work narrative description |

**Data Path:** Saved to Supabase `report_contractor_work` table

**Functions:**
- `renderContractorWorkCards()` - Renders contractor cards from active project
- `showAddContractorModal()` - Opens add contractor modal
- `saveNewContractor()` - Saves new contractor to project and report

#### 6. Equipment

**Section Card:** `data-section="equipment"`

| Field ID/Class | Input Type | Data Captured |
|----------------|------------|---------------|
| `equipment-totals` | Display | Active/Idle equipment counts |
| `equipment-warnings` | Display | Warning messages |
| `equipment-list` | Container | Rendered equipment cards |
| Add Equipment button | button | `showAddEquipmentModal()` handler |
| Mark All IDLE button | button | `markAllEquipmentIdle()` handler |

**Per-Equipment Card Fields:**
| Field ID Pattern | Input Type | Data Captured |
|------------------|------------|---------------|
| `equip-status-{equipmentId}` | select | Hours utilized (IDLE or 1-10 hours) |
| `equip-qty-{equipmentId}` | number | Equipment quantity |

**Data Path:** Saved to Supabase `report_equipment_usage` table

**Functions:**
- `renderEquipmentCards()` - Renders equipment cards from active project
- `showAddEquipmentModal()` - Opens add equipment modal
- `saveNewEquipment()` - Saves new equipment to project config AND report
- `markAllEquipmentIdle()` - Sets all equipment to IDLE status

#### 7. Progress Photos

**Section Card:** `data-section="photos"`

| Field ID/Class | Input Type | Data Captured |
|----------------|------------|---------------|
| `photos-na-btn` | button | Mark as "No Photos - N/A" |
| `photoInput` | file (multiple) | Photo files with `capture="environment"` |
| `photos-grid` | Container | 2-column photo grid |

**Photo Object Structure:**
```javascript
{
    id: "photo_1705329600000_0",
    url: "data:image/jpeg;base64,...",  // Compressed image
    caption: "",                         // User-entered caption
    timestamp: "2024-01-15T10:30:00.000Z",
    date: "1/15/2024",
    time: "10:30:00 AM",
    gps: {
        lat: 29.9511,
        lng: -90.0715,
        accuracy: 10  // meters
    },
    fileName: "IMG_1234.jpg",
    fileSize: 2048000,
    fileType: "image/jpeg"
}
```

**Photo Processing:**
1. Validates file type (must be image/*)
2. Validates file size (max 20MB)
3. Captures GPS coordinates via `navigator.geolocation`
4. Reads file as DataURL
5. Compresses image (max 1200px width, 70% quality)
6. If storage low, re-compresses (max 800px width, 50% quality)
7. Captures timestamp at upload time
8. Saves to Supabase `report_photos` table

---

## Modal Dialogs

### Add Contractor Modal

**Container ID:** `addContractorModal`

Allows users to add new contractors during the interview process. New contractors are saved to the active project in Supabase.

| Field ID | Input Type | Required | Validation |
|----------|------------|----------|------------|
| `newContractorName` | text | Yes | Non-empty |
| `newContractorAbbr` | text | Yes | Max 10 chars, auto-uppercase |
| `newContractorType` | select | Yes | "prime" or "subcontractor" |
| `newContractorTrades` | text | No | Semicolon-separated trades |

**Functions:**
- `showAddContractorModal()` - Shows modal, populates contractor dropdown
- `hideAddContractorModal()` - Hides modal, clears form
- `saveNewContractor()` - Validates, saves to project, updates UI

**Save Behavior:**
1. Generates unique ID: `contractor_{timestamp}_{random}`
2. Adds contractor to `activeProject.contractors[]`
3. Updates project in Supabase `projects` table
4. Initializes empty activity object in `report_contractor_work`
5. Initializes empty operations object in `report_personnel`
6. Re-renders Contractor Work, Personnel, and Equipment sections
7. Shows success toast notification

### Add Equipment Modal

**Container ID:** `addEquipmentModal`

Allows users to add new equipment during the interview process. Equipment is saved to BOTH the project config (for future reports) AND the current report.

| Field ID | Input Type | Required | Validation |
|----------|------------|----------|------------|
| `newEquipContractor` | select | Yes | Valid contractor ID |
| `newEquipType` | text | Yes | Non-empty |
| `newEquipModel` | text | No | Optional model number |
| `newEquipQty` | number | Yes | Min 1 |

**Functions:**
- `showAddEquipmentModal()` - Shows modal, populates contractor dropdown
- `hideAddEquipmentModal()` - Hides modal, clears form
- `saveNewEquipment()` - Validates, saves to project and report, updates UI

**Save Behavior:**
1. Generates unique ID: `equip_{timestamp}_{random}`
2. **Duplicate Detection:** Checks if same type/model/contractor exists in project
3. If not duplicate, adds to `activeProject.equipment[]`
4. Updates project in Supabase `projects` table
5. Adds equipment entry to `report_equipment_usage` table with quantity and null hours
6. Re-renders Equipment section
7. Shows success toast (includes "already in project config" note if duplicate)

**Duplicate Detection Logic:**
```javascript
const isDuplicate = existingEquipment.some(e =>
    e.contractorId === contractorId &&
    e.type.toLowerCase() === type.toLowerCase() &&
    (e.model || '').toLowerCase() === model.toLowerCase()
);
```

---

## Supabase Storage

### Reports Table

```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  report_date DATE NOT NULL,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Report Raw Capture Table

```sql
CREATE TABLE report_raw_capture (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id),
  transcript TEXT,
  guided_notes JSONB,
  site_conditions TEXT,
  work_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Report Contractor Work Table

```sql
CREATE TABLE report_contractor_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id),
  contractor_id UUID,
  contractor_name TEXT,
  no_work BOOLEAN DEFAULT false,
  narrative TEXT,
  equipment_used TEXT,
  crew TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Report Personnel Table

```sql
CREATE TABLE report_personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id),
  contractor_id UUID,
  contractor_name TEXT,
  superintendents INTEGER DEFAULT 0,
  foremen INTEGER DEFAULT 0,
  operators INTEGER DEFAULT 0,
  laborers INTEGER DEFAULT 0,
  surveyors INTEGER DEFAULT 0,
  others INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Report Equipment Usage Table

```sql
CREATE TABLE report_equipment_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id),
  equipment_id UUID,
  equipment_type TEXT,
  equipment_model TEXT,
  contractor_id UUID,
  contractor_name TEXT,
  hours_utilized INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Report Photos Table

```sql
CREATE TABLE report_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id),
  photo_data TEXT,
  caption TEXT,
  gps_lat NUMERIC,
  gps_lng NUMERIC,
  gps_accuracy INTEGER,
  timestamp TIMESTAMPTZ,
  original_filename TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Local Storage Keys (Device-Specific)

| Key | Description |
|-----|-------------|
| `fvp_active_project` | Active project ID |
| `fvp_mic_granted` | Microphone permission status |
| `fvp_loc_granted` | Location permission status |
| `fvp_dictation_hint_dismissed` | Hint banner dismissed flag |
| `permissions_dismissed` | Permissions modal dismissed flag |

---

## Webhook Request Payload

The `buildProcessPayload()` function constructs the payload sent to n8n:

```json
{
  "reportId": "uuid-from-supabase",
  "captureMode": "minimal" | "guided",

  "projectContext": {
    "projectId": "uuid-string",
    "projectName": "Highway 61 Reconstruction",
    "noabProjectNo": "1291",
    "location": "New Orleans, LA",
    "engineer": "Engineering Firm Inc",
    "primeContractor": "ABC Construction",
    "contractors": [
      {
        "id": "contractor-uuid",
        "name": "ABC Construction",
        "type": "prime",
        "trades": "General"
      },
      {
        "id": "contractor-uuid-2",
        "name": "XYZ Electrical",
        "type": "sub",
        "trades": "Electrical"
      }
    ],
    "equipment": [
      {
        "id": "equipment-uuid",
        "type": "Excavator",
        "model": "CAT 320",
        "contractorId": "contractor-uuid"
      }
    ]
  },

  "fieldNotes": {
    // For MINIMAL mode:
    "freeformNotes": "Full dictated field notes..."

    // For GUIDED mode:
    "workSummary": "Work summary from guided input...",
    "issues": "Issues joined with newlines...",
    "safety": "No incidents reported" | "INCIDENT REPORTED: ..."
  },

  "weather": {
    "highTemp": "85",
    "lowTemp": "72",
    "precipitation": "0.00\"",
    "generalCondition": "Sunny",
    "jobSiteCondition": "Dry",
    "adverseConditions": "N/A"
  },

  "photos": [
    {
      "id": "photo_1705329600000_0",
      "caption": "Foundation pour in progress",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "date": "1/15/2024",
      "time": "10:30 AM",
      "gps": {
        "lat": 29.9511,
        "lng": -90.0715,
        "accuracy": 10
      }
    }
  ],

  "reportDate": "1/15/2024",
  "inspectorName": "John Smith"
}
```

### Payload Field Details

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `reportId` | string | Supabase report ID | UUID from reports table |
| `captureMode` | string | Report metadata | "minimal" or "guided" |
| `projectContext` | object | Active project config | From Supabase `projects` table |
| `fieldNotes` | object | Varies by mode | See below |
| `weather` | object | Report weather data | Auto-fetched + manual input |
| `photos` | array | Report photos | Photo URLs excluded (only metadata) |
| `reportDate` | string | Report date | Formatted date |
| `inspectorName` | string | User profile | From Supabase `user_profiles` table |

### fieldNotes by Capture Mode

**Minimal Mode (`captureMode: "minimal"`):**
```json
{
  "freeformNotes": "Everything dictated in single textarea..."
}
```

**Guided Mode (`captureMode: "guided"`):**
```json
{
  "workSummary": "From work-summary-input textarea",
  "issues": "generalIssues array joined with \\n",
  "safety": "No incidents reported" | "INCIDENT REPORTED: [notes joined with ;]"
}
```

---

## Expected n8n Response

The webhook should return a JSON response with this structure:

```json
{
  "success": true,
  "aiGenerated": {
    "activities": [
      {
        "contractorId": "contractor-uuid",
        "noWork": false,
        "narrative": "Performed excavation work on Section A. Completed 200 LF of trench excavation.",
        "equipmentUsed": "Excavator (1), Dump Truck (2)",
        "crew": "Foreman (1), Laborers (4)"
      }
    ],

    "operations": [
      {
        "contractorId": "contractor-uuid",
        "superintendents": 1,
        "foremen": 2,
        "operators": 3,
        "laborers": 8,
        "surveyors": 0,
        "others": 0
      }
    ],

    "equipment": [
      {
        "contractorId": "contractor-uuid",
        "equipmentId": "equipment-uuid",
        "type": "CAT 320 Excavator",
        "qty": 1,
        "quantity": 1,
        "status": "8 hrs",
        "hoursUsed": 8
      }
    ],

    "generalIssues": [
      "Delay due to material delivery - concrete truck arrived 2 hours late",
      "RFI #45 pending response from engineer"
    ],

    "qaqcNotes": [
      "Concrete cylinder samples taken at 10:00 AM",
      "Compaction testing passed - 98% density achieved"
    ],

    "safety": {
      "hasIncidents": false,
      "noIncidents": true,
      "notes": "Toolbox talk on heat safety conducted at 7:00 AM"
    },

    "contractorCommunications": "Discussed schedule adjustment with prime contractor. Agreed to extend work hours Thursday to make up for weather delay.",

    "visitorsRemarks": "City inspector visited at 10:00 AM - approved foundation pour. Material delivery from ABC Supply at 2:00 PM."
  }
}
```

### Response Field Types

| Field | Type | Notes |
|-------|------|-------|
| `success` | boolean | Request success indicator |
| `aiGenerated` | object | Container for all AI-processed data |
| `activities` | array | One object per contractor |
| `operations` | array | One object per contractor |
| `equipment` | array | One object per equipment item |
| `generalIssues` | array or string | If array, joined with `\n` for display |
| `qaqcNotes` | array or string | If array, joined with `\n` for display |
| `safety` | object | Safety status with notes |
| `safety.notes` | string or array | If array, joined with `\n` |
| `contractorCommunications` | string | Direct display |
| `visitorsRemarks` | string | Direct display |

### Response Validation

The `callProcessWebhook()` function validates the response:

1. Checks for `data.success` or `data.aiGenerated`
2. If `aiGenerated` is a string, attempts to parse as JSON
3. Ensures required arrays exist with defaults:
   - `activities: []`
   - `operations: []`
   - `equipment: []`
   - `generalIssues: []`
   - `qaqcNotes: []`
   - `safety: { hasIncidents: false, noIncidents: true, notes: '' }`

### Response Storage

AI response is saved to Supabase `report_ai_response` table:

```sql
INSERT INTO report_ai_response (
  report_id,
  ai_generated_content,
  model_used,
  processing_time_ms,
  received_at
) VALUES (
  'report-uuid',
  '{"activities": [...], ...}',
  'n8n-fieldvoice-refine',
  1234,
  NOW()
);
```

---

## Status Flow

| Status | Description | UI Behavior |
|--------|-------------|-------------|
| `draft` | Fresh or in-progress report | Mode selection or capture UI shown |
| `pending_refine` | Offline or webhook failed | Queued for retry |
| `refined` | AI processing complete | Ready for report.html |

### Offline Handling

When offline or webhook fails:
1. Report saved to Supabase with status `pending_refine`
2. Toast: "You're offline - AI processing will complete when connected"
3. User redirected to report.html
4. Retry banner shown when online

---

## Error Handling

### Network Errors
- Toast notification for connection failures
- Data saved locally as fallback
- Retry option when connection restored

### Validation Errors
- Required fields highlighted in red
- Toast message explaining what's missing
- Form submission blocked until resolved

### Supabase Errors
- Logged to console
- User-friendly toast message
- Graceful degradation when possible

### Photo Processing Errors
- File type validation
- Size limit enforcement (20MB max)
- Compression fallback for large images
- GPS unavailable handling

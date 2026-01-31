# Project Configuration Page - Technical Specification

## Overview

**File:** `project-config.html`
**Purpose:** Project configuration and document import for FieldVoice Pro. This page allows users to create, edit, and manage construction projects with associated contractors and equipment. It also supports automatic data extraction from existing RPR Daily Reports via webhook integration.

**Storage Backend:** Supabase (`projects` table)
**Webhook:** `fieldvoice-project-extractor`
**Webhook URL:** `https://advidere.app.n8n.cloud/webhook/fieldvoice-project-extractor`

---

## Form Fields Reference

### Project Details

| Field ID | Label | Data Type | Required | Notes |
|----------|-------|-----------|----------|-------|
| `projectName` | Project Name | text | Yes | e.g., "I-10 Bridge Reconstruction" |
| `noabProjectNo` | NOAB Project No. | text | No | e.g., "1291" |
| `cnoSolicitationNo` | CNO Solicitation No. | text | No | Default value: "N/A" |
| `location` | Location | text | No | e.g., "Jefferson Highway at Mississippi River" |
| `engineer` | Engineer (Firm) | text | No | e.g., "AECOM" |
| `primeContractor` | Prime Contractor Name | text | No | e.g., "Boh Bros Construction" |
| `logoInput` | Project Logo | file | No | Accepts PNG, JPG, SVG, GIF. Stored as base64 in `logo` property |

### Contract Information

| Field ID | Label | Data Type | Required | Notes |
|----------|-------|-----------|----------|-------|
| `noticeToProceed` | Notice to Proceed Date | date | No | Contract start date |
| `reportDate` | Report Date (Sample) | date | No | Sample date for reports |
| `contractDuration` | Duration (Days) | number | No | e.g., 467 |
| `weatherDays` | Weather Days | number | No | Default: 0, Min: 0 |
| `contractDayNo` | Contract Day # | number | No | Current contract day number |
| `expectedCompletion` | Expected Completion Date | date | No | Calculated based on duration |
| `defaultStartTime` | Default Start Time | time | No | Default: "06:00" |
| `defaultEndTime` | Default End Time | time | No | Default: "16:00" |

### Contractor Roster (Dynamic Rows)

| Field ID | Label | Data Type | Required | Notes |
|----------|-------|-----------|----------|-------|
| `contractorName` | Full Name | text | Yes | e.g., "Boh Bros Construction" |
| `contractorAbbr` | Abbreviation | text | Yes | Max 10 chars, auto-uppercased, e.g., "BOH" |
| `contractorType` | Type | select | Yes | Options: "prime", "subcontractor" |
| `contractorTrades` | Trades | text | No | Semicolon-separated, e.g., "Pile Driving; Utilities; Concrete Pvmt" |

### Equipment Inventory (Dynamic Rows)

| Field ID | Label | Data Type | Required | Notes |
|----------|-------|-----------|----------|-------|
| `equipmentContractor` | Contractor | select | Yes | Populated from contractor roster |
| `equipmentType` | Equipment Type | text | Yes | e.g., "Bulldozer" |
| `equipmentModel` | Model # | text | No | e.g., "John Deere 700K" |

---

## Document Import Flow

1. **File Selection:** User uploads PDF/DOCX files via drag-and-drop or file browser
2. **Validation:** Files are validated for acceptable extensions (`.pdf`, `.docx`)
3. **Duplicate Check:** System checks for duplicate files by name and size
4. **File List Display:** Selected files are displayed with name, size, and remove option
5. **Extraction Trigger:** User clicks "Extract Project Data" button
6. **Webhook Request:** Files are sent to n8n webhook as FormData
7. **Response Processing:** Webhook response populates form fields automatically
8. **User Review:** User reviews extracted data and fills in any missing fields
9. **Save:** User saves the project to Supabase

---

## Webhook Request Payload

The request is sent as `multipart/form-data` with files attached.

**HTTP Method:** `POST`
**Content-Type:** `multipart/form-data`

```
POST /webhook/fieldvoice-project-extractor
Content-Type: multipart/form-data; boundary=----FormBoundary

------FormBoundary
Content-Disposition: form-data; name="documents"; filename="report1.pdf"
Content-Type: application/pdf

[Binary PDF content]
------FormBoundary
Content-Disposition: form-data; name="documents"; filename="report2.docx"
Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document

[Binary DOCX content]
------FormBoundary--
```

**FormData Structure:**
| Field Name | Type | Description |
|------------|------|-------------|
| `documents` | File[] | One or more PDF/DOCX files (multiple files use same field name) |

---

## Expected Webhook Response

The n8n webhook should return a JSON response with the following structure:

### Success Response

```json
{
  "success": true,
  "data": {
    "projectName": "I-10 Bridge Reconstruction",
    "noabProjectNo": "1291",
    "cnoSolicitationNo": "N/A",
    "location": "Jefferson Highway at Mississippi River",
    "engineer": "AECOM",
    "primeContractor": "Boh Bros Construction",
    "noticeToProceed": "2024-01-15",
    "reportDate": "2024-02-03",
    "contractDuration": 467,
    "expectedCompletion": "2025-04-27",
    "defaultStartTime": "06:00",
    "defaultEndTime": "16:00",
    "weatherDays": 5,
    "contractDayNo": 19,
    "contractors": [
      {
        "name": "Boh Bros Construction",
        "abbreviation": "BOH",
        "type": "prime",
        "trades": "General Construction; Pile Driving"
      },
      {
        "name": "Delta Electric",
        "abbreviation": "DEL",
        "type": "subcontractor",
        "trades": "Electrical"
      }
    ],
    "equipment": [
      {
        "type": "Crane",
        "model": "Liebherr LTM 1300",
        "contractorName": "Boh Bros Construction"
      },
      {
        "type": "Excavator",
        "model": "CAT 320",
        "contractorName": "Boh Bros Construction"
      }
    ]
  },
  "extractionNotes": [
    "Project number extracted from header - please verify",
    "Weather days not found in document - defaulted to 0",
    "Equipment models may be incomplete"
  ]
}
```

### Error Response

```json
{
  "success": false,
  "error": "Unable to parse document. File may be corrupted or password protected."
}
```

### Response Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | boolean | Yes | Indicates if extraction was successful |
| `data` | object | If success=true | Container for all extracted project data |
| `data.projectName` | string | No | Extracted project name |
| `data.noabProjectNo` | string | No | NOAB project number |
| `data.cnoSolicitationNo` | string | No | CNO solicitation number |
| `data.location` | string | No | Project location |
| `data.engineer` | string | No | Engineering firm name |
| `data.primeContractor` | string | No | Prime contractor name |
| `data.noticeToProceed` | string | No | Date in YYYY-MM-DD format |
| `data.reportDate` | string | No | Date in YYYY-MM-DD format |
| `data.contractDuration` | number | No | Duration in days |
| `data.expectedCompletion` | string | No | Date in YYYY-MM-DD format |
| `data.defaultStartTime` | string | No | Time in HH:MM format (24-hour) |
| `data.defaultEndTime` | string | No | Time in HH:MM format (24-hour) |
| `data.weatherDays` | number | No | Number of weather days |
| `data.contractDayNo` | number | No | Current contract day number |
| `data.contractors` | array | No | Array of contractor objects |
| `data.equipment` | array | No | Array of equipment objects |
| `extractionNotes` | string[] | No | Array of notes about extraction uncertainties |
| `error` | string | If success=false | Error message describing the failure |

### Contractor Object Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Full contractor name |
| `abbreviation` | string | No | Short code (auto-generated if missing) |
| `type` | string | No | "prime" or "subcontractor" (defaults to "subcontractor") |
| `trades` | string | No | Semicolon-separated list of trades |

### Equipment Object Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Equipment type (e.g., "Crane", "Excavator") |
| `model` | string | No | Model number or name |
| `contractorName` | string | Yes | Name of contractor (used for matching to contractor roster) |

---

## Field Mapping: Response to Form

| Webhook Response Field | Form Field ID | Auto-populated? | Notes |
|------------------------|---------------|-----------------|-------|
| `data.projectName` | `projectName` | Yes | Marked as missing if null/empty |
| `data.noabProjectNo` | `noabProjectNo` | Yes | Marked as missing if null/empty |
| `data.cnoSolicitationNo` | `cnoSolicitationNo` | Yes | Marked as missing if null/empty |
| `data.location` | `location` | Yes | Marked as missing if null/empty |
| `data.engineer` | `engineer` | Yes | Marked as missing if null/empty |
| `data.primeContractor` | `primeContractor` | Yes | Marked as missing if null/empty |
| `data.noticeToProceed` | `noticeToProceed` | Yes | Expects YYYY-MM-DD format |
| `data.reportDate` | `reportDate` | Yes | Expects YYYY-MM-DD format |
| `data.contractDuration` | `contractDuration` | Yes | Parsed as integer |
| `data.expectedCompletion` | `expectedCompletion` | Yes | Expects YYYY-MM-DD format |
| `data.defaultStartTime` | `defaultStartTime` | Yes | Expects HH:MM format |
| `data.defaultEndTime` | `defaultEndTime` | Yes | Expects HH:MM format |
| `data.weatherDays` | `weatherDays` | Yes | Parsed as integer |
| `data.contractDayNo` | `contractDayNo` | Yes | Parsed as integer |
| `data.contractors[]` | Contractor Roster | Yes | Rendered as dynamic list |
| `data.equipment[]` | Equipment Inventory | Yes | Matched to contractors by name |
| `extractionNotes[]` | Extraction Notes Section | Yes | Displayed as collapsible list |

### Missing Field Handling

When a field value is `null`, `undefined`, or empty string:
- Field input receives `.missing-field` CSS class (red border, light red background)
- "Missing - please fill in" indicator displayed below field
- Indicator automatically removed when user enters a value

---

## Supabase Storage

### Projects Table Schema

Projects are stored in the Supabase `projects` table with the following structure:

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name TEXT NOT NULL,
  noab_project_no TEXT,
  cno_solicitation_no TEXT DEFAULT 'N/A',
  location TEXT,
  engineer TEXT,
  prime_contractor TEXT,
  notice_to_proceed DATE,
  contract_duration INTEGER,
  weather_days INTEGER DEFAULT 0,
  expected_completion DATE,
  default_start_time TIME DEFAULT '06:00',
  default_end_time TIME DEFAULT '16:00',
  logo TEXT,
  contractors JSONB DEFAULT '[]',
  equipment JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Project Object Schema (JSONB)

```json
{
  "id": "uuid-from-supabase",
  "project_name": "I-10 Bridge Reconstruction",
  "logo": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "noab_project_no": "1291",
  "cno_solicitation_no": "N/A",
  "location": "Jefferson Highway at Mississippi River",
  "engineer": "AECOM",
  "prime_contractor": "Boh Bros Construction",
  "notice_to_proceed": "2024-01-15",
  "contract_duration": 467,
  "expected_completion": "2025-04-27",
  "default_start_time": "06:00",
  "default_end_time": "16:00",
  "weather_days": 5,
  "contractors": [
    {
      "id": "contractor_1706123456790",
      "name": "Boh Bros Construction",
      "abbreviation": "BOH",
      "type": "prime",
      "trades": "General Construction; Pile Driving"
    },
    {
      "id": "contractor_1706123456791",
      "name": "Delta Electric",
      "abbreviation": "DEL",
      "type": "subcontractor",
      "trades": "Electrical"
    }
  ],
  "equipment": [
    {
      "id": "equip_1706123456792",
      "contractorId": "contractor_1706123456790",
      "type": "Crane",
      "model": "Liebherr LTM 1300"
    },
    {
      "id": "equip_1706123456793",
      "contractorId": "contractor_1706123456790",
      "type": "Excavator",
      "model": "CAT 320"
    }
  ],
  "status": "active",
  "created_at": "2024-01-15T08:00:00.000Z",
  "updated_at": "2024-01-15T08:00:00.000Z"
}
```

### Contractor Object (in contractors JSONB array)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Format: `contractor_{timestamp}` |
| `name` | string | Full contractor name |
| `abbreviation` | string | Short code (max 10 chars) |
| `type` | string | "prime" or "subcontractor" |
| `trades` | string | Semicolon-separated trades |

### Equipment Object (in equipment JSONB array)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Format: `equip_{timestamp}` |
| `contractorId` | string | References contractor.id |
| `type` | string | Equipment type |
| `model` | string | Model number/name |

### Local Storage (Device-Specific)

| Key | Type | Description |
|-----|------|-------------|
| `fvp_active_project` | string | ID of the currently active project on this device |

---

## Supabase Operations

### Load Projects

```javascript
async function loadProjects() {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'active')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error loading projects:', error);
        return [];
    }
    return data;
}
```

### Save Project

```javascript
async function saveProject(project) {
    const { data, error } = await supabase
        .from('projects')
        .upsert(project)
        .select()
        .single();

    if (error) {
        console.error('Error saving project:', error);
        throw error;
    }
    return data;
}
```

### Delete Project

```javascript
async function deleteProject(projectId) {
    const { error } = await supabase
        .from('projects')
        .update({ status: 'archived' })
        .eq('id', projectId);

    if (error) {
        console.error('Error deleting project:', error);
        throw error;
    }
}
```

---

## UI Components

### Saved Projects List
- Displays all projects from Supabase
- Shows active project indicator (green border)
- Edit and delete buttons for each project

### Project Form Container
- Hidden by default until project is loaded/created
- Active project badge shown when editing active project

### Import Section
- Drag-and-drop zone for file uploads
- File list with remove capability
- Extract button triggers webhook call
- Success/error banners for feedback
- Collapsible extraction notes section

### Contractor Roster
- Draggable rows for reordering
- Prime contractors sorted to top
- Add/Edit/Delete functionality
- Inline display of type and trades

### Equipment Inventory
- Grouped by contractor
- Requires at least one contractor before adding
- Add/Edit/Delete functionality

### Delete Confirmation Modal
- Generic modal for all delete operations
- Customizable message per operation

---

## Error Handling

### Network Errors
- Toast notification for connection failures
- Retry button for failed operations
- Offline banner when disconnected

### Validation Errors
- Red border on invalid fields
- Error message below field
- Form submission blocked until resolved

### Supabase Errors
- Logged to console
- User-friendly toast message
- Graceful degradation when possible

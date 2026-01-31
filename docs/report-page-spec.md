# Report Page Technical Specification

## Overview

`report.html` is the Daily Report viewer and editor in FieldVoice Pro. It displays and allows editing of construction daily reports that combine field-captured data with AI-generated content from the n8n webhook.

### Storage Backend

- **Supabase Tables**: `reports`, `report_ai_response`, `report_user_edits`, `report_contractor_work`, `report_personnel`, `report_equipment_usage`, `report_photos`
- **Local Storage**: Device-specific preferences only

### Data Flow

```
quick-interview.html (field capture)
         │
         ▼
    Field Notes + Photos + Weather
         │
         ▼
n8n webhook (POST to fieldvoice-refine)
         │
         ▼
    AI Processing
         │
         ▼
   aiGenerated payload saved to Supabase
         │
         ▼
report.html (display + edit)
```

The webhook endpoint: `https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-v6`

---

## Data Priority

The `getValue()` function implements a priority system for resolving field values:

```
1. userEdits        (highest priority - user has manually edited)
2. aiGenerated      (AI-processed content from webhook)
3. fieldNotes/guidedNotes (raw field capture data)
4. defaults         (project config or hardcoded defaults)
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `getValue(path, default)` | Generic value resolver with full priority chain |
| `getTextFieldValue(reportPath, aiPath, default)` | Text fields with AI path mapping |
| `getContractorActivity(contractorId)` | Per-contractor work activity data |
| `getContractorOperations(contractorId)` | Per-contractor personnel counts |
| `getEquipmentData()` | Equipment list with AI fallback |
| `getNestedValue(obj, path)` | Dot-notation path accessor |
| `calculateShiftDuration()` | Auto-calculate shift duration from start/end times |
| `detectFieldMismatches()` | Detect AI response field mapping issues |
| `initializeDebugPanel()` | Initialize debug panel with current report data |

### User Edit Tracking

When a user modifies a field, the value is stored in Supabase `report_user_edits` table and the field receives the `user-edited` CSS class (yellow background). User edits persist across page loads and always override AI-generated values.

---

## Form Fields Reference

### Project Overview Section

The Project Overview section uses a DOT RPR Daily Report style 2-column grid layout.

#### Project Logo

| Element ID | Description |
|------------|-------------|
| `projectLogoContainer` | Container div (hidden if no logo) |
| `projectLogo` | `<img>` element displaying project logo from `activeProject.logo` |

#### Left Column Fields

| Field ID | Label | Data Path | Type | Source |
|----------|-------|-----------|------|--------|
| `projectName` | Project Name | `overview.projectName` | text | Project config / editable |
| `noabProjectNo` | NOAB Project No. | `overview.noabProjectNo` | text | Project config / editable |
| `cnoSolicitationNo` | CNO Solicitation No. | `overview.cnoSolicitationNo` | text | Default: "N/A" |
| `noticeToProceed` | Notice to Proceed | - | date | Project config (readonly, `bg-slate-50`) |
| `contractDuration` | Contract Duration | - | text | Project config (readonly, `bg-slate-50`) |
| `expectedCompletion` | Expected Completion | - | date | Project config (readonly, `bg-slate-50`) |
| `contractDay` | Contract Day # | `overview.contractDay` | text | Format: "Day X of Y" |
| `weatherDaysCount` | Weather Days | `overview.weatherDays` | number | Editable |

#### Right Column Fields

| Field ID | Label | Data Path | Type | Source |
|----------|-------|-----------|------|--------|
| `reportDate` | Date | `overview.date` | date | Report date |
| `projectLocation` | Location | `overview.location` | text | Project config / editable |
| `engineer` | Engineer | `overview.engineer` | text | Project config / editable |
| `contractor` | Contractor | `overview.contractor` | text | Project config / editable |
| `startTime` | Start Time | `overview.startTime` | time | Default from project config |
| `endTime` | End Time | `overview.endTime` | time | Default from project config |
| `shiftDuration` | Shift Duration | - | text | Auto-calculated via `calculateShiftDuration()` (readonly, `bg-slate-50`) |
| `completedBy` | Completed By | `overview.completedBy` | text | Inspector name |

### Weather Block

| Field ID | Label | Data Path | Type | Source |
|----------|-------|-----------|------|--------|
| `weatherHigh` | High Temp | `overview.weather.highTemp` | text | Field capture / editable |
| `weatherLow` | Low Temp | `overview.weather.lowTemp` | text | Field capture / editable |
| `weatherPrecip` | Precipitation | `overview.weather.precipitation` | text | Field capture / editable |
| `weatherCondition` | Condition | `overview.weather.generalCondition` | text | Field capture / editable |
| `weatherJobSite` | Job Site | `overview.weather.jobSiteCondition` | select | Options: Dry, Wet, Muddy, Frozen |
| `weatherAdverse` | Adverse Conditions | `overview.weather.adverseConditions` | text | Field capture / editable |

### Work Summary Section (Per-Contractor)

Dynamic cards rendered for each contractor in `projectContractors`. Each card contains:

| Field Class | Data Attribute | Data Path | Type | Notes |
|-------------|----------------|-----------|------|-------|
| `.no-work-checkbox` | `data-contractor-id` | `activity_[id].noWork` | checkbox | Toggle work performed |
| `.contractor-narrative` | `data-contractor-id` | `activity_[id].narrative` | textarea | Work description |
| `.contractor-equipment` | `data-contractor-id` | `activity_[id].equipmentUsed` | text | Equipment summary |
| `.contractor-crew` | `data-contractor-id` | `activity_[id].crew` | text | Crew summary |

### Personnel Table (Per-Contractor Row)

| Field Class | Data Attribute | Data Path | Type |
|-------------|----------------|-----------|------|
| `.personnel-input[data-field="superintendents"]` | `data-contractor-id` | `operations_[id].superintendents` | number |
| `.personnel-input[data-field="foremen"]` | `data-contractor-id` | `operations_[id].foremen` | number |
| `.personnel-input[data-field="operators"]` | `data-contractor-id` | `operations_[id].operators` | number |
| `.personnel-input[data-field="laborers"]` | `data-contractor-id` | `operations_[id].laborers` | number |
| `.personnel-input[data-field="surveyors"]` | `data-contractor-id` | `operations_[id].surveyors` | number |
| `.personnel-input[data-field="others"]` | `data-contractor-id` | `operations_[id].others` | number |

**Totals Row IDs:** `totalSuper`, `totalForeman`, `totalOperators`, `totalLaborers`, `totalSurveyors`, `totalOthers`, `totalAll`

### Equipment Table

| Field Class | Data Attribute | Description |
|-------------|----------------|-------------|
| `.equipment-contractor` | `data-equipment-index` | Contractor select dropdown |
| `.equipment-type` | `data-equipment-index` | Equipment type/model text |
| `.equipment-qty` | `data-equipment-index` | Quantity number |
| `.equipment-status` | `data-equipment-index` | Status select (IDLE or 1-10 hrs) |

### Text Sections

| Field ID | Label | Report Path | AI Path | Type |
|----------|-------|-------------|---------|------|
| `issuesText` | Issues, Delays & RFIs | `issues` | `generalIssues` | textarea |
| `qaqcText` | QA/QC Testing & Inspections | `qaqc` | `qaqcNotes` | textarea |
| `safetyText` | Safety Notes / Toolbox Talks | `safety.notes` | `safety.notes` | textarea |
| `communicationsText` | Communications with Contractor | `communications` | `contractorCommunications` | textarea |
| `visitorsText` | Visitors, Deliveries & Remarks | `visitors` | `visitorsRemarks` | textarea |

### Safety Incident Toggle

| Field ID | Name | Value | Description |
|----------|------|-------|-------------|
| `safetyNoIncident` | `safetyIncident` | `none` | No incidents occurred |
| `safetyHasIncident` | `safetyIncident` | `incident` | Incident occurred |

### Photos Section

Dynamic photo cards rendered from report photos (Supabase `report_photos` table). Each card contains:

| Element | Data Attribute | Description |
|---------|----------------|-------------|
| `.photo-card-caption` | `data-photo-index` | Caption textarea for each photo |

Photo metadata displayed: date, time, GPS coordinates (if available).

### Signature Section

| Field ID | Label | Data Path | Type |
|----------|-------|-----------|------|
| `signatureName` | Inspector Name | `signature.name` | text |
| `signatureTitle` | Title | `signature.title` | text |
| `signatureCompany` | Company | `signature.company` | text |
| `signatureDate` | Date | - | display only (auto-filled) |

### Debug Tool Panel

A collapsible debug panel for troubleshooting AI field mapping issues. Located at the bottom of the form view.

#### Panel Structure

| Element ID | Description |
|------------|-------------|
| `debugPanel` | Main panel container (`.debug-panel.collapsed` by default) |
| `debugPanelChevron` | Expand/collapse chevron icon |

#### Debug Sections

| Section ID | Header | Content |
|------------|--------|---------|
| `debugSectionAI` | AI Response Data | Raw JSON of AI-generated content |
| `debugSectionFieldNotes` | Field Notes (Raw Capture) | JSON of field notes and guided notes |
| `debugSectionUserEdits` | User Edits | JSON of user edits |
| `debugSectionCurrentState` | Current Report State | JSON of current activities, operations, equipment |
| `debugSectionIssues` | Field Mapping Issues | List of detected issues with issue count badge |

#### Issue Types

The `detectFieldMismatches()` function checks for these issue types:

| Type | CSS Class | Description |
|------|-----------|-------------|
| `schema` | `.debug-issue.schema` | Unexpected keys in AI response |
| `empty` | `.debug-issue.empty` | AI returned empty when fieldNotes had content |
| `type` | `.debug-issue.type` | Expected array but got string or vice versa |
| `contractor` | `.debug-issue.contractor` | ContractorId doesn't match any project contractor |

#### Debug Banner

| Element ID | Description |
|------------|-------------|
| `debugIssueBanner` | Yellow banner shown when issues detected (hidden by default) |

Clicking the banner scrolls to the debug panel. Can be dismissed with the X button.

#### Export Buttons

| Function | Description |
|----------|-------------|
| `downloadDebugJSON()` | Download all debug data as JSON file |
| `downloadDebugMarkdown()` | Download debug report as Markdown file |

---

## Expected aiGenerated Payload

The n8n webhook should return a JSON response with this structure:

```json
{
  "success": true,
  "aiGenerated": {
    "activities": [
      {
        "contractorId": "contractor-uuid",
        "noWork": false,
        "narrative": "Performed excavation work on Section A...",
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
      "Delay due to material delivery",
      "RFI #45 pending response"
    ],

    "qaqcNotes": [
      "Concrete cylinder samples taken",
      "Compaction testing passed"
    ],

    "safety": {
      "hasIncidents": false,
      "noIncidents": true,
      "notes": "Toolbox talk on heat safety conducted"
    },

    "contractorCommunications": "Discussed schedule with prime contractor...",

    "visitorsRemarks": "City inspector visited at 10:00 AM..."
  }
}
```

### Array vs String Fields

| Field | Type | Notes |
|-------|------|-------|
| `activities` | Array | One object per contractor |
| `operations` | Array | One object per contractor |
| `equipment` | Array | One object per equipment item |
| `generalIssues` | Array or String | Joined with `\n` for display |
| `qaqcNotes` | Array or String | Joined with `\n` for display |
| `safety.notes` | String or Array | If array, joined with `\n` |
| `contractorCommunications` | String | Direct display |
| `visitorsRemarks` | String | Direct display |

---

## Field Mapping Table

### Text Sections

| Webhook Field | Report Field ID | Report Path | Notes |
|---------------|-----------------|-------------|-------|
| `generalIssues` | `issuesText` | `issues` | Array joined with newlines |
| `qaqcNotes` | `qaqcText` | `qaqc` | Array joined with newlines |
| `safety.notes` | `safetyText` | `safety.notes` | String or array |
| `contractorCommunications` | `communicationsText` | `communications` | String |
| `visitorsRemarks` | `visitorsText` | `visitors` | String |

### Activities Mapping

| Webhook Field | UI Element | Notes |
|---------------|------------|-------|
| `activities[].contractorId` | Card `data-contractor-id` | Matches project contractor ID |
| `activities[].noWork` | `.no-work-checkbox` | Boolean |
| `activities[].narrative` | `.contractor-narrative` | Work description |
| `activities[].equipmentUsed` | `.contractor-equipment` | Equipment summary |
| `activities[].crew` | `.contractor-crew` | Crew summary |

### Operations Mapping

| Webhook Field | UI Element | Notes |
|---------------|------------|-------|
| `operations[].contractorId` | Table row `data-contractor-id` | Matches project contractor ID |
| `operations[].superintendents` | `.personnel-input[data-field="superintendents"]` | Number |
| `operations[].foremen` | `.personnel-input[data-field="foremen"]` | Number |
| `operations[].operators` | `.personnel-input[data-field="operators"]` | Number |
| `operations[].laborers` | `.personnel-input[data-field="laborers"]` | Number |
| `operations[].surveyors` | `.personnel-input[data-field="surveyors"]` | Number |
| `operations[].others` | `.personnel-input[data-field="others"]` | Number |

### Equipment Mapping

| Webhook Field | UI Element | Notes |
|---------------|------------|-------|
| `equipment[].contractorId` | `.equipment-contractor` | Contractor select |
| `equipment[].type` | `.equipment-type` | Equipment type/model |
| `equipment[].qty` or `quantity` | `.equipment-qty` | Quantity |
| `equipment[].status` or derived from `hoursUsed` | `.equipment-status` | "IDLE" or "X hrs" |

---

## Dynamic Sections

### Contractor Work Cards

**Render Function:** `renderWorkSummary()`

**Data Source:** `projectContractors` array (from active project config in Supabase)

**Behavior:**
1. Iterates through `projectContractors` sorted by type (prime first)
2. For each contractor, calls `getContractorActivity(contractorId)` to get data
3. Renders a card with:
   - Contractor name and type badge (PRIME/SUB)
   - "No work performed" checkbox
   - Collapsible work fields (narrative, equipment, crew)
4. Cards styled based on content status:
   - `.has-content`: Green border when work documented
   - `.no-work`: Gray background when no work checked

### Personnel Table Rows

**Render Function:** `renderPersonnelTable()`

**Data Source:** `projectContractors` array

**Behavior:**
1. Creates one row per contractor
2. Calls `getContractorOperations(contractorId)` to populate values
3. Columns: Contractor, Trade, Super, Foreman, Operators, Laborers, Surveyors, Others, Total
4. Auto-calculates row totals and column totals
5. Updates on any input change via `updatePersonnelRow()` and `updatePersonnelTotals()`

### Equipment Table Rows

**Render Function:** `renderEquipmentTable()`

**Data Source:** `getEquipmentData()` (merges report equipment and aiGenerated equipment)

**Behavior:**
1. Renders existing equipment data or one empty row
2. Each row has: Contractor dropdown, Type input, Qty input, Status dropdown
3. "Add Equipment" button appends new rows
4. Updates saved on any field change via `updateEquipmentRow()`

### Photo Cards

**Render Function:** `renderPhotos()`

**Data Source:** Supabase `report_photos` table

**Behavior:**
1. Single-column layout for DOT compliance
2. Each card shows: Photo number, image, metadata (date/time/GPS), caption textarea
3. Image loading handled with states: loading spinner → image or error
4. Orientation detection via `handlePhotoLoad()` (portrait vs landscape styling)
5. Captions auto-save on blur and with 1-second debounce on input

### Debug Panel

**Render Function:** `initializeDebugPanel()`

**Data Sources:**
- AI response from Supabase `report_ai_response`
- Raw field capture from Supabase `report_raw_capture`
- User edits from Supabase `report_user_edits`
- `projectContractors` - For contractor ID validation

**Behavior:**
1. Initializes on page load via `DOMContentLoaded`
2. Runs `detectFieldMismatches()` to identify issues
3. Populates each collapsible section with JSON data
4. Shows `debugIssueBanner` if issues are detected
5. Panel is collapsed by default; click header to expand
6. Each section within panel is also collapsible
7. Export buttons allow downloading debug data as JSON or Markdown

---

## Supabase Storage

### Report User Edits Table

User edits are saved to Supabase for persistence across devices:

```sql
CREATE TABLE report_user_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id),
  field_path TEXT NOT NULL,
  original_value TEXT,
  edited_value TEXT,
  edited_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Saving User Edits

```javascript
async function saveUserEdit(reportId, fieldPath, originalValue, editedValue) {
    const { error } = await supabase
        .from('report_user_edits')
        .upsert({
            report_id: reportId,
            field_path: fieldPath,
            original_value: originalValue,
            edited_value: editedValue,
            edited_at: new Date().toISOString()
        }, {
            onConflict: 'report_id,field_path'
        });

    if (error) {
        console.error('Error saving user edit:', error);
    }
}
```

---

## Status Tracking

The `reports.status` field indicates processing state:

| Status | Description |
|--------|-------------|
| `draft` | Fresh report, not yet processed |
| `pending_refine` | Waiting for AI processing (offline or failed) |
| `refined` | AI processing complete |
| `submitted` | Report submitted |
| `finalized` | Report finalized and archived |

When status is `pending_refine`, a yellow banner appears with "Retry Now" button to re-attempt webhook call.

---

## Error Handling

### Network Errors
- Toast notification for connection failures
- Data cached locally as fallback
- Retry option when connection restored

### Supabase Errors
- Logged to console
- User-friendly toast message
- Graceful degradation when possible

### AI Response Errors
- Debug panel shows field mapping issues
- Yellow banner alerts user to problems
- Export options for debugging

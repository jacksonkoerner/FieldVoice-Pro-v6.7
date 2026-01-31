# FieldVoice Pro v6.6 — Schema Migration Audit

**Date:** January 29, 2026  
**Audited by:** George (AI Assistant)  
**Purpose:** Map all `aiGenerated` field references in frontend code and identify changes needed for v6.6 schema

---

## Current v6.5 Schema (What Frontend Expects)

```javascript
aiGenerated: {
    activities: [
        {
            contractorId: "uuid",
            noWork: boolean,
            narrative: "string",
            equipmentUsed: "string",
            crew: "string"
        }
    ],
    operations: [
        {
            contractorId: "uuid",
            superintendents: number,
            foremen: number,
            operators: number,
            laborers: number,
            surveyors: number,
            others: number
        }
    ],
    equipment: [
        {
            contractorId: "uuid",
            equipmentId: "uuid",
            type: "string",
            qty: number,
            status: "string"
        }
    ],
    generalIssues: string[] | string,
    qaqcNotes: string[] | string,
    safety: {
        hasIncidents: boolean,
        noIncidents: boolean,
        notes: string[] | string
    },
    contractorCommunications: string,
    visitorsRemarks: string
}
```

## New v6.6 Schema (What Prompts Will Return)

```javascript
{
    success: true,
    executive_summary: "string",           // NEW
    work_performed: "string",              // NEW
    contractors_summary: [                 // NEW STRUCTURE
        {
            name: "string",
            work: "string",
            personnel: number | null
        }
    ],
    equipment_summary: "string",           // CHANGED: was array, now string
    issues_delays: "string",               // RENAMED from generalIssues
    qaqc_notes: "string",                  // RENAMED from qaqcNotes (underscore)
    communications: "string",              // RENAMED from contractorCommunications
    visitors_deliveries: "string",         // RENAMED from visitorsRemarks
    safety_summary: "string",              // CHANGED: was object, now string
    inspector_notes: "string",             // NEW
    extraction_confidence: "string",       // NEW (freeform only)
    missing_data_flags: ["string"]         // NEW (freeform only)
}
```

---

## STEP 1: report.js — aiGenerated References

| Line | Current Field | Data Type | UI Element | Purpose |
|------|---------------|-----------|------------|---------|
| 206-207 | `aiGenerated` (whole object) | Object | N/A | Stores AI response to report |
| 477-508 | `aiGenerated` | Object | N/A | Loads from cache or Supabase |
| 593-594 | `aiGenerated` | Object | N/A | getValue() priority check |
| 626-627 | `aiGenerated` | Object | N/A | getAIValue() helper |
| 647-648 | `aiGenerated` | Object | N/A | getTextFieldValue() helper |
| 763 | `generalIssues` | string/array | `#issuesText` | Issues/delays textarea |
| 765 | `qaqcNotes` | string/array | `#qaqcText` | QA/QC textarea |
| 766 | `safety.notes` | string/array | `#safetyText` | Safety notes textarea |
| 769 | `contractorCommunications` | string | `#communicationsText` | Communications textarea |
| 770 | `visitorsRemarks` | string | `#visitorsText` | Visitors textarea |
| 955-962 | `aiGenerated.activities` | Array | Work summary cards | Contractor activity lookup |
| 1092-1093 | `aiGenerated.operations` | Array | Personnel table | Operations/personnel lookup |
| 1166-1167 | `aiGenerated.equipment` | Array | Equipment table | Equipment data lookup |
| 1753-1885 | Various fields | Various | Debug panel | Validation/debugging |

### report.js Text Field Mapping (lines 763-770)

```javascript
// Current code in populateAllFields():
document.getElementById('issuesText').value = getTextFieldValue('issues', 'generalIssues', ...);
document.getElementById('qaqcText').value = getTextFieldValue('qaqc', 'qaqcNotes', '');
document.getElementById('safetyText').value = getTextFieldValue('safety.notes', 'safety.notes', ...);
document.getElementById('communicationsText').value = getTextFieldValue('communications', 'contractorCommunications', '');
document.getElementById('visitorsText').value = getTextFieldValue('visitors', 'visitorsRemarks', '');
```

---

## STEP 2: finalreview.js — aiGenerated References

| Line | Current Field | Data Type | UI Element | Purpose |
|------|---------------|-----------|------------|---------|
| 290-298 | `aiGenerated` (construction) | Object | N/A | Builds aiGenerated from response_payload |
| 291 | `activities` | Array | Work summary | Contractor activities |
| 292 | `operations` | Array | Operations table | Personnel counts |
| 293 | `equipment` | Array | Equipment table | Equipment data |
| 294 | `generalIssues` | Array/string | `#issuesContent` | Issues section |
| 295 | `qaqcNotes` | Array/string | `#qaqcContent` | QA/QC section |
| 296 | `safety` | Object | Safety section | Safety data |
| 297 | `contractorCommunications` | string | `#communicationsContent` | Communications |
| 298 | `visitorsRemarks` | string | `#visitorsContent` | Visitors section |
| 377 | `aiGenerated` | Object | N/A | populateReport() |
| 556-557 | `aiGenerated.activities` | Array | Work summary | getContractorActivity() |
| 602-603 | `aiGenerated.operations` | Array | Operations table | getContractorOperations() |
| 671-672 | `aiGenerated.equipment` | Array | Equipment table | getEquipmentData() |
| 693-695 | `generalIssues` | Array/string | `#issuesContent` | renderTextSections() |
| 696-697 | `contractorCommunications` | string | `#communicationsContent` | renderTextSections() |
| 700-701 | `qaqcNotes` | Array/string | `#qaqcContent` | renderTextSections() |
| 704-705 | `visitorsRemarks` | string | `#visitorsContent` | renderTextSections() |
| 768 | `safety.hasIncidents` | boolean | `#checkYes/#checkNo` | Safety checkbox |
| 776 | `safety.notes` | string/array | `#safetyContent` | Safety notes |
| 1011-1012 | `workPerformed`, `executiveSummary` | string | final_reports table | submitReport() - already expects new fields! |

### finalreview.js Text Section Mapping (renderTextSections, lines 691-705)

```javascript
// Current code:
const issues = getTextValue('issues', 'generalIssues', 'guidedNotes.issues', '');
const comms = getTextValue('communications', 'contractorCommunications', '', '');
const qaqc = getTextValue('qaqc', 'qaqcNotes', '', '');
const visitors = getTextValue('visitors', 'visitorsRemarks', '', '');
```

---

## STEP 3: Field Mapping Table

| Current Field (v6.5) | Type | New Field (v6.6) | Type | UI Element(s) | Breaking? |
|---------------------|------|------------------|------|---------------|-----------|
| `activities` | `Array<{contractorId, narrative, equipmentUsed, crew}>` | `contractors_summary` | `Array<{name, work, personnel}>` | Work summary cards | ⚠️ **YES** - Different structure |
| `operations` | `Array<{contractorId, superintendents, foremen, ...}>` | *(removed)* | N/A | Operations table | ⚠️ **YES** - No equivalent |
| `equipment` | `Array<{contractorId, type, qty, status}>` | `equipment_summary` | `string` | Equipment table | ⚠️ **YES** - Array→String |
| `generalIssues` | `string[]` or `string` | `issues_delays` | `string` | `#issuesText`, `#issuesContent` | ✅ Minor - Just rename |
| `qaqcNotes` | `string[]` or `string` | `qaqc_notes` | `string` | `#qaqcText`, `#qaqcContent` | ✅ Minor - Just rename |
| `safety` | `{hasIncidents, noIncidents, notes}` | `safety_summary` | `string` | Safety section | ⚠️ **YES** - Object→String |
| `safety.hasIncidents` | `boolean` | *(removed)* | N/A | `#checkYes/#checkNo` | ⚠️ **YES** - No boolean |
| `safety.notes` | `string[]` or `string` | `safety_summary` | `string` | `#safetyContent` | ✅ Minor - Flattened |
| `contractorCommunications` | `string` | `communications` | `string` | `#communicationsText`, `#communicationsContent` | ✅ Minor - Just rename |
| `visitorsRemarks` | `string` | `visitors_deliveries` | `string` | `#visitorsText`, `#visitorsContent` | ✅ Minor - Just rename |
| *(new)* | N/A | `executive_summary` | `string` | *(needs new UI)* | 🆕 New field |
| *(new)* | N/A | `work_performed` | `string` | *(needs new UI)* | 🆕 New field |
| *(new)* | N/A | `inspector_notes` | `string` | *(needs new UI)* | 🆕 New field |
| *(new)* | N/A | `extraction_confidence` | `string` | *(optional UI)* | 🆕 New field |
| *(new)* | N/A | `missing_data_flags` | `string[]` | *(optional UI)* | 🆕 New field |

---

## STEP 4: Breaking Changes Analysis

### 🔴 CRITICAL: Structural Changes

#### 1. `activities` → `contractors_summary` (Array structure change)

**Current (v6.5):**
```javascript
activities: [
    {
        contractorId: "uuid",        // Links to project contractor
        noWork: false,
        narrative: "Set forms...",
        equipmentUsed: "CAT 320",
        crew: "5 laborers"
    }
]
```

**New (v6.6):**
```javascript
contractors_summary: [
    {
        name: "Smith Concrete",      // Name, not ID
        work: "Set forms...",
        personnel: 5                 // Just a number, not breakdown
    }
]
```

**Impact:**
- `getContractorActivity()` in both files uses `contractorId` lookup — **WILL BREAK**
- Work summary rendering relies on structured fields — **NEEDS REWRITE**
- No `equipmentUsed` or `crew` in new format

**Fix Required:** Either:
- A) Update prompts to return `contractorId` and match old structure
- B) Rewrite frontend to match by contractor `name` instead of `id`

---

#### 2. `operations` — No Equivalent in v6.6

**Current (v6.5):**
```javascript
operations: [
    {
        contractorId: "uuid",
        superintendents: 1,
        foremen: 2,
        operators: 4,
        laborers: 8,
        surveyors: 0,
        others: 0
    }
]
```

**New (v6.6):** ❌ **REMOVED** — Only `personnel: number` in `contractors_summary`

**Impact:**
- `renderOperationsTable()` will have no data — **WILL BREAK**
- Operations table shows breakdown by role — cannot populate

**Fix Required:**
- A) Add `operations` back to prompt output schema, OR
- B) Remove operations table from UI, OR
- C) Keep operations as raw capture data only (not AI-refined)

---

#### 3. `equipment` → `equipment_summary` (Array → String)

**Current (v6.5):**
```javascript
equipment: [
    {
        contractorId: "uuid",
        equipmentId: "uuid",
        type: "CAT 320 Excavator",
        qty: 2,
        status: "8 hrs"
    }
]
```

**New (v6.6):**
```javascript
equipment_summary: "CAT 320 Excavator (2) - 8hrs, Concrete pump (1) - 4hrs"
```

**Impact:**
- `renderEquipmentTable()` expects array — **WILL BREAK**
- `getEquipmentData()` iterates over array — **WILL BREAK**
- Equipment table needs structured data for rows

**Fix Required:**
- A) Change prompt to return array structure, OR
- B) Rewrite equipment table to display as text paragraph

---

#### 4. `safety` → `safety_summary` (Object → String)

**Current (v6.5):**
```javascript
safety: {
    hasIncidents: false,
    noIncidents: true,
    notes: "All personnel wore PPE"
}
```

**New (v6.6):**
```javascript
safety_summary: "No incidents. All personnel wore required PPE."
```

**Impact:**
- `safety.hasIncidents` boolean used for checkbox — **WILL BREAK**
- `renderSafetySection()` checks `report.aiGenerated?.safety?.hasIncidents`

**Fix Required:**
- A) Parse `safety_summary` text to infer incident status, OR
- B) Add `has_incidents: boolean` to schema, OR
- C) Keep incident checkbox from raw capture data only

---

### 🟡 MINOR: Rename-Only Changes

These just need field name updates in the lookup paths:

| Change | Files | Lines to Update |
|--------|-------|-----------------|
| `generalIssues` → `issues_delays` | report.js, finalreview.js | 763, 693, 1828, 1832, 1863 |
| `qaqcNotes` → `qaqc_notes` | report.js, finalreview.js | 765, 700, 1863 |
| `contractorCommunications` → `communications` | report.js, finalreview.js | 769, 696 |
| `visitorsRemarks` → `visitors_deliveries` | report.js, finalreview.js | 770, 704 |

---

### 🟢 NEW: Fields Needing UI Elements

| New Field | Purpose | UI Recommendation |
|-----------|---------|-------------------|
| `executive_summary` | 2-3 sentence overview | Add to report header or new "Summary" section |
| `work_performed` | Narrative of all work | Could replace/supplement work summary cards |
| `inspector_notes` | Additional observations | Add textarea in "Additional Notes" section |
| `extraction_confidence` | high/medium/low | Show warning badge if "low" |
| `missing_data_flags` | List of incomplete sections | Show alerts for flagged sections |

**Note:** `finalreview.js` line 1011-1012 already references `workPerformed` and `executiveSummary` in `submitReport()` — these were anticipated but never implemented!

---

## RECOMMENDATIONS

### Option A: Update Prompts to Match Current Frontend (Minimal Changes)

Modify v6.6 prompts to output the **old field names and structures**:

```javascript
// Prompt output schema (backwards compatible):
{
    success: true,
    activities: [...],              // Keep array with contractorId
    operations: [...],              // Keep array with personnel breakdown
    equipment: [...],               // Keep array structure
    generalIssues: "string",
    qaqcNotes: "string",
    safety: {
        hasIncidents: false,
        noIncidents: true,
        notes: "string"
    },
    contractorCommunications: "string",
    visitorsRemarks: "string",
    // NEW fields (additive):
    executive_summary: "string",
    work_performed: "string",
    inspector_notes: "string"
}
```

**Pros:** Minimal frontend changes  
**Cons:** Prompts become more complex; freeform mode can't easily produce contractor IDs

---

### Option B: Update Frontend to Match New Schema (Clean Break)

Update `report.js` and `finalreview.js` to use new schema:

1. **Text fields:** Simple rename in getTextValue() calls
2. **Safety:** Parse text or add `has_incidents` boolean to schema
3. **Equipment:** Display as formatted text instead of table
4. **Operations:** Remove table or keep as raw data only
5. **Activities:** Match contractors by name instead of ID

**Pros:** Cleaner schema, better for freeform mode  
**Cons:** More frontend work required

---

### Option C: Hybrid Approach (Recommended)

1. **Keep structured arrays for contractor data** (activities, operations, equipment) — essential for tables
2. **Use new string fields for text sections** (issues, qaqc, etc.)
3. **Add new fields** (executive_summary, work_performed, inspector_notes)
4. **Add `has_incidents` boolean** to safety section

**Revised Output Schema:**

```javascript
{
    success: true,
    
    // NEW text fields
    executive_summary: "string",
    work_performed: "string",
    inspector_notes: "string",
    
    // STRUCTURED arrays (keep for table rendering)
    activities: [
        {
            contractorId: "uuid" | null,  // null for freeform
            contractorName: "string",     // Always populated
            narrative: "string",
            equipmentUsed: "string",
            personnel: number | null
        }
    ],
    operations: [
        {
            contractorId: "uuid" | null,
            contractorName: "string",
            superintendents: number,
            foremen: number,
            operators: number,
            laborers: number,
            surveyors: number,
            others: number
        }
    ],
    equipment: [
        {
            contractorName: "string",
            type: "string",
            qty: number,
            status: "string"
        }
    ],
    
    // TEXT sections (renamed)
    issues_delays: "string",
    qaqc_notes: "string",
    communications: "string",
    visitors_deliveries: "string",
    
    // SAFETY (hybrid)
    safety: {
        has_incidents: boolean,
        summary: "string"
    },
    
    // FREEFORM only
    extraction_confidence: "string",
    missing_data_flags: ["string"]
}
```

---

## Files Requiring Updates

| File | Changes Needed | Effort |
|------|----------------|--------|
| `js/report.js` | Field renames in getTextFieldValue() calls | Low |
| `js/finalreview.js` | Field renames in getTextValue() calls | Low |
| `js/finalreview.js` | Update aiGenerated construction (lines 290-298) | Medium |
| `js/report.js` | Update debug panel field names | Low |
| `js/quick-interview.js` | Update callProcessWebhook() response handling | Medium |
| `js/drafts.js` | Update response handling | Low |

---

## Summary

| Category | Count | Impact |
|----------|-------|--------|
| 🔴 Critical structural changes | 4 | Requires schema decision |
| 🟡 Rename-only changes | 4 | Simple find/replace |
| 🟢 New fields needing UI | 5 | Additive, optional |

**Next Step:** Decide on Option A, B, or C before implementing changes.

---

*Audit complete. Report generated automatically.*

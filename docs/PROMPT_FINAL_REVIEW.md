# FieldVoice Pro v6.6 — Final Prompt Review

**Date:** January 29, 2026  
**Reviewed by:** George (AI Assistant)  
**Status:** 🟡 Issues Found — Fixes Required Before Build

---

## Schema Parity Checklist

| Field | Prompt A (Guided) | Prompt B (Freeform) | Match? |
|-------|-------------------|---------------------|--------|
| `success` | ✅ | ✅ | ✅ |
| `executive_summary` | ✅ | ✅ | ✅ |
| `work_performed` | ✅ | ✅ | ✅ |
| `inspector_notes` | ✅ | ✅ | ✅ |
| `activities` | ✅ (array) | ✅ (array) | ✅ |
| `operations` | ✅ (array) | ✅ (array) | ✅ |
| `equipment` | ✅ (array) | ✅ (array) | ✅ |
| `issues_delays` | ✅ | ✅ | ✅ |
| `qaqc_notes` | ✅ | ✅ | ✅ |
| `communications` | ✅ | ✅ | ✅ |
| `visitors_deliveries` | ✅ | ✅ | ✅ |
| `safety.has_incidents` | ✅ | ✅ | ✅ |
| `safety.summary` | ✅ | ✅ | ✅ |
| `extraction_confidence` | ✅ ("high") | ✅ (variable) | ✅ |
| `missing_data_flags` | ✅ ([]) | ✅ (populated) | ✅ |

**Schema Parity: ✅ PASS** — Both prompts produce identical top-level structure.

---

## Frontend Compatibility Issues

### 🔴 CRITICAL: Missing Fields

#### 1. `activities` array — Missing `noWork` and `crew`

**Frontend expects (from report.js line 1779):**
```javascript
const expectedActivityKeys = ['contractorId', 'narrative', 'noWork', 'equipmentUsed', 'crew'];
```

**Frontend usage:**
- `report.js:960` — `noWork: aiActivity.noWork ?? false`
- `report.js:888` — `const crew = activity?.crew || ''`
- `finalreview.js:526` — `if (activity?.noWork)`

**Current prompt structure:**
```javascript
{
    "contractorId": "uuid",
    "contractorName": "string",
    "narrative": "string",
    "equipmentUsed": "string",
    "personnel": 5              // ❌ Wrong! Should be "crew": "string"
}
```

**Required structure:**
```javascript
{
    "contractorId": "uuid | null",
    "contractorName": "string",
    "noWork": false,            // ✅ ADD THIS
    "narrative": "string",
    "equipmentUsed": "string",
    "crew": "string"            // ✅ CHANGE personnel → crew (string, not number)
}
```

---

#### 2. `equipment` array — Missing `contractorId`

**Frontend expects (from report.js and finalreview.js):**
```javascript
// getEquipmentData() in both files:
return report.aiGenerated.equipment.map(aiItem => ({
    contractorId: aiItem.contractorId || '',  // ← Expects contractorId
    type: aiItem.type || '',
    qty: aiItem.qty || 1,
    status: aiItem.status || 'IDLE'
}));
```

**Current prompt structure:**
```javascript
{
    "contractorName": "string",    // Has name but...
    // ❌ Missing contractorId!
    "type": "string",
    "qty": 1,
    "status": "string"
}
```

**Required structure:**
```javascript
{
    "contractorId": "uuid | null",  // ✅ ADD THIS
    "contractorName": "string",
    "type": "string",
    "qty": 1,
    "status": "string"
}
```

---

### 🟡 MINOR: Field Name Mapping Needed

The following field renames need updates in frontend code (as documented in SCHEMA_MIGRATION_AUDIT.md):

| Prompt Field | Frontend Currently Expects | Action |
|--------------|---------------------------|--------|
| `issues_delays` | `generalIssues` | Update frontend |
| `qaqc_notes` | `qaqcNotes` | Update frontend |
| `communications` | `contractorCommunications` | Update frontend |
| `visitors_deliveries` | `visitorsRemarks` | Update frontend |
| `safety.has_incidents` | `safety.hasIncidents` | Update frontend |
| `safety.summary` | `safety.notes` | Update frontend |

---

## Specific Questions Answered

### 1. Is the `operations` array structure complete?

**✅ YES** — Structure matches what `renderOperationsTable()` expects:

```javascript
// Prompt structure:
{
    "contractorId": "uuid",
    "contractorName": "string",
    "superintendents": 0,
    "foremen": 0,
    "operators": 0,
    "laborers": 0,
    "surveyors": 0,
    "others": 0
}
```

**Frontend usage (finalreview.js):**
```javascript
html += `<tr>
    <td>${ops?.superintendents || 'N/A'}</td>
    <td>${ops?.foremen || 'N/A'}</td>
    <td>${ops?.operators || 'N/A'}</td>
    <td>${ops?.laborers || 'N/A'}</td>
    <td>${ops?.surveyors || 'N/A'}</td>
    <td>${ops?.others || 'N/A'}</td>
</tr>`;
```

All fields present. ✅

---

### 2. Is the `equipment` array structure complete?

**❌ NO** — Missing `contractorId`. See fix above.

---

### 3. Is `safety.has_incidents` + `safety.summary` sufficient?

**✅ YES** — With minor frontend update.

**Frontend usage (finalreview.js:768):**
```javascript
const hasIncident = report.safety?.hasIncident || report.aiGenerated?.safety?.hasIncidents || false;
```

**Fix needed:** Update to also check `has_incidents` (underscore version):
```javascript
const hasIncident = report.safety?.hasIncident || 
                    report.aiGenerated?.safety?.hasIncidents || 
                    report.aiGenerated?.safety?.has_incidents ||  // ← Add this
                    false;
```

---

### 4. Any missing fields the frontend expects?

**Yes, documented above:**
1. `activities.noWork` (boolean)
2. `activities.crew` (string) — not `personnel` (number)
3. `equipment.contractorId` (uuid or null)

---

### 5. Any final prompt improvements?

**Yes — see corrected output formats below.**

---

## Corrected Output Formats

### PROMPT A (Guided) — Fixed `<output_format>`

```xml
<output_format>
{
  "success": true,
  "executive_summary": "2-3 sentence overview of the day's construction activities and conditions",
  "work_performed": "Comprehensive narrative of all work performed across all contractors",
  "inspector_notes": "Additional observations and remarks from the inspector",
  
  "activities": [
    {
      "contractorId": "uuid from input",
      "contractorName": "Contractor display name",
      "noWork": false,
      "narrative": "Professional description of work performed",
      "equipmentUsed": "Equipment used by this contractor",
      "crew": "Personnel description (e.g., '5 laborers, 2 operators')"
    }
  ],
  
  "operations": [
    {
      "contractorId": "uuid from input",
      "contractorName": "Contractor display name",
      "superintendents": 0,
      "foremen": 0,
      "operators": 0,
      "laborers": 0,
      "surveyors": 0,
      "others": 0
    }
  ],
  
  "equipment": [
    {
      "contractorId": "uuid from input",
      "contractorName": "Contractor display name",
      "type": "Equipment type",
      "qty": 1,
      "status": "Hours utilized (e.g., '8 hrs', 'IDLE')"
    }
  ],
  
  "issues_delays": "Description of issues or delays, or 'No issues or delays reported'",
  "qaqc_notes": "QA/QC testing and results, or 'No QA/QC testing performed'",
  "communications": "Summary of communications, or 'No communications logged'",
  "visitors_deliveries": "Visitors and deliveries, or 'No visitors or deliveries'",
  
  "safety": {
    "has_incidents": false,
    "summary": "Safety observations including incident status and PPE compliance"
  },
  
  "extraction_confidence": "high",
  "missing_data_flags": []
}
</output_format>
```

### PROMPT B (Freeform) — Fixed `<output_format>`

```xml
<output_format>
{
  "success": true,
  "executive_summary": "2-3 sentence overview of the day's construction activities and conditions",
  "work_performed": "Comprehensive narrative of all work performed across all contractors",
  "inspector_notes": "Additional observations and any unclear notes extracted",
  
  "activities": [
    {
      "contractorId": null,
      "contractorName": "Contractor name as identified in notes",
      "noWork": false,
      "narrative": "Professional description of work performed",
      "equipmentUsed": "Equipment mentioned for this contractor, or empty string",
      "crew": "Personnel description if mentioned, or empty string"
    }
  ],
  
  "operations": [
    {
      "contractorId": null,
      "contractorName": "Contractor name",
      "superintendents": 0,
      "foremen": 0,
      "operators": 0,
      "laborers": 0,
      "surveyors": 0,
      "others": 0
    }
  ],
  
  "equipment": [
    {
      "contractorId": null,
      "contractorName": "Contractor name or 'Unspecified'",
      "type": "Equipment type",
      "qty": 1,
      "status": "Hours or status if mentioned, or 'IDLE'"
    }
  ],
  
  "issues_delays": "Issues/delays mentioned, or 'No issues documented in field notes'",
  "qaqc_notes": "QA/QC activities mentioned, or 'No QA/QC documented in field notes'",
  "communications": "Communications mentioned, or 'No communications documented in field notes'",
  "visitors_deliveries": "Visitors/deliveries mentioned, or 'No visitors/deliveries documented in field notes'",
  
  "safety": {
    "has_incidents": false,
    "summary": "Safety observations mentioned, or 'No safety notes documented in field notes'"
  },
  
  "extraction_confidence": "high | medium | low",
  "missing_data_flags": ["sections", "with", "insufficient", "data"]
}
</output_format>
```

### PROMPT B — Fixed Examples

Update examples to include `noWork`, `crew`, and `contractorId` in equipment:

**Simple example fix:**
```json
"activities": [
    {
        "contractorId": null,
        "contractorName": "Smith Concrete",
        "noWork": false,
        "narrative": "Set forms for footing B-4. Crew arrived late to site.",
        "equipmentUsed": "",
        "crew": ""
    }
],
"equipment": [
    {
        "contractorId": null,
        "contractorName": "Unspecified",
        "type": "CAT Excavator",
        "qty": 1,
        "status": "Drainage work"
    }
]
```

**Complex example fix:**
```json
"activities": [
    {
        "contractorId": null,
        "contractorName": "Smith Concrete",
        "noWork": false,
        "narrative": "On site (specific activities not documented)",
        "equipmentUsed": "",
        "crew": ""
    },
    {
        "contractorId": null,
        "contractorName": "ABC Paving",
        "noWork": false,
        "narrative": "Paving operations in Lot B",
        "equipmentUsed": "Pavers",
        "crew": "12 workers"
    }
],
"equipment": [
    {
        "contractorId": null,
        "contractorName": "ABC Paving",
        "type": "Paver",
        "qty": 2,
        "status": "Lot B operations"
    }
]
```

---

## Anthropic Best Practices Checklist

| Practice | Prompt A | Prompt B |
|----------|----------|----------|
| Instructions before data | ✅ | ✅ |
| Clear output format | ✅ | ✅ |
| XML tags for structure | ✅ | ✅ |
| Examples for complex tasks | N/A (guided is structured) | ✅ (2 examples) |
| Edge case guidance | ✅ (defaults specified) | ✅ (extraction_guidelines) |
| No-markdown instruction | ✅ | ✅ |
| Closing prompt | ✅ | ✅ |

---

## Summary

### Issues to Fix Before Build

| Issue | Severity | Fix |
|-------|----------|-----|
| Missing `noWork` in activities | 🔴 Critical | Add to output_format |
| Wrong `personnel` → should be `crew` | 🔴 Critical | Change to string field |
| Missing `contractorId` in equipment | 🔴 Critical | Add to output_format |
| Update examples in Prompt B | 🟡 Medium | Fix JSON in examples |

### Frontend Updates Required (After n8n Build)

| File | Change |
|------|--------|
| `report.js` | Update field name lookups (generalIssues→issues_delays, etc.) |
| `finalreview.js` | Update field name lookups + aiGenerated construction |
| Both files | Add `has_incidents` check alongside `hasIncidents` |

---

## Verdict

**🟡 NOT YET READY TO BUILD**

Fix the three critical issues in the output_format sections:
1. Add `noWork: boolean` to activities
2. Change `personnel: number` to `crew: string` in activities
3. Add `contractorId` to equipment array

Once fixed: **✅ GREEN LIGHT TO BUILD**

---

*Review complete. Fixes documented above.*

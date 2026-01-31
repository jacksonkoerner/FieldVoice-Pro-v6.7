# FieldVoice Pro v6.6 — Codebase Health Audit

**Date:** 2026-01-30  
**Auditor:** George (AI)  
**Total Lines:** 15,252 across 19 JS files  
**Total Functions:** 468

---

## 1. Data Format Inconsistencies

### 1.1 Project Name Field (CRITICAL)

The project name is accessed inconsistently across files:

| Pattern | Usage | Files |
|---------|-------|-------|
| `project.name` | JS convention | index.js, project-config.js, finalreview.js |
| `project.project_name` | Supabase convention | archives.js, quick-interview.js |
| `project.projectName` | camelCase variant | quick-interview.js, drafts.js |
| `a.name \|\| a.project_name` | Defensive fallback | index.js:29, index.js:107 |

**Impact:** Projects fail to display when the wrong property is accessed. This is likely causing the "no project configured" issue.

**Examples:**
```javascript
// index.js:29 — uses defensive fallback
(a.name || a.project_name || '').localeCompare(b.name || b.project_name || '')

// quick-interview.js:670 — triple fallback!
project_name: activeProject?.projectName || activeProject?.name || activeProject?.project_name || ''
```

### 1.2 Contractor ID Field

| Pattern | Context | Files |
|---------|---------|-------|
| `contractor_id` | Supabase DB field | finalreview.js, quick-interview.js, report.js |
| `contractorId` | JS convention | Throughout same files |

**Impact:** Data mapping errors when reading from Supabase vs. working in memory.

### 1.3 Report ID Field

| Pattern | Context | Files |
|---------|---------|-------|
| `report_id` | Supabase DB field | archives.js, supabase-utils.js, sync-manager.js |
| `reportId` | JS convention | quick-interview.js, report.js |

### 1.4 Storage Path Field

| Pattern | Context |
|---------|---------|
| `storage_path` | Supabase |
| `storagePath` | JS memory |

### 1.5 User ID Field

| Pattern | Context |
|---------|---------|
| `user_id` | Supabase, IndexedDB filtering |
| `userId` | JS convention |

---

## 2. Converter Function Analysis

### 2.1 Available Converters (supabase-utils.js)

| Converter | Lines |
|-----------|-------|
| `fromSupabaseProject` / `toSupabaseProject` | 28-100 |
| `fromSupabaseContractor` / `toSupabaseContractor` | 104-159 |
| `fromSupabaseReport` / `toSupabaseReport` | 162-230 |
| `fromSupabaseEntry` / `toSupabaseEntry` | 233-307 |
| `fromSupabaseRawCapture` / `toSupabaseRawCapture` | 311-374 |
| `fromSupabaseAIResponse` / `toSupabaseAIResponse` | 378-423 |
| `fromSupabaseFinal` / `toSupabaseFinal` | 426-569 |
| `fromSupabasePhoto` / `toSupabasePhoto` | 573-620 |
| `fromSupabaseUserProfile` / `toSupabaseUserProfile` | 623-668 |
| `fromSupabaseEquipment` / `toSupabaseEquipment` | 673-703 |

### 2.2 Converter Usage by File

| File | Uses Converters | Notes |
|------|-----------------|-------|
| index.js | ✅ `fromSupabaseProject` | Properly converts after fetch |
| project-config.js | ✅ `fromSupabaseProject`, `toSupabaseProject`, `fromSupabaseContractor`, `toSupabaseContractor` | Good usage |
| quick-interview.js | ✅ `fromSupabaseProject`, `fromSupabaseContractor` | Uses in loadActiveProject |
| report.js | ✅ `fromSupabaseProject`, `fromSupabaseContractor` | Good usage |
| finalreview.js | ✅ `fromSupabaseProject`, `fromSupabaseContractor` | Good usage |
| sync-manager.js | ✅ `toSupabaseEntry`, `toSupabaseReport`, `toSupabaseRawCapture` | Good usage |
| settings.js | ✅ `fromSupabaseUserProfile`, `toSupabaseUserProfile` | Good usage |
| archives.js | ❌ | **Raw Supabase data used directly** |
| drafts.js | ❌ | Works with localStorage, not Supabase |

### 2.3 Raw Data Issues

**archives.js:24** — Uses raw Supabase field names:
```javascript
name: row.project_name || '',  // Should use fromSupabaseProject
```

---

## 3. Offline-First Pattern Analysis

### 3.1 Files with Proper Offline-First Logic

| File | IndexedDB First | navigator.onLine Check | Cache After Fetch | Fallback | Grade |
|------|-----------------|------------------------|-------------------|----------|-------|
| **index.js** | ✅ | ✅ | ✅ | ✅ | **A** |
| **project-config.js** | ✅ | ❌ | ✅ | Partial | **B** |

### 3.2 Files Missing Offline-First Logic

| File | IndexedDB | navigator.onLine | Cache | Issue |
|------|-----------|------------------|-------|-------|
| **quick-interview.js** | ❌ | ✅ (2 places) | ❌ | Goes straight to Supabase for project load |
| **report.js** | ❌ | ✅ (1 place) | ❌ | No IndexedDB integration |
| **finalreview.js** | ❌ | ❌ | ❌ | **No offline handling at all** |
| **archives.js** | ❌ | ❌ | ❌ | **No offline handling at all** |

### 3.3 quick-interview.js Analysis

**Problem:** Has its own `loadActiveProject()` function (line ~2000) that:
1. Goes directly to Supabase
2. Only checks `navigator.onLine` for error message
3. Does NOT check IndexedDB first
4. Does NOT cache to IndexedDB

This is why projects fail to load offline even though index.js cached them properly.

---

## 4. Function Duplication

### 4.1 Multiple loadProjects/getProjects Functions

| Function | File | Behavior |
|----------|------|----------|
| `loadProjects()` | index.js:17 | IndexedDB-first, caches to IDB |
| `getProjects()` | index.js:89 | Returns cache |
| `loadProjects()` | archives.js:10 | **Supabase only, no IDB** |
| `getProjects()` | project-config.js:14 | IndexedDB-first, caches to IDB |

### 4.2 Multiple loadActiveProject Functions

| Function | File | Behavior |
|----------|------|----------|
| `loadActiveProject()` | index.js:93 | IndexedDB-first ✅ |
| `loadActiveProject()` | finalreview.js:48 | **Supabase only** ❌ |
| `loadActiveProject()` | quick-interview.js:~2000 | **Supabase only** ❌ |

**This is the root cause of the offline project loading failure.**

### 4.3 Multiple save Functions

| Function | File | Target |
|----------|------|--------|
| `saveProject()` | project-config.js:252 | Supabase + IndexedDB |
| `saveProjectToSupabase()` | project-config.js:105 | Supabase only |
| `idb.saveProject()` | indexeddb-utils.js:76 | IndexedDB only |

---

## 5. Storage Architecture

### 5.1 localStorage Keys (STORAGE_KEYS)

| Key | Purpose | Used By |
|-----|---------|---------|
| `fvp_user_profile` | User profile data | settings.js |
| `fvp_projects` | Projects map (for report-rules.js) | index.js |
| `fvp_active_project_id` | Currently selected project ID | Multiple |
| `fvp_current_reports` | Current day's reports | quick-interview.js |
| `fvp_ai_reports` | AI-processed reports | |
| `fvp_drafts` | Draft reports | drafts.js |
| `fvp_sync_queue` | Pending sync operations | sync-manager.js |
| `fvp_offline_queue` | Offline operations queue | drafts.js |
| `fvp_device_id` | Device identifier | Multiple |
| `fvp_user_id` | User identifier | Multiple |
| `fvp_quick_interview_draft` | Current interview draft | quick-interview.js |
| `fvp_*_granted` | Permission flags | permissions.js |
| `fvp_onboarded` | Onboarding complete flag | permissions.js |

### 5.2 IndexedDB Stores

| Store | KeyPath | Purpose | Used |
|-------|---------|---------|------|
| `projects` | `id` | Project cache | ✅ index.js, project-config.js |
| `userProfile` | `deviceId` | User profile cache | Minimal use |

### 5.3 Storage Overlap/Confusion

1. **Projects are stored in BOTH:**
   - IndexedDB `projects` store (full objects)
   - localStorage `fvp_projects` (as a map, for report-rules.js)
   
2. **Reports are NOT in IndexedDB:**
   - Only in localStorage (`fvp_current_reports`)
   - Should be in IndexedDB for larger storage capacity

3. **Photos have no local cache:**
   - Go directly to Supabase Storage
   - No offline support (this was what PRs #27-29 attempted to fix)

---

## 6. Code Statistics

### 6.1 Lines by File

| File | Lines | % of Total |
|------|-------|------------|
| quick-interview.js | 4,623 | 30.3% |
| report.js | 2,266 | 14.9% |
| finalreview.js | 1,384 | 9.1% |
| project-config.js | 1,142 | 7.5% |
| permissions.js | 785 | 5.1% |
| Other (14 files) | 5,052 | 33.1% |

### 6.2 Complexity Hotspots

1. **quick-interview.js** — 4,623 lines, too many responsibilities
2. **report.js** — 2,266 lines, duplicates much of quick-interview.js
3. **finalreview.js** — No offline handling, uses raw Supabase data in places

---

## 7. Recommended Refactors (Priority Order)

### 7.1 CRITICAL — Fix Offline Project Loading

**Problem:** `quick-interview.js` and `finalreview.js` have their own `loadActiveProject()` that doesn't use IndexedDB.

**Fix:**
1. Create a single `loadActiveProject()` in a shared module
2. All pages import and use the same function
3. Ensure IndexedDB-first pattern everywhere

**Files to modify:** quick-interview.js, finalreview.js, report.js

### 7.2 HIGH — Standardize Property Names

**Problem:** Mixed use of `name`, `project_name`, `projectName`.

**Fix:**
1. Use converters EVERYWHERE data comes from Supabase
2. Standardize on camelCase internally
3. Audit all property access and fix inconsistencies

**Files to modify:** All files, especially archives.js

### 7.3 HIGH — Consolidate Duplicate Functions

**Problem:** Multiple versions of `loadProjects()`, `loadActiveProject()`.

**Fix:**
1. Create `data-layer.js` with single implementations
2. Export: `loadProjects()`, `loadActiveProject()`, `saveProject()`
3. All pages import from data-layer.js

### 7.4 MEDIUM — Add Report Caching to IndexedDB

**Problem:** Reports only in localStorage (5MB limit).

**Fix:**
1. Add `reports` store to IndexedDB
2. Migrate report storage from localStorage
3. Keep localStorage for small flags only

### 7.5 MEDIUM — Add Photo Offline Support (Redo #27-29)

**Problem:** Photos require network, no offline capture.

**Fix:**
1. Add `photos` store to IndexedDB (schema from PR #27)
2. Capture → IndexedDB → Background sync to Supabase
3. Ensure it doesn't break existing project loading

### 7.6 LOW — Split quick-interview.js

**Problem:** 4,623 lines, too large.

**Fix:**
1. Extract photo handling to `photo-manager.js`
2. Extract AI processing to `ai-processor.js`
3. Extract entry management to `entry-manager.js`

---

## 8. Coding Standards Proposal

### 8.1 Property Naming

```javascript
// ✅ CORRECT: Use camelCase internally
const project = {
    id: 'uuid',
    name: 'Project Name',        // NOT project_name
    projectNo: '12345',          // NOT noab_project_no
    userId: 'uuid'               // NOT user_id
};

// ✅ CORRECT: Use converters for Supabase
const project = fromSupabaseProject(row);  // Converts snake_case → camelCase
const row = toSupabaseProject(project);    // Converts camelCase → snake_case
```

### 8.2 Data Loading Pattern

```javascript
// ✅ CORRECT: IndexedDB-first pattern
async function loadData() {
    // 1. Try IndexedDB first
    try {
        const local = await idb.getData();
        if (local) return local;
    } catch (e) {
        console.warn('IndexedDB failed:', e);
    }
    
    // 2. Check if offline
    if (!navigator.onLine) {
        return null;  // Graceful fallback
    }
    
    // 3. Fetch from Supabase
    const { data, error } = await supabaseClient.from('table').select('*');
    if (error) throw error;
    
    // 4. Cache to IndexedDB
    await idb.saveData(data);
    
    return data;
}
```

### 8.3 Single Source of Truth

- **One `loadActiveProject()` function** — in data-layer.js
- **One `loadProjects()` function** — in data-layer.js
- **All pages import from data-layer.js**

### 8.4 File Organization

```
js/
├── config.js              # Supabase client
├── storage-keys.js        # localStorage keys
├── data-layer.js          # NEW: All data loading/saving
├── supabase-utils.js      # Converters only
├── indexeddb-utils.js     # IndexedDB operations
├── ui-utils.js            # UI helpers
├── pages/
│   ├── index.js
│   ├── quick-interview.js
│   ├── report.js
│   ├── finalreview.js
│   └── ...
```

---

## 9. Summary

### Root Causes of Current Issues

1. **Duplicate `loadActiveProject()` functions** that don't use IndexedDB
2. **Inconsistent property naming** (`name` vs `project_name` vs `projectName`)
3. **No shared data layer** — each page implements its own loading logic
4. **Converters not used consistently** — raw Supabase data leaks through

### Quick Wins (Can Fix Tonight)

1. ~~Revert PRs #27-29~~ ✅ Done
2. Audit and fix property name access in quick-interview.js `loadActiveProject()`
3. Make quick-interview.js use IndexedDB-first pattern

### Longer Term

1. Create shared data-layer.js
2. Migrate all pages to use it
3. Re-implement offline photos properly
4. Split quick-interview.js into smaller modules

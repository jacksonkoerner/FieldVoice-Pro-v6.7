# FieldVoice Pro - Voice-Powered Construction Field Reporting System

## Overview

**FieldVoice Pro** is a mobile-optimized Progressive Web Application (PWA) designed for construction field documentation. It enables Resident Project Representatives (RPRs), field engineers, and inspectors to quickly document daily work activities using native device dictation, generating professional DOT-compliant reports.

### Primary Use Case
- **Target Users**: Construction inspectors, Resident Project Representatives (RPRs), field engineers
- **Industry Focus**: DOT (Department of Transportation) construction projects
- **Deployment**: Configurable for any construction project

### Key Value Propositions
- Save 1+ hour daily on field documentation
- Ensure DOT compliance with structured reporting
- GPS-verified, timestamped reports for legal protection
- Optimized for mobile field use with native keyboard dictation support
- Automated project setup via document import from existing reports
- Multi-device sync via Supabase cloud storage

## Quick Start

1. **First Visit**: Open the app and complete permission setup at `permissions.html`
2. **Create a Project**: Go to `project-config.html` to add a new project (manual or document import)
3. **Begin Daily Report**: From `index.html`, tap "Begin Daily Report" to start capturing
4. **Choose Capture Mode**: Select "Quick Notes" (minimal) or "Guided Sections" (structured)
5. **Document Work**: Use native keyboard dictation to record activities, take photos
6. **Finish & Review**: Tap "Finish" to process with AI, then review/edit in `report.html`
7. **Submit**: Finalize in `finalreview.html` and submit to archives

## Pages

| Page | Lines | Purpose |
|------|-------|---------|
| `index.html` | 1,002 | Home dashboard with project selection, weather display, and navigation |
| `quick-interview.html` | 3,912 | Daily report capture with dual modes (Quick Notes / Guided Sections) |
| `report.html` | 3,219 | AI-populated editable DOT form with Form View and Original Notes tabs |
| `finalreview.html` | 2,273 | Read-only DOT RPR Daily Report viewer with print-optimized layout |
| `archives.html` | 477 | Report history with swipe-to-delete and date-sorted list |
| `drafts.html` | 614 | Drafts & offline queue management for pending reports |
| `permissions.html` | 1,530 | Permission testing (mic, camera, GPS) with iOS/Android instructions |
| `permission-debug.html` | 1,008 | Permission debugging and troubleshooting utility |
| `project-config.html` | 1,857 | Project management with document import, contractors, equipment |
| `settings.html` | 458 | Inspector profile (name, title, company, signature preview) |
| `landing.html` | 1,494 | Marketing/onboarding landing page |
| `admin-debug.html` | 273 | Admin debugging tool for data investigation |

## Technology Stack

### Frontend
| Technology | Purpose | Version/Source |
|------------|---------|----------------|
| **Tailwind CSS** | Utility-first CSS framework | CDN (`cdn.tailwindcss.com`) |
| **Font Awesome** | Icon library | v6.4.0 CDN |
| **Vanilla JavaScript** | Core application logic | ES6+ |

### Backend & Storage
| Service | Purpose | Notes |
|---------|---------|-------|
| **Supabase** | PostgreSQL database, authentication, real-time sync | Cloud-hosted at `ruzadotbgkjhgwkvotlz.supabase.co` |

### External APIs & Services
| Service | Purpose | Authentication |
|---------|---------|----------------|
| **Open-Meteo API** | Real-time weather data | None (free, no key required) |
| **n8n Webhooks** | AI text refinement, document extraction | HTTPS endpoints |

### Browser APIs Used
| API | Purpose |
|-----|---------|
| MediaDevices API | Camera access |
| Geolocation API | GPS coordinates for photos/weather |
| Canvas API | Image compression |
| localStorage | Device-specific state (active project, permission flags) |
| Service Worker API | Offline caching and PWA support |
| FileReader API | Document import and image handling |
| Drag and Drop API | File upload for document import |

---

# For Claude Code

This section contains technical reference information for AI assistants and developers working on the codebase.

## Project Structure

```
/
├── index.html              # Home dashboard / main entry point
├── quick-interview.html    # Daily report flow (dual capture modes)
├── report.html             # AI-populated editable DOT form
├── finalreview.html        # Read-only DOT RPR Daily Report viewer
├── archives.html           # Report archives with swipe-to-delete
├── drafts.html             # Drafts & offline queue management
├── permissions.html        # Permission testing (mic, camera, GPS)
├── permission-debug.html   # Permission debugging utility
├── project-config.html     # Project & contractor configuration
├── settings.html           # Inspector profile settings
├── landing.html            # Marketing/onboarding landing page
├── admin-debug.html        # Admin debugging tool
├── manifest.json           # PWA manifest
├── package.json            # NPM config (Sharp for icon generation)
├── generate-icons.js       # PWA icon generation script
├── assets/                 # Favicon and browser icons
├── icons/                  # PWA app icons (various sizes)
├── js/                     # Shared JavaScript modules
│   ├── config.js           # Supabase credentials and constants
│   ├── storage-keys.js     # NEW - v6 localStorage structure and helpers
│   ├── report-rules.js     # NEW - v6 business rules enforcement
│   ├── supabase-utils.js   # UPDATED - v6 schema converters
│   ├── pwa-utils.js        # PWA registration, offline banner
│   ├── ui-utils.js         # UI helper functions
│   ├── media-utils.js      # Photo capture, compression, GPS
│   ├── project-config.js   # NEW - extracted from project-config.html
│   ├── sw.js               # Service worker for PWA
│   └── README.md           # Module documentation
├── docs/                   # Technical documentation
│   ├── application-workflows.md      # Detailed workflow diagrams
│   ├── current-data-flow.md          # Data flow mapping
│   ├── data-flow-audit.md            # Table usage audit by page
│   ├── supabase-schema.md            # Database schema docs
│   ├── project-config-spec.md        # Page spec
│   ├── quick-interview-spec.md       # Page spec
│   ├── report-page-spec.md           # Page spec
│   ├── finalreview-spec.md           # Page spec
│   └── report-finalreview-archives-investigation.md
├── migrations/             # Database migration scripts
│   └── 001_add_guided_section_columns.sql
└── README.md
```

## Shared JavaScript Modules

All shared code lives in `/js/`. Import these files instead of duplicating functions inline.

| File | Lines | Exports | Purpose |
|------|-------|---------|---------|
| `config.js` | ~11 | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `supabaseClient`, `ACTIVE_PROJECT_KEY` | Supabase credentials and app constants |
| `storage-keys.js` | ~180 | `STORAGE_KEYS`, `getDeviceId`, `getStorageItem`, `setStorageItem`, `removeStorageItem`, `getCurrentReport`, `saveCurrentReport`, `deleteCurrentReport`, `getActiveProject`, `addToSyncQueue`, `getSyncQueue`, `clearSyncQueue` | v6 localStorage structure and helpers |
| `report-rules.js` | ~350 | `REPORT_STATUS`, `CAPTURE_MODE`, `GUIDED_SECTIONS`, `TOGGLE_SECTIONS`, `canStartNewReport`, `getProjectsEligibleForNewReport`, `getReportsByUrgency`, `canTransitionStatus`, `getNextValidStatus`, `isReportEditable`, `canReturnToNotes`, `canChangeToggle`, `getSectionToggleState`, `canSwitchCaptureMode`, `getTodayDateString`, `isReportFromToday`, `isReportLate`, `validateReportForAI`, `validateReportForSubmit` | v6 business rules enforcement |
| `supabase-utils.js` | ~350 | `fromSupabaseProject`, `toSupabaseProject`, `fromSupabaseContractor`, `toSupabaseContractor`, `fromSupabaseReport`, `toSupabaseReport`, `fromSupabaseEntry`, `toSupabaseEntry`, `fromSupabaseRawCapture`, `toSupabaseRawCapture`, `fromSupabaseAIResponse`, `toSupabaseAIResponse`, `fromSupabaseFinal`, `toSupabaseFinal`, `fromSupabasePhoto`, `toSupabasePhoto` | v6 Supabase data converters |
| `pwa-utils.js` | ~132 | `initPWA`, `setupPWANavigation`, `registerServiceWorker`, `setupOfflineBanner`, `injectOfflineBanner` | Service worker registration, offline detection |
| `ui-utils.js` | ~188 | `escapeHtml`, `generateId`, `showToast`, `formatDate`, `formatTime`, `autoExpand`, `initAutoExpand`, `initAllAutoExpandTextareas` | XSS prevention, ID generation, notifications, formatting |
| `media-utils.js` | ~145 | `readFileAsDataURL`, `dataURLtoBlob`, `compressImage`, `getHighAccuracyGPS` | File reading, image compression, GPS |
| `project-config.js` | ~1007 | (page-specific) | Project and contractor management UI |
| `sw.js` | ~214 | (Service Worker) | Cache-first static, network-first API |

### Usage Pattern

HTML files should include shared modules:
```html
<script src="./js/config.js"></script>
<script src="./js/supabase-utils.js"></script>
<script src="./js/pwa-utils.js"></script>
<script src="./js/ui-utils.js"></script>
<script src="./js/media-utils.js"></script>
```

Then at end of page:
```javascript
initPWA(); // Registers service worker and sets up offline banner
```

## Data Model

### Supabase Tables

| Table | Purpose |
|-------|---------|
| `user_profiles` | Inspector name, title, company, email, phone |
| `projects` | Project details, contractor roster (jsonb) |
| `reports` | Report metadata (project_id, date, status) |
| `report_raw_capture` | Field notes (transcript, guided_notes, site_conditions, work_summary) |
| `report_contractor_work` | Per-contractor work narratives, equipment used, crew |
| `report_personnel` | Personnel counts by role (superintendents, foremen, operators, etc.) |
| `report_equipment_usage` | Equipment hours utilized per piece |
| `report_photos` | Photo data (base64), captions, GPS coordinates |
| `report_ai_response` | AI-generated content, model info, processing time |
| `report_user_edits` | Field-level edit tracking (original vs edited values) |
| `report_final` | Finalized report content, signature, submission timestamp |

**Note on Equipment (v6):**
- Equipment is no longer stored at the project level
- Equipment is entered fresh during each report in quick-interview.html
- This matches the v6 architecture where equipment usage varies daily

### Key Table Schemas

**projects**
- `id` (UUID PK), `project_name`, `noab_project_no`, `cno_solicitation_no`
- `location`, `engineer`, `prime_contractor`
- `notice_to_proceed` (date), `contract_duration` (int), `weather_days` (int)
- `expected_completion` (date), `default_start_time`, `default_end_time`
- `logo` (bytea), `logo_thumbnail` (text), `logo_url` (text), `status` ("active"/"archived")
- `created_at`, `updated_at`

**reports**
- `id` (UUID PK), `project_id` (FK), `report_date`, `status` ("draft"/"submitted"/"finalized")

**report_photos**
- `id` (UUID PK), `report_id` (FK), `photo_data` (base64), `caption`
- `gps_lat`, `gps_lng`, `gps_accuracy`, `timestamp`, `original_filename`

## Application Workflows

### Report Creation Flow
```
index.html → quick-interview.html → report.html → finalreview.html → archives.html
```

### Capture Modes in quick-interview.html

The page offers two capture modes (toggle at top):

1. **Quick Notes (Minimal)**: Single freeform textarea for fast dictation-first workflow
2. **Guided Sections**: 5 expandable section cards with structured input:
   - Weather & Site Conditions (`data-section="weather"`)
   - Contractor Activities (`data-section="activities"`)
   - Issues & Delays (`data-section="issues"`)
   - Safety (`data-section="safety"`)
   - Progress Photos (`data-section="photos"`)

### AI Processing
- Webhook: `https://advidere.app.n8n.cloud/webhook/fieldvoice-refine-v6`
- Triggered on "Finish" in quick-interview.html
- Returns AI-refined content stored in `report_ai_response`

### Document Import
- Webhook: `https://advidere.app.n8n.cloud/webhook/fieldvoice-project-extractor`
- Used in project-config.html for PDF/DOCX extraction
- Auto-populates project fields from existing reports

## localStorage Keys

Device-specific state (v6 structure from STORAGE_KEYS):

| Key | Purpose |
|-----|---------|
| `fvp_user_profile` | User's profile info |
| `fvp_projects` | All projects with contractors |
| `fvp_active_project_id` | Currently selected project |
| `fvp_current_reports` | Reports in progress (keyed by report ID) |
| `fvp_ai_reports` | AI responses being edited |
| `fvp_drafts` | Reports saved for later |
| `fvp_sync_queue` | Operations waiting to sync |
| `fvp_last_sync` | Timestamp of last sync |
| `fvp_device_id` | Unique device identifier |

**Note:** `fvp_quick_interview_draft`, `fvp_offline_queue`, `fvp_ai_response_{reportId}` and other old keys deprecated in v6

Additional keys (permission/UI state):

| Key | Purpose |
|-----|---------|
| `fvp_cached_weather` | Cached weather data with timestamp |
| `fvp_mic_granted` | Microphone permission status |
| `fvp_cam_granted` | Camera permission status |
| `fvp_loc_granted` | Location permission status |
| `fvp_onboarded` | First-time onboarding completed |
| `fvp_banner_dismissed` | Permission warning banner dismissed |
| `fvp_dictation_hint_dismissed` | Dictation hint dismissed |

## Code Organization Guidelines

### Rules for Working on This Codebase

1. **Check `/js/` first** before adding a function to an HTML file
2. **If a function is needed in 2+ files**, move it to `/js/`
3. **Never duplicate Supabase credentials** - import from `config.js`
4. **Never duplicate converter functions** - import from `supabase-utils.js`
5. **Use `escapeHtml()` from ui-utils.js** for any user-generated content displayed in HTML

### Migration Status

All shared modules are complete. v6 migration in progress.

| Module | Status |
|--------|--------|
| config.js | ✅ Complete |
| storage-keys.js | ✅ Complete (v6) |
| report-rules.js | ✅ Complete (v6) |
| supabase-utils.js | ✅ Complete (v6 schema) |
| pwa-utils.js | ✅ Complete |
| ui-utils.js | ✅ Complete |
| media-utils.js | ✅ Complete |
| project-config.js | ✅ Complete (extracted from HTML) |

## Configuration

### Supabase
```javascript
const SUPABASE_URL = 'https://ruzadotbgkjhgwkvotlz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### Tailwind Theme Colors
```javascript
colors: {
    'dot-navy': '#0a1628',      // Primary dark blue
    'dot-blue': '#1e3a5f',      // Secondary blue
    'dot-slate': '#334155',     // Neutral slate
    'dot-orange': '#ea580c',    // Warning/action orange
    'dot-yellow': '#f59e0b',    // Accent yellow
    'safety-green': '#16a34a',  // Success/safety green
}
```

### n8n Webhook Endpoints
| Endpoint | Location | Purpose |
|----------|----------|---------|
| `fieldvoice-refine-v6` | quick-interview.html | AI processing on finish |
| `fieldvoice-project-extractor` | project-config.html | Document extraction |

---

# Development & Deployment

## PWA & Offline Support

### Installation
- **iOS**: Share → Add to Home Screen
- **Android**: Menu → Install app

### Service Worker (`js/sw.js`)
- Cache-first for static assets (HTML, manifest, icons)
- Network-first for API calls (weather, webhooks)
- Version: `CACHE_VERSION = 'v1.11.0'`

### Offline Capabilities
| Feature | Offline | Notes |
|---------|---------|-------|
| App Loading | ✅ Full | Cached by service worker |
| View Cached Reports | ✅ Partial | Previously loaded reports |
| Photo Capture | ✅ Full | Stored locally until sync |
| Weather Sync | ❌ None | Requires internet |
| AI Refinement | ❌ None | Queued for retry |

### PWA Meta Tags (all HTML files)
```html
<link rel="manifest" href="./manifest.json">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#0a1628">
```

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome (Desktop/Android) | Full |
| Firefox | Full |
| Safari (Desktop) | Full |
| Safari (iOS) | Full (requires dictation enabled in iOS settings) |
| Edge | Full |

### Requirements
- **HTTPS** required for camera, microphone, geolocation APIs
- **JavaScript** required (no graceful degradation)
- **Cookies/Storage** required for Supabase auth

## Development Notes

### No Build Process
Static HTML/JS/CSS application. No bundlers required.

### Testing Locally
```bash
python -m http.server 8000
# or
npx serve .
```

### Adding New Report Sections
1. Add section HTML to `quick-interview.html`
2. Add Supabase table/column if needed
3. Update `buildProcessPayload()` for AI processing
4. Add rendering in `report.html` and `finalreview.html`

## Security Considerations

### Data Privacy
- All report data stored in Supabase with row-level security
- Photos stored as base64 in Supabase
- GPS coordinates embedded in photos for audit purposes

### Supabase Security
- Row-level security (RLS) policies protect data
- Anonymous key used for public operations
- Service role key (if used) should never be exposed client-side

### Webhook Security
- Webhook URLs should be configured with appropriate authentication in n8n
- All webhook endpoints use HTTPS

### HTTPS Requirement
- Camera, microphone, and geolocation APIs require secure context (HTTPS)
- Development with localhost is allowed by browsers

## File Size Reference

| File | Lines |
|------|-------|
| index.html | 1,002 |
| quick-interview.html | 3,912 |
| report.html | 3,219 |
| finalreview.html | 2,273 |
| archives.html | 477 |
| drafts.html | 614 |
| permissions.html | 1,530 |
| permission-debug.html | 1,008 |
| project-config.html | 1,857 |
| settings.html | 458 |
| landing.html | 1,494 |
| admin-debug.html | 273 |
| js/config.js | ~11 |
| js/storage-keys.js | ~180 |
| js/report-rules.js | ~350 |
| js/supabase-utils.js | ~350 |
| js/pwa-utils.js | ~132 |
| js/ui-utils.js | ~188 |
| js/media-utils.js | ~145 |
| js/project-config.js | ~1007 |
| js/sw.js | ~214 |
| **Total HTML** | **~18,117** |
| **Total JS** | **~2,577** |

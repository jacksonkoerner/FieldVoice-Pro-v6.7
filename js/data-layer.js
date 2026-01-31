/**
 * FieldVoice Pro v6.7 — Data Layer
 *
 * Single source of truth for all data operations.
 * All pages import from here instead of implementing their own loading logic.
 *
 * Storage Strategy (Post-PowerSync Migration):
 * - PowerSync: All structured data (projects, contractors, reports, user profiles)
 *              Auto-syncs with Supabase, works offline
 * - localStorage: UI state only (active_project_id, device_id, drafts)
 * - IndexedDB (via idb): Photo blobs only (temporary until uploaded to Supabase Storage)
 *
 * Pattern: PowerSync-first (handles sync automatically)
 */

(function() {
    'use strict';

    // ========================================
    // TIMEOUT UTILITY
    // ========================================

    /**
     * Wrap a promise with a timeout to prevent UI hangs
     * @param {Promise} promise - The promise to wrap
     * @param {number} ms - Timeout in milliseconds (default: 5000)
     * @param {string} errorMsg - Error message on timeout
     * @returns {Promise} - Resolves/rejects based on which completes first
     */
    async function withTimeout(promise, ms = 5000, errorMsg = 'Operation timed out') {
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(errorMsg)), ms)
        );
        return Promise.race([promise, timeout]);
    }

    // ========================================
    // PROJECTS
    // ========================================

    /**
     * Load all projects from PowerSync (auto-syncs with Supabase)
     * PowerSync handles offline caching automatically - no manual refresh needed
     * @returns {Promise<Array>} Array of project objects (JS format, camelCase)
     */
    async function loadProjects() {
        const userId = getStorageItem(STORAGE_KEYS.USER_ID);

        try {
            // Query PowerSync for projects (with timeout protection)
            const whereClause = userId ? { created_by: userId } : {};
            const projects = await withTimeout(
                window.PowerSyncClient.getAll('projects', {
                    where: whereClause,
                    orderBy: 'project_name'
                }),
                5000,
                'loadProjects: PowerSync query timed out'
            );

            // Query contractors separately (PowerSync doesn't support JOINs)
            const contractors = await withTimeout(
                window.PowerSyncClient.getAll('contractors'),
                5000,
                'loadProjects: contractors query timed out'
            );

            // Normalize and attach contractors to each project
            const normalized = projects.map(p => {
                const project = normalizeProject(p);
                project.contractors = contractors
                    .filter(c => c.project_id === p.id)
                    .map(c => normalizeContractor(c));
                return project;
            });

            // Cache to localStorage for report-rules.js compatibility
            const projectsMap = {};
            normalized.forEach(p => { projectsMap[p.id] = p; });
            setStorageItem(STORAGE_KEYS.PROJECTS, projectsMap);

            console.log('[DATA] Loaded projects from PowerSync:', normalized.length);
            return normalized;
        } catch (e) {
            console.error('[DATA] PowerSync query failed:', e);
            return [];
        }
    }

    /**
     * @deprecated PowerSync handles sync automatically. Just call loadProjects().
     * Kept for backwards compatibility with existing callers.
     * @returns {Promise<Array>} Array of project objects with contractors
     */
    async function refreshProjectsFromCloud() {
        console.log('[DATA] refreshProjectsFromCloud() deprecated - PowerSync syncs automatically');
        // Just return loadProjects() - PowerSync already has the latest data
        return loadProjects();
    }

    /**
     * Load active project with contractors from PowerSync
     * PowerSync handles offline caching automatically
     * @returns {Promise<Object|null>} Project object with contractors, or null
     */
    async function loadActiveProject() {
        const activeId = getStorageItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
        if (!activeId) {
            console.log('[DATA] No active project ID set');
            return null;
        }

        const userId = getStorageItem(STORAGE_KEYS.USER_ID);

        try {
            // Query PowerSync for the project by ID (with timeout protection)
            const projectRow = await withTimeout(
                window.PowerSyncClient.get('projects', activeId),
                5000,
                'loadActiveProject: PowerSync query timed out'
            );

            if (!projectRow) {
                console.log('[DATA] Active project not found in PowerSync:', activeId);
                return null;
            }

            // Verify user ownership if userId is set
            if (userId && projectRow.created_by !== userId) {
                console.log('[DATA] Active project belongs to different user');
                return null;
            }

            // Query contractors for this project (with timeout protection)
            const contractors = await withTimeout(
                window.PowerSyncClient.getAll('contractors', {
                    where: { project_id: activeId }
                }),
                5000,
                'loadActiveProject: contractors query timed out'
            );

            // Normalize project and attach contractors
            const project = normalizeProject(projectRow);
            project.contractors = contractors.map(c => normalizeContractor(c));

            console.log('[DATA] Loaded active project from PowerSync:', activeId);
            return project;
        } catch (e) {
            console.error('[DATA] PowerSync query failed:', e);
            return null;
        }
    }

    /**
     * Set the active project ID
     * @param {string} projectId
     */
    function setActiveProjectId(projectId) {
        setStorageItem(STORAGE_KEYS.ACTIVE_PROJECT_ID, projectId);
        console.log('[DATA] Set active project ID:', projectId);
    }

    /**
     * Get the active project ID
     * @returns {string|null}
     */
    function getActiveProjectId() {
        return getStorageItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
    }

    // ========================================
    // NORMALIZERS (handle mixed formats)
    // ========================================

    /**
     * Normalize project object to consistent JS format
     * Handles: raw Supabase (snake_case), converted (camelCase), or mixed
     */
    function normalizeProject(p) {
        if (!p) return null;
        return {
            id: p.id,
            projectName: p.projectName || p.project_name || '',
            location: p.location || '',
            status: p.status || 'active',
            primeContractor: p.primeContractor || p.prime_contractor || '',
            engineer: p.engineer || '',
            logo: p.logo || null,
            cnoSolicitationNo: p.cnoSolicitationNo || p.cno_solicitation_no || '',
            noabProjectNo: p.noabProjectNo || p.noab_project_no || '',
            contractDuration: p.contractDuration || p.contract_duration || '',
            noticeToProceed: p.noticeToProceed || p.notice_to_proceed || '',
            expectedCompletion: p.expectedCompletion || p.expected_completion || '',
            weatherDays: p.weatherDays || p.weather_days || 0,
            defaultStartTime: p.defaultStartTime || p.default_start_time || '',
            defaultEndTime: p.defaultEndTime || p.default_end_time || '',
            createdBy: p.createdBy || p.created_by || '',
            contractors: p.contractors || []
        };
    }

    /**
     * Normalize contractor object to consistent JS format
     */
    function normalizeContractor(c) {
        if (!c) return null;
        return {
            id: c.id,
            projectId: c.projectId || c.project_id || '',
            name: c.name || '',
            company: c.company || '',
            abbreviation: c.abbreviation || '',
            type: c.type || 'sub',
            trades: c.trades || '',
            status: c.status || 'active',
            addedDate: c.addedDate || c.added_date || '',
            removedDate: c.removedDate || c.removed_date || ''
        };
    }

    // ========================================
    // USER SETTINGS
    // ========================================

    /**
     * Load user settings from PowerSync (auto-syncs with Supabase)
     * PowerSync handles offline caching automatically
     * @returns {Promise<Object|null>} User settings object or null
     */
    async function loadUserSettings() {
        const deviceId = getStorageItem(STORAGE_KEYS.DEVICE_ID);
        if (!deviceId) {
            console.log('[DATA] No device ID set');
            return null;
        }

        try {
            // Query PowerSync for user profile by device_id (with timeout protection)
            const profiles = await withTimeout(
                window.PowerSyncClient.getAll('user_profiles', {
                    where: { device_id: deviceId },
                    limit: 1
                }),
                5000,
                'loadUserSettings: PowerSync query timed out'
            );

            if (!profiles || profiles.length === 0) {
                console.log('[DATA] No user profile found for device:', deviceId);
                return null;
            }

            const settings = normalizeUserSettings(profiles[0]);
            console.log('[DATA] Loaded user settings from PowerSync');
            return settings;
        } catch (e) {
            console.error('[DATA] PowerSync query failed:', e);
            return null;
        }
    }

    /**
     * Save user settings to PowerSync (auto-syncs with Supabase)
     * PowerSync handles offline queue automatically
     * @param {Object} settings - User settings object
     * @returns {Promise<boolean>} Success status
     */
    async function saveUserSettings(settings) {
        const normalized = normalizeUserSettings(settings);
        if (!normalized) {
            console.error('[DATA] Cannot save user settings: invalid settings');
            return false;
        }

        try {
            // Convert to snake_case for PowerSync/Supabase
            const record = {
                id: normalized.id || crypto.randomUUID(),
                device_id: normalized.deviceId || window.getDeviceId(),
                full_name: normalized.fullName || '',
                title: normalized.title || '',
                company: normalized.company || '',
                email: normalized.email || '',
                phone: normalized.phone || ''
            };

            await withTimeout(
                window.PowerSyncClient.save('user_profiles', record),
                5000,
                'saveUserSettings: PowerSync save timed out'
            );
            console.log('[DATA] User settings saved to PowerSync');
            return true;
        } catch (e) {
            console.error('[DATA] Failed to save user settings:', e);
            return false;
        }
    }

    /**
     * Normalize user settings to consistent JS format
     */
    function normalizeUserSettings(s) {
        if (!s) return null;
        return {
            id: s.id,
            deviceId: s.deviceId || s.device_id || '',
            fullName: s.fullName || s.full_name || '',
            title: s.title || '',
            company: s.company || '',
            email: s.email || '',
            phone: s.phone || ''
        };
    }

    // ========================================
    // DRAFTS (localStorage only — temporary data)
    // ========================================

    /**
     * Get current draft for a project/date
     */
    function getCurrentDraft(projectId, date) {
        const reports = getStorageItem(STORAGE_KEYS.CURRENT_REPORTS) || {};
        const key = `${projectId}_${date}`;
        return reports[key] || null;
    }

    /**
     * Save draft (called on every keystroke, debounced by caller)
     */
    function saveDraft(projectId, date, data) {
        const reports = getStorageItem(STORAGE_KEYS.CURRENT_REPORTS) || {};
        const key = `${projectId}_${date}`;
        reports[key] = {
            ...data,
            updatedAt: new Date().toISOString()
        };
        setStorageItem(STORAGE_KEYS.CURRENT_REPORTS, reports);
        console.log('[DATA] Draft saved:', key);
    }

    /**
     * Delete a draft
     */
    function deleteDraft(projectId, date) {
        const reports = getStorageItem(STORAGE_KEYS.CURRENT_REPORTS) || {};
        const key = `${projectId}_${date}`;
        delete reports[key];
        setStorageItem(STORAGE_KEYS.CURRENT_REPORTS, reports);
        console.log('[DATA] Draft deleted:', key);
    }

    /**
     * Get all drafts (for drafts.html)
     */
    function getAllDrafts() {
        const reports = getStorageItem(STORAGE_KEYS.CURRENT_REPORTS) || {};
        return Object.entries(reports).map(([key, data]) => ({
            key,
            ...data
        }));
    }

    // ========================================
    // PHOTOS (IndexedDB — temporary until submitted)
    // ========================================

    /**
     * Save photo to IndexedDB
     */
    async function savePhoto(photo) {
        const photoRecord = {
            id: photo.id || `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            reportId: photo.reportId,
            blob: photo.blob,
            caption: photo.caption || '',
            timestamp: photo.timestamp || new Date().toISOString(),
            gps: photo.gps || null,
            syncStatus: 'pending',
            supabaseId: null,
            storagePath: null
        };
        await window.idb.savePhoto(photoRecord);
        console.log('[DATA] Photo saved to IndexedDB:', photoRecord.id);
        return photoRecord;
    }

    /**
     * Get all photos for a report
     */
    async function getPhotos(reportId) {
        try {
            const photos = await window.idb.getPhotosByReportId(reportId);
            return photos || [];
        } catch (e) {
            console.warn('[DATA] Failed to get photos:', e);
            return [];
        }
    }

    /**
     * Delete photo from IndexedDB
     */
    async function deletePhoto(photoId) {
        try {
            await window.idb.deletePhoto(photoId);
            console.log('[DATA] Photo deleted:', photoId);
        } catch (e) {
            console.warn('[DATA] Failed to delete photo:', e);
        }
    }

    // ========================================
    // AI RESPONSE CACHE (PowerSync — auto-syncs with Supabase)
    // ========================================

    /**
     * Cache AI response to PowerSync (auto-syncs with Supabase)
     * @param {string} reportId - The active_report_id
     * @param {Object} response - The AI response payload
     */
    async function cacheAIResponse(reportId, response) {
        try {
            const record = {
                id: crypto.randomUUID(),
                active_report_id: reportId,
                generated_content: typeof response === 'string' ? response : JSON.stringify(response),
                raw_response: JSON.stringify(response),
                created_at: new Date().toISOString()
            };

            await window.PowerSyncClient.save('ai_responses', record);
            console.log('[DATA] AI response cached to PowerSync:', reportId);
        } catch (e) {
            console.error('[DATA] Failed to cache AI response:', e);
            // Fallback to localStorage for resilience
            const cache = getStorageItem('fvp_ai_cache') || {};
            cache[reportId] = { response, cachedAt: new Date().toISOString() };
            setStorageItem('fvp_ai_cache', cache);
        }
    }

    /**
     * Get cached AI response from PowerSync
     * @param {string} reportId - The active_report_id
     * @returns {Object|null} The AI response or null
     */
    async function getCachedAIResponse(reportId) {
        try {
            // Query PowerSync for the most recent AI response for this report
            const responses = await window.PowerSyncClient.getAll('ai_responses', {
                where: { active_report_id: reportId },
                orderBy: 'created_at',
                orderDesc: true,
                limit: 1
            });

            if (responses && responses.length > 0) {
                const rawResponse = responses[0].raw_response;
                try {
                    return JSON.parse(rawResponse);
                } catch {
                    return rawResponse;
                }
            }
            return null;
        } catch (e) {
            console.warn('[DATA] Failed to get AI response from PowerSync:', e);
            // Fallback to localStorage
            const cache = getStorageItem('fvp_ai_cache') || {};
            return cache[reportId]?.response || null;
        }
    }

    /**
     * Clear AI response cache for a report
     * Note: PowerSync entries persist (for history); this clears localStorage fallback
     * @param {string} reportId - The active_report_id
     */
    function clearAIResponseCache(reportId) {
        // Clear localStorage fallback
        const cache = getStorageItem('fvp_ai_cache') || {};
        delete cache[reportId];
        setStorageItem('fvp_ai_cache', cache);
        // Note: PowerSync ai_responses are kept for audit trail
        console.log('[DATA] AI response cache cleared for:', reportId);
    }

    // ========================================
    // ARCHIVES (PowerSync — auto-syncs with Supabase)
    // ========================================

    /**
     * Load archived reports from PowerSync (auto-syncs with Supabase)
     * PowerSync handles offline caching automatically
     */
    async function loadArchivedReports(limit = 20) {
        try {
            const userId = getStorageItem(STORAGE_KEYS.USER_ID);

            // Query PowerSync for final_reports
            const whereClause = userId ? { submitted_by: userId } : {};
            const reports = await window.PowerSyncClient.getAll('final_reports', {
                where: whereClause,
                orderBy: 'submitted_at',
                orderDesc: true,
                limit: limit
            });

            // Query projects for names (PowerSync doesn't support JOINs)
            const projects = await window.PowerSyncClient.getAll('projects');
            const projectMap = {};
            projects.forEach(p => { projectMap[p.id] = p; });

            // Attach project info to each report
            const enriched = reports.map(r => ({
                ...r,
                projects: projectMap[r.project_id] ? {
                    id: projectMap[r.project_id].id,
                    project_name: projectMap[r.project_id].project_name
                } : null
            }));

            console.log('[DATA] Loaded archives from PowerSync:', enriched.length);
            return enriched;
        } catch (e) {
            console.error('[DATA] Failed to load archives:', e);
            return [];
        }
    }

    // ========================================
    // SUBMIT (PowerSync — syncs to Supabase)
    // ========================================

    /**
     * Submit final report to PowerSync (auto-syncs with Supabase)
     * PowerSync handles offline queue — works offline now
     * @param {Object} finalData - Report data including reportId and all fields
     * @returns {Promise<boolean>} Success status
     */
    async function submitFinalReport(finalData) {
        const {
            reportId,
            activeReportId,
            projectId,
            reportDate,
            executiveSummary,
            workPerformed,
            materialsUsed,
            delaysIssues,
            inspectorNotes,
            // Weather fields
            generalCondition,
            highTemp,
            lowTemp,
            precipitation,
            windSpeed,
            humidity,
            // Has flags
            hasWorkPerformed,
            hasMaterials,
            hasDelays,
            hasVisitors,
            hasSafety,
            hasPhotos,
            // JSON data
            workPerformedJson,
            materialsJson,
            delaysJson,
            visitorsJson,
            safetyJson,
            photosJson,
            // Notes
            workPerformedNotes,
            materialsNotes,
            delaysNotes,
            visitorsNotes,
            safetyNotes,
            // PDF
            pdfUrl,
            pdfStoragePath
        } = finalData;

        try {
            const userId = getStorageItem(STORAGE_KEYS.USER_ID);

            // Build final report record for PowerSync
            const record = {
                id: reportId || crypto.randomUUID(),
                project_id: projectId || '',
                active_report_id: activeReportId || '',
                report_date: reportDate || new Date().toISOString().split('T')[0],
                submitted_at: new Date().toISOString(),
                submitted_by: userId || '',
                executive_summary: executiveSummary || '',
                work_performed: workPerformed || '',
                materials_used: materialsUsed || '',
                delays_issues: delaysIssues || '',
                inspector_notes: inspectorNotes || '',
                // Weather fields
                general_condition: generalCondition || '',
                high_temp: highTemp || null,
                low_temp: lowTemp || null,
                precipitation: precipitation || '',
                wind_speed: windSpeed || '',
                humidity: humidity || '',
                // Has flags
                has_work_performed: hasWorkPerformed ? 1 : 0,
                has_materials: hasMaterials ? 1 : 0,
                has_delays: hasDelays ? 1 : 0,
                has_visitors: hasVisitors ? 1 : 0,
                has_safety: hasSafety ? 1 : 0,
                has_photos: hasPhotos ? 1 : 0,
                // JSON data
                work_performed_json: workPerformedJson ? JSON.stringify(workPerformedJson) : '',
                materials_json: materialsJson ? JSON.stringify(materialsJson) : '',
                delays_json: delaysJson ? JSON.stringify(delaysJson) : '',
                visitors_json: visitorsJson ? JSON.stringify(visitorsJson) : '',
                safety_json: safetyJson ? JSON.stringify(safetyJson) : '',
                photos_json: photosJson ? JSON.stringify(photosJson) : '',
                // Notes
                work_performed_notes: workPerformedNotes || '',
                materials_notes: materialsNotes || '',
                delays_notes: delaysNotes || '',
                visitors_notes: visitorsNotes || '',
                safety_notes: safetyNotes || '',
                // PDF
                pdf_url: pdfUrl || '',
                pdf_storage_path: pdfStoragePath || ''
            };

            await window.PowerSyncClient.save('final_reports', record);
            console.log('[DATA] Final report submitted to PowerSync:', record.id);
            return true;
        } catch (e) {
            console.error('[DATA] Submit failed:', e);
            throw e;
        }
    }

    /**
     * Clear all temporary data after successful submit
     */
    async function clearAfterSubmit(projectId, date, reportId) {
        deleteDraft(projectId, date);
        clearAIResponseCache(reportId);

        const photos = await getPhotos(reportId);
        for (const photo of photos) {
            await deletePhoto(photo.id);
        }

        console.log('[DATA] Cleared temporary data after submit');
    }

    // ========================================
    // UTILITIES
    // ========================================

    /**
     * Check if online
     */
    function isOnline() {
        return navigator.onLine;
    }

    // ========================================
    // EXPORTS
    // ========================================

    window.dataLayer = {
        // Projects
        loadProjects,
        loadActiveProject,
        refreshProjectsFromCloud,
        setActiveProjectId,
        getActiveProjectId,

        // User Settings
        loadUserSettings,
        saveUserSettings,

        // Drafts (localStorage)
        getCurrentDraft,
        saveDraft,
        deleteDraft,
        getAllDrafts,

        // Photos (IndexedDB)
        savePhoto,
        getPhotos,
        deletePhoto,

        // AI Response Cache
        cacheAIResponse,
        getCachedAIResponse,
        clearAIResponseCache,

        // Archives
        loadArchivedReports,

        // Submit
        submitFinalReport,
        clearAfterSubmit,

        // Normalizers (exposed for edge cases)
        normalizeProject,
        normalizeContractor,
        normalizeUserSettings,

        // Utilities
        isOnline
    };

    console.log('[DATA] Data layer initialized');

})();

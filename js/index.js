// ============================================================================
// FieldVoice Pro v6 - Dashboard (index.js)
//
// Uses:
// - storage-keys.js: STORAGE_KEYS, getStorageItem, setStorageItem, getSyncQueue
// - report-rules.js: getTodayDateString, canStartNewReport, getReportsByUrgency
// - ui-utils.js: escapeHtml, formatDate
// - config.js: supabaseClient
// - supabase-utils.js: fromSupabaseProject
// ============================================================================

// ============ STATE ============
let projectsCache = [];
let activeProjectCache = null;

// ============ PROJECT MANAGEMENT ============

function getProjects() {
    return projectsCache;
}

function getActiveProjectFromCache() {
    return activeProjectCache;
}

function openProjectConfig() {
    window.location.href = 'projects.html';
}

function updateActiveProjectCard() {
    const section = document.getElementById('activeProjectSection');
    const project = getActiveProjectFromCache();

    if (project) {
        section.innerHTML = `
            <div class="bg-white border-l-4 border-safety-green p-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                        <div class="w-10 h-10 bg-safety-green flex items-center justify-center shrink-0">
                            <i class="fas fa-building text-white"></i>
                        </div>
                        <div class="min-w-0">
                            <p class="text-[10px] font-bold text-safety-green uppercase tracking-wider">Active Project</p>
                            <p class="font-bold text-slate-800 truncate">${escapeHtml(project.name)}</p>
                            ${project.noabProjectNo ? `<p class="text-xs text-slate-500">#${escapeHtml(project.noabProjectNo)}</p>` : ''}
                        </div>
                    </div>
                    <a href="projects.html" class="text-dot-blue hover:text-dot-navy transition-colors shrink-0 ml-2" title="Change Project">
                        <i class="fas fa-exchange-alt"></i>
                    </a>
                </div>
            </div>
        `;
    } else {
        section.innerHTML = `
            <a href="projects.html" class="block bg-white border-2 border-dashed border-dot-orange p-4 hover:bg-orange-50 transition-colors">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-dot-orange/10 border-2 border-dot-orange flex items-center justify-center shrink-0">
                        <i class="fas fa-exclamation text-dot-orange"></i>
                    </div>
                    <div class="flex-1">
                        <p class="text-xs font-bold text-dot-orange uppercase tracking-wider">No Project Selected</p>
                        <p class="text-sm text-slate-600">Tap to configure a project</p>
                    </div>
                    <i class="fas fa-chevron-right text-dot-orange"></i>
                </div>
            </a>
        `;
    }
}

function beginDailyReport() {
    showProjectPickerModal();
}

function continueDailyReport() {
    window.location.href = 'quick-interview.html';
}

// ============ PROJECT PICKER MODAL ============
async function showProjectPickerModal() {
    const modal = document.getElementById('projectPickerModal');
    const listContainer = document.getElementById('projectPickerList');

    // Show loading state
    listContainer.innerHTML = `
        <div class="p-8 text-center">
            <i class="fas fa-spinner fa-spin text-slate-400 text-2xl mb-4"></i>
            <p class="text-sm text-slate-500">Loading projects...</p>
        </div>
    `;
    modal.classList.remove('hidden');

    // Load projects from PowerSync (auto-syncs with Supabase)
    let projects = await window.dataLayer.loadProjects();
    projectsCache = projects;
    const activeId = getStorageItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);

    if (projects.length === 0) {
        // No projects configured
        listContainer.innerHTML = `
            <div class="p-8 text-center">
                <div class="w-16 h-16 bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-folder-open text-slate-400 text-2xl"></i>
                </div>
                <p class="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">No Projects Configured</p>
                <p class="text-sm text-slate-500 mb-6">Create a project to start generating daily reports</p>
                <button onclick="goToProjectSetup()" class="w-full p-4 bg-safety-green hover:bg-green-700 text-white font-bold uppercase transition-colors flex items-center justify-center gap-2">
                    <i class="fas fa-plus"></i>
                    Create Project
                </button>
            </div>
        `;
    } else {
        // Check eligibility using report-rules.js
        const eligibilityMap = {};
        for (const project of projects) {
            eligibilityMap[project.id] = canStartNewReport(project.id);
        }

        // Render project list
        listContainer.innerHTML = projects.map(project => {
            const isActive = project.id === activeId;
            const eligibility = eligibilityMap[project.id];
            const canStart = eligibility.allowed;
            const reason = eligibility.reason;

            if (!canStart && reason !== 'CONTINUE_EXISTING') {
                // Project is blocked - show disabled state
                const reasonText = reason === 'UNFINISHED_PREVIOUS' ? 'Has Late Report'
                                 : reason === 'ALREADY_SUBMITTED_TODAY' ? 'Submitted Today'
                                 : 'Unavailable';
                const reasonIcon = reason === 'UNFINISHED_PREVIOUS' ? 'fa-exclamation-triangle'
                                 : reason === 'ALREADY_SUBMITTED_TODAY' ? 'fa-check-circle'
                                 : 'fa-lock';

                return `
                    <div class="w-full p-4 text-left border-b border-slate-200 last:border-b-0 bg-slate-50 opacity-60 cursor-not-allowed">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-slate-400 flex items-center justify-center shrink-0">
                                <i class="fas ${reasonIcon} text-white"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <p class="font-bold text-slate-600 truncate">${escapeHtml(project.name)}</p>
                                    <span class="shrink-0 text-[10px] bg-slate-400 text-white px-2 py-0.5 font-bold uppercase">${reasonText}</span>
                                </div>
                                <p class="text-xs text-slate-500 truncate mt-0.5">
                                    ${project.noabProjectNo ? `#${escapeHtml(project.noabProjectNo)}` : ''}
                                    ${project.noabProjectNo && project.location ? ' • ' : ''}
                                    ${project.location ? escapeHtml(project.location) : ''}
                                    ${!project.noabProjectNo && !project.location ? 'No details' : ''}
                                </p>
                            </div>
                        </div>
                    </div>
                `;
            }

            return `
                <button onclick="selectProjectAndProceed('${project.id}')" class="w-full p-4 text-left hover:bg-slate-50 transition-colors border-b border-slate-200 last:border-b-0 ${isActive ? 'bg-safety-green/5' : ''}">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 ${isActive ? 'bg-safety-green' : 'bg-dot-blue'} flex items-center justify-center shrink-0">
                            <i class="fas ${isActive ? 'fa-check' : 'fa-building'} text-white"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <p class="font-bold text-slate-800 truncate">${escapeHtml(project.name)}</p>
                                ${isActive ? '<span class="shrink-0 text-[10px] bg-safety-green text-white px-2 py-0.5 font-bold uppercase">Active</span>' : ''}
                                ${reason === 'CONTINUE_EXISTING' ? '<span class="shrink-0 text-[10px] bg-dot-orange text-white px-2 py-0.5 font-bold uppercase">In Progress</span>' : ''}
                            </div>
                            <p class="text-xs text-slate-500 truncate mt-0.5">
                                ${project.noabProjectNo ? `#${escapeHtml(project.noabProjectNo)}` : ''}
                                ${project.noabProjectNo && project.location ? ' • ' : ''}
                                ${project.location ? escapeHtml(project.location) : ''}
                                ${!project.noabProjectNo && !project.location ? 'No details' : ''}
                            </p>
                        </div>
                        <i class="fas fa-chevron-right text-slate-400 shrink-0"></i>
                    </div>
                </button>
            `;
        }).join('');
    }
}

function closeProjectPickerModal() {
    document.getElementById('projectPickerModal').classList.add('hidden');
}

async function selectProjectAndProceed(projectId) {
    // Set as active project in localStorage using storage-keys helper
    setStorageItem(STORAGE_KEYS.ACTIVE_PROJECT_ID, projectId);

    // Update cache
    activeProjectCache = await window.dataLayer.loadActiveProject();

    // Update the active project card on dashboard (visible when they return)
    updateActiveProjectCard();

    // Close modal and proceed
    closeProjectPickerModal();
    window.location.href = 'quick-interview.html';
}

function goToProjectSetup() {
    closeProjectPickerModal();
    window.location.href = 'project-config.html';
}

// ============ REPORT CARDS ============
function renderReportCards() {
    const container = document.getElementById('reportCardsSection');
    if (!container) return;

    const { late, todayDrafts, todayReady, todaySubmitted } = getReportsByUrgency();

    // If no reports at all, hide the section
    if (late.length === 0 && todayDrafts.length === 0 && todayReady.length === 0 && todaySubmitted.length === 0) {
        container.innerHTML = '';
        return;
    }

    let html = '';

    // LATE reports (red warning, need immediate attention)
    if (late.length > 0) {
        html += `<div class="mb-3">
            <p class="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">
                <i class="fas fa-exclamation-triangle mr-1"></i>Late Reports
            </p>`;
        late.forEach(report => {
            html += renderReportCard(report, 'late');
        });
        html += '</div>';
    }

    // Today's drafts
    if (todayDrafts.length > 0) {
        html += `<div class="mb-3">
            <p class="text-xs font-bold text-dot-orange uppercase tracking-wider mb-2">In Progress</p>`;
        todayDrafts.forEach(report => {
            html += renderReportCard(report, 'draft');
        });
        html += '</div>';
    }

    // Today's ready for review
    if (todayReady.length > 0) {
        html += `<div class="mb-3">
            <p class="text-xs font-bold text-safety-green uppercase tracking-wider mb-2">Ready for Review</p>`;
        todayReady.forEach(report => {
            html += renderReportCard(report, 'ready');
        });
        html += '</div>';
    }

    // Today's submitted (view only)
    if (todaySubmitted.length > 0) {
        html += `<div class="mb-3">
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Submitted Today</p>`;
        todaySubmitted.forEach(report => {
            html += renderReportCard(report, 'submitted');
        });
        html += '</div>';
    }

    container.innerHTML = html;
}

function renderReportCard(report, type) {
    const projectName = report.project_name || 'Unknown Project';
    const date = formatDate(report.date, 'short');

    const styles = {
        late: { border: 'border-red-500', bg: 'bg-red-50', icon: 'fa-exclamation-circle', iconColor: 'text-red-500' },
        draft: { border: 'border-dot-orange', bg: 'bg-orange-50', icon: 'fa-pen', iconColor: 'text-dot-orange' },
        ready: { border: 'border-safety-green', bg: 'bg-green-50', icon: 'fa-check-circle', iconColor: 'text-safety-green' },
        submitted: { border: 'border-slate-300', bg: 'bg-slate-50', icon: 'fa-archive', iconColor: 'text-slate-400' }
    };

    const style = styles[type] || styles.draft;
    const href = type === 'submitted' ? `archives.html?id=${report.id}` : 'quick-interview.html';

    return `
        <a href="${href}" class="block ${style.bg} border-l-4 ${style.border} p-3 mb-2 hover:bg-opacity-80 transition-colors">
            <div class="flex items-center gap-3">
                <i class="fas ${style.icon} ${style.iconColor}"></i>
                <div class="flex-1 min-w-0">
                    <p class="font-medium text-slate-800 truncate">${escapeHtml(projectName)}</p>
                    <p class="text-xs text-slate-500">${date}</p>
                </div>
                <i class="fas fa-chevron-right text-slate-400"></i>
            </div>
        </a>
    `;
}

// ============ WEATHER ============
async function syncWeather() {
    const syncIcon = document.getElementById('syncIcon');
    const syncBtn = document.getElementById('syncWeatherBtn');
    syncIcon.classList.add('fa-spin');

    try {
        // Check if offline first
        if (!navigator.onLine) {
            document.getElementById('weatherCondition').textContent = 'Offline';
            document.getElementById('weatherIcon').className = 'fas fa-wifi-slash text-2xl text-yellow-500 mb-1';
            syncIcon.classList.remove('fa-spin');
            return;
        }

        if (!navigator.geolocation) {
            throw { code: -1, message: 'Geolocation not supported' };
        }

        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        });

        localStorage.setItem(STORAGE_KEYS.LOC_GRANTED, 'true');

        const { latitude, longitude } = position.coords;
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&temperature_unit=fahrenheit&precipitation_unit=inch`
        );

        if (!response.ok) {
            throw new Error(`Weather API error: ${response.status}`);
        }

        const data = await response.json();

        const weatherCodes = {
            0: { text: 'Clear', icon: 'fa-sun', color: 'text-dot-yellow' },
            1: { text: 'Mostly Clear', icon: 'fa-sun', color: 'text-dot-yellow' },
            2: { text: 'Partly Cloudy', icon: 'fa-cloud-sun', color: 'text-slate-500' },
            3: { text: 'Overcast', icon: 'fa-cloud', color: 'text-slate-500' },
            45: { text: 'Fog', icon: 'fa-smog', color: 'text-slate-400' },
            48: { text: 'Fog', icon: 'fa-smog', color: 'text-slate-400' },
            51: { text: 'Light Drizzle', icon: 'fa-cloud-rain', color: 'text-dot-blue' },
            53: { text: 'Drizzle', icon: 'fa-cloud-rain', color: 'text-dot-blue' },
            55: { text: 'Heavy Drizzle', icon: 'fa-cloud-showers-heavy', color: 'text-dot-blue' },
            61: { text: 'Light Rain', icon: 'fa-cloud-rain', color: 'text-dot-blue' },
            63: { text: 'Rain', icon: 'fa-cloud-showers-heavy', color: 'text-dot-blue' },
            65: { text: 'Heavy Rain', icon: 'fa-cloud-showers-heavy', color: 'text-blue-600' },
            80: { text: 'Showers', icon: 'fa-cloud-showers-heavy', color: 'text-dot-blue' },
            95: { text: 'Thunderstorm', icon: 'fa-bolt', color: 'text-dot-orange' }
        };

        const weatherInfo = weatherCodes[data.current_weather.weathercode] || { text: 'Cloudy', icon: 'fa-cloud', color: 'text-slate-400' };
        const highTemp = Math.round(data.daily.temperature_2m_max[0]);
        const lowTemp = Math.round(data.daily.temperature_2m_min[0]);
        const precip = data.daily.precipitation_sum[0].toFixed(2);

        // Update UI
        document.getElementById('weatherCondition').textContent = weatherInfo.text;
        document.getElementById('weatherTempHigh').textContent = `${highTemp}°`;
        document.getElementById('weatherTempLow').textContent = `${lowTemp}°`;
        document.getElementById('weatherPrecipVal').textContent = `${precip}"`;
        document.getElementById('weatherIcon').className = `fas ${weatherInfo.icon} text-2xl ${weatherInfo.color} mb-1`;
    } catch (error) {
        console.error('Weather sync failed:', error);
        if (error.code === 1) {
            localStorage.removeItem(STORAGE_KEYS.LOC_GRANTED);
            document.getElementById('weatherCondition').textContent = 'Location blocked';
            document.getElementById('weatherIcon').className = 'fas fa-location-crosshairs text-2xl text-red-500 mb-1';
        } else if (error.code === 2) {
            document.getElementById('weatherCondition').textContent = 'GPS unavailable';
        } else if (error.code === 3) {
            document.getElementById('weatherCondition').textContent = 'Timeout';
        } else {
            document.getElementById('weatherCondition').textContent = 'Sync failed';
        }
    }

    const updatedSyncIcon = document.getElementById('syncIcon');
    if (updatedSyncIcon) {
        updatedSyncIcon.classList.remove('fa-spin');
    }
}

// ============ UI UPDATES ============
function updateReportStatus() {
    const statusSection = document.getElementById('reportStatusSection');
    const { late, todayDrafts, todayReady } = getReportsByUrgency();

    // If there are any active reports, don't show "Begin" button
    const hasActiveReports = late.length > 0 || todayDrafts.length > 0 || todayReady.length > 0;

    if (hasActiveReports) {
        // Report cards section handles display
        statusSection.innerHTML = '';
        return;
    }

    // No active reports - show Begin button
    statusSection.innerHTML = `
        <div class="bg-white border-2 border-slate-200 p-6">
            <div class="text-center">
                <div class="w-16 h-16 bg-slate-100 border-2 border-slate-300 flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-clipboard text-slate-400 text-2xl"></i>
                </div>
                <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">No Report Started</p>
                <p class="text-sm text-slate-500 mb-4">Begin documentation to create today's report</p>
                <button onclick="beginDailyReport()" class="block w-full bg-dot-navy hover:bg-dot-blue text-white p-4 transition-colors">
                    <div class="flex items-center justify-center gap-3">
                        <i class="fas fa-plus text-dot-yellow"></i>
                        <span class="font-bold uppercase tracking-wide">Begin Daily Report</span>
                    </div>
                </button>
            </div>
        </div>
    `;
}

// ============ ACTIONS ============
function openSettings() {
    window.location.href = 'settings.html';
}

// ============ PERMISSIONS ============
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const isIOSSafari = isIOS && isSafari;
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function checkPermissionState() {
    const micGranted = localStorage.getItem(STORAGE_KEYS.MIC_GRANTED) === 'true';
    const locGranted = localStorage.getItem(STORAGE_KEYS.LOC_GRANTED) === 'true';
    const onboarded = localStorage.getItem(STORAGE_KEYS.ONBOARDED) === 'true';
    const bannerDismissed = localStorage.getItem(STORAGE_KEYS.BANNER_DISMISSED) === 'true';
    const bannerDismissedDate = localStorage.getItem(STORAGE_KEYS.BANNER_DISMISSED_DATE);

    if (bannerDismissedDate) {
        const dismissedTime = new Date(bannerDismissedDate).getTime();
        const now = new Date().getTime();
        const hoursSinceDismissal = (now - dismissedTime) / (1000 * 60 * 60);
        if (hoursSinceDismissal > 24) {
            localStorage.removeItem(STORAGE_KEYS.BANNER_DISMISSED);
            localStorage.removeItem(STORAGE_KEYS.BANNER_DISMISSED_DATE);
        }
    }

    return {
        micGranted,
        locGranted,
        onboarded,
        bannerDismissed: localStorage.getItem(STORAGE_KEYS.BANNER_DISMISSED) === 'true',
        allGranted: micGranted && locGranted
    };
}

function shouldShowOnboarding() {
    const state = checkPermissionState();
    if (isMobile && !state.onboarded && !state.allGranted) {
        return true;
    }
    return false;
}

function shouldShowBanner() {
    const state = checkPermissionState();
    if (isMobile && state.onboarded && !state.allGranted && !state.bannerDismissed) {
        return true;
    }
    return false;
}

function showPermissionsBanner() {
    const banner = document.getElementById('permissionsBanner');
    banner.classList.remove('hidden');
}

function dismissPermissionsBanner() {
    const banner = document.getElementById('permissionsBanner');
    banner.classList.add('hidden');
    localStorage.setItem(STORAGE_KEYS.BANNER_DISMISSED, 'true');
    localStorage.setItem(STORAGE_KEYS.BANNER_DISMISSED_DATE, new Date().toISOString());
}

async function dismissSubmittedBanner() {
    const banner = document.getElementById('submittedBanner');
    banner.classList.add('hidden');
    sessionStorage.setItem('fvp_submitted_banner_dismissed', 'true');

    // Refresh UI
    renderReportCards();
    updateReportStatus();
}

// ============ DRAFTS/OFFLINE QUEUE ============
function getOfflineQueueCount() {
    // Use getSyncQueue from storage-keys.js
    const queue = getSyncQueue();
    return queue.length;
}

function updateDraftsSection() {
    const count = getOfflineQueueCount();
    const section = document.getElementById('draftsSection');
    const badge = document.getElementById('draftsBadge');
    const description = document.getElementById('draftsDescription');

    if (count > 0) {
        section.classList.remove('hidden');
        badge.textContent = count;
        description.textContent = count === 1 ? '1 item waiting to sync' : `${count} items waiting to sync`;
    } else {
        section.classList.add('hidden');
    }
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
    if (shouldShowOnboarding()) {
        window.location.href = 'permissions.html';
        return;
    }

    if (shouldShowBanner()) {
        showPermissionsBanner();
    }

    // Clean up old AI response caches (older than 24 hours)
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('fvp_ai_response_')) {
            try {
                const cached = JSON.parse(localStorage.getItem(key));
                const cachedAt = new Date(cached.cachedAt);
                const hoursSince = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60);
                if (hoursSince > 24) {
                    localStorage.removeItem(key);
                    console.log(`[CLEANUP] Removed stale AI cache: ${key}`);
                }
            } catch (e) {
                // Invalid JSON, remove it
                localStorage.removeItem(key);
            }
        }
    }

    // Set current date immediately
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    // ============ ONE-TIME MIGRATION: Clear stale IndexedDB projects (v1.13.0) ============
    // LEGACY: This migration clears old IndexedDB project data (now using PowerSync)
    // NOTE: Migration is now NON-BLOCKING and has a timeout to prevent app hang
    const MIGRATION_KEY = 'fvp_migration_v113_idb_clear';
    if (!localStorage.getItem(MIGRATION_KEY)) {
        console.log('[MIGRATION v1.13.0] Clearing stale IndexedDB projects (non-blocking)...');
        // Run migration in background - don't await, don't block dashboard
        (async () => {
            try {
                if (window.idb && typeof window.idb.clearStore === 'function') {
                    // Timeout migration after 2 seconds to prevent hang
                    const migrationPromise = window.idb.clearStore('projects');
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Migration timeout')), 2000)
                    );
                    await Promise.race([migrationPromise, timeoutPromise]);
                    console.log('[MIGRATION v1.13.0] IndexedDB projects cleared successfully');
                } else {
                    console.log('[MIGRATION v1.13.0] IndexedDB not initialized, skipping clear');
                }
                localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
            } catch (migrationErr) {
                console.warn('[MIGRATION v1.13.0] Migration skipped/failed:', migrationErr.message);
                // Set flag anyway to prevent retrying on every load
                localStorage.setItem(MIGRATION_KEY, 'skipped-' + new Date().toISOString());
            }
        })();
    }

    // Initialize sync manager first (non-blocking)
    try {
        initSyncManager();
    } catch (syncErr) {
        console.warn('[INIT] Sync manager init failed:', syncErr);
    }

    // Helper: Load data with timeout to prevent UI from hanging
    async function loadDataWithTimeout(loader, name, defaultValue, timeoutMs = 5000) {
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`${name} timeout`)), timeoutMs)
            );
            return await Promise.race([loader(), timeoutPromise]);
        } catch (err) {
            console.warn(`[INIT] ${name} failed or timed out:`, err.message);
            return defaultValue;
        }
    }

    // Load projects and active project with timeout protection
    // UI will render with empty data if loading fails/times out
    let projects = [];
    try {
        projects = await loadDataWithTimeout(
            () => window.dataLayer.loadProjects(),
            'loadProjects',
            [],
            5000
        );
    } catch (err) {
        console.error('[INIT] Projects load failed:', err);
    }

    // Cache projects for this page
    projectsCache = projects;

    // Load active project (non-blocking if it fails)
    try {
        activeProjectCache = await loadDataWithTimeout(
            () => window.dataLayer.loadActiveProject(),
            'loadActiveProject',
            null,
            3000
        );
    } catch (err) {
        console.warn('[INIT] Active project load failed:', err);
        activeProjectCache = null;
    }

    // ALWAYS update UI - regardless of data loading success
    // This ensures the dashboard renders even if PowerSync is unavailable
    updateActiveProjectCard();
    renderReportCards();
    updateReportStatus();
    updateDraftsSection();

    // Show submitted banner if there are submitted reports today and not dismissed this session
    try {
        const bannerDismissedThisSession = sessionStorage.getItem('fvp_submitted_banner_dismissed') === 'true';
        const { todaySubmitted } = getReportsByUrgency();
        if (todaySubmitted.length > 0 && !bannerDismissedThisSession) {
            document.getElementById('submittedBanner').classList.remove('hidden');
        }
    } catch (bannerErr) {
        console.warn('[INIT] Banner check failed:', bannerErr);
    }

    // Sync weather (non-blocking)
    syncWeather();

    // Initialize PWA features (service worker, offline banner, etc.)
    try {
        initPWA({ onOnline: updateDraftsSection });
    } catch (pwaErr) {
        console.warn('[INIT] PWA init failed:', pwaErr);
    }

    console.log('[INIT] Dashboard initialization complete');
});

// ============ EXPOSE TO WINDOW FOR ONCLICK HANDLERS ============
window.openSettings = openSettings;
window.openProjectConfig = openProjectConfig;
window.beginDailyReport = beginDailyReport;
window.showProjectPickerModal = showProjectPickerModal;
window.closeProjectPickerModal = closeProjectPickerModal;
window.selectProjectAndProceed = selectProjectAndProceed;
window.goToProjectSetup = goToProjectSetup;
window.dismissPermissionsBanner = dismissPermissionsBanner;
window.dismissSubmittedBanner = dismissSubmittedBanner;
window.syncWeather = syncWeather;

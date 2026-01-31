// FieldVoice Pro - Archives Page Logic
// Uses window.dataLayer for all data operations (PowerSync-backed)

// ============ STATE ============
let pendingDeleteId = null;
let pendingDeleteDate = null;
let projectsCache = [];
let isRefreshing = false;

/**
 * Helper to load data with timeout protection
 */
async function loadWithTimeout(loader, name, defaultValue, timeoutMs = 5000) {
    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${name} timeout`)), timeoutMs)
        );
        return await Promise.race([loader(), timeoutPromise]);
    } catch (err) {
        console.warn(`[DATA] ${name} failed or timed out:`, err.message);
        return defaultValue;
    }
}

// ============ PROJECT LOADING (via dataLayer) ============
async function loadProjects() {
    try {
        const projects = await loadWithTimeout(
            () => window.dataLayer.loadProjects(),
            'loadProjects',
            [],
            5000
        );
        projectsCache = projects.map(p => ({
            id: p.id,
            name: p.projectName || p.project_name || '',
            status: p.status || 'active'
        }));
        console.log('[DATA] Loaded projects via dataLayer:', projectsCache.length);
        return projectsCache;
    } catch (e) {
        console.error('[DATA] Failed to load projects:', e);
        return [];
    }
}

function getProjectById(projectId) {
    return projectsCache.find(p => p.id === projectId) || null;
}

// ============ ARCHIVE LOADING (via dataLayer/PowerSync) ============
async function getAllReports() {
    try {
        const archives = await loadWithTimeout(
            () => window.dataLayer.loadArchivedReports(100),
            'loadArchivedReports',
            [],
            5000
        );

        // Map to display format
        const mapped = archives.map(row => {
            const project = getProjectById(row.project_id);
            return {
                id: row.id,
                date: row.report_date,
                projectId: row.project_id,
                projectName: project?.name || row.projects?.project_name || 'Unknown Project',
                submitted: true, // final_reports are always submitted
                status: 'submitted',
                photoCount: 0, // Photo count would need separate query
                createdAt: row.created_at,
                submittedAt: row.submitted_at,
                updatedAt: row.updated_at
            };
        });

        console.log('[DATA] Loaded archives:', mapped.length);
        return mapped;
    } catch (e) {
        console.error('[DATA] Failed to load archives:', e);
        return [];
    }
}

// ============ REFRESH FROM CLOUD ============
async function refreshFromCloud() {
    if (isRefreshing) return;

    isRefreshing = true;
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
    }

    try {
        showToast('Refreshing...', 'info');

        // PowerSync auto-syncs, just reload the data
        await loadProjects();
        const archives = await getAllReports();
        await renderReportList(archives);

        showToast('Archives refreshed', 'success');
    } catch (err) {
        console.error('[REFRESH] Failed:', err);
        showToast('Failed to refresh', 'error');
    } finally {
        isRefreshing = false;
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        }
    }
}

// ============ DELETE ============
async function deleteReport(reportId) {
    try {
        // Delete from PowerSync (auto-syncs to Supabase)
        await window.PowerSyncClient.delete('final_reports', reportId);
        console.log('[DATA] Archive deleted:', reportId);
        return true;
    } catch (e) {
        console.error('[DATA] Failed to delete archive:', e);
        return false;
    }
}

// ============ RENDER ============
async function renderReportList(reports = null) {
    const section = document.getElementById('reportListSection');

    // Show loading state if no reports provided
    if (reports === null) {
        section.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 px-4">
                <i class="fas fa-spinner fa-spin text-slate-400 text-3xl mb-4"></i>
                <p class="text-sm text-slate-500">Loading reports...</p>
            </div>
        `;

        try {
            reports = await getAllReports();
        } catch (err) {
            console.error('[ARCHIVES] Error loading reports:', err);
            section.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 px-4">
                    <div class="w-20 h-20 bg-red-100 border-2 border-red-300 flex items-center justify-center mb-6">
                        <i class="fas fa-exclamation-triangle text-red-500 text-3xl"></i>
                    </div>
                    <p class="text-lg font-bold text-slate-500 mb-2 text-center">Error loading reports</p>
                    <p class="text-sm text-red-500 text-center mb-6">${escapeHtml(err.message || 'Unknown error')}</p>
                    <button onclick="location.reload()" class="px-6 py-3 bg-dot-navy text-white font-bold uppercase tracking-wide hover:bg-dot-blue transition-colors">
                        <i class="fas fa-redo mr-2"></i>Retry
                    </button>
                </div>
            `;
            return;
        }
    }

    if (reports.length === 0) {
        const offlineMsg = !navigator.onLine ? '<p class="text-xs text-yellow-600 mb-4"><i class="fas fa-wifi-slash mr-1"></i>You are offline</p>' : '';
        section.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 px-4">
                <div class="w-20 h-20 bg-slate-200 border-2 border-dashed border-slate-300 flex items-center justify-center mb-6">
                    <i class="fas fa-folder-open text-slate-400 text-3xl"></i>
                </div>
                <p class="text-lg font-bold text-slate-500 mb-2 text-center">No reports yet</p>
                ${offlineMsg}
                <p class="text-sm text-slate-400 text-center mb-6">Complete your first daily report to see it here.</p>
                <a href="index.html" class="px-6 py-3 bg-dot-navy text-white font-bold uppercase tracking-wide hover:bg-dot-blue transition-colors">
                    <i class="fas fa-plus mr-2"></i>Start a Report
                </a>
            </div>
        `;
        return;
    }

    section.innerHTML = `
        <p class="text-xs text-slate-500 mb-3 uppercase tracking-wider font-bold">
            <i class="fas fa-info-circle mr-1"></i>Swipe left to delete
        </p>
        <div class="space-y-2">
            ${reports.map(report => renderReportRow(report)).join('')}
        </div>
    `;
}

function renderReportRow(report) {
    const formattedDate = formatDate(report.date, 'long');
    const statusClass = report.submitted
        ? 'bg-safety-green text-white'
        : 'bg-dot-yellow text-slate-800';
    const statusText = report.submitted ? 'Submitted' : 'Draft';
    const projectDisplay = report.projectName
        ? `<p class="text-xs text-slate-500 truncate"><i class="fas fa-building mr-1"></i>${escapeHtml(report.projectName)}</p>`
        : '';

    // Build URL with reportId for Supabase lookup
    const viewUrl = `finalreview.html?date=${report.date}&reportId=${report.id}`;

    return `
        <div class="swipe-container flex bg-white shadow-sm border border-slate-200">
            <!-- Main content (clickable) -->
            <a href="${viewUrl}"
               class="swipe-content flex-shrink-0 w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-slate-800 truncate">${formattedDate}</p>
                    ${projectDisplay}
                    <div class="flex items-center gap-3 mt-1">
                        <span class="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass}">
                            ${statusText}
                        </span>
                        ${report.photoCount > 0 ? `
                            <span class="text-xs text-slate-500 flex items-center gap-1">
                                <i class="fas fa-camera text-slate-400"></i>
                                ${report.photoCount}
                            </span>
                        ` : ''}
                    </div>
                </div>
                <i class="fas fa-chevron-right text-slate-400"></i>
            </a>
            <!-- Delete button (revealed on swipe) -->
            <div class="delete-btn-container flex-shrink-0">
                <button onclick="showDeleteModal('${report.id}', '${formattedDate.replace(/'/g, "\\'")}')"
                        class="h-full w-20 bg-red-600 text-white flex flex-col items-center justify-center hover:bg-red-700 transition-colors">
                    <i class="fas fa-trash-alt text-lg mb-1"></i>
                    <span class="text-[10px] font-bold uppercase">Delete</span>
                </button>
            </div>
        </div>
    `;
}

// ============ DELETE MODAL ============
function showDeleteModal(reportId, dateStr) {
    pendingDeleteId = reportId;
    pendingDeleteDate = dateStr;
    document.getElementById('deleteReportDate').textContent = dateStr;
    document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() {
    pendingDeleteId = null;
    pendingDeleteDate = null;
    document.getElementById('deleteModal').classList.add('hidden');
}

async function confirmDelete() {
    if (pendingDeleteId) {
        const success = await deleteReport(pendingDeleteId);
        if (success) {
            showToast('Report deleted', 'success');
        } else {
            showToast('Failed to delete report', 'error');
        }
        closeDeleteModal();
        await renderReportList();
    }
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load projects first (for project name lookups)
        await loadProjects();
        // Then render the report list
        await renderReportList();
    } catch (err) {
        console.error('Failed to initialize:', err);
        const section = document.getElementById('reportListSection');
        section.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 px-4">
                <div class="w-20 h-20 bg-red-100 border-2 border-red-300 flex items-center justify-center mb-6">
                    <i class="fas fa-exclamation-triangle text-red-500 text-3xl"></i>
                </div>
                <p class="text-lg font-bold text-slate-500 mb-2 text-center">Failed to load reports</p>
                <p class="text-sm text-slate-400 text-center mb-6">Please check your connection and try again.</p>
                <button onclick="location.reload()" class="px-6 py-3 bg-dot-navy text-white font-bold uppercase tracking-wide hover:bg-dot-blue transition-colors">
                    <i class="fas fa-redo mr-2"></i>Retry
                </button>
            </div>
        `;
    }

    // Initialize PWA features (service worker, offline banner, etc.)
    initPWA();
});

// ============ EXPOSE TO WINDOW FOR ONCLICK HANDLERS ============
window.showDeleteModal = showDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;
window.refreshFromCloud = refreshFromCloud;

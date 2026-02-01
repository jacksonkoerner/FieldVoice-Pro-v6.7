// FieldVoice Pro - Projects Page Logic
// Uses window.dataLayer for all data operations (PowerSync-backed)

// ============ STATE ============
let isRefreshing = false;
let activeProjectId = null;
let projectsCache = [];

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

// ============ PROJECT LOADING (via dataLayer/PowerSync) ============
async function getAllProjects() {
    try {
        const projects = await loadWithTimeout(
            () => window.dataLayer.loadProjects(),
            'loadProjects',
            [],
            5000
        );
        // Map to display format with both camelCase and snake_case for compatibility
        projectsCache = projects.map(p => ({
            ...p,
            project_name: p.projectName || p.project_name || '',
            name: p.projectName || p.project_name || '',
            noab_project_no: p.noabProjectNo || p.noab_project_no || '',
            prime_contractor: p.primeContractor || p.prime_contractor || ''
        }));
        console.log('[DATA] Loaded projects via dataLayer:', projectsCache.length);
        return projectsCache;
    } catch (e) {
        console.error('[DATA] Failed to load projects:', e);
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
        const projects = await getAllProjects();
        await renderProjectList(projects);

        showToast('Projects refreshed', 'success');
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

// ============ PROJECT SELECTION ============
async function selectProject(projectId) {
    // Set as active project
    setStorageItem(STORAGE_KEYS.ACTIVE_PROJECT_ID, projectId);
    activeProjectId = projectId;

    // Get project details for toast
    const project = projectsCache.find(p => p.id === projectId);
    const projectName = project?.project_name || project?.projectName || project?.name || 'Project';

    showToast(`${projectName} selected`, 'success');

    // Navigate to dashboard
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 500);
}

function editProject(projectId) {
    // Navigate to project-config with edit mode
    window.location.href = `project-config.html?id=${projectId}`;
}

// ============ RENDER ============
async function renderProjectList(projects = null) {
    const section = document.getElementById('projectListSection');

    // Show loading state if no projects provided
    if (projects === null) {
        section.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 px-4">
                <i class="fas fa-spinner fa-spin text-slate-400 text-3xl mb-4"></i>
                <p class="text-sm text-slate-500">Loading projects...</p>
            </div>
        `;

        try {
            projects = await getAllProjects();
        } catch (err) {
            console.error('[PROJECTS] Error loading projects:', err);
            section.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 px-4">
                    <div class="w-20 h-20 bg-red-100 border-2 border-red-300 flex items-center justify-center mb-6">
                        <i class="fas fa-exclamation-triangle text-red-500 text-3xl"></i>
                    </div>
                    <p class="text-lg font-bold text-slate-500 mb-2 text-center">Error loading projects</p>
                    <p class="text-sm text-red-500 text-center mb-6">${escapeHtml(err.message || 'Unknown error')}</p>
                    <button onclick="location.reload()" class="px-6 py-3 bg-dot-navy text-white font-bold uppercase tracking-wide hover:bg-dot-blue transition-colors">
                        <i class="fas fa-redo mr-2"></i>Retry
                    </button>
                </div>
            `;
            return;
        }
    }

    // Update active project banner
    updateActiveProjectBanner(projects);

    if (projects.length === 0) {
        const offlineMsg = !navigator.onLine ? '<p class="text-xs text-yellow-600 mb-4"><i class="fas fa-wifi-slash mr-1"></i>You are offline</p>' : '';
        section.innerHTML = `
            <div class="flex flex-col items-center justify-center py-16 px-4">
                <div class="w-20 h-20 bg-slate-200 border-2 border-dashed border-slate-300 flex items-center justify-center mb-6">
                    <i class="fas fa-building text-slate-400 text-3xl"></i>
                </div>
                <p class="text-lg font-bold text-slate-500 mb-2 text-center">No projects yet</p>
                ${offlineMsg}
                <p class="text-sm text-slate-400 text-center mb-6">Create your first project to get started.</p>
            </div>
        `;
        return;
    }

    section.innerHTML = `
        <p class="text-xs text-slate-500 mb-3 uppercase tracking-wider font-bold">
            <i class="fas fa-info-circle mr-1"></i>Tap to select, use edit button to modify
        </p>
        <div class="space-y-2">
            ${projects.map(project => renderProjectRow(project)).join('')}
        </div>
    `;
}

function renderProjectRow(project) {
    const isActive = project.id === activeProjectId;
    const projectName = project.project_name || project.name || 'Unnamed Project';
    const projectNo = project.noab_project_no || '';
    const location = project.location || '';
    const status = project.status || 'active';

    const statusClass = status === 'active'
        ? 'bg-safety-green text-white'
        : 'bg-slate-400 text-white';
    const statusText = status === 'active' ? 'Active' : 'Inactive';

    const activeClass = isActive
        ? 'border-l-4 border-l-safety-green bg-green-50'
        : 'border border-slate-200';

    return `
        <div class="flex bg-white shadow-sm ${activeClass}">
            <!-- Main content (clickable to select) -->
            <button onclick="selectProject('${project.id}')"
                    class="flex-1 p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        ${isActive ? '<i class="fas fa-check-circle text-safety-green text-sm"></i>' : ''}
                        <p class="font-bold text-slate-800 truncate">${escapeHtml(projectName)}</p>
                    </div>
                    ${projectNo ? `<p class="text-xs text-slate-500"><i class="fas fa-hashtag mr-1"></i>${escapeHtml(projectNo)}</p>` : ''}
                    ${location ? `<p class="text-xs text-slate-500 truncate"><i class="fas fa-map-marker-alt mr-1"></i>${escapeHtml(location)}</p>` : ''}
                    <div class="mt-2">
                        <span class="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass}">
                            ${statusText}
                        </span>
                    </div>
                </div>
            </button>
            <!-- Edit button -->
            <button onclick="editProject('${project.id}')"
                    class="flex-shrink-0 w-14 border-l border-slate-200 flex items-center justify-center text-dot-blue hover:bg-dot-blue hover:text-white transition-colors"
                    title="Edit Project">
                <i class="fas fa-edit"></i>
            </button>
        </div>
    `;
}

function updateActiveProjectBanner(projects) {
    const banner = document.getElementById('activeProjectBanner');
    const nameEl = document.getElementById('activeProjectName');

    if (!activeProjectId) {
        banner.classList.add('hidden');
        return;
    }

    const activeProject = projects.find(p => p.id === activeProjectId);
    if (activeProject) {
        const projectName = activeProject.project_name || activeProject.name || 'Unknown Project';
        nameEl.textContent = projectName;
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
    // Check auth first
    if (!await requireAuth()) return;

    // Get current active project
    activeProjectId = getStorageItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);

    try {
        await renderProjectList();
    } catch (err) {
        console.error('Failed to initialize:', err);
    }

    // Initialize PWA features (service worker, offline banner, etc.)
    initPWA();
});

// ============ EXPOSE TO WINDOW FOR ONCLICK HANDLERS ============
window.selectProject = selectProject;
window.editProject = editProject;
window.refreshFromCloud = refreshFromCloud;

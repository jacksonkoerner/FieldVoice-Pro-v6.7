// FieldVoice Pro - Final Review Page Logic
// Read-only DOT RPR Daily Report viewer with print-optimized layout

// ============ STATE ============
let report = null;
let currentReportId = null; // Supabase report ID
let activeProject = null;
let projectContractors = [];
let userSettings = null;

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadActiveProject();
        await loadUserSettings();
        report = await loadReport();

        if (!report) {
            alert('No report found for this date.');
            window.location.href = 'index.html';
            return;
        }

        populateReport();
        updateTotalPages();
        checkSubmittedState();
        checkEmptyFields();
    } catch (err) {
        console.error('Failed to initialize:', err);
        alert('Failed to load report data. Please try again.');
    }
});

// ============ CHECK SUBMITTED STATE ============
function checkSubmittedState() {
    if (report && report.meta && report.meta.submitted) {
        const submitBtn = document.querySelector('.btn-submit');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-check"></i><span>Submitted</span>';
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';
            submitBtn.style.cursor = 'default';
        }
    }
}

// ============ PROJECT LOADING ============
async function loadActiveProject() {
    const activeId = getStorageItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
    if (!activeId) {
        console.log('[SUPABASE] No active project ID found in localStorage');
        return null;
    }

    try {
        // Fetch project from Supabase
        const { data: projectRow, error: projectError } = await supabaseClient
            .from('projects')
            .select('*')
            .eq('id', activeId)
            .single();

        if (projectError) {
            console.error('[SUPABASE] Error fetching project:', projectError);
            return null;
        }

        activeProject = fromSupabaseProject(projectRow);

        // Fetch contractors for this project
        const { data: contractorRows, error: contractorError } = await supabaseClient
            .from('contractors')
            .select('*')
            .eq('project_id', activeId);

        if (!contractorError && contractorRows) {
            activeProject.contractors = contractorRows.map(fromSupabaseContractor);
            // Sort contractors: prime first
            projectContractors = [...activeProject.contractors].sort((a, b) => {
                if (a.type === 'prime' && b.type !== 'prime') return -1;
                if (a.type !== 'prime' && b.type === 'prime') return 1;
                return 0;
            });
        } else {
            projectContractors = [];
        }

        console.log('[SUPABASE] Loaded project:', activeProject.name);
        return activeProject;
    } catch (e) {
        console.error('[SUPABASE] Failed to load project:', e);
        return null;
    }
}

// ============ USER SETTINGS LOADING ============
async function loadUserSettings() {
    try {
        const { data, error } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .limit(1)
            .single();

        if (error) {
            console.log('[SUPABASE] No user settings found:', error.message);
            return null;
        }

        userSettings = {
            fullName: data.full_name || '',
            company: data.company || '',
            title: data.title || '',
            email: data.email || '',
            phone: data.phone || ''
        };

        console.log('[SUPABASE] Loaded user settings');
        return userSettings;
    } catch (e) {
        console.error('[SUPABASE] Failed to load user settings:', e);
        return null;
    }
}

// ============ REPORT LOADING ============
function getReportDateStr() {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    return dateParam || new Date().toISOString().split('T')[0];
}

async function loadReport() {
    // Clear any stale report ID before loading
    currentReportId = null;

    const params = new URLSearchParams(window.location.search);
    const reportIdParam = params.get('reportId');
    const reportDateStr = getReportDateStr();

    if (!activeProject) {
        console.log('[SUPABASE] No active project, cannot load report');
        return null;
    }

    try {
        let reportRow = null;

        // If we have a report ID from URL, load directly
        if (reportIdParam) {
            const { data, error } = await supabaseClient
                .from('reports')
                .select('*')
                .eq('id', reportIdParam)
                .single();

            if (!error && data) {
                reportRow = data;
            }
        }

        // Otherwise, try to find by project and date
        if (!reportRow) {
            const { data: existingReport, error: reportError } = await supabaseClient
                .from('reports')
                .select('*')
                .eq('project_id', activeProject.id)
                .eq('report_date', reportDateStr)
                .single();

            if (reportError) {
                console.log('[SUPABASE] No report found for this date:', reportError.message);
                return null;
            }

            reportRow = existingReport;
        }

        if (!reportRow) {
            return null;
        }

        // Store the report ID
        currentReportId = reportRow.id;

        // Load related data in parallel
        // Note: user_edits, contractor_work, personnel, and equipment_usage now stored in report_raw_capture.raw_data
        const [rawCaptureResult, photosResult, aiResponseResult] = await Promise.all([
            supabaseClient.from('report_raw_capture').select('*').eq('report_id', reportRow.id).maybeSingle(),
            supabaseClient.from('photos').select('*').eq('report_id', reportRow.id).order('created_at', { ascending: true }),
            // Get most recent AI response (handles multiple rows from retries)
            supabaseClient.from('ai_responses').select('*').eq('report_id', reportRow.id).order('received_at', { ascending: false }).limit(1).maybeSingle()
        ]);

        // Build the report object
        const loadedReport = {
            overview: {
                projectName: reportRow.project_name || activeProject?.name || '',
                noabProjectNo: reportRow.project_no || activeProject?.noabProjectNo || '',
                date: reportRow.report_date,
                startTime: rawCaptureResult.data?.start_time || activeProject?.defaultStartTime || '',
                endTime: rawCaptureResult.data?.end_time || activeProject?.defaultEndTime || '',
                completedBy: reportRow.inspector_name || userSettings?.fullName || '',
                weather: rawCaptureResult.data?.weather_data || {},
                location: activeProject?.location || '',
                cnoSolicitationNo: activeProject?.cnoSolicitationNo || 'N/A',
                engineer: activeProject?.engineer || '',
                contractor: activeProject?.primeContractor || '',
                contractDay: calculateContractDay(activeProject?.noticeToProceed, reportRow.report_date),
                weatherDays: activeProject?.weatherDays || 0
            },
            meta: {
                status: reportRow.status || 'draft',
                submitted: reportRow.status === 'submitted',
                submittedAt: reportRow.submitted_at || null,
                createdAt: reportRow.created_at,
                updatedAt: reportRow.updated_at
            },
            activities: [],
            operations: [],
            equipment: [],
            photos: [],
            aiGenerated: {},
            userEdits: {},
            fieldNotes: rawCaptureResult.data?.transcript || '',
            guidedNotes: rawCaptureResult.data?.guided_notes || {},
            issues: '',
            communications: '',
            qaqc: '',
            visitors: '',
            safety: { hasIncident: false, notes: '' }
        };

        // Process contractor work (now stored in raw_data.contractor_work)
        const contractorWorkData = rawCaptureResult.data?.raw_data?.contractor_work || [];
        if (contractorWorkData && contractorWorkData.length > 0) {
            loadedReport.activities = contractorWorkData.map(row => ({
                contractorId: row.contractor_id,
                noWork: row.no_work_performed || false,
                narrative: row.narrative || '',
                equipmentUsed: row.equipment_used || '',
                crew: row.crew || ''
            }));
        }

        // Process personnel/operations (now stored in raw_data.personnel)
        const personnelData = rawCaptureResult.data?.raw_data?.personnel || [];
        if (personnelData && personnelData.length > 0) {
            loadedReport.operations = personnelData.map(row => ({
                contractorId: row.contractor_id,
                superintendents: row.superintendents || 0,
                foremen: row.foremen || 0,
                operators: row.operators || 0,
                laborers: row.laborers || 0,
                surveyors: row.surveyors || 0,
                others: row.others || 0
            }));
        }

        // Process equipment usage (now stored in raw_data.equipment_usage)
        const equipmentUsageData = rawCaptureResult.data?.raw_data?.equipment_usage || [];
        if (equipmentUsageData && equipmentUsageData.length > 0) {
            loadedReport.equipment = equipmentUsageData.map(row => ({
                contractorId: row.contractor_id,
                type: row.type || '',
                qty: row.qty || 1,
                status: row.status === 'idle' ? 'IDLE' : (row.hours_used ? `${row.hours_used} hrs` : 'IDLE')
            }));
        }

        // Process photos - use storage_path to build full URL
        if (photosResult.data && photosResult.data.length > 0) {
            loadedReport.photos = photosResult.data.map(row => ({
                id: row.id,
                url: row.storage_path ? `${SUPABASE_URL}/storage/v1/object/public/report-photos/${row.storage_path}` : '',
                storagePath: row.storage_path || '',
                fileName: row.filename || '',
                caption: row.caption || '',
                date: row.taken_at ? new Date(row.taken_at).toLocaleDateString() : '',
                time: row.taken_at ? new Date(row.taken_at).toLocaleTimeString() : '',
                gps: row.gps_lat && row.gps_lng ? { lat: row.gps_lat, lng: row.gps_lng } : null
            }));
        }

        // Process AI response - data is stored as JSONB in response_payload column
        if (aiResponseResult.data && aiResponseResult.data.response_payload) {
            const aiPayload = aiResponseResult.data.response_payload;

            // v6.6: Support both old and new field names for backwards compatibility
            // Use response_payload directly - it already contains the aiGenerated object
            loadedReport.aiGenerated = {
                activities: aiPayload.activities || [],
                operations: aiPayload.operations || [],
                equipment: aiPayload.equipment || [],
                // v6.6: Support both old (generalIssues) and new (issues_delays) field names
                issues_delays: aiPayload.issues_delays || aiPayload.generalIssues || [],
                qaqc_notes: aiPayload.qaqc_notes || aiPayload.qaqcNotes || [],
                safety: aiPayload.safety || { has_incidents: false, hasIncidents: false, noIncidents: true, summary: '', notes: '' },
                communications: aiPayload.communications || aiPayload.contractorCommunications || '',
                visitors_deliveries: aiPayload.visitors_deliveries || aiPayload.visitorsRemarks || '',
                // v6.6: New fields
                executive_summary: aiPayload.executive_summary || '',
                work_performed: aiPayload.work_performed || '',
                inspector_notes: aiPayload.inspector_notes || '',
                extraction_confidence: aiPayload.extraction_confidence || 'high',
                missing_data_flags: aiPayload.missing_data_flags || []
            };

            console.log('[SUPABASE] Loaded AI response from response_payload:', loadedReport.aiGenerated);

            // Copy AI text sections to report for easy access
            // v6.6: Handle both old and new field names
            const issuesData = aiPayload.issues_delays || aiPayload.generalIssues;
            if (Array.isArray(issuesData)) {
                loadedReport.issues = issuesData.join('\n');
            } else {
                loadedReport.issues = issuesData || '';
            }

            loadedReport.communications = aiPayload.communications || aiPayload.contractorCommunications || '';

            // Handle both array and string formats for qaqc
            const qaqcData = aiPayload.qaqc_notes || aiPayload.qaqcNotes;
            if (Array.isArray(qaqcData)) {
                loadedReport.qaqc = qaqcData.join('\n');
            } else {
                loadedReport.qaqc = qaqcData || '';
            }

            loadedReport.visitors = aiPayload.visitors_deliveries || aiPayload.visitorsRemarks || '';

            // Safety - handle different property names (has_incidents vs hasIncidents vs hasIncident)
            if (aiPayload.safety) {
                // v6.6: Support new safety.summary field alongside old safety.notes
                const safetyNotes = aiPayload.safety.summary || 
                    (Array.isArray(aiPayload.safety.notes) ? aiPayload.safety.notes.join('\n') : (aiPayload.safety.notes || ''));
                loadedReport.safety = {
                    hasIncident: aiPayload.safety.has_incidents || aiPayload.safety.hasIncidents || aiPayload.safety.hasIncident || false,
                    noIncidents: aiPayload.safety.noIncidents || !aiPayload.safety.has_incidents || false,
                    notes: safetyNotes
                };
            }
        }

        // Process user edits (now stored in raw_data.user_edits)
        const userEditsData = rawCaptureResult.data?.raw_data?.user_edits || [];
        if (userEditsData && userEditsData.length > 0) {
            userEditsData.forEach(row => {
                let value = row.edited_value;
                // Try to parse JSON values
                try {
                    const parsed = JSON.parse(value);
                    if (typeof parsed === 'object') {
                        value = parsed;
                    }
                } catch (e) {
                    // Keep as string
                }
                loadedReport.userEdits[row.field_path] = value;
            });
        }

        console.log('[SUPABASE] Loaded report for date:', reportDateStr);
        return loadedReport;
    } catch (e) {
        console.error('[SUPABASE] Failed to load report:', e);
        return null;
    }
}

function calculateContractDay(noticeToProceed, reportDate) {
    if (!noticeToProceed || !reportDate) return '';
    try {
        const ntpDate = new Date(noticeToProceed);
        const repDate = new Date(reportDate);
        const diffTime = repDate - ntpDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays > 0 ? diffDays : '';
    } catch (e) {
        return '';
    }
}

// ============ POPULATE REPORT ============
function populateReport() {
    const o = report.overview || {};
    const ai = report.aiGenerated || {};
    const userEdits = report.userEdits || {};

    // Helper to get value with priority
    function getValue(path, defaultVal = '') {
        if (userEdits[path] !== undefined) return userEdits[path];
        const aiVal = getNestedValue(ai, path);
        if (aiVal !== undefined && aiVal !== null && aiVal !== '') {
            if (Array.isArray(aiVal)) return aiVal.join('\n');
            return aiVal;
        }
        const reportVal = getNestedValue(report, path);
        if (reportVal !== undefined && reportVal !== null && reportVal !== '') {
            if (Array.isArray(reportVal)) return reportVal.join('\n');
            return reportVal;
        }
        return defaultVal;
    }

    function getNestedValue(obj, path) {
        return path.split('.').reduce((o, k) => (o || {})[k], obj);
    }

    // Update header date
    document.getElementById('headerDate').textContent = formatDisplayDate(o.date);

    // Project Overview
    document.getElementById('projectName').textContent = getValue('overview.projectName', activeProject?.name || '');
    document.getElementById('reportDate').textContent = formatDisplayDate(o.date);
    document.getElementById('noabProjectNo').textContent = getValue('overview.noabProjectNo', activeProject?.noabProjectNo || '');
    document.getElementById('location').textContent = getValue('overview.location', activeProject?.location || '');
    document.getElementById('cnoSolicitationNo').textContent = getValue('overview.cnoSolicitationNo', activeProject?.cnoSolicitationNo || 'N/A');
    document.getElementById('engineer').textContent = getValue('overview.engineer', activeProject?.engineer || '');

    // Notice to Proceed
    const ntpDate = activeProject?.noticeToProceed;
    document.getElementById('noticeToProceed').textContent = ntpDate ? formatDisplayDate(ntpDate) : '';

    document.getElementById('contractor').textContent = getValue('overview.contractor', activeProject?.primeContractor || '');

    // Contract Duration
    const duration = activeProject?.contractDuration;
    document.getElementById('contractDuration').textContent = duration ? `${duration} days` : '';

    // Times
    document.getElementById('startTime').textContent = formatTimeLocal(getValue('overview.startTime', activeProject?.defaultStartTime || ''));
    document.getElementById('endTime').textContent = formatTimeLocal(getValue('overview.endTime', activeProject?.defaultEndTime || ''));

    // Expected Completion
    const expectedDate = activeProject?.expectedCompletion;
    document.getElementById('expectedCompletion').textContent = expectedDate ? formatDisplayDate(expectedDate) : '';

    // Shift Duration
    const startTime = getValue('overview.startTime', activeProject?.defaultStartTime || '');
    const endTime = getValue('overview.endTime', activeProject?.defaultEndTime || '');
    document.getElementById('shiftDuration').textContent = calculateShiftDuration(startTime, endTime);

    // Contract Day
    const contractDay = getValue('overview.contractDay', '');
    if (contractDay && duration) {
        document.getElementById('contractDay').textContent = `${contractDay} of ${duration} days`;
    } else {
        document.getElementById('contractDay').textContent = contractDay;
    }

    // Weather Days
    document.getElementById('weatherDays').textContent = getValue('overview.weatherDays', activeProject?.weatherDays || '0') + ' days';

    // Completed By
    document.getElementById('completedBy').textContent = getValue('overview.completedBy', '');

    // Weather
    const weather = o.weather || {};
    document.getElementById('weatherTemps').textContent = `High Temp: ${weather.highTemp || '--'}° Low Temp: ${weather.lowTemp || '--'}°`;
    document.getElementById('weatherPrecip').textContent = `Precipitation: ${weather.precipitation || '0.00"'}`;
    document.getElementById('weatherCondition').textContent = `General Condition: ${weather.generalCondition || 'N/A'}`;
    document.getElementById('weatherJobSite').textContent = `Job Site Condition: ${weather.jobSiteCondition || 'N/A'}`;
    document.getElementById('weatherAdverse').textContent = `Adverse Conditions: ${weather.adverseConditions || 'N/A'}`;

    // Signature
    const sigName = getValue('signature.name', getValue('overview.completedBy', ''));
    const sigTitle = getValue('signature.title', '');
    const sigCompany = getValue('signature.company', '');
    document.getElementById('signatureName').textContent = sigName;

    let sigDetails = '';
    if (sigTitle || sigCompany) {
        sigDetails = `Digitally signed by ${sigName}\nDN: cn=${sigName}, c=US,\no=${sigCompany}, ou=${sigTitle},\nemail=${sigName.toLowerCase().replace(/\s/g, '')}@${sigCompany.toLowerCase().replace(/\s/g, '')}.com\nDate: ${new Date().toISOString().split('T')[0]}`;
    }
    document.getElementById('signatureDetails').innerHTML = sigDetails.replace(/\n/g, '<br>');

    // Render dynamic sections
    renderWorkSummary();
    renderOperationsTable();
    renderEquipmentTable();
    renderTextSections();
    renderSafetySection();
    renderPhotos();
    renderLogo();
}

// ============ LOGO RENDERING ============
function renderLogo() {
    // Check if activeProject has a logo
    // Priority: logoUrl (full quality) > logoThumbnail (compressed) > logo (legacy)
    const logoSrc = activeProject?.logoUrl || activeProject?.logoThumbnail || activeProject?.logo;

    if (logoSrc) {
        // Update all logo containers across all pages
        const logoContainers = [
            { placeholder: 'logoPlaceholder', image: 'logoImage' },
            { placeholder: 'logoPlaceholder2', image: 'logoImage2' },
            { placeholder: 'logoPlaceholder3', image: 'logoImage3' },
            { placeholder: 'logoPlaceholder4', image: 'logoImage4' }
        ];

        logoContainers.forEach(container => {
            const placeholder = document.getElementById(container.placeholder);
            const image = document.getElementById(container.image);

            if (placeholder && image) {
                placeholder.style.display = 'none';
                image.src = logoSrc;
                image.style.display = 'block';
            }
        });
    }
}

// ============ WORK SUMMARY ============
function renderWorkSummary() {
    const container = document.getElementById('workSummaryContent');

    if (projectContractors.length === 0) {
        // No contractors - show general work summary
        const workText = getTextValue('guidedNotes.workSummary', 'issues', 'generalIssues', '');
        container.innerHTML = `<p>${escapeHtml(workText) || '<span class="na-text">No work activities recorded.</span>'}</p>`;
        return;
    }

    let html = '';
    projectContractors.forEach(contractor => {
        const activity = getContractorActivity(contractor.id);
        const typeLabel = contractor.type === 'prime' ? 'PRIME CONTRACTOR' : 'SUBCONTRACTOR';
        const trades = contractor.trades ? ` (${contractor.trades.toUpperCase()})` : '';

        html += `<div class="contractor-block">`;
        html += `<div class="contractor-name">${escapeHtml(contractor.name)} – ${typeLabel}${trades}</div>`;

        if (activity?.noWork) {
            html += `<div class="contractor-narrative">No work performed on ${formatDisplayDate(report.overview?.date)}.</div>`;
        } else {
            const narrative = activity?.narrative || '';
            if (narrative) {
                html += `<div class="contractor-narrative">${escapeHtml(narrative)}</div>`;
            }
            const equipment = activity?.equipmentUsed || '';
            const crew = activity?.crew || '';
            if (equipment || crew) {
                html += `<div class="contractor-details">`;
                if (equipment) html += `EQUIPMENT: ${escapeHtml(equipment.toUpperCase())}. `;
                if (crew) html += `CREW: ${escapeHtml(crew.toUpperCase())}.`;
                html += `</div>`;
            }
            if (!narrative && !equipment && !crew) {
                html += `<div class="contractor-narrative">No work performed on ${formatDisplayDate(report.overview?.date)}.</div>`;
            }
        }
        html += `</div>`;
    });

    container.innerHTML = html;
}

/**
 * v6.6: Supports matching by contractorName for freeform mode (when contractorId is null)
 */
function getContractorActivity(contractorId) {
    const userEdits = report.userEdits || {};
    const userEditKey = `activity_${contractorId}`;
    if (userEdits[userEditKey]) return userEdits[userEditKey];

    // Get contractor name for freeform matching
    const contractor = projectContractors.find(c => c.id === contractorId);
    const contractorName = contractor?.name;

    if (report.aiGenerated?.activities) {
        // Try matching by contractorId first (guided mode)
        let aiActivity = report.aiGenerated.activities.find(a => a.contractorId === contractorId);
        
        // v6.6: Fallback to name matching for freeform mode (where contractorId is null)
        if (!aiActivity && contractorName) {
            aiActivity = report.aiGenerated.activities.find(a => 
                a.contractorId === null && 
                a.contractorName?.toLowerCase() === contractorName.toLowerCase()
            );
        }
        
        if (aiActivity) return aiActivity;
    }

    if (report.activities) {
        return report.activities.find(a => a.contractorId === contractorId);
    }
    return null;
}

// ============ OPERATIONS TABLE ============
function renderOperationsTable() {
    const tbody = document.getElementById('operationsTableBody');

    if (projectContractors.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#666;">No contractors defined</td></tr>`;
        return;
    }

    let html = '';
    projectContractors.forEach(contractor => {
        const ops = getContractorOperations(contractor.id);
        const abbrev = contractor.abbreviation || contractor.name.substring(0, 10).toUpperCase();
        const trades = formatTradesAbbrev(contractor.trades);

        html += `<tr>
            <td>${escapeHtml(abbrev)}</td>
            <td>${escapeHtml(trades)}</td>
            <td>${ops?.superintendents || 'N/A'}</td>
            <td>${ops?.foremen || 'N/A'}</td>
            <td>${ops?.operators || 'N/A'}</td>
            <td>${ops?.laborers || 'N/A'}</td>
            <td>${ops?.surveyors || 'N/A'}</td>
            <td>${ops?.others || 'N/A'}</td>
        </tr>`;
    });

    tbody.innerHTML = html;
}

/**
 * v6.6: Supports matching by contractorName for freeform mode (when contractorId is null)
 */
function getContractorOperations(contractorId) {
    const userEdits = report.userEdits || {};
    const userEditKey = `operations_${contractorId}`;
    if (userEdits[userEditKey]) return userEdits[userEditKey];

    // Get contractor name for freeform matching
    const contractor = projectContractors.find(c => c.id === contractorId);
    const contractorName = contractor?.name;

    if (report.aiGenerated?.operations) {
        // Try matching by contractorId first (guided mode)
        let aiOps = report.aiGenerated.operations.find(o => o.contractorId === contractorId);
        
        // v6.6: Fallback to name matching for freeform mode (where contractorId is null)
        if (!aiOps && contractorName) {
            aiOps = report.aiGenerated.operations.find(o => 
                o.contractorId === null && 
                o.contractorName?.toLowerCase() === contractorName.toLowerCase()
            );
        }
        
        if (aiOps) return aiOps;
    }

    if (report.operations) {
        return report.operations.find(o => o.contractorId === contractorId);
    }
    return null;
}

function formatTradesAbbrev(trades) {
    if (!trades) return '-';
    // Common trade abbreviations
    const abbrevMap = {
        'construction management': 'CM',
        'project management': 'PM',
        'pile driving': 'PLE',
        'concrete': 'CONC',
        'asphalt': 'ASP',
        'utilities': 'UTL',
        'earthwork': 'ERTHWRK',
        'electrical': 'ELEC',
        'communications': 'COMM',
        'fence': 'FENCE',
        'pavement markings': 'PVMNT MRK',
        'hauling': 'HAUL',
        'pavement subgrade': 'PVMT SUB',
        'demo': 'DEMO',
        'demolition': 'DEMO',
        'general': 'GEN'
    };

    const parts = trades.split(/[;,]/).map(t => t.trim().toLowerCase());
    const abbrevs = parts.map(t => abbrevMap[t] || t.substring(0, 6).toUpperCase());
    return abbrevs.join('; ');
}

// ============ EQUIPMENT TABLE ============
function renderEquipmentTable() {
    const tbody = document.getElementById('equipmentTableBody');
    const equipmentData = getEquipmentData();

    if (equipmentData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#666;">No equipment mobilized</td></tr>`;
        return;
    }

    let html = '';
    equipmentData.forEach(item => {
        // v6.6: Pass contractorName fallback for freeform mode
        const contractorName = getContractorName(item.contractorId, item.contractorName);
        const status = item.status || 'IDLE';
        const notes = status === 'IDLE' ? 'IDLE' : `${status.replace(' hrs', '')} HOURS UTILIZED`;

        html += `<tr>
            <td>${escapeHtml(contractorName)}</td>
            <td>${escapeHtml(item.type || 'N/A')}</td>
            <td>${item.qty || 1}</td>
            <td>${notes}</td>
        </tr>`;
    });

    tbody.innerHTML = html;
}

/**
 * v6.6: Supports resolving contractorId from contractorName for freeform mode
 */
function getEquipmentData() {
    if (report.equipment && report.equipment.length > 0) {
        return report.equipment;
    }
    if (report.aiGenerated?.equipment && report.aiGenerated.equipment.length > 0) {
        return report.aiGenerated.equipment.map(item => {
            // v6.6: Resolve contractorId from contractorName for freeform mode
            let contractorId = item.contractorId || '';
            if (!contractorId && item.contractorName) {
                const matchedContractor = projectContractors.find(c => 
                    c.name?.toLowerCase() === item.contractorName?.toLowerCase()
                );
                if (matchedContractor) {
                    contractorId = matchedContractor.id;
                }
            }
            
            return {
                contractorId: contractorId,
                contractorName: item.contractorName || '',
                type: item.type || '',
                qty: item.qty || item.quantity || 1,
                status: item.status || (item.hoursUsed ? `${item.hoursUsed} hrs` : 'IDLE')
            };
        });
    }
    return [];
}

/**
 * v6.6: Updated to support contractorName fallback for freeform mode
 */
function getContractorName(contractorId, contractorNameFallback = null) {
    const contractor = projectContractors.find(c => c.id === contractorId);
    if (contractor) {
        return contractor.abbreviation || contractor.name.substring(0, 15).toUpperCase();
    }
    // v6.6: Use contractorName from AI response if no matching contractor found
    if (contractorNameFallback) {
        return contractorNameFallback.substring(0, 15).toUpperCase();
    }
    return 'UNKNOWN';
}

// ============ TEXT SECTIONS ============
function renderTextSections() {
    // v6.6: Updated to use new field names with fallback to old names
    // Issues
    const issues = getTextValueWithFallback('issues', 'issues_delays', 'generalIssues', 'guidedNotes.issues', '');
    document.getElementById('issuesContent').innerHTML = formatTextSection(issues);

    // Communications
    const comms = getTextValueWithFallback('communications', 'communications', 'contractorCommunications', '', '');
    document.getElementById('communicationsContent').innerHTML = formatTextSection(comms);

    // QA/QC
    const qaqc = getTextValueWithFallback('qaqc', 'qaqc_notes', 'qaqcNotes', '', '');
    document.getElementById('qaqcContent').innerHTML = formatTextSection(qaqc);

    // Visitors
    const visitors = getTextValueWithFallback('visitors', 'visitors_deliveries', 'visitorsRemarks', '', '');
    document.getElementById('visitorsContent').innerHTML = formatTextSection(visitors);
}

/**
 * v6.6: Get text value with support for both new and legacy AI field names
 */
function getTextValueWithFallback(reportPath, aiPath, legacyAiPath, fallbackPath, defaultVal) {
    const userEdits = report.userEdits || {};

    // User edits first
    if (userEdits[reportPath] !== undefined) {
        return userEdits[reportPath];
    }

    // AI generated - try new field name first, then legacy
    if (report.aiGenerated) {
        let aiVal = getNestedValueSimple(report.aiGenerated, aiPath);
        if ((aiVal === undefined || aiVal === null || aiVal === '') && legacyAiPath) {
            aiVal = getNestedValueSimple(report.aiGenerated, legacyAiPath);
        }
        if (aiVal !== undefined && aiVal !== null && aiVal !== '') {
            if (Array.isArray(aiVal)) return aiVal.join('\n');
            return aiVal;
        }
    }

    // Report value
    const reportVal = getNestedValueSimple(report, reportPath);
    if (reportVal !== undefined && reportVal !== null && reportVal !== '') {
        if (Array.isArray(reportVal)) return reportVal.join('\n');
        return reportVal;
    }

    // Fallback path
    if (fallbackPath) {
        const fallbackVal = getNestedValueSimple(report, fallbackPath);
        if (fallbackVal !== undefined && fallbackVal !== null && fallbackVal !== '') {
            if (Array.isArray(fallbackVal)) return fallbackVal.join('\n');
            return fallbackVal;
        }
    }

    return defaultVal;
}

function getTextValue(reportPath, aiPath, fallbackPath, defaultVal) {
    const userEdits = report.userEdits || {};

    // User edits first
    if (userEdits[reportPath] !== undefined) {
        return userEdits[reportPath];
    }

    // AI generated
    if (report.aiGenerated) {
        const aiVal = getNestedValueSimple(report.aiGenerated, aiPath);
        if (aiVal !== undefined && aiVal !== null && aiVal !== '') {
            if (Array.isArray(aiVal)) return aiVal.join('\n');
            return aiVal;
        }
    }

    // Report value
    const reportVal = getNestedValueSimple(report, reportPath);
    if (reportVal !== undefined && reportVal !== null && reportVal !== '') {
        if (Array.isArray(reportVal)) return reportVal.join('\n');
        return reportVal;
    }

    // Fallback path
    if (fallbackPath) {
        const fallbackVal = getNestedValueSimple(report, fallbackPath);
        if (fallbackVal !== undefined && fallbackVal !== null && fallbackVal !== '') {
            if (Array.isArray(fallbackVal)) return fallbackVal.join('\n');
            return fallbackVal;
        }
    }

    return defaultVal;
}

function getNestedValueSimple(obj, path) {
    return path.split('.').reduce((o, k) => (o || {})[k], obj);
}

function formatTextSection(text) {
    if (!text || text.trim() === '') {
        return '<ul><li class="na-text">N/A.</li></ul>';
    }

    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length === 0) {
        return '<ul><li class="na-text">N/A.</li></ul>';
    }

    if (lines.length === 1) {
        return `<ul><li>${escapeHtml(lines[0])}</li></ul>`;
    }

    return '<ul>' + lines.map(line => `<li>${escapeHtml(line)}</li>`).join('') + '</ul>';
}

// ============ SAFETY SECTION ============
function renderSafetySection() {
    // v6.6: Support both old (hasIncidents) and new (has_incidents) field names
    const hasIncident = report.safety?.hasIncident || 
                        report.aiGenerated?.safety?.has_incidents || 
                        report.aiGenerated?.safety?.hasIncidents || 
                        false;
    const noIncident = !hasIncident;

    document.getElementById('checkYes').textContent = hasIncident ? 'X' : '';
    document.getElementById('checkYes').classList.toggle('checked', hasIncident);
    document.getElementById('checkNo').textContent = noIncident ? 'X' : '';
    document.getElementById('checkNo').classList.toggle('checked', noIncident);

    // v6.6: Support both old (safety.notes) and new (safety.summary) field names
    const safetyNotes = getTextValueWithFallback('safety.notes', 'safety.summary', 'safety.notes', 'guidedNotes.safety', '');
    document.getElementById('safetyContent').innerHTML = formatTextSection(safetyNotes);
}

// ============ PHOTOS ============
function renderPhotos() {
    const photos = report.photos || [];
    const grid = document.getElementById('photosGrid');
    const projectName = report.overview?.projectName || activeProject?.name || '';
    const projectNo = report.overview?.noabProjectNo || activeProject?.noabProjectNo || '';

    document.getElementById('photoProjectName').textContent = projectName;
    document.getElementById('photoProjectNo').textContent = projectNo;

    if (photos.length === 0) {
        grid.innerHTML = `
            <div class="photo-cell">
                <div class="photo-image empty">No photos captured</div>
                <div class="photo-meta"><span>Date:</span> --</div>
            </div>
            <div class="photo-cell">
                <div class="photo-image empty"></div>
                <div class="photo-meta"><span>Date:</span> --</div>
            </div>
        `;
        return;
    }

    // Generate photo cells (4 per page, 2x2 grid)
    let html = '';
    const displayPhotos = photos.slice(0, 4); // First 4 photos for page 4

    for (let i = 0; i < 4; i++) {
        const photo = displayPhotos[i];
        if (photo) {
            html += `
                <div class="photo-cell">
                    <div class="photo-image">
                        <img src="${photo.url}" alt="Photo ${i + 1}">
                    </div>
                    <div class="photo-meta"><span>Date:</span> ${photo.date || formatDisplayDate(report.overview?.date)}</div>
                    <div class="photo-caption">${escapeHtml(photo.caption) || ''}</div>
                </div>
            `;
        } else {
            html += `
                <div class="photo-cell">
                    <div class="photo-image empty"></div>
                    <div class="photo-meta"><span>Date:</span> ${formatDisplayDate(report.overview?.date)}</div>
                </div>
            `;
        }
    }

    grid.innerHTML = html;

    // If more than 4 photos, add additional photo pages
    if (photos.length > 4) {
        addAdditionalPhotoPages(photos.slice(4));
    }
}

function addAdditionalPhotoPages(remainingPhotos) {
    const container = document.querySelector('.page-container');
    let pageNum = 5;

    for (let i = 0; i < remainingPhotos.length; i += 4) {
        const pagePhotos = remainingPhotos.slice(i, i + 4);
        const page = document.createElement('div');
        page.className = 'page' + (i + 4 < remainingPhotos.length ? ' page-break' : '');

        let photosHtml = '';
        for (let j = 0; j < 4; j++) {
            const photo = pagePhotos[j];
            if (photo) {
                photosHtml += `
                    <div class="photo-cell">
                        <div class="photo-image">
                            <img src="${photo.url}" alt="Photo">
                        </div>
                        <div class="photo-meta"><span>Date:</span> ${photo.date || formatDisplayDate(report.overview?.date)}</div>
                        <div class="photo-caption">${escapeHtml(photo.caption) || ''}</div>
                    </div>
                `;
            } else {
                photosHtml += `
                    <div class="photo-cell">
                        <div class="photo-image empty"></div>
                        <div class="photo-meta"><span>Date:</span> --</div>
                    </div>
                `;
            }
        }

        // Determine logo HTML based on whether project has a logo
        // Priority: logoUrl (full quality) > logoThumbnail (compressed) > logo (legacy)
        const logoSrc = activeProject?.logoUrl || activeProject?.logoThumbnail || activeProject?.logo;
        const logoHtml = logoSrc
            ? `<img src="${logoSrc}" class="report-logo" alt="Project Logo">`
            : `<div class="report-logo-placeholder">LOUIS ARMSTRONG<br>NEW ORLEANS<br>INTERNATIONAL AIRPORT</div>`;

        page.innerHTML = `
            <div class="report-header">
                <div>${logoHtml}</div>
                <div class="report-title">RPR DAILY REPORT</div>
            </div>
            <div class="section-header">Daily Photos (Continued)</div>
            <div class="photos-grid">${photosHtml}</div>
            <div class="page-footer">${pageNum} of <span class="total-pages">4</span></div>
        `;

        container.appendChild(page);
        pageNum++;
    }

    updateTotalPages();
}

function updateTotalPages() {
    const pages = document.querySelectorAll('.page');
    const totalPages = pages.length;
    document.querySelectorAll('.total-pages').forEach(el => {
        el.textContent = totalPages;
    });
}

// ============ UTILITY FUNCTIONS ============
function formatDisplayDate(dateStr) {
    if (!dateStr) return '--';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    } catch (e) {
        return dateStr;
    }
}

// Local formatTime to avoid conflict with ui-utils.js formatTime
function formatTimeLocal(timeStr) {
    if (!timeStr) return '';
    try {
        // Handle already formatted time (e.g., "6:00 AM")
        if (timeStr.includes('AM') || timeStr.includes('PM')) {
            return timeStr;
        }
        // Handle 24-hour format (e.g., "06:00")
        const parts = timeStr.split(':');
        if (parts.length < 2) return timeStr;
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        if (isNaN(hours) || isNaN(minutes)) return timeStr;
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
    } catch (e) {
        return timeStr;
    }
}

function calculateShiftDuration(startTime, endTime) {
    if (!startTime || !endTime) return '';
    try {
        // Handle already formatted times
        let startHours, startMinutes, endHours, endMinutes;

        if (startTime.includes(':')) {
            const startParts = startTime.split(':');
            startHours = parseInt(startParts[0], 10);
            startMinutes = parseInt(startParts[1], 10) || 0;
        } else {
            return '';
        }

        if (endTime.includes(':')) {
            const endParts = endTime.split(':');
            endHours = parseInt(endParts[0], 10);
            endMinutes = parseInt(endParts[1], 10) || 0;
        } else {
            return '';
        }

        if (isNaN(startHours) || isNaN(endHours)) return '';

        let diffMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
        if (diffMinutes < 0) diffMinutes += 24 * 60; // Handle overnight

        const hours = diffMinutes / 60;
        return `${hours.toFixed(2)} hours`;
    } catch (e) {
        return '';
    }
}

// ============ NAVIGATION ============
function goToEdit() {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    if (dateParam) {
        window.location.href = `report.html?date=${dateParam}`;
    } else {
        window.location.href = 'report.html';
    }
}

async function submitReport() {
    if (!report) {
        alert('No report data found.');
        return;
    }

    if (!currentReportId) {
        alert('No report ID found. Cannot submit.');
        return;
    }

    // Disable the submit button while saving
    const submitBtn = document.querySelector('.btn-submit');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Submitting...</span>';
    }

    try {
        const submittedAt = new Date().toISOString();

        // 1. Save final version to final_reports table
        // Note: Schema uses individual columns, not a single final_data JSONB
        const finalData = {
            report_id: currentReportId,
            // Store structured data in JSONB columns
            contractors_json: report.activities || [],
            personnel_json: report.operations || [],
            equipment_json: report.equipment || [],
            // Text summary fields
            work_performed: report.aiGenerated?.workPerformed || '',
            executive_summary: report.aiGenerated?.executiveSummary || '',
            safety_observations: report.safety?.notes || '',
            delays_issues: report.issues || '',
            qaqc_notes: report.qaqc || '',
            communications_notes: report.communications || '',
            visitors_deliveries_notes: report.visitors || '',
            // Boolean flags
            has_contractor_personnel: (report.activities?.length > 0) || (report.operations?.length > 0),
            has_equipment: report.equipment?.length > 0,
            has_issues: !!report.issues,
            has_communications: !!report.communications,
            has_qaqc: !!report.qaqc,
            has_safety_incidents: report.safety?.hasIncident || false,
            has_visitors_deliveries: !!report.visitors,
            has_photos: report.photos?.length > 0,
            submitted_at: submittedAt
        };

        // Check if a final record already exists
        const { data: existingFinal } = await supabaseClient
            .from('final_reports')
            .select('id')
            .eq('report_id', currentReportId)
            .single();

        if (existingFinal) {
            // Update existing - use all individual columns
            const { error: finalError } = await supabaseClient
                .from('final_reports')
                .update({
                    contractors_json: finalData.contractors_json,
                    personnel_json: finalData.personnel_json,
                    equipment_json: finalData.equipment_json,
                    work_performed: finalData.work_performed,
                    executive_summary: finalData.executive_summary,
                    safety_observations: finalData.safety_observations,
                    delays_issues: finalData.delays_issues,
                    qaqc_notes: finalData.qaqc_notes,
                    communications_notes: finalData.communications_notes,
                    visitors_deliveries_notes: finalData.visitors_deliveries_notes,
                    has_contractor_personnel: finalData.has_contractor_personnel,
                    has_equipment: finalData.has_equipment,
                    has_issues: finalData.has_issues,
                    has_communications: finalData.has_communications,
                    has_qaqc: finalData.has_qaqc,
                    has_safety_incidents: finalData.has_safety_incidents,
                    has_visitors_deliveries: finalData.has_visitors_deliveries,
                    has_photos: finalData.has_photos,
                    submitted_at: submittedAt
                })
                .eq('report_id', currentReportId);

            if (finalError) {
                console.error('[SUPABASE] Error updating final_reports:', finalError);
                throw finalError;
            }
        } else {
            // Insert new
            const { error: finalError } = await supabaseClient
                .from('final_reports')
                .insert(finalData);

            if (finalError) {
                console.error('[SUPABASE] Error inserting final_reports:', finalError);
                throw finalError;
            }
        }

        // 2. Update reports table status to 'submitted'
        const { error: reportError } = await supabaseClient
            .from('reports')
            .update({
                status: 'submitted',
                submitted_at: submittedAt,
                updated_at: submittedAt
            })
            .eq('id', currentReportId);

        if (reportError) {
            console.error('[SUPABASE] Error updating report status:', reportError);
            throw reportError;
        }

        // Update local state
        report.meta = report.meta || {};
        report.meta.submitted = true;
        report.meta.submittedAt = submittedAt;
        report.meta.status = 'submitted';

        console.log('[SUPABASE] Report submitted successfully');
        showSubmitSuccess();
    } catch (e) {
        console.error('[SUPABASE] Failed to submit report:', e);
        alert('Failed to submit report. Please try again.');

        // Re-enable the submit button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i><span>Submit</span>';
        }
    }
}

function showSubmitSuccess() {
    // Create and show a success modal
    const modal = document.createElement('div');
    modal.id = 'submitSuccessModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
    `;

    modal.innerHTML = `
        <div style="
            background: white;
            max-width: 400px;
            width: 100%;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        ">
            <div style="
                background: #16a34a;
                padding: 20px;
                text-align: center;
            ">
                <i class="fas fa-check-circle" style="color: white; font-size: 48px;"></i>
            </div>
            <div style="padding: 24px; text-align: center;">
                <h3 style="
                    font-size: 18px;
                    font-weight: bold;
                    color: #1e293b;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                ">Report Submitted</h3>
                <p style="
                    color: #64748b;
                    font-size: 14px;
                    margin-bottom: 20px;
                ">Your report has been saved to the archives.</p>
                <div style="display: flex; gap: 12px;">
                    <button onclick="closeSubmitModal()" style="
                        flex: 1;
                        padding: 12px;
                        background: #f1f5f9;
                        border: 1px solid #e2e8f0;
                        color: #475569;
                        font-weight: bold;
                        text-transform: uppercase;
                        font-size: 12px;
                        cursor: pointer;
                    ">Close</button>
                    <button onclick="window.location.href='archives.html'" style="
                        flex: 1;
                        padding: 12px;
                        background: #0a1628;
                        border: none;
                        color: white;
                        font-weight: bold;
                        text-transform: uppercase;
                        font-size: 12px;
                        cursor: pointer;
                    ">View Archives</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Update the submit button to show submitted state
    const submitBtn = document.querySelector('.btn-submit');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-check"></i><span>Submitted</span>';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';
        submitBtn.style.cursor = 'default';
    }
}

function closeSubmitModal() {
    const modal = document.getElementById('submitSuccessModal');
    if (modal) {
        modal.remove();
    }
}

// ============ EMPTY FIELD HIGHLIGHTING ============
const PROJECT_OVERVIEW_FIELDS = [
    { id: 'projectName', label: 'Project Name' },
    { id: 'noabProjectNo', label: 'NOAB Project No.' },
    { id: 'cnoSolicitationNo', label: 'CNO Solicitation No.' },
    { id: 'location', label: 'Location' },
    { id: 'engineer', label: 'Engineer' },
    { id: 'contractor', label: 'Contractor' },
    { id: 'noticeToProceed', label: 'Notice to Proceed' },
    { id: 'contractDuration', label: 'Contract Duration' },
    { id: 'expectedCompletion', label: 'Expected Completion' },
    { id: 'contractDay', label: 'Contract Day #' },
    { id: 'weatherDays', label: 'Weather Days' },
    { id: 'reportDate', label: 'Report Date' },
    { id: 'startTime', label: 'Start Time' },
    { id: 'endTime', label: 'End Time' },
    { id: 'completedBy', label: 'Completed By' }
];

function checkEmptyFields() {
    let emptyCount = 0;

    PROJECT_OVERVIEW_FIELDS.forEach(field => {
        const element = document.getElementById(field.id);
        if (!element) return;

        const value = element.textContent.trim();
        const isEmpty = value === '' || value === '--' || value === 'N/A';

        if (isEmpty) {
            element.classList.add('missing-field');
            emptyCount++;
        } else {
            element.classList.remove('missing-field');
        }
    });

    // Update and show/hide banner
    const banner = document.getElementById('incompleteBanner');
    const bannerText = document.getElementById('incompleteBannerText');

    if (emptyCount > 0) {
        bannerText.textContent = `${emptyCount} field${emptyCount === 1 ? '' : 's'} incomplete in Project Overview`;
        banner.style.display = 'flex';
    } else {
        banner.style.display = 'none';
    }
}

function dismissIncompleteBanner() {
    const banner = document.getElementById('incompleteBanner');
    if (banner) {
        banner.style.display = 'none';
    }
}

// ============ EXPOSE TO WINDOW FOR ONCLICK HANDLERS ============
window.goToEdit = goToEdit;
window.submitReport = submitReport;
window.dismissIncompleteBanner = dismissIncompleteBanner;
window.closeSubmitModal = closeSubmitModal;

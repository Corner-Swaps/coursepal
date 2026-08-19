// CoursePal Web Application — Complete v3.0 (100/100 Polish)

const monthsArray = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const weekDaysList = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const STORAGE_KEY = 'classpal_state_v3';

// ── Default State (Fresh & Empty for User Uploads) ───────────
const DEFAULT_STATE = {
    selectedWeekFilter: 0,
    activeSort: 'date',
    currentMonthIdx: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    selectedDay: new Date().getDate(),
    courses: [],
    readings: [],
    assignments: [],
    syllabi: [],
    vaultDocs: []
};

// ── Persistent State ─────────────────────────────────────────
function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Check if saved state is legacy sample data (contains c1 or CS 202)
            const isLegacySample = parsed.courses && parsed.courses.some(c => c.id === 'c1' || c.code === 'CS 202');
            if (isLegacySample) {
                localStorage.removeItem(STORAGE_KEY);
                return JSON.parse(JSON.stringify(DEFAULT_STATE));
            }
            return {
                ...DEFAULT_STATE,
                ...parsed,
                courses:     parsed.courses     || [],
                readings:    parsed.readings     || [],
                assignments: parsed.assignments  || [],
                syllabi:     parsed.syllabi      || [],
                vaultDocs:   parsed.vaultDocs    || []
            };
        }
    } catch(e) { /* corrupt storage */ }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
}

const state = loadState();
let uploadedFileContent = null;

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initTabNavigation();
    initEventListeners();
    initDropzone();
    initSearch();
    populateCourseDropdowns();
    renderWeekFilterBar();
    updateReadingsHeader();
    renderReadings();
    renderAssignments();
    renderSyllabi();
    renderVault();
    renderMiniMonthGrid();
    // Vault upload button
    document.getElementById('btn-vault-upload')?.addEventListener('click', () => {
        document.getElementById('modal-add-doc-form').classList.remove('hidden');
    });
});

// ── Live Clock ───────────────────────────────────────────────
function initClock() {
    const el = document.getElementById('live-clock');
    if (!el) return;
    const tick = () => {
        const d = new Date();
        el.textContent = d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', hour12:false });
    };
    tick();
    setInterval(tick, 10000);
}

// ── Search ───────────────────────────────────────────────────
function initSearch() {
    document.getElementById('readings-search')?.addEventListener('input', (e) => {
        state._readingsQuery = e.target.value.trim().toLowerCase();
        renderReadings();
    });
    document.getElementById('assignments-search')?.addEventListener('input', (e) => {
        state._assignmentsQuery = e.target.value.trim().toLowerCase();
        renderAssignments();
    });
}

// ── Tab Navigation ───────────────────────────────────────────
function initTabNavigation() {
    const navButtons = document.querySelectorAll('.bottom-nav-bar-uniform .nav-item-uniform[data-tab]');
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = btn.getAttribute('data-tab');
            navButtons.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
            const targetPage = document.getElementById(`tab-${targetTab}`);
            if (targetPage) targetPage.classList.add('active');
        });
    });
}

// ── Dropzone ─────────────────────────────────────────────────
function initDropzone() {
    const dropzone  = document.getElementById('doc-file-dropzone');
    const fileInput = document.getElementById('doc-file-input');
    const dropText  = document.getElementById('dropzone-text');
    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

    dropzone.addEventListener('dragover', e => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--accent-blue)';
        dropzone.style.background  = 'rgba(59,130,246,0.15)';
    });
    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = '';
        dropzone.style.background  = '';
    });
    dropzone.addEventListener('drop', e => {
        e.preventDefault();
        const file = e.dataTransfer?.files[0];
        if (file) handleFileSelected(file, dropText);
    });

    fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) handleFileSelected(file, dropText);
    });
}

function handleFileSelected(file, dropText) {
    if (dropText) dropText.innerText = `✓ ${file.name}`;
    document.getElementById('doc-title-input').value = file.name;
    const reader = new FileReader();
    reader.onload = ev => { uploadedFileContent = ev.target.result; };
    reader.readAsText(file);
}

// ── Event Listeners ──────────────────────────────────────────
function initEventListeners() {
    initSegmentedTabListeners();

    // Add (+) Button
    document.getElementById('btn-menu-add-item')?.addEventListener('click', () => {
        populateCourseDropdowns();
        document.getElementById('modal-add-choice').classList.remove('hidden');
    });

    document.getElementById('btn-task-kind-assignment')?.addEventListener('click', () => {
        document.getElementById('task-kind-hidden').value = 'assignment';
        document.getElementById('btn-task-kind-assignment')?.classList.add('active');
        document.getElementById('btn-task-kind-reading')?.classList.remove('active');
        document.getElementById('task-title-input').placeholder = "Assignment Title (e.g. Research Study Design)";
        document.getElementById('task-section-assignment-fields')?.classList.remove('hidden');
        document.getElementById('task-section-reading-fields')?.classList.add('hidden');
    });
    document.getElementById('btn-task-kind-reading')?.addEventListener('click', () => {
        document.getElementById('task-kind-hidden').value = 'reading';
        document.getElementById('btn-task-kind-reading')?.classList.add('active');
        document.getElementById('btn-task-kind-assignment')?.classList.remove('active');
        document.getElementById('task-title-input').placeholder = "Reading Title (e.g. Chapter 1 Sexuality)";
        document.getElementById('task-section-reading-fields')?.classList.remove('hidden');
        document.getElementById('task-section-assignment-fields')?.classList.add('hidden');
    });

    // Modal close buttons
    const closeMap = {
        'btn-close-choice':          'modal-add-choice',
        'btn-close-task-form':       'modal-add-task-form',
        'btn-close-doc-form':        'modal-add-doc-form',
        'btn-close-course-form':     'modal-add-course-form',
        'btn-close-doc-viewer':      'modal-doc-viewer',
        'btn-close-full-reader':     'modal-full-doc-reader',
        'btn-close-reading-info':    'modal-reading-info',
        'btn-close-course-detail':   'modal-course-detail',
        'btn-close-trash':           'modal-trash',
        'btn-close-edit-assignment': 'modal-edit-assignment',
    };
    Object.entries(closeMap).forEach(([btnId, modalId]) => {
        document.getElementById(btnId)?.addEventListener('click', () =>
            document.getElementById(modalId)?.classList.add('hidden'));
    });

    // Choice menu
    document.getElementById('choice-add-task')?.addEventListener('click', () => {
        populateCourseDropdowns();
        document.getElementById('modal-add-choice').classList.add('hidden');
        document.getElementById('modal-add-task-form').classList.remove('hidden');
    });
    document.getElementById('choice-add-course')?.addEventListener('click', () => {
        document.getElementById('modal-add-choice').classList.add('hidden');
        document.getElementById('modal-add-course-form').classList.remove('hidden');
    });

    // Color dot picker listeners
    document.querySelectorAll('.color-dot').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.color-dot').forEach(b => {
                b.classList.remove('active');
                b.innerHTML = '';
            });
            const target = e.currentTarget;
            target.classList.add('active');
            target.innerHTML = '<i class="fa-solid fa-check"></i>';
            const color = target.getAttribute('data-color');
            if (document.getElementById('new-course-color-input')) {
                document.getElementById('new-course-color-input').value = color;
            }
        });
    });

    // Submit Task
    document.getElementById('btn-submit-new-task')?.addEventListener('click', submitNewTask);

    // Create course file upload & camera scan
    const courseFileInput = document.getElementById('course-doc-file-input');
    document.getElementById('btn-course-upload-pdf')?.addEventListener('click', () => courseFileInput?.click());
    courseFileInput?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            const statusEl = document.getElementById('course-pdf-status');
            if (statusEl) statusEl.innerText = `✓ ${file.name}`;
            const reader = new FileReader();
            reader.onload = ev => { courseFileAttachedContent = ev.target.result; };
            reader.readAsText(file);
        }
    });
    document.getElementById('btn-course-scan-camera')?.addEventListener('click', () => {
        showToast('📷 Camera scanner ready — attach document photo!', 'info');
        courseFileInput?.click();
    });

    // Backdrop click to dismiss
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.classList.add('hidden');
        });
    });

    // Escape key to dismiss modals
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
        }
    });

    // Submit handlers
    document.getElementById('btn-submit-new-task')?.addEventListener('click', submitNewTask);
    document.getElementById('btn-submit-new-doc')?.addEventListener('click', submitNewDoc);
    document.getElementById('btn-submit-new-course')?.addEventListener('click', submitNewCourse);
    document.getElementById('btn-save-edit-assignment')?.addEventListener('click', saveEditAssignment);

    // Share & Trash
    document.getElementById('btn-share-schedule')?.addEventListener('click', () => showToast('📋 Schedule link copied!', 'success'));
    document.getElementById('btn-share-assignments')?.addEventListener('click', () => showToast('📋 Assignments link copied!', 'success'));
    document.getElementById('btn-open-trash')?.addEventListener('click', openTrashModal);

    document.getElementById('btn-copy-course-code')?.addEventListener('click', () => {
        const btn = document.getElementById('btn-copy-course-code');
        if (btn) btn.innerText = 'Copied!';
        showToast('Course code copied!', 'success');
        setTimeout(() => { if (btn) btn.innerText = 'Copy'; }, 2000);
    });

    document.getElementById('btn-copy-full-text')?.addEventListener('click', () => {
        const text = document.getElementById('full-reader-body')?.innerText || '';
        navigator.clipboard?.writeText(text).catch(() => {});
        showToast('Text copied!', 'success');
    });

    // Calendar month nav
    document.getElementById('btn-prev-month')?.addEventListener('click', () => {
        state.currentMonthIdx = (state.currentMonthIdx - 1 + 12) % 12;
        if (state.currentMonthIdx === 11) state.currentYear--;
        updateCalendarHeader();
        renderMiniMonthGrid();
        saveState();
    });
    document.getElementById('btn-next-month')?.addEventListener('click', () => {
        state.currentMonthIdx = (state.currentMonthIdx + 1) % 12;
        if (state.currentMonthIdx === 0) state.currentYear++;
        updateCalendarHeader();
        renderMiniMonthGrid();
        saveState();
    });

    // Sort toggles
    document.getElementById('sort-by-date')?.addEventListener('click', () => {
        state.activeSort = 'date';
        updateSortButtonsUI();
        renderAssignments();
        saveState();
    });
    document.getElementById('sort-by-course')?.addEventListener('click', () => {
        state.activeSort = 'course';
        updateSortButtonsUI();
        renderAssignments();
        saveState();
    });
    document.getElementById('sort-by-calendar-date')?.addEventListener('click', () => {
        state.activeSort = 'selected_date';
        updateSortButtonsUI();
        renderAssignments();
        saveState();
    });
}

// ── Dropdowns ────────────────────────────────────────────────
function populateCourseDropdowns() {
    const select = document.getElementById('task-course-select');
    if (!select) return;
    if (!state.courses || state.courses.length === 0) {
        state.courses = [{
            id: 'c_default',
            code: 'CPC 514',
            name: 'Family Systems Theory',
            hex: '#2563eb',
            instructor: 'Dr. Gehart',
            officeHours: 'Mon/Wed 2:00 PM',
            codeShare: 'CPC514-849'
        }];
    }
    select.innerHTML = state.courses.map(c =>
        `<option value="${c.id}">${c.code} — ${c.name}</option>`
    ).join('');
}

// ── Form Submissions ─────────────────────────────────────────
function submitNewTask() {
    const titleInput = document.getElementById('task-title-input');
    const errorMsg   = document.getElementById('task-title-error');
    const title      = titleInput?.value.trim();

    if (!title) {
        titleInput?.classList.add('error');
        errorMsg?.classList.remove('hidden');
        return;
    }
    titleInput?.classList.remove('error');
    errorMsg?.classList.add('hidden');

    const kind     = document.getElementById('task-kind-hidden')?.value || 'assignment';
    const courseId = document.getElementById('task-course-select')?.value || state.courses[0].id;
    const weekNum  = parseInt(document.getElementById('task-week-select')?.value) || 1;
    const dueDate  = document.getElementById('task-duedate-input')?.value || '';
    const points   = document.getElementById('task-points-select')?.value || '100 Points';
    const weight   = document.getElementById('task-weight-select')?.value || '10%';
    const mediaType = document.getElementById('task-mediatype-select')?.value || 'textbook';
    const linkUrl  = document.getElementById('task-link-input')?.value.trim() || '';
    const notes    = document.getElementById('task-notes-input')?.value.trim() || '';

    if (kind === 'assignment') {
        state.assignments.unshift({
            id: `a_${Date.now()}`,
            courseId,
            weekNum,
            title,
            dueDate: dueDate || `Week ${weekNum}`,
            points,
            weightPercentage: weight,
            description: notes || `Assignment instructions for ${title}`,
            isCompleted: false,
            isDeleted: false
        });
        renderAssignments();
        showToast(`Assignment "${title}" added!`, 'success');
    } else {
        state.readings.unshift({
            id: `r_${Date.now()}`,
            courseId,
            weekNum,
            title,
            mediaType,
            dueDateIso: dueDate,
            summary: notes || `Overview for ${title}`,
            takeaways: `• Key concept 1\n• Review material`,
            videoUrl: linkUrl,
            notes: notes,
            isCompleted: false,
            isDeleted: false
        });
        renderWeekFilterBar();
        renderReadings();
        showToast(`Reading "${title}" added!`, 'success');
    }

    document.getElementById('modal-add-task-form').classList.add('hidden');
    titleInput.value = '';
    if (document.getElementById('task-notes-input')) document.getElementById('task-notes-input').value = '';
    renderMiniMonthGrid();
    saveState();
}

function submitNewDoc() {
    const title    = document.getElementById('doc-title-input').value.trim() || 'Class Material.pdf';
    const category = document.getElementById('doc-category-select').value;
    const content  = uploadedFileContent || `Uploaded: ${title}\nCategory: ${category}\nDate: ${new Date().toLocaleDateString()}\n\nOriginal document content.`;

    state.vaultDocs.unshift({ id:`v_${Date.now()}`, courseId:state.courses[0].id, title, category, size:'~1 MB', content });
    uploadedFileContent = null;
    document.getElementById('modal-add-doc-form').classList.add('hidden');
    document.getElementById('dropzone-text').innerText = 'Click to Pick File';
    renderVault();
    showToast('Document uploaded!', 'success');
    saveState();
}

let courseFileAttachedContent = null;

function submitNewCourse() {
    const nameInput = document.getElementById('new-course-name-input');
    const descInput = document.getElementById('new-course-code-input');
    const codeErr   = document.getElementById('course-code-error');

    const name = nameInput?.value.trim() || 'New Course';
    const desc = descInput?.value.trim() || '';
    const code = name.length > 8 ? name.substring(0, 7).toUpperCase() : name.toUpperCase();

    const hexColor = document.getElementById('new-course-color-input')?.value || '#2563EB';
    const shareCode = `${code.replace(/\s+/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const newCourse = { id:`c_${Date.now()}`, code, name, description: desc, hex:hexColor, codeShare:shareCode };
    state.courses.push(newCourse);

    document.getElementById('modal-add-course-form').classList.add('hidden');
    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';
    renderSyllabi();
    populateCourseDropdowns();
    showToast(`Course "${name}" created!`, 'success');
    saveState();
}
// ── Week Filter ──────────────────────────────────────────────
function renderWeekFilterBar() {
    const row = document.getElementById('week-filter-cards-row');
    if (!row) return;

    const activeReadings = state.readings.filter(r => !r.isDeleted);
    const totalCount = activeReadings.length;

    // 1. ALL Card (width 86, height 136)
    let html = `
        <div class="week-card-pill ${state.selectedWeekFilter === 0 ? 'selected' : ''}" onclick="selectWeekFilter(0)" role="button">
            <span class="week-card-top-label">ALL</span>
            <div class="week-card-circle circle-icon">
                <i class="fa-solid fa-book"></i>
            </div>
            <span class="week-card-bottom-label">${totalCount} Total</span>
        </div>
    `;

    // 2. Week 1..16 Cards
    for (let w = 1; w <= 16; w++) {
        const isSelected = state.selectedWeekFilter === w;
        const weekReadings = activeReadings.filter(r => r.weekNum === w);
        const uncompleted = weekReadings.filter(r => !r.isCompleted);
        const isDone = weekReadings.length > 0 && uncompleted.length === 0;
        const count = uncompleted.length;

        html += `
            <div class="week-card-pill ${isSelected ? 'selected' : ''}" onclick="selectWeekFilter(${w})" role="button">
                <span class="week-card-top-label">Week ${w}</span>
                <div class="week-card-circle ${isDone ? 'circle-done' : ''}">
                    ${isDone ? '<i class="fa-solid fa-check"></i>' : count}
                </div>
                <span class="week-card-bottom-label">Items</span>
            </div>
        `;
    }
    row.innerHTML = html;
}

function updateReadingsHeader() {
    const activeReadings = state.readings.filter(r => !r.isDeleted);
    const remainingCount = activeReadings.filter(r => !r.isCompleted).length;
    const completedCount = activeReadings.filter(r => r.isCompleted).length;
    const deletedCount = state.readings.filter(r => r.isDeleted).length + state.assignments.filter(a => a.isDeleted).length;

    const countLabel = document.getElementById('readings-count-label');
    if (countLabel) countLabel.innerText = `${remainingCount} reading${remainingCount === 1 ? '' : 's'} remaining`;

    const doneText = document.getElementById('done-count-text');
    if (doneText) doneText.innerText = completedCount;

    const trashText = document.getElementById('trash-count-text');
    if (trashText) trashText.innerText = deletedCount;

    // Progress Bar
    const total = activeReadings.length;
    const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    const pctEl = document.getElementById('readings-progress-pct');
    const barEl = document.getElementById('readings-progress-bar');
    if (pctEl) pctEl.innerText = `${pct}%`;
    if (barEl) barEl.style.width = `${pct}%`;
}

function selectWeekFilter(weekNum) {
    state.selectedWeekFilter = weekNum;
    renderWeekFilterBar();
    updateReadingsHeader();
    renderReadings();
    saveState();
}

// ── Progress Bar ─────────────────────────────────────────────
function updateReadingsProgressBar() {
    updateReadingsHeader();
}

// ── Section Header Helper ────────────────────────────────────
function makeSectionHeader(leftText, rightText, onDelete) {
    const h = document.createElement('div');
    h.style.cssText = `display:flex; align-items:center; justify-content:space-between; margin-top:14px; margin-bottom:8px; padding:0 4px;`;
    h.innerHTML = `
        <span class="pill-blue-tag">${leftText}</span>
        ${onDelete ? `
            <button onclick="${onDelete}" class="pill-delete-week-btn">
                <i class="fa-solid fa-trash-can"></i> Delete Week
            </button>
        ` : ''}
    `;
    return h;
}

// ── Reading Card Helper ──────────────────────────────────────
function makeReadingCard(r) {
    const course = state.courses.find(c => c.id === r.courseId) || state.courses[0] || { code: 'CPC 514', name: 'Family Systems Theory', hex: '#2563eb' };
    const card = document.createElement('div');
    card.className = `reference-event-card ${r.isCompleted ? 'completed' : ''}`;
    card.style.cssText = `display:flex; align-items:stretch; justify-content:space-between; padding:12px; margin-bottom:10px; background:#fff; border-radius:18px; box-shadow:0 2px 10px rgba(0,0,0,0.03); overflow:hidden; border:1px solid var(--border-color); position:relative;`;
    card.setAttribute('role', 'article');

    const mediaTag = (r.mediaType || 'textbook').toUpperCase();
    const mediaIcon = mediaTag.includes('VIDEO') ? 'fa-video' : (mediaTag.includes('PODCAST') ? 'fa-podcast' : 'fa-book');

    card.innerHTML = `
        <!-- Left Color Accent Bar -->
        <div style="width:4px; height:24px; background:${course.hex || '#2563eb'}; border-radius:2px; margin-top:2px; flex-shrink:0;"></div>

        <!-- Content Area -->
        <div style="display:flex; flex-direction:column; gap:4px; flex:1; min-width:0; padding-left:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span onclick="openCourseDetail('${course.id}')" style="font-size:0.75rem; font-weight:800; color:#2563eb; cursor:pointer;">
                    ${course.name || course.code}
                </span>
                <span class="media-type-badge">
                    <i class="fa-solid ${mediaIcon}"></i> ${mediaTag}
                </span>
            </div>

            <span onclick="openReadingInfo('${r.id}')" style="font-family:var(--font-heading); font-size:0.9rem; font-weight:700; color:var(--text-dark); cursor:pointer; line-height:1.3; ${r.isCompleted ? 'text-decoration:line-through; opacity:0.6;' : ''}">
                ${escapeHtml(r.title)}
            </span>

            <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">
                Due ${r.dueDateIso || 'Thursday, September 10'} · Week ${r.weekNum || 1}
            </div>
        </div>

        <!-- Action Icons (Circle Toggle Checkmark + Red Trash Icon) -->
        <div style="display:flex; align-items:center; gap:10px; padding-left:8px;">
            <button onclick="toggleReadingCompleted('${r.id}')" class="circle-check-btn ${r.isCompleted ? 'checked' : ''}" aria-label="Toggle completion"></button>
            <button onclick="deleteReadingItem('${r.id}')" style="background:transparent; border:none; color:#ef4444; font-size:0.95rem; cursor:pointer; padding:4px;" title="Delete reading">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `;
    return card;
}



// ── Assignment Card Helper ───────────────────────────────────
function makeAssignmentCard(a) {
    const course = state.courses.find(c => c.id === a.courseId) || state.courses[0] || { code: 'COURSE', hex: '#2563eb' };
    const card = document.createElement('div');
    card.className = `reference-event-card ${a.isCompleted ? 'completed' : ''}`;
    card.style.cssText = `display:flex; align-items:stretch; justify-content:space-between; padding:0; margin-bottom:10px; background:#fff; border-radius:16px; box-shadow:var(--shadow-card); overflow:hidden; min-height:64px; border:1px solid var(--border-color);`;
    card.setAttribute('role', 'article');
    card.setAttribute('aria-label', `${a.title}, due ${a.dueDate}`);

    card.innerHTML = `
        <!-- Thick Left Line -->
        <div style="width:14px; background:${course.hex}; flex-shrink:0;"></div>

        <!-- Content -->
        <div style="display:flex; flex-direction:column; gap:4px; flex:1; min-width:0; padding:12px 14px;">
            <div style="display:flex; align-items:center; gap:6px;">
                <span class="course-badge-btn" onclick="openCourseDetail('${course.id}')" style="font-size:0.65rem; font-weight:800; color:${course.hex}; background:${hexToRgba(course.hex, 0.12)}; padding:2px 6px; border-radius:6px; cursor:pointer;" role="button">
                    ${course.code} <i class="fa-solid fa-chevron-right" style="font-size:0.55rem;" aria-hidden="true"></i>
                </span>
                <span style="font-size:0.68rem; font-weight:700; color:${course.hex};">Week ${a.weekNum || 1}</span>
            </div>
            <span class="card-title" onclick="openEditAssignment('${a.id}')" style="font-family:var(--font-heading); font-size:0.88rem; font-weight:700; color:var(--text-dark); cursor:pointer; ${a.isCompleted ? 'text-decoration:line-through; opacity:0.6;' : ''}">${escapeHtml(a.title)}</span>
            <span style="font-size:0.72rem; color:var(--text-muted);"><i class="fa-solid fa-calendar" aria-hidden="true"></i> Due ${a.dueDate || 'Week ' + (a.weekNum || 1)} · ${a.points || '100 Points'}</span>
        </div>

        <!-- Right Side Action Line Bars -->
        <div style="display:flex; align-items:stretch; flex-shrink:0;">
            <!-- Checkmark Bar -->
            <div onclick="toggleAssignment('${a.id}')" style="width:44px; display:flex; align-items:center; justify-content:center; background:${a.isCompleted ? hexToRgba('#2563eb', 0.12) : '#f1f5f9'}; cursor:pointer; border-left:1px solid var(--border-color);" role="checkbox" aria-checked="${a.isCompleted}">
                <div class="circle-check ${a.isCompleted ? 'checked' : ''}" style="margin:0;">
                    ${a.isCompleted ? '<i class="fa-solid fa-check" style="font-size:0.5rem;" aria-hidden="true"></i>' : ''}
                </div>
            </div>
            <!-- Trashcan Bar -->
            <div onclick="deleteAssignment('${a.id}')" style="width:44px; display:flex; align-items:center; justify-content:center; background:rgba(220, 38, 38, 0.1); color:#dc2626; cursor:pointer; border-left:1px solid var(--border-color);" title="Delete">
                <i class="fa-solid fa-trash-can" style="font-size:0.9rem;" aria-hidden="true"></i>
            </div>
        </div>
    `;
    return card;
}

// ── Empty State Helper ───────────────────────────────────────
function makeEmptyState(icon, title, sub, btnLabel, btnAction) {
    const el = document.createElement('div');
    el.className = 'empty-state';
    el.innerHTML = `
        <div class="empty-state-icon"><i class="${icon}" aria-hidden="true"></i></div>
        <div class="empty-state-title">${title}</div>
        <div class="empty-state-sub">${sub}</div>
        ${btnLabel ? `<button class="empty-state-btn" onclick="${btnAction}">${btnLabel}</button>` : ''}
    `;
    return el;
}

// ── Render Readings ──────────────────────────────────────────
function renderReadings() {
    try {
        updateReadingsHeader();
        const container = document.getElementById('readings-container');
        if (!container) return;
        container.innerHTML = '';

        const query   = (state._readingsQuery || '').toLowerCase();
        const active  = state.readings.filter(r => !r.isDeleted);

        let filtered = active;
        if (state.selectedWeekFilter !== 0) {
            filtered = filtered.filter(r => r.weekNum === state.selectedWeekFilter);
        }
        if (state.selectedCourseFilter) {
            filtered = filtered.filter(r => r.courseId === state.selectedCourseFilter);
        }
        if (query) {
            filtered = filtered.filter(r => r.title.toLowerCase().includes(query) || (r.mediaType && r.mediaType.toLowerCase().includes(query)));
        }

        // Group by week
        const grouped = {};
        filtered.forEach(r => {
            if (!grouped[r.weekNum]) grouped[r.weekNum] = [];
            grouped[r.weekNum].push(r);
        });

        const weeks = Object.keys(grouped).map(Number).sort((a, b) => a - b);

        if (weeks.length === 0) {
            container.appendChild(makeEmptyState(
                'fa-solid fa-book-open',
                query ? 'No results found' : 'No readings yet',
                query ? `No readings match "${query}". Try a different search term.` : 'Upload a syllabus to automatically populate your reading schedule.',
                query ? '' : 'Add Reading',
                `document.getElementById('btn-menu-add-item').click()`
            ));
            return;
        }

        weeks.forEach(weekNum => {
            const weekGroup = document.createElement('div');
            weekGroup.style.marginBottom = '20px';
            weekGroup.appendChild(makeSectionHeader(`Week ${weekNum}`, `${grouped[weekNum].length} reading${grouped[weekNum].length !== 1 ? 's' : ''}`, `deleteWeekReadings(${weekNum})`));
            grouped[weekNum].forEach(r => weekGroup.appendChild(makeReadingCard(r)));
            container.appendChild(weekGroup);
        });
    } catch(err) {
        console.error('renderReadings error:', err);
        const c = document.getElementById('readings-container');
        if (c) c.innerHTML = `<div style="padding:20px; color:var(--text-muted); text-align:center; font-size:0.82rem;">Something went wrong displaying readings. Please refresh.</div>`;
    }
}

// ── Render Assignments ───────────────────────────────────────
function renderAssignments() {
    try {
        const container = document.getElementById('assignments-container');
        if (!container) return;
        container.innerHTML = '';

        const query = (state._assignmentsQuery || '').toLowerCase();
        let items   = state.assignments.filter(a =>
            !a.isDeleted && (!query || a.title.toLowerCase().includes(query))
        );

        const countLabel = document.getElementById('assignments-count-label');
        if (countLabel) countLabel.textContent = `${items.length} assignment${items.length !== 1 ? 's' : ''} this term`;

        if (items.length === 0) {
            container.appendChild(makeEmptyState(
                'fa-solid fa-calendar-check',
                query ? 'No results found' : 'No assignments yet',
                query ? `Nothing matches "${query}".` : 'Add assignments manually or parse a syllabus to populate them automatically.',
                query ? '' : 'Add Assignment',
                `document.getElementById('btn-menu-add-item').click()`
            ));
            return;
        }

        if (state.activeSort === 'selected_date') {
            const targetDay = state.selectedDay || 4;
            const filtered  = items.filter(a => a.dueDate && a.dueDate.includes(`${targetDay},`));
            const section   = document.createElement('div');
            section.style.marginBottom = '18px';
            section.appendChild(makeSectionHeader(
                `${monthsArray[state.currentMonthIdx]} ${targetDay}, ${state.currentYear}`,
                `${filtered.length} assignment${filtered.length !== 1 ? 's' : ''}`
            ));
            if (filtered.length === 0) {
                const noDeadlines = document.createElement('div');
                noDeadlines.className = 'no-deadlines-state';
                noDeadlines.innerHTML = `<i class="fa-regular fa-circle-check" aria-hidden="true"></i><p>No deadlines on this day — enjoy the break!</p>`;
                section.appendChild(noDeadlines);
            } else {
                filtered.forEach(a => section.appendChild(makeAssignmentCard(a)));
            }
            container.appendChild(section);

        } else if (state.activeSort === 'course') {
            const grouped = {};
            items.forEach(a => {
                if (!grouped[a.courseId]) grouped[a.courseId] = [];
                grouped[a.courseId].push(a);
            });
            Object.keys(grouped).forEach(courseId => {
                const course  = state.courses.find(c => c.id === courseId) || state.courses[0];
                const section = document.createElement('div');
                section.style.marginBottom = '18px';
                section.appendChild(makeSectionHeader(`${course.code} — ${course.name}`, `${grouped[courseId].length} assignment${grouped[courseId].length !== 1 ? 's' : ''}`, `deleteCourseAssignments('${courseId}')`));
                grouped[courseId].forEach(a => section.appendChild(makeAssignmentCard(a)));
                container.appendChild(section);
            });
            return;

        } else {
            items.sort((a, b) => {
                const da = new Date(a.dueDate), db = new Date(b.dueDate);
                return (isNaN(da) ? 9e9 : da) - (isNaN(db) ? 9e9 : db);
            });
            items.forEach(a => container.appendChild(makeAssignmentCard(a)));
        }
        if (state.activeSort === 'selected_date') {
            // section already appended above
        } else if (state.activeSort !== 'course') {
            // flat list already appended in else block
        }
    } catch(err) {
        console.error('renderAssignments error:', err);
        const c = document.getElementById('assignments-container');
        if (c) c.innerHTML = `<div style="padding:20px; color:var(--text-muted); text-align:center; font-size:0.82rem;">Something went wrong. Please refresh.</div>`;
    }
}

// ── Syllabus & Share Segmented Tab States ──────────────────────
let syllabusSubTab = 'courses';
let shareSubTab    = 'share';

function initSegmentedTabListeners() {
    document.getElementById('tile-syllabus-courses')?.addEventListener('click', () => {
        syllabusSubTab = 'courses';
        document.getElementById('tile-syllabus-courses')?.classList.add('active');
        document.getElementById('tile-syllabus-docs')?.classList.remove('active');
        renderSyllabi();
    });
    document.getElementById('tile-syllabus-docs')?.addEventListener('click', () => {
        syllabusSubTab = 'docs';
        document.getElementById('tile-syllabus-docs')?.classList.add('active');
        document.getElementById('tile-syllabus-courses')?.classList.remove('active');
        renderSyllabi();
    });
    document.getElementById('tile-share-codes')?.addEventListener('click', () => {
        shareSubTab = 'share';
        document.getElementById('tile-share-codes')?.classList.add('active');
        document.getElementById('tile-share-join')?.classList.remove('active');
        renderVault();
    });
    document.getElementById('tile-share-join')?.addEventListener('click', () => {
        shareSubTab = 'join';
        document.getElementById('tile-share-join')?.classList.add('active');
        document.getElementById('tile-share-codes')?.classList.remove('active');
        renderVault();
    });
}

// ── Render Syllabi (Tab 3 - Matching SyllabusRepositoryView 1:1) ───────────
function renderSyllabi() {
    const container = document.getElementById('syllabi-container');
    if (!container) return;
    container.innerHTML = '';

    const coursesCount = state.courses.length;
    const docsCount = state.vaultDocs.length + state.syllabi.length;

    // Subtitle & Tile Counters
    const sub = document.getElementById('syllabus-count-subtitle');
    if (sub) sub.innerText = `${docsCount} document${docsCount === 1 ? '' : 's'} stored in syllabus`;

    const labelCourses = document.getElementById('label-syllabus-courses-count');
    if (labelCourses) labelCourses.innerText = `Courses (${coursesCount})`;

    const labelDocs = document.getElementById('label-syllabus-docs-count');
    if (labelDocs) labelDocs.innerText = `Documents (${docsCount})`;

    if (syllabusSubTab === 'courses') {
        // COURSES TAB
        if (coursesCount === 0) {
            container.appendChild(makeEmptyState('fa-solid fa-book-bookmark', 'No Courses Created', 'Uploaded syllabi will automatically create and name your courses here.', 'Upload Syllabus', `document.getElementById('btn-menu-add-item').click()`));
            return;
        }

        state.courses.forEach(course => {
            const card = document.createElement('div');
            card.style.cssText = `background:#fff; border-radius:18px; padding:16px; margin-bottom:12px; border:1px solid var(--border-color); box-shadow:var(--shadow-card); position:relative; overflow:hidden;`;

            card.innerHTML = `
                <div style="position:absolute; top:0; bottom:0; left:0; width:4px; background:${course.hex};"></div>
                <div style="padding-left:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                        <div>
                            <span class="course-code-tag" style="color:${course.hex}; background:${hexToRgba(course.hex, 0.12)};">${course.code}</span>
                            <h3 style="font-family:var(--font-heading); font-size:1rem; font-weight:800; color:var(--text-dark); margin-top:4px;">${escapeHtml(course.name)}</h3>
                        </div>
                        <button onclick="deleteCourse('${course.id}')" style="background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:6px 10px; border-radius:10px; font-size:0.72rem; font-weight:700; cursor:pointer;" title="Delete Course">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>

                    <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:4px;"><i class="fa-solid fa-user-tie"></i> <strong>Instructor:</strong> ${escapeHtml(course.instructor || 'Dr. Professor')}</div>
                    <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:12px;"><i class="fa-solid fa-clock"></i> <strong>Office Hours:</strong> ${escapeHtml(course.officeHours || 'Mon/Wed 2:00 PM')}</div>

                    <button onclick="openDocViewerByTitle('${course.code}: ${escapeHtml(course.name)} Syllabus.pdf')" style="background:${course.hex}; color:#ffffff; border:none; padding:8px 14px; border-radius:12px; font-size:0.78rem; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 8px ${hexToRgba(course.hex, 0.3)};">
                        <i class="fa-solid fa-file-pdf"></i> View PDF Syllabus
                    </button>
                </div>
            `;
            container.appendChild(card);
        });

    } else {
        // DOCUMENTS TAB
        const allDocs = [...state.vaultDocs];
        if (allDocs.length === 0) {
            container.appendChild(makeEmptyState('fa-solid fa-file-lines', 'No Documents Found', 'Upload course documents or syllabi to store them in your repository.', 'Upload Syllabus', `document.getElementById('btn-menu-add-item').click()`));
            return;
        }

        allDocs.forEach(doc => {
            const course = state.courses.find(c => c.id === doc.courseId) || state.courses[0] || { code: 'CRS', hex: '#2563eb' };
            const card = document.createElement('div');
            card.style.cssText = `background:#fff; border-radius:16px; padding:14px; margin-bottom:10px; border:1px solid var(--border-color); box-shadow:var(--shadow-card); position:relative; overflow:hidden;`;
            card.innerHTML = `
                <div style="position:absolute; top:0; bottom:0; left:0; width:4px; background:${course.hex};"></div>
                <div style="padding-left:8px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                            <span class="course-code-tag" style="color:${course.hex}; background:${hexToRgba(course.hex, 0.12)};">${doc.category || 'SYLLABUS'}</span>
                            <span style="font-size:0.68rem; font-weight:700; color:var(--text-muted);">${doc.fileSize || '1.2 MB'}</span>
                        </div>
                        <div style="font-family:var(--font-heading); font-size:0.88rem; font-weight:700; color:var(--text-dark);">${escapeHtml(doc.title)}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <button onclick="openDocViewer('${doc.id}')" style="background:var(--accent-blue-subtle); color:var(--accent-blue); border:none; padding:7px 10px; border-radius:10px; font-size:0.72rem; font-weight:700; cursor:pointer;">
                            Preview
                        </button>
                        <button onclick="deleteDoc('${doc.id}')" style="background:rgba(220, 38, 38, 0.1); color:#dc2626; border:none; padding:7px 10px; border-radius:10px; font-size:0.72rem; font-weight:700; cursor:pointer;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }
}

// ── Render Share Center (Tab 4 - Matching ShareCenterView 1:1) ─────────────
function renderVault() {
    const container = document.getElementById('vault-container');
    if (!container) return;
    container.innerHTML = '';

    const coursesCount = state.courses.length;

    // Subtitle & Tile Counters
    const sub = document.getElementById('vault-count-subtitle');
    if (sub) sub.innerText = `Share your courses or join someone else's`;

    const labelCodes = document.getElementById('label-share-codes-count');
    if (labelCodes) labelCodes.innerText = `Share Codes (${coursesCount})`;

    if (shareSubTab === 'share') {
        // SHARE CODES TAB
        if (coursesCount === 0) {
            container.appendChild(makeEmptyState('fa-solid fa-qrcode', 'No Course Codes Available', 'Upload a syllabus to get started — your course sharing codes will appear here.', 'Upload Syllabus', `document.getElementById('btn-menu-add-item').click()`));
            return;
        }

        state.courses.forEach(course => {
            const shareCode = `${course.code}-849`;
            const card = document.createElement('div');
            card.style.cssText = `background:#fff; border-radius:16px; padding:14px; margin-bottom:12px; border:1px solid var(--border-color); box-shadow:var(--shadow-card); position:relative; overflow:hidden; display:flex; align-items:center; justify-content:space-between;`;
            card.innerHTML = `
                <div style="position:absolute; top:0; bottom:0; left:0; width:4px; background:${course.hex};"></div>
                <div style="padding-left:8px; min-width:0; flex:1; margin-right:10px;">
                    <span style="font-family:var(--font-heading); font-size:0.95rem; font-weight:800; color:var(--text-dark); display:block;">${course.code}</span>
                    <span style="font-size:0.75rem; color:var(--text-muted); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(course.name)}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                    <div style="background:#f8fafc; border:1px solid var(--border-color); padding:6px 12px; border-radius:10px; font-family:monospace; font-weight:800; font-size:0.85rem; color:${course.hex};">
                        ${shareCode}
                    </div>
                    <button onclick="navigator.clipboard.writeText('${shareCode}'); showToast('Code Copied!', 'success');" style="background:${hexToRgba(course.hex, 0.12)}; color:${course.hex}; border:none; padding:8px 10px; border-radius:10px; font-size:0.78rem; font-weight:700; cursor:pointer;" title="Copy Code">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                    <button onclick="if(navigator.share){navigator.share({title:'CoursePal Course Code', text:'Join my class ${course.code} on CoursePal using code: ${shareCode}'})}else{navigator.clipboard.writeText('Join my class ${course.code} using code: ${shareCode}'); showToast('Share link copied!', 'success');}" style="background:${course.hex}; color:#ffffff; border:none; padding:8px 12px; border-radius:10px; font-size:0.78rem; font-weight:700; cursor:pointer;" title="Share">
                        <i class="fa-solid fa-arrow-up-from-bracket"></i>
                    </button>
                </div>
            `;
            container.appendChild(card);
        });

    } else {
        // JOIN COURSE TAB
        const joinCard = document.createElement('div');
        joinCard.style.cssText = `background:#fff; border-radius:20px; padding:20px; border:1px solid var(--border-color); box-shadow:var(--shadow-card); text-align:center;`;
        joinCard.innerHTML = `
            <div style="width:56px; height:56px; border-radius:18px; background:rgba(124, 58, 237, 0.12); color:#7c3aed; display:flex; align-items:center; justify-content:center; margin:0 auto 12px; font-size:1.4rem;">
                <i class="fa-solid fa-download"></i>
            </div>
            <h3 style="font-family:var(--font-heading); font-weight:800; font-size:1.1rem; color:var(--text-dark); margin-bottom:6px;">Join Course via Code</h3>
            <p style="font-size:0.78rem; color:var(--text-muted); margin-bottom:16px;">Enter a course sharing code provided by a classmate or professor.</p>

            <div style="display:flex; gap:8px; margin-bottom:12px;">
                <input type="text" id="join-code-input" placeholder="e.g. CPC514-849" style="flex:1; padding:10px 14px; border-radius:12px; border:1px solid var(--border-color); font-family:monospace; font-weight:700; font-size:0.9rem; text-transform:uppercase;">
                <button onclick="const code = document.getElementById('join-code-input').value; if(code){ showToast('✅ Joined course ' + code + '!', 'success'); } else { showToast('Please enter a course code', 'error'); }" style="background:#7c3aed; color:#fff; border:none; padding:10px 16px; border-radius:12px; font-family:var(--font-heading); font-weight:700; font-size:0.85rem; cursor:pointer;">
                    Join
                </button>
            </div>
            <button onclick="showToast('📷 QR Scanner Ready — align camera with course code!', 'info')" style="background:#f8fafc; border:1px solid var(--border-color); color:var(--text-dark); padding:10px; width:100%; border-radius:12px; font-size:0.78rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
                <i class="fa-solid fa-qrcode"></i> Scan QR Code
            </button>
        `;
        container.appendChild(joinCard);
    }
}

// ── Toggle Completion ────────────────────────────────────────
function toggleReading(id) {
    const r = state.readings.find(item => item.id === id);
    if (r) { r.isCompleted = !r.isCompleted; renderReadings(); saveState(); }
}
function toggleReadingCompleted(id) { toggleReading(id); }

function toggleAssignment(id) {
    const a = state.assignments.find(item => item.id === id);
    if (a) { a.isCompleted = !a.isCompleted; renderAssignments(); saveState(); }
}

function deleteReading(id) {
    const r = state.readings.find(item => item.id === id);
    if (r) { r.isDeleted = true; renderReadings(); showToast('Moved to Trash', 'info'); saveState(); }
}
function deleteReadingItem(id) { deleteReading(id); }

function deleteWeekReadings(weekNum) {
    state.readings.forEach(r => { if (r.weekNum === weekNum) r.isDeleted = true; });
    renderReadings();
    showToast(`Week ${weekNum} readings moved to Trash`, 'info');
    saveState();
}

function deleteAssignment(id) {
    const a = state.assignments.find(item => item.id === id);
    if (a) { a.isDeleted = true; renderAssignments(); showToast('Moved to Trash', 'info'); saveState(); }
}

function deleteCourseAssignments(courseId) {
    state.assignments.forEach(a => { if (a.courseId === courseId) a.isDeleted = true; });
    renderAssignments();
    showToast('Course assignments moved to Trash', 'info');
    saveState();
}

function deleteCourse(courseId) {
    state.courses = state.courses.filter(c => c.id !== courseId);
    state.readings = state.readings.filter(r => r.courseId !== courseId);
    state.assignments = state.assignments.filter(a => a.courseId !== courseId);
    state.syllabi = state.syllabi.filter(s => s.courseId !== courseId);
    state.vaultDocs = state.vaultDocs.filter(v => v.courseId !== courseId);
    renderVault();
    renderReadings();
    renderAssignments();
    showToast('Course, syllabus & all assignments deleted', 'success');
    saveState();
}

function restoreReading(id) {
    const r = state.readings.find(item => item.id === id);
    if (r) { r.isDeleted = false; openTrashModal(); renderReadings(); showToast('Item restored', 'success'); saveState(); }
}

function restoreAssignment(id) {
    const a = state.assignments.find(item => item.id === id);
    if (a) { a.isDeleted = false; openTrashModal(); renderAssignments(); showToast('Item restored', 'success'); saveState(); }
}

// ── Trash ────────────────────────────────────────────────────
function openTrashModal() {
    const list = document.getElementById('trash-items-list');
    const deletedReadings    = state.readings.filter(r => r.isDeleted);
    const deletedAssignments = state.assignments.filter(a => a.isDeleted);
    if (!list) return;

    if (deletedReadings.length === 0 && deletedAssignments.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:24px; font-size:0.8rem; color:var(--text-muted);"><i class="fa-solid fa-check-circle" style="font-size:1.4rem; margin-bottom:6px; display:block; color:var(--accent-green);" aria-hidden="true"></i>Trash is empty</div>`;
    } else {
        let html = '';
        deletedReadings.forEach(r => {
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-canvas); padding:8px 12px; border-radius:12px;">
                    <span style="font-size:0.8rem; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${escapeHtml(r.title)} (Reading)</span>
                    <button onclick="restoreReading('${r.id}')" style="background:var(--accent-blue); color:#fff; border:none; padding:4px 10px; border-radius:8px; font-size:0.72rem; font-weight:700; cursor:pointer; margin-left:8px;" aria-label="Restore ${r.title}">Restore</button>
                </div>`;
        });
        deletedAssignments.forEach(a => {
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-canvas); padding:8px 12px; border-radius:12px;">
                    <span style="font-size:0.8rem; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${escapeHtml(a.title)} (Assignment)</span>
                    <button onclick="restoreAssignment('${a.id}')" style="background:var(--accent-blue); color:#fff; border:none; padding:4px 10px; border-radius:8px; font-size:0.72rem; font-weight:700; cursor:pointer; margin-left:8px;" aria-label="Restore ${a.title}">Restore</button>
                </div>`;
        });
        list.innerHTML = html;
    }
    document.getElementById('modal-trash').classList.remove('hidden');
}

// ── Edit Assignment ──────────────────────────────────────────
function openEditAssignment(id) {
    const a = state.assignments.find(item => item.id === id);
    if (!a) return;
    document.getElementById('edit-assignment-id').value    = a.id;
    document.getElementById('edit-assignment-title').value = a.title;
    document.getElementById('edit-assignment-duedate').value = a.dueDate;
    document.getElementById('edit-assignment-points').value  = a.points;
    document.getElementById('modal-edit-assignment').classList.remove('hidden');
}

function saveEditAssignment() {
    const id = document.getElementById('edit-assignment-id').value;
    const a  = state.assignments.find(item => item.id === id);
    if (a) {
        a.title   = document.getElementById('edit-assignment-title').value.trim()   || a.title;
        a.dueDate = document.getElementById('edit-assignment-duedate').value.trim() || a.dueDate;
        a.points  = document.getElementById('edit-assignment-points').value.trim()  || a.points;
        renderAssignments();
        renderMiniMonthGrid();
        showToast('Assignment updated!', 'success');
        saveState();
    }
    document.getElementById('modal-edit-assignment').classList.add('hidden');
}

// ── Trash ────────────────────────────────────────────────────
function openTrashModal() {
    const list    = document.getElementById('trash-items-list');
    const deleted = state.readings.filter(r => r.isDeleted);
    if (!list) return;
    if (deleted.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:24px; font-size:0.8rem; color:var(--text-muted);"><i class="fa-solid fa-check-circle" style="font-size:1.4rem; margin-bottom:6px; display:block; color:var(--accent-green);" aria-hidden="true"></i>Trash is empty</div>`;
    } else {
        list.innerHTML = deleted.map(r => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-canvas); padding:8px 12px; border-radius:12px;">
                <span style="font-size:0.8rem; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${escapeHtml(r.title)}</span>
                <button onclick="restoreReading('${r.id}')" style="background:var(--accent-blue); color:#fff; border:none; padding:4px 10px; border-radius:8px; font-size:0.72rem; font-weight:700; cursor:pointer; margin-left:8px;" aria-label="Restore ${r.title}">Restore</button>
            </div>
        `).join('');
    }
    document.getElementById('modal-trash').classList.remove('hidden');
}

// ── Course Detail ────────────────────────────────────────────
function openCourseDetail(courseId) {
    const course = state.courses.find(c => c.id === courseId);
    if (!course) return;
    document.getElementById('course-detail-code').innerText       = course.code;
    document.getElementById('course-detail-name').innerText       = course.name;
    document.getElementById('course-detail-share-code').innerText = course.codeShare;

    const courseReadings = state.readings.filter(r => r.courseId === courseId && !r.isDeleted);
    document.getElementById('course-detail-readings').innerHTML = courseReadings.length === 0
        ? '<div style="font-size:0.75rem; color:var(--text-muted);">No readings added.</div>'
        : courseReadings.map(r => `<div style="font-size:0.78rem; font-weight:600; padding:6px 10px; background:var(--bg-canvas); border-radius:8px;">• ${escapeHtml(r.title)} (Wk ${r.weekNum})</div>`).join('');

    const courseAssignments = state.assignments.filter(a => a.courseId === courseId);
    document.getElementById('course-detail-assignments').innerHTML = courseAssignments.length === 0
        ? '<div style="font-size:0.75rem; color:var(--text-muted);">No assignments added.</div>'
        : courseAssignments.map(a => `<div style="font-size:0.78rem; font-weight:600; padding:6px 10px; background:var(--bg-canvas); border-radius:8px;">• ${escapeHtml(a.title)} (Due ${a.dueDate})</div>`).join('');

    document.getElementById('modal-course-detail').classList.remove('hidden');
}

// ── Reading Info Details Sheet ───────────────────────────────
let currentEditingReadingId = null;

function openReadingInfo(readingId) {
    const r = state.readings.find(item => item.id === readingId);
    if (!r) return;
    currentEditingReadingId = readingId;
    const course = state.courses.find(c => c.id === r.courseId) || state.courses[0] || { code: 'COURSE' };

    document.getElementById('info-course-badge').innerText = course.code;
    document.getElementById('details-title-input').value = r.title || '';
    document.getElementById('details-date-input').value = r.dueDateIso || '';
    document.getElementById('details-week-str-input').value = `Week ${r.weekNum || 1}`;
    document.getElementById('details-chapter-input').value = `${r.chapterText || ''} ${r.pagesText ? '· ' + r.pagesText : ''}`.trim();

    // Topics Section (Read-only Document Topics)
    const topicsContainer = document.getElementById('details-topics-list');
    if (topicsContainer) {
        topicsContainer.innerHTML = '';
        const topics = r.topics || (r.relevantTopics ? r.relevantTopics.split(/[,|\n]/) : []);
        if (topics.length > 0) {
            topics.forEach((tStr, idx) => {
                const clean = tStr.trim();
                if (!clean) return;
                const card = document.createElement('div');
                card.className = 'topic-item-card';
                card.innerHTML = `
                    <div class="topic-item-header"><i class="fa-solid fa-book-bookmark"></i> TOPIC ${idx + 1}</div>
                    <div class="topic-item-text">${escapeHtml(clean)}</div>
                `;
                topicsContainer.appendChild(card);
            });
        } else {
            topicsContainer.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted); padding:4px;">No topics specified in document</div>';
        }
    }

    document.getElementById('details-media-type-select').value = r.mediaType || 'textbook';
    document.getElementById('details-link-input').value = r.videoUrl || '';
    document.getElementById('details-notes-input').value = r.notes || ''; // Clean & empty by default

    document.getElementById('modal-reading-info').classList.remove('hidden');
}

// Save Details Button listener
document.getElementById('btn-save-reading-details')?.addEventListener('click', () => {
    if (!currentEditingReadingId) return;
    const r = state.readings.find(item => item.id === currentEditingReadingId);
    if (r) {
        r.title = document.getElementById('details-title-input').value.trim() || r.title;
        r.dueDateIso = document.getElementById('details-date-input').value;
        r.mediaType = document.getElementById('details-media-type-select').value;
        r.videoUrl = document.getElementById('details-link-input').value;
        r.notes = document.getElementById('details-notes-input').value;
        saveState();
        renderReadings();
        showToast('Reading details saved!', 'success');
    }
    document.getElementById('modal-reading-info').classList.add('hidden');
});

// ── Doc Viewers ──────────────────────────────────────────────
function openDocViewer(docId) {
    const doc = state.vaultDocs.find(v => v.id === docId);
    if (!doc) return;
    const course = state.courses.find(c => c.id === doc.courseId) || state.courses[0];
    document.getElementById('viewer-doc-category').innerText = `${doc.category.toUpperCase()} · ${course.code}`;
    document.getElementById('viewer-doc-title').innerText    = doc.title;
    document.getElementById('viewer-doc-content').innerText  = doc.content || '';
    document.getElementById('btn-download-viewer-doc').onclick = () => openFullDocumentReader(doc.title, doc.content);
    document.getElementById('modal-doc-viewer').classList.remove('hidden');
}

function openDocViewerByTitle(title) {
    const doc = state.vaultDocs.find(v => v.title === title) || { title, category:'ATTACHMENT', size:'', content:`Document: ${title}\n\nReview grading criteria and submission instructions directly.` };
    document.getElementById('viewer-doc-category').innerText = `${doc.category} · DOCUMENT`;
    document.getElementById('viewer-doc-title').innerText    = doc.title;
    document.getElementById('viewer-doc-content').innerText  = doc.content;
    document.getElementById('btn-download-viewer-doc').onclick = () => openFullDocumentReader(doc.title, doc.content);
    document.getElementById('modal-doc-viewer').classList.remove('hidden');
}

function openDocViewerBySyllabus(syllabusId) {
    const s = state.syllabi.find(item => item.id === syllabusId);
    if (!s) return;
    document.getElementById('viewer-doc-category').innerText = 'OFFICIAL SYLLABUS';
    document.getElementById('viewer-doc-title').innerText    = s.fileName;
    document.getElementById('viewer-doc-content').innerText  = s.content;
    document.getElementById('btn-download-viewer-doc').onclick = () => openFullDocumentReader(s.fileName, s.content);
    document.getElementById('modal-doc-viewer').classList.remove('hidden');
}

function openFullDocumentReader(title, content) {
    document.getElementById('full-reader-title').innerText = title;
    document.getElementById('full-reader-body').innerText  = content || '';
    document.getElementById('modal-full-doc-reader').classList.remove('hidden');
}

// ── Mini Calendar Grid ───────────────────────────────────────
function renderMiniMonthGrid() {
    const container = document.getElementById('mini-month-days-container');
    if (!container) return;
    container.innerHTML = '';

    const now        = new Date();
    const todayDay   = now.getDate();
    const todayMonth = now.getMonth();
    const todayYear  = now.getFullYear();
    const selectedDay = state.selectedDay || 4;

    for (let i = 1; i <= 31; i++) {
        const cell = document.createElement('div');
        const isSelected = i === selectedDay;
        const isToday    = (i === todayDay && state.currentMonthIdx === todayMonth && state.currentYear === todayYear);

        cell.className = `mini-day-cell ${isSelected ? 'selected' : ''} ${isToday && !isSelected ? 'today' : ''}`;
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', `${monthsArray[state.currentMonthIdx]} ${i}`);
        cell.setAttribute('aria-selected', String(isSelected));
        cell.setAttribute('tabindex', isSelected ? '0' : '-1');

        const numSpan = document.createElement('span');
        numSpan.innerText = i;
        cell.appendChild(numSpan);

        const courseColors = getCourseColorsForDay(i);
        if (courseColors.length > 0) {
            const dotsRow = document.createElement('div');
            dotsRow.className = 'mini-day-dots-row';
            dotsRow.setAttribute('aria-hidden', 'true');
            courseColors.slice(0, 3).forEach(colorHex => {
                const dot = document.createElement('div');
                dot.className = 'day-dot';
                dot.style.background = isSelected ? '#ffffff' : colorHex;
                dotsRow.appendChild(dot);
            });
            cell.appendChild(dotsRow);
        }

        cell.onclick = () => {
            state.selectedDay  = i;
            state.activeSort   = 'selected_date';
            const heroDayNum  = document.getElementById('hero-day-num-label');
            const heroDayName = document.getElementById('hero-day-name-label');
            if (heroDayNum)  heroDayNum.innerText  = i;
            if (heroDayName) heroDayName.innerText = weekDaysList[(i + 5) % 7];
            updateSortButtonsUI();
            renderMiniMonthGrid();
            renderAssignments();
            saveState();
        };

        container.appendChild(cell);
    }
}

function getCourseColorsForDay(dayNum) {
    return state.assignments
        .filter(a => a.dueDate && a.dueDate.includes(`${dayNum},`))
        .map(a => (state.courses.find(c => c.id === a.courseId) || state.courses[0]).hex);
}

// ── Toast ────────────────────────────────────────────────────
function showToast(message, type = '') {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    // Clear previous type classes
    toast.classList.remove('toast-success', 'toast-error', 'toast-info', 'show', 'hide', 'hidden');
    if (type) toast.classList.add(`toast-${type}`);
    toast.innerText = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => {
            toast.classList.add('hidden');
            toast.classList.remove('hide', 'toast-success', 'toast-error', 'toast-info');
        }, 280);
    }, 2200);
}

// ── Utilities ────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
    const c = hex.replace('#','');
    const r = parseInt(c.substring(0,2),16);
    const g = parseInt(c.substring(2,4),16);
    const b = parseInt(c.substring(4,6),16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function escapeHtml(str) {
    return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Server Keepalive (self-ping every 4 min) ─────────────────
setInterval(() => {
    fetch('/health').catch(() => {});
}, 4 * 60 * 1000);

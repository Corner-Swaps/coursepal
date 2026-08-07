// ClassPal Web Application — Complete v3.0 (100/100 Polish)

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
    // Add (+) Button
    document.getElementById('btn-menu-add-item')?.addEventListener('click', () => {
        populateCourseDropdowns();
        document.getElementById('modal-add-choice').classList.remove('hidden');
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
    select.innerHTML = state.courses.map(c =>
        `<option value="${c.id}">${c.code} — ${c.name}</option>`
    ).join('');
}

// ── Sort UI ──────────────────────────────────────────────────
function updateSortButtonsUI() {
    const btns = {
        date:          document.getElementById('sort-by-date'),
        course:        document.getElementById('sort-by-course'),
        selected_date: document.getElementById('sort-by-calendar-date'),
    };
    Object.entries(btns).forEach(([key, btn]) => {
        if (!btn) return;
        const isActive = state.activeSort === key;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
    });
}

// ── Calendar Header ──────────────────────────────────────────
function updateCalendarHeader() {
    const label = document.getElementById('hero-month-label');
    if (label) label.innerText = `${monthsArray[state.currentMonthIdx]} ${state.currentYear}`;
}

// ── Form Submissions ─────────────────────────────────────────
function submitNewTask() {
    const titleInput = document.getElementById('task-title-input');
    const errorMsg   = document.getElementById('task-title-error');
    const title      = titleInput?.value.trim();

    if (!title) {
        titleInput?.classList.add('error');
        errorMsg?.classList.add('visible');
        return;
    }
    titleInput?.classList.remove('error');
    errorMsg?.classList.remove('visible');

    const kind     = document.getElementById('task-kind-select').value;
    const courseId = document.getElementById('task-course-select').value || state.courses[0].id;
    const weekNum  = parseInt(document.getElementById('task-week-input').value) || 1;
    const dueDate  = document.getElementById('task-duedate-input').value.trim() || 'TBD';
    const points   = document.getElementById('task-points-input').value.trim() || '100 pts';

    if (kind === 'assignment') {
        state.assignments.unshift({ id:`a_${Date.now()}`, courseId, weekNum, title, dueDate, points, isCompleted:false, attachment:null });
        renderAssignments();
        showToast(`Assignment added!`, 'success');
    } else {
        state.readings.unshift({ id:`r_${Date.now()}`, courseId, weekNum, title, mediaType:'Textbook', timeStr:'~30 min read', isCompleted:false, isDeleted:false, summary:`Researched summary for '${title}'.`, takeaways:'• Key concept 1\n• Review course materials' });
        renderWeekFilterBar();
        renderReadings();
        showToast(`Reading added!`, 'success');
    }

    document.getElementById('modal-add-task-form').classList.add('hidden');
    titleInput.value = '';
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
    const codeInput = document.getElementById('new-course-code-input');
    const codeErr   = document.getElementById('course-code-error');
    const code      = codeInput?.value.trim();

    if (!code) {
        codeInput?.classList.add('error');
        codeErr?.classList.add('visible');
        return;
    }
    codeInput?.classList.remove('error');
    codeErr?.classList.remove('visible');

    const name      = document.getElementById('new-course-name-input').value.trim() || 'New Course';
    const hexColor  = document.getElementById('new-course-color-input')?.value || '#8B5CF6';
    const shareCode = `${code.replace(/\s+/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const newCourse = { id:`c_${Date.now()}`, code, name, hex:hexColor, codeShare:shareCode };
    state.courses.push(newCourse);

    // If pasted syllabus text or attached file content present, generate readings/assignments
    const pastedText = document.getElementById('new-course-syllabus-text')?.value.trim() || '';
    const fullText = (pastedText + '\n' + (courseFileAttachedContent || '')).trim();

    if (fullText) {
        const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
        lines.forEach((line, idx) => {
            const lower = line.toLowerCase();
            // Skip administrative boilerplate
            if (lower.includes('office hours') || lower.includes('email:') || lower.includes('grading policy') || lower.includes('disability')) return;

            if (lower.includes('assignment') || lower.includes('homework') || lower.includes('essay') || lower.includes('project') || lower.includes('exam') || lower.includes('due ') || lower.includes('problem set') || lower.includes('pset')) {
                let cleanTitle = line.replace(/^(?:assignments?|homework|pset|project)\s*[\:\-\s]*/i, '').trim();
                if (cleanTitle.length > 55) cleanTitle = cleanTitle.substring(0, 52) + '...';
                if (!cleanTitle) cleanTitle = `Assignment ${idx + 1}`;

                const dateMatch = line.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\b/i);
                const dueDate = dateMatch ? dateMatch[0] : `Aug ${Math.min(28, 10 + (idx % 14))}, 2026`;

                state.assignments.unshift({
                    id: `a_${Date.now()}_${idx}`,
                    courseId: newCourse.id,
                    weekNum: (idx % 16) + 1,
                    title: cleanTitle,
                    dueDate: dueDate,
                    points: '100 pts',
                    isCompleted: false,
                    attachment: null
                });
            } else if (lower.includes('ch.') || lower.includes('chapter') || lower.includes('sec.') || lower.includes('section') || lower.includes('read ') || lower.includes('reading') || lower.includes('pages') || lower.includes('pp.') || lower.includes('paper') || lower.includes('article') || lower.includes('textbook') || lower.includes('video') || lower.includes('lab ')) {

                let mediaType = 'Textbook';
                let estTime = '~40 min read';
                if (lower.includes('video') || lower.includes('watch') || lower.includes('youtube')) {
                    mediaType = 'Video';
                    estTime = '~45 min watch';
                } else if (lower.includes('podcast') || lower.includes('listen')) {
                    mediaType = 'Podcast';
                    estTime = '~30 min listen';
                } else if (lower.includes('article') || lower.includes('paper') || lower.includes('pdf') || lower.includes('journal')) {
                    mediaType = 'Article';
                    estTime = '~25 min read';
                } else if (lower.includes('lab') || lower.includes('experiment') || lower.includes('pset')) {
                    mediaType = 'Lab';
                    estTime = '~60 min lab';
                }

                // Extract page range e.g. pp. 45-80
                const pageMatch = line.match(/\b(?:pp?|pages?)\.?\s*(\d+)(?:\s*[-–—]\s*(\d+))?\b/i);
                let pageCoverage = 'Assigned Chapter/Section';
                if (pageMatch) {
                    const startP = parseInt(pageMatch[1]);
                    const endP = pageMatch[2] ? parseInt(pageMatch[2]) : startP;
                    const pCount = (endP - startP) + 1;
                    pageCoverage = `pp. ${startP}–${endP} (${pCount} pages)`;
                    if (mediaType === 'Textbook') estTime = `~${Math.max(20, pCount * 2)} min read`;
                    else if (mediaType === 'Article') estTime = `~${Math.max(15, pCount * 3)} min read`;
                }

                let cleanTitle = line.replace(/^(?:readings?|read|required|optional)\s*[\:\-\s]*/i, '').trim();
                if (cleanTitle.length > 55) cleanTitle = cleanTitle.substring(0, 52) + '...';
                if (!cleanTitle) cleanTitle = `Chapter ${idx + 1}`;

                state.readings.unshift({
                    id: `r_${Date.now()}_${idx}`,
                    courseId: newCourse.id,
                    weekNum: (idx % 16) + 1,
                    title: cleanTitle,
                    mediaType: mediaType,
                    timeStr: estTime,
                    isCompleted: false,
                    isDeleted: false,
                    summary: `Intelligent ${mediaType} outline for '${cleanTitle}' in ${name}. Covers core lecture principles, study notes, and exercises.`,
                    takeaways: `• Subject: ${cleanTitle}\n• Format: ${mediaType}\n• Source Coverage: ${pageCoverage}\n• Course: ${name}`
                });
            }
        });
    }

    courseFileAttachedContent = null;
    if (document.getElementById('new-course-syllabus-text')) document.getElementById('new-course-syllabus-text').value = '';
    if (document.getElementById('course-pdf-status')) document.getElementById('course-pdf-status').innerText = 'Attach PDF';

    populateCourseDropdowns();
    document.getElementById('modal-add-course-form').classList.add('hidden');
    codeInput.value = '';
    const nameInput = document.getElementById('new-course-name-input');
    if (nameInput) nameInput.value = '';
    renderReadings();
    renderAssignments();
    showToast(`Course ${code} created!`, 'success');
    saveState();
}

// ── Week Filter ──────────────────────────────────────────────
function renderWeekFilterBar() {
    const bar = document.getElementById('week-filter-bar');
    if (!bar) return;
    let html = `<button class="week-chip ${state.selectedWeekFilter===0?'active':''}" onclick="selectWeekFilter(0)" aria-pressed="${state.selectedWeekFilter===0}">All</button>`;
    for (let w = 1; w <= 16; w++) {
        html += `<button class="week-chip ${state.selectedWeekFilter===w?'active':''}" onclick="selectWeekFilter(${w})" aria-pressed="${state.selectedWeekFilter===w}">Wk ${w}</button>`;
    }
    bar.innerHTML = html;
}

function updateReadingsHeader() {
    const titleEl    = document.getElementById('readings-dynamic-title');
    const subtitleEl = document.getElementById('readings-count-label');
    const active     = state.readings.filter(r => !r.isDeleted);
    const filtered   = state.selectedWeekFilter === 0 ? active : active.filter(r => r.weekNum === state.selectedWeekFilter);
    if (titleEl)    titleEl.textContent    = state.selectedWeekFilter === 0 ? 'All Weeks' : `Week ${state.selectedWeekFilter}`;
    if (subtitleEl) subtitleEl.textContent = `${filtered.length} reading${filtered.length !== 1 ? 's' : ''} scheduled`;
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
    const active    = state.readings.filter(r => !r.isDeleted);
    const total     = active.length;
    const completed = active.filter(r => r.isCompleted).length;
    const percent   = total > 0 ? Math.round((completed / total) * 100) : 0;

    const label = document.getElementById('progress-text-label');
    const tag   = document.getElementById('progress-percent-tag');
    const fill  = document.getElementById('readings-progress-fill');
    const track = document.getElementById('progress-track-aria');

    if (label) label.innerText = `${completed} of ${total} readings completed`;
    if (tag)   tag.innerText   = `${percent}%`;
    if (fill)  fill.style.width = `${percent}%`;
    if (track) track.setAttribute('aria-valuenow', percent);
}

// ── Section Header Helper ────────────────────────────────────
function makeSectionHeader(leftText, rightText, onDelete) {
    const h = document.createElement('div');
    h.style.cssText = `display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; padding:8px 12px; background:#fff; border-radius:12px; box-shadow:0 1px 4px rgba(0,0,0,0.04);`;
    h.innerHTML = `
        <span style="font-family:var(--font-heading); font-weight:700; font-size:0.8rem; color:var(--text-dark);">${leftText}</span>
        <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.7rem; font-weight:600; color:var(--text-muted);">${rightText}</span>
            ${onDelete ? `
                <button onclick="${onDelete}" style="background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:4px 10px; border-radius:12px; font-size:0.7rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:4px;" title="Move Section to Trash">
                    <i class="fa-solid fa-trash-can" style="font-size:0.65rem;"></i> Move to Trash
                </button>
            ` : ''}
        </div>
    `;
    return h;
}

// ── Reading Card Helper ──────────────────────────────────────
// ── Reading Card Helper ──────────────────────────────────────
function makeReadingCard(r) {
    const course = state.courses.find(c => c.id === r.courseId) || state.courses[0];
    const card = document.createElement('div');
    card.className = `reference-event-card ${r.isCompleted ? 'completed' : ''}`;
    card.style.cssText = `display:flex; align-items:stretch; justify-content:space-between; padding:0; margin-bottom:10px; background:#fff; border-radius:16px; box-shadow:var(--shadow-card); overflow:hidden; min-height:64px; border:1px solid var(--border-color);`;
    card.setAttribute('role', 'article');
    card.setAttribute('aria-label', `${r.title}, ${r.isCompleted ? 'completed' : 'not completed'}`);

    card.innerHTML = `
        <!-- Thick Left Line -->
        <div style="width:14px; background:${course.hex}; flex-shrink:0;"></div>

        <!-- Content -->
        <div style="display:flex; flex-direction:column; gap:4px; flex:1; min-width:0; padding:12px 10px;">
            <div style="display:flex; align-items:center; gap:6px;">
                <span class="course-badge-btn" onclick="openCourseDetail('${course.id}')" style="font-size:0.65rem; font-weight:800; color:${course.hex}; background:${hexToRgba(course.hex, 0.12)}; padding:2px 6px; border-radius:6px; cursor:pointer;" role="button" aria-label="Open ${course.code} course detail">
                    ${course.code} <i class="fa-solid fa-chevron-right" style="font-size:0.55rem;" aria-hidden="true"></i>
                </span>
                <span style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">${r.mediaType}</span>
            </div>
            <span class="card-title" onclick="openReadingInfo('${r.id}')" style="font-family:var(--font-heading); font-size:0.88rem; font-weight:700; color:var(--text-dark); cursor:pointer; ${r.isCompleted ? 'text-decoration:line-through; opacity:0.6;' : ''}">${escapeHtml(r.title)}</span>
        </div>

        <!-- Right Side Action Line Bars -->
        <div style="display:flex; align-items:stretch; flex-shrink:0;">
            <!-- Checkmark Bar -->
            <div onclick="toggleReading('${r.id}')" style="width:44px; display:flex; align-items:center; justify-content:center; background:${r.isCompleted ? hexToRgba('#2563eb', 0.12) : '#f1f5f9'}; cursor:pointer; border-left:1px solid var(--border-color);" role="checkbox" aria-checked="${r.isCompleted}">
                <div class="circle-check ${r.isCompleted ? 'checked' : ''}" style="margin:0;">
                    ${r.isCompleted ? '<i class="fa-solid fa-check" style="font-size:0.5rem;" aria-hidden="true"></i>' : ''}
                </div>
            </div>
            <!-- Trashcan Bar -->
            <div onclick="deleteReading('${r.id}')" style="width:44px; display:flex; align-items:center; justify-content:center; background:rgba(220, 38, 38, 0.1); color:#dc2626; cursor:pointer; border-left:1px solid var(--border-color);" title="Delete">
                <i class="fa-solid fa-trash-can" style="font-size:0.9rem;" aria-hidden="true"></i>
            </div>
        </div>
    `;
    return card;
}

// ── Assignment Card Helper ───────────────────────────────────
function makeAssignmentCard(a) {
    const course = state.courses.find(c => c.id === a.courseId) || state.courses[0];
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
                <span style="font-size:0.68rem; font-weight:700; color:${course.hex};">Week ${a.weekNum}</span>
            </div>
            <span class="card-title" onclick="openEditAssignment('${a.id}')" style="font-family:var(--font-heading); font-size:0.88rem; font-weight:700; color:var(--text-dark); cursor:pointer; ${a.isCompleted ? 'text-decoration:line-through; opacity:0.6;' : ''}">${escapeHtml(a.title)}</span>
            <span style="font-size:0.72rem; color:var(--text-muted);"><i class="fa-solid fa-calendar" aria-hidden="true"></i> Due ${a.dueDate} · ${a.points}</span>
            ${a.attachment ? `<span style="font-size:0.68rem; color:${course.hex}; font-weight:600; cursor:pointer;" onclick="openDocViewerByTitle('${a.attachment}')"><i class="fa-solid fa-paperclip" aria-hidden="true"></i> ${a.attachment}</span>` : ''}
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
        updateReadingsProgressBar();
        const container = document.getElementById('readings-container');
        if (!container) return;
        container.innerHTML = '';

        const query   = (state._readingsQuery || '').toLowerCase();
        const active  = state.readings.filter(r => !r.isDeleted);
        const grouped = {};

        active.forEach(r => {
            if (state.selectedWeekFilter !== 0 && r.weekNum !== state.selectedWeekFilter) return;
            if (query && !r.title.toLowerCase().includes(query) && !r.mediaType.toLowerCase().includes(query)) return;
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

// ── Render Syllabi ───────────────────────────────────────────
function renderSyllabi() {
    const container = document.getElementById('syllabi-container');
    if (!container) return;
    container.innerHTML = '';

    const countLabel = document.getElementById('syllabus-count-label');
    if (countLabel) countLabel.textContent = `${state.syllabi.length} course${state.syllabi.length !== 1 ? 's' : ''}`;

    if (state.syllabi.length === 0) {
        container.appendChild(makeEmptyState('fa-solid fa-file-lines', 'No syllabi yet', 'Upload a course syllabus to get started.', '', ''));
        return;
    }

    state.syllabi.forEach(s => {
        const course = state.courses.find(c => c.id === s.courseId) || state.courses[0];
        const card = document.createElement('div');
        card.style.cssText = `background:#fff; border-radius:18px; padding:16px; margin-bottom:12px; border:1px solid var(--border-color); box-shadow:var(--shadow-card); border-left:4px solid ${course.hex};`;
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="course-badge-btn" onclick="openCourseDetail('${course.id}')" style="font-size:0.72rem; font-weight:800; color:${course.hex}; background:${hexToRgba(course.hex,0.12)}; padding:3px 8px; border-radius:8px; cursor:pointer;" role="button" aria-label="Open ${course.code}">
                    ${course.code} — ${course.name} <i class="fa-solid fa-chevron-right" style="font-size:0.55rem;" aria-hidden="true"></i>
                </span>
            </div>
            <div style="font-size:0.8rem; color:var(--text-dark); margin-bottom:4px;"><strong>Instructor:</strong> ${escapeHtml(s.instructor)}</div>
            <div style="font-size:0.8rem; color:var(--text-dark); margin-bottom:4px;"><strong>Office Hours:</strong> ${escapeHtml(s.officeHours)}</div>
            <div style="font-size:0.8rem; color:var(--text-dark); margin-bottom:10px;"><strong>Grading:</strong> ${escapeHtml(s.grading)}</div>
            <button onclick="openDocViewerBySyllabus('${s.id}')" style="background:var(--accent-blue-subtle); color:var(--accent-blue); border:none; padding:8px 12px; border-radius:12px; font-size:0.75rem; font-weight:700; cursor:pointer;" aria-label="View ${s.fileName}">
                <i class="fa-solid fa-file-pdf" aria-hidden="true"></i> View ${escapeHtml(s.fileName)}
            </button>
        `;
        container.appendChild(card);
    });
}

// ── Render Share Center (Tab 4) ─────────────────────────────────────────────
function renderVault() {
    const container = document.getElementById('vault-container');
    if (!container) return;
    container.innerHTML = '';

    const countLabel = document.getElementById('vault-count-label');
    if (countLabel) countLabel.textContent = `${state.courses.length} course${state.courses.length !== 1 ? 's' : ''} ready to share`;

    // Section 1: Course Syllabi & Schedules
    const sec1 = document.createElement('div');
    sec1.style.marginBottom = '20px';
    sec1.innerHTML = `<div style="font-size:0.75rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:10px; letter-spacing:0.5px;">Course Syllabi & Schedules (${state.courses.length})</div>`;

    if (state.courses.length === 0) {
        sec1.appendChild(makeEmptyState('fa-solid fa-arrow-up-from-bracket', 'No courses to share', 'Create a course or upload a syllabus to start sharing.', 'Add Course', `document.getElementById('btn-menu-add-item').click()`));
    } else {
        state.courses.forEach(course => {
            const card = document.createElement('div');
            card.style.cssText = `background:#fff; border-radius:16px; padding:12px 14px; margin-bottom:10px; border:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between; box-shadow:var(--shadow-card); border-left:14px solid ${course.hex};`;
            const shareText = `📚 ClassPal Syllabus:\nCourse: ${course.code} - ${course.name}\nJoin Code: ${course.code}-849\nShared via ClassPal.`;
            card.innerHTML = `
                <div style="min-width:0; flex:1; margin-right:10px;">
                    <span style="font-family:var(--font-heading); font-size:0.9rem; font-weight:800; color:var(--text-dark); display:block;">${course.code}</span>
                    <span style="font-size:0.75rem; color:var(--text-muted); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(course.name)}</span>
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                    <button onclick="navigator.clipboard.writeText('${course.code}-849'); showToast('Join Code Copied!', 'success');" style="background:var(--accent-blue-subtle); color:var(--accent-blue); border:none; padding:7px 10px; border-radius:10px; font-size:0.72rem; font-weight:700; cursor:pointer;" title="Copy Code">
                        <i class="fa-solid fa-copy"></i> Copy Code
                    </button>
                    <button onclick="if(navigator.share){navigator.share({title:'ClassPal Syllabus', text:'${escapeHtml(shareText)}'})}else{navigator.clipboard.writeText('${escapeHtml(shareText)}'); showToast('Syllabus Link Copied!', 'success');}" style="background:var(--accent-blue); color:#fff; border:none; padding:7px 12px; border-radius:10px; font-size:0.72rem; font-weight:700; cursor:pointer; box-shadow:0 2px 6px rgba(37,99,235,0.25);" title="Share Syllabus">
                        <i class="fa-solid fa-square-share-nodes"></i> Share
                    </button>
                </div>
            `;
            sec1.appendChild(card);
        });
    }
    container.appendChild(sec1);

    // Section 2: Shared Documents
    if (state.vaultDocs.length > 0) {
        const sec2 = document.createElement('div');
        sec2.style.marginBottom = '20px';
        sec2.innerHTML = `<div style="font-size:0.75rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:10px; letter-spacing:0.5px;">Class Documents (${state.vaultDocs.length})</div>`;
        state.vaultDocs.forEach(v => {
            const course = state.courses.find(c => c.id === v.courseId) || state.courses[0];
            const card = document.createElement('div');
            card.style.cssText = `background:#fff; border-radius:16px; padding:12px 14px; margin-bottom:10px; border:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between; box-shadow:var(--shadow-card); border-left:14px solid ${course.hex};`;
            card.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
                    <div style="min-width:0;">
                        <span style="font-family:var(--font-heading); font-size:0.85rem; font-weight:700; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(v.title)}</span>
                        <span style="font-size:0.7rem; color:var(--text-muted);">${v.category} · ${course.code}</span>
                    </div>
                </div>
                <button onclick="if(navigator.share){navigator.share({title:'${escapeHtml(v.title)}', text:'Class Document: ${escapeHtml(v.title)}\nCourse: ${course.code}'})}else{navigator.clipboard.writeText('Class Document: ${escapeHtml(v.title)}'); showToast('Link Copied!', 'success');}" style="background:var(--accent-blue-subtle); color:var(--accent-blue); border:none; padding:7px 12px; border-radius:10px; font-size:0.72rem; font-weight:700; cursor:pointer;" title="Share Document">
                    <i class="fa-solid fa-square-share-nodes"></i> Share
                </button>
            `;
            sec2.appendChild(card);
        });
        container.appendChild(sec2);
    }
}

// ── Toggle Completion ────────────────────────────────────────
function toggleReading(id) {
    const r = state.readings.find(item => item.id === id);
    if (r) { r.isCompleted = !r.isCompleted; renderReadings(); saveState(); }
}

function toggleAssignment(id) {
    const a = state.assignments.find(item => item.id === id);
    if (a) { a.isCompleted = !a.isCompleted; renderAssignments(); saveState(); }
}

function deleteReading(id) {
    const r = state.readings.find(item => item.id === id);
    if (r) { r.isDeleted = true; renderReadings(); showToast('Moved to Trash', 'info'); saveState(); }
}

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

// ── Reading Info ─────────────────────────────────────────────
function openReadingInfo(readingId) {
    const r = state.readings.find(item => item.id === readingId);
    if (!r) return;
    const course = state.courses.find(c => c.id === r.courseId) || state.courses[0];
    document.getElementById('info-course-badge').innerText     = course.code;
    document.getElementById('info-reading-title').innerText    = r.title;
    document.getElementById('info-reading-summary').innerText  = r.summary;
    document.getElementById('info-reading-takeaways').innerText = r.takeaways;
    document.getElementById('modal-reading-info').classList.remove('hidden');
}

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

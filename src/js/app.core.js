/**
 * app.core.js
 * The Scalable Core Architecture for Boletín de Notas
 * Version: 2.0
 */

// --- 1. CORE UTILITIES ---
const CoreUtils = {
    calculateAverage: function (values) {
        const numbers = values
            .map(v => parseFloat(v))
            .filter(n => !isNaN(n));

        if (numbers.length === 0) return "";

        const sum = numbers.reduce((a, b) => a + b, 0);
        return Math.round(sum / numbers.length);
    },

    debounce: function (func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// --- 2. STATE MANAGEMENT (STORE) ---
class AppState {
    constructor() {
        this.state = {
            grade: "1",
            subjects: [],
            settings: {
                isOverlayMode: true,
                isEditMode: false
            },
            observations: { p1: "", p2: "", p3: "", p4: "" },
            attendance: {
                p1: { pres: "", abs: "", perc: "", perc_abs: "" },
                p2: { pres: "", abs: "", perc: "", perc_abs: "" },
                p3: { pres: "", abs: "", perc: "", perc_abs: "" },
                p4: { pres: "", abs: "", perc: "", perc_abs: "" }
            }
        };
        this.listeners = [];
        this.gradeConfig = this.getGradeConfig();
    }

    getGradeConfig() {
        const commonSubjects = ["Lengua Española", "Matemática", "Ciencias Sociales", "Ciencias de la Naturaleza", "Educación Artística", "Educación Física", "Formación Integral, Humana y Religiosa"];
        const languages = ["Lenguas Extranjeras (Inglés)", "Lenguas Extranjeras (Francés)"];

        return {
            "1": [...commonSubjects],
            "2": [...commonSubjects],
            "3": [...commonSubjects],
            "4": [...commonSubjects, ...languages],
            "5": [...commonSubjects, ...languages],
            "6": [...commonSubjects, ...languages]
        };
    }

    init() {
        this.loadSubjectsForGrade(this.state.grade);
    }

    getState() {
        return this.state;
    }

    setGrade(grade) {
        if (this.state.grade === grade) return;
        this.state.grade = grade;
        this.loadSubjectsForGrade(grade);
        this.notify();
    }

    loadSubjectsForGrade(grade) {
        const names = this.gradeConfig[grade] || this.gradeConfig["1"];
        this.state.subjects = names.map(name => ({
            name: name,
            final: "",
            recovery: "",
            competencies: [
                { name: "C1", p1: "", p2: "", p3: "", p4: "", final: "", recovery: "" },
                { name: "C2", p1: "", p2: "", p3: "", p4: "", final: "", recovery: "" },
                { name: "C3", p1: "", p2: "", p3: "", p4: "", final: "", recovery: "" }
            ]
        }));
    }

    updateGrade(subIndex, compIndex, field, value) {
        const sub = this.state.subjects[subIndex];
        if (!sub) return;

        if (compIndex >= 0) {
            sub.competencies[compIndex][field] = value;
        } else {
            sub[field] = value;
        }
        this.notify();
    }

    updateObservation(period, value) {
        this.state.observations[period] = value;
        this.notify();
    }

    updateAttendance(period, field, value) {
        if (this.state.attendance[period]) {
            this.state.attendance[period][field] = value;
            this.notify();
        }
    }

    updateSettings(newSettings) {
        this.state.settings = { ...this.state.settings, ...newSettings };
        this.notify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }
}

// --- 3. UI RENDERING ---
const AppUI = {
    calcPeriodAverage: function (sub, period) {
        if (!sub.competencies || sub.competencies.length === 0) return "";
        const values = sub.competencies.map(c => c[period]);
        return CoreUtils.calculateAverage(values);
    },

    renderMainTable: function (subjects) {
        const tbody = document.getElementById('gradesTableBody');
        if (!tbody) return;

        const fragment = document.createDocumentFragment();

        subjects.forEach((sub, index) => {
            let p1 = this.calcPeriodAverage(sub, 'p1');
            let p2 = this.calcPeriodAverage(sub, 'p2');
            let p3 = this.calcPeriodAverage(sub, 'p3');
            let p4 = this.calcPeriodAverage(sub, 'p4');

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="text-left pl-2 font-medium bg-gray-50 flex justify-between items-center b-cell">
                    <span>${sub.name}</span>
                    <button data-action="openDetails" data-index="${index}" class="text-[10px] bg-blue-100 text-blue-700 px-1 rounded border border-blue-200 hover:bg-blue-200 ml-2">Detalles</button>
                </td>
                <td class="text-center bg-gray-50 b-cell">${p1 || '-'}</td>
                <td class="text-center bg-gray-50 b-cell">${p2 || '-'}</td>
                <td class="text-center bg-gray-50 b-cell">${p3 || '-'}</td>
                <td class="text-center bg-gray-50 b-cell">${p4 || '-'}</td>
                <td class="text-center font-bold bg-gray-100 b-cell">${sub.final || '-'}</td>
            `;
            fragment.appendChild(row);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    },

    renderReadOnlyGrid: function (subjects) {
        // Disabled by user request. Only overlays are rendered.
        // const container = document.getElementById('grades-grid-container');
        // if (container) container.innerHTML = ''; 
    },

    renderInteractiveGrid: function (subjects) {
        const container = document.getElementById('entry-grid-container');
        if (!container) return;

        let html = `
        <table class="w-full text-xs border-collapse border border-gray-300">
            <thead class="bg-gray-100 sticky top-0 z-10">
                <tr>
                    <th class="border p-2 text-left w-48">Asignatura</th>
                    <th colspan="4" class="border p-1 bg-blue-50">Competencia 1</th>
                    <th colspan="4" class="border p-1 bg-green-50">Competencia 2</th>
                    <th colspan="4" class="border p-1 bg-yellow-50">Competencia 3</th>
                    <th colspan="3" class="border p-1 bg-gray-200">Calif. Finales Competencias</th>
                    <th class="border p-1 bg-gray-300">C.F.</th>
                    <th class="border p-1 bg-red-50 text-red-600">Recup.</th>
                </tr>
                <tr>
                    <th class="border p-1"></th>
                    <th class="border p-1 text-[10px]">P1</th><th class="border p-1 text-[10px]">P2</th><th class="border p-1 text-[10px]">P3</th><th class="border p-1 text-[10px]">P4</th>
                    <th class="border p-1 text-[10px]">P1</th><th class="border p-1 text-[10px]">P2</th><th class="border p-1 text-[10px]">P3</th><th class="border p-1 text-[10px]">P4</th>
                    <th class="border p-1 text-[10px]">P1</th><th class="border p-1 text-[10px]">P2</th><th class="border p-1 text-[10px]">P3</th><th class="border p-1 text-[10px]">P4</th>
                    <th class="border p-1 text-[10px] bg-blue-100">C1</th><th class="border p-1 text-[10px] bg-green-100">C2</th><th class="border p-1 text-[10px] bg-yellow-100">C3</th>
                    <th class="border p-1 text-[10px]">Final</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
        `;

        subjects.forEach((sub, sIndex) => {
            html += `<tr class="hover:bg-gray-50">
                <td class="border p-2 font-bold text-gray-700">${sub.name}</td>`;

            // Periods
            sub.competencies.forEach((comp, cIndex) => {
                const colorClass = cIndex === 0 ? 'bg-blue-50' : cIndex === 1 ? 'bg-green-50' : 'bg-yellow-50';
                ['p1', 'p2', 'p3', 'p4'].forEach(p => {
                    html += `
                    <td class="border p-1 ${colorClass} text-center">
                        <input type="text" 
                            class="w-full text-center bg-white border border-gray-200 rounded focus:border-blue-500 focus:outline-none"
                            value="${comp[p] || ''}"
                            maxlength="3"
                            data-action="updateGrade"
                            data-sindex="${sIndex}"
                            data-cindex="${cIndex}"
                            data-field="${p}">
                    </td>`;
                });
            });

            // Manual Finals for Competencies
            sub.competencies.forEach((comp, cIndex) => {
                const colorClass = cIndex === 0 ? 'bg-blue-100' : cIndex === 1 ? 'bg-green-100' : 'bg-yellow-100';
                html += `
                    <td class="border p-1 ${colorClass} text-center">
                        <input type="text" 
                            class="w-full text-center bg-white border border-gray-400 rounded font-bold text-gray-700 focus:border-blue-500 focus:outline-none"
                            value="${comp.final || ''}"
                            maxlength="3"
                            data-action="updateGrade"
                            data-sindex="${sIndex}"
                            data-cindex="${cIndex}"
                            data-field="final">
                    </td>`;
            });

            // Manual Subject Final
            html += `<td class="border p-1 bg-gray-300 text-center">
                <input type="text" 
                    class="w-full text-center bg-white border border-gray-500 rounded font-bold text-black focus:border-black focus:outline-none"
                    value="${sub.final || ''}"
                    maxlength="3"
                    data-action="updateGrade"
                    data-sindex="${sIndex}"
                    data-cindex="-1" 
                    data-field="final">
            </td>`;

            // Recovery
            html += `<td class="border p-1 text-center bg-red-50">
                <input type="text" 
                    class="w-full text-center bg-white border border-red-200 rounded text-red-600 font-bold focus:border-red-500 focus:outline-none"
                    value="${sub.recovery || ''}"
                    maxlength="3"
                    data-action="updateRecovery"
                    data-sindex="${sIndex}">
            </td></tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    renderOverlays: function (subjects) {
        const container = document.getElementById('grades-grid-container');
        if (!container) return;

        // Don't clear innerHTML to preserve positions. 
        // We will track valid IDs to remove stale ones if necessary.
        const validIds = new Set();

        const ensureElement = (id, value, sIndex, leftPos, isBold = false, type = 'grade') => {
            validIds.add(id);
            let div = document.getElementById(id);
            if (!div) {
                div = document.createElement('div');
                div.id = id;
                div.className = 'draggable-field absolute resize-both overflow-hidden border border-transparent hover:border-blue-300 flex items-center justify-center';

                // Set initial positions only on creation
                if (type === 'grade') {
                    div.style.width = '30px';
                    div.style.height = '20px';
                    const topPos = (sIndex * 30) + 60;
                    div.style.top = `${topPos}px`;
                    div.style.left = `${leftPos}px`;
                } else if (type === 'obs') {
                    div.className = 'draggable-field absolute resize-both overflow-hidden border border-transparent hover:border-blue-300 flex items-start justify-start p-1';
                    div.style.width = '150px';
                    div.style.height = '40px';
                    // sIndex here acts as index i loop
                    div.style.top = `${600 + (sIndex * 50)}px`;
                    div.style.left = '50px';
                } else if (type === 'att') {
                    div.style.width = '30px';
                    div.style.height = '20px';
                    // sIndex = row index (i), leftPos = calculated left
                    div.style.top = `${600 + (sIndex * 25)}px`;
                    div.style.left = `${leftPos}px`;
                }

                container.appendChild(div);
            }

            // Update content always (in case state changed)
            // Use innerHTML to allow styling
            const alignClass = type === 'obs' ? 'text-left' : 'text-center';
            div.innerHTML = `<span class="w-full h-full block ${alignClass} text-[10px] text-black ${isBold ? 'font-bold' : ''}">${value}</span>`;

            // Ensure class integrity
            if (!div.className.includes('draggable-field')) {
                div.className += ' draggable-field';
            }
        };

        subjects.forEach((sub, sIndex) => {
            let currentLeft = 200;
            const stepX = 40;

            // Periods & Competencies
            sub.competencies.forEach((comp, cIndex) => {
                ['p1', 'p2', 'p3', 'p4'].forEach(p => {
                    const id = `grade_s${sIndex}_c${cIndex}_${p}`;
                    const val = comp[p] || '';
                    ensureElement(id, val, sIndex, currentLeft, false, 'grade');
                    currentLeft += stepX;
                });

                // Competency Final
                const idFinal = `grade_s${sIndex}_c${cIndex}_final`;
                ensureElement(idFinal, comp.final || '', sIndex, currentLeft, true, 'grade');
                currentLeft += stepX;
            });

            // Subject Final
            const idSubFinal = `grade_s${sIndex}_final`;
            ensureElement(idSubFinal, sub.final || '', sIndex, currentLeft, true, 'grade');
            currentLeft += stepX;

            // Recovery
            const idRec = `grade_s${sIndex}_recovery`;
            ensureElement(idRec, sub.recovery || '', sIndex, currentLeft, true, 'grade');
        });

        // 1. Observations
        ['p1', 'p2', 'p3', 'p4'].forEach((p, i) => {
            const obsVal = store.getState().observations[p] || '';
            const id = `overlay_obs_${p}`;
            ensureElement(id, obsVal, i, 0, false, 'obs');
        });

        // 2. Attendance
        const att = store.getState().attendance;
        ['p1', 'p2', 'p3', 'p4'].forEach((p, i) => {
            ['pres', 'abs', 'perc', 'perc_abs'].forEach((field, fIndex) => {
                const val = att[p][field] || '';
                const id = `overlay_att_${p}_${field}`;
                // Adjusted spacing for 4 columns
                // Pres(300), Abs(335), Perc(370), PercAbs(405)
                const left = 300 + (fIndex * 35);
                ensureElement(id, val, i, left, false, 'att');
            });
        });
    },

    createOverlayElement: function (container, id, value, sIndex, leftPos, isBold = false) {
        // Deprecated helper, logic moved inside renderOverlays to support update-or-create
    },

    toggleOverlayClass: function (enabled) {
        const overlayElements = document.querySelectorAll('.draggable-field');
        overlayElements.forEach(el => {
            if (enabled) {
                el.classList.add('bg-white/80');
                el.classList.remove('bg-transparent');
            } else {
                el.classList.remove('bg-white/80');
                el.classList.add('bg-transparent');
            }
        });
    }
};

// --- 4. INTERACTION MANAGER (DRAG & DROP) ---
class InteractionManager {
    constructor(storeInstance) {
        this.draggedElement = null;
        this.offset = { x: 0, y: 0 };
        this.isEditMode = false;
        this.store = storeInstance;

        this.history = [];
        this.redoStack = [];
        this.maxHistory = 50;
        this.savePositionsDebounced = CoreUtils.debounce(() => this.savePositions(), 500);

        this.store.subscribe((state) => {
            if (this.isEditMode !== state.settings.isEditMode) {
                this.isEditMode = state.settings.isEditMode;
                this.updateCursor();
            }
        });

        this.initEvents();
        setTimeout(() => this.loadPositions(), 100);
    }

    initEvents() {
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', () => this.onMouseUp());
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.undo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); this.redo(); }
        });
    }

    updateCursor() {
        const draggables = document.querySelectorAll('.draggable-field');
        draggables.forEach(el => { el.style.cursor = this.isEditMode ? 'grab' : 'default'; });
        document.body.classList.toggle('edit-mode-active', this.isEditMode);
    }

    onMouseDown(e) {
        if (!this.isEditMode) return;
        const target = e.target.closest('.draggable-field');
        if (!target) return;

        const rect = target.getBoundingClientRect();
        if (e.clientX > rect.right - 20 && e.clientY > rect.bottom - 20) return; // Resize handle

        this.pushHistory();
        this.draggedElement = target;

        // Use Delta approach
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.startLeft = target.offsetLeft;
        this.startTop = target.offsetTop;

        this.draggedElement.style.cursor = 'grabbing';
        e.preventDefault();
    }

    onMouseMove(e) {
        if (!this.isEditMode || !this.draggedElement) return;

        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;

        this.draggedElement.style.position = 'absolute';
        this.draggedElement.style.left = `${this.startLeft + dx}px`;
        this.draggedElement.style.top = `${this.startTop + dy}px`;
        this.draggedElement.style.margin = '0';
    }

    onMouseUp() {
        if (!this.isEditMode) return;
        if (this.draggedElement) {
            this.draggedElement.style.cursor = 'grab';
            this.draggedElement = null;
            this.savePositionsDebounced();
        }
    }

    captureState() {
        const positions = {};
        document.querySelectorAll('.draggable-field').forEach(el => {
            if (el.id) {
                positions[el.id] = {
                    left: el.style.left,
                    top: el.style.top,
                    width: el.style.width,
                    height: el.style.height
                };
            }
        });
        return JSON.stringify(positions);
    }

    savePositions() {
        const state = this.captureState();
        const grade = this.store.getState().grade;
        localStorage.setItem(`layout_grade_${grade}`, state);
    }

    loadPositions() {
        const grade = this.store.getState().grade;
        const saved = localStorage.getItem(`layout_grade_${grade}`);
        if (saved) this.applyState(saved);
    }

    applyState(jsonState) {
        const positions = JSON.parse(jsonState);
        Object.keys(positions).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const pos = positions[id];
                el.style.position = 'absolute';
                el.style.left = pos.left;
                el.style.top = pos.top;
                el.style.width = pos.width;
                el.style.height = pos.height;
            }
        });
    }

    pushHistory() {
        const current = this.captureState();
        if (this.history.length > 0 && this.history[this.history.length - 1] === current) return;
        this.history.push(current);
        if (this.history.length > this.maxHistory) this.history.shift();
        this.redoStack = [];
    }

    undo() {
        if (this.history.length === 0) return;
        const current = this.captureState();
        this.redoStack.push(current);
        const prev = this.history.pop();
        this.applyState(prev);
        this.savePositionsDebounced();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const current = this.captureState();
        this.history.push(current);
        const next = this.redoStack.pop();
        this.applyState(next);
        this.savePositionsDebounced();
    }
}

// --- 5. PDF MANAGER ---
const PDFManager = {
    pdfDoc: null,

    init: function () {
        // Set worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    },

    handleUpload: async function (input) {
        const file = input.files[0];
        if (!file || file.type !== 'application/pdf') {
            alert('Por favor, sube un archivo PDF válido.');
            return;
        }

        const fileReader = new FileReader();
        fileReader.onload = async (e) => {
            const typedarray = new Uint8Array(e.target.result);
            try {
                const loadingTask = pdfjsLib.getDocument(typedarray);
                this.pdfDoc = await loadingTask.promise;
                this.renderPages();

                // Activate Overlay Mode
                store.updateSettings({ isOverlayMode: true });
                AppUI.toggleOverlayClass(true);
                document.getElementById('toggleOverlay').checked = true;

                alert('PDF de fondo cargado correctamente.');
            } catch (error) {
                console.error('Error procesando PDF:', error);
                alert('Error al procesar el PDF.');
            }
        };
        fileReader.readAsArrayBuffer(file);
    },

    renderPages: async function () {
        if (!this.pdfDoc) return;
        if (this.pdfDoc.numPages >= 1) await this.renderPage(1, 'canvas-page-1');
        if (this.pdfDoc.numPages >= 2) {
            document.getElementById('page-2').classList.remove('hidden');
            await this.renderPage(2, 'canvas-page-2');
        }
    },

    renderPage: async function (pageNumber, canvasId) {
        const page = await this.pdfDoc.getPage(pageNumber);
        const canvas = document.getElementById(canvasId);
        const context = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: 2.0 });

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
    }
};

// --- INITIALIZATION ---
// Global Instances
const store = new AppState();
const interactManager = new InteractionManager(store);

// Event Bindings
function initGlobalEvents() {
    // 1. Store Updates -> UI Render
    store.subscribe((state) => {
        AppUI.renderMainTable(state.subjects);

        // FIX: Don't re-render grid if user is typing in it to avoid losing focus
        const active = document.activeElement;
        const isGridInput = active && active.tagName === 'INPUT' && active.closest('#entry-grid-container');

        if (!isGridInput) {
            AppUI.renderInteractiveGrid(state.subjects);
        }

        AppUI.renderReadOnlyGrid(state.subjects);
        AppUI.renderOverlays(state.subjects);
    });

    // 2. Input Events (Delegation)
    document.addEventListener('input', (e) => {
        const target = e.target;

        // Header Inputs Binding
        if (target.id && target.id.startsWith('input')) {
            const displayId = target.id.replace('input', 'disp');
            const displayEl = document.getElementById(displayId);
            if (displayEl) displayEl.innerText = target.value;
        }

        // Grades Binding
        if (target.dataset.action === 'updateGrade') {
            store.updateGrade(
                parseInt(target.dataset.sindex),
                parseInt(target.dataset.cindex),
                target.dataset.field,
                target.value
            );
        }

        // Recovery Binding
        if (target.dataset.action === 'updateRecovery') {
            store.updateGrade(parseInt(target.dataset.sindex), -1, 'recovery', target.value);
        }

        // Observations Binding
        if (target.dataset.action === 'updateObservation') {
            store.updateObservation(target.dataset.period, target.value);
        }

        // Attendance Binding
        if (target.dataset.action === 'updateAttendance') {
            store.updateAttendance(target.dataset.period, target.dataset.field, target.value);
        }
    });

    // 3. Change Events
    document.addEventListener('change', (e) => {
        const target = e.target;
        if (target.id === 'gradeSelector') {
            store.setGrade(target.value);
            interactManager.loadPositions();
        }
        if (target.id === 'toggleOverlay') {
            store.updateSettings({ isOverlayMode: target.checked });
            AppUI.toggleOverlayClass(target.checked);
        }
        if (target.id === 'toggleEditMode') {
            store.updateSettings({ isEditMode: target.checked });
        }
        if (target.id === 'pdfBgFile') {
            PDFManager.handleUpload(target);
        }
        if (target.id === 'viewSelector') {
            const val = target.value;
            const p1Container = document.getElementById('page-1');
            const p2 = document.getElementById('page-2');

            if (p1Container) p1Container.classList.remove('hidden');
            if (p2) p2.classList.remove('hidden');

            if (val === 'p1') {
                if (p2) p2.classList.add('hidden');
            } else if (val === 'p2') {
                if (p1Container) p1Container.classList.add('hidden');
            }
        }
    });

    // 4. Click Events
    document.addEventListener('click', (e) => {
        const target = e.target;

        if (target.id === 'btnUndo') interactManager.undo();
        if (target.id === 'btnRedo') interactManager.redo();
        if (target.id === 'btnResetPositions') {
            if (confirm("¿Restablecer posiciones?")) {
                localStorage.removeItem(`layout_grade_${store.getState().grade}`);
                location.reload();
            }
        }
        if (target.id === 'btnDownloadPDF') {
            window.print();
        }
        if (target.id === 'btnExport') {
            const data = interactManager.captureState();
            const blob = new Blob([data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `layout_grade_${store.getState().grade}.json`;
            a.click();
        }

        // Tabs
        if (target.closest('#btnTabData')) switchTab('data');
        if (target.closest('#btnTabGrades')) switchTab('grades');
        if (target.closest('#btnTabObs')) switchTab('obs');
    });
}

function switchTab(tabName) {
    const tabData = document.getElementById('tab-content-data');
    const tabGrades = document.getElementById('tab-content-grades');
    const tabObs = document.getElementById('tab-content-obs');

    const btnData = document.getElementById('btnTabData');
    const btnGrades = document.getElementById('btnTabGrades');
    const btnObs = document.getElementById('btnTabObs');

    // Hide all
    if (tabData) tabData.classList.add('hidden');
    if (tabGrades) tabGrades.classList.add('hidden');
    if (tabObs) tabObs.classList.add('hidden');

    if (btnData) btnData.classList.remove('tab-active');
    if (btnGrades) btnGrades.classList.remove('tab-active');
    if (btnObs) btnObs.classList.remove('tab-active');

    if (tabName === 'data') {
        if (tabData) tabData.classList.remove('hidden');
        if (btnData) btnData.classList.add('tab-active');
    } else if (tabName === 'grades') {
        if (tabGrades) tabGrades.classList.remove('hidden');
        if (btnGrades) btnGrades.classList.add('tab-active');
        AppUI.renderInteractiveGrid(store.getState().subjects);
    } else if (tabName === 'obs') {
        if (tabObs) tabObs.classList.remove('hidden');
        if (btnObs) btnObs.classList.add('tab-active');
    }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    PDFManager.init();
    store.init();
    initGlobalEvents();
    store.notify();

    // Sync Toggles state
    const overlayCheck = document.getElementById('toggleOverlay');
    if (overlayCheck) {
        store.updateSettings({ isOverlayMode: overlayCheck.checked });
        AppUI.toggleOverlayClass(overlayCheck.checked);
    }
    const editCheck = document.getElementById('toggleEditMode');
    if (editCheck) {
        store.updateSettings({ isEditMode: editCheck.checked });
    }
});

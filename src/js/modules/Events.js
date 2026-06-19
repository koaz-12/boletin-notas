/**
 * Events.js
 * Centralizes global event listeners and wiring
 */
import { store } from './State.js';
import { AppUI } from './AppUI.js';
import { Toast } from './Toast.js';
import { InteractionManager } from './Interaction.js';
import { StudentManager } from './StudentManager.js';
import { ImportManager } from './ImportManager.js';
import { ExcelImport } from './ExcelImport.js';
import { GoogleSheetsSync } from './GoogleSheetsSync.js';
import { PDFManager } from './PDF.js';
import { AppUtils } from './AppUtils.js';
import { ShareManager } from './ShareManager.js';
import { WordExportManager } from './WordExportManager.js';

// Interaction Manager Instance (Needs Store)
const interactManager = new InteractionManager(store);

export const Events = {
    init: () => {
        // Version Check
        console.log("Events v3.1 Logic");
        WordExportManager.init();

        let lastRenderedStudent = null;
        let lastRenderedGrade = null; // Track Grade Changes
        let isInternalGridUpdate = false;

        // 0. Initial Sync (Persistence)
        const initialState = store.getState();
        const gradeSelector = document.getElementById('gradeSelector');
        if (gradeSelector && initialState.grade) {
            gradeSelector.value = initialState.grade;
            lastRenderedGrade = initialState.grade; // Init tracker
        }
        AppUI.updateHeader(initialState);

        // Apply Default/Saved Layout on Boot
        interactManager.loadPositions();

        // Auto-load Template on Boot
        if (initialState.grade) {
            PDFManager.loadTemplate(initialState.grade);
        }

        // Listen for Section Switch to manage Empty State Visibility
        window.addEventListener('minerd:section-switched', () => {
            const s = store.getState();
            if (s.studentList.length === 0) {
                AppUtils.switchTab('grades');
            }
            // Reload PDF template for this section's grade
            PDFManager.loadTemplate(s.grade);
        });

        // 1. Store Updates -> UI Render
        store.subscribe((state) => {
            // Update Header Title (Grade)
            AppUI.updateHeader(state);

            // Check if Grade Changed -> Force Wipe Page 2 to prevent Ghost Elements
            if (state.grade !== lastRenderedGrade) {
                lastRenderedGrade = state.grade;
                const p2 = document.getElementById('grades-grid-container');
                if (p2) p2.innerHTML = ''; // WIPE
                console.log("🧹 Grade Changed: Container Wiped");
            }

            // Check if student context changed
            const studentChanged = state.currentStudent !== lastRenderedStudent;
            lastRenderedStudent = state.currentStudent;

            // FIX: Don't re-render grid if user is typing in it (Internal Update)
            if (!isInternalGridUpdate || studentChanged) {
                console.log('⚡ RENDERING GRID');
                AppUI.renderInteractiveGrid(state.subjects);
            } else {
                console.log("🚫 GRID RENDER SKIPPED (Focus preserved)");
            }

            // Update Observations & Attendance (Per Student)
            if (studentChanged || !isInternalGridUpdate) {
                // Observations
                Object.keys(state.observations).forEach(p => {
                    const el = document.getElementById(`obs_${p}`);
                    if (el) el.value = state.observations[p] || '';
                });

                // Attendance
                Object.keys(state.attendance).forEach(p => {
                    const attObj = state.attendance[p];
                    Object.keys(attObj).forEach(field => {
                        const val = attObj[field];
                        // Selector based on data attributes
                        const input = document.querySelector(`input[data-action="updateAttendance"][data-period="${p}"][data-field="${field}"]`);
                        if (input) input.value = val || '';
                    });
                });

                // Condition
                const condInput = document.getElementById('inputCondicion');
                if (condInput) condInput.value = state.finalCondition || '';
            }

            AppUI.renderOverlays(state.subjects);
            // Fix: Re-apply positions after rendering (Render resets to default algorithm)
            interactManager.loadPositions();

            // Update Navigator UI
            StudentManager.updateNavigatorUI(state);

            // Update School Data Inputs (One-way sync)
            if (state.schoolData) {
                const schoolMap = {
                    'centro': 'inputCentro', 'codigo': 'inputCodigo', 'tanda': 'inputTanda',
                    'telefono': 'inputTelefono', 'regional': 'inputRegional', 'distrito': 'inputDistrito',
                    'provincia': 'inputProvincia', 'municipio': 'inputMunicipio', 'docente': 'inputDocente',
                    'section': 'inputSeccion' // Added Global Section
                };
                Object.keys(schoolMap).forEach(key => {
                    const el = document.getElementById(schoolMap[key]);
                    if (el && (studentChanged || document.activeElement !== el)) {
                        el.value = state.schoolData[key] || '';
                        const dispId = schoolMap[key].replace('input', 'disp');
                        const dispEl = document.getElementById(dispId);
                        if (dispEl) dispEl.innerText = el.value;
                    }
                });
            }

            // Apply Visual Settings (Persistence)
            if (state.settings) {
                AppUtils.updateTextAlignment('p1', state.settings.alignP1 || 'center');
                AppUtils.updateBold('p1', state.settings.boldP1 || false);
                AppUtils.updateTextAlignment('p1', state.settings.alignP1 || 'center');
                AppUtils.updateBold('p1', state.settings.boldP1 || false);
                // P2 Grades
                AppUtils.updateTextAlignment('p2_grades', state.settings.alignP2G || 'center');
                AppUtils.updateBold('p2_grades', state.settings.boldP2G || false);
                // P2 Obs
                AppUtils.updateTextAlignment('p2_obs', state.settings.alignP2O || 'left');
                AppUtils.updateBold('p2_obs', state.settings.boldP2O || false);
                // Also update global font size if needed
                if (state.settings.fontSize) AppUtils.updateGlobalFontSize(state.settings.fontSize);
                if (state.settings.pdfNameFormat) {
                    const el = document.getElementById('pdfNameFormat');
                    if (el) el.value = state.settings.pdfNameFormat;
                }

                // Per-Section Google Sheets URL
                const elUrl = document.getElementById('googleSheetUrlInput');
                if (elUrl && document.activeElement !== elUrl) {
                    if (state.settings.googleSheetUrl !== undefined) {
                        elUrl.value = state.settings.googleSheetUrl;
                    } else {
                        elUrl.value = ''; // Ensure it empties if the current section doesn't have one
                    }
                }
            }

            // Update Student Info Inputs (Profile)
            const info = state.studentInfo || {};
            const infoMap = {
                'nombres': 'inputNombres', 'apellidos': 'inputApellidos',
                'id': 'inputID', 'order': 'inputOrden',
                'obsGeneral': 'inputObsGeneral'
            };
            Object.keys(infoMap).forEach(key => {
                const el = document.getElementById(infoMap[key]);
                if (el && (studentChanged || document.activeElement !== el)) {
                    el.value = info[key] || '';
                    const dispId = infoMap[key].replace('input', 'disp');
                    const dispEl = document.getElementById(dispId);
                    if (dispEl) dispEl.innerText = el.value;
                }
            });

            // Update Config Listeners
            if (state.settings.fontSize) AppUtils.updateGlobalFontSize(state.settings.fontSize);
            if (state.settings.textAlign) AppUtils.updateTextAlignment(state.settings.textAlign);
        });

        // 2. Input Events (Delegation)
        document.addEventListener('input', (e) => {
            const target = e.target;

            // Header Inputs Binding
            if (target.id && target.id.startsWith('input')) {
                const displayId = target.id.replace('input', 'disp');
                const displayEl = document.getElementById(displayId);
                if (displayEl) displayEl.innerText = target.value;

                // Sync to Store
                const fieldMap = {
                    'Centro': 'centro', 'Codigo': 'codigo', 'Tanda': 'tanda',
                    'Telefono': 'telefono', 'Regional': 'regional', 'Distrito': 'distrito',
                    'Provincia': 'provincia', 'Municipio': 'municipio', 'Docente': 'docente',
                    'Seccion': 'section' // Added to Global Map
                };
                const studentFields = {
                    'Nombres': 'nombres', 'Apellidos': 'apellidos', 'ID': 'id',
                    'Orden': 'order', 'ObsGeneral': 'obsGeneral'
                };
                const idPart = target.id.replace('input', '');

                if (fieldMap[idPart]) {
                    store.updateSchoolData(fieldMap[idPart], target.value);
                } else if (studentFields[idPart]) {
                    store.updateStudentInfo(studentFields[idPart], target.value);
                }
            }

            // Grades Binding (Moved to 'change' event to prevent focus loss)
            // if (target.dataset.action === 'updateGrade') ... managed in change


            // Calibration Inputs
            if (target.classList.contains('box-input') || target.id === 'calX' || target.id === 'calY') {
                AppUtils.applyCalibration();
            }

            // Real-time Visual Updates for Observations (while typing)
            if (target.dataset.action === 'updateObservation') {
                store.updateObservation(target.dataset.period, target.value);
            }
            // Real-time Visual Updates for Attendance (while typing)
            if (target.dataset.action === 'updateAttendance') {
                store.updateAttendance(target.dataset.period, target.dataset.field, target.value);
            }

            // Per-Section Google Sheets URL Auto-Save
            if (target.id === 'googleSheetUrlInput') {
                store.updateSettings({ googleSheetUrl: target.value }); // Automatically debounces save now
                // Debounce cloud sync manually to avoid rate limits
                if (window.AuthManager && window.Parse?.User?.current()) {
                    if (window._googleUrlSyncTimeout) clearTimeout(window._googleUrlSyncTimeout);
                    window._googleUrlSyncTimeout = setTimeout(() => {
                        window.AuthManager.syncUserData();
                    }, 2000);
                }
            }
        });

        // --- PRE-EDIT SNAPSHOTS (For fields that save on 'input') ---
        document.addEventListener('focusin', (e) => {
            const target = e.target;
            if (!target) return;
            
            // 1. Live Data Grids
            if (target.dataset) {
                const liveActions = ['updateObservation', 'updateAttendance'];
                if (liveActions.includes(target.dataset.action)) {
                    store.takeSnapshot();
                    return;
                }
            }

            // 2. Datos Generales Inputs
            if (target.id && target.id.startsWith('input')) {
                const idPart = target.id.replace('input', '');
                const validGeneralFields = ['Centro', 'Codigo', 'Tanda', 'Telefono', 'Regional', 'Distrito', 'Provincia', 'Municipio', 'Docente', 'Seccion', 'Nombres', 'Apellidos', 'ID', 'Orden', 'ObsGeneral'];
                if (validGeneralFields.includes(idPart)) {
                    store.takeSnapshot();
                }
            }
        });

        // 3. Change Events
        document.addEventListener('change', (e) => {
            const target = e.target;
            if (target.id === 'gradeSelector') {
                const s = store.getState();
                // Check if current student has data entered
                const hasData = s.subjects.some(sub =>
                    sub.final || sub.recovery ||
                    sub.competencies.some(c => c.p1 || c.p2 || c.p3 || c.p4 || c.final)
                );

                if (hasData) {
                    const confirmChange = confirm("⚠️ ATENCIÓN:\nCambiar de grado reiniciará las materias y calificaciones del estudiante actual.\n\n¿Estás seguro de que deseas continuar?");
                    if (!confirmChange) {
                        target.value = s.grade; // Revert to current grade
                        return;
                    }
                }

                store.setGrade(target.value);
                // Auto-load template for the new grade
                PDFManager.loadTemplate(target.value);
                interactManager.loadPositions();
            }
            if (target.id === 'pdfBgFile') {
                PDFManager.handleUpload(target); // Fix: passed input
            }
            // PDF Background Upload (Redundant ID check?)
            if (target.id === 'pdfUpload') {
                PDFManager.handleUpload(target);
            }
            if (target.id === 'pdfNameFormat') {
                store.updateSettings({ pdfNameFormat: target.value });
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

            // Student Navigator
            if (target.id === 'studentSelector') {
                store.loadStudent(target.value);
            }

            // Excel Import Files – show Preview Modal first
            if (target.id === 'excelFile') {
                const files = target.files;
                if (!files || files.length === 0) return;

                // Use the first file for preview (multi-file handled on confirm)
                const firstFile = files[0];
                Events.showExcelPreview(firstFile, target);
            }
            if (target.id === 'rosterFile') {
                if (target.files.length > 0) ImportManager.importRoster(target.files[0]);
                target.value = '';
            }

            // Project Import
            if (target.id === 'projectFileInput') {
                if (target.files.length > 0) Events.importProject(target.files[0]);
                target.value = '';
            }
            // Load Layout Import
            if (target.id === 'importLayoutFile') {
                const file = target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        interactManager.applyState(e.target.result);
                        interactManager.savePositionsDebounced();
                        Toast.success('Configuración de diseño cargada correctamente.');
                    } catch (err) {
                        console.error('Error parsing layout JSON:', err);
                        Toast.error('Error al cargar la configuración.');
                    }
                };
                reader.readAsText(file);
            }

            // --- UNDO / REDO SNAPSHOT ---
            // Take a snapshot right before modifying grades/recovery or dropdown statuses
            const trackedActions = ['updateGrade', 'updateRecovery', 'updateStatus', 'updateFinalCondition'];
            if (trackedActions.includes(target.dataset.action)) {
                store.takeSnapshot();
            }

            // Grades Binding (Moved here from input)
            if (target.dataset.action === 'updateGrade') {
                isInternalGridUpdate = true;

                // --- Validation Start ---
                let val = target.value;
                if (val !== '') {
                    let numVal = parseInt(val, 10);
                    if (isNaN(numVal)) {
                        val = ''; // Not a number, wipe it
                    } else if (numVal < 0) {
                        val = '0';
                        target.value = '0'; // Update visual
                        Toast.warning("La nota no puede ser menor a 0.");
                    } else if (numVal > 100) {
                        val = '100';
                        target.value = '100'; // Update visual
                        Toast.warning("La nota no puede ser mayor a 100.");
                    } else {
                        val = String(numVal); // Clean integer string
                    }
                }
                // --- Validation End ---

                store.updateGrade(
                    parseInt(target.dataset.sindex),
                    parseInt(target.dataset.cindex),
                    target.dataset.field,
                    val
                );
                setTimeout(() => isInternalGridUpdate = false, 0);
            }
            if (target.dataset.action === 'updateRecovery') {
                isInternalGridUpdate = true;

                // --- Validation Start ---
                let val = target.value;
                if (val !== '') {
                    let numVal = parseInt(val, 10);
                    if (isNaN(numVal)) {
                        val = '';
                    } else if (numVal < 0) {
                        val = '0';
                        target.value = '0';
                        Toast.warning("La nota no puede ser menor a 0.");
                    } else if (numVal > 100) {
                        val = '100';
                        target.value = '100';
                        Toast.warning("La nota no puede ser mayor a 100.");
                    } else {
                        val = String(numVal);
                    }
                }
                // --- Validation End ---

                store.updateGrade(parseInt(target.dataset.sindex), -1, 'recovery', val);
                setTimeout(() => isInternalGridUpdate = false, 0);
            }
            if (target.dataset.action === 'updateObservation') {
                // isInternalGridUpdate = true; // Optional for Obs
                store.updateObservation(target.dataset.period, target.value);
            }
            if (target.dataset.action === 'updateAttendance') {
                // isInternalGridUpdate = true; // Optional for Att
                store.updateAttendance(target.dataset.period, target.dataset.field, target.value);
            }
            if (target.dataset.action === 'updateStatus') {
                store.updateStudentStatus(target.dataset.field, target.value);
            }
            if (target.dataset.action === 'updateFinalCondition') {
                store.updateFinalCondition(target.value);
            }
        });

        // 4. Click Events
        document.addEventListener('click', (e) => {
            const target = e.target;

            // Magic Click for Final Status Inputs (Promovido, Aplazado, Repitente)
            if (target.dataset.action === 'updateStatus') {
                const currentVal = target.value;
                let newVal = "X";
                if (currentVal === "" || currentVal === null) {
                    newVal = "X";
                } else if (currentVal === "X" || currentVal === "x") {
                    newVal = "✔️";
                } else {
                    newVal = "";
                }
                target.value = newVal;
                
                // Set the current field
                store.updateStudentStatus(target.dataset.field, newVal);

                // Mutually exclusive: Clear the others if this one is selected
                if (newVal !== "") {
                    const fields = ['promoted', 'postponed', 'repeater'];
                    fields.forEach(f => {
                        if (f !== target.dataset.field) {
                            store.updateStudentStatus(f, "");
                        }
                    });
                }
            }

            if (target.id === 'btnFactoryReset') {
                if (confirm('⚠️ ¿Estás seguro de que quieres BORRAR TODOS LOS DATOS?')) {
                    store.clearLocalStorage();
                }
            }
            if (target.id === 'btnResetPositions') {
                if (confirm('¿Restablecer posiciones de los elementos arrastrables?')) {
                    interactManager.resetPositions();
                }
            }
            if (target.id === 'btnDecreaseFont' || target.id === 'btnIncreaseFont') {
                let current = store.getState().settings.fontSize || 11;
                if (target.id === 'btnDecreaseFont') current = Math.max(6, current - 1);
                if (target.id === 'btnIncreaseFont') current = Math.min(24, current + 1);
                store.updateSettings({ fontSize: current });
            }
            try {
                if (target.closest('#btnTabData')) {
                    console.log("🖱️ Click Data Tab");
                    AppUtils.switchTab('data');
                }
                if (target.closest('#btnTabGrades')) {
                    console.log("🖱️ Click Grades Tab");
                    AppUtils.switchTab('grades');
                }
                if (target.closest('#btnTabObs')) {
                    console.log("🖱️ Click Obs Tab");
                    AppUtils.switchTab('obs');
                }
            } catch (err) {
                console.error("❌ Tab Navigation Error:", err);
                alert("Error navegando: " + err.message);
            }

            // Calibration
            if (target.id.startsWith('btnCal')) {
                const calX = document.getElementById('calX');
                const calY = document.getElementById('calY');
                let cx = parseFloat(calX.value) || 0;
                let cy = parseFloat(calY.value) || 0;
                const step = 1;

                if (target.id === 'btnCalUp') cy -= step;
                if (target.id === 'btnCalDown') cy += step;
                if (target.id === 'btnCalLeft') cx -= step;
                if (target.id === 'btnCalRight') cx += step;

                calX.value = cx;
                calY.value = cy;
                AppUtils.applyCalibration();
            }

            // Text Alignment & Bold (Scoped Persistence)
            // Page 1
            if (target.id === 'btnAlignLeftP1') store.updateSettings({ alignP1: 'left' });
            if (target.id === 'btnAlignCenterP1') store.updateSettings({ alignP1: 'center' });
            if (target.id === 'btnAlignRightP1') store.updateSettings({ alignP1: 'right' });
            if (target.id === 'btnBoldP1') {
                const isBold = !store.getState().settings.boldP1;
                store.updateSettings({ boldP1: isBold });
                target.classList.toggle('bg-gray-300', isBold);
            }

            // Page 2 Grades
            if (target.id === 'btnAlignLeftP2G') store.updateSettings({ alignP2G: 'left' });
            if (target.id === 'btnAlignCenterP2G') store.updateSettings({ alignP2G: 'center' });
            if (target.id === 'btnAlignRightP2G') store.updateSettings({ alignP2G: 'right' });
            if (target.id === 'btnBoldP2G') {
                const isBold = !store.getState().settings.boldP2G;
                store.updateSettings({ boldP2G: isBold });
                target.classList.toggle('bg-gray-300', isBold);
            }

            // Page 2 Obs
            if (target.id === 'btnAlignLeftP2O') store.updateSettings({ alignP2O: 'left' });
            if (target.id === 'btnAlignCenterP2O') store.updateSettings({ alignP2O: 'center' });
            if (target.id === 'btnAlignRightP2O') store.updateSettings({ alignP2O: 'right' });
            if (target.id === 'btnBoldP2O') {
                const isBold = !store.getState().settings.boldP2O;
                store.updateSettings({ boldP2O: isBold });
                target.classList.toggle('bg-gray-300', isBold);
            }

            if (target.closest('#btnExportProject')) Events.exportProject();
            if (target.closest('#btnDownloadCurrent')) PDFManager.downloadCurrent();
            if (target.closest('#btnPrintBatch')) PDFManager.generateBatchPDF();
            if (target.closest('#btnZipBatch')) PDFManager.generateBatchZip();
            if (target.closest('#btnExportWordIndividual')) WordExportManager.openModal('individual');
            if (target.closest('#btnExportWordBatch')) WordExportManager.openModal('batch');
            if (target.closest('#btnShareImage')) ShareManager.openShareModal();

            if (target.closest('#btnViewCF')) {
                Events.renderViewCF();
            }

            if (target.closest('#btnCloseViewCF')) {
                document.getElementById('modalViewCF').classList.add('hidden');
            }

            if (target.closest('#btnViewCFPrev')) {
                Events.navigateViewCF(-1);
            }

            if (target.closest('#btnViewCFNext')) {
                Events.navigateViewCF(1);
            }

            // Share Modal Controls
            if (target.closest('#btnCloseShareModal') || target.closest('#btnCancelShareModal')) ShareManager.closeModal();
            if (target.closest('#btnShareMobile')) ShareManager.shareMobile();
            if (target.closest('#btnShareCopy1')) ShareManager.copyToClipboard(1);
            if (target.closest('#btnShareCopy2')) ShareManager.copyToClipboard(2);
            if (target.closest('#btnShareDownload')) ShareManager.downloadPNG();

            // Google Sheets Sync
            if (target.closest('#btnSyncGoogleSheet')) {
                const btn = target.closest('#btnSyncGoogleSheet');
                const btnIcon = btn.querySelector('.btn-icon');
                const btnText = btn.querySelector('.btn-text');
                const originalIcon = btnIcon.innerHTML;
                const originalText = btnText.innerHTML;
                const urlInput = document.getElementById('googleSheetUrlInput');
                const url = urlInput.value;

                if (!url) {
                    Toast.warning("Debes pegar el link de Google Sheets primero.");
                    return;
                }

                // Loading State
                btnIcon.innerHTML = '⏳';
                btnText.innerHTML = 'Descargando...';
                btn.classList.add('opacity-75', 'cursor-not-allowed');
                btn.disabled = true;

                GoogleSheetsSync.fetchXLSXFromLink(url).then(fakeFile => {
                    // Reset Button
                    btnIcon.innerHTML = originalIcon;
                    btnText.innerHTML = originalText;
                    btn.classList.remove('opacity-75', 'cursor-not-allowed');
                    btn.disabled = false;

                    if (fakeFile) {
                        // Proceed to the same preview modal as local Excel
                        Events.showExcelPreview(fakeFile, {
                            files: [fakeFile],
                            value: '' // Dummy value to prevent errors on reset
                        });
                    }
                }).catch(err => {
                    // Reset Button
                    btnIcon.innerHTML = originalIcon;
                    btnText.innerHTML = originalText;
                    btn.classList.remove('opacity-75', 'cursor-not-allowed');
                    btn.disabled = false;
                    Toast.error(err.message);
                });
            }

            // Export Layout
            if (target.closest('#btnExportLayout')) {
                interactManager.savePositions(); // Force Save Immediate
                const grade = store.getState().grade;
                const layout = localStorage.getItem(`layout_grade_${grade}`);
                if (!layout) {
                    Toast.warning("No hay configuración para exportar.");
                } else {
                    navigator.clipboard.writeText(layout).then(() => {
                        Toast.success("Diseño copiado al portapapeles (JSON).");
                    }).catch(err => {
                        prompt("Copia esta configuración:", layout);
                    });
                }
            }

            // Student Manager
            if (target.id === 'btnAddStudent') StudentManager.addNewStudent();
            if (target.id === 'btnDeleteStudent') StudentManager.deleteCurrentStudent();
            if (target.id === 'btnDeleteAllStudents') StudentManager.deleteAllStudents();
            if (target.id === 'btnPrevStudent') StudentManager.navigateStudent(-1);
            if (target.id === 'btnNextStudent') StudentManager.navigateStudent(1);

            // Import Manager (Modal)
            if (target.id === 'btnCancelImport') {
                document.getElementById('importModal').classList.add('hidden');
                document.getElementById('excelFile').value = '';
            }
            if (target.id === 'btnConfirmImport') ImportManager.processBatchImport();

            // Template Download Modal
            if (target.closest('#btnOpenTemplateModal')) {
                document.getElementById('templateModal').classList.remove('hidden');
            }
            if (target.closest('#btnCloseTemplateModal')) {
                document.getElementById('templateModal').classList.add('hidden');
            }

            // Manual Migration (V1)
            if (target.id === 'btn-migrate-v1') {
                store.performLegacyMigration(true);
            }

            // Toggle Edit Mode (Float)
            if (target.closest('#btnFloatEdit')) {
                const btn = target.closest('#btnFloatEdit');
                const current = store.getState().settings.isEditMode;
                const newState = !current;
                store.updateSettings({ isEditMode: newState });

                // Toggle Visuals
                document.body.classList.toggle('edit-mode-active', newState);
                if (newState) {
                    btn.classList.add('bg-red-600', 'text-white', 'ring-4', 'ring-red-300');
                    btn.classList.remove('bg-gray-100', 'text-gray-600');
                    Toast.info("✏️ MODO EDICIÓN: Arrastra las casillas.");
                } else {
                    btn.classList.remove('bg-red-600', 'text-white', 'ring-4', 'ring-red-300');
                    btn.classList.add('bg-gray-100', 'text-gray-600');
                    Toast.info("Modo Lectura.");
                }
            }

            // Toggle Overlay (Float)
            if (target.closest('#btnFloatOverlay')) {
                const btn = target.closest('#btnFloatOverlay');
                const current = store.getState().settings.isOverlayMode;
                const newState = !current;
                store.updateSettings({ isOverlayMode: newState });
                AppUI.toggleOverlayClass(newState);

                if (newState) {
                    btn.classList.add('bg-blue-600', 'text-white', 'ring-4', 'ring-blue-300');
                    btn.classList.remove('bg-blue-100', 'text-blue-600', 'border-blue-200');
                } else {
                    btn.classList.remove('bg-blue-600', 'text-white', 'ring-4', 'ring-blue-300');
                    btn.classList.add('bg-blue-100', 'text-blue-600', 'border-blue-200');
                }
            }
        });

        // --- UNDO / REDO KEYBOARD SHORTCUTS ---
        document.addEventListener('keydown', (e) => {
            // Check for Ctrl+Z
            if (e.ctrlKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
                // If the user is typing in a text field, let the browser handle natural text undo.
                // We only do global state Undo if they blur the field, or if they are NOT in a text field.
                if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
                    // Commit current text field edits before undoing the app state
                    document.activeElement.blur();
                }
                e.preventDefault();
                // Use setTimeout to ensure blur's change event (and its isInternalGridUpdate reset) completes first
                setTimeout(() => {
                    if (store.undo()) Toast.info("Deshacer (Undo)");
                }, 20);
            }

            // Check for Ctrl+Y or Ctrl+Shift+Z
            if ((e.ctrlKey && (e.key === 'y' || e.key === 'Y')) || (e.ctrlKey && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
                e.preventDefault();
                setTimeout(() => {
                    if (store.redo()) Toast.info("Rehacer (Redo)");
                }, 20);
            }
        });

    },

    // Export Project Backup
    exportProject: () => {
        // Use Global Backup (All Sections + Settings) instead of single state
        const backup = store.exportFullBackup();
        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const now = new Date();
        const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        const filename = `boletin_backup_${dateStr}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Toast.success("Copia de seguridad descargada.");
    },

    // Import Project Backup
    importProject: (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                // Validate data structure lightly
                if (!data.roster || !data.studentList) {
                    throw new Error("Formato de archivo inválido (Faltan roster o studentList).");
                }

                // Restore State
                store.setState(data);

                // Restore UI defaults if needed
                Toast.success("Proyecto cargado exitosamente.\nReiniciando aplicación...");

                // Force Reload to ensure full sync
                setTimeout(() => {
                    window.location.reload();
                }, 1500);

            } catch (err) {
                console.error(err);
                alert("Error al cargar el proyecto: " + err.message);
            }
        };
        reader.readAsText(file);
    },

    /**
     * Excel Import Preview Modal
     * Parses the file, shows a preview, and imports only after user confirms.
     */
    showExcelPreview: async function (file, inputEl) {
        try {
            // Parse the file for a preview
            const parsed = await ExcelImport.getStudents(file);
            const students = parsed.students || [];
            const meta = parsed.meta || {};
            const warnings = [];

            // --- Sanitation Check: warn about bad grades ---
            let badGradeCount = 0;
            if (parsed.rows) {
                const cfg = ExcelImport.getConfig();
                for (let i = (cfg.startRow || 3); i < parsed.rows.length; i++) {
                    const row = parsed.rows[i];
                    if (!row) continue;
                    for (let c = 2; c < row.length; c++) {
                        const v = row[c];
                        if (v === undefined || v === null || v === '') continue;
                        const n = parseFloat(v);
                        if (isNaN(n) || n < 0 || n > 100) badGradeCount++;
                    }
                }
            }
            if (badGradeCount > 0) {
                warnings.push(`${badGradeCount} celda(s) con valores inválidos (texto o fuera de rango 0-100) serán ignoradas.`);
            }
            if (students.length === 0) {
                warnings.push("No se detectaron estudiantes en este archivo. Verifica el formato.");
            }

            // --- Fill Modal ---
            document.getElementById('excelPreviewFileName').textContent = file.name;
            document.getElementById('excelPreviewCount').textContent = students.length;
            document.getElementById('excelPreviewSection').textContent = meta.seccion || meta.grado || '—';
            document.getElementById('excelPreviewShift').textContent = meta.tanda || '—';

            // Warnings
            const warningsEl = document.getElementById('excelPreviewWarnings');
            const warningListEl = document.getElementById('excelPreviewWarningList');
            warningListEl.innerHTML = '';
            if (warnings.length > 0) {
                warnings.forEach(w => {
                    const li = document.createElement('li');
                    li.textContent = w;
                    warningListEl.appendChild(li);
                });
                warningsEl.classList.remove('hidden');
            } else {
                warningsEl.classList.add('hidden');
            }

            // Student list preview (show first 8)
            const listEl = document.getElementById('excelPreviewList');
            listEl.innerHTML = '';
            const previewStudents = students.slice(0, 8);
            previewStudents.forEach((s, idx) => {
                const div = document.createElement('div');
                div.className = 'flex items-center gap-2 py-0.5';
                div.innerHTML = `<span class="text-gray-400 w-5 text-right">${idx + 1}.</span><span class="text-gray-700">${s.name}</span>`;
                listEl.appendChild(div);
            });
            if (students.length > 8) {
                const more = document.createElement('div');
                more.className = 'text-gray-400 italic pt-1';
                more.textContent = `… y ${students.length - 8} más`;
                listEl.appendChild(more);
            }

            // --- Show Modal ---
            const modal = document.getElementById('excelPreviewModal');
            modal.classList.remove('hidden');

            // --- Wire Buttons ---
            const cancelBtn = document.getElementById('btnExcelPreviewCancel');
            const confirmBtn = document.getElementById('btnExcelPreviewConfirm');

            // Clone to remove stale listeners
            const newCancel = cancelBtn.cloneNode(true);
            const newConfirm = confirmBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
            confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);

            newCancel.addEventListener('click', () => {
                modal.classList.add('hidden');
                if (inputEl) inputEl.value = '';
            });

            newConfirm.addEventListener('click', () => {
                modal.classList.add('hidden');
                ImportManager.handleExcelFile(inputEl || { files: [file] });
            });

        } catch (err) {
            console.error("Excel Preview Error:", err);
            Toast.error("Error leyendo el archivo Excel: " + err.message);
            if (inputEl) inputEl.value = '';
        }
    },

    renderViewCF() {
        const s = store.getState();
        if (!s.currentStudent || !s.roster[s.currentStudent]) {
            Toast.error("Seleccione un estudiante primero.");
            return;
        }

        const studentData = s.roster[s.currentStudent];
        document.getElementById('lblViewCFStudentName').textContent = s.currentStudent;

        const orderedKeywords = [
            "Lengua Espa", "Matem", "Natur", "Social", "Formaci", "Ingl", "Art", "Física", "Fsica"
        ];
        
        const displayNames = [
            "Lengua Española", "Matemática", "Ciencias Naturales", "Ciencias Sociales",
            "Form. Int. Humana y Religiosa", "Inglés", "Educación Artística", "Educación Física", ""
        ];

        let html = "";
        const addedKeywords = new Set();

        orderedKeywords.forEach((keyword, idx) => {
            if (keyword === "Fsica" && addedKeywords.has("Física")) return;
            
            const foundSub = studentData.subjects ? studentData.subjects.find(s => s.name && s.name.includes(keyword)) : null;
            const displayName = displayNames[idx];

            if (foundSub) {
                const finalGrade = foundSub.final !== undefined && foundSub.final !== "" ? foundSub.final : "-";
                html += `<div class="flex justify-between border-b border-gray-200 py-1">
                            <span class="text-gray-600">${displayName}</span>
                            <span class="font-bold text-black text-xl w-12 text-right">${finalGrade}</span>
                         </div>`;
                addedKeywords.add(keyword);
            } else if (keyword !== "Fsica") {
                html += `<div class="flex justify-between border-b border-gray-200 py-1">
                            <span class="text-gray-600">${displayName}</span>
                            <span class="font-bold text-gray-400 text-xl w-12 text-right">-</span>
                         </div>`;
            }
        });

        document.getElementById('viewCFContent').innerHTML = html;
        document.getElementById('modalViewCF').classList.remove('hidden');
    },

    navigateViewCF(direction) {
        const s = store.getState();
        const currentIndex = s.studentList.indexOf(s.currentStudent);
        if (currentIndex === -1) return;

        let newIndex = currentIndex + direction;
        if (newIndex < 0) newIndex = s.studentList.length - 1;
        if (newIndex >= s.studentList.length) newIndex = 0;

        // Use the native system to fully switch student context (saves current, loads new)
        try {
            store.loadStudent(s.studentList[newIndex], true);
            // Render the modal again with the new student's data
            this.renderViewCF();
        } catch (err) {
            console.error(err);
        }
    }
};

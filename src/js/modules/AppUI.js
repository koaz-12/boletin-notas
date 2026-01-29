import { store, sectionManager } from './State.js';
import { ExcelImport } from './ExcelImport.js';
import { GridRenderer } from './UI/GridRenderer.js';
import { ReportRenderer } from './UI/ReportRenderer.js';
import { Toast } from './Toast.js';
import CloudStorage from './CloudStorage.js';
import { CoreUtils } from './CoreUtils.js';

export const AppUI = {
    init: function () {
        // Bind UI Actions
        document.getElementById('save-student-btn')?.addEventListener('click', () => {
            store.saveCurrentStudent();
            Toast.show('Estudiante guardado en base de datos local.', 'success');
        });

        this.initConnectionManager();

        // --- CLOUD AUTO-SAVE LOGIC ---
        const performCloudSave = async () => {
            const spinner = document.getElementById('cloud-spinner');
            const label = document.getElementById('cloud-status-text');

            // Visual feedback: "Auto-saving..."
            if (spinner) spinner.classList.remove('hidden');
            if (label) {
                label.textContent = "Auto-guardando...";
                label.className = "text-xs font-medium text-blue-500 transition-colors";
            }

            try {
                if (typeof store.exportFullBackup !== 'function') return;

                const backup = store.exportFullBackup();
                // Pass 'auto' to attempt throttled history snapshot
                const result = await CloudStorage.saveData(backup, 'auto');

                if (spinner) spinner.classList.add('hidden');

                if (result.success) {
                    if (label) {
                        label.textContent = "Guardado";
                        label.className = "text-xs font-bold text-green-600 transition-colors";
                    }
                    console.log("☁️ Auto-save complete");

                    // Reset to "Sincronizar"
                    setTimeout(() => {
                        if (label) {
                            label.textContent = "Sincronizar";
                            label.className = "text-xs font-medium text-gray-500 group-hover:text-green-700 transition-colors";
                        }
                    }, 4000);
                }
            } catch (error) {
                if (spinner) spinner.classList.add('hidden');
                console.error("Auto-save failed:", error);
            }
        };

        const debouncedAutoSave = CoreUtils.debounce(performCloudSave, 5000);

        // Cloud Save Button
        const btnCloud = document.getElementById('btn-cloud-save');
        if (btnCloud) {
            btnCloud.addEventListener('click', async () => {
                const spinner = document.getElementById('cloud-spinner');
                const label = document.getElementById('cloud-status-text');

                // UI Loading
                spinner?.classList.remove('hidden');
                label.textContent = "Guardando...";

                // Logic
                const backup = store.exportFullBackup();
                // Pass true to create history snapshot
                const result = await CloudStorage.saveData(backup, true);

                // UI Result
                spinner?.classList.add('hidden');

                if (result.success) {
                    label.textContent = "¡Guardado!";
                    label.className = "text-xs font-bold text-green-600 transition-colors";
                    Toast.show("☁️ Copia de seguridad guardada en Back4App éxitosamente.", 'success');

                    // Reset text after 3s
                    setTimeout(() => {
                        label.textContent = "Sincronizar";
                        label.className = "text-xs font-medium text-gray-500 group-hover:text-green-700 transition-colors";
                    }, 3000);
                } else {
                    label.textContent = "Error";
                    label.className = "text-xs font-bold text-red-600";
                    Toast.show("❌ Error al guardar: " + result.error, 'error');
                }
            });
        }

        this.initFloatingControls();

        // Cloud Restore Button
        const btnRestore = document.getElementById('btn-cloud-restore');
        if (btnRestore) {
            btnRestore.addEventListener('click', async () => {
                if (confirm("¿Estás seguro de restaurar? Esto sobrescribirá tus datos locales con la versión de la nube.")) {
                    // Since AuthManager is imported script-side but not fully exposed to AppUI module scope in this file?
                    // Verify imports. AuthManager is NOT imported in AppUI.js.
                    // I need to import it or dispatch event.
                    // Let's import it.
                    const { AuthManager } = await import('./AuthManager.js');
                    AuthManager.restoreFromCloud();
                }
            });
        }
        this.renderSectionTabs(); // Initial Render of Tabs

        // Subscribe to Store Updates for LIVE Tab Updates
        store.subscribe(() => {
            this.renderSectionTabs();
            // Trigger Auto-Save on ANY data change
            if (typeof debouncedAutoSave === 'function') debouncedAutoSave();
        });
    },

    renderSectionTabs: function () {
        const container = document.getElementById('sections-container');
        if (!container) return;

        container.innerHTML = '';
        // Container handled in HTML mainly, but ensure classes
        container.className = "flex items-end gap-1 overflow-x-auto px-2";

        // 1. Render Tabs
        sectionManager.sections.forEach(sec => {
            const isActive = (sec.id === sectionManager.currentSectionId);

            // Shift Styles 
            const isMatutina = (sec.shift || '').toLowerCase().includes('mat');
            const shiftIcon = isMatutina ? '☀️' : '🌙';
            // Colors specific to Premium Folder theme
            const shiftColor = isActive ? 'text-orange-500' : 'text-gray-400';
            const moonColor = isActive ? 'text-indigo-500' : 'text-gray-400';
            const iconColor = isMatutina ? shiftColor : moonColor;

            // Folder Tab Logic
            // Active: White, Connected to bottom (border-b-0), higher Z
            // Inactive: Gray, smaller, lower Z

            let tabClass = "flex flex-col justify-center px-4 py-2 rounded-t-lg cursor-pointer transition-all border border-b-0 relative group ";

            if (isActive) {
                // Active: Bigger, White, Blue Top Border (optional), Covers bottom line
                tabClass += "bg-white border-gray-200 text-blue-800 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] z-30 h-14 min-w-[140px] transform translate-y-[1px]";
                // translate-y-[1px] pushes it down to cover the panel border exactly
            } else {
                // Inactive: Gray, Recessed
                tabClass += "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 z-10 h-12 min-w-[130px] mb-0 shadow-inner";
            }

            const tab = document.createElement('div');
            tab.className = tabClass;

            tab.onclick = () => {
                if (!isActive) store.switchSection(sec.id);
            };

            // Content
            const nameClass = isActive ? "font-bold text-sm" : "font-medium text-xs";
            const detailClass = isActive ? "text-[11px] opacity-100" : "text-[10px] opacity-80";

            tab.innerHTML = `
                <div class="flex items-center justify-between w-full">
                    <span class="${nameClass}">${sec.name}</span>
                    <button class="delete-btn opacity-0 group-hover:opacity-100 text-[10px] ml-2 hover:text-red-500 hover:bg-red-100 rounded-full w-4 h-4 flex items-center justify-center transition-all ${isActive ? 'block' : 'hidden'}">✕</button>
                </div>
                <div class="flex items-center gap-1">
                    <span class="text-[10px] ${iconColor}">${shiftIcon}</span>
                    <span class="${detailClass}">${sec.grade}º - ${sec.shift}</span>
                </div>
            `;

            // Delete Action
            const btn = tab.querySelector('.delete-btn');
            if (btn) {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    store.deleteSectionInternal(sec.id);
                };
            }

            container.appendChild(tab);
        });

        // 2. "New Section" Button (Small tab)
        const addBtn = document.createElement('div');
        addBtn.className = "flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-blue-50 text-gray-400 hover:text-blue-600 cursor-pointer ml-2 transition-colors border border-dashed border-gray-300 mb-1 opacity-70 hover:opacity-100";
        addBtn.title = "Crear Nueva Sección";
        addBtn.innerHTML = '<span class="text-xl font-bold">+</span>';
        addBtn.onclick = () => {
            AppUI.prompt("Nueva Sección", "Nombre de la Sección (ej: 4to A):", (name) => {
                store.createNewSectionInternal(name, "1", "Matutina");
            }, "4to A");
        };
        container.appendChild(addBtn);
    },

    initFloatingControls: function () {
        const list = document.getElementById('floatingControls');
        const btn = document.getElementById('btnToggleControls');
        const icon = document.getElementById('iconToggle');

        if (!list || !btn) return;

        // Load State
        const isHidden = localStorage.getItem('controlsHidden') === 'true';
        if (isHidden) {
            list.classList.add('hidden');
            icon.textContent = 'P'; // Panel / Plus? Using 'P' or generic icon. Let's use standard emoji in HTML.
            // Actually, HTML has ⚙️ by default.
            // If hidden, show ⚙️. If shown, show ✖️.
            icon.textContent = '⚙️';
        } else {
            list.classList.remove('hidden');
            icon.textContent = '✖️';
        }

        // Toggle
        btn.addEventListener('click', () => {
            const nowHidden = list.classList.toggle('hidden');
            localStorage.setItem('controlsHidden', nowHidden);
            icon.textContent = nowHidden ? '⚙️' : '✖️';
        });
    },

    updateFloatingControls: function (state) {
        // Sync Edit Mode Button State
        const btnEdit = document.getElementById('btnFloatEdit');
        if (btnEdit) {
            if (state.settings.isEditMode) {
                btnEdit.classList.add('bg-red-50', 'text-red-600', 'border-red-300');
                btnEdit.classList.remove('bg-white', 'text-gray-600', 'border-gray-200');
            } else {
                btnEdit.classList.remove('bg-red-50', 'text-red-600', 'border-red-300');
                btnEdit.classList.add('bg-white', 'text-gray-600', 'border-gray-200');
            }
        }
    },

    render: function () {
        const state = store.getState();
        this.updateHeader(state); // Update Title
        this.renderInteractiveGrid(state.subjects);
        this.renderOverlays(state.subjects);

        // Update Floating Controls (e.g. Edit Mode toggles)
        this.updateFloatingControls(state);
    },

    // Delegate Overlay Toggling
    toggleOverlayClass: function (enabled) {
        ReportRenderer.toggleOverlayClass(enabled);
    },

    // --- FORM UPDATE HELPERS (Keep here or move to FormRenderer later) ---

    updateStatusInputs: function (state) {
        const s = state.studentStatus || {};
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || "";
        };
        setVal('checkPromovido', s.promoted);
        setVal('checkAplazado', s.postponed);
        setVal('checkRepitente', s.repeater);

        const condInput = document.getElementById('inputCondicion');
        if (condInput) condInput.value = state.finalCondition || "";
    },

    updateHeader: function (state) {
        // Update Grade Selector
        const gradeSelect = document.getElementById('gradeSelector');
        if (gradeSelect && gradeSelect.value !== state.grade) {
            gradeSelect.value = state.grade;
        }

        // Update Header Title
        const headerDisp = document.getElementById('dispHeaderGrade');
        if (headerDisp) {
            const g = parseInt(state.grade);
            let suffix = "to";
            if (g === 1 || g === 3) suffix = "er";
            if (g === 2) suffix = "do";
            headerDisp.textContent = `(${g}${suffix} Grado)`;

            // Hide/Show Final Condition Input based on grade
            const condInput = document.getElementById('inputCondicion');
            const condContainer = document.getElementById('containerSituacionFinal');

            const shouldHide = (g <= 2);

            if (condInput) {
                if (shouldHide) condInput.classList.add('hidden');
                else condInput.classList.remove('hidden');
            }
            if (condContainer) {
                if (shouldHide) condContainer.classList.add('hidden');
                else condContainer.classList.remove('hidden');
            }
        }
    },

    updateObsAttInputs: function (state) {
        // Update Observations inputs
        ['p1', 'p2', 'p3', 'p4'].forEach(p => {
            const input = document.getElementById(`obs-${p}`);
            if (input) input.value = state.observations[p];
        });

        // Update Attendance inputs
        ['p1', 'p2', 'p3', 'p4'].forEach(p => {
            ['pres', 'abs', 'perc', 'perc_abs'].forEach(field => {
                const input = document.getElementById(`att-${p}-${field}`);
                if (input) input.value = state.attendance[p][field];
            });
        });

        // Update Attendance Total (Annual)
        if (state.attendance.total) { // Check existence due to migration timing
            const tPerc = document.getElementById('att-total-perc');
            if (tPerc) tPerc.value = state.attendance.total.perc || '';

            const tPercAbs = document.getElementById('att-total-perc_abs');
            if (tPercAbs) tPercAbs.value = state.attendance.total.perc_abs || '';
        }
    },

    // Expose renderInteractiveGrid/renderOverlays on AppUI object for compatibility if app.js calls them directly?
    // app.js calls: AppUI.renderInteractiveGrid(state.subjects)
    // app.js calls: AppUI.renderOverlays(state.subjects)
    // So YES, I must re-expose them or update app.js.
    // I will re-expose them here to avoid touching app.js unnecessarily.

    renderInteractiveGrid: function (subjects) {
        GridRenderer.renderInteractiveGrid(subjects);
    },



    renderOverlays: function (subjects) {
        // Fix: If subjects are empty/reset, force clear overlays
        if (!subjects || subjects.length === 0) {
            const container = document.getElementById('grades-grid-container');
            if (container) container.innerHTML = ''; // WIPE PAGE 2
            return;
        }
        ReportRenderer.renderOverlays(subjects);
    },

    // --- MODAL HELPERS ---
    confirm: function (title, message, onOk, isDanger = false, okLabel = "Aceptar") {
        const modal = document.getElementById('confirmModal');
        if (!modal) return alert(message); // Fallback

        const titleEl = document.getElementById('confirmModalTitle');
        const msgEl = document.getElementById('confirmModalMessage');
        const btnOk = document.getElementById('btnConfirmOk');
        const btnCancel = document.getElementById('btnConfirmCancel');
        const iconContainer = modal.querySelector('.text-red-600')?.parentElement; // Red icon wrapper

        titleEl.innerText = title;
        msgEl.innerText = message;
        btnOk.innerText = okLabel; // Dynamic Label

        // Visual Customization
        if (isDanger) {
            btnOk.className = "w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:text-sm";
            if (iconContainer) iconContainer.classList.remove('hidden');
        } else {
            btnOk.className = "w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:text-sm";
            // Hide red icon for standard confirms? Or swap it. For now, leave as is or hide.
            if (iconContainer) iconContainer.classList.add('hidden');
        }

        btnOk.onclick = () => {
            modal.classList.add('hidden');
            if (onOk) onOk();
        };
        btnCancel.onclick = () => {
            modal.classList.add('hidden');
        };

        modal.classList.remove('hidden');
    },

    prompt: function (title, message, onOk, placeholder = "", defaultValue = "") {
        const modal = document.getElementById('promptModal');
        if (!modal) {
            const val = prompt(message, defaultValue || placeholder);
            if (val && onOk) onOk(val);
            return;
        }

        const titleEl = document.getElementById('promptModalTitle');
        const msgEl = document.getElementById('promptModalMessage');
        const input = document.getElementById('promptInput');
        const btnOk = document.getElementById('btnPromptOk');
        const btnCancel = document.getElementById('btnPromptCancel');

        titleEl.innerText = title;
        msgEl.innerText = message;
        input.value = defaultValue;
        input.placeholder = placeholder;

        const submit = () => {
            const val = input.value.trim();
            if (val) {
                modal.classList.add('hidden');
                onOk(val);
            } else {
                input.focus();
            }
        };

        btnOk.onclick = submit;
        btnCancel.onclick = () => modal.classList.add('hidden');

        // Enter key support
        input.onkeyup = (e) => {
            if (e.key === 'Enter') submit();
        };

        modal.classList.remove('hidden');
        setTimeout(() => input.focus(), 100);
    },

    // --- CONNECTION STATUS ---
    initConnectionManager: function () {
        const updateStatus = () => {
            const isOnline = navigator.onLine;
            this.updateConnectionStatus(isOnline ? 'online' : 'offline');
        };

        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);

        // Initial check
        updateStatus();
    },

    updateConnectionStatus: function (status) {
        const container = document.getElementById('connection-status');
        const dot = document.getElementById('connection-dot');

        if (!container || !dot) return;

        if (status === 'online') {
            container.className = "hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200 transition-colors";
            container.title = "Conexión Estable";
            dot.className = "w-2 h-2 rounded-full bg-green-500 animate-pulse";
        } else if (status === 'offline') {
            container.className = "hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 transition-colors";
            container.title = "Sin Conexión (Modo Offline)";
            dot.className = "w-2 h-2 rounded-full bg-red-500";
        } else if (status === 'checking') {
            container.className = "hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-50 border border-yellow-200 transition-colors";
            container.title = "Comprobando conexión...";
            dot.className = "w-2 h-2 rounded-full bg-yellow-500 animate-bounce";
        }
    }
};

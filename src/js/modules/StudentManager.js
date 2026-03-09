/**
 * StudentManager.js
 * Handles CRUD operations for students and navigation
 */
import { store } from './State.js';
import { Toast } from './Toast.js';
import { AppUI } from './AppUI.js';
import { ImportManager } from './ImportManager.js';

export const StudentManager = {
    // Add New Student
    addNewStudent: () => {
        AppUI.prompt(
            "Nuevo Estudiante",
            "Nombre del estudiante:",
            (name) => {
                const state = store.getState();
                if (state.studentList.includes(name)) {
                    Toast.error("Ya existe un estudiante con ese nombre.");
                    return;
                }

                store.loadStudent(name, false); // State will auto-create, delay UI update

                // Auto-fill Nombres/Apellidos locally using Excel import logic
                const newState = store.getState();
                const parsed = ImportManager.parseStudentName(name);

                if (!newState.studentInfo) newState.studentInfo = {};
                newState.studentInfo.nombres = parsed.nombres || name;
                if (parsed.apellidos) newState.studentInfo.apellidos = parsed.apellidos;

                // Ensure ID is blank initially instead of carrying over unexpected keys
                if (!newState.studentInfo.id) newState.studentInfo.id = "";

                store.saveCurrentStudent();
                store.notify(); // Now rebuild the UI dropdown with correct names!

                Toast.success(`Estudiante "${name}" creado.`);

                // Immediately switch to the 'Datos Generales' tab
                document.getElementById('btnTabData')?.click();
            },
            "Ej: Juan Pérez"
        );
    },

    // Delete Current Student (Soft Delete)
    deleteCurrentStudent: () => {
        const state = store.getState();
        const current = state.currentStudent;

        if (!current) return;

        AppUI.confirm(
            "Mover a Papelera",
            `¿Estás seguro de eliminar a "${current}"?\nPodrás restaurarlo desde la Papelera de Reciclaje.`,
            () => {
                const success = store.moveToTrash(current);
                if (success) {
                    Toast.show(`🗑️ "${current}" movido a la papelera`, "info");
                } else {
                    Toast.show("❌ Error al eliminar", "error");
                }
            },
            true // Is Danger
        );
    },

    // Delete All Students (Hard Reset)
    deleteAllStudents: () => {
        AppUI.confirm(
            "⚠️ ELIMINAR TODOS ⚠️",
            "Estás a punto de ELIMINAR TODOS los estudiantes.\nEsta acción es irreversible.\n¿Estás seguro?",
            () => {
                // Reset Store to truly empty
                store.setRoster([], {});
                store.getState().currentStudent = null;
                store.notify();
                window.dispatchEvent(new Event('minerd:section-switched')); // Refreshes Empty State immediately
                Toast.info("Todos los estudiantes han sido eliminados.");
            },
            true
        );
    },

    // Navigate (Next/Prev)
    navigateStudent: (dir) => {
        const state = store.getState();
        const list = state.studentList;
        if (list.length <= 1) return;

        const idx = list.indexOf(state.currentStudent);
        if (idx === -1) return;

        let newIdx = idx + dir;
        if (newIdx < 0) newIdx = 0;
        if (newIdx >= list.length) newIdx = list.length - 1;

        if (newIdx !== idx) {
            store.loadStudent(list[newIdx]);
        }
    },

    // Update Navigation UI (Selector, Buttons)
    updateNavigatorUI: (state) => {
        const nav = document.getElementById('studentNavigator');
        const selector = document.getElementById('studentSelector');
        const badge = document.getElementById('studentCountBadge');
        const btnPrev = document.getElementById('btnPrevStudent');
        const btnNext = document.getElementById('btnNextStudent');

        if (!nav) return;

        if (state.studentList.length > 0) {
            nav.classList.remove('hidden');
            badge.innerText = state.studentList.length;

            // Update Selector Options if changed
            if (selector.options.length !== state.studentList.length) {
                selector.innerHTML = '';
                state.studentList.forEach(name => {
                    const opt = document.createElement('option');
                    opt.value = name;
                    selector.appendChild(opt);
                });
            }

            // Always update text to reflect fresh 'Nombres Apellidos' from Data
            Array.from(selector.options).forEach((opt, index) => {
                const nameKey = state.studentList[index];
                if (nameKey) {
                    let display = nameKey;
                    const studentData = state.roster[nameKey];
                    if (studentData && studentData.studentInfo) {
                        const full = `${studentData.studentInfo.nombres || ''} ${studentData.studentInfo.apellidos || ''}`.trim();
                        if (full) display = full;
                    }
                    if (opt.innerText !== display) opt.innerText = display;
                }
            });

            selector.value = state.currentStudent;

            const idx = state.studentList.indexOf(state.currentStudent);
            btnPrev.disabled = idx <= 0;
            btnNext.disabled = idx >= state.studentList.length - 1;
        } else {
            nav.classList.add('hidden');
        }
    },

    // --- TRASH BIN UI ---
    openTrashModal: () => {
        const modal = document.getElementById('trash-modal');
        if (modal) modal.classList.remove('hidden');
        StudentManager.renderTrashList();
    },

    closeTrashModal: () => {
        const modal = document.getElementById('trash-modal');
        if (modal) modal.classList.add('hidden');
    },

    renderTrashList: () => {
        const list = document.getElementById('minerd-trash-list');
        const emptyBtn = document.getElementById('btn-empty-trash');
        const state = store.getState();
        const trash = state.trashBin || [];

        if (!list) return;
        list.innerHTML = '';

        if (trash.length === 0) {
            list.innerHTML = '<div class="text-center text-gray-400 py-8 italic">La papelera está vacía.</div>';
            if (emptyBtn) {
                emptyBtn.classList.add('opacity-0', 'pointer-events-none');
            }
            return;
        }

        if (emptyBtn) {
            emptyBtn.classList.remove('opacity-0', 'pointer-events-none');
        }

        trash.forEach(item => {
            const el = document.createElement('div');
            el.className = "flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow";

            const dateStr = new Date(item.deletedAt).toLocaleString();

            el.innerHTML = `
                <div>
                    <p class="font-bold text-gray-800">${item.name}</p>
                    <p class="text-xs text-gray-400">Eliminado: ${dateStr}</p>
                    <p class="text-xs text-gray-400">Sección: ${item.originalSection || '?'}</p>
                </div>
                <button class="btn-restore px-3 py-1 bg-green-50 text-green-700 hover:bg-green-100 rounded border border-green-200 text-sm font-medium flex items-center gap-1 transition-colors">
                    <span>♻️</span> Restaurar
                </button>
            `;

            const btnRestore = el.querySelector('.btn-restore');
            btnRestore.onclick = () => {
                const restoredName = store.restoreFromTrash(item.deletedAt);
                if (restoredName) {
                    Toast.show(`♻️ "${restoredName}" restaurado exitosamente`, "success");
                    StudentManager.renderTrashList();
                    // Reload navigator/list if we are in the same section
                    StudentManager.updateNavigatorUI(store.getState());
                }
            };

            list.appendChild(el);
        });
    },

    initTrashEvents: () => {
        // Use Delegation for robustness
        document.body.addEventListener('click', (e) => {
            // Check for buttons or elements inside buttons
            const target = e.target.closest('button') || e.target.closest('#menu-trash');
            if (!target) return;

            if (target.id === 'menu-trash') {
                StudentManager.openTrashModal();
                // Close user menu if open
                const menu = document.getElementById('user-menu-dropdown');
                if (menu && !menu.classList.contains('hidden')) menu.classList.add('hidden');
            }

            if (target.id === 'btn-close-trash' || target.id === 'btn-close-trash-footer') {
                StudentManager.closeTrashModal();
            }

            if (target.id === 'btn-empty-trash') {
                AppUI.confirm(
                    "Vaciar Papelera",
                    "¿Estás seguro de eliminar PERMANENTEMENTE estos estudiantes?\nNo podrás deshacer esta acción.",
                    () => {
                        store.emptyTrash();
                        StudentManager.renderTrashList();
                        Toast.show("Papelera vaciada.", "info");
                    },
                    true
                );
            }
        });
    }
};

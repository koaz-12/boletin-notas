/**
 * StudentManager.js
 * Handles CRUD operations for students and navigation
 */
import { store } from './State.js';
import { Toast } from './Toast.js';
import { AppUI } from './AppUI.js';

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

                store.loadStudent(name); // State will auto-create
                Toast.success(`Estudiante "${name}" creado.`);
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
                // Reset Store
                store.setRoster([], {});
                // Create Default
                store.loadStudent("Estudiante 1", false);
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
                    opt.innerText = name;
                    selector.appendChild(opt);
                });
            }

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
        const btnOpen = document.getElementById('menu-trash');
        const btnClose = document.getElementById('btn-close-trash');
        const btnCloseFooter = document.getElementById('btn-close-trash-footer');
        const btnEmpty = document.getElementById('btn-empty-trash');

        if (btnOpen) btnOpen.onclick = StudentManager.openTrashModal;
        if (btnClose) btnClose.onclick = StudentManager.closeTrashModal;
        if (btnCloseFooter) btnCloseFooter.onclick = StudentManager.closeTrashModal;

        if (btnEmpty) btnEmpty.onclick = () => {
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
        };
    }
};

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

    // Delete Current Student
    deleteCurrentStudent: () => {
        const state = store.getState();
        const current = state.currentStudent;

        if (!current) return;

        AppUI.confirm(
            "Eliminar Estudiante",
            `¿Estás seguro de ELIMINAR al estudiante "${current}"?\nSe perderán todas sus notas y observaciones.`,
            () => {
                store.deleteStudent(current);
                Toast.warning(`Estudiante "${current}" eliminado.`);
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
    }
};

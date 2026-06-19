/**
 * ObsBankGeneral.js
 * Handles the Observations Bank for Page 1 (Portada/General Observations).
 * Similar pattern to ObservationsManager's phrase bank, but dedicated to general observations.
 */
import { Toast } from './Toast.js';

export const ObsBankGeneral = {
    // Default Observations (Fallback)
    defaultBank: {
        academico: [
            "Estudiante dedicado/a que muestra interés por el aprendizaje.",
            "Cumple con todas las asignaciones y tareas asignadas.",
            "Demuestra habilidades sobresalientes en todas las áreas.",
            "Se recomienda mayor dedicación en las tareas del hogar.",
            "Necesita reforzar los contenidos básicos del grado."
        ],
        conducta: [
            "Muestra excelente comportamiento dentro y fuera del aula.",
            "Es respetuoso/a con sus compañeros y maestros.",
            "Debe mejorar su comportamiento durante las clases.",
            "Es colaborador/a y solidario/a con los demás.",
            "Conversa frecuentemente durante las clases."
        ],
        asistencia: [
            "Asiste puntualmente a clases todos los días.",
            "Presenta frecuentes ausencias que afectan su rendimiento.",
            "Se recomienda supervisar la asistencia del estudiante.",
            "Mantiene un excelente récord de asistencia.",
            "Las inasistencias han impactado negativamente su desempeño."
        ],
        recomendaciones: [
            "Se recomienda apoyo adicional en el hogar con las tareas.",
            "Se sugiere dedicar tiempo de lectura diario en casa.",
            "Debe asistir a las tutorías de refuerzo programadas.",
            "Se recomienda atención profesional en el área de lectoescritura.",
            "Felicitaciones por el excelente desempeño durante el año escolar."
        ]
    },

    userBank: null,
    activeCategory: 'academico',
    STORAGE_KEY: 'minerd_obs_general_bank',

    init: function () {
        this.loadBank();
        this.renderPanel();
        this.bindEvents();
    },

    loadBank: function () {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                this.userBank = JSON.parse(saved);
            } else {
                this.userBank = JSON.parse(JSON.stringify(this.defaultBank));
                this.saveBank();
            }
        } catch (e) {
            console.error("Error loading obs general bank", e);
            this.userBank = JSON.parse(JSON.stringify(this.defaultBank));
        }
    },

    saveBank: function () {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.userBank));
    },

    // --- UI ---

    renderPanel: function () {
        if (document.getElementById('obs-general-bank-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'obs-general-bank-panel';
        panel.className = "hidden fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-[10000] transform translate-x-full transition-transform duration-300 flex flex-col";
        panel.innerHTML = `
            <div class="p-4 bg-purple-600 text-white flex justify-between items-center shadow-md">
                <h3 class="font-bold flex items-center gap-2">
                    📝 Banco de Observaciones
                </h3>
                <button id="btn-close-obs-bank" class="text-white hover:text-gray-200 text-xl font-bold">&times;</button>
            </div>
            
            <div class="p-3 bg-gray-50 border-b flex gap-2 overflow-x-auto no-scrollbar">
                <button class="tab-obs-bank text-xs font-bold px-3 py-1 rounded-full bg-purple-100 text-purple-700 whitespace-nowrap" data-cat="academico">📖 Académico</button>
                <button class="tab-obs-bank text-xs font-bold px-3 py-1 rounded-full bg-gray-200 text-gray-600 whitespace-nowrap" data-cat="conducta">🤝 Conducta</button>
                <button class="tab-obs-bank text-xs font-bold px-3 py-1 rounded-full bg-gray-200 text-gray-600 whitespace-nowrap" data-cat="asistencia">📅 Asistencia</button>
                <button class="tab-obs-bank text-xs font-bold px-3 py-1 rounded-full bg-gray-200 text-gray-600 whitespace-nowrap" data-cat="recomendaciones">💡 Recomendaciones</button>
            </div>

            <div id="obs-bank-list-container" class="flex-1 overflow-y-auto p-4 space-y-2">
                <!-- Phrases go here -->
            </div>

            <div class="p-4 border-t bg-gray-50">
                <div class="flex gap-2">
                    <input type="text" id="new-obs-phrase-input" placeholder="Escribir nueva observación..." class="flex-1 text-sm border p-2 rounded focus:border-purple-500 outline-none">
                    <button id="btn-add-obs-phrase" class="bg-purple-600 text-white px-3 rounded font-bold hover:bg-purple-700">+</button>
                </div>
                <p class="text-[10px] text-gray-400 mt-1">Se guardará en la categoría activa.</p>
            </div>
        `;
        document.body.appendChild(panel);

        // Bind Close
        document.getElementById('btn-close-obs-bank').onclick = () => this.togglePanel(false);

        // Bind Add
        document.getElementById('btn-add-obs-phrase').onclick = () => this.addPhrase();

        // Enter key on input
        document.getElementById('new-obs-phrase-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.addPhrase();
        });

        // Bind Tabs
        panel.querySelectorAll('.tab-obs-bank').forEach(btn => {
            btn.onclick = (e) => {
                this.switchTab(e.target.dataset.cat);
                panel.querySelectorAll('.tab-obs-bank').forEach(b => {
                    b.classList.remove('bg-purple-100', 'text-purple-700');
                    b.classList.add('bg-gray-200', 'text-gray-600');
                });
                e.target.classList.remove('bg-gray-200', 'text-gray-600');
                e.target.classList.add('bg-purple-100', 'text-purple-700');
            };
        });

        // Initial Load
        this.switchTab('academico');
    },

    switchTab: function (category) {
        this.activeCategory = category;
        const container = document.getElementById('obs-bank-list-container');
        container.innerHTML = '';

        const phrases = this.userBank[category] || [];

        if (phrases.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">No hay observaciones en esta categoría.<br>¡Agrega una abajo!</p>';
            return;
        }

        phrases.forEach((phrase, index) => {
            const div = document.createElement('div');
            div.className = "group flex items-start justify-between bg-white p-2 rounded border border-gray-100 hover:border-purple-300 hover:shadow-sm cursor-pointer transition-all";

            const span = document.createElement('span');
            span.className = "text-sm text-gray-700 select-none flex-1";
            span.innerText = phrase;

            // Click to insert
            span.onclick = () => this.insertPhrase(phrase);

            // Actions
            const divActions = document.createElement('div');
            divActions.className = "flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity";

            // Edit
            const btnEdit = document.createElement('button');
            btnEdit.innerHTML = "✏️";
            btnEdit.className = "text-xs hover:scale-125 transition-transform p-1";
            btnEdit.title = "Editar";
            btnEdit.onclick = (e) => {
                e.stopPropagation();
                this.editPhrase(category, index);
            };

            // Delete
            const btnDel = document.createElement('button');
            btnDel.innerHTML = "🗑️";
            btnDel.className = "text-xs text-gray-300 hover:text-red-500 p-1 hover:scale-125 transition-transform";
            btnDel.title = "Eliminar";
            btnDel.onclick = (e) => {
                e.stopPropagation();
                this.deletePhrase(category, index);
            };

            divActions.appendChild(btnEdit);
            divActions.appendChild(btnDel);

            div.appendChild(span);
            div.appendChild(divActions);
            container.appendChild(div);
        });
    },

    togglePanel: function (show) {
        const panel = document.getElementById('obs-general-bank-panel');
        if (show) {
            panel.classList.remove('hidden');
            setTimeout(() => panel.classList.remove('translate-x-full'), 10);
        } else {
            panel.classList.add('translate-x-full');
            setTimeout(() => {
                if (panel.classList.contains('translate-x-full')) {
                    panel.classList.add('hidden');
                }
            }, 300);
        }
    },

    insertPhrase: function (phrase) {
        const textarea = document.getElementById('inputObsGeneral');
        if (!textarea) {
            Toast.warning("No se encontró el campo de observaciones.");
            return;
        }

        let current = textarea.value.trim();
        if (current.length > 0 && !current.endsWith('.')) current += ".";

        const separator = current.length > 0 ? " " : "";
        textarea.value = current + separator + phrase;

        // Trigger input event to save state
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        Toast.show("Observación insertada", "success");
    },

    addPhrase: function () {
        const input = document.getElementById('new-obs-phrase-input');
        const text = input.value.trim();
        if (!text) return;

        if (!this.userBank[this.activeCategory]) this.userBank[this.activeCategory] = [];

        this.userBank[this.activeCategory].push(text);
        this.saveBank();
        this.switchTab(this.activeCategory);
        input.value = "";
        Toast.success("Observación añadida al banco.");
    },

    editPhrase: function (category, index) {
        const oldText = this.userBank[category][index];
        const newText = prompt("Editar observación:", oldText);
        if (newText && newText.trim() !== "") {
            this.userBank[category][index] = newText.trim();
            this.saveBank();
            this.switchTab(category);
            Toast.success("Observación actualizada");
        }
    },

    deletePhrase: function (category, index) {
        if (confirm("¿Eliminar esta observación?")) {
            this.userBank[category].splice(index, 1);
            this.saveBank();
            this.switchTab(category);
            Toast.info("Observación eliminada");
        }
    },

    bindEvents: function () {
        // Open button
        const btn = document.getElementById('btn-open-obs-bank');
        if (btn) {
            btn.onclick = () => this.togglePanel(true);
        }

        // Close on click outside
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('obs-general-bank-panel');
            if (panel && !panel.classList.contains('translate-x-full')) {
                if (!panel.contains(e.target) && !e.target.closest('#btn-open-obs-bank')) {
                    this.togglePanel(false);
                }
            }
        });
    }
};

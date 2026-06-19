/**
 * ObsBankGeneral.js
 * Handles the Observations Bank for Page 1 (Portada/General Observations) AND Final Condition.
 * Supports different modes, tabs, and phrases depending on which field is focused.
 */
import { Toast } from './Toast.js';

export const ObsBankGeneral = {
    // Default Observations for Portada
    defaultBankObs: {
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

    // Default phrases for Final Condition (Grades 3-6)
    defaultBankCond: {
        condicion: [
            "Promovido al grado superior.",
            "Promovida al grado superior.",
            "Aplazado. Debe presentar pruebas de recuperación.",
            "Repitente. No alcanzó los aprendizajes requeridos.",
            "Aprobado de forma condicionada.",
            "Promovido con nivelación en Lengua Española y Matemáticas."
        ]
    },

    banks: {
        obs: null,
        cond: null
    },

    activeMode: 'obs', // 'obs' or 'cond'
    activeCategory: 'academico',
    activeTargetInput: null,
    
    STORAGE_KEY_OBS: 'minerd_obs_general_bank',
    STORAGE_KEY_COND: 'minerd_cond_final_bank',

    init: function () {
        this.loadBanks();
        this.renderPanel();
        this.bindEvents();
    },

    loadBanks: function () {
        // Load Obs Bank
        try {
            const savedObs = localStorage.getItem(this.STORAGE_KEY_OBS);
            this.banks.obs = savedObs ? JSON.parse(savedObs) : JSON.parse(JSON.stringify(this.defaultBankObs));
            if (!savedObs) localStorage.setItem(this.STORAGE_KEY_OBS, JSON.stringify(this.banks.obs));
        } catch (e) {
            console.error("Error loading obs general bank", e);
            this.banks.obs = JSON.parse(JSON.stringify(this.defaultBankObs));
        }

        // Load Cond Bank
        try {
            const savedCond = localStorage.getItem(this.STORAGE_KEY_COND);
            this.banks.cond = savedCond ? JSON.parse(savedCond) : JSON.parse(JSON.stringify(this.defaultBankCond));
            if (!savedCond) localStorage.setItem(this.STORAGE_KEY_COND, JSON.stringify(this.banks.cond));
        } catch (e) {
            console.error("Error loading cond final bank", e);
            this.banks.cond = JSON.parse(JSON.stringify(this.defaultBankCond));
        }
    },

    saveBank: function () {
        if (this.activeMode === 'obs') {
            localStorage.setItem(this.STORAGE_KEY_OBS, JSON.stringify(this.banks.obs));
        } else {
            localStorage.setItem(this.STORAGE_KEY_COND, JSON.stringify(this.banks.cond));
        }
    },

    // --- UI ---

    renderPanel: function () {
        if (document.getElementById('obs-general-bank-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'obs-general-bank-panel';
        panel.className = "hidden fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-[10000] transform translate-x-full transition-transform duration-300 flex flex-col";
        panel.innerHTML = `
            <div class="p-4 bg-purple-600 text-white flex justify-between items-center shadow-md">
                <h3 id="obs-bank-panel-title" class="font-bold flex items-center gap-2">
                    📝 Banco de Observaciones
                </h3>
                <button id="btn-close-obs-bank" class="text-white hover:text-gray-200 text-xl font-bold">&times;</button>
            </div>
            
            <div id="obs-bank-tabs-container" class="p-3 bg-gray-50 border-b flex gap-2 overflow-x-auto no-scrollbar">
                <!-- Tabs render dynamically -->
            </div>

            <div id="obs-bank-list-container" class="flex-1 overflow-y-auto p-4 space-y-2">
                <!-- Phrases go here -->
            </div>

            <div class="p-4 border-t bg-gray-50">
                <div class="flex gap-2">
                    <input type="text" id="new-obs-phrase-input" placeholder="Escribir nueva frase..." class="flex-1 text-sm border p-2 rounded focus:border-purple-500 outline-none">
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
    },

    renderTabs: function () {
        const container = document.getElementById('obs-bank-tabs-container');
        container.innerHTML = '';

        const tabs = this.activeMode === 'obs' 
            ? [
                { id: 'academico', label: '📖 Académico' },
                { id: 'conducta', label: '🤝 Conducta' },
                { id: 'asistencia', label: '📅 Asistencia' },
                { id: 'recomendaciones', label: '💡 Recomendaciones' }
              ]
            : [
                { id: 'condicion', label: '🎓 Condición Final' }
              ];

        tabs.forEach((t, i) => {
            const btn = document.createElement('button');
            btn.className = "tab-obs-bank text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap " + 
                            (i === 0 ? "bg-purple-100 text-purple-700" : "bg-gray-200 text-gray-600");
            btn.innerText = t.label;
            btn.dataset.cat = t.id;
            
            btn.onclick = (e) => {
                this.switchTab(t.id);
                document.querySelectorAll('.tab-obs-bank').forEach(b => {
                    b.classList.remove('bg-purple-100', 'text-purple-700');
                    b.classList.add('bg-gray-200', 'text-gray-600');
                });
                e.target.classList.remove('bg-gray-200', 'text-gray-600');
                e.target.classList.add('bg-purple-100', 'text-purple-700');
            };
            
            container.appendChild(btn);
        });

        // Set active category to the first tab
        this.switchTab(tabs[0].id);
    },

    switchTab: function (category) {
        this.activeCategory = category;
        const container = document.getElementById('obs-bank-list-container');
        container.innerHTML = '';

        const bank = this.banks[this.activeMode];
        const phrases = bank[category] || [];

        if (phrases.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">No hay frases en esta categoría.<br>¡Agrega una abajo!</p>';
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

    togglePanel: function (show, mode = 'obs') {
        const panel = document.getElementById('obs-general-bank-panel');
        
        if (show) {
            this.activeMode = mode;
            const title = document.getElementById('obs-bank-panel-title');
            title.innerHTML = mode === 'obs' ? "📝 Banco de Observaciones" : "🎓 Banco de Condición Final";
            
            this.renderTabs();
            
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
        const target = this.activeTargetInput;
        if (!target) {
            Toast.warning("No se encontró el campo destino.");
            return;
        }

        let current = target.value.trim();
        
        // Clear exact auto-filled words if inserting a bank phrase, as requested
        if (target.id === 'inputCondicion') {
            const exactMatches = ['Promovido', 'Aplazado', 'Repitente', 'Promovido.', 'Aplazado.', 'Repitente.'];
            if (exactMatches.includes(current)) {
                current = "";
            }
        }

        if (current.length > 0 && !current.endsWith('.')) current += ".";

        const separator = current.length > 0 ? " " : "";
        target.value = current + separator + phrase;

        // Trigger events to save state
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));

        // Auto-check the corresponding status box if inserting into Condición Final
        if (target.id === 'inputCondicion' && window.store) {
            // Directly update the store just in case events fail to bubble or bind correctly
            window.store.updateFinalCondition(target.value);

            const lower = phrase.toLowerCase();
            let newField = null;
            if (lower.includes("promovido") || lower.includes("promovida") || lower.includes("aprobado")) newField = "promoted";
            else if (lower.includes("aplazado") || lower.includes("aplazada")) newField = "postponed";
            else if (lower.includes("repitente")) newField = "repeater";

            if (newField) {
                window.store.updateStudentStatus('promoted', newField === 'promoted' ? '✔️' : '');
                window.store.updateStudentStatus('postponed', newField === 'postponed' ? '✔️' : '');
                window.store.updateStudentStatus('repeater', newField === 'repeater' ? '✔️' : '');
            }
        }

        Toast.show("Texto insertado", "success");
    },

    addPhrase: function () {
        const input = document.getElementById('new-obs-phrase-input');
        const text = input.value.trim();
        if (!text) return;

        const bank = this.banks[this.activeMode];
        if (!bank[this.activeCategory]) bank[this.activeCategory] = [];

        bank[this.activeCategory].push(text);
        this.saveBank();
        this.switchTab(this.activeCategory);
        input.value = "";
        Toast.success("Frase añadida al banco.");
    },

    editPhrase: function (category, index) {
        const bank = this.banks[this.activeMode];
        const oldText = bank[category][index];
        const newText = prompt("Editar frase:", oldText);
        if (newText && newText.trim() !== "") {
            bank[category][index] = newText.trim();
            this.saveBank();
            this.switchTab(category);
            Toast.success("Frase actualizada");
        }
    },

    deletePhrase: function (category, index) {
        if (confirm("¿Eliminar esta frase?")) {
            this.banks[this.activeMode][category].splice(index, 1);
            this.saveBank();
            this.switchTab(category);
            Toast.info("Frase eliminada");
        }
    },

    bindEvents: function () {
        // Open button for General Observations
        const btnObs = document.getElementById('btn-open-obs-bank');
        if (btnObs) {
            btnObs.onclick = () => {
                this.activeTargetInput = document.getElementById('inputObsGeneral');
                this.togglePanel(true, 'obs');
            };
        }

        // Open button for Final Condition
        const btnCond = document.getElementById('btn-open-cond-bank');
        if (btnCond) {
            btnCond.onclick = () => {
                this.activeTargetInput = document.getElementById('inputCondicion');
                this.togglePanel(true, 'cond');
            };
        }

        // Close on click outside
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('obs-general-bank-panel');
            if (panel && !panel.classList.contains('translate-x-full')) {
                if (!panel.contains(e.target) && !e.target.closest('#btn-open-obs-bank') && !e.target.closest('#btn-open-cond-bank')) {
                    this.togglePanel(false);
                }
            }
        });
    }
};

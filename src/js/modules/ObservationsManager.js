/**
 * ObservationsManager.js
 * Handles the Intelligent Phrase Bank, Auto-suggestions, and Text Composition.
 */
import { store } from './State.js';
import { Toast } from './Toast.js';
import { AppUI } from './AppUI.js';

export const ObservationsManager = {
    // Default Phrases (Fallback)
    defaultBank: {
        high: [
            "Evidencia que el estudiante ha alcanzado un desempeño destacado con relación a los aspectos evaluados.",
            "Muestra un excelente desempeño académico y participa activamente.",
            "Es un estudiante muy dedicado y responsable en todas las actividades.",
            "Demuestra gran interés por aprender y supera las expectativas."
        ],
        average: [
            "Evidencia que el estudiante ha logrado, en general, los aprendizajes esperados.",
            "Cumple con las asignaciones requeridas aunque debe participar más.",
            "Muestra avances significativos en su proceso de aprendizaje.",
            "Es respetuoso y cumple con sus deberes escolares."
        ],
        process: [
            "Evidencia que el estudiante aún se encuentra en proceso, mostrando un logro muy básico.",
            "Necesita reforzar los contenidos básicos y mejorar la dedicación.",
            "Debe repasar los temas vistos en clase para mejorar su rendimiento."
        ],
        insufficient: [
            "Evidencia un desempeño insuficiente en los aspectos evaluados.",
            "Requiere mayor apoyo en el hogar y asistencia regular.",
            "No ha alcanzado los objetivos mínimos del periodo."
        ],
        conduct: [
            "Conversa frecuentemente en clase.",
            "Debe cuidar sus útiles escolares.",
            "Es colaborativo y solidario."
        ]
    },

    // User's Custom Bank
    userBank: null,

    init: function () {
        this.loadBank();
        this.loadSettings();
        this.renderBankPanel();
        this.bindGlobalEvents();

        // Attach to Observation Inputs (Delayed slightly to ensure DOM is ready)
        setTimeout(() => {
            const inputs = document.querySelectorAll('textarea[data-action="updateObservation"]');
            this.attachToInputs(inputs);
        }, 500);
    },

    loadSettings: function () {
        try {
            const saved = localStorage.getItem('obs_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                const highIn = document.getElementById('input-range-high');
                const avgIn = document.getElementById('input-range-avg');
                const lowIn = document.getElementById('input-range-low');
                const globalMaxIn = document.getElementById('input-range-global-max');

                if (highIn && settings.high) highIn.value = settings.high;
                if (avgIn && settings.avg) avgIn.value = settings.avg;
                if (lowIn && settings.low) lowIn.value = settings.low;
                if (globalMaxIn && settings.globalMax) globalMaxIn.value = settings.globalMax;

                // Sync dependent Max inputs
                if (this.updateRangeDisplays) this.updateRangeDisplays();
            }
        } catch (e) { console.error("Error loading obs settings", e); }
    },

    loadBank: function () {
        try {
            const saved = localStorage.getItem('minerd_comment_bank');
            if (saved) {
                this.userBank = JSON.parse(saved);
            } else {
                // Clone defaults
                this.userBank = JSON.parse(JSON.stringify(this.defaultBank));
                this.saveBank();
            }
        } catch (e) {
            console.error("Error loading bank", e);
            this.userBank = JSON.parse(JSON.stringify(this.defaultBank));
        }
    },

    saveBank: function () {
        localStorage.setItem('minerd_comment_bank', JSON.stringify(this.userBank));
    },

    // --- LOGIC ---

    getSuggestions: function (average) {
        let category = 'average';
        if (average >= 90) category = 'high';
        if (average < 70) category = 'low';

        // Mix category phrases with some conduct phrases
        const base = this.userBank[category] || [];
        const conduct = this.userBank.conduct || [];

        // Return random subset (e.g., 3 specific + 1 conduct)
        // For now, return all for the user to pick
        return {
            recommended: base,
            conduct: conduct,
            categoryName: category === 'high' ? 'Alto Rendimiento' : (category === 'low' ? 'Refuerzo' : 'Promedio')
        };
    },

    // --- UI RENDERING ---

    renderBankPanel: function () {
        // Only if not exists
        if (document.getElementById('obs-bank-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'obs-bank-panel';
        panel.className = "fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-50 transform translate-x-full transition-transform duration-300 flex flex-col";
        panel.innerHTML = `
            <div class="p-4 bg-indigo-600 text-white flex justify-between items-center shadow-md">
                <h3 class="font-bold flex items-center gap-2">
                    📚 Banco de Frases
                </h3>
                <button id="btn-close-bank" class="text-white hover:text-gray-200 text-xl font-bold">&times;</button>
            </div>
            
            <div class="p-3 bg-gray-50 border-b flex gap-2 overflow-x-auto no-scrollbar">
                <button class="tab-bank text-xs font-bold px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 whitespace-nowrap" data-cat="high">🌟 Destacado</button>
                <button class="tab-bank text-xs font-bold px-3 py-1 rounded-full bg-gray-200 text-gray-600 whitespace-nowrap" data-cat="average">📝 Logrado</button>
                <button class="tab-bank text-xs font-bold px-3 py-1 rounded-full bg-gray-200 text-gray-600 whitespace-nowrap" data-cat="process">⚠️ Proceso</button>
                <button class="tab-bank text-xs font-bold px-3 py-1 rounded-full bg-gray-200 text-gray-600 whitespace-nowrap" data-cat="insufficient">🛑 Insuficiente</button>
                <button class="tab-bank text-xs font-bold px-3 py-1 rounded-full bg-gray-200 text-gray-600 whitespace-nowrap" data-cat="conduct">🤝 Conducta</button>
            </div>

            <div id="bank-list-container" class="flex-1 overflow-y-auto p-4 space-y-2">
                <!-- Phrases go here -->
            </div>

            <div class="p-4 border-t bg-gray-50">
                <div class="flex gap-2">
                    <input type="text" id="new-phrase-input" placeholder="Escribir nueva frase..." class="flex-1 text-sm border p-2 rounded focus:border-indigo-500 outline-none">
                    <button id="btn-add-phrase" class="bg-indigo-600 text-white px-3 rounded font-bold hover:bg-indigo-700">+</button>
                </div>
                <p class="text-[10px] text-gray-400 mt-1">Se guardará en la categoría activa.</p>
            </div>
        `;
        document.body.appendChild(panel);

        // Bind Close
        document.getElementById('btn-close-bank').onclick = () => this.togglePanel(false);

        // Bind Add
        document.getElementById('btn-add-phrase').onclick = () => this.addPhraseFromInput();

        // Bind Tabs
        panel.querySelectorAll('.tab-bank').forEach(btn => {
            btn.onclick = (e) => {
                this.switchTab(e.target.dataset.cat);

                // Update Style
                panel.querySelectorAll('.tab-bank').forEach(b => {
                    b.classList.remove('bg-indigo-100', 'text-indigo-700');
                    b.classList.add('bg-gray-200', 'text-gray-600');
                });
                e.target.classList.remove('bg-gray-200', 'text-gray-600');
                e.target.classList.add('bg-indigo-100', 'text-indigo-700');
            };
        });

        // Initial Load
        this.switchTab('high');
    },

    activeCategory: 'high',
    activeTargetInput: null, // The input (P1, P2...) we are currently editing

    switchTab: function (category) {
        this.activeCategory = category;
        const container = document.getElementById('bank-list-container');
        container.innerHTML = '';

        const phrases = this.userBank[category] || [];

        phrases.forEach((phrase, index) => {
            const div = document.createElement('div');
            div.className = "group flex items-start justify-between bg-white p-2 rounded border border-gray-100 hover:border-indigo-300 hover:shadow-sm cursor-pointer transition-all";

            const span = document.createElement('span');
            span.className = "text-sm text-gray-700 select-none flex-1";
            span.innerText = phrase;

            // Usage Click
            span.onclick = () => this.insertPhrase(phrase);

            // Actions Container
            const divActions = document.createElement('div');
            divActions.className = "flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity";

            // Edit Button
            const btnEdit = document.createElement('button');
            btnEdit.innerHTML = "✏️";
            btnEdit.className = "text-xs hover:scale-125 transition-transform p-1";
            btnEdit.title = "Editar Frase";
            btnEdit.onclick = (e) => {
                e.stopPropagation();
                this.editPhrase(category, index);
            };

            // Delete Button
            const btnDel = document.createElement('button');
            btnDel.innerHTML = "🗑️";
            btnDel.className = "text-xs text-gray-300 hover:text-red-500 p-1 hover:scale-125 transition-transform";
            btnDel.title = "Eliminar Frase";
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

    togglePanel: function (show, targetInput = null) {
        const panel = document.getElementById('obs-bank-panel');
        if (show) {
            panel.classList.remove('translate-x-full');
            this.activeTargetInput = targetInput;
        } else {
            panel.classList.add('translate-x-full');
            this.activeTargetInput = null;
        }
    },

    addPhraseFromInput: function () {
        const input = document.getElementById('new-phrase-input');
        const text = input.value.trim();
        if (!text) return;

        if (!this.userBank[this.activeCategory]) this.userBank[this.activeCategory] = [];

        this.userBank[this.activeCategory].push(text);
        this.saveBank();
        this.switchTab(this.activeCategory); // Refresh
        input.value = "";
        Toast.success("Frase añadida al banco.");
    },

    editPhrase: function (category, index) {
        const oldText = this.userBank[category][index];

        AppUI.prompt(
            "Editar Frase",
            "Modifica el texto de la frase:",
            (newText) => {
                if (newText && newText.trim() !== "") {
                    this.userBank[category][index] = newText.trim();
                    this.saveBank();
                    this.switchTab(category);
                    Toast.success("Frase actualizada");
                }
            },
            "Escribe la frase...",
            oldText
        );
    },

    deletePhrase: function (category, index) {
        AppUI.confirm(
            "Eliminar Frase",
            "¿Estás seguro de que deseas borrar esta frase?",
            () => {
                this.userBank[category].splice(index, 1);
                this.saveBank();
                this.switchTab(category);
                Toast.info("Frase eliminada");
            },
            true,
            "Borrar"
        );
    },

    insertPhrase: function (phrase) {
        if (!this.activeTargetInput) {
            Toast.warning("Selecciona primero una casilla de observación.");
            return;
        }

        // Parse Smart Tags (Placeholder)
        // let finalPhrase = phrase.replace("{Nombre}", store.state.currentStudent...);
        // For now, simpler append

        let current = this.activeTargetInput.value.trim();
        if (current.length > 0 && !current.endsWith('.')) current += ".";

        const separator = current.length > 0 ? " " : "";
        this.activeTargetInput.value = current + separator + phrase;

        // Trigger Input Event to save state
        this.activeTargetInput.dispatchEvent(new Event('input', { bubbles: true }));

        Toast.show("Frase insertada", "success");
    },

    // Bind Tools to Inputs (Called by ReportRenderer)
    attachToInputs: function (inputs) {
        inputs.forEach(input => {
            // Check if already has wrapper
            if (input.dataset.obsHooked) return;

            // Create Toolbar
            const toolbar = document.createElement('div');
            toolbar.className = "absolute right-1 top-1 flex gap-1";

            // Magic Wand (Suggest)
            const btnMagic = document.createElement('button');
            btnMagic.innerHTML = "✨";
            btnMagic.className = "w-5 h-5 flex items-center justify-center bg-yellow-100 text-yellow-600 rounded-full hover:bg-yellow-200 text-[10px] shadow-sm";
            btnMagic.title = "Sugerir Frase (Según Promedio)";
            btnMagic.onclick = (e) => {
                e.stopPropagation();
                this.handleMagicSuggest(input);
            };

            // Book (Open Bank)
            const btnBank = document.createElement('button');
            btnBank.innerHTML = "📚";
            btnBank.className = "w-5 h-5 flex items-center justify-center bg-indigo-100 text-indigo-600 rounded-full hover:bg-indigo-200 text-[10px] shadow-sm";
            btnBank.title = "Abrir Banco de Frases";
            btnBank.onclick = (e) => {
                e.stopPropagation();
                this.togglePanel(true, input);
            };

            // Maximize (Expand)
            const btnExpand = document.createElement('button');
            btnExpand.innerHTML = "🔍";
            btnExpand.className = "w-5 h-5 flex items-center justify-center bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 text-[10px] shadow-sm";
            btnExpand.title = "Editor Ampliado";
            btnExpand.onclick = (e) => {
                e.stopPropagation();
                // TODO: Implement Expanded Mode
                alert("Modo ampliado pendiente.");
            };

            // Wrap input to position tools
            // Actually, ReportRenderer creates specific layout. We might assume input is in a relative container.
            // If not, we need to wrap it.
            // Let's assume the GridRenderer puts them in a Relative cell.

            // For now, we manually inject.
            if (input.parentElement) {
                input.parentElement.classList.add('relative'); // Ensure relative
                input.parentElement.appendChild(toolbar);
                toolbar.appendChild(btnMagic);
                toolbar.appendChild(btnBank);
                // toolbar.appendChild(btnExpand); 
            }

            input.dataset.obsHooked = "true";
        });
    },

    bindGlobalEvents: function () {
        // Settings Button (Phrase Bank)
        const btnSettings = document.getElementById('btn-open-phrase-bank');
        if (btnSettings) {
            btnSettings.onclick = () => {
                this.togglePanel(true);
                // Close settings modal if open
                const settingsModal = document.getElementById('settings-modal');
                if (settingsModal) settingsModal.classList.add('hidden');
            };
        }

        // Save Range Settings on Change
        const inputIds = [
            'input-range-high', 'input-range-avg', 'input-range-low',
            'input-range-global-max', 'input-range-avg-max', 'input-range-low-max', 'input-range-ins-max'
        ];

        inputIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                // Real-time Logic (2-way binding)
                el.addEventListener('input', (e) => {
                    const val = parseInt(e.target.value);
                    if (isNaN(val)) return;

                    // If User Edits Max -> Update Min Above
                    if (id === 'input-range-avg-max') {
                        const h = document.getElementById('input-range-high');
                        if (h) h.value = val + 1;
                    }
                    if (id === 'input-range-low-max') {
                        const a = document.getElementById('input-range-avg');
                        if (a) a.value = val + 1;
                    }
                    if (id === 'input-range-ins-max') {
                        const l = document.getElementById('input-range-low');
                        if (l) l.value = val + 1;
                    }

                    // If User Edits Min -> Max Below updates via updateRangeDisplays
                    if (this.updateRangeDisplays) this.updateRangeDisplays();
                });

                // Persistence
                el.addEventListener('change', () => {
                    const h = document.getElementById('input-range-high').value;
                    const a = document.getElementById('input-range-avg').value;
                    const l = document.getElementById('input-range-low').value;
                    const g = document.getElementById('input-range-global-max').value;

                    localStorage.setItem('obs_settings', JSON.stringify({ high: h, avg: a, low: l, globalMax: g }));

                    if (this.updateRangeDisplays) this.updateRangeDisplays();
                    Toast.success('Configuración actualizada');
                });
            }
        });

        // Close on click outside (if needed)
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('obs-bank-panel');
            if (panel && !panel.classList.contains('translate-x-full')) {
                // Close if clicking outside panel AND not on a trigger button
                if (!panel.contains(e.target) && !e.target.closest('#btn-open-phrase-bank') && !e.target.closest('.obs-tool-btn')) {
                    this.togglePanel(false);
                }
            }
        });

        // CLOUD SYNC: Reload Settings if restored
        window.addEventListener('minerd:settings-restored', () => {
            console.log("☁️ Settings Restored Event Received");
            this.loadSettings();
            this.loadBank();
            if (document.getElementById('obs-bank-panel')) {
                this.switchTab(this.activeCategory);
            }
        });
    },

    updateRangeDisplays: function () {
        const hVal = parseInt(document.getElementById('input-range-high')?.value || 89);
        const aVal = parseInt(document.getElementById('input-range-avg')?.value || 77);
        const lVal = parseInt(document.getElementById('input-range-low')?.value || 65);

        // Update Max Inputs (Downstream) based on Mins
        const inAvgMax = document.getElementById('input-range-avg-max');
        if (inAvgMax && document.activeElement !== inAvgMax) inAvgMax.value = (hVal - 1);

        const inLowMax = document.getElementById('input-range-low-max');
        if (inLowMax && document.activeElement !== inLowMax) inLowMax.value = (aVal - 1);

        const inInsMax = document.getElementById('input-range-ins-max');
        if (inInsMax && document.activeElement !== inInsMax) inInsMax.value = (lVal - 1);
    },

    handleMagicSuggest: function (input) {
        const period = input.dataset.period; // 'p1', 'p2', etc.
        if (!period) {
            this.togglePanel(true, input);
            return;
        }

        // Calculate Average
        const subjects = store.getState().subjects || [];
        let total = 0;
        let count = 0;

        subjects.forEach(sub => {
            // Check Final for Period? Or Competencies?
            // Usually Average is Sum of Grades / Count.
            // But grades are inside competencies? Or is there a Period Final?
            // 'p1' exists in competencies: c['p1'].
            // Let's Average the Competencies first?
            // Or look for a Subject Average?
            // The system doesn't seem to store calculated Subject Avg per period explicitly in 'sub', relies on runtime calc?
            // Wait, GridRenderer calculates rows.
            // Let's keep it simple: Average of ALL competence values for that period.

            sub.competencies.forEach(comp => {
                const val = parseFloat(comp[period]);
                if (!isNaN(val) && val > 0) {
                    total += val;
                    count++;
                }
            });
        });

        let average = 0;
        if (count > 0) average = Math.round(total / count);

        // Get Thresholds (Configurable)
        const highThresh = parseInt(document.getElementById('input-range-high')?.value || 89);
        const avgThresh = parseInt(document.getElementById('input-range-avg')?.value || 77);
        const lowThresh = parseInt(document.getElementById('input-range-low')?.value || 65);

        // Map to Category
        let category = 'average';
        if (average >= highThresh) category = 'high';
        else if (average >= avgThresh) category = 'average';
        else if (average >= lowThresh) category = 'process';
        else category = 'insufficient';

        // Feedback
        if (count > 0) {
            Toast.info(`Promedio: ${average} ➡️ Fase: ${this.getCategoryLabel(category)}`);
        } else {
            Toast.warning("No hay notas suficientes.");
        }

        // Action
        this.switchTab(category);
        this.togglePanel(true, input);

        // Highlight active tab
        const panel = document.getElementById('obs-bank-panel');
        if (panel) {
            panel.querySelectorAll('.tab-bank').forEach(b => {
                b.classList.remove('bg-indigo-100', 'text-indigo-700');
                b.classList.add('bg-gray-200', 'text-gray-600');
                if (b.dataset.cat === category) {
                    b.classList.remove('bg-gray-200', 'text-gray-600');
                    b.classList.add('bg-indigo-100', 'text-indigo-700');
                }
            });
        }
    },

    getCategoryLabel: function (cat) {
        if (cat === 'high') return 'Destacado';
        if (cat === 'average') return 'Logrado';
        if (cat === 'process') return 'En Proceso';
        if (cat === 'insufficient') return 'Insuficiente';
        return 'Conducta';
    }
};

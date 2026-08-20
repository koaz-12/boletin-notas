/**
 * ActaManager.js
 * Handles generating and copying grade data formatted specifically for:
 * "ACTA DE CALIFICACION NIVEL PRIMARIO EN BLANCO (2).xlsx"
 */

import { store } from './State.js';
import { Toast } from './Toast.js';

export const ActaManager = {
    // Canonical 8 subjects in the exact order of the Acta Excel
    ACTA_SUBJECTS: [
        {
            key: 'lengua',
            title: 'Lengua Española',
            shortTitle: 'Lengua Esp.',
            cell: 'C15',
            compCell: 'D15',
            aliases: ['lengua española', 'lengua espanola', 'lengua']
        },
        {
            key: 'matematica',
            title: 'Matemáticas',
            shortTitle: 'Matemáticas',
            cell: 'G15',
            compCell: 'H15',
            aliases: ['matemática', 'matematica', 'matemáticas', 'matematicas']
        },
        {
            key: 'naturales',
            title: 'Ciencias Naturales',
            shortTitle: 'C. Naturales',
            cell: 'K15',
            compCell: 'L15',
            aliases: ['ciencias de la naturaleza', 'ciencias naturales', 'ciencias natural', 'naturales', 'naturaleza']
        },
        {
            key: 'sociales',
            title: 'Ciencias Sociales',
            shortTitle: 'C. Sociales',
            cell: 'O15',
            compCell: 'P15',
            aliases: ['ciencias sociales', 'sociales']
        },
        {
            key: 'formacion',
            title: 'Formación Humana',
            shortTitle: 'F. Humana',
            cell: 'S15',
            compCell: 'T15',
            aliases: [
                'formación integral, humana y religiosa',
                'formacion integral, humana y religiosa',
                'formación humana',
                'formacion humana',
                'fihr'
            ]
        },
        {
            key: 'ingles',
            title: 'Inglés',
            shortTitle: 'Inglés',
            cell: 'W15',
            compCell: 'X15',
            aliases: [
                'lenguas extranjeras (inglés)',
                'lenguas extranjeras (ingles)',
                'lengua extranjera (inglés)',
                'lengua extranjera (ingles)',
                'lengua extranjera',
                'inglés',
                'ingles',
                'idioma extranjero'
            ]
        },
        {
            key: 'artistica',
            title: 'Educación Artística',
            shortTitle: 'E. Artística',
            cell: 'AA15',
            compCell: 'AB15',
            aliases: ['educación artística', 'educacion artistica', 'artística', 'artistica']
        },
        {
            key: 'fisica',
            title: 'Educación Física',
            shortTitle: 'E. Física',
            cell: 'AE15',
            compCell: 'AF15',
            aliases: ['educación física', 'educacion fisica', 'física', 'fisica']
        }
    ],

    options: {
        pasteMode: 'namesAndGrades', // 'namesAndGrades' (default: B15 - Nombres y Notas), 'full' (A15), 'gradesOnly' (C15)
        gradeFormat: 'numeric', // 'numeric' (default: 0-100) or 'literal'
        nameFormat: 'firstLast', // 'firstLast' (default: Nombre Apellido), 'lastFirstComma', 'lastFirst', 'original'
        includeCompetencies: false
    },

    init() {
        this.modal = document.getElementById('modalActaCopy');
        this.btnClose = document.getElementById('btnCloseActaModal');
        this.btnCopy = document.getElementById('btnCopyActaData');

        this.selectPasteMode = document.getElementById('actaPasteMode');
        this.selectGradeFormat = document.getElementById('actaGradeFormat');
        this.selectNameFormat = document.getElementById('actaNameFormat');
        this.chkCompetencies = document.getElementById('actaIncludeCompetencies');
        this.previewContainer = document.getElementById('actaPreviewTable');
        this.quickChipsContainer = document.getElementById('actaQuickChipsContainer');

        // All trigger buttons across the UI
        const openBtnIds = [
            'btnOpenActaModal',
            'btnOpenActaModalHeader',
            'btnOpenActaModalGrades',
            'btnOpenActaModalFloat'
        ];

        openBtnIds.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => this.openModal());
            }
        });

        if (this.btnClose) {
            this.btnClose.addEventListener('click', () => this.closeModal());
        }
        if (this.btnCopy) {
            this.btnCopy.addEventListener('click', () => this.copyToClipboard());
        }

        if (this.selectPasteMode) {
            this.selectPasteMode.addEventListener('change', (e) => {
                this.options.pasteMode = e.target.value;
                this.renderPreview();
            });
        }

        if (this.selectGradeFormat) {
            this.selectGradeFormat.addEventListener('change', (e) => {
                this.options.gradeFormat = e.target.value;
                this.renderPreview();
            });
        }

        if (this.selectNameFormat) {
            this.selectNameFormat.addEventListener('change', (e) => {
                this.options.nameFormat = e.target.value;
                this.renderPreview();
            });
        }

        if (this.chkCompetencies) {
            this.chkCompetencies.addEventListener('change', (e) => {
                this.options.includeCompetencies = e.target.checked;
                this.renderPreview();
            });
        }
    },

    openModal() {
        if (!this.modal) return;
        const state = store.getState();
        if (!state.studentList || state.studentList.length === 0) {
            Toast.warning("No hay estudiantes en la sección actual.");
            return;
        }

        this.renderQuickChips();
        this.renderPreview();
        this.modal.classList.remove('hidden');
        this.modal.classList.add('flex');
    },

    closeModal() {
        if (!this.modal) return;
        this.modal.classList.add('hidden');
        this.modal.classList.remove('flex');
    },

    getLiteral(numericGrade) {
        if (numericGrade === undefined || numericGrade === null || numericGrade === "") return "";
        const n = parseFloat(numericGrade);
        if (isNaN(n)) return String(numericGrade).trim();
        if (n >= 90) return "A";
        if (n >= 80) return "B";
        if (n >= 70) return "C";
        return "D";
    },

    getCompetencyCounts(competencies) {
        if (!competencies || !Array.isArray(competencies) || competencies.length === 0) {
            return { L: "", P: "", I: "" };
        }
        let L = 0, P = 0, I = 0, total = 0;
        competencies.forEach(c => {
            let val = c.final;
            if (val === undefined || val === null || val === "") {
                const periods = [c.p1, c.p2, c.p3, c.p4]
                    .map(v => parseFloat(v))
                    .filter(v => !isNaN(v));
                if (periods.length > 0) {
                    val = Math.round(periods.reduce((a, b) => a + b, 0) / periods.length);
                }
            }
            const n = parseFloat(val);
            if (!isNaN(n) && n > 0) {
                total++;
                if (n >= 70) L++;
                else if (n >= 60) P++;
                else I++;
            }
        });

        if (total === 0) return { L: "", P: "", I: "" };
        return {
            L: L.toString(),
            P: P.toString(),
            I: I.toString()
        };
    },

    findMatchingSubject(studentSubjects, canonicalSubj) {
        if (!studentSubjects || !Array.isArray(studentSubjects)) return null;
        for (const s of studentSubjects) {
            if (!s || !s.name) continue;
            const norm = s.name.trim().toLowerCase();
            if (canonicalSubj.aliases.some(alias => norm.includes(alias) || alias.includes(norm))) {
                return s;
            }
        }
        return null;
    },

    formatStudentName(studentName, info = {}) {
        const format = this.options.nameFormat || 'firstLast';
        const first = (info.nombres || "").trim();
        const last = (info.apellidos || "").trim();

        if (first && last) {
            if (format === 'firstLast') return `${first} ${last}`;
            if (format === 'lastFirstComma') return `${last}, ${first}`;
            if (format === 'lastFirst') return `${last} ${first}`;
            if (format === 'original') return studentName;
        }

        const raw = (studentName || "").trim();
        if (raw.includes(',')) {
            const parts = raw.split(',');
            const pLast = parts[0].trim();
            const pFirst = parts[1] ? parts[1].trim() : '';
            if (format === 'firstLast') return pFirst ? `${pFirst} ${pLast}` : pLast;
            if (format === 'lastFirstComma') return pFirst ? `${pLast}, ${pFirst}` : pLast;
            if (format === 'lastFirst') return pFirst ? `${pLast} ${pFirst}` : pLast;
            return raw;
        }

        if (first || last) {
            return first || last;
        }

        return raw;
    },

    getStudentRowData(studentName, index, state) {
        const student = state.roster[studentName];
        if (!student) return null;

        const info = student.studentInfo || {};
        const order = info.order || (index + 1).toString();
        const fullName = this.formatStudentName(studentName, info);

        const studentSubjects = student.subjects || [];
        const subjectCols = [];
        const subjectMap = {};

        this.ACTA_SUBJECTS.forEach(canon => {
            const subj = this.findMatchingSubject(studentSubjects, canon);
            if (!subj) {
                subjectCols.push("", "", "", "");
                subjectMap[canon.key] = { calif: "", L: "", P: "", I: "" };
                return;
            }

            // Calculate numeric final
            let finalNumeric = subj.final_recovery || subj.final || "";
            if (finalNumeric === "" && subj.competencies && subj.competencies.length > 0) {
                const compFinals = subj.competencies
                    .map(c => parseFloat(c.final || ""))
                    .filter(n => !isNaN(n));
                if (compFinals.length > 0) {
                    finalNumeric = Math.round(compFinals.reduce((a, b) => a + b, 0) / compFinals.length).toString();
                }
            }

            // Grade representation
            let gradeVal = "";
            if (finalNumeric !== "") {
                gradeVal = this.options.gradeFormat === 'literal'
                    ? this.getLiteral(finalNumeric)
                    : finalNumeric;
            }

            // Competency counts
            const counts = this.getCompetencyCounts(subj.competencies);
            if (this.options.includeCompetencies) {
                subjectCols.push(gradeVal, counts.L, counts.P, counts.I);
            } else {
                subjectCols.push(gradeVal, "", "", "");
            }

            subjectMap[canon.key] = {
                calif: gradeVal,
                L: counts.L,
                P: counts.P,
                I: counts.I
            };
        });

        return {
            order,
            fullName,
            subjectCols,
            subjectMap
        };
    },

    buildDataset() {
        const state = store.getState();
        const studentList = state.studentList || [];
        const rows = [];

        studentList.forEach((name, idx) => {
            const rowData = this.getStudentRowData(name, idx, state);
            if (rowData) {
                rows.push(rowData);
            }
        });

        return rows;
    },

    renderQuickChips() {
        if (!this.quickChipsContainer) return;

        let chipsHtml = `
            <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mr-1">Copiar Columna:</span>
                
                <button onclick="window.ActaManager.copyColumn('names')" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs hover:scale-105 active:scale-95 flex items-center gap-1">
                    <span>👤</span> <span>Nombres (B15)</span>
                </button>
        `;

        this.ACTA_SUBJECTS.forEach(s => {
            chipsHtml += `
                <button onclick="window.ActaManager.copyColumn('${s.key}')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs hover:scale-105 active:scale-95 flex items-center gap-1" title="Copiar ${s.title} para pegar en celda ${s.cell}">
                    <span>📋</span> <span>${s.shortTitle} (${s.cell})</span>
                </button>
            `;
        });

        chipsHtml += `</div>`;
        this.quickChipsContainer.innerHTML = chipsHtml;
    },

    /**
     * Copy a specific column or subject to the clipboard
     * @param {string} colKey - 'names', 'order', or subject key ('lengua', 'matematica', etc.)
     * @param {string} subcolType - 'all' (Calif+L+P+I), 'calif' (only Calif), 'competencies' (only L+P+I)
     */
    async copyColumn(colKey, subcolType = 'all') {
        const rows = this.buildDataset();
        if (!rows || rows.length === 0) {
            Toast.warning("No hay datos para copiar.");
            return;
        }

        let tsvLines = [];
        let label = "";
        let cellTarget = "A15";

        if (colKey === 'names') {
            label = "Nombres y Apellidos";
            cellTarget = "B15";
            tsvLines = rows.map(r => r.fullName);
        } else if (colKey === 'order') {
            label = "Número de Orden";
            cellTarget = "A15";
            tsvLines = rows.map(r => r.order);
        } else {
            const subj = this.ACTA_SUBJECTS.find(s => s.key === colKey);
            if (!subj) {
                Toast.error("Asignatura no encontrada.");
                return;
            }

            if (subcolType === 'calif') {
                label = `Solo Calificaciones de ${subj.title}`;
                cellTarget = subj.cell;
                tsvLines = rows.map(r => r.subjectMap[colKey]?.calif || "");
            } else if (subcolType === 'competencies') {
                label = `Solo Competencias (L, P, I) de ${subj.title}`;
                cellTarget = subj.compCell;
                tsvLines = rows.map(r => {
                    const m = r.subjectMap[colKey] || {};
                    return [m.L || "", m.P || "", m.I || ""].join('\t');
                });
            } else {
                // Default: 4 columns (Calif, L, P, I)
                label = `${subj.title} (Calif + L, P, I)`;
                cellTarget = subj.cell;
                tsvLines = rows.map(r => {
                    const m = r.subjectMap[colKey] || {};
                    const calif = m.calif || "";
                    if (this.options.includeCompetencies) {
                        return [calif, m.L || "", m.P || "", m.I || ""].join('\t');
                    } else {
                        return [calif, "", "", ""].join('\t');
                    }
                });
            }
        }

        const tsv = tsvLines.join('\r\n');
        await this._writeTextToClipboard(tsv);

        Toast.success(`¡Copiado ${label}! Pega con Ctrl + V en la celda ${cellTarget} de tu Excel 📋`, 6000);
    },

    generateTSV() {
        const rows = this.buildDataset();
        const tsvLines = [];

        rows.forEach(r => {
            let cells = [];
            if (this.options.pasteMode === 'full') {
                cells = [r.order, r.fullName, ...r.subjectCols];
            } else if (this.options.pasteMode === 'namesAndGrades') {
                cells = [r.fullName, ...r.subjectCols];
            } else if (this.options.pasteMode === 'gradesOnly') {
                cells = [...r.subjectCols];
            }
            tsvLines.push(cells.join('\t'));
        });

        return tsvLines.join('\r\n');
    },

    renderPreview() {
        if (!this.previewContainer) return;
        const rows = this.buildDataset();

        if (rows.length === 0) {
            this.previewContainer.innerHTML = '<div class="p-4 text-center text-gray-400 text-sm">No hay estudiantes para previsualizar.</div>';
            return;
        }

        let thSubjects = '';
        this.ACTA_SUBJECTS.forEach(s => {
            thSubjects += `
                <th colspan="4" class="px-2 py-1.5 bg-slate-100 border border-slate-300 text-center whitespace-nowrap">
                    <div class="flex items-center justify-between gap-1">
                        <span class="text-[11px] font-extrabold text-slate-800">${s.title}</span>
                        <div class="flex items-center gap-1">
                            <button onclick="window.ActaManager.copyColumn('${s.key}', 'all')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-2xs transition-all hover:scale-105 active:scale-95" title="Copiar las 4 columnas de ${s.title} (Celda ${s.cell})">
                                📋 ${s.cell}
                            </button>
                            <button onclick="window.ActaManager.copyColumn('${s.key}', 'calif')" class="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] font-bold px-1 py-0.5 rounded transition-all" title="Copiar solo la columna de notas">
                                Nota
                            </button>
                        </div>
                    </div>
                </th>
            `;
        });

        let thSubcols = '';
        this.ACTA_SUBJECTS.forEach(() => {
            thSubcols += `
                <th class="px-1 py-0.5 bg-slate-50 border border-slate-200 text-[9px] font-semibold text-slate-600 text-center w-8">Calif</th>
                <th class="px-1 py-0.5 bg-slate-50 border border-slate-200 text-[9px] font-semibold text-emerald-700 text-center w-6">L</th>
                <th class="px-1 py-0.5 bg-slate-50 border border-slate-200 text-[9px] font-semibold text-amber-700 text-center w-6">P</th>
                <th class="px-1 py-0.5 bg-slate-50 border border-slate-200 text-[9px] font-semibold text-rose-700 text-center w-6">I</th>
            `;
        });

        let tbody = '';
        rows.forEach((r, idx) => {
            let rowCells = '';
            if (this.options.pasteMode === 'full') {
                rowCells += `
                    <td class="px-2 py-1 border border-slate-200 text-center text-xs font-mono text-slate-500 bg-slate-50">${r.order}</td>
                    <td class="px-2 py-1 border border-slate-200 text-xs font-semibold text-slate-800 whitespace-nowrap">${r.fullName}</td>
                `;
            } else if (this.options.pasteMode === 'namesAndGrades') {
                rowCells += `
                    <td class="px-2 py-1 border border-slate-200 text-xs font-semibold text-slate-800 whitespace-nowrap">${r.fullName}</td>
                `;
            }

            for (let i = 0; i < r.subjectCols.length; i += 4) {
                const calif = r.subjectCols[i] || '-';
                const l = r.subjectCols[i + 1] || '';
                const p = r.subjectCols[i + 2] || '';
                const itemI = r.subjectCols[i + 3] || '';

                rowCells += `
                    <td class="px-1 py-1 border border-slate-200 text-center text-xs font-bold ${calif === 'A' ? 'text-blue-600' : calif === 'B' ? 'text-emerald-600' : calif === 'C' ? 'text-amber-600' : calif === 'D' ? 'text-rose-600' : 'text-slate-700'}">${calif}</td>
                    <td class="px-1 py-1 border border-slate-200 text-center text-[10px] text-emerald-700 bg-emerald-50/30">${l}</td>
                    <td class="px-1 py-1 border border-slate-200 text-center text-[10px] text-amber-700 bg-amber-50/30">${p}</td>
                    <td class="px-1 py-1 border border-slate-200 text-center text-[10px] text-rose-700 bg-rose-50/30">${itemI}</td>
                `;
            }

            tbody += `
                <tr class="hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}">
                    ${rowCells}
                </tr>
            `;
        });

        let prefixHeaders = '';
        if (this.options.pasteMode === 'full') {
            prefixHeaders = `
                <th rowspan="2" class="px-2 py-1 bg-slate-200 border border-slate-300 text-[10px] font-bold text-slate-700 text-center w-8">No.</th>
                <th rowspan="2" class="px-3 py-1 bg-slate-200 border border-slate-300 text-[10px] font-bold text-slate-700 text-left">
                    <div class="flex items-center justify-between gap-2">
                        <span>Nombres y Apellidos</span>
                        <button onclick="window.ActaManager.copyColumn('names')" class="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded transition-all" title="Copiar solo la columna de nombres (Celda B15)">
                            📋 B15
                        </button>
                    </div>
                </th>
            `;
        } else if (this.options.pasteMode === 'namesAndGrades') {
            prefixHeaders = `
                <th rowspan="2" class="px-3 py-1 bg-slate-200 border border-slate-300 text-[10px] font-bold text-slate-700 text-left">
                    <div class="flex items-center justify-between gap-2">
                        <span>Nombres y Apellidos</span>
                        <button onclick="window.ActaManager.copyColumn('names')" class="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded transition-all" title="Copiar solo la columna de nombres (Celda B15)">
                            📋 B15
                        </button>
                    </div>
                </th>
            `;
        }

        this.previewContainer.innerHTML = `
            <table class="min-w-full border-collapse text-left">
                <thead>
                    <tr>
                        ${prefixHeaders}
                        ${thSubjects}
                    </tr>
                    <tr>
                        ${thSubcols}
                    </tr>
                </thead>
                <tbody>
                    ${tbody}
                </tbody>
            </table>
        `;
    },

    async _writeTextToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    },

    async copyToClipboard() {
        const tsv = this.generateTSV();
        if (!tsv || tsv.trim() === '') {
            Toast.warning("No hay datos para copiar.");
            return;
        }

        try {
            await this._writeTextToClipboard(tsv);

            let cellTarget = "A15";
            if (this.options.pasteMode === 'namesAndGrades') cellTarget = "B15";
            if (this.options.pasteMode === 'gradesOnly') cellTarget = "C15";

            Toast.success(`¡Copiado Todo! Abre tu Excel y pega con Ctrl + V en la celda ${cellTarget} 📋`, 6000);
            
            if (this.btnCopy) {
                const originalText = this.btnCopy.innerHTML;
                this.btnCopy.innerHTML = `<span>✅</span> <span>¡Copiado con Éxito!</span>`;
                this.btnCopy.classList.replace('bg-emerald-600', 'bg-green-700');
                setTimeout(() => {
                    this.btnCopy.innerHTML = originalText;
                    this.btnCopy.classList.replace('bg-green-700', 'bg-emerald-600');
                }, 2500);
            }
        } catch (err) {
            console.error("Error al copiar al portapapeles:", err);
            Toast.error("No se pudo copiar automáticamente. Intenta de nuevo.");
        }
    }
};

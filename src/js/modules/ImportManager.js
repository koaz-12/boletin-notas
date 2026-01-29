/**
 * ImportManager.js
 * Handles Excel Import, Modal Rendering, and Batch Processing
 */
import { store } from './State.js';
import { Toast } from './Toast.js';
import { ExcelImport } from './ExcelImport.js';
import { AppUI } from './AppUI.js';

let currentBatchData = [];
let currentIdMap = new Map();

export const ImportManager = {
    // Getter for Batch Data (if needed)
    getBatchData: () => currentBatchData,
    getIdMap: () => currentIdMap,

    // Handle File Input Change (Batch Import)
    handleExcelFile: (target) => {
        const files = Array.from(target.files);
        if (files.length === 0) return;

        currentBatchData = [];

        if (files.length === 1) {
            // Single File Mode -> Sheet Detection
            const file = files[0];
            ExcelImport.readWorkbook(file).then(workbook => {
                const sheets = ExcelImport.getSheets(workbook);

                // Create Batch Items from Sheets
                currentBatchData = sheets.map(sheetName => ({
                    name: sheetName,
                    type: 'sheet',
                    workbook: workbook,
                    file: file,
                    rows: ExcelImport.getRows(workbook, sheetName),
                    fileName: file.name,
                    sheetName: sheetName
                }));

                // We need to fetch students from the first sheet to populate the roster selector
                // Use the first sheet as master
                ExcelImport.getStudents(file, sheets[0]).then(({ students, meta }) => {
                    // Process Metadata (New Template)
                    if (meta) {
                        const sd = store.state.schoolData;
                        if (meta.centro) sd.centro = meta.centro;
                        if (meta.docente) sd.docente = meta.docente;
                        if (meta.seccion) sd.section = meta.seccion;
                        if (meta.anio) sd.codigo = meta.anio; // Hack: Put Year in Code field or similar? Or just ignore.

                        AppUI.initSchoolData();
                        Toast.info("Datos del Centro actualizados desde Excel 🏫");
                    }
                    ImportManager.renderImportModal(students, currentBatchData);
                });

            }).catch(err => {
                console.error(err);
                Toast.error('Error al leer el archivo Excel.');
            });
        } else {
            // Multi File Mode
            const promises = files.map(file => ExcelImport.getStudents(file).then(res => ({
                name: file.name,
                type: 'file',
                workbook: res.workbook,
                file: file,
                students: res.students,
                rows: res.rows,
                fileName: file.name,
                sheetName: ""
            })));

            Promise.all(promises).then(results => {
                currentBatchData = results;
                // Use first file for master list
                if (results.length > 0) {
                    ImportManager.renderImportModal(results[0].students, currentBatchData);
                }
            }).catch(err => {
                console.error(err);
                Toast.error('Error al leer los archivos.');
            });
        }
        // Reset input
        target.value = '';
    },

    // Handle Roster Import (Single File)
    importRoster: async (file) => {
        try {
            const workbook = await ExcelImport.readWorkbook(file);

            // We assume the roster is on the first sheet
            const sheetName = workbook.SheetNames[0];
            const rows = ExcelImport.getRows(workbook, sheetName);

            if (!rows || rows.length === 0) {
                alert("La hoja está vacía.");
                return;
            }

            const students = [];
            const nameIndex = ExcelImport.config.nameIndex;
            const startRow = ExcelImport.config.startRow;

            // Scan rows
            for (let i = startRow; i < rows.length; i++) {
                const row = rows[i];
                const name = row[nameIndex];
                if (name && typeof name === 'string' && name.trim().length > 0) {
                    // Ignore common headers
                    if (name.toLowerCase().includes("nombre") || name.toLowerCase().includes("estudiante")) continue;
                    students.push(name.trim());
                }
            }

            if (students.length === 0) {
                Toast.warning("No se encontraron estudiantes en la Columna B (empezando fila 8).");
                return;
            }

            // Confirm Import
            AppUI.confirm(
                "Importar Lista",
                `Se encontraron ${students.length} estudiantes.\n¿Deseas añadirlos a la lista?`,
                () => {
                    const state = store.getState();
                    const newRoster = { ...state.roster };
                    const newList = [...state.studentList];
                    const defaultSubjects = state.subjects;

                    let added = 0;
                    students.forEach(name => {
                        if (!newRoster[name]) {
                            // Create Empty Profile
                            newRoster[name] = {
                                subjects: JSON.parse(JSON.stringify(defaultSubjects)),
                                attendance: { p1: {}, p2: {}, p3: {}, p4: {} },
                                observations: { p1: "", p2: "", p3: "", p4: "" },
                                studentStatus: {},
                                finalCondition: "",
                                studentInfo: { nombres: "", apellidos: "", id: "", section: "", order: "" }
                            };
                            added++;
                        }
                        if (!state.studentList.includes(name)) {
                            newList.push(name);
                        }
                    });

                    if (added > 0) {
                        store.setRoster(newList, newRoster);
                        Toast.success(`¡Éxito! Se añadieron ${added} estudiantes nuevos.`);
                        store.loadStudent(newList[newList.length - 1]);
                    } else {
                        Toast.info("Todos los estudiantes del archivo ya estaban en la lista.");
                    }
                }
            );

        } catch (err) {
            console.error(err);
            alert("Error al importar lista: " + err.message);
        }
    },

    // Render Import Modal
    renderImportModal: (masterList, batchData) => {
        // Populate Student Select
        const studentSelect = document.getElementById('importStudentSelect');
        studentSelect.innerHTML = ''; // Clear

        // 1. Add "ALL" Option (Default)
        const optAll = document.createElement('option');
        optAll.value = "ALL";
        optAll.innerText = "⚡ IMPORTAR TODA LA CLASE (Todos los Estudiantes)";
        optAll.style.fontWeight = "bold";
        studentSelect.appendChild(optAll);

        // 2. Add Individual Students
        if (masterList.length > 0) {
            masterList.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.name;
                opt.innerText = s.name;
                studentSelect.appendChild(opt);
            });
        } else {
            const opt = document.createElement('option');
            opt.text = "No hay estudiantes en el archivo 1";
            studentSelect.appendChild(opt);
        }

        const tbody = document.getElementById('importFilesTableBody');
        tbody.innerHTML = '';
        currentIdMap.clear(); // Reset map

        batchData.forEach((item, index) => {
            // SPECIAL HANDLER: "Datos" Sheet -> Extract IDs
            if (item.sheetName && item.sheetName.toLowerCase().trim() === 'datos') {
                const idMap = ExcelImport.extractIDs(item.rows);
                // Merge into global map
                idMap.forEach((val, key) => currentIdMap.set(key, val));
                Toast.info(`IDs cargados de hoja 'Datos' (${idMap.size} encontrados).`);
                return; // Skip rendering this sheet row
            }

            const tr = document.createElement('tr');
            tr.className = "border-b";

            // File Status
            let statusHtml = '<span class="text-green-600 font-bold">OK</span>';
            if (item.error) statusHtml = `<span class="text-red-600 font-bold" title="${item.error}">Error</span>`;
            if (!item.rows) statusHtml = '<span class="text-orange-500 font-bold">Vacío</span>';

            // Subject Selector
            let subjectSelect = `<select class="file-subject-select border p-1 rounded w-full" data-index="${index}">
                <option value="-1">-- Ignorar --</option>`;

            // SMART AUTO-MATCHING (Best Match Selection)
            const subjectKeywords = {
                "lengua": ["lengua", "española", "espanola", "leng", "l.e"],
                "matematica": ["matem", "calc", "numer"],
                "sociales": ["social", "soc", "historia", "geografía", "c.soc"],
                "naturaleza": ["natur", "nat", "biología", "química", "fisica", "c.nat"],
                "ingles": ["ingl", "english", "extranjera", "foreign", "idioma", "lenguas extranjeras"],
                "frances": ["franc", "french"],
                "fisica": ["física", "fisica", "deporte", "educación física", "ed. fis"],
                "artistica": ["artística", "artistica", "arte", "plástica", "musica"],
                "integral": ["integral", "humana", "religio", "fihr", "formacion", "f.i.h.r"]
            };

            // Normalize inputs to remove accents for robust matching
            const filename = (item.fileName || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const sheetname = (item.sheetName || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            let bestMatchIndex = -1;

            // Find Best Match
            store.getState().subjects.forEach((subj, sIdx) => {
                // Robust Normalization for Subject Name
                const subjNameNormalized = subj.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                // 1. Direct Name Match (Highest Priority)
                if (filename.includes(subjNameNormalized) || sheetname.includes(subjNameNormalized)) {
                    bestMatchIndex = sIdx;
                }

                // 2. Keyword Match (Secondary)
                if (bestMatchIndex === -1) {
                    for (const [key, keywords] of Object.entries(subjectKeywords)) {
                        if (subjNameNormalized.includes(key)) {
                            const match = keywords.some(k => filename.includes(k) || sheetname.includes(k));

                            if (match) {
                                bestMatchIndex = sIdx;
                                break; // Stop checking keys if we found a match
                            }
                        }
                    }
                }
            });

            // Generate Options
            store.getState().subjects.forEach((subj, sIdx) => {
                const selected = (sIdx === bestMatchIndex) ? 'selected' : '';
                subjectSelect += `<option value="${sIdx}" ${selected}>${subj.name}</option>`;
            });
            subjectSelect += `</select>`;

            tr.innerHTML = `
                <td class="p-2 truncate max-w-[150px]" title="${item.fileName} / ${item.sheetName}">
                    <div class="font-bold text-gray-700">${item.fileName || item.name}</div>
                    <div class="text-[10px] text-gray-500">${item.sheetName || 'Hoja 1'}</div>
                </td>
                <td class="p-2 text-[10px]">${statusHtml}</td>
                <td class="p-2">${subjectSelect}</td>
            `;
            tbody.appendChild(tr);
        });

        const modal = document.getElementById('importModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    },

    // Process Batch Import
    processBatchImport: () => {
        const studentName = document.getElementById('importStudentSelect').value;
        if (!studentName) {
            Toast.warning('Por favor, selecciona un estudiante.');
            return;
        }

        const selects = document.querySelectorAll('.file-subject-select');

        // --- MASS IMPORT LOGIC ---
        if (studentName === 'ALL') {
            AppUI.confirm(
                "Importar Catálogo Completo",
                "Esto importará TODOS los estudiantes encontrados en las hojas seleccionadas.\n¿Continuar?",
                () => {
                    const state = store.getState();
                    const newRoster = { ...state.roster };
                    let newStudentList = [...state.studentList];
                    const defaultSubjects = JSON.parse(JSON.stringify(state.subjects));
                    // Reset template values
                    defaultSubjects.forEach(s => {
                        s.final = ""; s.recovery = "";
                        s.competencies.forEach(c => { c.p1 = ""; c.rp1 = ""; c.p2 = ""; c.rp2 = ""; c.p3 = ""; c.rp3 = ""; c.p4 = ""; c.rp4 = ""; });
                    });

                    let updatedStudents = new Set();
                    let totalGrades = 0;

                    // Determine Grade Layout ONCE
                    const currentGrade = parseInt(store.getState().grade);
                    const isSimpleLayout = (currentGrade <= 2);
                    ExcelImport.setMode(!isSimpleLayout); // Set correct config

                    selects.forEach((select, index) => {
                        const subjectIndex = parseInt(select.value);
                        if (isNaN(subjectIndex) || subjectIndex < 0) return; // Ignore

                        const item = currentBatchData[index];
                        if (!item || !item.rows) return;

                        // Iterate ALL Rows
                        const nameIndex = ExcelImport.getConfig().nameIndex;

                        for (let i = ExcelImport.getConfig().startRow; i < item.rows.length; i++) {
                            const row = item.rows[i];
                            let name = row[nameIndex];
                            if (name && typeof name === 'string' && name.trim().length > 0) {
                                name = name.trim();
                                if (name.toLowerCase().includes("docente") || name.toLowerCase().includes("estudiante")) continue;

                                // Init Student if new
                                const isNewStudent = !newRoster[name];
                                if (isNewStudent) {
                                    newRoster[name] = {
                                        subjects: JSON.parse(JSON.stringify(defaultSubjects)),
                                        attendance: { p1: {}, p2: {}, p3: {}, p4: {} },
                                        observations: { p1: "", p2: "", p3: "", p4: "" },
                                        studentStatus: {},
                                        finalCondition: "",
                                        studentInfo: { nombres: "", apellidos: "", id: "", section: "", order: "" }, // Explicit Init
                                        grade: currentGrade
                                    };
                                    if (!newStudentList.includes(name)) newStudentList.push(name);
                                }

                                // Extract & Populate Names (First Time Only or if empty)
                                if (!newRoster[name].studentInfo) newRoster[name].studentInfo = { nombres: "", apellidos: "", id: "", section: "", order: "" };
                                const sInfo = newRoster[name].studentInfo;
                                if (!sInfo.nombres) {
                                    const parsed = ImportManager.parseStudentName(name);
                                    sInfo.nombres = parsed.nombres;
                                    sInfo.apellidos = parsed.apellidos;
                                }

                                // If it's a new student, add them to the store and get default roster data
                                // NOTE: Removed redundant store.addStudent call that caused crash. 
                                // Initialization is already handled above in newRoster[name] = ...

                                const grades = ExcelImport.extractGrades(row);
                                // Extract Order
                                if (!sInfo.order && grades.order) {
                                    sInfo.order = grades.order;
                                }

                                // Populate ID from Map (Fuzzy Match)
                                if (currentIdMap.size > 0 && grades.name) {
                                    const matchedId = ExcelImport.findBestMatch(grades.name, currentIdMap);
                                    if (matchedId) {
                                        sInfo.id = matchedId;
                                    }
                                }

                                const targetSub = newRoster[name].subjects[subjectIndex];
                                // const currentGrade = parseInt(store.getState().grade); // Already defined above
                                // const isSimpleLayout = (currentGrade <= 2); // Already defined above

                                if (isSimpleLayout) {
                                    // Grade 1-2: Compact Layout (P1, P2, P3, P4)
                                    // Indices: 0->P1, 1->P2, 2->P3, 3->P4
                                    const mapSimple = (compIndex, values) => {
                                        if (!values) return;
                                        targetSub.competencies[compIndex].p1 = values[0];
                                        targetSub.competencies[compIndex].p2 = values[1];
                                        targetSub.competencies[compIndex].p3 = values[2];
                                        targetSub.competencies[compIndex].p4 = values[3];
                                    };
                                    mapSimple(0, grades.c1);
                                    mapSimple(1, grades.c2);
                                    mapSimple(2, grades.c3);
                                    // C4-C7 removed for Primary Education (Only 3 Competencies)
                                } else {
                                    // Grade 3+: Expected Interleaved (P1, RP1, P2, RP2...)
                                    // Note: If ExcelImport config is 4-col, logic below for P3/P4 (indices 4-7) will fail/be empty.
                                    // We keep it as legacy, but it might need ExcelImport update later.

                                    // Map Grades P1/P2
                                    // Map Grades P1/P2
                                    targetSub.competencies[0].p1 = grades.c1[0]; targetSub.competencies[0].rp1 = grades.c1[1];
                                    targetSub.competencies[0].p2 = grades.c1[2]; targetSub.competencies[0].rp2 = grades.c1[3];
                                    targetSub.competencies[0].p3 = grades.c1[4]; targetSub.competencies[0].rp3 = grades.c1[5];
                                    targetSub.competencies[0].p4 = grades.c1[6]; targetSub.competencies[0].rp4 = grades.c1[7];

                                    targetSub.competencies[1].p1 = grades.c2[0]; targetSub.competencies[1].rp1 = grades.c2[1];
                                    targetSub.competencies[1].p2 = grades.c2[2]; targetSub.competencies[1].rp2 = grades.c2[3];
                                    targetSub.competencies[1].p3 = grades.c2[4]; targetSub.competencies[1].rp3 = grades.c2[5];
                                    targetSub.competencies[1].p4 = grades.c2[6]; targetSub.competencies[1].rp4 = grades.c2[7];

                                    targetSub.competencies[2].p1 = grades.c3[0]; targetSub.competencies[2].rp1 = grades.c3[1];
                                    targetSub.competencies[2].p2 = grades.c3[2]; targetSub.competencies[2].rp2 = grades.c3[3];
                                    targetSub.competencies[2].p3 = grades.c3[4]; targetSub.competencies[2].rp3 = grades.c3[5];
                                    targetSub.competencies[2].p4 = grades.c3[6]; targetSub.competencies[2].rp4 = grades.c3[7];

                                    // Removed C4-C7 mapping as Primary Education only has 3 Competencies per Subject.
                                    // The Advanced Layout is for Recovery Columns, not extra competencies.
                                }

                                // Recovery (Fix: usage of correct property 'recovery' from ExcelImport)
                                if (grades.recovery && Array.isArray(grades.recovery)) {
                                    // Filter out empty values and join them
                                    const validRec = grades.recovery.filter(r => r !== "" && r !== null && r !== undefined);
                                    if (validRec.length > 0) {
                                        targetSub.recovery = validRec.join(" / ");
                                    }
                                }

                                // Map Finals (CF) & Competency Averages (C1-C3)
                                if (grades.final !== undefined) targetSub.final = grades.final;
                                if (grades.finalRecovery !== undefined) targetSub.final_recovery = grades.finalRecovery;
                                if (grades.esp !== undefined) targetSub.special_recovery = grades.esp;
                                if (grades.compFinals && Array.isArray(grades.compFinals)) {
                                    // Map C1, C2, C3 finals
                                    if (grades.compFinals[0]) targetSub.competencies[0].final = grades.compFinals[0];
                                    if (grades.compFinals[1]) targetSub.competencies[1].final = grades.compFinals[1];
                                    if (grades.compFinals[2]) targetSub.competencies[2].final = grades.compFinals[2];
                                    // Add more if needed depending on grade level (C4...)? 
                                    // ExcelImport helper returns array length based on config.
                                }

                                updatedStudents.add(name);
                                totalGrades++;
                            }
                        }
                    });

                    // Remove Default 'Estudiante 1' if we imported real students
                    if (updatedStudents.size > 0 && newStudentList.includes("Estudiante 1")) {
                        newStudentList = newStudentList.filter(n => n !== "Estudiante 1");
                        delete newRoster["Estudiante 1"];
                    }

                    store.setRoster(newStudentList, newRoster);
                    Toast.success(`Importación masiva completada. ${updatedStudents.size} estudiantes actualizados.`);
                    document.getElementById('importModal').classList.add('hidden');
                    store.loadStudent(newStudentList[0]);
                },
                false,
                "Sí, Importar"
            );
            return; // Wait for async confirmation
        } else {
            // --- SINGLE STUDENT LOGIC --- (Existing logic)
            selects.forEach((select, index) => {
                const subjectIndex = parseInt(select.value);
                if (isNaN(subjectIndex) || subjectIndex < 0) return;

                const item = currentBatchData[index];
                if (!item || !item.rows) return;

                // Search for current student in this sheet
                // We use Fuzzy Match or Direct Match on Name
                // We need to iterate rows to find the matching name
                const nameIndex = ExcelImport.config.nameIndex;
                let foundRow = null;

                for (let i = ExcelImport.config.startRow; i < item.rows.length; i++) {
                    const rName = item.rows[i][nameIndex];
                    if (rName && rName.trim() === studentName) {
                        foundRow = item.rows[i];
                        break;
                    }
                }

                if (foundRow) {
                    const grades = ExcelImport.extractGrades(foundRow);

                    // Update Store for Current Student & Subject
                    // (Assuming store.currentStudent IS 'studentName' if we selected it? 
                    // No, 'studentName' comes from dropdown.
                    // We must update the Store for THAT student.
                    // But store.updateGrade only works on CURRENT student.
                    // So we must switch to that student first?
                    // OR update roster directly?
                    // The App structure relies on 'store' to mutate state. 

                    // Actually, Single Import usually IMPLIES we are importing FOR the current student context?
                    // In renderImportModal, we populated dropdown with names from the file.
                    // If user selects "Juan", we import data FOR "Juan" into "Juan"'s record in App?
                    // Yes.

                    // We'll use low-level update loop similar to batch but only for one student.
                    const state = store.getState();
                    const newRoster = { ...state.roster };

                    if (!newRoster[studentName]) {
                        // Should exist if selected from dropdown? 
                        // Yes, but maybe dropdown came from File, and Roster doesn't have it yet?
                        // If masterList came from file, and we selected it, we might need to create it.
                        Toast.error("El estudiante no existe en el sistema local.");
                        return;
                    }

                    if (!newRoster[studentName].studentInfo) newRoster[studentName].studentInfo = { nombres: "", apellidos: "", id: "", section: "", order: "" };
                    const sInfo = newRoster[studentName].studentInfo;
                    if (!sInfo.nombres) {
                        const parsed = ImportManager.parseStudentName(studentName);
                        sInfo.nombres = parsed.nombres;
                        sInfo.apellidos = parsed.apellidos;
                    }
                    // Extract Order
                    if (!sInfo.order && grades.order) sInfo.order = grades.order;

                    // Populate ID from Map (Fuzzy Match)
                    if (currentIdMap.size > 0 && grades.name) {
                        const matchedId = ExcelImport.findBestMatch(grades.name, currentIdMap);
                        if (matchedId) {
                            sInfo.id = matchedId;
                        }
                    }

                    const targetSub = newRoster[studentName].subjects[subjectIndex];
                    const currentGrade = parseInt(store.getState().grade);
                    const isSimpleLayout = (currentGrade <= 2);

                    if (isSimpleLayout) {
                        const mapSimple = (compIndex, values) => {
                            if (!values) return;
                            targetSub.competencies[compIndex].p1 = values[0];
                            targetSub.competencies[compIndex].p2 = values[1];
                            targetSub.competencies[compIndex].p3 = values[2];
                            targetSub.competencies[compIndex].p4 = values[3];
                        };
                        mapSimple(0, grades.c1);
                        mapSimple(1, grades.c2);
                        mapSimple(2, grades.c3);
                        if (grades.c4) mapSimple(3, grades.c4);
                        if (grades.c5) mapSimple(4, grades.c5);
                        if (grades.c6) mapSimple(5, grades.c6);
                        if (grades.c7) mapSimple(6, grades.c7);
                    } else {
                        // Grade 3+ Logic
                        targetSub.competencies[0].p1 = grades.c1[0]; targetSub.competencies[0].rp1 = grades.c1[1];
                        targetSub.competencies[0].p2 = grades.c1[2]; targetSub.competencies[0].rp2 = grades.c1[3];
                        targetSub.competencies[1].p1 = grades.c2[0]; targetSub.competencies[1].rp1 = grades.c2[1];
                        targetSub.competencies[1].p2 = grades.c2[2]; targetSub.competencies[1].rp2 = grades.c2[3];
                        targetSub.competencies[2].p1 = grades.c3[0]; targetSub.competencies[2].rp1 = grades.c3[1];
                        targetSub.competencies[2].p2 = grades.c3[2]; targetSub.competencies[2].rp2 = grades.c3[3];
                        if (grades.c4) { targetSub.competencies[3].p1 = grades.c4[0]; targetSub.competencies[3].rp1 = grades.c4[1]; targetSub.competencies[3].p2 = grades.c4[2]; targetSub.competencies[3].rp2 = grades.c4[3]; }
                        if (grades.c5) { targetSub.competencies[4].p1 = grades.c5[0]; targetSub.competencies[4].rp1 = grades.c5[1]; targetSub.competencies[4].p2 = grades.c5[2]; targetSub.competencies[4].rp2 = grades.c5[3]; }
                        if (grades.c6) { targetSub.competencies[5].p1 = grades.c6[0]; targetSub.competencies[5].rp1 = grades.c6[1]; targetSub.competencies[5].p2 = grades.c6[2]; targetSub.competencies[5].rp2 = grades.c6[3]; }
                        if (grades.c7) { targetSub.competencies[6].p1 = grades.c7[0]; targetSub.competencies[6].rp1 = grades.c7[1]; targetSub.competencies[6].p2 = grades.c7[2]; targetSub.competencies[6].rp2 = grades.c7[3]; }

                        // P3/P4
                        targetSub.competencies[0].p3 = grades.c1[4]; targetSub.competencies[0].rp3 = grades.c1[5];
                        targetSub.competencies[0].p4 = grades.c1[6]; targetSub.competencies[0].rp4 = grades.c1[7];
                        targetSub.competencies[1].p3 = grades.c2[4]; targetSub.competencies[1].rp3 = grades.c2[5];
                        targetSub.competencies[1].p4 = grades.c2[6]; targetSub.competencies[1].rp4 = grades.c2[7];
                        targetSub.competencies[2].p3 = grades.c3[4]; targetSub.competencies[2].rp3 = grades.c3[5];
                        targetSub.competencies[2].p4 = grades.c3[6]; targetSub.competencies[2].rp4 = grades.c3[7];
                        if (grades.c4) { targetSub.competencies[3].p3 = grades.c4[4]; targetSub.competencies[3].rp3 = grades.c4[5]; targetSub.competencies[3].p4 = grades.c4[6]; targetSub.competencies[3].rp4 = grades.c4[7]; }
                        if (grades.c5) { targetSub.competencies[4].p3 = grades.c5[4]; targetSub.competencies[4].rp3 = grades.c5[5]; targetSub.competencies[4].p4 = grades.c5[6]; targetSub.competencies[4].rp4 = grades.c5[7]; }
                        if (grades.c6) { targetSub.competencies[5].p3 = grades.c6[4]; targetSub.competencies[5].rp3 = grades.c6[5]; targetSub.competencies[5].p4 = grades.c6[6]; targetSub.competencies[5].rp4 = grades.c6[7]; }
                        if (grades.c7) { targetSub.competencies[6].p3 = grades.c7[4]; targetSub.competencies[6].rp3 = grades.c7[5]; targetSub.competencies[6].p4 = grades.c7[6]; targetSub.competencies[6].rp4 = grades.c7[7]; }
                    }

                    // Recovery
                    // Recovery
                    if (grades.recovery && Array.isArray(grades.recovery)) {
                        const validRec = grades.recovery.filter(r => r !== "" && r !== null && r !== undefined);
                        if (validRec.length > 0) targetSub.recovery = validRec.join(" / ");
                    }

                    // Map Finals (CF) & Competency Averages
                    if (grades.final !== undefined && grades.final !== "") {
                        targetSub.final = grades.final;
                    }
                    if (grades.compFinals && Array.isArray(grades.compFinals)) {
                        if (grades.compFinals[0]) targetSub.competencies[0].final = grades.compFinals[0];
                        if (grades.compFinals[1]) targetSub.competencies[1].final = grades.compFinals[1];
                        if (grades.compFinals[2]) targetSub.competencies[2].final = grades.compFinals[2];
                    }

                    // Save
                    store.setRoster(state.studentList, newRoster);
                    Toast.success(`Importado para: ${studentName}`);
                }
            });
            document.getElementById('importModal').classList.add('hidden');
            store.loadStudent(studentName); // Load the updated student
        }
    },


    // Helper: Parse Name/Surname with Heuristics
    parseStudentName: (rawName) => {
        if (!rawName) return { nombres: "", apellidos: "" };

        // 1. Clean parentheses
        const clean = rawName.replace(/\s*\(.*?\)\s*/g, '').trim();

        // 2. Check Comma (Explicit Separation)
        if (clean.includes(',')) {
            const p = clean.split(',');
            return { apellidos: p[0].trim(), nombres: p[1] ? p[1].trim() : "" };
        }

        // 3. Heuristic: Scan for 2 Surname Groups (Right-to-Left)
        const words = clean.split(/\s+/);
        if (words.length < 2) return { nombres: clean, apellidos: "" };
        if (words.length === 2) return { nombres: words[0], apellidos: words[1] }; // Name Surname

        const prefixes = ['de', 'del', 'la', 'las', 'los', 'san', 'santa', 'van', 'von', 'da', 'di', 'y'];

        const findGroupStart = (endIndex) => {
            let start = endIndex;
            while (start > 0) {
                const prev = words[start - 1].toLowerCase();
                if (prefixes.includes(prev)) {
                    start--;
                } else {
                    break;
                }
            }
            return start;
        };

        const g2End = words.length - 1;
        const g2Start = findGroupStart(g2End);

        let splitIndex = g2Start;
        if (g2Start > 0) {
            const g1End = g2Start - 1;
            const g1Start = findGroupStart(g1End);
            if (g1Start > 0) {
                splitIndex = g1Start;
            }
        }

        return {
            nombres: words.slice(0, splitIndex).join(' '),
            apellidos: words.slice(splitIndex).join(' ')
        };
    }
};

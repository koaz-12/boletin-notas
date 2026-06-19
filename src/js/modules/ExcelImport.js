/**
 * ExcelImport.js
 * Handles reading grades from Teacher Gradebook (Excel)
 */

export const ExcelImport = {
    // Configuration (Dynamic)
    activeConfig: null,

    // Default Simple Config (Grade 1-2)
    simpleConfig: {
        orderIndex: 0, nameIndex: 1, idIndex: 2,
        c1Range: [2, 3, 4, 5],
        c2Range: [6, 7, 8, 9],
        c3Range: [10, 11, 12, 13],
        // c4..c7 undefined for simple
        compFinals: [14, 15, 16], finalIndex: 17, recovery: [18, 19, 20, 21],
        startRow: 3
    },

    // Advanced Config (Grade 3-6) - 8 Cols per Comp (P1, RP1, P2, RP2, P3, RP3, P4, RP4)
    advancedConfig: {
        orderIndex: 0, nameIndex: 1, idIndex: 2,
        c1Range: [2, 3, 4, 5, 6, 7, 8, 9],
        c2Range: [10, 11, 12, 13, 14, 15, 16, 17],
        c3Range: [18, 19, 20, 21, 22, 23, 24, 25],
        compFinals: [26, 27, 28], // C1, C2, C3 Finals
        finalIndex: 29, // "Prom" (Average)
        finalRecoveryIndex: 30, // "C.F" (Final with Recovery)
        espIndex: 31, // "Esp" (Special Recovery)
        recovery: [], // Deprecated for Advanced
        startRow: 3
    },

    setMode: function (isAdvanced) {
        this.activeConfig = isAdvanced ? this.advancedConfig : this.simpleConfig;
    },

    getConfig: function () {
        return this.activeConfig || this.simpleConfig;
    },

    readWorkbook: function (file) {
        // ... (unchanged)
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    resolve(workbook);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    getSheets: function (workbook) {
        return workbook.SheetNames;
    },

    getRows: function (workbook, sheetName) {
        const sheet = workbook.Sheets[sheetName];
        return XLSX.utils.sheet_to_json(sheet, { header: 1 });
    },

    // --- TEMPLATE DETECTION ---
    detectTemplateType: function (workbook) {
        const datosSheet = workbook.Sheets["Datos"];
        if (!datosSheet) return 'legacy';

        // Convert Sheet to JSON (Array of Arrays) to scan structure
        const rows = XLSX.utils.sheet_to_json(datosSheet, { header: 1 });

        // Scan the first 10 columns for vertical keywords
        // Keywords: "Docente", "Centro Educativo", "Grado"
        let verticalScore = 0;
        for (let i = 0; i < Math.min(rows.length, 30); i++) {
            const row = rows[i];
            if (!row) continue;
            for (let c = 0; c < Math.min(row.length, 10); c++) {
                const cell = String(row[c] || "").trim().toLowerCase();
                if (cell.includes("docente")) verticalScore++;
                if (cell.includes("centro educativo")) verticalScore++;
                if (cell.includes("grado")) verticalScore++;
            }
        }

        if (verticalScore >= 2) return 'v2'; // High confidence it's the new vertical template
        return 'legacy'; // Default to legacy if "Datos" exists but lacks vertical structure
    },

    getStudents: async function (file) {
        const workbook = await this.readWorkbook(file);
        const type = this.detectTemplateType(workbook);
        console.log(`📊 ExcelImport: Detected Template Type: ${type}`);

        if (type === 'v2') {
            return this.parseNewTemplate(workbook);
        } else {
            return this.parseLegacyTemplate(workbook);
        }
    },

    // --- PARSERS ---

    parseLegacyTemplate: async function (workbook) {
        // Original Logic (Index-based from Config)
        // Usually reads first sheet or active sheet
        const targetSheet = workbook.SheetNames[0];
        const rows = this.getRows(workbook, targetSheet);
        const cfg = this.getConfig();

        const students = [];
        for (let i = cfg.startRow; i < rows.length; i++) {
            const row = rows[i];
            if (row && row[cfg.nameIndex]) {
                students.push({
                    index: i,
                    name: row[cfg.nameIndex]
                });
            }
        }
        return { workbook, students, rows, type: 'legacy' };
    },

    parseNewTemplate: async function (workbook) {
        const sheetName = "Datos";
        const rows = this.getRows(workbook, sheetName);
        const meta = {};

        // 1. Extract Metadata (Smart 2D Scanning)
        // Scan up to row 30, up to col 10 for keywords since user mentioned they are in Column D (index 3).
        for (let r = 0; r < Math.min(rows.length, 30); r++) {
            const row = rows[r];
            if (!row) continue;

            for (let c = 0; c < Math.min(row.length, 10); c++) {
                const cell = String(row[c] || "").trim().toLowerCase();
                if (!cell) continue;

                // Helper: GET value to the right first, then below
                const getValue = () => {
                    if (row[c + 1] !== undefined && String(row[c + 1]).trim() !== "") return String(row[c + 1]).trim();
                    if (rows[r + 1] && rows[r + 1][c] !== undefined && String(rows[r + 1][c]).trim() !== "") return String(rows[r + 1][c]).trim();
                    return "";
                };

                if (cell.includes("centro educativo")) meta.centro = getValue();
                if (cell.includes("docente")) meta.docente = getValue();
                if (cell.includes("sección") || cell.includes("seccion")) meta.seccion = getValue();
                if (cell.includes("año escolar")) meta.anio = getValue();

                if (cell === "tanda" || cell.includes("tanda:")) meta.tanda = getValue();

                if (cell.includes("grado")) {
                    meta.grado = getValue();

                    // User specified: "busque ene esa columna lapalabra grado y la casilla de abajo ahi estara tanda"
                    // If there's a cell directly below "grado", check if it's the tanda.
                    if (rows[r + 1] && rows[r + 1][c] !== undefined) {
                        const belowGrado = String(rows[r + 1][c]).trim();
                        if (belowGrado.toLowerCase().includes("matutin") || belowGrado.toLowerCase().includes("vespertin")) {
                            meta.tanda = belowGrado;
                        } else if (belowGrado.toLowerCase() === "tanda") {
                            // Label "tanda" is below "grado", so its value is to the right or below it
                            if (rows[r + 1][c + 1]) meta.tanda = String(rows[r + 1][c + 1]).trim();
                            else if (rows[r + 2] && rows[r + 2][c]) meta.tanda = String(rows[r + 2][c]).trim();
                        } else if (!meta.tanda) {
                            // Fallback: just store the cell below if tanda is still empty
                            meta.tanda = belowGrado;
                        }
                    }
                }
            }
        }

        console.log("📊 Metadata Detected:", meta);

        // 2. Find Student Table Headers
        // Look for row containing "Nombres" and "ID"
        let headerRowIndex = -1;
        let colName = -1, colID = -1, colNo = -1, colAtt = -1, colAbs = -1;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;

            // Scan columns in this row
            for (let c = 0; c < row.length; c++) {
                const val = String(row[c] || "").trim().toLowerCase();
                if (val.includes("nombre") || val.includes("estudiante") || val.includes("alumno") || val.includes("apellido") || val === "nombres y apellidos") colName = c;
                if (val === "id" || val.includes("id estudiante")) colID = c;
                if (val === "no." || val === "no" || val.includes("número") || val === "#") colNo = c;
                if (val.includes("asis")) colAtt = c;
                if (val.includes("aus") || val.includes("inasis")) colAbs = c;
            }

            // ID column is optional. The critical identifier is the Student Name column.
            if (colName !== -1) {
                headerRowIndex = i;
                
                // Extra scan: Scan ALL rows from 0 to headerRowIndex + 3 for attendance headers
                for (let rIdx = 0; rIdx <= i + 3; rIdx++) {
                    if (rIdx >= rows.length || !rows[rIdx]) continue;
                    for (let c = 0; c < rows[rIdx].length; c++) {
                        const val = String(rows[rIdx][c] || "").trim().toLowerCase();
                        if (colAtt === -1 && val.includes("asis")) colAtt = c;
                        if (colAbs === -1 && (val.includes("aus") || val.includes("inasis"))) colAbs = c;
                    }
                }
                
                break;
            }
        }

        const students = [];
        if (headerRowIndex !== -1) {
            // Start reading from next row
            for (let i = headerRowIndex + 1; i < rows.length; i++) {
                const row = rows[i];
                if (row && row[colName]) {
                    students.push({
                        index: i, // Index in the 'Datos' sheet
                        name: row[colName],
                        id: row[colID] || "",
                        no: colNo !== -1 ? row[colNo] : "",
                        attPct: colAtt !== -1 ? row[colAtt] : "",
                        absPct: colAbs !== -1 ? row[colAbs] : ""
                    });
                }
            }
        }

        return { workbook, students, rows, meta, type: 'v2' };
    },

    extractGrades: function (row) {
        if (!row) return null;
        const cfg = this.getConfig();

        const cleanVal = (val) => {
            if (val === undefined || val === null || val === '') return "";
            if (typeof val === 'number') {
                const rounded = Math.round(val);
                if (rounded < 0) return 0;
                if (rounded > 100) return 100; // Cap at 100
                return rounded;
            }

            const strVal = String(val).trim().toLowerCase();
            if (strVal === "") return "";
            // Handle specific text values if necessary (e.g. absent/excused -> 0 or empty)
            if (strVal.includes("aus") || strVal.includes("exc")) return "";

            const num = parseFloat(val);
            if (isNaN(num)) return ""; // Silently ignore text

            const rounded = Math.round(num);
            if (rounded < 0) return 0;
            if (rounded > 100) return 100;
            return rounded;
        };

        const getData = (indices) => indices ? indices.map(idx => cleanVal(row[idx])) : [];

        // Extract Name
        const nameVal = row[cfg.nameIndex];
        const studentName = (nameVal && typeof nameVal === 'string') ? nameVal.trim() : "";

        // Extract Order
        let orderVal = row[cfg.orderIndex];
        if (orderVal) orderVal = String(orderVal).trim();

        const result = {
            name: studentName,
            order: orderVal,
            c1: getData(cfg.c1Range),
            c2: getData(cfg.c2Range),
            c3: getData(cfg.c3Range),
            c4: getData(cfg.c4Range), // Added for Advanced
            c5: getData(cfg.c5Range),
            c6: getData(cfg.c6Range),
            c7: getData(cfg.c7Range),
            compFinals: getData(cfg.compFinals),
            final: cleanVal(row[cfg.finalIndex]),
            finalRecovery: cfg.finalRecoveryIndex ? cleanVal(row[cfg.finalRecoveryIndex]) : "",
            esp: cfg.espIndex ? cleanVal(row[cfg.espIndex]) : "",
            recovery: getData(cfg.recovery)
        };
        return result;
    },

    normalizeName: function (name) {
        if (!name || typeof name !== 'string') return "";
        return name
            .replace(/\s*\(.*?\)\s*/g, '')          // Remove content in parens
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove Accents
            .replace(/[^a-zA-Z0-9\s,]/g, '')        // Remove special chars (keep commas)
            .toLowerCase()
            .replace(/\s+/g, ' ')                   // Collapse spaces
            .trim();
    },

    extractIDs: function (rows) {
        const map = new Map();
        if (!rows || rows.length === 0) return map;
        const cfg = this.getConfig();

        // Scan from Row 1 (Index 1) to capture tops of list
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const name = row[cfg.nameIndex];
            const id = row[cfg.idIndex]; // Column C usually

            if (name && id) {
                const cleanName = this.normalizeName(name);
                const strId = String(id).trim();

                if (cleanName) {
                    map.set(cleanName, strId);

                    // 2. If Comma, Store Swapped (First Last)
                    if (cleanName.includes(',')) {
                        const parts = cleanName.split(',');
                        if (parts.length >= 2) {
                            const swapped = `${parts[1].trim()} ${parts[0].trim()}`;
                            map.set(swapped, strId);
                        }
                    }
                }
            }
        }
        return map;
    },

    levenshtein: function (a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = [];
        var i;
        for (i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        var j;
        for (j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (i = 1; i <= b.length; i++) {
            for (j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) == a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        Math.min(
                            matrix[i][j - 1] + 1,
                            matrix[i - 1][j] + 1
                        )
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    },

    findBestMatch: function (targetName, idMap) {
        const normalizedTarget = this.normalizeName(targetName);
        if (!normalizedTarget) return null;

        // 1. Try Exact
        if (idMap.has(normalizedTarget)) return idMap.get(normalizedTarget);

        // 2. Fuzzy Search
        let bestMatch = null;
        let bestDist = Infinity;

        // Dynamic Threshold based on length
        const maxDist = Math.max(3, Math.floor(normalizedTarget.length * 0.4));

        for (const [key, id] of idMap.entries()) {
            const dist = this.levenshtein(normalizedTarget, key);
            if (dist < bestDist && dist <= maxDist) {
                bestDist = dist;
                bestMatch = id;
            }
        }

        return bestMatch;
    }
};

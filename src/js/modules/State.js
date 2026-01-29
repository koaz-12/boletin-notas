/**
 * State.js
 * State Management for the application
 */

import { CoreUtils } from './CoreUtils.js';



// --- SECTION MANAGER (Handles the "Index" of sections) ---
class SectionManager {
    constructor() {
        this.sections = this.loadSections(); // [{id, name, grade, shift}]
        this.currentSectionId = localStorage.getItem('minerd_current_section_id') || null;
    }

    loadSections() {
        try {
            return JSON.parse(localStorage.getItem('minerd_sections_index')) || [];
        } catch (e) {
            return [];
        }
    }

    saveSections() {
        localStorage.setItem('minerd_sections_index', JSON.stringify(this.sections));
    }

    createSection(name, grade, shift) {
        const newSection = {
            id: 'sec_' + Date.now(),
            name: name || 'Nueva Sección',
            grade: grade || '1',
            shift: shift || 'Matutina',
            createdAt: Date.now()
        };
        this.sections.push(newSection);
        this.saveSections();
        return newSection;
    }

    deleteSection(id) {
        this.sections = this.sections.filter(s => s.id !== id);
        this.saveSections();
        // Also remove the data for this section
        localStorage.removeItem('minerd_data_' + id);

        if (this.currentSectionId === id) {
            this.currentSectionId = this.sections.length > 0 ? this.sections[0].id : null;
            localStorage.setItem('minerd_current_section_id', this.currentSectionId || '');
        }
    }

    setCurrent(id) {
        this.currentSectionId = id;
        localStorage.setItem('minerd_current_section_id', id);
    }

    getCurrent() {
        return this.sections.find(s => s.id === this.currentSectionId) || null;
    }
}

export const sectionManager = new SectionManager();

// --- APP STATE (Handles the Data of the CURRENT Section) ---
export class AppState {
    constructor() {
        this.resetState(); // Initialize with defaults
        this.listeners = [];
        this.gradeConfig = this.getGradeConfig();

        // Debounced save
        this.debouncedSave = CoreUtils.debounce(() => this.saveToLocalStorage(), 1000);
    }

    init() {
        // Bootstrap Migration Check
        if (sectionManager.sections.length === 0) {
            this.performLegacyMigration();
        }

        this.loadFromLocalStorage();
    }

    performLegacyMigration(force = false) {
        const legacy = localStorage.getItem('minerd_boletin_data');
        if (!legacy) {
            if (force) {
                alert("No se encontraron datos de la Versión 1 en este navegador.");
            }
            return false;
        }

        if (force && !confirm("Se creará una nueva sección 'Recuperado' con los datos de la v1.\n\n¿Continuar?")) return;

        console.log("🚀 Legacy Migration Started...");

        const newSec = sectionManager.createSection("Recuperado", "1", "Matutina");
        sectionManager.setCurrent(newSec.id);

        try {
            const legacyState = JSON.parse(legacy);
            const v2Data = {
                version: 2,
                timestamp: Date.now(),
                state: legacyState
            };
            localStorage.setItem('minerd_data_' + newSec.id, JSON.stringify(v2Data));
            console.log("✅ Legacy Data Migrated to Section: " + newSec.id);
            window.location.reload();
            return true;
        } catch (e) {
            console.error("Migration Failed:", e);
            if (force) alert("Error: Datos V1 corruptos.");
            return false;
        }
    }

    resetState() {
        // Try to load school defaults
        let schoolDefaults = {};
        try {
            schoolDefaults = JSON.parse(localStorage.getItem('minerd_default_school_data') || '{}');
        } catch (e) { }

        this.state = {
            grade: "1",
            subjects: [],
            settings: {
                isOverlayMode: true,
                isEditMode: false,
                fontSize: 14,
                alignP1: 'left',
                alignP2G: 'center',
                alignP2O: 'left'
            },
            observations: { p1: "", p2: "", p3: "", p4: "" },
            attendance: {
                p1: { pres: "", abs: "", perc: "", perc_abs: "" },
                p2: { pres: "", abs: "", perc: "", perc_abs: "" },
                p3: { pres: "", abs: "", perc: "", perc_abs: "" },
                p4: { pres: "", abs: "", perc: "", perc_abs: "" },
                total: { pres: "", abs: "", perc: "", perc_abs: "" }
            },
            studentStatus: { promoted: "", postponed: "", repeater: "" },
            finalCondition: "",
            roster: {},
            studentList: [],
            currentStudent: "Estudiante 1",
            schoolData: {
                centro: schoolDefaults.centro || "",
                codigo: schoolDefaults.codigo || "",
                tanda: "",
                telefono: "",
                regional: schoolDefaults.regional || "",
                distrito: schoolDefaults.distrito || "",
                provincia: "",
                municipio: "",
                section: ""
            },
            studentInfo: { nombres: "", apellidos: "", id: "", order: "", obsGeneral: "" },
            trashBin: [] // New: Soft Delete Storage
        };
    }

    // --- RECYCLE BIN ---
    moveToTrash(studentName) {
        if (!this.state.roster[studentName]) return false;

        const studentData = JSON.parse(JSON.stringify(this.state.roster[studentName]));

        const trashItem = {
            deletedAt: Date.now(),
            name: studentName,
            originalData: studentData,
            originalSection: this.state.schoolData.section
        };

        // Initialize trashBin if missing (legacy state)
        if (!this.state.trashBin) this.state.trashBin = [];

        this.state.trashBin.push(trashItem);
        // We call deleteStudent logic internally but we don't have it exposed as a method 
        // that skips the prompt here. Usually deleteStudent is in StudentManager.
        // We need to manipulate the state directly here.

        delete this.state.roster[studentName];
        this.state.studentList = this.state.studentList.filter(n => n !== studentName);

        // Reset current if we deleted the current one
        if (this.state.currentStudent === studentName) {
            this.state.currentStudent = this.state.studentList.length > 0 ? this.state.studentList[0] : "";
        }

        this.saveCurrentStudent(); // Save State
        this.notify();
        return true;
    }

    restoreFromTrash(deletedAt) {
        if (!this.state.trashBin) return false;

        const index = this.state.trashBin.findIndex(item => item.deletedAt === deletedAt);
        if (index === -1) return false;

        const item = this.state.trashBin[index];
        let nameToRestore = item.name;

        // Collision Check
        let counter = 1;
        while (this.state.studentList.includes(nameToRestore)) {
            nameToRestore = `${item.name} (${counter})`;
            counter++;
        }

        // Restore
        this.state.roster[nameToRestore] = item.originalData;

        // Ensure studentInfo name matches restored name
        if (this.state.roster[nameToRestore].studentInfo) {
            // Optional: Update internal name if renamed due to collision?
            // Usually better to keep original info
        }

        this.state.studentList.push(nameToRestore);
        this.state.trashBin.splice(index, 1);

        this.state.studentList.sort((a, b) => a.localeCompare(b));
        this.saveCurrentStudent();
        this.notify();
        return nameToRestore;
    }

    emptyTrash() {
        this.state.trashBin = [];
        this.saveCurrentStudent();
        this.notify();
    }


    getGradeConfig() {
        const lowerPrimary = [
            "Lengua Española", "Matemática", "Ciencias Sociales", "Ciencias de la Naturaleza",
            "Educación Física", "Formación Integral, Humana y Religiosa", "Educación Artística"
        ];
        const upperPrimary = [
            "Lengua Española", "Matemática", "Ciencias Sociales", "Ciencias de la Naturaleza",
            "Lenguas Extranjeras (Inglés)", "Educación Física", "Formación Integral, Humana y Religiosa", "Educación Artística"
        ];
        return {
            "1": [...lowerPrimary], "2": [...lowerPrimary],
            "3": [...lowerPrimary], "4": [...upperPrimary],
            "5": [...upperPrimary], "6": [...upperPrimary]
        };
    }

    async init() {
        // 1. Check if we have sections
        if (sectionManager.sections.length === 0) {
            // First run ever? Create default section
            const defSec = sectionManager.createSection("Sección A", "1", "Matutina");
            sectionManager.setCurrent(defSec.id);
        } else if (!sectionManager.currentSectionId) {
            sectionManager.setCurrent(sectionManager.sections[0].id);
        }

        // 2. Load data for the current section
        const loaded = this.loadFromLocalStorage();
        if (!loaded) {
            console.log("New section data initialized");
            this.loadSubjectsForGrade(this.state.grade);
            this.saveCurrentStudent();
        } else {
            console.log("Section data loaded");
        }

        // 3. Sync initial Section Metadata into State
        const currentSecMeta = sectionManager.getCurrent();
        if (currentSecMeta) {
            this.state.grade = currentSecMeta.grade;
            this.state.schoolData.tanda = currentSecMeta.shift;
            this.state.schoolData.section = currentSecMeta.name; // Keep name in sync
        }
    }

    // --- SWITCH SECTION ---
    switchSection(sectionId) {
        // 1. Force save current
        this.saveToLocalStorage();

        // 2. Change Context
        sectionManager.setCurrent(sectionId);

        // 3. Reset State & Load New
        this.resetState();
        if (!this.loadFromLocalStorage()) {
            // New section defaults
            const meta = sectionManager.getCurrent();
            if (meta) {
                this.state.grade = meta.grade;
                this.loadSubjectsForGrade(meta.grade);
            }
            this.saveCurrentStudent();
        }

        this.notify();
    }

    // --- CRUD WRAPPERS ---
    createNewSectionInternal(name, grade, shift) {
        const newSec = sectionManager.createSection(name, grade, shift);
        this.switchSection(newSec.id);
    }

    deleteSectionInternal(id) {
        if (sectionManager.sections.length <= 1) {
            alert("No puedes eliminar la última sección.");
            return;
        }
        if (confirm("¿Seguro de borrar esta sección y TODOS sus datos?")) {
            sectionManager.deleteSection(id);
            // Reload current (which changed inside deleteSection if we deleted the active one)
            this.switchSection(sectionManager.currentSectionId);
        }
    }

    getState() { return this.state; }

    setGrade(grade) {
        if (this.state.grade === grade) return;
        this.state.grade = grade;
        this.loadSubjectsForGrade(grade);

        // Update Section Metadata too
        const cur = sectionManager.getCurrent();
        if (cur) {
            cur.grade = grade;
            sectionManager.saveSections(); // Persist metadata change
        }

        this.notify();
    }

    loadSubjectsForGrade(grade) {
        const names = this.gradeConfig[grade] || this.gradeConfig["1"];
        this.state.subjects = names.map(name => ({
            name: name,
            final: "", recovery: "", final_recovery: "", special_recovery: "",
            competencies: [
                { name: "C1", p1: "", rp1: "", p2: "", rp2: "", p3: "", rp3: "", p4: "", rp4: "", final: "", recovery: "" },
                { name: "C2", p1: "", rp1: "", p2: "", rp2: "", p3: "", rp3: "", p4: "", rp4: "", final: "", recovery: "" },
                { name: "C3", p1: "", rp1: "", p2: "", rp2: "", p3: "", rp3: "", p4: "", rp4: "", final: "", recovery: "" }
            ]
        }));
    }

    updateGrade(subIndex, compIndex, field, value) {
        const sub = this.state.subjects[subIndex];
        if (!sub) return;
        if (compIndex >= 0) sub.competencies[compIndex][field] = value;
        else sub[field] = value;
        this.saveCurrentStudent();
        this.notify();
    }

    updateObservation(period, value) {
        this.state.observations[period] = value;
        this.saveCurrentStudent();
        this.notify();
    }

    updateAttendance(period, field, value) {
        if (!this.state.attendance[period]) this.state.attendance[period] = {};
        this.state.attendance[period][field] = value;
        this.saveCurrentStudent();
        this.notify();
    }

    updateStudentStatus(field, value) {
        if (!this.state.studentStatus) this.state.studentStatus = { promoted: "", postponed: "", repeater: "" };
        this.state.studentStatus[field] = value;
        this.saveCurrentStudent();
        this.notify();
    }

    updateFinalCondition(value) {
        this.state.finalCondition = value;
        this.saveCurrentStudent();
        this.notify();
    }

    updateSettings(newSettings) {
        this.state.settings = { ...this.state.settings, ...newSettings };
        this.notify();
    }

    updateSchoolData(field, value) {
        if (!this.state.schoolData) this.state.schoolData = {};
        this.state.schoolData[field] = value;

        // Sync back to Section Metadata if applicable
        if (field === 'tanda') {
            const cur = sectionManager.getCurrent();
            if (cur) { cur.shift = value; sectionManager.saveSections(); }
        }

        this.notify(); // Force UI Update (Tabs, etc)
        this.debouncedSave();
    }

    updateStudentInfo(field, value) {
        if (!this.state.studentInfo) this.state.studentInfo = {};
        this.state.studentInfo[field] = value;
        this.saveCurrentStudent();
        this.notify();
    }

    // --- ROSTER LOGIC ---
    saveCurrentStudent() {
        const s = this.state;
        if (!s.currentStudent) return;

        s.roster[s.currentStudent] = {
            subjects: JSON.parse(JSON.stringify(s.subjects)),
            attendance: JSON.parse(JSON.stringify(s.attendance)),
            observations: JSON.parse(JSON.stringify(s.observations)),
            studentStatus: JSON.parse(JSON.stringify(s.studentStatus || {})),
            finalCondition: s.finalCondition || "",
            studentInfo: JSON.parse(JSON.stringify(s.studentInfo || {})),
            grade: s.grade
        };

        if (!s.studentList.includes(s.currentStudent)) {
            s.studentList.push(s.currentStudent);
        }
    }

    loadStudent(name, saveCurrent = true) {
        if (saveCurrent) this.saveCurrentStudent();
        this.state.currentStudent = name;
        const data = this.state.roster[name];

        if (data) {
            // Restore from Roster
            if (data.grade) this.state.grade = parseInt(data.grade);
            this.state.subjects = JSON.parse(JSON.stringify(data.subjects));
            this.state.attendance = JSON.parse(JSON.stringify(data.attendance));
            if (!this.state.attendance.total) this.state.attendance.total = { pres: "", abs: "", perc: "", perc_abs: "" };
            this.state.observations = JSON.parse(JSON.stringify(data.observations));
            this.state.studentStatus = JSON.parse(JSON.stringify(data.studentStatus || {}));
            this.state.finalCondition = data.finalCondition || "";
            this.state.studentInfo = JSON.parse(JSON.stringify(data.studentInfo || {}));
            if (!this.state.studentInfo.obsGeneral) this.state.studentInfo.obsGeneral = "";
        } else {
            // New Student / Reset
            this.loadSubjectsForGrade(this.state.grade);
            this.state.attendance = {
                p1: { pres: "", abs: "", perc: "", perc_abs: "" },
                p2: { pres: "", abs: "", perc: "", perc_abs: "" },
                p3: { pres: "", abs: "", perc: "", perc_abs: "" },
                p4: { pres: "", abs: "", perc: "", perc_abs: "" },
                total: { pres: "", abs: "", perc: "", perc_abs: "" }
            };
            this.state.observations = { p1: "", p2: "", p3: "", p4: "" };
            this.state.studentStatus = { promoted: "", postponed: "", repeater: "" };
            this.state.finalCondition = "";
            this.state.studentInfo = { nombres: "", apellidos: "", id: "", order: "", obsGeneral: "" };
            this.saveCurrentStudent();
        }
        this.notify();
    }

    deleteStudent(name) {
        if (this.state.roster[name]) delete this.state.roster[name];
        this.state.studentList = this.state.studentList.filter(s => s !== name);
        let next = this.state.studentList.length > 0 ? this.state.studentList[0] : "Estudiante 1";
        this.loadStudent(next, false);
    }

    setRoster(list, rosterData) {
        this.state.studentList = list;
        this.state.roster = rosterData;
        if (list.length > 0) this.loadStudent(list[0], false);
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => { this.listeners = this.listeners.filter(l => l !== listener); };
    }

    notify() {
        this.listeners.forEach(listener => listener(this.state));
        this.debouncedSave();
    }

    // --- PERSISTENCE (Dynamic Keys) ---
    saveToLocalStorage() {
        try {
            const currentId = sectionManager.currentSectionId;
            if (!currentId) return;

            const data = JSON.stringify({
                version: 2, // Bump version
                timestamp: Date.now(),
                state: this.state
            });
            // SAVE TO SPECIFIC KEY
            const key = 'minerd_data_' + currentId;
            localStorage.setItem(key, data);

            console.log(`[AutoSave] Data saved to ${key}`);
        } catch (e) {
            console.error("[AutoSave] Error saving data:", e);
        }
    }

    loadFromLocalStorage() {
        try {
            const currentId = sectionManager.currentSectionId;
            if (!currentId) return false;

            const key = 'minerd_data_' + currentId;
            const json = localStorage.getItem(key);

            // Fallback: If no new data, try legacy and migrate
            if (!json) {
                return false;
            }

            const data = JSON.parse(json);
            if (data && data.state) {
                this.state = { ...this.state, ...data.state };
                // Ensure Arrays
                if (!this.state.studentList) this.state.studentList = [];
                // Re-hydrate grade config if upgrading
                if (!this.state.grade) this.state.grade = "1";
                return true;
            }
            return false;
        } catch (e) {
            console.error("[AutoSave] Error loading data:", e);
            return false;
        }
    }

    clearLocalStorage() {
        // Only clear CURRENT section
        const currentId = sectionManager.currentSectionId;
        if (currentId) {
            localStorage.removeItem('minerd_data_' + currentId);
            location.reload();
        }
    }

    // --- CLOUD / BACKUP HELPERS ---
    exportFullBackup() {
        const sections = sectionManager.loadSections();
        const backup = {
            version: 2,
            timestamp: Date.now(),
            sections: sections,
            data: {},
            // Export Global Settings
            settings: {
                theme: localStorage.getItem('minerd_theme'),
                schoolDefaults: localStorage.getItem('minerd_default_school_data'),
                commentBank: localStorage.getItem('minerd_comment_bank'),
                obsSettings: localStorage.getItem('obs_settings')
            }
        };

        // Gather all section data
        sections.forEach(sec => {
            const key = 'minerd_data_' + sec.id;
            const item = localStorage.getItem(key);
            if (item) {
                try {
                    backup.data[sec.id] = JSON.parse(item);
                } catch (e) {
                    console.warn("Corrupt data for section " + sec.id);
                }
            }
        });

        return backup;
    }

    importFullBackup(backupObj) {
        if (!backupObj) return false;

        // Legacy Support (Migration V1 -> V2)
        if (!backupObj.sections && (backupObj.studentList || backupObj.roster)) {
            console.log("⚠️ Old Backup Format Detected. Migrating...");

            // Fix: Reconstruct studentList if missing (Common in V1 backups)
            if (!backupObj.studentList && backupObj.roster) {
                backupObj.studentList = Object.keys(backupObj.roster);
            }

            // Construct a virtual V2 structure
            const currentId = sectionManager.currentSectionId || Date.now().toString();

            // Ensure Section Exists OR Update Name
            let currentSec = sectionManager.sections.find(s => s.id === currentId);
            if (!currentSec) {
                currentSec = { id: currentId, name: "Importado (V1)", grade: backupObj.grade ? String(backupObj.grade) : "1" };
                sectionManager.sections.push(currentSec);
            } else {
                // Force rename to mark as imported (critical for sync protection)
                currentSec.name = "Importado (V1)";
            }
            localStorage.setItem('minerd_sections_index', JSON.stringify(sectionManager.sections));
            sectionManager.setCurrent(currentId);

            // Validate Data Structure before saving
            // V2 Expects wrapper: { version: 2, state: { ... } }
            const v2Data = {
                version: 2,
                // Add 10 seconds offset to GUARANTEE being "newer" than any recent cloud sync
                timestamp: Date.now() + 10000,
                state: backupObj
            };

            localStorage.setItem('minerd_data_' + currentSec.id, JSON.stringify(v2Data));

            // === IMPORT LOCK: Prevent Cloud Sync from Overwriting ===
            localStorage.setItem('minerd_import_lock', Date.now().toString());
            console.log("🔒 Import Lock Set. Cloud Sync will respect this.");

            // Reload
            window.location.reload();
            return true;
        }

        if (!backupObj.sections) return false;

        try {
            // 1. Restore Sections Index
            localStorage.setItem('minerd_sections_index', JSON.stringify(backupObj.sections));
            sectionManager.sections = sectionManager.loadSections(); // Refresh manager

            // 2. Restore Data
            if (backupObj.data) {
                Object.keys(backupObj.data).forEach(secId => {
                    const content = backupObj.data[secId];
                    localStorage.setItem('minerd_data_' + secId, JSON.stringify(content));
                });
            }

            // 2.5 Restore Global Settings
            if (backupObj.settings) {
                if (backupObj.settings.theme) localStorage.setItem('minerd_theme', backupObj.settings.theme);
                if (backupObj.settings.schoolDefaults) localStorage.setItem('minerd_default_school_data', backupObj.settings.schoolDefaults);
                if (backupObj.settings.commentBank) localStorage.setItem('minerd_comment_bank', backupObj.settings.commentBank);
                if (backupObj.settings.obsSettings) localStorage.setItem('obs_settings', backupObj.settings.obsSettings);

                // Notify modules to hot-reload settings
                window.dispatchEvent(new Event('minerd:settings-restored'));
            }

            // 3. Hot Reload State
            // If we have sections, switch to the first one or keep current if exists
            let targetId = sectionManager.currentSectionId;
            if (!sectionManager.sections.find(s => s.id === targetId)) {
                targetId = sectionManager.sections.length > 0 ? sectionManager.sections[0].id : null;
            }

            if (targetId) {
                sectionManager.setCurrent(targetId);
                this.resetState();
                if (this.loadFromLocalStorage()) {
                    // Loaded successfully
                }
                this.notify(); // Re-render everything
            }

            return true;
        } catch (e) {
            console.error("Import Failed:", e);
            return false;
        }
    }
}

export const store = new AppState();

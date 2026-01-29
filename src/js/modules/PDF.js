/**
 * PDF.js
 * PDF Loading, Rendering and Batch Export
 */

import { AppUI } from './AppUI.js';
import { store } from './State.js';
import { Toast } from './Toast.js';

export const PDFManager = {
    pdfDoc: null,

    init: function () {
        // Set worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    },

    // New: Auto-load Template (Embedded Base64)
    loadTemplate: async function (grade) {
        console.log(`Cargando plantilla embebida para Grado ${grade}...`);
        const isLoginVisible = !document.getElementById('login-overlay')?.classList.contains('hidden');

        try {
            // Import Templates Dynamically
            // Assumes src/js/config/Templates.js exists and exports GradeTemplates
            const { GradeTemplates } = await import('../config/Templates.js');
            const dataURI = GradeTemplates[grade];

            if (!dataURI) {
                // Not found silently, or warn? 
                console.warn(`No template found for grade ${grade} in registry.`);
                return;
            }

            // Convert Base64 DataURI to Uint8Array for PDF.js
            const pdfData = this.base64ToUint8Array(dataURI);

            // Process directly
            // reuse logic but avoid double overlay toggle if already active?
            const loadingTask = pdfjsLib.getDocument(pdfData);
            this.pdfDoc = await loadingTask.promise;
            this.renderPages();

            // SUCCESS UI
            store.updateSettings({ isOverlayMode: true });
            AppUI.toggleOverlayClass(true);
            const btn = document.getElementById('btnFloatOverlay');
            if (btn) {
                btn.classList.add('bg-blue-600', 'text-white', 'ring-4', 'ring-blue-300');
                btn.classList.remove('bg-white', 'text-blue-600', 'border-blue-700');
            }
            if (!isLoginVisible) {
                Toast.success(`Plantilla de ${grade}º Grado cargada (Embebida).`);
            }

        } catch (e) {
            console.warn("Fallo carga plantilla embebida:", e);
            if (e.message.includes('Módulo')) {
                Toast.error("Error: Archivo Templates.js no generado. Ejecuta script Python.");
            } else {
                Toast.warning(`No se encontró plantilla embebida para ${grade}º Grado.`);
            }
        }
    },

    // Helper: DataURI to Uint8Array
    base64ToUint8Array: function (dataURI) {
        const base64Marker = ';base64,';
        const base64Index = dataURI.indexOf(base64Marker) + base64Marker.length;
        const base64 = dataURI.substring(base64Index);
        const raw = window.atob(base64);
        const rawLength = raw.length;
        const array = new Uint8Array(new ArrayBuffer(rawLength));

        for (let i = 0; i < rawLength; i++) {
            array[i] = raw.charCodeAt(i);
        }
        return array;
    },

    handleUpload: async function (input) {
        const file = input.files[0];
        if (!file || file.type !== 'application/pdf') {
            Toast.warning('Por favor, sube un archivo PDF válido.');
            return;
        }
        await this.processManualFile(file);
    },

    processManualFile: async function (file) {
        const fileReader = new FileReader();
        fileReader.onload = async (e) => {
            const typedarray = new Uint8Array(e.target.result);
            try {
                const loadingTask = pdfjsLib.getDocument(typedarray);
                this.pdfDoc = await loadingTask.promise;
                this.renderPages();

                // UI Updates
                store.updateSettings({ isOverlayMode: true });
                AppUI.toggleOverlayClass(true);
                const btn = document.getElementById('btnFloatOverlay');
                if (btn) {
                    btn.classList.add('bg-blue-600', 'text-white', 'ring-4', 'ring-blue-300');
                    btn.classList.remove('bg-white', 'text-blue-600', 'border-blue-700');
                }
                Toast.success("PDF personalizado cargado.");
            } catch (error) {
                console.error('Error procesando PDF Manual:', error);
                Toast.error('Error al procesar el PDF.');
            }
        };
        fileReader.readAsArrayBuffer(file);
    },

    renderPages: async function () {
        if (!this.pdfDoc) return;
        if (this.pdfDoc.numPages >= 1) await this.renderPage(1, 'canvas-page-1');
        if (this.pdfDoc.numPages >= 2) {
            document.getElementById('page-2').classList.remove('hidden');
            await this.renderPage(2, 'canvas-page-2');
        }
    },

    renderPage: async function (pageNumber, canvasId) {
        const page = await this.pdfDoc.getPage(pageNumber);
        const canvas = document.getElementById(canvasId);
        const context = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: 2.0 });

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = '100%';
        canvas.style.height = '100%';

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
    },

    // Batch PDF Generation
    generateBatchPDF: function () {
        const state = store.getState();
        const students = state.studentList;

        if (students.length === 0) {
            Toast.warning("No hay estudiantes para imprimir.");
            return;
        }

        AppUI.confirm(
            "Imprimir Boletines",
            `Se generará un PDF con los boletines de ${students.length} estudiantes.\nEsto puede tardar unos segundos.\n\nAsegúrese de activar "Gráficos de fondo" en la ventana de impresión.`,
            () => {
                // Save current student to restore later
                const initialStudent = state.currentStudent;

                // Prep UI
                const reportContainer = document.querySelector('#report-container'); // The visible one
                const batchContainer = document.createElement('div');
                batchContainer.id = 'batch-print-container';
                batchContainer.className = 'print-only'; // Ensure CSS only shows this

                // Hide main container
                reportContainer.classList.add('hidden');
                document.body.appendChild(batchContainer);

                try {
                    // Loop students
                    students.forEach(studentName => {
                        store.loadStudent(studentName); // Updates DOM (sync?)

                        // CLONE the pages
                        const p1 = document.getElementById('page-1');
                        const p2 = document.getElementById('page-2');

                        // Clone Deep
                        const c1 = p1.cloneNode(true);
                        const c2 = p2.cloneNode(true);

                        // FIX: Manually copy Canvas content (cloneNode doesn't copy canvas bitmap)
                        const copyCanvas = (srcParent, destParent) => {
                            const srcCan = srcParent.querySelector('canvas');
                            const destCan = destParent.querySelector('canvas');
                            if (srcCan && destCan) {
                                const ctx = destCan.getContext('2d');
                                ctx.drawImage(srcCan, 0, 0);
                            }
                        };
                        copyCanvas(p1, c1);
                        copyCanvas(p2, c2);

                        // Add Page Breaks
                        c1.style.breakAfter = 'always'; // Force break after Page 1
                        c1.style.pageBreakAfter = 'always';

                        c2.style.breakAfter = 'always'; // Force break after Page 2 (Student End)
                        c2.style.pageBreakAfter = 'always';

                        // Force Show Clones (if hidden)
                        c1.classList.remove('hidden');
                        c2.classList.remove('hidden');

                        // Append
                        batchContainer.appendChild(c1);
                        batchContainer.appendChild(c2);
                    });

                    // Trigger Print
                    window.print();

                } catch (e) {
                    console.error(e);
                    Toast.error("Error generando PDF masivo: " + e.message);
                } finally {
                    // Restore
                    batchContainer.remove();
                    reportContainer.classList.remove('hidden');
                    if (initialStudent) store.loadStudent(initialStudent);
                }
            }
        );
    },

    // Zip Individual Export
    generateBatchZip: function () {
        if (typeof JSZip === 'undefined') {
            Toast.error("Error: Librería JSZip no cargada.");
            return;
        }

        const state = store.getState();
        const students = state.studentList;

        if (students.length === 0) {
            Toast.warning("No hay estudiantes para exportar.");
            return;
        }

        AppUI.confirm(
            "Exportación Masiva (ZIP)",
            `Se generarán ${students.length} archivos PDF comprimidos en un ZIP.\n\nEste proceso puede tardar unos minutos.`,
            async () => {
                // UI Elements
                const modal = document.getElementById('progressModal');
                const pBar = document.getElementById('progressBar');
                const pText = document.getElementById('progressPercent');
                const pStatus = document.getElementById('progressStatus');
                const btnCancel = document.getElementById('btnCancelZip');

                // Reset & Show Modal
                this.isZipCancelled = false;
                modal.classList.remove('hidden');
                pBar.style.width = '0%';
                pText.innerText = '0%';
                pStatus.innerText = 'Iniciando...';

                // Cancel Handler
                const cancelHandler = () => {
                    this.isZipCancelled = true;
                    pStatus.innerText = 'Cancelando...';
                    btnCancel.disabled = true;
                };
                btnCancel.onclick = cancelHandler;
                btnCancel.disabled = false;


                const zip = new JSZip();
                const initialStudent = state.currentStudent;

                try {
                    const container = document.getElementById('report-container');

                    // Hide visual labels for clean capture
                    const labels = container.querySelectorAll('h3');
                    labels.forEach(l => l.style.display = 'none');

                    // Strip UI classes (Shadows, Margins, Borders) from Pages
                    // to ensure exact A4 dimensions (297mm x 210mm) without gutters
                    const pages = container.querySelectorAll('.a4-page');
                    pages.forEach(p => {
                        p.classList.remove('shadow-lg', 'mb-8', 'border', 'border-gray-400');
                        p.dataset.originalMargin = p.style.margin; // Backup
                        p.dataset.originalHeight = p.style.height; // Backup

                        // Force Landscape Fit
                        p.style.margin = '0';
                        p.style.boxShadow = 'none';
                        // Reduce height slightly to prevent spillover (210mm -> 209.5mm)
                        p.style.height = '209.5mm';
                        p.style.overflow = 'hidden'; // Clip any tiny excess
                    });

                    // Ensure visual fidelity (Landscape A4)
                    container.style.width = '297mm';
                    container.style.padding = '0';
                    container.style.margin = '0';

                    // Determine Filename Format
                    const settings = store.getState().settings || {};
                    const format = settings.pdfNameFormat || 'default';

                    // Loop sequentially
                    for (let i = 0; i < students.length; i++) {
                        if (this.isZipCancelled) throw new Error("Operación cancelada por el usuario.");

                        const studentName = students[i];
                        store.loadStudent(studentName);

                        // Wait for render
                        await new Promise(resolve => setTimeout(resolve, 300));

                        // Determine Filename
                        const info = store.getState().studentInfo || {};
                        let finalName = studentName;
                        if (format === 'lastname' && info.apellidos && info.nombres) {
                            finalName = `${info.apellidos} ${info.nombres}`;
                        } else if (format === 'order' && info.order) {
                            const fullName = `${info.nombres || ''} ${info.apellidos || ''}`.trim() || studentName;
                            finalName = `${info.order} - ${fullName}`;
                        }

                        // Sanitize
                        // 1. Remove text in parentheses (e.g. "Name (Nuevo)" -> "Name")
                        finalName = finalName.replace(/\s*\(.*?\)/g, '');

                        // 2. Remove invalid chars
                        finalName = finalName.replace(/[\/\\?%*:|"<>]/g, '-').trim() || "SinNombre";
                        const filename = `${finalName}.pdf`;

                        // Config PDF (Landscape)
                        const opts = {
                            margin: 0,
                            filename: filename,
                            image: { type: 'jpeg', quality: 0.95 },
                            html2canvas: { scale: 1.5, useCORS: true, scrollY: 0 },
                            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
                            pagebreak: { mode: 'css', after: '.a4-page' }
                        };

                        // Generate Blob
                        const blob = await html2pdf().set(opts).from(container).output('blob');
                        zip.file(filename, blob);

                        // Update Progress
                        const percent = Math.round(((i + 1) / students.length) * 100);
                        pBar.style.width = `${percent}%`;
                        pText.innerText = `${percent}%`;
                        pStatus.innerText = `Procesando: ${filename} (${i + 1}/${students.length})`;
                    }

                    if (this.isZipCancelled) return; // Should be caught by catch but double check

                    pStatus.innerText = "Comprimiendo archivo ZIP (esto puede tardar)...";
                    await new Promise(resolve => setTimeout(resolve, 100)); // Render update

                    const content = await zip.generateAsync({ type: "blob" });
                    saveAs(content, `Boletines_Lote_${new Date().toISOString().slice(0, 10)}.zip`);

                    Toast.success("¡Exportación completada!");
                    // Close Modal
                    setTimeout(() => modal.classList.add('hidden'), 1000);

                } catch (e) {
                    console.error(e);
                    if (e.message.includes("cancelada")) {
                        Toast.info("Exportación cancelada.");
                    } else {
                        Toast.error("Error: " + e.message);
                    }
                    modal.classList.add('hidden'); // Close on error immediately
                } finally {
                    // Restore
                    const container = document.getElementById('report-container');
                    if (container) {
                        const labels = container.querySelectorAll('h3');
                        labels.forEach(l => l.style.display = '');

                        // Restore UI Classes
                        const pages = container.querySelectorAll('.a4-page');
                        pages.forEach(p => {
                            p.classList.add('shadow-lg', 'mb-8', 'border', 'border-gray-400');
                            p.style.margin = p.dataset.originalMargin || ''; // Restore
                            p.style.height = p.dataset.originalHeight || ''; // Restore
                            p.style.overflow = '';
                            p.style.boxShadow = '';
                        });

                        container.style.width = '';
                        container.style.padding = '';
                        container.style.margin = '';
                    }

                    if (initialStudent) store.loadStudent(initialStudent);
                }
            }, false, "Comenzar Exportación");
    }
};

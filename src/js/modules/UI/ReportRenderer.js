/**
 * ReportRenderer.js
 * Renders the Visual Report Overlays (Page 1 & 2)
 */
import { store } from '../State.js';

export const ReportRenderer = {
    renderOverlays: function (subjects) {
        const container = document.getElementById('grades-grid-container');
        if (!container) return;

        const grade = parseInt(store.getState().grade) || 1;
        const isAdvanced = grade >= 3; // Gr 3-6 (Now includes Grade 3)

        // FIX: strict Check if container has children. If yes, UPDATE only.
        // If empty, CREATE.
        // This preserves positions across renders.

        if (isAdvanced) {
            // ADVANCED REPORT (Draggable Grid 4-6)
            // 30 Columns approx.
            const startX = 140; // Space for Subject Name
            const startY = 120;
            const rowH = 25;
            const colW = 26; // Tight fit

            const ensure = (id, val, t, l, w, h, b, ty, al) => ensureElement(container, id, val, t, l, w, h, b, ty, al);

            subjects.forEach((sub, sIndex) => {
                const rowTop = startY + (sIndex * rowH);
                let currentLeft = startX;

                // Subject Name REMOVED as per user request (Background has it)
                // ensure(`grade_s${sIndex}_name`, sub.name, rowTop, 10, 120, 20, true, 'grade', 'left');

                // Competencies (C1, C2, C3...)
                sub.competencies.forEach((comp, cIndex) => {
                    // Always render all columns to support custom layouts
                    ['1', '2', '3', '4'].forEach(p => {
                        // P
                        ensure(`grade_s${sIndex}_c${cIndex}_p${p}`, comp[`p${p}`] || '', rowTop, currentLeft, colW, 20);
                        currentLeft += colW;
                        // RP
                        ensure(`grade_s${sIndex}_c${cIndex}_rp${p}`, comp[`rp${p}`] || '', rowTop, currentLeft, colW, 20);
                        currentLeft += colW;
                    });
                });

                // Finals per Comp
                sub.competencies.forEach((comp, cIndex) => {
                    ensure(`grade_s${sIndex}_c${cIndex}_final`, comp.final || '', rowTop, currentLeft, colW, 20, true);
                    currentLeft += colW;
                });

                // Subject Finals
                ensure(`grade_s${sIndex}_final`, sub.final || '', rowTop, currentLeft, colW, 20, true);
                currentLeft += colW;
                ensure(`grade_s${sIndex}_final_rec`, sub.final_recovery || '', rowTop, currentLeft, colW, 20, true);
                currentLeft += colW;
                ensure(`grade_s${sIndex}_special_rec`, sub.special_recovery || '', rowTop, currentLeft, colW, 20, true);
            });

        } else {
            // BASIC REPORT (Draggable Grid 1-3)
            const startX = 200;
            const startY = 60;
            const rowH = 30;
            const colW = 40;

            const ensure = (id, val, t, l, w, h, b, ty, al) => ensureElement(container, id, val, t, l, w, h, b, ty, al);

            subjects.forEach((sub, sIndex) => {
                const rowTop = startY + (sIndex * rowH);
                let currentLeft = startX;

                sub.competencies.forEach((comp, cIndex) => {
                    ['p1', 'p2', 'p3', 'p4'].forEach(p => {
                        ensure(`grade_s${sIndex}_c${cIndex}_${p}`, comp[p] || '', rowTop, currentLeft, 30, 20);
                        currentLeft += colW;
                    });
                    ensure(`grade_s${sIndex}_c${cIndex}_final`, comp.final || '', rowTop, currentLeft, 30, 20, true);
                    currentLeft += colW;
                });
                ensure(`grade_s${sIndex}_final`, sub.final || '', rowTop, currentLeft, 30, 20, true);
                currentLeft += colW;
                ensure(`grade_s${sIndex}_recovery`, sub.recovery || '', rowTop, currentLeft, 30, 20, true);
            });
        }

        // RENDER OBS & ATT (Common for all)
        renderCommonOverlays(isAdvanced, document.getElementById('grades-grid-container'));

        // RENDER PAGE 1 STATUS FIELDS
        this.renderPage1Status();

        // Apply Mode
        this.toggleOverlayClass(store.getState().settings.isOverlayMode);
    },

    renderPage1Status: function () {
        const container = document.getElementById('page-1');
        if (!container) return;

        const grade = parseInt(store.getState().grade) || 1;
        const isSimpleGrade = grade <= 2; // Grade 1 & 2 don't use Final Situation

        const startTop = 450;
        const ensure = (id, val, t, l, w, h, b, ty, al) => ensureElement(container, id, val, t, l, w, h, b, ty, al);
        const remove = (id) => {
            const el = document.getElementById(id);
            if (el) el.remove();
        };

        const status = store.getState().studentStatus || {};

        if (isSimpleGrade) {
            // REMOVE fields if they exist (cleanup when switching from Gr 3 -> 1)
            remove('status_prom');
            remove('status_postponed');
            remove('status_repeater');
            remove('final_condition');
        } else {
            // RENDER fields for Gr 3+
            // Promovido
            ensure('status_prom', status.promoted || '', startTop + 30, 140, 30, 20);

            // Aplazado
            ensure('status_postponed', status.postponed || '', startTop + 30, 290, 30, 20);

            // Repitente
            ensure('status_repeater', status.repeater || '', startTop + 30, 440, 30, 20);

            // Condición Final
            ensure('final_condition', store.getState().finalCondition || '', startTop + 100, 50, 500, 40, false, 'text', 'left');
        }
    },

    toggleOverlayClass: function (enabled) {
        // Shared logic: In Overlay Mode, we want "Transparent" (Invisible) borders/bg for "Paper" view.
        // In Edit Mode (unchecked), we want "Visible" borders/bg.

        // For Draggable Fields (Gr 1-6 now all use draggable-field)
        const overlayElements = document.querySelectorAll('.draggable-field');
        overlayElements.forEach(el => {
            // Always Transparent BG (Like Page 1)
            el.classList.add('bg-transparent');
            el.classList.remove('bg-white/80');

            if (enabled) {
                // OVERLAY MODE (Print): Invisible Borders
                el.classList.add('border-transparent');
                el.classList.remove('border-gray-300');
            } else {
                // EDIT MODE (View): Visible Borders (Gray)
                el.classList.remove('border-transparent');
                el.classList.add('border-gray-300');
            }
        });
    }
};

// HELPER FUNCTIONS (Internal to Module)

function renderCommonOverlays(isAdvanced, container) {
    const obsTop = isAdvanced ? 350 : 600; // Adjust for Gr 4 table height
    const attLeftStart = 600;

    // Helper wrapper to match ensureElement signature inside here
    const ensure = (id, value, top, left, width = 30, height = 20, isBold = false, type = 'grade', align = 'center') => {
        // Since renderCommonOverlays is internal, we can just call ensureElement directly if 'container' is closure,
        // BUT ensureElement expects 'container' as 1st arg.
        // The original code passed 'ensureElement' as a callback. 
        // Here we can just call ensureElement(container, ...)
        ensureElement(container, id, value, top, left, width, height, isBold, type, align);
    };

    // Observations
    ['p1', 'p2', 'p3', 'p4'].forEach((p, i) => {
        const obsVal = store.getState().observations[p] || '';
        ensure(`overlay_obs_${p}`, obsVal, obsTop + (i * 30), 50, 400, 25, false, 'obs', 'left');
    });

    // Attendance
    const att = store.getState().attendance;
    // Attendance: P1-P4 (Days Only)
    ['p1', 'p2', 'p3', 'p4'].forEach((p, i) => {
        ['pres', 'abs'].forEach((field, fIndex) => {
            const val = att[p][field] || '';
            const left = attLeftStart + (fIndex * 40);
            ensure(`overlay_att_${p}_${field}`, val, obsTop + (i * 25), left, 35, 20);
        });
    });

    // Attendance: Annual / Total (Single Fields)
    // Assuming these should appear below the P4 row or in a specific layout spot. 
    // Defaulting to below P4 for now.
    const totalTop = obsTop + (4 * 25);
    // Unconditionally ensure fields exist (Defensive)
    const tPerc = att.total?.perc || '';
    const tPercAbs = att.total?.perc_abs || '';

    ensure('overlay_att_total_perc', tPerc, totalTop, attLeftStart + 80, 40, 20, false, 'obs', 'center');
    ensure('overlay_att_total_perc_abs', tPercAbs, totalTop, attLeftStart + 120, 40, 20, false, 'obs', 'center');

}

// Universal Helper (Page 1 & 2)
function ensureElement(container, id, value, top, left, width = 30, height = 20, isBold = false, type = 'grade', align = 'center') {
    if (!container) container = document.getElementById(id)?.parentElement || document.body; // Fallback

    let div = document.getElementById(id);
    if (!div) {
        div = document.createElement('div');
        div.id = id;
        div.className = `draggable-field absolute resize-both overflow-hidden border border-gray-300 hover:border-blue-400 flex items-center dynamic-justify z-50 ${align === 'left' ? 'pl-1' : ''}`;
        div.style.top = `${top}px`;
        div.style.left = `${left}px`;
        div.style.width = `${width}px`;
        div.style.height = `${height}px`;
        container.appendChild(div);
    }
    div.innerHTML = `<span class="w-full h-full block text-black ${isBold ? 'font-bold' : ''}" style="font-size: inherit; line-height: 1;">${value}</span>`;
}

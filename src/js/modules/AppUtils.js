/**
 * AppUtils.js
 * General utility functions and UI helpers
 */
import { store } from './State.js';
import { AppUI } from './AppUI.js';

export const AppUtils = {
    // Initialize Font Size from State
    updateGlobalFontSize: (size) => {
        document.documentElement.style.setProperty('--report-font-size', size + 'px');
        const disp = document.getElementById('dispFontSize');
        if (disp) disp.textContent = size;
    },

    // Text Alignment Logic (Scoped per Page & Section)
    updateTextAlignment: (scope, align) => {
        let container = null;
        let varName = '--report-text-align'; // Default for P1 or legacy

        if (scope === 'p1') { container = document.getElementById('page-1'); varName = '--report-text-align'; }
        if (scope === 'p2') { container = document.getElementById('page-2'); varName = '--report-text-align'; } // Legacy P2
        if (scope === 'p2_grades') { container = document.getElementById('page-2'); varName = '--report-p2-grades-align'; }
        if (scope === 'p2_obs') { container = document.getElementById('page-2'); varName = '--report-p2-obs-align'; }

        if (!container) return;

        // Map Align to CSS
        let textAlign = 'center';
        let justify = 'center'; // Flex
        let padding = '0px';

        if (align === 'left') {
            textAlign = 'left';
            justify = 'flex-start';
            padding = '4px';
        } else if (align === 'right') {
            textAlign = 'right';
            justify = 'flex-end';
            padding = '4px';
        }

        // Set CSS Variables on the PAGE CONTAINER
        // Children use var(--report-text-align) which inherits from here
        container.style.setProperty(varName, textAlign);
        container.style.setProperty('--report-justify', justify);

        // Note: Padding variable might need to be scoped if used globally?
        // Current styles.css uses var(--report-padding). It will inherit too.
        container.style.setProperty('--report-padding', padding);
    },

    // Bold Logic (Scoped per Page & Section)
    updateBold: (scope, isBold) => {
        let container = null;
        let varName = '--report-font-weight';

        if (scope === 'p1') { container = document.getElementById('page-1'); varName = '--report-font-weight'; }
        if (scope === 'p2') { container = document.getElementById('page-2'); varName = '--report-font-weight'; }
        if (scope === 'p2_grades') { container = document.getElementById('page-2'); varName = '--report-p2-grades-weight'; }
        if (scope === 'p2_obs') { container = document.getElementById('page-2'); varName = '--report-p2-obs-weight'; }

        if (!container) return;

        const weight = isBold ? 'bold' : 'normal';
        container.style.setProperty(varName, weight);
    },

    // Calibration Logic
    applyCalibration: () => {
        const x = document.getElementById('calX').value || 0;
        const y = document.getElementById('calY').value || 0;

        // Apply to both pages content layers
        const layers = document.querySelectorAll('.content-layer');
        layers.forEach(layer => {
            layer.style.transform = `translate(${x}mm, ${y}mm)`;
        });
    },

    // Auto-Set School Year
    initSchoolYear: () => {
        const y1 = document.getElementById('inputYear1');
        const y2 = document.getElementById('inputYear2');
        if (!y1 || !y2) return;

        const now = new Date();
        const month = now.getMonth(); // 0-based (Aug = 7)
        const year = now.getFullYear();
        const shortYear = year % 100;

        if (month >= 7) { // Aug or Later
            y1.value = shortYear;
            y2.value = shortYear + 1;
        } else { // Jan - July
            y1.value = shortYear - 1;
            y2.value = shortYear;
        }
    },

    // Tab Navigation Helper
    switchTab: (tabName) => {
        const tabData = document.getElementById('tab-content-data');
        const tabGrades = document.getElementById('tab-content-grades');
        const tabObs = document.getElementById('tab-content-obs');

        const btnData = document.getElementById('btnTabData');
        const btnGrades = document.getElementById('btnTabGrades');
        const btnObs = document.getElementById('btnTabObs');

        // Hide all
        if (tabData) tabData.classList.add('hidden');
        if (tabGrades) tabGrades.classList.add('hidden');
        if (tabObs) tabObs.classList.add('hidden');

        if (btnData) btnData.classList.remove('tab-active');
        if (btnGrades) btnGrades.classList.remove('tab-active');
        if (btnObs) btnObs.classList.remove('tab-active');

        if (tabName === 'data') {
            if (tabData) tabData.classList.remove('hidden');
            if (btnData) btnData.classList.add('tab-active');
        } else if (tabName === 'grades') {
            if (tabGrades) tabGrades.classList.remove('hidden');
            if (btnGrades) btnGrades.classList.add('tab-active');
            AppUI.renderInteractiveGrid(store.getState().subjects);
        } else if (tabName === 'obs') {
            if (tabObs) tabObs.classList.remove('hidden');
            if (btnObs) btnObs.classList.add('tab-active');
        }
    }
};

/**
 * app.js
 * Main Entry Point for Boletín de Notas
 * Refactored into Modular Architecture
 */

// Modules
import { store } from './modules/State.js';
import { AppUI } from './modules/AppUI.js';
import { Toast } from './modules/Toast.js';
import { Events } from './modules/Events.js';
import { PDFManager } from './modules/PDF.js';
import { AppUtils } from './modules/AppUtils.js';
import CloudStorage from './modules/CloudStorage.js';
import { AuthManager } from './modules/AuthManager.js';
import { ObservationsManager } from './modules/ObservationsManager.js';
import { StudentManager } from './modules/StudentManager.js';

// Global Instances (for debugging or legacy access if needed)
export { store, Toast };

// Bootstrap Application
document.addEventListener('DOMContentLoaded', () => {
    // === PRE-INIT: Check for V1 Import Lock ===
    const importLock = localStorage.getItem('minerd_import_lock');
    if (importLock) {
        const lockAge = (Date.now() - parseInt(importLock, 10)) / 1000;
        if (lockAge < 300) {
            console.log(`🔒 [App] Import Lock ACTIVE (${lockAge.toFixed(1)}s). Setting global flag.`);
            window.__MINERD_IMPORT_LOCK__ = true;
        } else {
            localStorage.removeItem('minerd_import_lock');
        }
    }

    // 1. Initialize Subsystems
    CloudStorage.init();
    AuthManager.init(); // <--- AUTHENTICATION START
    PDFManager.init();
    store.init();
    AppUI.init(); // Initialize UI bindings (Floating Controls, etc)
    Events.init();
    ObservationsManager.init();
    StudentManager.initTrashEvents();

    // 2. Initial UI Config (Settings)
    const state = store.getState();

    // Font Size
    const initialSize = state.settings.fontSize || 11;
    AppUtils.updateGlobalFontSize(initialSize);

    // Text Align
    const initialAlign = state.settings.textAlign || 'center';
    AppUtils.updateTextAlignment(initialAlign);

    // School Year Auto-Calc
    AppUtils.initSchoolYear();

    // 3. Sync UI Controls
    AppUI.updateHeader(state); // Ensure Title is correct on load
    store.notify(); // Triggers initial render

    // Sync Toggles state
    const overlayCheck = document.getElementById('toggleOverlay');
    if (overlayCheck) {
        store.updateSettings({ isOverlayMode: overlayCheck.checked });
        AppUI.toggleOverlayClass(overlayCheck.checked);
    }
    const editCheck = document.getElementById('toggleEditMode');
    if (editCheck) {
        store.updateSettings({ isEditMode: editCheck.checked });
    }

    // Success Message
    console.log("Boletín App Initialized (Refactored)");
});

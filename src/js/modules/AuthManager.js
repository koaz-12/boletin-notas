import { Toast } from './Toast.js';
import CloudStorage from './CloudStorage.js';
import { store } from './State.js';
import { AppUI } from './AppUI.js';

export const AuthManager = {
    init: function () {
        this.loadTheme(); // Load Theme First
        // Bind events first (Form logic)
        this.bindEvents();

        if (!CloudStorage.isConfigured) {
            console.warn("AuthManager: Cloud not configured");
            return;
        }

        // Force check immediately
        this.checkSession();
    },

    bindEvents: function () {
        const form = document.getElementById('login-form');
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');

        // Buttons
        const btnSwitchMode = document.getElementById('btn-show-signup');
        const btnSkip = document.getElementById('btn-skip-login');
        const linkForgot = document.getElementById('link-forgot-pass');

        // User Menu Toggle
        const btnUserMenu = document.getElementById('user-menu-btn');
        const dropdown = document.getElementById('user-dropdown');

        if (btnUserMenu && dropdown) {
            btnUserMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
            });

            // Close on click outside
            document.addEventListener('click', (e) => {
                if (!btnUserMenu.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            });
        }

        // Logout Button (Dropdown)
        const btnLogout = document.getElementById('menu-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }

        // History Button
        const btnHistory = document.getElementById('menu-history');
        if (btnHistory) {
            btnHistory.addEventListener('click', (e) => {
                e.preventDefault();
                this.openHistoryModal();
            });
        }

        // Feedback / Report Bugs Button
        const btnFeedback = document.getElementById('menu-feedback');

        // Modals
        const modalFeedback = document.getElementById('feedback-modal');
        const btnCloseFeedback = document.getElementById('btn-close-feedback');
        const btnCancelFeedback = document.getElementById('btn-cancel-feedback');
        const btnSubmitFeedback = document.getElementById('btn-submit-feedback');

        const modalInbox = document.getElementById('feedback-inbox-modal');
        const btnCloseInbox = document.getElementById('btn-close-inbox');
        const btnRefreshInbox = document.getElementById('btn-refresh-inbox');
        const inboxList = document.getElementById('feedback-inbox-list');



        if (btnFeedback) {
            btnFeedback.addEventListener('click', (e) => {
                e.preventDefault();
                dropdown.classList.add('hidden');

                const currentUser = Parse.User.current();
                const isAdmin = currentUser && currentUser.get("username") === "soporte_admin";

                if (isAdmin && modalInbox) {
                    // Open Admin Inbox
                    modalInbox.classList.remove('hidden');
                    this.loadFeedbackInbox();
                } else if (modalFeedback) {
                    // Open User Submission Form
                    modalFeedback.classList.remove('hidden');
                }
            });

            // User Submission Form Logic
            const closeFeedbackModal = () => modalFeedback.classList.add('hidden');
            if (btnCloseFeedback) btnCloseFeedback.addEventListener('click', closeFeedbackModal);
            if (btnCancelFeedback) btnCancelFeedback.addEventListener('click', closeFeedbackModal);

            if (btnSubmitFeedback) {
                btnSubmitFeedback.addEventListener('click', async () => {
                    const type = document.getElementById('feedback-type').value;
                    const text = document.getElementById('feedback-text').value.trim();
                    if (!text) return Toast.warning("Por favor escribe tu sugerencia o detalle.");

                    const originalText = btnSubmitFeedback.innerHTML;
                    btnSubmitFeedback.disabled = true;
                    btnSubmitFeedback.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>';

                    try {
                        const Feedback = Parse.Object.extend("Feedback");
                        const fb = new Feedback();
                        fb.set("user", Parse.User.current()?.get("username") || "Anonymous");
                        fb.set("type", type);
                        fb.set("message", text);
                        await fb.save();

                        Toast.success("¡Gracias! Tu reporte ha sido enviado con éxito.");
                        document.getElementById('feedback-text').value = '';
                        closeFeedbackModal();
                    } catch (err) {
                        console.error("Error saving feedback", err);
                        Toast.error("Lo sentimos, no se pudo enviar el reporte. Por favor intenta más tarde.");
                    } finally {
                        btnSubmitFeedback.disabled = false;
                        btnSubmitFeedback.innerHTML = originalText;
                    }
                });
            }

            // Admin Inbox Logic
            if (btnCloseInbox) btnCloseInbox.addEventListener('click', () => modalInbox?.classList.add('hidden'));
            if (btnRefreshInbox) btnRefreshInbox.addEventListener('click', () => this.loadFeedbackInbox());
        }

        // Settings Button (Placeholder)
        // Settings Button & Logic
        const btnSettings = document.getElementById('menu-settings');
        const settingsModal = document.getElementById('settings-modal');
        const btnCloseSettings = document.getElementById('btn-close-settings');
        const btnSaveSettings = document.getElementById('btn-save-settings');

        // New Controls
        const btnExport = document.getElementById('btn-backup-export');
        const btnImport = document.getElementById('btn-backup-import');
        const fileImport = document.getElementById('file-backup-import');
        const btnReset = document.getElementById('btn-danger-reset');

        // School Inputs
        const inCenter = document.getElementById('set-center');
        const inCode = document.getElementById('set-code');
        const inRegional = document.getElementById('set-regional');
        const inDistrict = document.getElementById('set-district');

        if (btnSettings && settingsModal) {
            btnSettings.addEventListener('click', () => {
                // Populate User Data
                const user = this.currentUser();
                if (user) {
                    const u = user.get("username");
                    const e = user.get("email") || u;
                    document.getElementById('settings-username').textContent = u;
                    document.getElementById('settings-email').textContent = e;
                    document.getElementById('settings-user-initial').textContent = u.charAt(0).toUpperCase();
                }

                // Populate School Defaults
                try {
                    const savedDefaults = JSON.parse(localStorage.getItem('minerd_default_school_data') || '{}');
                    if (inCenter) inCenter.value = savedDefaults.centro || '';
                    if (inCode) inCode.value = savedDefaults.codigo || '';
                    if (inRegional) inRegional.value = savedDefaults.regional || '';
                    if (inDistrict) inDistrict.value = savedDefaults.distrito || '';
                } catch (e) { console.error("Error loading defaults", e); }

                settingsModal.classList.remove('hidden');
            });

            // Close
            if (btnCloseSettings) {
                btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
            }

            // Save
            if (btnSaveSettings) {
                btnSaveSettings.addEventListener('click', () => {
                    // Save School Defaults
                    const defaults = {
                        centro: inCenter.value.trim(),
                        codigo: inCode.value.trim(),
                        regional: inRegional.value.trim(),
                        distrito: inDistrict.value.trim()
                    };
                    localStorage.setItem('minerd_default_school_data', JSON.stringify(defaults));

                    settingsModal.classList.add('hidden');
                    Toast.show("Configuración guardada correctamente", "success");
                });
            }

            // Close on outside click
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) settingsModal.classList.add('hidden');
            });

            // --- LOCAL BACKUP ---
            if (btnExport) {
                btnExport.addEventListener('click', () => {
                    const backup = store.exportFullBackup();
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute("href", dataStr);
                    const date = new Date().toISOString().slice(0, 10);
                    downloadAnchor.setAttribute("download", `boletin_backup_${date}.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                    Toast.show("Respaldo descargado", "success");
                });
            }

            if (btnImport && fileImport) {
                btnImport.addEventListener('click', () => fileImport.click());
                fileImport.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        try {
                            const data = JSON.parse(ev.target.result);
                            if (store.importFullBackup(data)) {
                                Toast.show("Respaldo restaurado con éxito", "success");
                                settingsModal.classList.add('hidden');
                            }
                        } catch (err) {
                            Toast.show("Error al importar el archivo", "error");
                            console.error(err);
                        }
                    };
                    reader.readAsText(file);
                    // Reset input
                    fileImport.value = '';
                });
            }

            // --- DANGER ZONE ---
            if (btnReset) {
                btnReset.addEventListener('click', () => {
                    if (confirm("⚠️ ¿ESTÁS SEGURO?\n\nEsto borrará TODOS los datos guardados en este dispositivo (Secciones, Estudiantes, Notas).\n\nSi no tienes copia en la nube o descargada, NO podrás recuperarlos.")) {
                        if (confirm("Confirma por segunda vez: ¿Borrar TODO?")) {
                            localStorage.clear();
                            location.reload();
                        }
                    }
                });
            }
        }

        // Form Submit ...
        if (form) {
            console.log("🔒 AuthManager: Login Form Found, binding submit.");
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log("🔒 AuthManager: Form Submitted");

                const u = usernameInput.value.trim();
                const p = passwordInput.value.trim();

                if (!u || !p) return Toast.show("Completa todos los campos", "error");

                // Check Mode by Button Text
                const submitBtn = form.querySelector('button[type="submit"]');
                const isSignupAction = submitBtn.textContent.includes('Registrar') || submitBtn.textContent.includes('Crear');
                console.log(`🔒 AuthManager: Mode ${isSignupAction ? 'Signup' : 'Login'}`);

                const originalText = submitBtn.textContent;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>';

                try {
                    if (isSignupAction) {
                        await this.signup(u, p);
                    } else {
                        await this.login(u, p);
                    }
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            });
        } else {
            console.error("🔒 AuthManager: Login Form NOT Found in DOM!");
        }

        // Switch Mode (Login <-> Signup)
        if (btnSwitchMode) {
            btnSwitchMode.addEventListener('click', (e) => {
                e.preventDefault();
                const submitBtn = form.querySelector('button[type="submit"]');
                const title = document.querySelector('#login-overlay h2');
                const switchBtn = document.getElementById('btn-show-signup');
                const extraFields = form.querySelector('.flex.items-center.justify-between');

                if (submitBtn.textContent.includes('Entrar')) {
                    // Switch to Signup
                    submitBtn.textContent = 'Registrarse';
                    submitBtn.classList.replace('bg-blue-600', 'bg-purple-600');
                    submitBtn.classList.replace('hover:bg-blue-700', 'hover:bg-purple-700');
                    title.textContent = 'Crear Cuenta';
                    switchBtn.textContent = '¿Ya tienes cuenta? Inicia Sesión';
                    if (extraFields) extraFields.classList.add('hidden'); // HIDE
                } else {
                    // Switch to Login
                    submitBtn.textContent = 'Entrar';
                    submitBtn.classList.replace('bg-purple-600', 'bg-blue-600');
                    submitBtn.classList.replace('hover:bg-purple-700', 'hover:bg-blue-700');
                    title.textContent = 'Iniciar Sesión';
                    switchBtn.textContent = 'Crear cuenta nueva';
                    if (extraFields) extraFields.classList.remove('hidden'); // SHOW
                }
            });
        }

        // Skip Login
        if (btnSkip) {
            btnSkip.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLogin(false);
                Toast.show("Modo Local: Tus datos solo se guardarán en este dispositivo.", "info");
            });
        }

        // Forgot Password
        if (linkForgot) {
            linkForgot.addEventListener('click', (e) => {
                e.preventDefault();
                alert("Por favor contacta al administrador para restablecer tu contraseña.");
            });
        }

        // Dark Mode Toggle
        const toggleDark = document.getElementById('toggle-dark-mode');
        if (toggleDark) {
            // Set initial state based on current body class (set by init)
            const isDark = localStorage.getItem('minerd_theme') === 'dark';
            toggleDark.checked = isDark;

            toggleDark.addEventListener('change', (e) => {
                if (e.target.checked) {
                    document.body.classList.add('dark-mode');
                    localStorage.setItem('minerd_theme', 'dark');
                } else {
                    document.body.classList.remove('dark-mode');
                    localStorage.setItem('minerd_theme', 'light');
                }
            });
        }

        // Listen for Global Restore
        window.addEventListener('minerd:settings-restored', () => {
            this.loadTheme();
            console.log("AuthManager: Theme refreshed from cloud restore.");
        });
    },

    loadTheme: function () {
        const theme = localStorage.getItem('minerd_theme');
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    },

    currentUser: function () {
        return Parse.User.current();
    },

    updateUserUI: function (user) {
        const menuContainer = document.getElementById('user-menu-container');
        const nameEl = document.getElementById('user-name-display');
        const initialEl = document.getElementById('user-avatar-initial');
        const emailEl = document.getElementById('user-email-display');

        const mainPanel = document.getElementById('main-control-panel');
        const sectionsBar = document.getElementById('sections-bar');
        const cloudGroup = document.querySelector('.max-w-7xl.mx-auto.text-center .mt-3');
        const btnHistory = document.getElementById('menu-history');
        const btnTrash = document.getElementById('menu-trash');
        const btnSettings = document.getElementById('menu-settings');

        if (user && menuContainer) {
            menuContainer.classList.remove('hidden');
            const username = user.get("username");
            const email = user.get("email") || username;

            if (nameEl) nameEl.textContent = username;
            if (emailEl) emailEl.textContent = email;
            if (initialEl) initialEl.textContent = username.charAt(0).toUpperCase();

            const mainHeaderContainer = document.getElementById('main-header-container');

            if (username === 'soporte_admin') {
                if (mainPanel) mainPanel.classList.add('hidden');
                if (sectionsBar) sectionsBar.classList.add('hidden');
                if (cloudGroup) cloudGroup.classList.add('hidden');
                if (btnHistory) btnHistory.classList.add('hidden');
                if (btnTrash) btnTrash.classList.add('hidden');
                if (btnSettings) btnSettings.classList.add('hidden');
                if (mainHeaderContainer) mainHeaderContainer.classList.add('hidden');

                // Hide bulletin and print controls
                document.querySelectorAll('.a4-wrapper').forEach(el => el.classList.add('hidden'));
                const printFloat = document.querySelector('.fixed.bottom-6.right-6.z-\\[9000\\]');
                if (printFloat) printFloat.classList.add('hidden');

                // Admin doesn't need data sync of students
                setTimeout(() => {
                    this.loadFeedbackInbox();
                    const modalInbox = document.getElementById('feedback-inbox-modal');
                    if (modalInbox) modalInbox.classList.remove('hidden');
                }, 500);
            } else {
                if (mainPanel) mainPanel.classList.remove('hidden');
                if (sectionsBar) sectionsBar.classList.remove('hidden');
                if (cloudGroup) cloudGroup.classList.remove('hidden');
                if (btnHistory) btnHistory.classList.remove('hidden');
                if (btnTrash) btnTrash.classList.remove('hidden');
                if (btnSettings) btnSettings.classList.remove('hidden');
                if (mainHeaderContainer) mainHeaderContainer.classList.remove('hidden');

                // Show bulletin and print controls
                document.querySelectorAll('.a4-wrapper').forEach(el => el.classList.remove('hidden'));
                const printFloat = document.querySelector('.fixed.bottom-6.right-6.z-\\[9000\\]');
                if (printFloat) printFloat.classList.remove('hidden');
            }

        } else if (menuContainer) {
            menuContainer.classList.add('hidden');
            if (mainPanel) mainPanel.classList.add('hidden');
            if (sectionsBar) sectionsBar.classList.add('hidden');
        }
    },

    checkSession: function () {
        const user = this.currentUser();
        if (user) {
            console.log("👤 Logged in as: ", user.get("username"));
            this.showLogin(false);
            this.updateUserUI(user);
            // Always force pull on app start to guarantee latest cloud data
            this.syncUserData(true);
        } else {
            console.log("👤 No user session");
            this.showLogin(true);
        }
    },

    syncUserData: async function (forcePull = false) {
        // Guard: prevent recursive sync loops
        if (window.__isSyncing__ && !forcePull) {
            console.log("⏸️ Sync already in progress, skipping.");
            return;
        }
        window.__isSyncing__ = true;
        try {
        const user = this.currentUser();
        if (user && user.get("username") === "soporte_admin") {
            return; // Admin does not sync school data
        }

        this.updateSyncStatus('syncing');

        // Clean up legacy import locks
        if (window.__MINERD_IMPORT_LOCK__) delete window.__MINERD_IMPORT_LOCK__;
        localStorage.removeItem('minerd_import_lock');

        const result = await CloudStorage.loadData();

        if (!result.success) {
            this.updateSyncStatus('error');
            if (result.error && (result.error.toString().includes("Network") || !navigator.onLine)) {
                AppUI.updateConnectionStatus('offline');
            }
            Toast.show("⚠️ Error conectando nube: " + result.error, "error");
            return;
        }

        AppUI.updateConnectionStatus('online');

        const localBackup = store.exportFullBackup();
        const localTime = localBackup.timestamp || 0;
        const cloudTime = (result.data && result.data.timestamp) ? result.data.timestamp : 0;

        let hasStudents = false;
        let hasRosterData = false;
        if (localBackup.data) {
            Object.values(localBackup.data).forEach(secData => {
                const state = secData.state || secData;
                // Check studentList (legacy)
                const list = state.studentList;
                if (list && list.length > 0) hasStudents = true;
                // Check roster (new format) - has any keyed entries
                const roster = state.roster;
                if (roster && Object.keys(roster).length > 0) hasRosterData = true;
            });
        }

        // Consider having multiple sections as a sign of real usage
        const hasMultipleSections = localBackup.sections && Array.isArray(localBackup.sections) && localBackup.sections.length > 1;

        let hasImportedSection = false;
        if (localBackup.sections && Array.isArray(localBackup.sections)) {
            if (localBackup.sections.some(s => s.name && s.name.includes("Importado"))) {
                hasImportedSection = true;
            }
        }

        const isLocalEmpty = !hasStudents && !hasRosterData && !hasImportedSection && !hasMultipleSections;

        // FORCE PULL: User clicked Restore manually or Initial Login
        if (forcePull && result.data && !result.empty) {
            console.log("📥 Force Pulling from Cloud...");
            if (store.importFullBackup(result.data)) {
                this.updateSyncStatus('success', 'Restaurado');
                Toast.show("✅ Datos restaurados desde la nube.", "success");
            } else {
                this.updateSyncStatus('error');
                Toast.show("❌ Error restaurando datos.", "error");
            }
            return;
        }

        // Case 0: Local is Empty -> ALWAYS Pull from Cloud (if cloud has data)
        if (isLocalEmpty && result.data && !result.empty) {
            console.log("☁️ Fresh Install detected. Pulling from cloud...");
            if (store.importFullBackup(result.data)) {
                this.updateSyncStatus('success', 'Sincronizado');
                Toast.show("✅ Datos restaurados desde la nube.", "success");
            } else {
                this.updateSyncStatus('error');
                Toast.show("❌ Error restaurando datos.", "error");
            }
            return;
        }

        // Case 1: Cloud is Empty or Invalid -> Upload Local (Seed)
        if (result.empty || !result.data) {
            console.log("☁️ Cloud empty, uploading local data...");
            this.updateSyncStatus('saving');
            await CloudStorage.saveData(localBackup);
            this.updateSyncStatus('success', 'Sincronizado');
            return;
        }

        // Case 4: Sync -> Do nothing if timestamps match perfectly
        if (localTime === cloudTime) {
            console.log("☁️ Data is already in sync.");
            this.updateSyncStatus('success', 'Sincronizado');
            return;
        }

        // Case 2: Local is Newer (e.g. edited offline) -> Upload Local (Overwrite Cloud)
        if (localTime > cloudTime) {
            console.log("☁️ Local is newer, pushing to cloud silently...");
            await CloudStorage.saveData(localBackup);
            this.updateSyncStatus('success', 'Sincronizado');
            Toast.show("☁️ Sincronizado en segundo plano.", "info");
            return;
        }

        // Case 3: Cloud is Newer -> Download (Overwrite Local)
        if (cloudTime > localTime) {
            console.log("☁️ Cloud is newer, pulling data silently...");
            if (store.importFullBackup(result.data)) {
                this.updateSyncStatus('success', 'Sincronizado');
                Toast.show("📥 Datos actualizados desde la nube.", "info");
            } else {
                this.updateSyncStatus('error');
                Toast.show("❌ Error aplicando datos de la nube.", "error");
            }
            return;
        }
        } finally {
            window.__isSyncing__ = false;
        }
    },


    restoreFromCloud: async function () {
        console.log("🔄 Manual Restore Initiated");
        Toast.show("📡 Descargando desde la nube...", "info");
        await this.syncUserData(true); // <--- FORCE PULL
    },

    login: async function (username, password) {
        try {
            const user = await Parse.User.logIn(username, password);
            Toast.show("¡Bienvenido, " + user.get("username") + "!", "success");
            this.showLogin(false);
            this.updateUserUI(user);
            // On fresh manual login, force a pull from the cloud to guarantee exact sync
            this.syncUserData(true);
            return { success: true, user };
        } catch (error) {
            console.error("Login failed", error);
            Toast.show("❌ Error: " + error.message, "error");
            return { success: false, error };
        }
    },

    signup: async function (username, password, email) {
        const user = new Parse.User();
        user.set("username", username);
        user.set("password", password);
        if (email) user.set("email", email);

        try {
            await user.signUp();
            Toast.show("¡Cuenta creada! Bienvenido, " + username, "success");
            this.showLogin(false);
            // New user has no data to sync yet
            return { success: true, user };
        } catch (error) {
            console.error("Signup failed", error);
            Toast.show("❌ Error registro: " + error.message, "error");
            return { success: false, error };
        }
    },

    logout: async function () {
        const modalLogout = document.getElementById('logout-modal');
        const btnCancelLogout = document.getElementById('btn-cancel-logout');
        const btnConfirmLogout = document.getElementById('btn-confirm-logout');

        if (modalLogout && btnCancelLogout && btnConfirmLogout) {
            // Show custom modal
            modalLogout.classList.remove('hidden');

            // Clean up old event listeners if any exist to prevent multiple calls
            const newCancel = btnCancelLogout.cloneNode(true);
            const newConfirm = btnConfirmLogout.cloneNode(true);
            btnCancelLogout.parentNode.replaceChild(newCancel, btnCancelLogout);
            btnConfirmLogout.parentNode.replaceChild(newConfirm, btnConfirmLogout);

            newCancel.addEventListener('click', () => {
                modalLogout.classList.add('hidden');
            });

            newConfirm.addEventListener('click', async () => {
                modalLogout.classList.add('hidden');
                try {
                    await Parse.User.logOut();

                    // Clear Sensitive Local Data
                    localStorage.removeItem('minerd_sections_index');
                    localStorage.removeItem('minerd_current_section_id');
                    localStorage.removeItem('minerd_cloud_id');
                    // Legacy V1 data if present
                    localStorage.removeItem('minerd_boletin_data');

                    // Clear all Section Data dynamically
                    Object.keys(localStorage).forEach(key => {
                        if (key.startsWith('minerd_data_')) {
                            localStorage.removeItem(key);
                        }
                    });

                    Toast.show("Sesión cerrada. Limpiando datos...", "info");
                    setTimeout(() => location.reload(), 1500);
                } catch (error) {
                    console.error("Logout failed", error);
                    Toast.show("❌ Error cerrando sesión.", "error");
                    location.reload();
                }
            });
        } else {
            // Fallback just in case
            try {
                if (confirm("¿Cerrar sesión? Esto borrará los datos locales actuales de la vista para proteger tu privacidad.")) {
                    await Parse.User.logOut();

                    // Clear Sensitive Local Data
                    localStorage.removeItem('minerd_sections_index');
                    localStorage.removeItem('minerd_current_section_id');
                    localStorage.removeItem('minerd_cloud_id');
                    // Legacy V1 data if present
                    localStorage.removeItem('minerd_boletin_data');

                    // Clear all Section Data dynamically
                    Object.keys(localStorage).forEach(key => {
                        if (key.startsWith('minerd_data_')) {
                            localStorage.removeItem(key);
                        }
                    });

                    Toast.show("Sesión cerrada. Limpiando datos...", "info");
                    setTimeout(() => location.reload(), 1500);
                }
            } catch (e) {
                console.error("Logout error", e);
                location.reload();
            }
        }
    },

    showLogin: function (show) {
        const overlay = document.getElementById('login-overlay');
        if (!overlay) return;
        if (show) {
            overlay.classList.remove('hidden');
            document.body.classList.add('overflow-hidden'); // Prevent scrolling
        } else {
            overlay.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        }
    },

    _cachedFeedbacks: [],
    _currentFilter: 'pending', // 'all', 'pending', 'resolved'
    _currentTypeFilter: 'all', // 'all', 'Error', 'Sugerencia', 'Duda'

    loadFeedbackInbox: async function () {
        const inboxList = document.getElementById('feedback-inbox-list');
        const syncLabel = document.getElementById('admin-last-sync');
        if (!inboxList) return;

        inboxList.innerHTML = `
            <div class="col-span-1 md:col-span-2 flex flex-col items-center justify-center py-20 opacity-50">
                <div class="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p class="text-gray-500 font-medium">Sincronizando reportes de Back4App...</p>
            </div>
        `;

        try {
            const query = new Parse.Query("Feedback");
            query.descending("createdAt");
            query.limit(200); // Admin needs to see more history now
            const results = await query.find();

            this._cachedFeedbacks = results;
            if (syncLabel) {
                const now = new Date();
                syncLabel.textContent = "Última sincr.: " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            this.bindAdminInboxEvents();
            this.renderFeedbackInbox();

        } catch (err) {
            console.error("Error fetching admin inbox", err);
            inboxList.innerHTML = '<div class="col-span-1 md:col-span-2 text-center text-red-500 py-10 font-bold bg-white rounded shadow-sm border border-red-200">❌ Error al cargar. Revisa tu conexión.</div>';
        }
    },

    bindAdminInboxEvents: function () {
        // Prevent double binding
        if (this._adminEventsBound) return;

        // Tabs
        const btnTabs = document.querySelectorAll('.admin-tab-btn');
        btnTabs.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active styling
                btnTabs.forEach(b => {
                    b.classList.remove('active', 'border-blue-600', 'text-blue-600', 'font-semibold');
                    b.classList.add('border-transparent', 'text-gray-500', 'font-medium');
                });

                const target = e.currentTarget;
                target.classList.remove('border-transparent', 'text-gray-500', 'font-medium');
                target.classList.add('active', 'border-blue-600', 'text-blue-600', 'font-semibold');

                this._currentFilter = target.getAttribute('data-filter');
                this.renderFeedbackInbox();
            });
        });

        // Type Dropdown Filter
        const typeFilter = document.getElementById('admin-type-filter');
        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                this._currentTypeFilter = e.target.value;
                this.renderFeedbackInbox();
            });
        }

        this._adminEventsBound = true;
    },

    renderFeedbackInbox: function () {
        const inboxList = document.getElementById('feedback-inbox-list');
        if (!inboxList) return;

        let filtered = this._cachedFeedbacks;

        // 1. Calculate and Update Global Stats (Ignoring current tab filter)
        let total = filtered.length;
        let pending = 0;
        let resolved = 0;
        filtered.forEach(fb => {
            if (fb.get('status') === 'resolved') resolved++;
            else pending++;
        });

        const elTotal = document.getElementById('admin-stat-total');
        const elPending = document.getElementById('admin-stat-pending');
        const elResolved = document.getElementById('admin-stat-resolved');
        if (elTotal) elTotal.textContent = total;
        if (elPending) elPending.textContent = pending;
        if (elResolved) elResolved.textContent = resolved;

        // 2. Apply Custom Filters
        if (this._currentFilter === 'pending') {
            filtered = filtered.filter(fb => fb.get('status') !== 'resolved');
        } else if (this._currentFilter === 'resolved') {
            filtered = filtered.filter(fb => fb.get('status') === 'resolved');
        }

        if (this._currentTypeFilter !== 'all') {
            filtered = filtered.filter(fb => fb.get('type') === this._currentTypeFilter);
        }

        // 3. Render Cards
        if (filtered.length === 0) {
            inboxList.innerHTML = `
                <div class="col-span-1 md:col-span-2 text-center text-gray-500 py-16 bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col items-center">
                    <span class="text-4xl mb-3 opacity-50">🍃</span>
                    <p class="font-medium text-lg">No hay reportes aquí.</p>
                    <p class="text-sm">Todo está al día para esta categoría.</p>
                </div>
            `;
            return;
        }

        let html = '';
        filtered.forEach(fb => {
            const id = fb.id;
            const type = fb.get('type');
            const user = fb.get('user');
            const msg = fb.get('message');
            const status = fb.get('status') || 'pending';

            const dateOffset = new Date(fb.createdAt);
            const dateStr = dateOffset.toLocaleDateString() + ' ' + dateOffset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            let icon = '💬'; let typeColor = 'text-indigo-600 bg-indigo-50';
            if (type === 'Error') { icon = '🐞'; typeColor = 'text-red-600 bg-red-50'; }
            if (type === 'Sugerencia') { icon = '💡'; typeColor = 'text-yellow-600 bg-yellow-50'; }

            const isResolved = status === 'resolved';

            html += `
                <div class="bg-white p-5 rounded-lg shadow-sm border ${isResolved ? 'border-green-200 bg-green-50/30 opacity-75' : 'border-gray-200'} flex flex-col gap-3 relative overflow-hidden transition-all hover:shadow-md h-full">
                    ${isResolved ? '<div class="absolute top-0 right-0 w-16 h-16 bg-green-100 rounded-bl-full -mr-8 -mt-8 z-0"></div>' : ''}
                    
                    <div class="flex justify-between items-start z-10">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-sm shadow-inner">
                                ${user.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h4 class="font-bold text-sm text-gray-800 leading-tight">${user}</h4>
                                <span class="text-[10px] text-gray-400 font-medium">${dateStr}</span>
                            </div>
                        </div>
                        <span class="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${typeColor}">${icon} ${type}</span>
                    </div>

                    <p class="text-gray-700 text-sm whitespace-pre-wrap flex-1 z-10 leading-relaxed">${msg}</p>

                    <div class="pt-3 mt-auto border-t border-gray-100 flex justify-end z-10">
                        ${isResolved
                    ? `<button onclick="window.AuthManager.toggleFeedbackStatus('${id}', 'pending')" class="text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors px-3 py-1 rounded hover:bg-gray-100">↩️ Reabrir Reporte</button>`
                    : `<button onclick="window.AuthManager.toggleFeedbackStatus('${id}', 'resolved')" class="text-xs font-bold text-green-600 border border-green-200 bg-green-50 hover:bg-green-100 transition-colors px-3 py-1.5 rounded shadow-sm flex items-center gap-1">✔️ Marcar como Resuelto</button>`
                }
                    </div>
                </div>
            `;
        });
        inboxList.innerHTML = html;
    },

    toggleFeedbackStatus: async function (id, newStatus) {
        try {
            // Update Locally First for Instant Feedback
            const localObj = this._cachedFeedbacks.find(fb => fb.id === id);
            if (localObj) {
                // We fake the 'get' for immediate render
                localObj.set('status', newStatus);
                this.renderFeedbackInbox();
            }

            // Sync with Server
            const query = new Parse.Query("Feedback");
            const fb = await query.get(id);
            fb.set("status", newStatus);
            await fb.save();

        } catch (error) {
            console.error("Failed to update status", error);
            Toast.show("❌ Error al guardar estado en la nube", "error");
        }
    },

    updateSyncStatus: function (status, message = "") {
        const btn = document.getElementById('btn-cloud-save');
        const text = document.getElementById('cloud-status-text');
        const spinner = document.getElementById('cloud-spinner');

        if (!btn || !text || !spinner) return;

        // Reset classes
        btn.classList.remove('bg-green-100', 'border-green-300', 'bg-red-50', 'border-red-200');

        switch (status) {
            case 'saving':
                spinner.classList.remove('hidden');
                text.textContent = "Guardando...";
                text.classList.remove('text-green-700', 'text-red-600');
                text.classList.add('text-gray-600');
                break;
            case 'syncing':
                spinner.classList.remove('hidden');
                text.textContent = "Sincronizando...";
                break;
            case 'success':
                spinner.classList.add('hidden');
                text.textContent = message || "Guardado";
                text.classList.add('text-green-700');
                btn.classList.add('bg-green-50', 'border-green-200');

                // Revert to Idle
                setTimeout(() => {
                    this.updateSyncStatus('idle');
                }, 3000);
                break;
            case 'error':
                spinner.classList.add('hidden');
                text.textContent = "Error";
                text.classList.add('text-red-600');
                btn.classList.add('bg-red-50', 'border-red-200');
                break;
            case 'idle':
            default:
                spinner.classList.add('hidden');
                text.textContent = "Sincronizar";
                text.classList.remove('text-green-700', 'text-red-600', 'text-gray-600');
                text.classList.add('text-gray-500');
                btn.classList.remove('bg-green-50', 'border-green-200');
                break;
        }
    },

    // --- TIME MACHINE UI ---

    openHistoryModal: async function () {
        const modal = document.getElementById('history-modal');
        const listContainer = document.getElementById('history-list');
        const btnClose = document.getElementById('btn-close-history');
        const btnCloseFooter = document.getElementById('btn-close-history-footer');

        if (!modal) return;

        // Show Modal
        modal.classList.remove('hidden');

        // Close Logic
        const close = () => modal.classList.add('hidden');
        btnClose.onclick = close;
        btnCloseFooter.onclick = close;

        // Fetch History
        listContainer.innerHTML = `
            <div class="text-center py-8 text-gray-500 flex flex-col items-center">
                <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                <span>Cargando versiones...</span>
            </div>
        `;

        const result = await CloudStorage.fetchHistory();

        if (result.success) {
            this.renderHistoryList(result.list, listContainer, close);
        } else {
            listContainer.innerHTML = `
                <div class="text-center py-8 text-red-500">
                    ❌ Error cargando historial: ${result.error}
                </div>
            `;
        }
    },

    renderHistoryList: function (list, container, closeCallback) {
        if (!list || list.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-400 py-12 flex flex-col items-center">
                     <span class="text-2xl mb-2">🕸️</span>
                     <span class="italic">No hay historial disponible.</span>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        list.forEach(item => {
            const date = new Date(item.date);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            const isAuto = item.type === 'auto';
            const icon = isAuto ? '🤖' : '💾';
            const label = isAuto ? 'Auto-Guardado' : 'Manual';
            const colorClass = isAuto ? 'bg-gray-50 border-gray-200' : 'bg-white border-indigo-100 shadow-sm';

            const div = document.createElement('div');
            div.className = `p-3 rounded-lg border ${colorClass} flex justify-between items-center hover:bg-gray-100 transition-colors`;
            div.innerHTML = `
                <div class="flex flex-col">
                    <span class="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <span>${icon}</span> ${label}
                    </span>
                    <span class="text-xs text-gray-500">${formattedDate}</span>
                    <span class="text-[10px] text-gray-400 truncate max-w-[200px]">${item.device || 'Desconocido'}</span>
                </div>
                <button class="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded hover:bg-indigo-100 transition-colors restore-btn">
                    Restaurar
                </button>
            `;

            // Use closure to bind click
            const btnRestore = div.querySelector('.restore-btn');
            btnRestore.onclick = () => this.restoreHistoryItem(item.id, closeCallback);

            container.appendChild(div);
        });
    },

    restoreHistoryItem: async function (id, closeCallback) {
        if (!confirm("⚠️ ¿Estás seguro de restaurar esta versión?\n\nSe sobrescribirán TODOS los datos actuales con la versión seleccionada.")) {
            return;
        }

        Toast.show("⏳ Restaurando versión...", "info");

        const result = await CloudStorage.loadHistoryItem(id);

        if (result.success && result.data) {
            if (store.importFullBackup(result.data)) {
                Toast.show("✅ Versión restaurada con éxito", "success");
                if (closeCallback) closeCallback();

                // Refresh UI
                setTimeout(() => window.location.reload(), 1000);
            } else {
                Toast.show("❌ Error al importar los datos", "error");
            }
        } else {
            Toast.show("❌ Error descargando versión: " + (result.error || "Datos corruptos"), "error");
        }
    }
};

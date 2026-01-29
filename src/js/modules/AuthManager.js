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
                const isSignup = submitBtn.textContent.includes('Registrar' || 'Crear');
                console.log(`🔒 AuthManager: Mode ${isSignup ? 'Signup' : 'Login'}`);

                if (isSignup) {
                    await this.signup(u, p);
                } else {
                    await this.login(u, p);
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

        if (user && menuContainer) {
            menuContainer.classList.remove('hidden');
            const username = user.get("username");
            const email = user.get("email") || username;

            if (nameEl) nameEl.textContent = username;
            if (emailEl) emailEl.textContent = email;
            if (initialEl) initialEl.textContent = username.charAt(0).toUpperCase();

        } else if (menuContainer) {
            menuContainer.classList.add('hidden');
        }
    },

    checkSession: function () {
        const user = this.currentUser();
        if (user) {
            console.log("👤 Logged in as: ", user.get("username"));
            this.showLogin(false);
            this.updateUserUI(user);
            this.syncUserData();
        } else {
            console.log("👤 No user session");
            this.showLogin(true);
        }
    },

    syncUserData: async function () {
        this.updateSyncStatus('syncing'); // VISUAL FEEDBACK START

        const result = await CloudStorage.loadData();

        if (!result.success) {
            this.updateSyncStatus('error'); // VISUAL FEEDBACK ERROR

            // Check for network error
            if (result.error && (result.error.toString().includes("Network") || !navigator.onLine)) {
                AppUI.updateConnectionStatus('offline');
            }

            Toast.show("⚠️ Error conectando nube: " + result.error, "error");
            return;
        }

        // Success implies online
        AppUI.updateConnectionStatus('online');

        // Smart Sync Strategy: Timestamp Comparison
        const localBackup = store.exportFullBackup();
        const localTime = localBackup.timestamp || 0;
        const cloudTime = (result.data && result.data.timestamp) ? result.data.timestamp : 0;

        // Check if Local is effectively "Empty/New" (fresh install)
        // A fresh install might have 0 sections or 1 empty default section and NO students.
        let hasStudents = false;
        if (localBackup.data) {
            // Check any section for students
            Object.values(localBackup.data).forEach(secData => {
                if (secData.studentList && secData.studentList.length > 0) hasStudents = true;
            });
        }

        const isLocalEmpty = !hasStudents;

        console.log(`☁️ Sync Check: Local (${new Date(localTime).toLocaleTimeString()}) vs Cloud (${new Date(cloudTime).toLocaleTimeString()})`);
        console.log(`☁️ Is Local Empty? ${isLocalEmpty}`);

        // Case 0: Local is Empty -> ALWAYS Pull from Cloud (if cloud has data)
        if (isLocalEmpty && result.data && !result.empty) {
            console.log("☁️ Fresh Install detected. Pulling from cloud...");
            const success = store.importFullBackup(result.data);
            if (success) {
                console.log("🔄 Data synced (Fresh Install)");
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

        // Case 2: Local is Newer (e.g. just imported V1 or edited offline) -> Upload Local (Overwrite Cloud)
        // Add a small buffer (e.g. 1 sec) to avoid loops due to clock skews
        if (localTime > cloudTime) {
            console.log("☁️ Local is newer, pushing to cloud...");
            this.updateSyncStatus('saving');
            await CloudStorage.saveData(localBackup);
            this.updateSyncStatus('success', 'Sincronizado');
            Toast.show("☁️ Nube actualizada con tus datos recientes.", "success");
            return;
        }

        // Case 3: Cloud is Newer -> Download (Overwrite Local)
        if (cloudTime > localTime) {
            console.log("☁️ Cloud is newer, pulling data...");
            // Prevent infinite reload loop if import fails or timestamps don't align
            const success = store.importFullBackup(result.data);
            if (success) {
                console.log("🔄 Data synced from cloud logic");
                this.updateSyncStatus('success', 'Sincronizado');
                Toast.show("✅ Datos sincronizados desde la nube.", "success");
            } else {
                this.updateSyncStatus('error');
                Toast.show("❌ Error aplicando datos de la nube.", "error");
            }
            return;
        }

        // Case 4: Sync -> Do nothing
        console.log("☁️ Data is already in sync.");
        this.updateSyncStatus('success', 'Sincronizado');
    },


    restoreFromCloud: async function () {
        console.log("🔄 Manual Restore Initiated");
        Toast.show("📡 Conectando con la nube...", "info");
        await this.syncUserData();
    },

    login: async function (username, password) {
        try {
            const user = await Parse.User.logIn(username, password);
            Toast.show("¡Bienvenido, " + user.get("username") + "!", "success");
            this.showLogin(false);
            this.updateUserUI(user);
            this.syncUserData();
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
    },

    showLogin: function (show) {
        const modal = document.getElementById('login-overlay');

        if (!modal) return;

        if (show) {
            modal.classList.remove('hidden');
            document.body.classList.add('overflow-hidden'); // Prevent scrolling
        } else {
            modal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
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
    }
};

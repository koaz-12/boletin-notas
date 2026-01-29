/**
 * Toast.js
 * A nice notification system to replace alerts.
 */

export const Toast = {
    init() {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none';
            document.body.appendChild(container);
        }
    },

    show(message, type = 'info', duration = 4000) {
        this.init();
        const container = document.getElementById('toast-container');

        // Colors
        let bgClass = "bg-gray-800";
        let icon = "ℹ️";
        if (type === 'success') { bgClass = "bg-green-600"; icon = "✅"; }
        if (type === 'error') { bgClass = "bg-red-600"; icon = "❌"; }
        if (type === 'warning') { bgClass = "bg-yellow-600"; icon = "⚠️"; }

        // Create Element
        const toast = document.createElement('div');
        toast.className = `${bgClass} text-white text-sm px-4 py-3 rounded shadow-lg flex items-center gap-3 transform transition-all duration-300 translate-x-10 opacity-0 pointer-events-auto max-w-sm`;
        toast.innerHTML = `
            <span class="text-lg">${icon}</span>
            <div class="flex-1 font-medium leading-tight">${message}</div>
        `;

        container.appendChild(toast);

        // Animate In
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-10', 'opacity-0');
            toast.classList.add('translate-x-0', 'opacity-100');
        });

        // Auto Remove
        setTimeout(() => {
            this.dismiss(toast);
        }, duration);

        // Click to dimiss
        toast.onclick = () => this.dismiss(toast);
    },

    dismiss(toast) {
        toast.classList.add('translate-x-10', 'opacity-0');
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 300);
    },

    // Shortcuts
    success(msg) { this.show(msg, 'success'); },
    error(msg) { this.show(msg, 'error'); },
    info(msg) { this.show(msg, 'info'); },
    warning(msg) { this.show(msg, 'warning'); }
};

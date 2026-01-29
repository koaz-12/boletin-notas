/**
 * Utils.js
 * Utility functions for the application
 */

export const CoreUtils = {
    calculateAverage: function (values) {
        const numbers = values
            .map(v => parseFloat(v))
            .filter(n => !isNaN(n));

        if (numbers.length === 0) return "";

        const sum = numbers.reduce((a, b) => a + b, 0);
        return Math.round(sum / numbers.length);
    },

    debounce: function (func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

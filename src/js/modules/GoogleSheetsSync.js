import { Toast } from './Toast.js';

/**
 * GoogleSheetsSync.js
 * Descarga el archivo de Google Sheets como un XLSX nativo.
 * Esto delega todo el parseo complejo a ExcelImport.js.
 */
export const GoogleSheetsSync = {

    /**
     * Extrae el ID del documento de un link de Google Sheets.
     * Ejemplo de link: https://docs.google.com/spreadsheets/d/1X2Y3Z/edit#gid=0
     */
    extractSpreadsheetId: (url) => {
        const regex = /\/d\/([a-zA-Z0-9-_]+)/;
        const matches = url.match(regex);
        return matches ? matches[1] : null;
    },

    /**
     * Inicia la sincronización desde el link proporcionado, devuelve un File XLSX.
     */
    fetchXLSXFromLink: async (rawUrl) => {
        if (!rawUrl || rawUrl.trim() === '') {
            throw new Error("Por favor inserta un link de Google Sheets válido.");
        }

        const docId = GoogleSheetsSync.extractSpreadsheetId(rawUrl);
        if (!docId) {
            throw new Error("Formato de link inválido. Asegúrate de copiar el link completo de Google Sheets.");
        }

        // Construir URL de exportación XLSX nativa
        const xlsxExportUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=xlsx`;

        const response = await fetch(xlsxExportUrl);
        if (!response.ok) {
            throw new Error("No se pudo leer el archivo. Verifica que el link tenga los permisos: 'Cualquier usuario con el enlace puede leer'.");
        }

        const blob = await response.blob();

        // Si devuelve HTML en vez de archivo binario, probablemente no tiene permisos
        if (blob.type.includes("html") || blob.size < 1000) {
            const text = await blob.text();
            if (text.trim().startsWith("<!DOCTYPE html>")) {
                throw new Error("El archivo es privado. Debes cambiar los permisos en Google Sheets a 'Cualquier persona con el enlace'.");
            }
        }

        // Crear un Fake File object que FileReader (usado por ExcelImport) puede leer
        const fakeFile = new File([blob], "GoogleDrive.xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });

        return fakeFile;
    }
};

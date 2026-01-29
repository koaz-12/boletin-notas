/**
 * GridRenderer.js
 * Renders the Interactive Entry Grid (Data Input)
 */
import { store } from '../State.js';

export const GridRenderer = {
    renderInteractiveGrid: function (subjects) {
        const container = document.getElementById('entry-grid-container');
        if (!container) return;

        // CSS for Sticky Headers/Columns
        // ... (Styles are usually global or classes)

        const grade = parseInt(store.getState().grade) || 1;
        const isAdvanced = grade >= 3;

        if (!isAdvanced) {
            // ORIGINAL LAYOUT (Grades 1-3)
            let html = `
            <div class="overflow-x-auto">
            <table class="w-full text-[10px] border-collapse border border-gray-300 whitespace-nowrap">
                <thead class="bg-gray-100 sticky top-0 z-10">
                    <tr>
                        <th class="border p-2 text-left w-32 sticky left-0 bg-gray-100 z-20">Asignatura</th>
                        <th colspan="4" class="border p-1 bg-blue-50 text-center">Competencia Comunicativa (C1)</th>
                        <th colspan="4" class="border p-1 bg-green-50 text-center">C. Pensamiento Lógico (C2)</th>
                        <th colspan="4" class="border p-1 bg-yellow-50 text-center">C. Ética y Ciudadana (C3)</th>
                        <th colspan="3" class="border p-1 bg-gray-200">Finales Comp.</th>
                        <th class="border p-1 bg-gray-300">Calif. Final</th>
                        <th class="border p-1 bg-orange-100">Recup.</th>
                    </tr>
                    <tr>
                        <th class="border p-1 sticky left-0 bg-gray-100 z-20"></th>
                        <th class="border p-1 text-center w-8">P1</th><th class="border p-1 text-center w-8">P2</th><th class="border p-1 text-center w-8">P3</th><th class="border p-1 text-center w-8">P4</th>
                        <th class="border p-1 text-center w-8">P1</th><th class="border p-1 text-center w-8">P2</th><th class="border p-1 text-center w-8">P3</th><th class="border p-1 text-center w-8">P4</th>
                        <th class="border p-1 text-center w-8">P1</th><th class="border p-1 text-center w-8">P2</th><th class="border p-1 text-center w-8">P3</th><th class="border p-1 text-center w-8">P4</th>
                        <th class="border p-1 text-center bg-blue-100">C1</th><th class="border p-1 text-center bg-green-100">C2</th><th class="border p-1 text-center bg-yellow-100">C3</th>
                        <th class="border p-1">Prom</th>
                        <th class="border p-1">Nota</th>
                    </tr>
                </thead>
                <tbody>`;

            subjects.forEach((sub, sIndex) => {
                html += `<tr>
                <td class="border p-2 font-bold sticky left-0 bg-white z-20 truncate max-w-[120px]" title="${sub.name}">${sub.name}</td>`;

                // Competencies Input
                sub.competencies.forEach((comp, cIndex) => {
                    ['p1', 'p2', 'p3', 'p4'].forEach(p => {
                        html += `<td class="border p-0 text-center min-w-[30px]">
                            <input type="number" min="0" class="w-full text-center border-none focus:ring-1 focus:ring-blue-500 h-5 text-[10px] font-bold"
                                value="${comp[p] || ''}" 
                                data-action="updateGrade" 
                                data-sindex="${sIndex}" 
                                data-cindex="${cIndex}" 
                                data-field="${p}">
                        </td>`;
                    });
                });

                // Finals
                sub.competencies.forEach((comp, cIndex) => {
                    html += `<td class="border p-0 bg-gray-50 text-center">
                        <input type="text" class="w-full text-center font-bold bg-transparent focus:bg-white h-6"
                            value="${comp.final || ''}" data-action="updateGrade" data-sindex="${sIndex}" data-cindex="${cIndex}" data-field="final">
                    </td>`;
                });

                html += `
                <td class="border p-0 bg-gray-300 text-center">
                    <input type="text" class="w-full text-center font-bold bg-transparent focus:bg-white h-6"
                        value="${sub.final || ''}" data-action="updateGrade" data-sindex="${sIndex}" data-cindex="-1" data-field="final">
                </td>
                <td class="border p-0 bg-orange-100 text-center">
                    <input type="text" class="w-full text-center font-bold text-orange-700 bg-transparent focus:bg-white h-6"
                        value="${sub.recovery || ''}" data-action="updateGrade" data-sindex="${sIndex}" data-cindex="-1" data-field="recovery">
                </td>
                </tr>`;
            });

            html += '</tbody></table></div>';
            container.innerHTML = html;

        } else {
            // ADVANCED LAYOUT (Grades 4-6)
            // Includes RP1, RP2, RP3, RP4 cols + Final Recovery + Special Recovery
            let html = `
            <div class="overflow-x-auto">
            <table class="text-[10px] border-collapse border border-gray-300 whitespace-nowrap">
                <thead class="bg-gray-100 sticky top-0 z-10">
                    <tr>
                        <th class="border p-2 text-left w-32 sticky left-0 bg-gray-100 z-20">Asignatura</th>
                        <th colspan="8" class="border p-1 bg-blue-50 text-center">Competencia Comunicativa (C1)</th>
                        <th colspan="8" class="border p-1 bg-green-50 text-center">C. Pensamiento Lógico (C2)</th>
                        <th colspan="8" class="border p-1 bg-yellow-50 text-center">C. Ética y Ciudadana (C3)</th>
                        <th colspan="3" class="border p-1 bg-gray-200">Finales Comp.</th>
                        <th class="border p-1 bg-gray-300">C.F.</th>
                        <th class="border p-1 bg-orange-100">R.F.</th>
                        <th class="border p-1 bg-purple-100">R.E.</th>
                    </tr>
                    <tr>
                        <th class="border p-1 sticky left-0 bg-gray-100 z-20"></th>
                        <!-- P Headers x3 -->
                        ${['C1', 'C2', 'C3'].map(c => `
                            <th class="border p-1 text-center">P1</th><th class="border p-1 text-center text-red-500">RP1</th>
                            <th class="border p-1 text-center">P2</th><th class="border p-1 text-center text-red-500">RP2</th>
                            <th class="border p-1 text-center">P3</th><th class="border p-1 text-center text-red-500">RP3</th>
                            <th class="border p-1 text-center">P4</th><th class="border p-1 text-center text-red-500">RP4</th>
                        `).join('')}
                        <th class="border p-1 text-center bg-gray-100">C1</th>
                        <th class="border p-1 text-center bg-gray-100">C2</th>
                        <th class="border p-1 text-center bg-gray-100">C3</th>
                        <th class="border p-1">C.F</th>
                        <th class="border p-1 bg-red-50">R.F</th>
                        <th class="border p-1 bg-red-100">R.E</th>
                    </tr>
                </thead>
                <tbody>`;

            subjects.forEach((sub, sIndex) => {
                html += `<tr>
                <td class="border p-2 font-bold sticky left-0 bg-white z-20 truncate max-w-[120px]" title="${sub.name}">${sub.name}</td>`;

                // Competencies
                sub.competencies.forEach((comp, cIndex) => {
                    ['1', '2', '3', '4'].forEach(i => {
                        // P{i}
                        html += `<td class="border p-0 text-center min-w-[30px]"><input type="number" min="0" class="w-full text-center border-none focus:ring-1 h-5 text-[10px] font-bold" value="${comp['p' + i] || ''}" data-action="updateGrade" data-sindex="${sIndex}" data-cindex="${cIndex}" data-field="p${i}"></td>`;
                        // RP{i}
                        html += `<td class="border p-0 text-center bg-red-50 min-w-[30px]"><input type="number" min="0" class="w-full text-center border-none focus:ring-1 h-5 text-[10px] font-bold text-red-600" value="${comp['rp' + i] || ''}" data-action="updateGrade" data-sindex="${sIndex}" data-cindex="${cIndex}" data-field="rp${i}"></td>`;
                    });
                });

                // Finals per comp
                sub.competencies.forEach((comp, cIndex) => {
                    html += `<td class="border p-0 bg-gray-50 text-center min-w-[30px]">
                        <input type="number" min="0" class="w-full text-center font-bold text-[10px] bg-transparent focus:bg-white h-5"
                            value="${comp.final || ''}" data-action="updateGrade" data-sindex="${sIndex}" data-cindex="${cIndex}" data-field="final">
                    </td>`;
                });

                // Subject Finals
                html += `
                <td class="border p-0 bg-blue-50 text-center min-w-[30px]"> <!-- C.F (Index 29) -->
                    <input type="number" min="0" class="w-full text-center font-bold text-[10px] bg-transparent focus:bg-white h-5"
                        value="${sub.final || ''}" data-action="updateGrade" data-sindex="${sIndex}" data-cindex="-1" data-field="final">
                </td>
                <td class="border p-0 bg-red-50 text-center min-w-[30px]"> <!-- R.F (Index 30) -->
                    <input type="number" min="0" class="w-full text-center font-bold text-[10px] text-red-700 bg-transparent focus:bg-white h-5"
                        value="${sub.final_recovery || ''}" data-action="updateGrade" data-sindex="${sIndex}" data-cindex="-1" data-field="final_recovery">
                </td>
                <td class="border p-0 bg-red-100 text-center min-w-[30px]"> <!-- R.E (Index 31) -->
                    <input type="number" min="0" class="w-full text-center font-bold text-[10px] text-red-900 bg-transparent focus:bg-white h-5"
                        value="${sub.special_recovery || ''}" data-action="updateGrade" data-sindex="${sIndex}" data-cindex="-1" data-field="special_recovery">
                </td>
                </tr>`;
            });

            html += '</tbody></table></div>';
            container.innerHTML = html;
        }
    }
};

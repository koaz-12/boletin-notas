/**
 * Interaction.js
 * Handles dragging and dropping of elements.
 */

import { CoreUtils } from './CoreUtils.js';
import { LayoutDefaults } from '../config/LayoutDefaults.js';

export class InteractionManager {
    constructor(storeInstance) {
        this.draggedElement = null;
        this.offset = { x: 0, y: 0 };
        this.isEditMode = false;
        this.store = storeInstance;

        this.history = [];
        this.redoStack = [];
        this.maxHistory = 50;
        this.savePositionsDebounced = CoreUtils.debounce(() => this.savePositions(), 500);

        this.lastGrade = null;

        this.store.subscribe((state) => {
            if (this.isEditMode !== state.settings.isEditMode) {
                this.isEditMode = state.settings.isEditMode;
                this.updateCursor();
            }

            // Reload positions if grade changes
            if (this.lastGrade !== state.grade) {
                this.lastGrade = state.grade;
                this.loadPositions();
            }
        });

        this.initEvents();
        setTimeout(() => this.loadPositions(), 100);
    }

    initEvents() {
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mouseup', () => this.onMouseUp());
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.undo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); this.redo(); }
        });
    }

    updateCursor() {
        const draggables = document.querySelectorAll('.draggable-field');
        draggables.forEach(el => { el.style.cursor = this.isEditMode ? 'grab' : 'default'; });
        document.body.classList.toggle('edit-mode-active', this.isEditMode);
    }

    onMouseDown(e) {
        if (!this.isEditMode) return;
        const target = e.target.closest('.draggable-field');
        if (!target) return;

        const rect = target.getBoundingClientRect();
        if (e.clientX > rect.right - 20 && e.clientY > rect.bottom - 20) return; // Resize handle

        this.pushHistory();
        this.draggedElement = target;

        // Use Delta approach
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.startLeft = target.offsetLeft;
        this.startTop = target.offsetTop;

        this.draggedElement.style.cursor = 'grabbing';
        e.preventDefault();
    }

    onMouseMove(e) {
        if (!this.isEditMode || !this.draggedElement) return;

        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;

        this.draggedElement.style.position = 'absolute';
        this.draggedElement.style.left = `${this.startLeft + dx}px`;
        this.draggedElement.style.top = `${this.startTop + dy}px`;
        this.draggedElement.style.margin = '0';
    }

    onMouseUp() {
        if (!this.isEditMode) return;
        if (this.draggedElement) {
            this.draggedElement.style.cursor = 'grab';
            this.draggedElement = null;
            this.savePositionsDebounced();
        }
    }

    captureState() {
        const positions = {};
        document.querySelectorAll('.draggable-field').forEach(el => {
            if (el.id) {
                positions[el.id] = {
                    left: el.style.left,
                    top: el.style.top,
                    width: el.style.width || (el.offsetWidth + 'px'),
                    height: el.style.height || (el.offsetHeight + 'px')
                };
            }
        });
        return JSON.stringify(positions);
    }

    savePositions() {
        const state = this.captureState();
        const grade = this.store.getState().grade;
        localStorage.setItem(`layout_grade_${grade}`, state);
    }

    loadPositions() {
        const grade = this.store.getState().grade;
        let saved = localStorage.getItem(`layout_grade_${grade}`);

        // Fallback to Factory Defaults (if no user save exists)
        if (!saved && LayoutDefaults[grade]) {
            console.log(`Using Factory Default Layout for Grade ${grade}`);
            saved = JSON.stringify(LayoutDefaults[grade]);
        }

        if (saved) this.applyState(saved);
    }

    applyState(jsonState) {
        const positions = JSON.parse(jsonState);
        Object.keys(positions).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const pos = positions[id];
                el.style.position = 'absolute';
                el.style.left = pos.left;
                el.style.top = pos.top;
                el.style.width = pos.width;
                el.style.height = pos.height;
            }
        });
    }

    pushHistory() {
        const current = this.captureState();
        if (this.history.length > 0 && this.history[this.history.length - 1] === current) return;
        this.history.push(current);
        if (this.history.length > this.maxHistory) this.history.shift();
        this.redoStack = [];
    }

    undo() {
        if (this.history.length === 0) return;
        const current = this.captureState();
        this.redoStack.push(current);
        const prev = this.history.pop();
        this.applyState(prev);
        this.savePositionsDebounced();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const current = this.captureState();
        this.history.push(current);
        const next = this.redoStack.pop();
        this.applyState(next);
        this.savePositionsDebounced();
    }
}

// Study Notepad & Personal Exam Revision Module

class NotepadManager {
    constructor() {
        this.notes = [];
        this.activeNoteId = null;
        this.selectedTag = 'all';
        this.searchTerm = '';
        this.autoSaveTimeout = null;
    }

    async init() {
        await this.loadNotes();
        this.render();
    }

    async loadNotes() {
        // 1. Always load local notes first as safe source of truth
        const local = localStorage.getItem('ca_exam_notes');
        if (local) {
            try {
                this.notes = JSON.parse(local) || [];
            } catch (e) {
                console.error('Local notes parse error:', e);
            }
        }

        // 2. Fetch server notes and safely merge
        try {
            const data = await window.api.getNotes();
            const serverNotes = data.notes || [];

            if (serverNotes.length > 0) {
                const localMap = new Map(this.notes.map(n => [n.id, n]));
                for (const sNote of serverNotes) {
                    if (!localMap.has(sNote.id)) {
                        this.notes.push(sNote);
                    } else {
                        // Keep whichever is more recently updated
                        const existing = localMap.get(sNote.id);
                        if (new Date(sNote.updated_at) > new Date(existing.updated_at)) {
                            Object.assign(existing, sNote);
                        }
                    }
                }
            } else if (this.notes.length > 0) {
                // Server restarted / database is fresh; sync our local notes to server!
                for (const n of this.notes) {
                    window.api.createNote({
                        title: n.title,
                        content: n.content,
                        tags: n.tags,
                        color: n.color,
                        is_pinned: n.is_pinned
                    }).catch(() => {});
                }
            }
        } catch (e) {
            console.warn('Backend notes sync unavailable, running from local storage:', e);
        }

        if (this.notes.length > 0 && !this.activeNoteId) {
            this.activeNoteId = this.notes[0].id;
        }
        this.saveToStorage();
    }

    async saveToStorage() {
        localStorage.setItem('ca_exam_notes', JSON.stringify(this.notes));
    }


    getActiveNote() {
        return this.notes.find(n => n.id === this.activeNoteId) || null;
    }

    async createNewNote(initialTitle = 'New Study Note', initialContent = '', tags = ['#CurrentAffairs']) {
        const notePayload = {
            title: initialTitle,
            content: initialContent,
            tags: tags,
            color: 'indigo',
            is_pinned: false
        };

        try {
            const res = await window.api.createNote(notePayload);
            const newId = res.note_id || Date.now();
            const newNote = {
                id: newId,
                ...notePayload,
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            };
            this.notes.unshift(newNote);
            this.activeNoteId = newId;
            this.saveToStorage();
            this.render();
            return newNote;
        } catch (e) {
            const localId = Date.now();
            const newNote = { id: localId, ...notePayload, updated_at: new Date().toISOString() };
            this.notes.unshift(newNote);
            this.activeNoteId = localId;
            this.saveToStorage();
            this.render();
            return newNote;
        }
    }

    async appendFromArticle(article) {
        const bulletsText = article.bullets.map(b => `• ${b}`).join('\n');
        let staticText = '';
        if (article.static_gk && article.static_gk.length > 0) {
            staticText = '\n\n[Static GK Booster]\n' + article.static_gk.map(s => `• ${s.label}: ${s.value}`).join('\n');
        }

        const noteSnippet = `\n\n--- \n📌 ${article.title} (${article.source_name} - ${article.published_date})\n${bulletsText}${staticText}\n`;

        let active = this.getActiveNote();
        if (!active) {
            await this.createNewNote(
                `Current Affairs Notes - ${article.published_date}`,
                `# Exam Current Affairs Revision Deck\n${noteSnippet}`,
                ['#' + article.category.replace(/[^a-zA-Z0-9]/g, ''), '#Revision']
            );
        } else {
            active.content += noteSnippet;
            active.updated_at = new Date().toISOString();
            await this.updateActiveNote();
        }

        this.render();
        window.showToast?.('Added fact to your Study Notepad! 📓');
    }

    async updateActiveNote() {
        const active = this.getActiveNote();
        if (!active) return;

        const titleEl = document.getElementById('note-title-input');
        const contentEl = document.getElementById('note-content-input');
        const tagsEl = document.getElementById('note-tags-input');

        if (titleEl) active.title = titleEl.value.trim() || 'Untitled Note';
        if (contentEl) active.content = contentEl.value;
        if (tagsEl) {
            active.tags = tagsEl.value.split(',').map(t => t.trim()).filter(t => t.length > 0);
        }

        active.updated_at = new Date().toISOString();
        this.saveToStorage();

        try {
            await window.api.updateNote(active.id, {
                title: active.title,
                content: active.content,
                tags: active.tags,
                color: active.color,
                is_pinned: active.is_pinned
            });
        } catch (e) {
            console.error('Remote note sync failed:', e);
        }

        this.renderNotesList();
    }

    async deleteNote(id) {
        if (!confirm('Are you sure you want to delete this note?')) return;
        this.notes = this.notes.filter(n => n.id !== id);
        if (this.activeNoteId === id) {
            this.activeNoteId = this.notes.length > 0 ? this.notes[0].id : null;
        }
        this.saveToStorage();
        try {
            await window.api.deleteNote(id);
        } catch (e) {
            console.error(e);
        }
        this.render();
    }

    async togglePin(id) {
        const note = this.notes.find(n => n.id === id);
        if (note) {
            note.is_pinned = !note.is_pinned;
            this.saveToStorage();
            await window.api.updateNote(id, { is_pinned: note.is_pinned });
            this.render();
        }
    }

    setNoteColor(color) {
        const active = this.getActiveNote();
        if (active) {
            active.color = color;
            this.saveToStorage();
            window.api.updateNote(active.id, { color: color });
            this.render();
        }
    }

    exportAsText() {
        const active = this.getActiveNote();
        if (!active) return;
        const blob = new Blob([`${active.title}\n${'='.repeat(active.title.length)}\nTags: ${active.tags.join(', ')}\n\n${active.content}`], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${active.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_notes.txt`;
        a.click();
    }

    exportAsMarkdown() {
        const active = this.getActiveNote();
        if (!active) return;
        const blob = new Blob([`# ${active.title}\n**Tags**: ${active.tags.join(', ')}  \n**Updated**: ${active.updated_at}\n\n${active.content}`], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${active.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_notes.md`;
        a.click();
    }

    copyToClipboard() {
        const active = this.getActiveNote();
        if (!active) return;
        navigator.clipboard.writeText(`${active.title}\n\n${active.content}`);
        window.showToast?.('Copied note to clipboard! 📋');
    }

    printNotes() {
        window.print();
    }

    render() {
        this.renderNotesList();
        this.renderEditor();
    }

    renderNotesList() {
        const listEl = document.getElementById('notepad-list');
        if (!listEl) return;

        let filtered = this.notes;
        if (this.searchTerm) {
            const q = this.searchTerm.toLowerCase();
            filtered = filtered.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
        }

        if (this.selectedTag !== 'all') {
            filtered = filtered.filter(n => n.tags && n.tags.includes(this.selectedTag));
        }

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div class="p-6 text-center text-slate-400 dark:text-slate-500 text-sm">
                    <i data-lucide="file-text" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
                    <p>No notes found.</p>
                    <button onclick="window.notepad.createNewNote()" class="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow transition-fluid">
                        + Create First Note
                    </button>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        listEl.innerHTML = filtered.map(n => {
            const isActive = n.id === this.activeNoteId;
            const preview = n.content.replace(/[#*`_]/g, '').slice(0, 75) || 'Empty note...';
            return `
                <div onclick="window.notepad.selectNote(${n.id})" class="p-3.5 rounded-xl cursor-pointer transition-fluid border ${isActive ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 shadow-sm' : 'bg-white/60 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800'} mb-2">
                    <div class="flex items-start justify-between gap-2">
                        <h4 class="text-xs font-bold text-slate-900 dark:text-slate-100 truncate ${isActive ? 'text-indigo-700 dark:text-indigo-400' : ''}">${escapeHtml(n.title)}</h4>
                        <div class="flex items-center gap-1">
                            ${n.is_pinned ? '<span class="text-amber-500 text-xs">📌</span>' : ''}
                            <button onclick="event.stopPropagation(); window.notepad.deleteNote(${n.id})" class="text-slate-400 hover:text-red-500 p-0.5 rounded transition-fluid" title="Delete">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </div>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">${escapeHtml(preview)}</p>
                    <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                        <span>${new Date(n.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                        <div class="flex gap-1 flex-wrap max-w-[120px] overflow-hidden">
                            ${(n.tags || []).slice(0, 2).map(t => `<span class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono text-[9px]">${escapeHtml(t)}</span>`).join('')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    selectNote(id) {
        this.activeNoteId = id;
        this.render();
    }

    renderEditor() {
        const editorContainer = document.getElementById('notepad-editor-area');
        if (!editorContainer) return;

        const active = this.getActiveNote();
        if (!active) {
            editorContainer.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-slate-500">
                    <i data-lucide="edit-3" class="w-12 h-12 mb-3 opacity-40"></i>
                    <h3 class="text-base font-bold text-slate-700 dark:text-slate-300">No Note Selected</h3>
                    <p class="text-xs max-w-sm mt-1 mb-4">Select a note from the left panel or start a new scratchpad for your SSC, Railway, or Bank exam preparation.</p>
                    <button onclick="window.notepad.createNewNote()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition-fluid flex items-center gap-2">
                        <i data-lucide="plus" class="w-4 h-4"></i> New Study Note
                    </button>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        const tagsString = (active.tags || []).join(', ');

        editorContainer.innerHTML = `
            <div class="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                <!-- Editor Header -->
                <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40">
                    <div class="flex-1 min-w-[200px]">
                        <input id="note-title-input" type="text" value="${escapeHtml(active.title)}" placeholder="Note Title (e.g. RBI MPC Directives & Railway Kavach)" 
                            oninput="window.notepad.debounceUpdate()"
                            class="w-full text-base md:text-lg font-bold bg-transparent border-none text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-0 placeholder-slate-400" />
                    </div>
                    <!-- Action Toolbar -->
                    <div class="flex items-center gap-1.5 flex-wrap no-print">
                        <button onclick="window.notepad.togglePin(${active.id})" class="p-2 rounded-lg text-xs font-medium border ${active.is_pinned ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border-amber-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'} transition-fluid" title="Pin Note">
                            📌 ${active.is_pinned ? 'Pinned' : 'Pin'}
                        </button>
                        <button onclick="window.notepad.copyToClipboard()" class="p-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-fluid" title="Copy to Clipboard">
                            📋 Copy
                        </button>
                        <button onclick="window.notepad.exportAsText()" class="p-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-fluid" title="Download .TXT">
                            📄 .TXT
                        </button>
                        <button onclick="window.notepad.exportAsMarkdown()" class="p-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-fluid" title="Download .MD">
                            📝 .MD
                        </button>
                        <button onclick="window.notepad.printNotes()" class="p-2 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-fluid shadow-sm" title="Print / PDF">
                            🖨️ Print / PDF
                        </button>
                    </div>
                </div>

                <!-- Tags and Metadata Input -->
                <div class="px-4 py-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900 flex items-center gap-2">
                    <span class="text-[11px] font-semibold text-slate-400">Tags:</span>
                    <input id="note-tags-input" type="text" value="${escapeHtml(tagsString)}" placeholder="#Banking, #SSC-CGL, #StaticGK (comma separated)"
                        oninput="window.notepad.debounceUpdate()"
                        class="flex-1 text-xs bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400" />
                </div>

                <!-- Editor Body -->
                <div class="flex-1 p-4">
                    <textarea id="note-content-input" placeholder="Type your personal exam notes, formulas, high-yield static GK, or click '+ Add to Notepad' from any live card..."
                        oninput="window.notepad.debounceUpdate()"
                        class="w-full h-full min-h-[350px] bg-transparent border-none resize-none focus:outline-none text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans"></textarea>
                </div>

                <!-- Footer Status -->
                <div class="px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
                    <span id="save-status-indicator" class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Saved
                    </span>
                    <span>Last updated: ${new Date(active.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </div>
        `;

        const textarea = document.getElementById('note-content-input');
        if (textarea) {
            textarea.value = active.content;
        }

        if (window.lucide) window.lucide.createIcons();
    }

    debounceUpdate() {
        const indicator = document.getElementById('save-status-indicator');
        if (indicator) {
            indicator.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span> Saving...';
            indicator.className = 'flex items-center gap-1 text-amber-600 dark:text-amber-400';
        }

        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            this.updateActiveNote();
            if (indicator) {
                indicator.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Saved';
                indicator.className = 'flex items-center gap-1 text-emerald-600 dark:text-emerald-400';
            }
        }, 600);
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

window.NotepadManager = NotepadManager;

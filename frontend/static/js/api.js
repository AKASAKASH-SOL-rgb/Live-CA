// API Layer for Live Current Affairs Web App
const API_BASE = '/api';

const api = {
    async getStatus() {
        const res = await fetch(`${API_BASE}/status`);
        return await res.json();
    },

    async triggerSync() {
        const res = await fetch(`${API_BASE}/sync`, { method: 'POST' });
        return await res.json();
    },

    async getArticles(params = {}) {
        const query = new URLSearchParams();
        if (params.exam_target && params.exam_target !== 'all') query.append('exam_target', params.exam_target);
        if (params.category && params.category !== 'All Categories') query.append('category', params.category);
        if (params.source && params.source !== 'all') query.append('source', params.source);
        if (params.search) query.append('search', params.search);
        if (params.date) query.append('date', params.date);
        if (params.limit) query.append('limit', params.limit);
        if (params.offset) query.append('offset', params.offset);

        const res = await fetch(`${API_BASE}/articles?${query.toString()}`);
        return await res.json();
    },

    async getOneLiners(exam_target = 'all') {
        const query = exam_target && exam_target !== 'all' ? `?exam_target=${exam_target}` : '';
        const res = await fetch(`${API_BASE}/one-liners${query}`);
        return await res.json();
    },

    // Bookmarks / Saved Deck
    async getBookmarks() {
        const res = await fetch(`${API_BASE}/bookmarks`);
        return await res.json();
    },

    async saveBookmark(articleId, userNotes = "") {
        const res = await fetch(`${API_BASE}/bookmarks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article_id: articleId, user_notes: userNotes })
        });
        return await res.json();
    },

    async deleteBookmark(articleId) {
        const res = await fetch(`${API_BASE}/bookmarks/${articleId}`, { method: 'DELETE' });
        return await res.json();
    },

    // Study Notepad
    async getNotes() {
        const res = await fetch(`${API_BASE}/notes`);
        return await res.json();
    },

    async createNote(noteData) {
        const res = await fetch(`${API_BASE}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(noteData)
        });
        return await res.json();
    },

    async updateNote(noteId, noteData) {
        const res = await fetch(`${API_BASE}/notes/${noteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(noteData)
        });
        return await res.json();
    },

    async deleteNote(noteId) {
        const res = await fetch(`${API_BASE}/notes/${noteId}`, { method: 'DELETE' });
        return await res.json();
    },

    // Daily Quiz MCQs
    async getDailyQuiz(limit = 10) {
        const res = await fetch(`${API_BASE}/quiz/today?limit=${limit}`);
        return await res.json();
    },

    async submitQuiz(submitData) {
        const res = await fetch(`${API_BASE}/quiz/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submitData)
        });
        return await res.json();
    },

    async getQuizHistory() {
        const res = await fetch(`${API_BASE}/quiz/history`);
        return await res.json();
    }
};

window.api = api;

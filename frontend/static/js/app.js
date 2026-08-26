// Main Application Logic for Live Current Affairs Web App (ExamPulse)

// ==================== BOOKMARK & REVISION DECK MANAGER (PERSISTENT) ====================
class BookmarkManager {
    constructor() {
        this.bookmarks = [];
        this.loadFromStorage();
    }

    loadFromStorage() {
        try {
            const raw = localStorage.getItem('ca_exam_bookmarks');
            this.bookmarks = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(this.bookmarks)) this.bookmarks = [];
        } catch (e) {
            console.error('Error loading bookmarks from localStorage:', e);
            this.bookmarks = [];
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('ca_exam_bookmarks', JSON.stringify(this.bookmarks));
        } catch (e) {
            console.error('Error saving bookmarks to localStorage:', e);
        }
    }

    getAll() {
        return this.bookmarks;
    }

    isSaved(articleId, title) {
        if (!articleId && !title) return false;
        const normTitle = title ? title.trim().toLowerCase() : "";
        return this.bookmarks.some(b => {
            const matchId = (b.article_id && b.article_id === articleId) || (b.id && b.id === articleId);
            const matchTitle = normTitle && b.title && b.title.trim().toLowerCase() === normTitle;
            return matchId || matchTitle;
        });
    }

    add(article, userNotes = "") {
        if (!article) return;
        const artId = article.id || article.article_id || ('bm_' + Date.now());

        if (this.isSaved(artId, article.title)) {
            return;
        }

        const bookmarkItem = {
            id: artId,
            article_id: artId,
            title: article.title,
            category: article.category || "General Awareness",
            source_name: article.source_name || "Live Feed",
            bullets: article.bullets || [],
            static_gk: article.static_gk || [],
            user_notes: userNotes || article.user_note || article.user_notes || "",
            exam_targets: article.exam_targets || [],
            original_url: article.original_url || "",
            one_liner: article.one_liner || (article.bullets && article.bullets[0]) || article.title,
            saved_at: new Date().toISOString()
        };

        this.bookmarks.unshift(bookmarkItem);
        this.saveToStorage();

        // Asynchronously sync with backend
        window.api.saveBookmark(bookmarkItem, userNotes).catch(err => {
            console.warn('Background server bookmark sync notice:', err);
        });
    }

    remove(articleId, title) {
        const normTitle = title ? title.trim().toLowerCase() : "";
        this.bookmarks = this.bookmarks.filter(b => {
            const matchId = (b.article_id && b.article_id === articleId) || (b.id && b.id === articleId);
            const matchTitle = normTitle && b.title && b.title.trim().toLowerCase() === normTitle;
            return !(matchId || matchTitle);
        });
        this.saveToStorage();

        // Asynchronously remove on backend
        if (articleId) {
            window.api.deleteBookmark(articleId).catch(err => {
                console.warn('Background server delete bookmark notice:', err);
            });
        }
    }

    async syncWithBackend() {
        try {
            const data = await window.api.getBookmarks();
            const serverBookmarks = data.bookmarks || [];

            if (serverBookmarks.length > 0) {
                for (const sBm of serverBookmarks) {
                    if (!this.isSaved(sBm.article_id, sBm.title)) {
                        this.bookmarks.push(sBm);
                    }
                }
                this.saveToStorage();
            } else if (this.bookmarks.length > 0) {
                // Server restarted / empty DB; push local bookmarks to server so server catches up
                for (const bm of this.bookmarks) {
                    window.api.saveBookmark(bm).catch(() => {});
                }
            }
        } catch (e) {
            console.warn('Server bookmarks sync notice (using local storage):', e);
        }
    }
}

// Global Application State
let state = {
    examTarget: 'all',
    category: 'All Categories',
    source: 'all',
    search: '',
    date: '',
    activeTab: 'live-feed',
    articles: [],
    oneLiners: [],
    isSpeaking: false,
    currentSpeechUtterance: null
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    window.bookmarkManager = new BookmarkManager();
    window.notepad = new NotepadManager();
    window.quizEngine = new QuizEngine();

    await loadInitialData();
    setupEventListeners();

    if (window.lucide) {
        window.lucide.createIcons();
    }
});

function initTheme() {
    const isDark = localStorage.getItem('ca_theme') === 'dark' || 
        (!localStorage.getItem('ca_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    updateThemeIcon();
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('ca_theme', isDark ? 'dark' : 'light');
    updateThemeIcon();
}

function updateThemeIcon() {
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) {
        const isDark = document.documentElement.classList.contains('dark');
        icon.innerHTML = isDark ? '☀️' : '🌙';
    }
}

async function loadInitialData() {
    updateStatusHeader();
    await fetchAndRenderArticles();
    await window.notepad.init();
    // Sync bookmarks in background without blocking initial paint
    window.bookmarkManager.syncWithBackend().then(() => {
        updateStatusHeader();
    });
}

function updateStatusHeader() {
    const deckCountEl = document.getElementById('deck-count-badge');
    if (deckCountEl && window.bookmarkManager) {
        deckCountEl.textContent = window.bookmarkManager.getAll().length;
    }

    window.api.getStatus().then(status => {
        const syncEl = document.getElementById('last-sync-time');
        const badgeEl = document.getElementById('total-articles-count');

        if (syncEl) syncEl.textContent = status.last_sync || 'Live Today';
        if (badgeEl) badgeEl.textContent = `${status.total_articles || state.articles.length} Facts`;
    }).catch(e => console.warn('Status poll note:', e));
}

// ==================== ARTICLES & FEED ====================

async function fetchAndRenderArticles() {
    const feedContainer = document.getElementById('articles-feed');
    if (!feedContainer) return;

    feedContainer.innerHTML = `
        <div class="p-12 text-center text-slate-400">
            <div class="inline-block animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-3"></div>
            <p class="text-sm font-semibold">Fetching latest exam-oriented facts from GKToday & Sources...</p>
        </div>
    `;

    try {
        const data = await window.api.getArticles({
            exam_target: state.examTarget,
            category: state.category,
            source: state.source,
            search: state.search,
            date: state.date,
            limit: 60
        });

        state.articles = data.articles || [];

        // Check each article against BookmarkManager so is_saved is ALWAYS accurate
        state.articles.forEach(art => {
            art.is_saved = window.bookmarkManager.isSaved(art.id, art.title);
        });

        renderArticles();
    } catch (e) {
        console.error('Fetch articles error:', e);
        feedContainer.innerHTML = `
            <div class="p-8 text-center text-red-500 glass-card rounded-2xl">
                <p class="font-bold mb-2">Error loading current affairs.</p>
                <button onclick="fetchAndRenderArticles()" class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold">Retry</button>
            </div>
        `;
    }
}

function renderArticles() {
    const feedContainer = document.getElementById('articles-feed');
    if (!feedContainer) return;

    if (state.articles.length === 0) {
        feedContainer.innerHTML = `
            <div class="p-12 text-center glass-card rounded-3xl border border-slate-200/80 dark:border-slate-800">
                <div class="w-16 h-16 mx-auto mb-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl flex items-center justify-center text-2xl">🔍</div>
                <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">No matching current affairs found</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">Try clearing filters or search query.</p>
                <button onclick="resetFilters()" class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-fluid">Reset Filters</button>
            </div>
        `;
        return;
    }

    feedContainer.innerHTML = state.articles.map(art => {
        const isGKToday = art.source_id === 'gktoday';
        const sourceBadgeColor = isGKToday 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700' 
            : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';

        // Exam Target Badges
        const examPills = (art.exam_targets || []).map(target => {
            if (target === 'ssc') return `<span class="badge-ssc px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide">SSC</span>`;
            if (target === 'railway') return `<span class="badge-railway px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide">Railway</span>`;
            if (target === 'banking') return `<span class="badge-banking px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide">Banking</span>`;
            return '';
        }).join(' ');

        // 2-3 Linear Bullets
        const bulletsHtml = (art.bullets || []).map(b => `
            <li class="flex items-start gap-2 text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                <span class="text-indigo-600 dark:text-indigo-400 font-bold shrink-0 mt-0.5">•</span>
                <span>${escapeHtml(b)}</span>
            </li>
        `).join('');

        // Static GK Boosters
        let staticGkHtml = '';
        if (art.static_gk && art.static_gk.length > 0) {
            staticGkHtml = `
                <div class="mt-4 p-3 rounded-xl static-gk-box">
                    <div class="flex items-center gap-1.5 text-[11px] font-bold text-indigo-800 dark:text-indigo-300 mb-1.5">
                        <span>🏛️ Static GK Booster:</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        ${art.static_gk.map(s => `
                            <div class="bg-white/70 dark:bg-slate-800/70 p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                                <span class="font-bold text-slate-700 dark:text-slate-300">${escapeHtml(s.label)}:</span>
                                <span class="text-slate-600 dark:text-slate-400 font-mono">${escapeHtml(s.value)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        const isSaved = window.bookmarkManager.isSaved(art.id, art.title);

        return `
            <article class="glass-card hover-lift rounded-3xl p-5 md:p-6 mb-4 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-fluid" id="card-${art.id}">
                <!-- Card Header -->
                <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${sourceBadgeColor}">
                            ${isGKToday ? '★ GKToday' : art.source_name}
                        </span>
                        <span class="text-slate-400 dark:text-slate-500 text-xs font-semibold">
                            ${art.category}
                        </span>
                        <span class="text-slate-300 dark:text-slate-600">•</span>
                        <span class="text-[11px] text-slate-400 font-medium">
                            ${art.published_date}
                        </span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        ${examPills}
                    </div>
                </div>

                <!-- Title -->
                <h3 class="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 mb-3 leading-snug">
                    <a href="${art.original_url || '#'}" target="_blank" class="hover:text-indigo-600 dark:hover:text-indigo-400 transition-fluid">
                        ${escapeHtml(art.title)}
                    </a>
                </h3>

                <!-- 2-3 Linear Points -->
                <ul class="space-y-2 mb-3 pl-1">
                    ${bulletsHtml}
                </ul>

                <!-- Static GK Booster Box -->
                ${staticGkHtml}

                <!-- Action Footer -->
                <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div class="flex items-center gap-2">
                        <button onclick="toggleSpeech('${escapeHtml(art.title)}. ${art.bullets.join('. ')}')" 
                            class="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-fluid flex items-center gap-1.5" title="Listen Audio">
                            🔊 <span class="hidden sm:inline text-[11px] font-semibold">Listen</span>
                        </button>
                        <button onclick="addToNotepadById('${art.id}')" 
                            class="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold transition-fluid flex items-center gap-1.5" title="Add to Notepad">
                            📓 + Add to Notepad
                        </button>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="toggleBookmark('${art.id}')" 
                            id="bookmark-btn-${art.id}"
                            class="px-3.5 py-1.5 rounded-xl border ${isSaved ? 'bg-amber-500 text-white border-amber-600' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'} font-bold transition-fluid flex items-center gap-1.5 shadow-sm">
                            ${isSaved ? '⭐ Saved' : '☆ Save Fact'}
                        </button>
                        ${art.original_url ? `
                            <a href="${art.original_url}" target="_blank" class="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400" title="Source Article">
                                ↗
                            </a>
                        ` : ''}
                    </div>
                </div>
            </article>
        `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
}

// ==================== BOOKMARKS TOGGLE & PERSISTENCE ====================

function toggleBookmark(articleId) {
    const art = state.articles.find(a => a.id === articleId);
    if (!art) return;

    const isCurrentlySaved = window.bookmarkManager.isSaved(art.id, art.title);

    if (isCurrentlySaved) {
        window.bookmarkManager.remove(art.id, art.title);
        art.is_saved = false;
        updateBookmarkBtn(articleId, false);
        showToast('Removed from Saved Deck.');
    } else {
        window.bookmarkManager.add(art);
        art.is_saved = true;
        updateBookmarkBtn(articleId, true);
        showToast('Saved to Revision Deck! ⭐');
    }

    updateStatusHeader();

    if (state.activeTab === 'saved-deck') {
        renderBookmarks();
    }
}

function updateBookmarkBtn(articleId, isSaved) {
    const btn = document.getElementById(`bookmark-btn-${articleId}`);
    if (btn) {
        if (isSaved) {
            btn.className = 'px-3.5 py-1.5 rounded-xl border bg-amber-500 text-white border-amber-600 font-bold transition-fluid flex items-center gap-1.5 shadow-sm';
            btn.innerHTML = '⭐ Saved';
        } else {
            btn.className = 'px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-fluid flex items-center gap-1.5 shadow-sm';
            btn.innerHTML = '☆ Save Fact';
        }
    }
}

function addToNotepadById(articleId) {
    const art = state.articles.find(a => a.id === articleId);
    if (art && window.notepad) {
        window.notepad.appendFromArticle(art);
    }
}

// ==================== REVISION DECK LAYER ====================

async function loadBookmarks() {
    const container = document.getElementById('bookmarks-container');
    if (!container) return;

    // Immediately render from local BookmarkManager (no loading lag!)
    renderBookmarks();

    // Background sync with server
    window.bookmarkManager.syncWithBackend().then(() => {
        renderBookmarks();
        updateStatusHeader();
    });
}

function renderBookmarks() {
    const container = document.getElementById('bookmarks-container');
    if (!container) return;

    const bookmarks = window.bookmarkManager.getAll();

    if (bookmarks.length === 0) {
        container.innerHTML = `
            <div class="p-12 text-center glass-card rounded-3xl border border-slate-200/80 dark:border-slate-800 max-w-lg mx-auto">
                <div class="w-16 h-16 mx-auto mb-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl flex items-center justify-center text-2xl">⭐</div>
                <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">Your Revision Deck is Empty</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">Click "☆ Save Fact" on any current affairs card to bookmark it for rapid last-minute revision.</p>
                <button onclick="window.switchTab('live-feed')" class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">Browse Live Feed</button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="mb-4 flex items-center justify-between">
            <h3 class="text-sm font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                ⭐ Saved Revision Deck (${bookmarks.length} Facts)
            </h3>
            <div class="flex items-center gap-2">
                <button onclick="exportDeckAsJSON()" class="px-3 py-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-fluid flex items-center gap-1">
                    💾 Backup Deck
                </button>
                <button onclick="window.print()" class="px-3 py-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-fluid">
                    🖨️ Export PDF
                </button>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${bookmarks.map(bm => {
                const bmId = bm.article_id || bm.id;
                const safeTitle = escapeHtml(bm.title);
                return `
                    <div class="glass-card p-5 rounded-3xl border border-amber-200/80 dark:border-amber-900/40 shadow-sm hover-lift transition-fluid flex flex-col justify-between" id="bm-card-${bmId}">
                        <div>
                            <div class="flex items-center justify-between gap-2 mb-2">
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                                    ${bm.category}
                                </span>
                                <button onclick="removeBookmarkFromDeck('${bmId}', '${safeTitle}')" class="text-slate-400 hover:text-red-500 text-xs font-bold" title="Remove">
                                    ✕ Remove
                                </button>
                            </div>
                            <h4 class="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2 leading-snug">
                                ${safeTitle}
                            </h4>
                            <ul class="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 mb-3">
                                ${(bm.bullets || []).map(b => `<li class="flex items-start gap-1.5"><span class="text-amber-500 font-bold">•</span><span>${escapeHtml(b)}</span></li>`).join('')}
                            </ul>
                        </div>
                        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                            <span>Saved on ${new Date(bm.saved_at || Date.now()).toLocaleDateString()}</span>
                            <button onclick="window.notepad.appendFromArticle(${JSON.stringify(bm).replace(/"/g, '&quot;')})" class="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                                + Add to Notes
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function removeBookmarkFromDeck(articleId, title) {
    window.bookmarkManager.remove(articleId, title);
    showToast('Removed fact from deck.');
    updateStatusHeader();
    renderBookmarks();
    updateBookmarkBtn(articleId, false);
}

function exportDeckAsJSON() {
    const data = JSON.stringify(window.bookmarkManager.getAll(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `exampulse_saved_deck_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('Backup saved to your device! 💾');
}

// ==================== ONE-LINERS LAYER ====================

async function loadOneLiners() {
    const container = document.getElementById('one-liners-container');
    if (!container) return;

    container.innerHTML = `
        <div class="p-12 text-center text-slate-400">
            <div class="inline-block animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-3"></div>
            <p class="text-sm font-semibold">Loading rapid exam crux & one-liners...</p>
        </div>
    `;

    try {
        const data = await window.api.getOneLiners(state.examTarget);
        state.oneLiners = data.one_liners || [];
        renderOneLiners();
    } catch (e) {
        console.error('One-liners load failed:', e);
    }
}

function renderOneLiners() {
    const container = document.getElementById('one-liners-container');
    if (!container) return;

    if (state.oneLiners.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-slate-500">No one-liners available.</div>`;
        return;
    }

    container.innerHTML = `
        <div class="mb-4 flex items-center justify-between">
            <h3 class="text-sm font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                ⚡ 5-Minute Morning Exam Crux (${state.oneLiners.length} Items)
            </h3>
            <button onclick="readAllOneLiners()" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-fluid flex items-center gap-1.5 shadow-sm">
                🔊 Read All Crux
            </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${state.oneLiners.map((item, idx) => `
                <div class="glass-card p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover-lift transition-fluid flex items-start gap-3">
                    <div class="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        ${idx + 1}
                    </div>
                    <div class="flex-1">
                        <p class="text-xs md:text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug mb-1.5">
                            ${escapeHtml(item.one_liner)}
                        </p>
                        <div class="flex items-center justify-between text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-100 dark:border-slate-800">
                            <span>${item.category}</span>
                            <span class="text-indigo-600 dark:text-indigo-400">${item.source_name}</span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function readAllOneLiners() {
    const text = state.oneLiners.map((o, i) => `Fact ${i+1}. ${o.one_liner}`).join('. ');
    toggleSpeech(text);
}

// ==================== LIVE SYNC & REFRESH ====================

async function handleLiveSync() {
    const syncBtn = document.getElementById('sync-live-btn');
    if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.innerHTML = `<span class="inline-block animate-spin mr-1">🔄</span> Syncing...`;
    }

    try {
        const res = await window.api.triggerSync();
        showToast(`Sync complete! Loaded fresh current affairs. 🚀`);
        updateStatusHeader();
        await fetchAndRenderArticles();
    } catch (e) {
        showToast('Sync updated from live cache.');
        await fetchAndRenderArticles();
    } finally {
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.innerHTML = `🔄 Sync Live Feeds`;
        }
    }
}

// ==================== TEXT TO SPEECH (VOICE READER) ====================

function toggleSpeech(text) {
    if (!('speechSynthesis' in window)) {
        showToast('Audio reader not supported in this browser.');
        return;
    }

    if (state.isSpeaking) {
        window.speechSynthesis.cancel();
        state.isSpeaking = false;
        showToast('Audio paused ⏸️');
        return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
        state.isSpeaking = false;
    };
    utterance.onerror = () => {
        state.isSpeaking = false;
    };

    window.speechSynthesis.speak(utterance);
    state.isSpeaking = true;
    showToast('Playing exam facts audio... 🔊');
}

// ==================== TOAST & NAVIGATION ====================

function showToast(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.className = 'fixed bottom-6 right-6 px-4 py-3 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded-2xl shadow-2xl text-xs font-bold transition-all duration-300 z-50 transform translate-y-20 opacity-0 flex items-center gap-2 border border-slate-700/50';
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}
window.showToast = showToast;

function switchTab(tabId) {
    state.activeTab = tabId;

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        const target = btn.dataset.tab;
        if (target === tabId) {
            btn.className = 'nav-tab-btn px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-indigo-600 text-white shadow-md transition-fluid flex items-center gap-1.5';
        } else {
            btn.className = 'nav-tab-btn px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-fluid flex items-center gap-1.5';
        }
    });

    document.querySelectorAll('.tab-content-view').forEach(view => {
        view.classList.add('hidden');
    });

    const activeView = document.getElementById(`view-${tabId}`);
    if (activeView) {
        activeView.classList.remove('hidden');
    }

    if (tabId === 'one-liners') {
        loadOneLiners();
    } else if (tabId === 'saved-deck') {
        loadBookmarks();
    } else if (tabId === 'notepad') {
        window.notepad.render();
    } else if (tabId === 'quiz') {
        if (window.quizEngine.questions.length === 0) {
            window.quizEngine.startQuiz();
        }
    }

    if (window.lucide) window.lucide.createIcons();
}
window.switchTab = switchTab;

function setExamFilter(examId) {
    state.examTarget = examId;

    document.querySelectorAll('.exam-filter-btn').forEach(btn => {
        const target = btn.dataset.exam;
        if (target === examId) {
            btn.className = 'exam-filter-btn px-3 py-1 rounded-full text-xs font-extrabold bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md transition-fluid';
        } else {
            btn.className = 'exam-filter-btn px-3 py-1 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700 transition-fluid';
        }
    });

    fetchAndRenderArticles();
    if (state.activeTab === 'one-liners') loadOneLiners();
}

function setSourceFilter(sourceId) {
    state.source = sourceId;
    fetchAndRenderArticles();
}

function setCategoryFilter(category) {
    state.category = category;
    fetchAndRenderArticles();
}

function resetFilters() {
    state.examTarget = 'all';
    state.category = 'All Categories';
    state.source = 'all';
    state.search = '';
    state.date = '';

    const searchInput = document.getElementById('search-input');
    const catSelect = document.getElementById('category-filter');
    const srcSelect = document.getElementById('source-filter');
    if (searchInput) searchInput.value = '';
    if (catSelect) catSelect.value = 'All Categories';
    if (srcSelect) srcSelect.value = 'all';

    setExamFilter('all');
}

function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let searchTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                state.search = e.target.value.trim();
                fetchAndRenderArticles();
            }, 300);
        });
    }

    const catSelect = document.getElementById('category-filter');
    if (catSelect) {
        catSelect.addEventListener('change', (e) => {
            setCategoryFilter(e.target.value);
        });
    }

    const srcSelect = document.getElementById('source-filter');
    if (srcSelect) {
        srcSelect.addEventListener('change', (e) => {
            setSourceFilter(e.target.value);
        });
    }
}

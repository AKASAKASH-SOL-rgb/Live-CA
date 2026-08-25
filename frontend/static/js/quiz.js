// Daily Practice Quiz Engine (SSC, Railways & Banking MCQs)

class QuizEngine {
    constructor() {
        this.questions = [];
        this.currentIndex = 0;
        this.selectedAnswers = {};
        this.score = 0;
        this.isFinished = false;
        this.timer = 0;
        this.timerInterval = null;
    }

    async startQuiz(limit = 10) {
        const container = document.getElementById('quiz-container');
        if (!container) return;

        container.innerHTML = `
            <div class="p-12 text-center text-slate-500 dark:text-slate-400">
                <div class="inline-block animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-3"></div>
                <p class="text-sm font-semibold">Generating today's exam-oriented MCQs from GKToday & Live Feeds...</p>
            </div>
        `;

        try {
            const data = await window.api.getDailyQuiz(limit);
            this.questions = data.questions || [];
            this.currentIndex = 0;
            this.selectedAnswers = {};
            this.score = 0;
            this.isFinished = false;
            this.startTimer();
            this.render();
        } catch (e) {
            console.error('Quiz start failed:', e);
            container.innerHTML = `
                <div class="p-8 text-center text-red-500">
                    <p class="font-bold">Failed to load quiz. Please make sure backend is running.</p>
                    <button onclick="window.quizEngine.startQuiz()" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Retry</button>
                </div>
            `;
        }
    }

    startTimer() {
        clearInterval(this.timerInterval);
        this.timer = 0;
        this.timerInterval = setInterval(() => {
            this.timer++;
            const timerEl = document.getElementById('quiz-timer');
            if (timerEl) {
                const mins = String(Math.floor(this.timer / 60)).padStart(2, '0');
                const secs = String(this.timer % 60).padStart(2, '0');
                timerEl.textContent = `${mins}:${secs}`;
            }
        }, 1000);
    }

    selectOption(optIndex) {
        if (this.selectedAnswers[this.currentIndex] !== undefined) return; // Already answered

        this.selectedAnswers[this.currentIndex] = optIndex;
        const currentQ = this.questions[this.currentIndex];
        if (optIndex === currentQ.correct_index) {
            this.score++;
        }
        this.render();
    }

    nextQuestion() {
        if (this.currentIndex < this.questions.length - 1) {
            this.currentIndex++;
            this.render();
        } else {
            this.finishQuiz();
        }
    }

    prevQuestion() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.render();
        }
    }

    async finishQuiz() {
        clearInterval(this.timerInterval);
        this.isFinished = true;

        // Submit score to backend
        try {
            await window.api.submitQuiz({
                date: new Date().toISOString().split('T')[0],
                score: this.score,
                total_questions: this.questions.length,
                answers: this.questions.map((q, idx) => ({
                    question_id: q.id,
                    selected: this.selectedAnswers[idx],
                    correct: q.correct_index,
                    is_correct: this.selectedAnswers[idx] === q.correct_index
                }))
            });
        } catch (e) {
            console.error('Quiz submit failed:', e);
        }

        this.render();
    }

    render() {
        const container = document.getElementById('quiz-container');
        if (!container) return;

        if (this.questions.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center glass-card rounded-2xl">
                    <p class="text-sm text-slate-500">No MCQs available. Click below to generate.</p>
                    <button onclick="window.quizEngine.startQuiz()" class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-fluid">
                        Start Today's Quiz
                    </button>
                </div>
            `;
            return;
        }

        if (this.isFinished) {
            this.renderScorecard(container);
            return;
        }

        const q = this.questions[this.currentIndex];
        const hasAnswered = this.selectedAnswers[this.currentIndex] !== undefined;
        const userChoice = this.selectedAnswers[this.currentIndex];
        const progressPercent = ((this.currentIndex + 1) / this.questions.length) * 100;

        container.innerHTML = `
            <div class="glass-card rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/80 dark:border-slate-800 max-w-3xl mx-auto transition-fluid">
                <!-- Quiz Header -->
                <div class="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div class="flex items-center gap-2">
                        <span class="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                            ${q.exam_target}
                        </span>
                        <span class="text-xs font-semibold text-slate-400 dark:text-slate-500">
                            ${q.category}
                        </span>
                    </div>
                    <div class="flex items-center gap-4 text-xs font-bold text-slate-600 dark:text-slate-300">
                        <span class="flex items-center gap-1">
                            ⏱️ <span id="quiz-timer" class="font-mono">00:00</span>
                        </span>
                        <span>Q ${this.currentIndex + 1} / ${this.questions.length}</span>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mb-6 overflow-hidden">
                    <div class="bg-indigo-600 h-full rounded-full transition-all duration-300" style="width: ${progressPercent}%"></div>
                </div>

                <!-- Question Text -->
                <h3 class="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 leading-snug">
                    ${escapeHtml(q.question)}
                </h3>

                <!-- 4 Options Grid -->
                <div class="space-y-3 mb-6">
                    ${q.options.map((opt, idx) => {
                        let optClass = 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-white/50 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200';
                        let badge = String.fromCharCode(65 + idx); // A, B, C, D
                        let indicatorIcon = '';

                        if (hasAnswered) {
                            if (idx === q.correct_index) {
                                optClass = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-sm';
                                indicatorIcon = '✅';
                            } else if (idx === userChoice) {
                                optClass = 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 shadow-sm';
                                indicatorIcon = '❌';
                            } else {
                                optClass = 'opacity-50 border-slate-200 dark:border-slate-800 bg-transparent text-slate-500';
                            }
                        }

                        return `
                            <button onclick="window.quizEngine.selectOption(${idx})" 
                                class="w-full text-left p-4 rounded-2xl border-2 transition-fluid flex items-start gap-3.5 ${optClass} ${!hasAnswered ? 'cursor-pointer' : 'cursor-default'}">
                                <span class="w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${hasAnswered && idx === q.correct_index ? 'bg-emerald-600 text-white' : (hasAnswered && idx === userChoice ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300')}">
                                    ${badge}
                                </span>
                                <span class="flex-1 text-xs md:text-sm font-medium pt-0.5 leading-relaxed">${escapeHtml(opt)}</span>
                                <span class="text-sm">${indicatorIcon}</span>
                            </button>
                        `;
                    }).join('')}
                </div>

                <!-- Explanation Box (reveals upon answering) -->
                ${hasAnswered ? `
                    <div class="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 mb-6 transition-fluid">
                        <div class="flex items-center gap-1.5 text-xs font-extrabold text-indigo-700 dark:text-indigo-300 mb-1">
                            💡 Detailed Exam Explanation & GK Booster
                        </div>
                        <p class="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">${escapeHtml(q.explanation)}</p>
                    </div>
                ` : ''}

                <!-- Navigation Controls -->
                <div class="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button onclick="window.quizEngine.prevQuestion()" ${this.currentIndex === 0 ? 'disabled' : ''} 
                        class="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-fluid">
                        ← Previous
                    </button>
                    <button onclick="window.quizEngine.nextQuestion()" 
                        class="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-fluid flex items-center gap-2">
                        ${this.currentIndex === this.questions.length - 1 ? 'Finish Quiz & View Score 🎉' : 'Next Question →'}
                    </button>
                </div>
            </div>
        `;
    }

    renderScorecard(container) {
        const total = this.questions.length;
        const percent = Math.round((this.score / total) * 100);
        let grade = "Excellent Readiness! 🌟";
        let gradeColor = "text-emerald-600 dark:text-emerald-400";
        if (percent < 50) {
            grade = "Needs Daily Revision 📖";
            gradeColor = "text-amber-600 dark:text-amber-400";
        } else if (percent < 80) {
            grade = "Good Exam Preparation 👍";
            gradeColor = "text-blue-600 dark:text-blue-400";
        }

        container.innerHTML = `
            <div class="glass-card rounded-3xl p-8 shadow-2xl border border-slate-200/80 dark:border-slate-800 max-w-2xl mx-auto text-center">
                <div class="w-20 h-20 mx-auto mb-4 rounded-3xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-3xl shadow-inner">
                    🏆
                </div>
                <h2 class="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mb-1">Quiz Completed!</h2>
                <p class="text-sm font-bold ${gradeColor} mb-6">${grade}</p>

                <!-- Score Numbers -->
                <div class="grid grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl mb-8 border border-slate-200/70 dark:border-slate-700/60">
                    <div>
                        <div class="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">${this.score} / ${total}</div>
                        <div class="text-[11px] font-semibold text-slate-400">Score</div>
                    </div>
                    <div>
                        <div class="text-2xl font-extrabold text-slate-800 dark:text-slate-200">${percent}%</div>
                        <div class="text-[11px] font-semibold text-slate-400">Accuracy</div>
                    </div>
                    <div>
                        <div class="text-2xl font-extrabold text-slate-800 dark:text-slate-200">${Math.floor(this.timer / 60)}m ${this.timer % 60}s</div>
                        <div class="text-[11px] font-semibold text-slate-400">Time Taken</div>
                    </div>
                </div>

                <!-- Actions -->
                <div class="flex items-center justify-center gap-3">
                    <button onclick="window.quizEngine.startQuiz()" class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg transition-fluid">
                        🔄 Retake Today's Quiz
                    </button>
                    <button onclick="window.switchTab('live-feed')" class="px-5 py-3 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-fluid">
                        📰 Revise Live Feed
                    </button>
                </div>
            </div>
        `;
    }
}

window.QuizEngine = QuizEngine;

// ================================================================
// QUIZ ENGINE — Firestore + Bootstrap 5
// ================================================================

const urlParams = new URLSearchParams(window.location.search);
const quizId    = urlParams.get('id');

let quiz = null, questions = [], currentIndex = 0, score = 0;
let userHistory = [], startTime = null, timerInterval = null;
let currentUser = null, currentUserData = null;

// DOM refs
const titleEl       = document.getElementById('quiz-title');
const questionText  = document.getElementById('question-text');
const optionsList   = document.getElementById('options-list');
const questionCount = document.getElementById('question-count');
const progressBar   = document.getElementById('progress-bar');
const imgEl         = document.getElementById('question-img');
const jumpInput     = document.getElementById('jump-input');
const prevBtn       = document.getElementById('prev-btn');
const nextBtn       = document.getElementById('next-btn');
const checkBtn      = document.getElementById('check-btn');
const timerDisplay  = document.getElementById('timer-display');
const timerText     = document.getElementById('timer-text');
const savingOverlay = document.getElementById('saving-overlay');

if (!quizId) {
    window.location.href = 'index.html';
} else {
    requireAuth(async (user, userData) => {
        currentUser     = user;
        currentUserData = userData;
        await loadQuiz();
    });
}

// ── Load quiz from Firestore ───────────────────────────────────

async function loadQuiz() {
    try {
        const quizDoc = await db.collection('quizzes').doc(quizId).get();
        if (!quizDoc.exists || !quizDoc.data().isActive) {
            showToast('Тест табылмады немесе белсенді емес', 'error');
            setTimeout(() => window.location.href = 'index.html', 1500);
            return;
        }
        quiz = { id: quizDoc.id, ...quizDoc.data() };

        // Access check: if restricted, verify user is in allowedUsers
        if (quiz.accessType === 'restricted') {
            const allowed = Array.isArray(quiz.allowedUsers) ? quiz.allowedUsers : [];
            if (!allowed.includes(currentUser.uid)) {
                showToast('Бұл тестке рұқсатыңыз жоқ', 'error');
                setTimeout(() => window.location.href = 'index.html', 1800);
                return;
            }
        }

        titleEl.textContent  = quiz.title;
        document.title       = quiz.title;

        const qSnap = await db.collection('quizzes').doc(quizId)
            .collection('questions').orderBy('order').get();

        questions = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (questions.length === 0) {
            showToast('Бұл тестте сұрақтар жоқ', 'error');
            setTimeout(() => window.location.href = 'index.html', 1500);
            return;
        }

        if (quiz.randomOrder) shuffleArray(questions);

        // Pre-shuffle options once per question
        questions.forEach(q => {
            const isMulti = Array.isArray(q.correct);
            const opts = q.options.map((text, idx) => ({
                text,
                isCorrect: isMulti ? q.correct.includes(idx) : idx === q.correct
            }));
            q.shuffledOptions = shuffleArray([...opts]);
        });

        userHistory = new Array(questions.length).fill(null);
        startTime   = Date.now();

        if (quiz.timeLimit > 0) startTimer(quiz.timeLimit * 60);

        loadQuestion();
    } catch (err) {
        console.error(err);
        showToast('Деректерді жүктеу қатесі', 'error');
    }
}

// ── Timer ──────────────────────────────────────────────────────

function startTimer(totalSeconds) {
    let remaining = totalSeconds;
    timerDisplay.style.display = 'inline-flex';
    updateTimerDisplay(remaining);

    timerInterval = setInterval(() => {
        remaining--;
        updateTimerDisplay(remaining);
        if (remaining <= 60) timerDisplay.classList.add('urgent');
        if (remaining <= 0) {
            clearInterval(timerInterval);
            showToast('Уақыт бітті! Нәтиже сақталуда...', 'info');
            finishQuiz();
        }
    }, 1000);
}

function updateTimerDisplay(s) {
    timerText.textContent =
        `${Math.floor(s / 60).toString().padStart(2,'0')}:${(s % 60).toString().padStart(2,'0')}`;
}

// ── Render question ────────────────────────────────────────────

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function loadQuestion() {
    const data  = questions[currentIndex];
    const total = questions.length;
    const isMulti = Array.isArray(data.correct);

    questionText.textContent  = `${currentIndex + 1}. ${data.question}`;
    questionCount.textContent = `Сұрақ ${currentIndex + 1} / ${total}`;
    progressBar.style.width   = `${((currentIndex + 1) / total) * 100}%`;

    imgEl.style.display = data.img ? 'block' : 'none';
    if (data.img) imgEl.src = data.img;

    prevBtn.style.display  = currentIndex > 0 ? '' : 'none';
    nextBtn.style.display  = 'none';
    checkBtn.style.display = 'none';

    optionsList.innerHTML = '';

    data.shuffledOptions.forEach((opt, uiIdx) => {
        const div = document.createElement('div');
        div.className = 'option-item d-flex align-items-center gap-3 p-3';
        div.innerHTML = `<span class="option-letter">${OPTION_LETTERS[uiIdx] || (uiIdx + 1)}</span><span class="option-text flex-grow-1">${opt.text}</span>`;
        div.dataset.isCorrect = opt.isCorrect;
        div.dataset.uiIndex   = uiIdx;
        div.onclick = () => selectOption(div, uiIdx, isMulti);
        optionsList.appendChild(div);
    });

    const history = userHistory[currentIndex];
    if (history?.answered) restoreState(history);
    else if (isMulti) checkBtn.style.display = '';
}

function restoreState(history) {
    const opts = optionsList.children;
    for (let i = 0; i < opts.length; i++) {
        opts[i].classList.add('disabled');
        if (opts[i].dataset.isCorrect === 'true') opts[i].classList.add('correct');
        if (history.selectedIndices.includes(i) && opts[i].dataset.isCorrect !== 'true')
            opts[i].classList.add('wrong');
    }
    checkBtn.style.display = 'none';
    nextBtn.style.display  = '';
}

// ── Select ─────────────────────────────────────────────────────

function selectOption(div, uiIdx, isMulti) {
    if (div.classList.contains('disabled')) return;
    if (isMulti) {
        div.classList.toggle('selected');
    } else {
        checkSingleAnswer(div, uiIdx);
    }
}

function checkSingleAnswer(div, uiIdx) {
    const isCorrect = div.dataset.isCorrect === 'true';
    if (isCorrect) score++;

    const opts = optionsList.children;
    for (let i = 0; i < opts.length; i++) {
        opts[i].classList.add('disabled');
        if (opts[i].dataset.isCorrect === 'true') opts[i].classList.add('correct');
    }
    if (!isCorrect) div.classList.add('wrong');

    userHistory[currentIndex] = { answered: true, selectedIndices: [uiIdx], isCorrect };
    nextBtn.style.display = '';
}

function checkMultiAnswer() {
    const opts = optionsList.children;
    let allCorrect = true, noWrong = true;
    const selectedIndices = [];

    for (let i = 0; i < opts.length; i++) {
        const sel     = opts[i].classList.contains('selected');
        const correct = opts[i].dataset.isCorrect === 'true';
        if (sel) selectedIndices.push(i);

        opts[i].classList.add('disabled');
        opts[i].classList.remove('selected');

        if (correct) {
            opts[i].classList.add('correct');
            if (!sel) allCorrect = false;
        }
        if (sel && !correct) {
            opts[i].classList.add('wrong');
            noWrong = false;
        }
    }

    const isCorrect = allCorrect && noWrong;
    if (isCorrect) score++;

    userHistory[currentIndex] = { answered: true, selectedIndices, isCorrect };
    checkBtn.style.display = 'none';
    nextBtn.style.display  = '';
}

// ── Navigation ─────────────────────────────────────────────────

function nextQuestion() {
    currentIndex < questions.length - 1 ? (currentIndex++, loadQuestion()) : finishQuiz();
}

function prevQuestion() {
    if (currentIndex > 0) { currentIndex--; loadQuestion(); }
}

function jumpToQuestion() {
    const val = parseInt(jumpInput.value);
    if (val >= 1 && val <= questions.length) {
        currentIndex = val - 1;
        loadQuestion();
        jumpInput.value = '';
    } else {
        showToast(`1–${questions.length} аралығында сан енгізіңіз`, 'error');
    }
}

jumpInput.addEventListener('keypress', e => { if (e.key === 'Enter') jumpToQuestion(); });

// ── Save & redirect ────────────────────────────────────────────

async function finishQuiz() {
    clearInterval(timerInterval);
    savingOverlay.style.display = 'flex';

    const timeTaken  = Math.floor((Date.now() - startTime) / 1000);
    const total      = questions.length;
    const percentage = Math.round((score / total) * 100);

    const answers = questions.map((q, i) => {
        const h = userHistory[i];
        return {
            questionId:     q.id,
            question:       q.question,
            options:        q.shuffledOptions.map(o => o.text),
            correctIndices: q.shuffledOptions.reduce((a, o, idx) => { if (o.isCorrect) a.push(idx); return a; }, []),
            selectedIndices: h ? h.selectedIndices : [],
            isCorrect:       h ? h.isCorrect : false
        };
    });

    try {
        const userName  = currentUserData.name || currentUser.email;
        const resultRef = await db.collection('results').add({
            userId: currentUser.uid, userName,
            userEmail: currentUser.email,
            quizId, quizTitle: quiz.title,
            score, total, percentage, timeTaken, answers,
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Personal best leaderboard
        const docId = `${quizId}_${currentUser.uid}`;
        const lbRef = db.collection('leaderboard').doc(docId);
        const ex    = await lbRef.get();
        const better = !ex.exists || percentage > ex.data().percentage
            || (percentage === ex.data().percentage && timeTaken < ex.data().timeTaken);
        if (better) await lbRef.set({
            userId: currentUser.uid, userName,
            quizId, quizTitle: quiz.title,
            score, total, percentage, timeTaken,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        window.location.href = `results.html?id=${resultRef.id}`;
    } catch (err) {
        console.error(err);
        savingOverlay.style.display = 'none';
        showToast('Сақтау кезінде қате орын алды', 'error');
    }
}

// ── Util ───────────────────────────────────────────────────────

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

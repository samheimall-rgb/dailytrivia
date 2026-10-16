const STORAGE_KEY_STATE = 'daily_trivia_state_v1';
const STORAGE_KEY_STREAK = 'daily_trivia_streak_v1';

// DOM Elements
const loadingEl = document.getElementById('loading');
const quizContainer = document.getElementById('quiz-container');
const completedContainer = document.getElementById('completed-container');
const categoryBadge = document.getElementById('category-badge');
const difficultyBadge = document.getElementById('difficulty-badge');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const feedbackContainer = document.getElementById('feedback-container');
const feedbackText = document.getElementById('feedback-text');
const factReveal = document.getElementById('fact-reveal');
const streakCountEl = document.getElementById('streak-count');
const recapBox = document.getElementById('recap-box');

// Helper to decode HTML entities returned by OpenTDB API
function decodeHTML(html) {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
}

// Get today's date string in YYYY-MM-DD format
function getTodayDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

// Initialize App
function init() {
    loadStreak();
    checkDailyStatus();
}

// Load streak from localStorage and check if streak is broken
function loadStreak() {
    const savedStreakData = JSON.parse(localStorage.getItem(STORAGE_KEY_STREAK)) || { count: 0, lastDate: null };
    const today = getTodayDateString();
    
    if (savedStreakData.lastDate) {
        const lastDateObj = new Date(savedStreakData.lastDate);
        const todayObj = new Date(today);
        const diffTime = Math.abs(todayObj - lastDateObj);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // If more than 1 day skipped (and it's not today), streak is reset
        if (diffDays > 1 && savedStreakData.lastDate !== today) {
            savedStreakData.count = 0;
        }
    }

    streakCountEl.textContent = savedStreakData.count;
    return savedStreakData.count;
}

// Check if user has already answered today
async function checkDailyStatus() {
    const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY_STATE));
    const today = getTodayDateString();

    if (savedState && savedState.date === today) {
        // Already answered today
        loadingEl.classList.add('hidden');
        completedContainer.classList.remove('hidden');
        
        recapBox.innerHTML = `
            <strong>Today's Question:</strong> ${decodeHTML(savedState.question)}<br><br>
            <strong>Your Answer:</strong> <span style="color: ${savedState.correct ? 'var(--success)' : 'var(--error)'}">${decodeHTML(savedState.userAnswer)}</span><br>
            <strong>Correct Answer:</strong> ${decodeHTML(savedState.correctAnswer)}
        `;
    } else {
        // Fetch a new question for today
        fetchDailyQuestion();
    }
}

// Fetch question from Open Trivia Database API
async function fetchDailyQuestion() {
    try {
        // Using OpenTDB API (fetching a mixed general knowledge/science question)
        const response = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const qData = data.results[0];
            setupQuiz(qData);
        } else {
            throw new Error('No questions returned');
        }
    } catch (error) {
        loadingEl.textContent = 'Failed to load trivia. Please refresh the page to try again.';
        console.error(error);
    }
}

// Setup quiz interface
function setupQuiz(qData) {
    const correctAnswer = qData.correct_answer;
    const incorrectAnswers = qData.incorrect_answers;
    
    // Combine and shuffle options
    const options = [...incorrectAnswers, correctAnswer];
    options.sort(() => Math.random() - 0.5);

    categoryBadge.textContent = qData.category;
    difficultyBadge.textContent = qData.difficulty;
    questionText.textContent = decodeHTML(qData.question);

    optionsContainer.innerHTML = '';
    options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = decodeHTML(option);
        btn.addEventListener('click', () => handleAnswerSelection(option, correctAnswer, qData));
        optionsContainer.appendChild(btn);
    });

    loadingEl.classList.add('hidden');
    quizContainer.classList.remove('hidden');
}

// Handle answer selection
function handleAnswerSelection(selectedOption, correctAnswer, qData) {
    const buttons = optionsContainer.querySelectorAll('.option-btn');
    const isCorrect = selectedOption === correctAnswer;

    // Disable all option buttons
    buttons.forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === decodeHTML(correctAnswer)) {
            btn.classList.add('correct');
        } else if (btn.textContent === decodeHTML(selectedOption) && !isCorrect) {
            btn.classList.add('incorrect');
        }
    });

    // Update streak data
    const today = getTodayDateString();
    let currentStreakData = JSON.parse(localStorage.getItem(STORAGE_KEY_STREAK)) || { count: 0, lastDate: null };

    if (isCorrect) {
        // Only increment if they haven't already completed today's count update
        if (currentStreakData.lastDate !== today) {
            currentStreakData.count += 1;
            currentStreakData.lastDate = today;
            localStorage.setItem(STORAGE_KEY_STREAK, JSON.stringify(currentStreakData));
        }
        feedbackText.textContent = "Correct! 🎉 Great job!";
        feedbackText.style.color = "var(--success)";
    } else {
        // Incorrect answer still counts as participation for today, but doesn't increase streak
        currentStreakData.lastDate = today;
        localStorage.setItem(STORAGE_KEY_STREAK, JSON.stringify(currentStreakData));
        
        feedbackText.textContent = "Incorrect! ❌ Better luck next time.";
        feedbackText.style.color = "var(--error)";
    }

    streakCountEl.textContent = currentStreakData.count;

    // Save state so user can't answer again today
    const stateToSave = {
        date: today,
        question: qData.question,
        userAnswer: selectedOption,
        correctAnswer: correctAnswer,
        correct: isCorrect
    };
    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(stateToSave));

    // Show feedback and completion prompt
    factReveal.textContent = `The correct answer was: ${decodeHTML(correctAnswer)}`;
    feedbackContainer.classList.remove('hidden');

    // Reload state after a short delay or allow immediate view switch
    setTimeout(() => {
        checkDailyStatus();
    }, 3000);
}

// Run app on load
init();

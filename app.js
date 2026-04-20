const STORAGE_KEY = "objekcijuoju_demo_progress_v1";
const DEMO_VERSION = "demo-20260420";
const DEMO_QUESTION_FILE = "./questions/demo_questions.json";

let questions = [];
let progress = {};
let remainingQuestions = [];
let currentQuestion = null;
let currentShuffledOptions = [];
let currentCorrectIndex = null;
let answered = false;

async function init() {
  setLoadingState("Kraunami demo klausimai...", true);
  await loadQuestions();
  registerEvents();
  updateStats();
  renderStartState();
  renderVersion();
}

async function loadQuestions() {
  try {
    const response = await fetch(`${DEMO_QUESTION_FILE}?v=${DEMO_VERSION}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Nepavyko užkrauti demo klausimų: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Demo klausimų failas nėra JSON masyvas.");
    }

    questions = data.map((question, index) => ({
      ...question,
      _uid: `demo__${question.id ?? index + 1}`
    }));
  } catch (error) {
    console.error(error);
    questions = [];
  }

  loadProgress();
  syncProgressWithQuestions();
  prepareRemainingQuestions();
}

function loadProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    progress = saved ? JSON.parse(saved) : createEmptyProgress();
  } catch {
    progress = createEmptyProgress();
  }
}

function createEmptyProgress() {
  return {
    answeredIds: [],
    correctIds: [],
    wrongIds: []
  };
}

function syncProgressWithQuestions() {
  const validIds = new Set(questions.map(question => question._uid));

  progress.answeredIds = (progress.answeredIds || []).filter(id => validIds.has(id));
  progress.correctIds = (progress.correctIds || []).filter(id => validIds.has(id));
  progress.wrongIds = (progress.wrongIds || []).filter(id => validIds.has(id));

  saveProgress();
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function prepareRemainingQuestions() {
  remainingQuestions = shuffleArray(
    questions.filter(question => !progress.answeredIds.includes(question._uid))
  );
}

function shuffleArray(items) {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[randomIndex]] = [copy[randomIndex], copy[i]];
  }

  return copy;
}

function updateStats() {
  const total = questions.length;
  const answeredCount = progress.answeredIds.length;
  const correctCount = progress.correctIds.length;
  const remainingCount = Math.max(total - answeredCount, 0);
  const percent = total === 0 ? 0 : Math.round((answeredCount / total) * 100);

  document.getElementById("masteredCount").textContent = correctCount;
  document.getElementById("totalCount").textContent = total;
  document.getElementById("remainingCount").textContent = remainingCount;
  document.getElementById("progressText").textContent =
    `${answeredCount} / ${total} peržiūrėta (${percent}%)`;
  document.getElementById("progressFill").style.width = `${percent}%`;
}

function setLoadingState(message, disableStart) {
  const startBtn = document.getElementById("startBtn");

  if (startBtn) {
    startBtn.disabled = disableStart;
  }
}

function renderStartState() {
  const startBtn = document.getElementById("startBtn");

  if (questions.length === 0) {
    setLoadingState("Demo klausimų užkrauti nepavyko. Perkrauk puslapį.", true);
    startBtn.textContent = "Pradėti demo";
    return;
  }

  if (isDemoComplete()) {
    setLoadingState(
      "Peržiūrėjai visus 30 demo klausimų. Gali paleisti demo iš naujo.",
      false
    );
    startBtn.textContent = "Pradėti demo iš naujo";
    return;
  }

  setLoadingState(`Paruošta ${questions.length} demo klausimų iš skirtingų temų.`, false);
  startBtn.textContent = "Pradėti demo";
}

function isDemoComplete() {
  return questions.length > 0 && progress.answeredIds.length >= questions.length;
}

function renderVersion() {
  const versionEl = document.getElementById("appVersion");
  if (!versionEl) return;

  versionEl.textContent = "Bandomoji versija: 30 klausimų";
}

function restoreCurrentQuestionIfNeeded() {
  if (!currentQuestion || answered) return;

  remainingQuestions.unshift(currentQuestion);
  currentQuestion = null;
}

function scrollToQuizTop() {
  const quizPanel = document.getElementById("quizPanel");
  if (!quizPanel) return;

  const top = quizPanel.getBoundingClientRect().top + window.scrollY - 8;
  window.scrollTo({
    top,
    behavior: "smooth"
  });
}

function startQuiz() {
  if (questions.length === 0) return;

  if (isDemoComplete()) {
    resetProgress(false);
  }

  document.body.classList.add("quiz-active");
  document.getElementById("startPanel").classList.add("hidden");
  document.getElementById("quizPanel").classList.remove("hidden");
  showQuestion();
}

function showQuestion() {
  answered = false;
  currentQuestion = remainingQuestions.shift() || null;

  if (!currentQuestion) {
    showDemoComplete();
    return;
  }

  const shuffledData = shuffleQuestionOptions(currentQuestion);
  currentShuffledOptions = shuffledData.shuffledOptions;
  currentCorrectIndex = shuffledData.correctIndex;

  document.getElementById("questionCategory").textContent =
    currentQuestion.category || "Klausimas";

  document.getElementById("questionTitle").textContent = currentQuestion.question;
  document.getElementById("questionCounter").textContent =
    `Klausimas ${progress.answeredIds.length + 1} iš ${questions.length}`;

  const answersContainer = document.getElementById("answersContainer");
  answersContainer.innerHTML = "";

  currentShuffledOptions.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-btn";

    const label = document.createElement("strong");
    label.textContent = `${String.fromCharCode(65 + index)}. `;
    button.appendChild(label);
    button.append(option);
    button.addEventListener("click", () => handleAnswer(index));

    answersContainer.appendChild(button);
  });

  document.getElementById("resultBox").classList.add("hidden");
  setTimeout(scrollToQuizTop, 80);
}

function shuffleQuestionOptions(question) {
  const optionObjects = question.options.map((option, index) => ({
    text: option,
    isCorrect: index === question.correct
  }));

  for (let i = optionObjects.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [optionObjects[i], optionObjects[randomIndex]] = [
      optionObjects[randomIndex],
      optionObjects[i]
    ];
  }

  return {
    shuffledOptions: optionObjects.map(item => item.text),
    correctIndex: optionObjects.findIndex(item => item.isCorrect)
  };
}

function handleAnswer(selectedIndex) {
  if (answered || !currentQuestion) return;
  answered = true;

  const buttons = document.querySelectorAll(".answer-btn");
  const isCorrect = selectedIndex === currentCorrectIndex;

  if (!progress.answeredIds.includes(currentQuestion._uid)) {
    progress.answeredIds.push(currentQuestion._uid);
  }

  progress.correctIds = progress.correctIds.filter(id => id !== currentQuestion._uid);
  progress.wrongIds = progress.wrongIds.filter(id => id !== currentQuestion._uid);

  if (isCorrect) {
    progress.correctIds.push(currentQuestion._uid);
  } else {
    progress.wrongIds.push(currentQuestion._uid);
  }

  buttons.forEach((button, index) => {
    button.disabled = true;

    if (index === currentCorrectIndex) {
      button.classList.add("correct");
    } else if (index === selectedIndex) {
      button.classList.add("wrong");
    } else {
      button.classList.add("neutral");
    }
  });

  const resultTitle = document.getElementById("resultTitle");
  const resultExplanation = document.getElementById("resultExplanation");
  const correctAnswerText = document.getElementById("correctAnswerText");

  resultTitle.textContent = isCorrect ? "Teisingai" : "Neteisingai";
  resultTitle.className = isCorrect ? "result-title good" : "result-title bad";
  resultExplanation.textContent = currentQuestion.explanation || "";
  correctAnswerText.textContent =
    `Teisingas atsakymas: ${currentShuffledOptions[currentCorrectIndex]}`;

  document.getElementById("resultBox").classList.remove("hidden");

  saveProgress();
  updateStats();
  renderStartState();

  const nextBtn = document.getElementById("nextBtn");
  nextBtn.textContent = remainingQuestions.length === 0 ? "Užbaigti demo" : "Kitas klausimas";

  setTimeout(scrollToQuizTop, 80);
}

function showDemoComplete() {
  currentQuestion = null;
  document.body.classList.remove("quiz-active");
  document.getElementById("quizPanel").classList.add("hidden");
  document.getElementById("startPanel").classList.remove("hidden");
  document.getElementById("answersContainer").innerHTML = "";
  document.getElementById("resultBox").classList.add("hidden");

  renderStartState();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetProgress(withConfirmation = true) {
  if (withConfirmation && !confirm("Ar tikrai nori pradėti demo iš naujo?")) return;

  progress = createEmptyProgress();
  remainingQuestions = shuffleArray(questions);
  currentQuestion = null;
  currentShuffledOptions = [];
  currentCorrectIndex = null;
  answered = false;

  saveProgress();
  updateStats();
  renderStartState();

  document.body.classList.remove("quiz-active");
  document.getElementById("quizPanel").classList.add("hidden");
  document.getElementById("startPanel").classList.remove("hidden");
  document.getElementById("answersContainer").innerHTML = "";
  document.getElementById("resultBox").classList.add("hidden");
  document.getElementById("nextBtn").textContent = "Kitas klausimas";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function backToStart() {
  restoreCurrentQuestionIfNeeded();
  document.body.classList.remove("quiz-active");
  document.getElementById("quizPanel").classList.add("hidden");
  document.getElementById("startPanel").classList.remove("hidden");
  renderStartState();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function registerEvents() {
  document.getElementById("startBtn").addEventListener("click", startQuiz);
  document.getElementById("nextBtn").addEventListener("click", showQuestion);
  document.getElementById("backBtn").addEventListener("click", backToStart);
  document.getElementById("menuBtn").addEventListener("click", backToStart);
  document.getElementById("resetBtn").addEventListener("click", () => resetProgress(true));
}

init();

const CSV_PATH = "data/examenes.csv";
const MANIFEST_PATH = "data/manifest.json";
const STORAGE_KEY = "valenciano_trainer_stats_v2";
const REQUIRED_FIELDS = ["id", "nivel", "tema", "tipo", "pregunta", "respuesta"];
const VALID_TYPES = ["test", "texto", "hueco", "redaccio", "redacción", "oral", "obert", "abierto", "expressio", "expresion"];
const SIMULACRO_PATHS = {
  B2: "simulacros/simulacro_b2.csv",
  C1: "simulacros/simulacro_c1.csv",
  C2: "simulacros/simulacro_c2.csv",
};

let allQuestions = [];
let quizQuestions = [];
let currentIndex = 0;
let answeredThisRun = new Map();
let stats = loadStats();
let waitingWorker = null;
let activeSession = createPracticeSession();
let timerId = null;

const els = {
  appStatus: document.getElementById("appStatus"),
  appStatusText: document.getElementById("appStatusText"),
  refreshAppBtn: document.getElementById("refreshAppBtn"),
  csvFile: document.getElementById("csvFile"),
  downloadTemplateBtn: document.getElementById("downloadTemplateBtn"),
  exportWrongBtn: document.getElementById("exportWrongBtn"),
  levelSelect: document.getElementById("levelSelect"),
  topicSelect: document.getElementById("topicSelect"),
  modeSelect: document.getElementById("modeSelect"),
  limitSelect: document.getElementById("limitSelect"),
  searchInput: document.getElementById("searchInput"),
  startBtn: document.getElementById("startBtn"),
  quickSmartBtn: document.getElementById("quickSmartBtn"),
  quickRandomBtn: document.getElementById("quickRandomBtn"),
  quickMistakesBtn: document.getElementById("quickMistakesBtn"),
  simLevelSelect: document.getElementById("simLevelSelect"),
  simTimeSelect: document.getElementById("simTimeSelect"),
  startSimBtn: document.getElementById("startSimBtn"),
  simStatus: document.getElementById("simStatus"),
  dataStatus: document.getElementById("dataStatus"),
  bankCountPill: document.getElementById("bankCountPill"),
  bankDiagnostics: document.getElementById("bankDiagnostics"),
  bankDiagnosticsSummary: document.getElementById("bankDiagnosticsSummary"),
  bankDiagnosticsContent: document.getElementById("bankDiagnosticsContent"),
  quizCard: document.getElementById("quizCard"),
  quizMeta: document.getElementById("quizMeta"),
  questionText: document.getElementById("questionText"),
  progressText: document.getElementById("progressText"),
  timerText: document.getElementById("timerText"),
  optionsBox: document.getElementById("optionsBox"),
  textAnswerBox: document.getElementById("textAnswerBox"),
  textAnswer: document.getElementById("textAnswer"),
  checkTextBtn: document.getElementById("checkTextBtn"),
  openButtons: document.getElementById("openButtons"),
  markOpenGoodBtn: document.getElementById("markOpenGoodBtn"),
  markOpenBadBtn: document.getElementById("markOpenBadBtn"),
  feedback: document.getElementById("feedback"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  resetStatsBtn: document.getElementById("resetStatsBtn"),
  statAnswered: document.getElementById("statAnswered"),
  statCorrect: document.getElementById("statCorrect"),
  statAccuracy: document.getElementById("statAccuracy"),
  statReview: document.getElementById("statReview"),
  statMastered: document.getElementById("statMastered"),
  statNew: document.getElementById("statNew"),
  weakTopics: document.getElementById("weakTopics"),
  exportProgressBtn: document.getElementById("exportProgressBtn"),
  progressFile: document.getElementById("progressFile"),
  exportBankBtn: document.getElementById("exportBankBtn"),
  resetScopeBtn: document.getElementById("resetScopeBtn"),
};

init();

async function init() {
  setPracticeControlsEnabled(false);
  bindEvents();
  renderStats();
  try {
    const loaded = await loadDefaultBank();
    loadQuestionsFromRows(loaded.rows, `Banco cargado: ${loaded.filesLoaded}/${loaded.filesExpected} CSV`, loaded);
  } catch (err) {
    try {
      const res = await fetch(CSV_PATH, { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudo cargar el CSV por defecto.");
      const text = await res.text();
      loadQuestionsFromRows(readRowsWithSource(text, CSV_PATH), "CSV combinado cargado", {
        sourceType: "fallback",
        filesExpected: 1,
        filesLoaded: 1,
        fileErrors: err.message ? [err.message] : [],
      });
    } catch (fallbackErr) {
      loadQuestionsFromRows(readRowsWithSource(getTemplateCsv(), "plantilla interna"), "Usando preguntas de ejemplo. Importa tus CSVs para practicar", {
        sourceType: "template",
        filesExpected: 1,
        filesLoaded: 1,
        fileErrors: [fallbackErr.message || "No se pudo cargar el banco principal"],
      });
    }
  }

  registerServiceWorker();
}

async function loadDefaultBank() {
  const manifestRes = await fetch(MANIFEST_PATH, { cache: "no-store" });
  if (!manifestRes.ok) throw new Error("No manifest");
  const manifest = await manifestRes.json();
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  if (!files.length) throw new Error("Manifest vacío");
  const chunks = await Promise.all(files.map(async file => {
    try {
      const res = await fetch(file, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { file, rows: readRowsWithSource(await res.text(), file), error: null };
    } catch (err) {
      return { file, rows: [], error: `${file}: ${err.message || "error de carga"}` };
    }
  }));
  const loaded = chunks.filter(chunk => !chunk.error);
  const fileErrors = chunks.filter(chunk => chunk.error).map(chunk => chunk.error);
  const rows = loaded.flatMap(chunk => chunk.rows);
  if (!rows.length) throw new Error(fileErrors[0] || "No se pudo cargar ningún CSV del manifest");
  return {
    sourceType: "manifest",
    rows,
    filesExpected: files.length,
    filesLoaded: loaded.length,
    fileErrors,
  };
}

function bindEvents() {
  els.csvFile.addEventListener("change", async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    const chunks = await Promise.all(files.map(async file => readRowsWithSource(await file.text(), file.name)));
    loadQuestionsFromRows(chunks.flat(), `CSV importado: ${files.map(f => f.name).join(", ")}`, {
      sourceType: "import",
      filesExpected: files.length,
      filesLoaded: files.length,
      fileErrors: [],
    });
  });

  els.downloadTemplateBtn.addEventListener("click", () => {
    downloadText("plantilla_examenes_valenciano.csv", getTemplateCsv(), "text/csv;charset=utf-8");
  });

  els.exportWrongBtn.addEventListener("click", exportWrongCsv);
  els.levelSelect.addEventListener("change", populateTopics);
  els.startBtn.addEventListener("click", startQuiz);
  els.quickSmartBtn.addEventListener("click", () => quickStart("inteligente", "15"));
  els.quickRandomBtn.addEventListener("click", () => quickStart("random", "10"));
  els.quickMistakesBtn.addEventListener("click", () => quickStart("fallos", "10"));
  els.startSimBtn.addEventListener("click", startSimulacro);
  els.exportProgressBtn.addEventListener("click", exportProgressBackup);
  els.progressFile.addEventListener("change", importProgressBackup);
  els.exportBankBtn.addEventListener("click", exportFullBank);
  els.resetScopeBtn.addEventListener("click", resetSelectedProgress);
  els.refreshAppBtn.addEventListener("click", refreshInstalledApp);
  els.prevBtn.addEventListener("click", () => moveQuestion(-1));
  els.nextBtn.addEventListener("click", () => moveQuestion(1));
  els.checkTextBtn.addEventListener("click", checkTextAnswer);
  els.markOpenGoodBtn.addEventListener("click", () => markOpenAnswer(true));
  els.markOpenBadBtn.addEventListener("click", () => markOpenAnswer(false));
  els.textAnswer.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) checkTextAnswer();
  });
  els.resetStatsBtn.addEventListener("click", () => {
    if (confirm("¿Borrar estadísticas guardadas?")) {
      stats = createEmptyStats();
      saveStats();
      renderStats();
    }
  });
  window.addEventListener("online", renderConnectionStatus);
  window.addEventListener("offline", renderConnectionStatus);
  renderConnectionStatus();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.register("service-worker.js").then(registration => {
    if (registration.waiting) showUpdateReady(registration.waiting);

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          showUpdateReady(worker);
        }
      });
    });
  }).catch(() => {
    showAppStatus("No se ha podido activar el modo sin conexión.", false);
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

function showUpdateReady(worker) {
  waitingWorker = worker;
  showAppStatus("Hay una versión nueva lista.", true);
}

function refreshInstalledApp() {
  if (!waitingWorker) return;
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
}

function renderConnectionStatus() {
  if (!navigator.onLine) {
    showAppStatus("Sin conexión. Puedes seguir practicando con el banco guardado.", false);
    return;
  }
  if (!waitingWorker) hideAppStatus();
}

function showAppStatus(message, canRefresh) {
  els.appStatusText.textContent = message;
  els.refreshAppBtn.classList.toggle("hidden", !canRefresh);
  els.appStatus.classList.remove("hidden");
}

function hideAppStatus() {
  els.appStatus.classList.add("hidden");
  els.refreshAppBtn.classList.add("hidden");
}

function loadQuestionsFromCsv(csvText, message) {
  loadQuestionsFromRows(readRowsWithSource(csvText, "CSV importado"), message);
}

function loadQuestionsFromRows(rows, message, loadMeta = {}) {
  const diagnostics = buildBankDiagnostics(rows, loadMeta);
  const normalized = diagnostics.validRows.map(normalizeQuestion).filter(Boolean);
  const byId = new Map();
  for (const q of normalized) byId.set(q.id, q);
  allQuestions = [...byId.values()];
  populateFilters();
  els.dataStatus.textContent = `${message}. Preguntas disponibles: ${allQuestions.length}.`;
  els.bankCountPill.textContent = `${allQuestions.length} preguntas`;
  setPracticeControlsEnabled(allQuestions.length > 0);
  renderBankDiagnostics(diagnostics);
  renderStats();
}

function readRowsWithSource(text, source) {
  return parseCsv(text).map((row, index) => ({
    ...row,
    __source: source,
    __rowNumber: index + 2,
  }));
}

function buildBankDiagnostics(rows, meta = {}) {
  const issues = [];
  const validRows = [];
  const seenIds = new Map();
  const byLevel = {};
  const byTopic = {};
  const byType = {};

  for (const row of rows) {
    const source = row.__source || "CSV";
    const rowNumber = row.__rowNumber || "?";
    const location = `${source}, fila ${rowNumber}`;
    const id = clean(row.id);
    const tipo = (clean(row.tipo) || "test").toLowerCase();
    const missing = REQUIRED_FIELDS.filter(field => !clean(row[field]));

    if (missing.length) {
      issues.push({ severity: "bad", text: `${location}: faltan campos obligatorios (${missing.join(", ")}).` });
      continue;
    }

    if (seenIds.has(id)) {
      issues.push({ severity: "bad", text: `${location}: ID duplicado "${id}" (ya aparece en ${seenIds.get(id)}).` });
      continue;
    }

    seenIds.set(id, location);

    if (!VALID_TYPES.includes(tipo)) {
      issues.push({ severity: "warn", text: `${location}: tipo poco común "${tipo}". Se cargará, pero revisa si es intencionado.` });
    }

    if (tipo === "test") {
      const answer = normalizeAnswer(row.respuesta);
      const optionKey = `opcion_${answer.toLowerCase()}`;
      if (!["A", "B", "C", "D"].includes(answer)) {
        issues.push({ severity: "bad", text: `${location}: la respuesta de una pregunta test debe ser A, B, C o D.` });
        continue;
      }
      if (!clean(row[optionKey])) {
        issues.push({ severity: "bad", text: `${location}: la respuesta correcta es ${answer}, pero esa opción está vacía.` });
        continue;
      }
    }

    countBy(byLevel, clean(row.nivel));
    countBy(byTopic, clean(row.tema));
    countBy(byType, tipo);
    validRows.push(row);
  }

  for (const error of meta.fileErrors || []) {
    issues.push({ severity: "bad", text: `Archivo no cargado: ${error}.` });
  }

  return {
    sourceType: meta.sourceType || "unknown",
    filesExpected: meta.filesExpected || 0,
    filesLoaded: meta.filesLoaded || 0,
    totalRows: rows.length,
    validRows,
    skippedRows: rows.length - validRows.length,
    issues,
    byLevel,
    byTopic,
    byType,
  };
}

function renderBankDiagnostics(diagnostics) {
  const hasErrors = diagnostics.issues.some(issue => issue.severity === "bad");
  const hasWarnings = diagnostics.issues.some(issue => issue.severity === "warn");
  const status = hasErrors ? "bad" : hasWarnings ? "warn" : "ok";
  const statusText = hasErrors ? "Revisar banco" : hasWarnings ? "Banco con avisos" : "Banco validado";
  const filesText = diagnostics.filesExpected
    ? `${diagnostics.filesLoaded}/${diagnostics.filesExpected} archivos`
    : "archivos importados";

  els.bankDiagnostics.className = `diagnostics ${status}`;
  els.bankDiagnostics.classList.remove("hidden");
  els.bankDiagnosticsSummary.textContent = `${statusText}: ${diagnostics.validRows.length} preguntas válidas · ${filesText}`;

  const issueList = diagnostics.issues.length
    ? `<ul class="diagnostics-list">${diagnostics.issues.slice(0, 8).map(issue => `<li>${escapeHtml(issue.text)}</li>`).join("")}</ul>${diagnostics.issues.length > 8 ? `<p class="muted">Y ${diagnostics.issues.length - 8} avisos más.</p>` : ""}`
    : `<p class="muted">No se han detectado IDs duplicados, campos obligatorios vacíos ni respuestas test inválidas.</p>`;

  els.bankDiagnosticsContent.innerHTML = `
    <div class="diagnostics-content">
      <div class="diagnostics-metrics">
        <div><strong>${diagnostics.validRows.length}</strong><span>Preguntas válidas</span></div>
        <div><strong>${Object.keys(diagnostics.byLevel).length}</strong><span>Niveles</span></div>
        <div><strong>${Object.keys(diagnostics.byTopic).length}</strong><span>Temas</span></div>
      </div>
      <p class="muted">${formatCounts(diagnostics.byLevel)} · ${formatCounts(diagnostics.byType)}</p>
      ${issueList}
    </div>
  `;
}

function normalizeQuestion(row) {
  const id = clean(row.id) || cryptoRandomId();
  const nivel = clean(row.nivel);
  const tema = clean(row.tema);
  const tipo = (clean(row.tipo) || "test").toLowerCase();
  const pregunta = clean(row.pregunta);
  const respuesta = clean(row.respuesta);

  if (!nivel || !tema || !pregunta || !respuesta) return null;

  return {
    id,
    nivel,
    tema,
    tipo,
    pregunta,
    opciones: {
      A: clean(row.opcion_a),
      B: clean(row.opcion_b),
      C: clean(row.opcion_c),
      D: clean(row.opcion_d),
    },
    respuesta,
    explicacion: clean(row.explicacion),
    fuente: clean(row.fuente),
  };
}

function populateFilters() {
  const levels = unique(allQuestions.map(q => q.nivel));
  fillSelect(els.levelSelect, ["Todos", ...levels]);
  populateTopics();
}

function populateTopics() {
  const selectedLevel = els.levelSelect.value;
  const filtered = selectedLevel === "Todos" ? allQuestions : allQuestions.filter(q => q.nivel === selectedLevel);
  const topics = unique(filtered.map(q => q.tema));
  fillSelect(els.topicSelect, ["Todos", ...topics]);
}

function quickStart(mode, limit) {
  els.modeSelect.value = mode;
  els.limitSelect.value = limit;
  els.searchInput.value = "";
  startQuiz();
}

function setPracticeControlsEnabled(enabled) {
  [
    els.levelSelect,
    els.topicSelect,
    els.modeSelect,
    els.limitSelect,
    els.searchInput,
    els.startBtn,
    els.quickSmartBtn,
    els.quickRandomBtn,
    els.quickMistakesBtn,
    els.simLevelSelect,
    els.simTimeSelect,
    els.startSimBtn,
    els.exportProgressBtn,
    els.progressFile,
    els.exportBankBtn,
    els.resetScopeBtn,
  ].forEach(el => {
    el.disabled = !enabled;
  });
}

function buildSmartQueue(questions) {
  const review = [];
  const fresh = [];
  const mastered = [];

  for (const q of questions) {
    const status = getQuestionStatus(q.id);
    if (status === "mastered") mastered.push(q);
    else if (status === "new") fresh.push(q);
    else review.push(q);
  }

  review.sort((a, b) => getSmartPriority(b) - getSmartPriority(a));
  fresh.sort((a, b) => getSmartPriority(b) - getSmartPriority(a));
  mastered.sort((a, b) => getSmartPriority(b) - getSmartPriority(a));

  const queue = [];
  let reviewIndex = 0;
  let freshIndex = 0;

  while (reviewIndex < review.length || freshIndex < fresh.length) {
    for (let i = 0; i < 2 && reviewIndex < review.length; i++) {
      queue.push(review[reviewIndex++]);
    }
    if (freshIndex < fresh.length) queue.push(fresh[freshIndex++]);
    if (reviewIndex >= review.length && freshIndex < fresh.length) {
      queue.push(fresh[freshIndex++]);
    }
  }

  return [...queue, ...mastered];
}

function getSmartPriority(q) {
  const progress = getQuestionProgress(q.id);
  const status = getQuestionStatus(q.id);
  const attempts = progress.attempts || 0;
  const wrongRate = attempts ? progress.wrong / attempts : 0;
  let score = Math.random();

  if (stats.wrongIds.includes(q.id)) score += 120;
  if (status === "review") score += 90;
  if (status === "new") score += 55;
  if (status === "mastered") score += 5;
  if (!progress.lastCorrect && attempts) score += 35;
  score += wrongRate * 40;
  score += Math.max(0, 3 - progress.streak) * 8;

  if (!progress.lastAnsweredAt) return score + 18;

  const lastAnswered = Date.parse(progress.lastAnsweredAt);
  if (Number.isNaN(lastAnswered)) return score;
  const daysSince = (Date.now() - lastAnswered) / 86400000;
  return score + Math.min(24, Math.max(0, daysSince) * 3);
}

function startQuiz() {
  const level = els.levelSelect.value;
  const topic = els.topicSelect.value;
  const mode = els.modeSelect.value;
  const limit = els.limitSelect.value;
  const search = normalizeText(els.searchInput.value);

  let candidates = allQuestions.filter(q => {
    const levelOk = level === "Todos" || q.nivel === level;
    const topicOk = topic === "Todos" || q.tema === topic;
    const searchOk = !search || normalizeText(`${q.pregunta} ${q.explicacion} ${q.tema}`).includes(search);
    return levelOk && topicOk && searchOk;
  });

  if (mode === "fallos") candidates = candidates.filter(q => isQuestionInReview(q.id));
  if (mode === "pendientes") candidates = candidates.filter(q => getQuestionStatus(q.id) !== "mastered");

  if (mode === "inteligente") quizQuestions = buildSmartQueue(candidates);
  else if (mode === "random") quizQuestions = shuffle(candidates);
  else quizQuestions = candidates;

  if (limit !== "all") quizQuestions = quizQuestions.slice(0, Number(limit));

  if (quizQuestions.length === 0) {
    alert("No hay preguntas con esos filtros. Prueba otro nivel/tema, borra la búsqueda o importa más CSVs.");
    return;
  }

  beginSession(quizQuestions, createPracticeSession());
}

async function startSimulacro() {
  const level = els.simLevelSelect.value;
  const minutes = Number(els.simTimeSelect.value);
  const path = SIMULACRO_PATHS[level];

  try {
    els.startSimBtn.disabled = true;
    els.simStatus.textContent = `Cargando simulacro ${level}...`;
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = readRowsWithSource(await res.text(), path);
    const diagnostics = buildBankDiagnostics(rows, {
      sourceType: "simulacro",
      filesExpected: 1,
      filesLoaded: 1,
      fileErrors: [],
    });
    const questions = diagnostics.validRows.map(normalizeQuestion).filter(Boolean);
    if (!questions.length) throw new Error("Simulacro vacío");
    els.simStatus.textContent = `${level}: ${questions.length} preguntas listas.`;
    beginSession(questions, createExamSession(level, minutes));
  } catch (err) {
    els.simStatus.textContent = `No se pudo cargar el simulacro ${level}.`;
    alert(`No se pudo cargar el simulacro ${level}: ${err.message || "error desconocido"}`);
  } finally {
    els.startSimBtn.disabled = false;
  }
}

function beginSession(questions, session) {
  quizQuestions = questions;
  activeSession = session;
  currentIndex = 0;
  answeredThisRun = new Map();
  startSessionTimer();
  els.quizCard.classList.remove("hidden");
  renderQuestion();
  window.scrollTo({ top: els.quizCard.offsetTop - 10, behavior: "smooth" });
}

function createPracticeSession() {
  return {
    type: "practice",
    level: "",
    durationMs: 0,
    startedAt: 0,
    deadline: 0,
    finished: false,
  };
}

function createExamSession(level, minutes) {
  const durationMs = minutes > 0 ? minutes * 60 * 1000 : 0;
  return {
    type: "exam",
    level,
    durationMs,
    startedAt: Date.now(),
    deadline: durationMs ? Date.now() + durationMs : 0,
    finished: false,
  };
}

function startSessionTimer() {
  stopSessionTimer();
  if (activeSession.type !== "exam") {
    els.timerText.classList.add("hidden");
    return;
  }

  els.timerText.classList.remove("hidden");
  updateTimerText();
  timerId = window.setInterval(() => {
    updateTimerText();
    if (activeSession.deadline && Date.now() >= activeSession.deadline) {
      finishSession("Tiempo agotado.");
    }
  }, 1000);
}

function stopSessionTimer() {
  if (timerId) window.clearInterval(timerId);
  timerId = null;
}

function updateTimerText() {
  if (activeSession.type !== "exam") return;
  if (!activeSession.deadline) {
    els.timerText.textContent = formatDuration(Date.now() - activeSession.startedAt);
    els.timerText.classList.remove("timer-warning");
    return;
  }

  const remaining = Math.max(0, activeSession.deadline - Date.now());
  els.timerText.textContent = formatDuration(remaining);
  els.timerText.classList.toggle("timer-warning", remaining <= 5 * 60 * 1000);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderQuestion() {
  const q = quizQuestions[currentIndex];
  const statusLabel = activeSession.type === "exam" ? `Simulacro ${activeSession.level}` : getQuestionStatusLabel(q.id);
  els.quizMeta.textContent = `${q.nivel} · ${q.tema} · ${statusLabel}${q.fuente ? " · " + q.fuente : ""}`;
  els.questionText.textContent = q.pregunta;
  els.progressText.textContent = `${currentIndex + 1}/${quizQuestions.length}`;
  els.feedback.className = "feedback hidden";
  els.feedback.innerHTML = "";
  els.optionsBox.innerHTML = "";
  els.textAnswer.value = "";
  els.textAnswer.disabled = false;
  els.checkTextBtn.disabled = false;
  els.markOpenGoodBtn.disabled = false;
  els.markOpenBadBtn.disabled = false;

  const manualReview = needsManualReview(q);
  const isTextLike = manualReview || q.tipo === "texto" || q.tipo === "hueco";
  els.textAnswerBox.classList.toggle("hidden", !isTextLike);
  els.optionsBox.classList.toggle("hidden", isTextLike);
  els.openButtons.classList.toggle("hidden", !manualReview);
  els.checkTextBtn.classList.toggle("hidden", manualReview);

  if (isTextLike) {
    els.textAnswer.placeholder = manualReview ? "Escribe un esquema o tu respuesta completa. Después autoevalúate." : (q.tipo === "hueco" ? "Completa el hueco" : "Escribe tu respuesta");
    const previous = answeredThisRun.get(q.id);
    if (previous) {
      els.textAnswer.value = previous.given;
      lockTextAnswer();
      if (activeSession.type !== "exam") showFeedback(previous.correct, q, previous.given);
    }
  } else {
    for (const key of ["A", "B", "C", "D"]) {
      if (!q.opciones[key]) continue;
      const btn = document.createElement("button");
      btn.className = "option";
      btn.textContent = `${key}. ${q.opciones[key]}`;
      btn.addEventListener("click", () => checkOptionAnswer(key));
      els.optionsBox.appendChild(btn);
    }
    const previous = answeredThisRun.get(q.id);
    if (previous) {
      if (activeSession.type === "exam") {
        markExamOption(previous.given);
      } else {
        markOptions(previous.given, q.respuesta);
        showFeedback(previous.correct, q, previous.given);
      }
    }
  }

  els.prevBtn.disabled = currentIndex === 0;
  els.nextBtn.textContent = currentIndex === quizQuestions.length - 1 ? "Finalizar" : "Siguiente";
  if (activeSession.finished) lockCurrentQuestionControls();
}

function isOpenQuestion(q) {
  return ["obert", "abierto", "redaccio", "redacción", "oral", "expressio", "expresion"].includes(q.tipo);
}

function needsManualReview(q) {
  if (isOpenQuestion(q)) return true;
  return q.tipo === "texto" && clean(q.respuesta).length > 120;
}

function checkOptionAnswer(given) {
  if (activeSession.finished) return;
  const q = quizQuestions[currentIndex];
  const correct = normalizeAnswer(given) === normalizeAnswer(q.respuesta);
  recordAnswer(q.id, correct, given);
  if (activeSession.type === "exam") {
    markExamOption(given);
    return;
  }
  markOptions(given, q.respuesta);
  showFeedback(correct, q, given);
}

function checkTextAnswer() {
  if (activeSession.finished) return;
  const q = quizQuestions[currentIndex];
  const given = els.textAnswer.value.trim();
  if (!given) return;
  const correct = isAcceptedTextAnswer(given, q.respuesta);
  recordAnswer(q.id, correct, given);
  lockTextAnswer();
  if (activeSession.type === "exam") return;
  showFeedback(correct, q, given);
}

function markOpenAnswer(correct) {
  if (activeSession.finished) return;
  const q = quizQuestions[currentIndex];
  const given = els.textAnswer.value.trim() || (correct ? "Autoavaluació: ho tinc" : "Autoavaluació: repassar");
  recordAnswer(q.id, correct, given);
  lockTextAnswer();
  if (activeSession.type === "exam") return;
  showFeedback(correct, q, given);
}

function lockTextAnswer() {
  els.textAnswer.disabled = true;
  els.checkTextBtn.disabled = true;
  els.markOpenGoodBtn.disabled = true;
  els.markOpenBadBtn.disabled = true;
}

function lockCurrentQuestionControls() {
  [...els.optionsBox.children].forEach(btn => {
    btn.disabled = true;
  });
  lockTextAnswer();
}

function markOptions(given, correctAnswer) {
  [...els.optionsBox.children].forEach(btn => {
    btn.disabled = true;
    const key = btn.textContent.slice(0, 1);
    if (normalizeAnswer(key) === normalizeAnswer(correctAnswer)) btn.classList.add("correct");
    if (normalizeAnswer(key) === normalizeAnswer(given) && normalizeAnswer(given) !== normalizeAnswer(correctAnswer)) btn.classList.add("wrong");
  });
}

function markExamOption(given) {
  [...els.optionsBox.children].forEach(btn => {
    btn.disabled = true;
    const key = btn.textContent.slice(0, 1);
    if (normalizeAnswer(key) === normalizeAnswer(given)) btn.classList.add("selected");
  });
}

function showFeedback(correct, q, given) {
  els.feedback.className = `feedback ${correct ? "ok" : "bad"}`;
  const expected = formatExpectedAnswer(q);
  els.feedback.innerHTML = `
    <strong>${correct ? "Correcto" : "Incorrecto / repasar"}</strong><br>
    Tu respuesta: ${escapeHtml(given)}<br>
    ${needsManualReview(q) ? "Criterio" : "Respuesta correcta"}: ${escapeHtml(expected)}
    ${q.explicacion ? `<hr><span>${escapeHtml(q.explicacion)}</span>` : ""}
  `;
}

function isAcceptedTextAnswer(given, expected) {
  const normalizedGiven = normalizeText(given);
  return getAcceptedAnswers(expected).some(answer => normalizeText(answer) === normalizedGiven);
}

function getAcceptedAnswers(expected) {
  return clean(expected).split("|").map(answer => answer.trim()).filter(Boolean);
}

function formatExpectedAnswer(q) {
  if (q.tipo === "test") return `${q.respuesta}. ${q.opciones[q.respuesta] || ""}`;
  const answers = getAcceptedAnswers(q.respuesta);
  return answers.length > 1 ? answers.join(" / ") : q.respuesta;
}

function recordAnswer(id, correct, given) {
  if (answeredThisRun.has(id)) return;
  answeredThisRun.set(id, { correct, given });
  updateQuestionProgress(id, correct);
  saveStats();
  renderStats();
}

function updateQuestionProgress(id, correct) {
  const previous = stats.questions[id] || createEmptyQuestionProgress();
  const attempts = previous.attempts + 1;
  const correctCount = previous.correct + (correct ? 1 : 0);
  const wrongCount = previous.wrong + (correct ? 0 : 1);
  const streak = correct ? previous.streak + 1 : 0;
  const status = streak >= 2 ? "mastered" : "review";

  stats.questions[id] = {
    attempts,
    correct: correctCount,
    wrong: wrongCount,
    streak,
    lastCorrect: correct,
    lastAnsweredAt: new Date().toISOString(),
    status,
  };

  stats.answered += 1;
  if (correct) {
    stats.correct += 1;
    stats.wrongIds = stats.wrongIds.filter(x => x !== id);
  } else if (!stats.wrongIds.includes(id)) {
    stats.wrongIds.push(id);
  }
}

function moveQuestion(direction) {
  if (direction > 0 && currentIndex === quizQuestions.length - 1) {
    finishSession();
    return;
  }
  currentIndex = Math.max(0, Math.min(quizQuestions.length - 1, currentIndex + direction));
  renderQuestion();
}

function finishSession(prefix = "") {
  activeSession.finished = true;
  stopSessionTimer();
  lockCurrentQuestionControls();
  alert(buildSessionSummary(prefix));
}

function buildSessionSummary(prefix = "") {
  const answers = [...answeredThisRun.entries()];
  const answered = answers.length;
  const correct = answers.filter(([, result]) => result.correct).length;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const failedTopics = {};

  for (const [id, result] of answers) {
    if (result.correct) continue;
    const question = allQuestions.find(q => q.id === id);
    if (question) countBy(failedTopics, question.tema);
  }

  const nextTopic = Object.entries(failedTopics).sort((a, b) => b[1] - a[1])[0]?.[0];
  const nextStep = nextTopic
    ? `Siguiente: repasa ${nextTopic}.`
    : "Siguiente: prueba una sesión inteligente para mezclar repaso y preguntas nuevas.";

  if (activeSession.type === "exam") {
    return buildExamSummary({ prefix, answered, correct, accuracy });
  }

  return `Práctica terminada.\nRespondidas: ${answered}\nAciertos: ${correct} (${accuracy}%)\n${nextStep}`;
}

function buildExamSummary({ prefix, answered, correct, accuracy }) {
  const total = quizQuestions.length;
  const unanswered = Math.max(0, total - answered);
  const elapsed = activeSession.startedAt ? formatDuration(Date.now() - activeSession.startedAt) : "00:00";
  const topicLines = getExamTopicSummary()
    .map(item => `${item.topic}: ${item.correct}/${item.answered}${item.total !== item.answered ? ` respondidas de ${item.total}` : ""}`)
    .join("\n");
  const heading = prefix ? `${prefix}\n` : "";

  return `${heading}Simulacro ${activeSession.level} terminado.\nTiempo: ${elapsed}\nRespondidas: ${answered}/${total}\nSin responder: ${unanswered}\nAciertos: ${correct} (${accuracy}%)\n\nBloques:\n${topicLines || "Sin respuestas registradas."}`;
}

function getExamTopicSummary() {
  const topics = {};

  for (const q of quizQuestions) {
    if (!topics[q.tema]) topics[q.tema] = { topic: q.tema, total: 0, answered: 0, correct: 0 };
    topics[q.tema].total += 1;
  }

  for (const [id, result] of answeredThisRun.entries()) {
    const q = quizQuestions.find(question => question.id === id);
    if (!q || !topics[q.tema]) continue;
    topics[q.tema].answered += 1;
    if (result.correct) topics[q.tema].correct += 1;
  }

  return Object.values(topics).sort((a, b) => a.topic.localeCompare(b.topic));
}

function exportWrongCsv() {
  const wrong = allQuestions.filter(q => isQuestionInReview(q.id));
  if (!wrong.length) {
    alert("Todavía no hay fallos guardados.");
    return;
  }
  const csv = toCsv(wrong);
  downloadText("fallos_valenciano.csv", csv, "text/csv;charset=utf-8");
}

function exportProgressBackup() {
  const backup = {
    app: "valenciano-trainer",
    version: 1,
    exportedAt: new Date().toISOString(),
    bank: {
      questions: allQuestions.length,
      levels: unique(allQuestions.map(q => q.nivel)),
      fingerprint: getBankFingerprint(),
    },
    stats,
  };

  const date = new Date().toISOString().slice(0, 10);
  downloadText(`progreso_valenciano_${date}.json`, JSON.stringify(backup, null, 2), "application/json;charset=utf-8");
}

async function importProgressBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const backup = JSON.parse(await file.text());
    const importedStats = normalizeImportedStats(backup);
    const importedCount = Object.keys(importedStats.questions).length;
    const currentFingerprint = getBankFingerprint();
    const importedFingerprint = backup?.bank?.fingerprint;
    const fingerprintNote = importedFingerprint && importedFingerprint !== currentFingerprint
      ? "\nEl backup parece venir de un banco distinto. Se importarán solo los IDs coincidentes cuando practiques."
      : "";

    if (!confirm(`Importar progreso con ${importedCount} preguntas registradas? Esto sustituirá el progreso actual.${fingerprintNote}`)) return;

    stats = importedStats;
    saveStats();
    renderStats();
    alert("Progreso importado correctamente.");
  } catch (err) {
    alert(`No se pudo importar el progreso: ${err.message || "archivo inválido"}`);
  } finally {
    event.target.value = "";
  }
}

function exportFullBank() {
  if (!allQuestions.length) {
    alert("Todavía no hay banco cargado.");
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  downloadText(`banco_valenciano_${date}.csv`, toCsv(allQuestions), "text/csv;charset=utf-8");
}

function resetSelectedProgress() {
  const selected = getFilteredQuestionsForScope();
  if (!selected.length) {
    alert("No hay preguntas en la selección actual.");
    return;
  }

  const level = els.levelSelect.value;
  const topic = els.topicSelect.value;
  const label = `${level === "Todos" ? "todos los niveles" : level} · ${topic === "Todos" ? "todos los temas" : topic}`;
  if (!confirm(`Reiniciar progreso de ${selected.length} preguntas (${label})?`)) return;

  const ids = new Set(selected.map(q => q.id));
  for (const id of ids) delete stats.questions[id];
  stats.wrongIds = stats.wrongIds.filter(id => !ids.has(id));
  recalculateGlobalStats();
  saveStats();
  renderStats();
}

function getFilteredQuestionsForScope() {
  const level = els.levelSelect.value;
  const topic = els.topicSelect.value;
  return allQuestions.filter(q => {
    const levelOk = level === "Todos" || q.nivel === level;
    const topicOk = topic === "Todos" || q.tema === topic;
    return levelOk && topicOk;
  });
}

function normalizeImportedStats(backup) {
  const imported = backup?.stats || backup;
  if (!imported || typeof imported !== "object") throw new Error("El JSON no contiene progreso válido.");

  const questions = {};
  const importedQuestions = imported.questions && typeof imported.questions === "object" ? imported.questions : {};
  for (const [id, value] of Object.entries(importedQuestions)) {
    if (!value || typeof value !== "object") continue;
    questions[id] = {
      attempts: Number(value.attempts || 0),
      correct: Number(value.correct || 0),
      wrong: Number(value.wrong || 0),
      streak: Number(value.streak || 0),
      lastCorrect: Boolean(value.lastCorrect),
      lastAnsweredAt: clean(value.lastAnsweredAt),
      status: ["new", "review", "mastered"].includes(value.status) ? value.status : "review",
    };
  }

  const normalized = {
    answered: Number(imported.answered || 0),
    correct: Number(imported.correct || 0),
    wrongIds: Array.isArray(imported.wrongIds) ? imported.wrongIds.map(String) : [],
    questions,
  };

  if (!Object.keys(questions).length && normalized.answered === 0 && normalized.correct === 0 && !normalized.wrongIds.length) {
    throw new Error("El backup no contiene intentos ni fallos.");
  }

  recalculateGlobalStatsFor(normalized, true);
  return normalized;
}

function recalculateGlobalStats() {
  recalculateGlobalStatsFor(stats);
}

function recalculateGlobalStatsFor(targetStats, preserveTotalsWhenEmpty = false) {
  const values = Object.values(targetStats.questions || {});
  if (preserveTotalsWhenEmpty && !values.length) return;
  targetStats.answered = values.reduce((sum, item) => sum + Number(item.attempts || 0), 0);
  targetStats.correct = values.reduce((sum, item) => sum + Number(item.correct || 0), 0);
  const reviewIds = new Set(targetStats.wrongIds || []);
  for (const [id, item] of Object.entries(targetStats.questions || {})) {
    if (item.status !== "mastered" && item.lastCorrect === false && Number(item.attempts || 0) > 0) reviewIds.add(id);
    if (item.status === "mastered" || item.lastCorrect === true) reviewIds.delete(id);
  }
  targetStats.wrongIds = [...reviewIds];
}

function getBankFingerprint() {
  return `${allQuestions.length}:${allQuestions.map(q => q.id).sort().join("|")}`;
}

function renderStats() {
  els.statAnswered.textContent = stats.answered;
  els.statCorrect.textContent = stats.correct;
  const accuracy = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0;
  els.statAccuracy.textContent = `${accuracy}%`;
  const summary = getProgressSummary();
  els.statReview.textContent = summary.review;
  els.statMastered.textContent = summary.mastered;
  els.statNew.textContent = summary.newQuestions;
  renderWeakTopics(summary.weakTopics);
}

function loadStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const questions = saved?.questions && typeof saved.questions === "object" ? saved.questions : {};
    return {
      answered: Number(saved?.answered || 0),
      correct: Number(saved?.correct || 0),
      wrongIds: Array.isArray(saved?.wrongIds) ? saved.wrongIds : [],
      questions,
    };
  } catch {
    return createEmptyStats();
  }
}

function saveStats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

function createEmptyStats() {
  return { answered: 0, correct: 0, wrongIds: [], questions: {} };
}

function createEmptyQuestionProgress() {
  return {
    attempts: 0,
    correct: 0,
    wrong: 0,
    streak: 0,
    lastCorrect: false,
    lastAnsweredAt: "",
    status: "new",
  };
}

function getQuestionProgress(id) {
  return stats.questions[id] || createEmptyQuestionProgress();
}

function getQuestionStatus(id) {
  const progress = getQuestionProgress(id);
  if (!progress.attempts && stats.wrongIds.includes(id)) return "review";
  if (!progress.attempts) return "new";
  return progress.status || (progress.streak >= 2 ? "mastered" : "review");
}

function getQuestionStatusLabel(id) {
  const status = getQuestionStatus(id);
  if (status === "mastered") return "Dominada";
  if (status === "review") return "En repaso";
  return "Nueva";
}

function isQuestionInReview(id) {
  const progress = getQuestionProgress(id);
  return stats.wrongIds.includes(id) || (progress.attempts > 0 && progress.status !== "mastered" && !progress.lastCorrect);
}

function getProgressSummary() {
  let review = 0;
  let mastered = 0;
  let newQuestions = 0;
  const topicStats = {};

  for (const q of allQuestions) {
    const progress = getQuestionProgress(q.id);
    const status = getQuestionStatus(q.id);
    if (status === "mastered") mastered++;
    else if (status === "review") review++;
    else newQuestions++;

    if (progress.attempts) {
      if (!topicStats[q.tema]) topicStats[q.tema] = { attempts: 0, wrong: 0 };
      topicStats[q.tema].attempts += progress.attempts;
      topicStats[q.tema].wrong += progress.wrong;
    }
  }

  const weakTopics = Object.entries(topicStats)
    .filter(([, value]) => value.attempts >= 2 && value.wrong > 0)
    .map(([topic, value]) => ({
      topic,
      attempts: value.attempts,
      wrong: value.wrong,
      rate: value.wrong / value.attempts,
    }))
    .sort((a, b) => b.rate - a.rate || b.wrong - a.wrong)
    .slice(0, 3);

  return { review, mastered, newQuestions, weakTopics };
}

function renderWeakTopics(weakTopics) {
  if (!els.weakTopics) return;
  if (!weakTopics.length) {
    els.weakTopics.innerHTML = `<p class="muted compact-status">Cuando acumules algunos intentos, aquí aparecerán tus temas débiles.</p>`;
    return;
  }

  els.weakTopics.innerHTML = `
    <h3>Temas a reforzar</h3>
    <div class="topic-list">
      ${weakTopics.map(item => `
        <div>
          <strong>${escapeHtml(item.topic)}</strong>
          <span>${item.wrong}/${item.attempts} fallos · ${Math.round(item.rate * 100)}%</span>
        </div>
      `).join("")}
    </div>
  `;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(value);
      if (row.some(cell => cell.trim() !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value);
  if (row.some(cell => cell.trim() !== "")) rows.push(row);

  if (rows.length === 0) return [];
  const headers = rows.shift().map(h => clean(h).toLowerCase());
  return rows.map(cells => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""])));
}

function toCsv(rows) {
  const headers = ["id","nivel","tema","tipo","pregunta","opcion_a","opcion_b","opcion_c","opcion_d","respuesta","explicacion","fuente"];
  const escape = value => {
    const v = String(value ?? "");
    return /[",\n\r]/.test(v) ? '"' + v.replaceAll('"', '""') + '"' : v;
  };
  return [headers.join(","), ...rows.map(row => headers.map(h => escape(row[h] || row.opciones?.[h.slice(-1).toUpperCase()] || "")).join(","))].join("\n");
}

function getTemplateCsv() {
  return `id,nivel,tema,tipo,pregunta,opcion_a,opcion_b,opcion_c,opcion_d,respuesta,explicacion,fuente
C1-ORT-001,C1,Ortografia,test,"Quina opció està escrita correctament?","açò","asò","aixo","axò",A,"'Açò' porta ce trencada.",Exemple
C1-VER-001,C1,Verbs,test,"Tria la forma correcta: Si jo ___ més temps, estudiaria més.","tinguera","tindria","tinc","tindré",A,"En una condicional hipotètica usem imperfet de subjuntiu.",Exemple
C1-LEX-001,C1,Lèxic,test,"Quin mot és més adequat per a 'ahorrar'?","estalviar","gastar","endevinar","baixar",A,"'Estalviar' equival a ahorrar.",Exemple
B2-ORT-001,B2,Accentuació,hueco,"Completa: La paraula 'història' porta accent ___ perquè és esdrúixola.",,,,,"obert|oberta","En valencià: història porta accent obert en la o. També pots registrar variants separades amb |.",Exemple
C1-EXP-001,C1,Expressió escrita,redaccio,"Redacta una carta formal de 180 paraules per sol·licitar informació.",,,,,"Resposta oberta","Revisa estructura, registre, coherència i correcció.",Exemple`;
}

function fillSelect(select, values) {
  select.innerHTML = "";
  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function countBy(target, key) {
  target[key] = (target[key] || 0) + 1;
}

function formatCounts(counts) {
  const entries = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  if (!entries.length) return "Sin datos";
  return entries.map(([key, value]) => `${key}: ${value}`).join(" · ");
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeAnswer(value) {
  return clean(value).toUpperCase().slice(0, 1);
}

function normalizeText(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’`´]/g, "'")
    .replace(/[.,;:!?¡¿'"“”«»()]/g, "")
    .replace(/[‐‑‒–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function downloadText(filename, text, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[s]));
}

function cryptoRandomId() {
  return "q-" + Math.random().toString(36).slice(2, 10);
}

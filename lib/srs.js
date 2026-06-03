export const DEFAULT_LADDER = [1, 3, 7, 14, 30];

export function advanceInterval(currentDays, ladder = DEFAULT_LADDER) {
  const idx = ladder.indexOf(currentDays);
  if (idx === -1) return ladder[0];
  if (idx === ladder.length - 1) return ladder[idx];
  return ladder[idx + 1];
}

export function stayAtInterval(currentDays, ladder = DEFAULT_LADDER) {
  return ladder.includes(currentDays) ? currentDays : ladder[0];
}

export function computeNextInterval({ currentDays, needReview, ladder = DEFAULT_LADDER }) {
  return needReview ? stayAtInterval(currentDays, ladder) : advanceInterval(currentDays, ladder);
}

export function addDays(dateISO, days) {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function nextDueDate(lastReviewedISO, intervalDays) {
  return addDays(lastReviewedISO, intervalDays);
}

export function isDue(problem, todayISO) {
  if (!problem || problem.status !== 'Active') return false;
  if (!problem.lastReviewed) return true;
  const due = nextDueDate(problem.lastReviewed, problem.srsIntervalDays);
  return todayISO >= due;
}

export function getDueProblems(problems, todayISO, limit = Infinity) {
  return Object.entries(problems)
    .filter(([, p]) => isDue(p, todayISO))
    .map(([slug, p]) => ({ slug, ...p }))
    .sort((a, b) => {
      const da = nextDueDate(a.lastReviewed || a.firstSolved, a.srsIntervalDays);
      const db = nextDueDate(b.lastReviewed || b.firstSolved, b.srsIntervalDays);
      return da.localeCompare(db);
    })
    .slice(0, limit);
}

export function newProblemDefaults({ slug, number, title, url, difficulty, topics }) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    number, title, url, difficulty, topics,
    firstSolved: today,
    lastReviewed: today,
    timesReviewed: 1,
    srsIntervalDays: DEFAULT_LADDER[0],
    status: 'Active',
    latestConfidence: null,
    notes: '',
    history: []
  };
}

export function mergeReview(problem, { confidence, notes, needReview, mastered, ladder = DEFAULT_LADDER }) {
  const today = new Date().toISOString().slice(0, 10);
  const isReview = !!problem.lastReviewed && problem.lastReviewed !== today;
  const nextInterval = mastered
    ? problem.srsIntervalDays
    : computeNextInterval({ currentDays: problem.srsIntervalDays, needReview, ladder });

  const accumulatedNotes = notes
    ? (problem.notes ? `${problem.notes}, ${notes}` : notes)
    : problem.notes;

  return {
    ...problem,
    lastReviewed: today,
    timesReviewed: problem.timesReviewed + (isReview ? 1 : 0),
    srsIntervalDays: nextInterval,
    status: mastered ? 'Mastered' : problem.status,
    latestConfidence: confidence ?? problem.latestConfidence,
    notes: accumulatedNotes,
    history: [...(problem.history || []), {
      date: today,
      type: isReview ? 'review' : 'solve',
      confidence,
      needReview: !!needReview,
      mastered: !!mastered
    }]
  };
}

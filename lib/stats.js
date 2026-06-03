export function computeStats(problems, state) {
  const all = Object.values(problems);
  const active = all.filter(p => p.status === 'Active');
  const mastered = all.filter(p => p.status === 'Mastered');

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const allHistory = all.flatMap(p => (p.history || []).map(h => ({ ...h, difficulty: p.difficulty })));
  const thisWeek = allHistory.filter(h => new Date(h.date) >= weekAgo).length;

  const kpis = {
    streak: state.streakDays || 0,
    thisWeek,
    totalActive: active.length,
    totalMastered: mastered.length
  };

  const perDay = computePerDay(allHistory, 90);
  const difficulty = computeDifficultyMix(all);
  const confidence = computeConfidenceTrend(allHistory);

  return { kpis, perDay, difficulty, confidence };
}

function computePerDay(history, days) {
  const buckets = {};
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = 0;
  }
  for (const h of history) {
    if (buckets[h.date] !== undefined) buckets[h.date]++;
  }
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => [date, count]);
}

function computeDifficultyMix(problems) {
  const counts = { Easy: 0, Medium: 0, Hard: 0 };
  for (const p of problems) {
    if (counts[p.difficulty] !== undefined) counts[p.difficulty]++;
  }
  return Object.entries(counts).map(([k, v]) => [k, v]);
}

function computeConfidenceTrend(history) {
  const byWeek = {};
  for (const h of history) {
    if (typeof h.confidence !== 'number') continue;
    const week = isoWeek(h.date);
    if (!byWeek[week]) byWeek[week] = { sum: 0, n: 0 };
    byWeek[week].sum += h.confidence;
    byWeek[week].n += 1;
  }
  return Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, { sum, n }]) => [week, +(sum / n).toFixed(2)]);
}

function isoWeek(dateISO) {
  const d = new Date(dateISO);
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + (4 - (d.getDay() || 7)));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const weekNum = Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7);
  return `${thursday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
